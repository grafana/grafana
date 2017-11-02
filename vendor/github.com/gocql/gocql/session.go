// Copyright (c) 2012 The gocql Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gocql

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode"

	"github.com/gocql/gocql/internal/lru"
)

// Session is the interface used by users to interact with the database.
//
// It's safe for concurrent use by multiple goroutines and a typical usage
// scenario is to have one global session object to interact with the
// whole Cassandra cluster.
//
// This type extends the Node interface by adding a convinient query builder
// and automatically sets a default consistency level on all operations
// that do not have a consistency level set.
type Session struct {
	cons                Consistency
	pageSize            int
	prefetch            float64
	routingKeyInfoCache routingKeyInfoLRU
	schemaDescriber     *schemaDescriber
	trace               Tracer
	hostSource          *ringDescriber
	stmtsLRU            *preparedLRU

	connCfg *ConnConfig

	executor *queryExecutor
	pool     *policyConnPool
	policy   HostSelectionPolicy

	ring     ring
	metadata clusterMetadata

	mu sync.RWMutex

	control *controlConn

	// event handlers
	nodeEvents   *eventDebouncer
	schemaEvents *eventDebouncer

	// ring metadata
	hosts           []HostInfo
	useSystemSchema bool

	cfg ClusterConfig

	quit chan struct{}

	closeMu  sync.RWMutex
	isClosed bool
}

var queryPool = &sync.Pool{
	New: func() interface{} {
		return new(Query)
	},
}

func addrsToHosts(addrs []string, defaultPort int) ([]*HostInfo, error) {
	var hosts []*HostInfo
	for _, hostport := range addrs {
		host, err := hostInfo(hostport, defaultPort)
		if err != nil {
			// Try other hosts if unable to resolve DNS name
			if _, ok := err.(*net.DNSError); ok {
				Logger.Printf("gocql: dns error: %v\n", err)
				continue
			}
			return nil, err
		}

		hosts = append(hosts, host)
	}
	if len(hosts) == 0 {
		return nil, errors.New("failed to resolve any of the provided hostnames")
	}
	return hosts, nil
}

// NewSession wraps an existing Node.
func NewSession(cfg ClusterConfig) (*Session, error) {
	// Check that hosts in the ClusterConfig is not empty
	if len(cfg.Hosts) < 1 {
		return nil, ErrNoHosts
	}

	s := &Session{
		cons:     cfg.Consistency,
		prefetch: 0.25,
		cfg:      cfg,
		pageSize: cfg.PageSize,
		stmtsLRU: &preparedLRU{lru: lru.New(cfg.MaxPreparedStmts)},
		quit:     make(chan struct{}),
	}

	s.nodeEvents = newEventDebouncer("NodeEvents", s.handleNodeEvent)
	s.schemaEvents = newEventDebouncer("SchemaEvents", s.handleSchemaEvent)

	s.routingKeyInfoCache.lru = lru.New(cfg.MaxRoutingKeyInfo)

	s.hostSource = &ringDescriber{
		session: s,
	}

	if cfg.PoolConfig.HostSelectionPolicy == nil {
		cfg.PoolConfig.HostSelectionPolicy = RoundRobinHostPolicy()
	}
	s.pool = cfg.PoolConfig.buildPool(s)

	s.policy = cfg.PoolConfig.HostSelectionPolicy
	s.executor = &queryExecutor{
		pool:   s.pool,
		policy: cfg.PoolConfig.HostSelectionPolicy,
	}

	//Check the TLS Config before trying to connect to anything external
	connCfg, err := connConfig(&s.cfg)
	if err != nil {
		//TODO: Return a typed error
		return nil, fmt.Errorf("gocql: unable to create session: %v", err)
	}
	s.connCfg = connCfg

	if err := s.init(); err != nil {
		s.Close()
		if err == ErrNoConnectionsStarted {
			//This error used to be generated inside NewSession & returned directly
			//Forward it on up to be backwards compatible
			return nil, ErrNoConnectionsStarted
		} else {
			// TODO(zariel): dont wrap this error in fmt.Errorf, return a typed error
			return nil, fmt.Errorf("gocql: unable to create session: %v", err)
		}
	}

	return s, nil
}

func (s *Session) init() error {
	hosts, err := addrsToHosts(s.cfg.Hosts, s.cfg.Port)
	if err != nil {
		return err
	}

	allHosts := hosts
	hosts = hosts[:0]
	hostMap := make(map[string]*HostInfo, len(allHosts))
	for _, host := range allHosts {
		if !s.cfg.filterHost(host) {
			hosts = append(hosts, host)
			hostMap[host.ConnectAddress().String()] = host
		}
	}

	s.ring.endpoints = hosts

	if !s.cfg.disableControlConn {
		s.control = createControlConn(s)
		if s.cfg.ProtoVersion == 0 {
			proto, err := s.control.discoverProtocol(hosts)
			if err != nil {
				return fmt.Errorf("unable to discover protocol version: %v", err)
			} else if proto == 0 {
				return errors.New("unable to discovery protocol version")
			}

			// TODO(zariel): we really only need this in 1 place
			s.cfg.ProtoVersion = proto
			s.connCfg.ProtoVersion = proto
		}

		if err := s.control.connect(hosts); err != nil {
			return err
		}

		if !s.cfg.DisableInitialHostLookup {
			var partitioner string
			newHosts, partitioner, err := s.hostSource.GetHosts()
			if err != nil {
				return err
			}
			s.policy.SetPartitioner(partitioner)
			for _, host := range newHosts {
				hostMap[host.ConnectAddress().String()] = host
			}
		}
	}

	for _, host := range hostMap {
		host = s.ring.addOrUpdate(host)
		s.addNewNode(host)
	}

	// TODO(zariel): we probably dont need this any more as we verify that we
	// can connect to one of the endpoints supplied by using the control conn.
	// See if there are any connections in the pool
	if s.cfg.ReconnectInterval > 0 {
		go s.reconnectDownedHosts(s.cfg.ReconnectInterval)
	}

	// If we disable the initial host lookup, we need to still check if the
	// cluster is using the newer system schema or not... however, if control
	// connection is disable, we really have no choice, so we just make our
	// best guess...
	if !s.cfg.disableControlConn && s.cfg.DisableInitialHostLookup {
		newer, _ := checkSystemSchema(s.control)
		s.useSystemSchema = newer
	} else {
		host := s.ring.rrHost()
		s.useSystemSchema = host.Version().Major >= 3
	}

	if s.pool.Size() == 0 {
		return ErrNoConnectionsStarted
	}

	return nil
}

func (s *Session) reconnectDownedHosts(intv time.Duration) {
	reconnectTicker := time.NewTicker(intv)
	defer reconnectTicker.Stop()

	for {
		select {
		case <-reconnectTicker.C:
			hosts := s.ring.allHosts()

			// Print session.ring for debug.
			if gocqlDebug {
				buf := bytes.NewBufferString("Session.ring:")
				for _, h := range hosts {
					buf.WriteString("[" + h.ConnectAddress().String() + ":" + h.State().String() + "]")
				}
				Logger.Println(buf.String())
			}

			for _, h := range hosts {
				if h.IsUp() {
					continue
				}
				s.handleNodeUp(h.ConnectAddress(), h.Port(), true)
			}
		case <-s.quit:
			return
		}
	}
}

// SetConsistency sets the default consistency level for this session. This
// setting can also be changed on a per-query basis and the default value
// is Quorum.
func (s *Session) SetConsistency(cons Consistency) {
	s.mu.Lock()
	s.cons = cons
	s.mu.Unlock()
}

// SetPageSize sets the default page size for this session. A value <= 0 will
// disable paging. This setting can also be changed on a per-query basis.
func (s *Session) SetPageSize(n int) {
	s.mu.Lock()
	s.pageSize = n
	s.mu.Unlock()
}

// SetPrefetch sets the default threshold for pre-fetching new pages. If
// there are only p*pageSize rows remaining, the next page will be requested
// automatically. This value can also be changed on a per-query basis and
// the default value is 0.25.
func (s *Session) SetPrefetch(p float64) {
	s.mu.Lock()
	s.prefetch = p
	s.mu.Unlock()
}

// SetTrace sets the default tracer for this session. This setting can also
// be changed on a per-query basis.
func (s *Session) SetTrace(trace Tracer) {
	s.mu.Lock()
	s.trace = trace
	s.mu.Unlock()
}

// Query generates a new query object for interacting with the database.
// Further details of the query may be tweaked using the resulting query
// value before the query is executed. Query is automatically prepared
// if it has not previously been executed.
func (s *Session) Query(stmt string, values ...interface{}) *Query {
	s.mu.RLock()
	qry := queryPool.Get().(*Query)
	qry.stmt = stmt
	qry.values = values
	qry.cons = s.cons
	qry.session = s
	qry.pageSize = s.pageSize
	qry.trace = s.trace
	qry.prefetch = s.prefetch
	qry.rt = s.cfg.RetryPolicy
	qry.serialCons = s.cfg.SerialConsistency
	qry.defaultTimestamp = s.cfg.DefaultTimestamp
	s.mu.RUnlock()
	return qry
}

type QueryInfo struct {
	Id          []byte
	Args        []ColumnInfo
	Rval        []ColumnInfo
	PKeyColumns []int
}

// Bind generates a new query object based on the query statement passed in.
// The query is automatically prepared if it has not previously been executed.
// The binding callback allows the application to define which query argument
// values will be marshalled as part of the query execution.
// During execution, the meta data of the prepared query will be routed to the
// binding callback, which is responsible for producing the query argument values.
func (s *Session) Bind(stmt string, b func(q *QueryInfo) ([]interface{}, error)) *Query {
	s.mu.RLock()
	qry := &Query{stmt: stmt, binding: b, cons: s.cons,
		session: s, pageSize: s.pageSize, trace: s.trace,
		prefetch: s.prefetch, rt: s.cfg.RetryPolicy}
	s.mu.RUnlock()
	return qry
}

// Close closes all connections. The session is unusable after this
// operation.
func (s *Session) Close() {

	s.closeMu.Lock()
	defer s.closeMu.Unlock()
	if s.isClosed {
		return
	}
	s.isClosed = true

	if s.pool != nil {
		s.pool.Close()
	}

	if s.control != nil {
		s.control.close()
	}

	if s.nodeEvents != nil {
		s.nodeEvents.stop()
	}

	if s.schemaEvents != nil {
		s.schemaEvents.stop()
	}

	if s.quit != nil {
		close(s.quit)
	}
}

func (s *Session) Closed() bool {
	s.closeMu.RLock()
	closed := s.isClosed
	s.closeMu.RUnlock()
	return closed
}

func (s *Session) executeQuery(qry *Query) *Iter {
	// fail fast
	if s.Closed() {
		return &Iter{err: ErrSessionClosed}
	}

	iter, err := s.executor.executeQuery(qry)
	if err != nil {
		return &Iter{err: err}
	}
	if iter == nil {
		panic("nil iter")
	}

	return iter
}

func (s *Session) removeHost(h *HostInfo) {
	s.policy.RemoveHost(h)
	s.pool.removeHost(h.ConnectAddress())
	s.ring.removeHost(h.ConnectAddress())
}

// KeyspaceMetadata returns the schema metadata for the keyspace specified. Returns an error if the keyspace does not exist.
func (s *Session) KeyspaceMetadata(keyspace string) (*KeyspaceMetadata, error) {
	// fail fast
	if s.Closed() {
		return nil, ErrSessionClosed
	}

	if keyspace == "" {
		return nil, ErrNoKeyspace
	}

	s.mu.Lock()
	// lazy-init schemaDescriber
	if s.schemaDescriber == nil {
		s.schemaDescriber = newSchemaDescriber(s)
	}
	s.mu.Unlock()

	return s.schemaDescriber.getSchema(keyspace)
}

func (s *Session) getConn() *Conn {
	hosts := s.ring.allHosts()
	var conn *Conn
	for _, host := range hosts {
		if !host.IsUp() {
			continue
		}

		pool, ok := s.pool.getPool(host)
		if !ok {
			continue
		}

		conn = pool.Pick()
		if conn != nil {
			return conn
		}
	}

	return nil
}

// returns routing key indexes and type info
func (s *Session) routingKeyInfo(ctx context.Context, stmt string) (*routingKeyInfo, error) {
	s.routingKeyInfoCache.mu.Lock()

	entry, cached := s.routingKeyInfoCache.lru.Get(stmt)
	if cached {
		// done accessing the cache
		s.routingKeyInfoCache.mu.Unlock()
		// the entry is an inflight struct similar to that used by
		// Conn to prepare statements
		inflight := entry.(*inflightCachedEntry)

		// wait for any inflight work
		inflight.wg.Wait()

		if inflight.err != nil {
			return nil, inflight.err
		}

		key, _ := inflight.value.(*routingKeyInfo)

		return key, nil
	}

	// create a new inflight entry while the data is created
	inflight := new(inflightCachedEntry)
	inflight.wg.Add(1)
	defer inflight.wg.Done()
	s.routingKeyInfoCache.lru.Add(stmt, inflight)
	s.routingKeyInfoCache.mu.Unlock()

	var (
		info         *preparedStatment
		partitionKey []*ColumnMetadata
	)

	conn := s.getConn()
	if conn == nil {
		// TODO: better error?
		inflight.err = errors.New("gocql: unable to fetch prepared info: no connection available")
		return nil, inflight.err
	}

	// get the query info for the statement
	info, inflight.err = conn.prepareStatement(ctx, stmt, nil)
	if inflight.err != nil {
		// don't cache this error
		s.routingKeyInfoCache.Remove(stmt)
		return nil, inflight.err
	}

	// TODO: it would be nice to mark hosts here but as we are not using the policies
	// to fetch hosts we cant

	if info.request.colCount == 0 {
		// no arguments, no routing key, and no error
		return nil, nil
	}

	if len(info.request.pkeyColumns) > 0 {
		// proto v4 dont need to calculate primary key columns
		types := make([]TypeInfo, len(info.request.pkeyColumns))
		for i, col := range info.request.pkeyColumns {
			types[i] = info.request.columns[col].TypeInfo
		}

		routingKeyInfo := &routingKeyInfo{
			indexes: info.request.pkeyColumns,
			types:   types,
		}

		inflight.value = routingKeyInfo
		return routingKeyInfo, nil
	}

	// get the table metadata
	table := info.request.columns[0].Table

	var keyspaceMetadata *KeyspaceMetadata
	keyspaceMetadata, inflight.err = s.KeyspaceMetadata(info.request.columns[0].Keyspace)
	if inflight.err != nil {
		// don't cache this error
		s.routingKeyInfoCache.Remove(stmt)
		return nil, inflight.err
	}

	tableMetadata, found := keyspaceMetadata.Tables[table]
	if !found {
		// unlikely that the statement could be prepared and the metadata for
		// the table couldn't be found, but this may indicate either a bug
		// in the metadata code, or that the table was just dropped.
		inflight.err = ErrNoMetadata
		// don't cache this error
		s.routingKeyInfoCache.Remove(stmt)
		return nil, inflight.err
	}

	partitionKey = tableMetadata.PartitionKey

	size := len(partitionKey)
	routingKeyInfo := &routingKeyInfo{
		indexes: make([]int, size),
		types:   make([]TypeInfo, size),
	}

	for keyIndex, keyColumn := range partitionKey {
		// set an indicator for checking if the mapping is missing
		routingKeyInfo.indexes[keyIndex] = -1

		// find the column in the query info
		for argIndex, boundColumn := range info.request.columns {
			if keyColumn.Name == boundColumn.Name {
				// there may be many such bound columns, pick the first
				routingKeyInfo.indexes[keyIndex] = argIndex
				routingKeyInfo.types[keyIndex] = boundColumn.TypeInfo
				break
			}
		}

		if routingKeyInfo.indexes[keyIndex] == -1 {
			// missing a routing key column mapping
			// no routing key, and no error
			return nil, nil
		}
	}

	// cache this result
	inflight.value = routingKeyInfo

	return routingKeyInfo, nil
}

func (b *Batch) execute(conn *Conn) *Iter {
	return conn.executeBatch(b)
}

func (s *Session) executeBatch(batch *Batch) *Iter {
	// fail fast
	if s.Closed() {
		return &Iter{err: ErrSessionClosed}
	}

	// Prevent the execution of the batch if greater than the limit
	// Currently batches have a limit of 65536 queries.
	// https://datastax-oss.atlassian.net/browse/JAVA-229
	if batch.Size() > BatchSizeMaximum {
		return &Iter{err: ErrTooManyStmts}
	}

	iter, err := s.executor.executeQuery(batch)
	if err != nil {
		return &Iter{err: err}
	}

	return iter
}

// ExecuteBatch executes a batch operation and returns nil if successful
// otherwise an error is returned describing the failure.
func (s *Session) ExecuteBatch(batch *Batch) error {
	iter := s.executeBatch(batch)
	return iter.Close()
}

// ExecuteBatchCAS executes a batch operation and returns true if successful and
// an iterator (to scan aditional rows if more than one conditional statement)
// was sent.
// Further scans on the interator must also remember to include
// the applied boolean as the first argument to *Iter.Scan
func (s *Session) ExecuteBatchCAS(batch *Batch, dest ...interface{}) (applied bool, iter *Iter, err error) {
	iter = s.executeBatch(batch)
	if err := iter.checkErrAndNotFound(); err != nil {
		iter.Close()
		return false, nil, err
	}

	if len(iter.Columns()) > 1 {
		dest = append([]interface{}{&applied}, dest...)
		iter.Scan(dest...)
	} else {
		iter.Scan(&applied)
	}

	return applied, iter, nil
}

// MapExecuteBatchCAS executes a batch operation much like ExecuteBatchCAS,
// however it accepts a map rather than a list of arguments for the initial
// scan.
func (s *Session) MapExecuteBatchCAS(batch *Batch, dest map[string]interface{}) (applied bool, iter *Iter, err error) {
	iter = s.executeBatch(batch)
	if err := iter.checkErrAndNotFound(); err != nil {
		iter.Close()
		return false, nil, err
	}
	iter.MapScan(dest)
	applied = dest["[applied]"].(bool)
	delete(dest, "[applied]")

	// we usually close here, but instead of closing, just returin an error
	// if MapScan failed. Although Close just returns err, using Close
	// here might be confusing as we are not actually closing the iter
	return applied, iter, iter.err
}

func (s *Session) connect(host *HostInfo, errorHandler ConnErrorHandler) (*Conn, error) {
	return s.dial(host.ConnectAddress(), host.Port(), s.connCfg, errorHandler)
}

// Query represents a CQL statement that can be executed.
type Query struct {
	stmt                  string
	values                []interface{}
	cons                  Consistency
	pageSize              int
	routingKey            []byte
	routingKeyBuffer      []byte
	pageState             []byte
	prefetch              float64
	trace                 Tracer
	session               *Session
	rt                    RetryPolicy
	binding               func(q *QueryInfo) ([]interface{}, error)
	attempts              int
	totalLatency          int64
	serialCons            SerialConsistency
	defaultTimestamp      bool
	defaultTimestampValue int64
	disableSkipMetadata   bool
	context               context.Context

	disableAutoPage bool
}

// String implements the stringer interface.
func (q Query) String() string {
	return fmt.Sprintf("[query statement=%q values=%+v consistency=%s]", q.stmt, q.values, q.cons)
}

//Attempts returns the number of times the query was executed.
func (q *Query) Attempts() int {
	return q.attempts
}

//Latency returns the average amount of nanoseconds per attempt of the query.
func (q *Query) Latency() int64 {
	if q.attempts > 0 {
		return q.totalLatency / int64(q.attempts)
	}
	return 0
}

// Consistency sets the consistency level for this query. If no consistency
// level have been set, the default consistency level of the cluster
// is used.
func (q *Query) Consistency(c Consistency) *Query {
	q.cons = c
	return q
}

// GetConsistency returns the currently configured consistency level for
// the query.
func (q *Query) GetConsistency() Consistency {
	return q.cons
}

// Trace enables tracing of this query. Look at the documentation of the
// Tracer interface to learn more about tracing.
func (q *Query) Trace(trace Tracer) *Query {
	q.trace = trace
	return q
}

// PageSize will tell the iterator to fetch the result in pages of size n.
// This is useful for iterating over large result sets, but setting the
// page size too low might decrease the performance. This feature is only
// available in Cassandra 2 and onwards.
func (q *Query) PageSize(n int) *Query {
	q.pageSize = n
	return q
}

// DefaultTimestamp will enable the with default timestamp flag on the query.
// If enable, this will replace the server side assigned
// timestamp as default timestamp. Note that a timestamp in the query itself
// will still override this timestamp. This is entirely optional.
//
// Only available on protocol >= 3
func (q *Query) DefaultTimestamp(enable bool) *Query {
	q.defaultTimestamp = enable
	return q
}

// WithTimestamp will enable the with default timestamp flag on the query
// like DefaultTimestamp does. But also allows to define value for timestamp.
// It works the same way as USING TIMESTAMP in the query itself, but
// should not break prepared query optimization
//
// Only available on protocol >= 3
func (q *Query) WithTimestamp(timestamp int64) *Query {
	q.DefaultTimestamp(true)
	q.defaultTimestampValue = timestamp
	return q
}

// RoutingKey sets the routing key to use when a token aware connection
// pool is used to optimize the routing of this query.
func (q *Query) RoutingKey(routingKey []byte) *Query {
	q.routingKey = routingKey
	return q
}

// WithContext will set the context to use during a query, it will be used to
// timeout when waiting for responses from Cassandra.
func (q *Query) WithContext(ctx context.Context) *Query {
	q.context = ctx
	return q
}

func (q *Query) execute(conn *Conn) *Iter {
	return conn.executeQuery(q)
}

func (q *Query) attempt(d time.Duration) {
	q.attempts++
	q.totalLatency += d.Nanoseconds()
	// TODO: track latencies per host and things as well instead of just total
}

func (q *Query) retryPolicy() RetryPolicy {
	return q.rt
}

// GetRoutingKey gets the routing key to use for routing this query. If
// a routing key has not been explicitly set, then the routing key will
// be constructed if possible using the keyspace's schema and the query
// info for this query statement. If the routing key cannot be determined
// then nil will be returned with no error. On any error condition,
// an error description will be returned.
func (q *Query) GetRoutingKey() ([]byte, error) {
	if q.routingKey != nil {
		return q.routingKey, nil
	} else if q.binding != nil && len(q.values) == 0 {
		// If this query was created using session.Bind we wont have the query
		// values yet, so we have to pass down to the next policy.
		// TODO: Remove this and handle this case
		return nil, nil
	}

	// try to determine the routing key
	routingKeyInfo, err := q.session.routingKeyInfo(q.context, q.stmt)
	if err != nil {
		return nil, err
	}

	if routingKeyInfo == nil {
		return nil, nil
	}

	if len(routingKeyInfo.indexes) == 1 {
		// single column routing key
		routingKey, err := Marshal(
			routingKeyInfo.types[0],
			q.values[routingKeyInfo.indexes[0]],
		)
		if err != nil {
			return nil, err
		}
		return routingKey, nil
	}

	// We allocate that buffer only once, so that further re-bind/exec of the
	// same query don't allocate more memory.
	if q.routingKeyBuffer == nil {
		q.routingKeyBuffer = make([]byte, 0, 256)
	}

	// composite routing key
	buf := bytes.NewBuffer(q.routingKeyBuffer)
	for i := range routingKeyInfo.indexes {
		encoded, err := Marshal(
			routingKeyInfo.types[i],
			q.values[routingKeyInfo.indexes[i]],
		)
		if err != nil {
			return nil, err
		}
		lenBuf := []byte{0x00, 0x00}
		binary.BigEndian.PutUint16(lenBuf, uint16(len(encoded)))
		buf.Write(lenBuf)
		buf.Write(encoded)
		buf.WriteByte(0x00)
	}
	routingKey := buf.Bytes()
	return routingKey, nil
}

func (q *Query) shouldPrepare() bool {

	stmt := strings.TrimLeftFunc(strings.TrimRightFunc(q.stmt, func(r rune) bool {
		return unicode.IsSpace(r) || r == ';'
	}), unicode.IsSpace)

	var stmtType string
	if n := strings.IndexFunc(stmt, unicode.IsSpace); n >= 0 {
		stmtType = strings.ToLower(stmt[:n])
	}
	if stmtType == "begin" {
		if n := strings.LastIndexFunc(stmt, unicode.IsSpace); n >= 0 {
			stmtType = strings.ToLower(stmt[n+1:])
		}
	}
	switch stmtType {
	case "select", "insert", "update", "delete", "batch":
		return true
	}
	return false
}

// SetPrefetch sets the default threshold for pre-fetching new pages. If
// there are only p*pageSize rows remaining, the next page will be requested
// automatically.
func (q *Query) Prefetch(p float64) *Query {
	q.prefetch = p
	return q
}

// RetryPolicy sets the policy to use when retrying the query.
func (q *Query) RetryPolicy(r RetryPolicy) *Query {
	q.rt = r
	return q
}

// Bind sets query arguments of query. This can also be used to rebind new query arguments
// to an existing query instance.
func (q *Query) Bind(v ...interface{}) *Query {
	q.values = v
	return q
}

// SerialConsistency sets the consistency level for the
// serial phase of conditional updates. That consistency can only be
// either SERIAL or LOCAL_SERIAL and if not present, it defaults to
// SERIAL. This option will be ignored for anything else that a
// conditional update/insert.
func (q *Query) SerialConsistency(cons SerialConsistency) *Query {
	q.serialCons = cons
	return q
}

// PageState sets the paging state for the query to resume paging from a specific
// point in time. Setting this will disable to query paging for this query, and
// must be used for all subsequent pages.
func (q *Query) PageState(state []byte) *Query {
	q.pageState = state
	q.disableAutoPage = true
	return q
}

// NoSkipMetadata will override the internal result metadata cache so that the driver does not
// send skip_metadata for queries, this means that the result will always contain
// the metadata to parse the rows and will not reuse the metadata from the prepared
// staement. This should only be used to work around cassandra bugs, such as when using
// CAS operations which do not end in Cas.
//
// See https://issues.apache.org/jira/browse/CASSANDRA-11099
// https://github.com/gocql/gocql/issues/612
func (q *Query) NoSkipMetadata() *Query {
	q.disableSkipMetadata = true
	return q
}

// Exec executes the query without returning any rows.
func (q *Query) Exec() error {
	return q.Iter().Close()
}

func isUseStatement(stmt string) bool {
	if len(stmt) < 3 {
		return false
	}

	return strings.ToLower(stmt[0:3]) == "use"
}

// Iter executes the query and returns an iterator capable of iterating
// over all results.
func (q *Query) Iter() *Iter {
	if isUseStatement(q.stmt) {
		return &Iter{err: ErrUseStmt}
	}
	return q.session.executeQuery(q)
}

// MapScan executes the query, copies the columns of the first selected
// row into the map pointed at by m and discards the rest. If no rows
// were selected, ErrNotFound is returned.
func (q *Query) MapScan(m map[string]interface{}) error {
	iter := q.Iter()
	if err := iter.checkErrAndNotFound(); err != nil {
		return err
	}
	iter.MapScan(m)
	return iter.Close()
}

// Scan executes the query, copies the columns of the first selected
// row into the values pointed at by dest and discards the rest. If no rows
// were selected, ErrNotFound is returned.
func (q *Query) Scan(dest ...interface{}) error {
	iter := q.Iter()
	if err := iter.checkErrAndNotFound(); err != nil {
		return err
	}
	iter.Scan(dest...)
	return iter.Close()
}

// ScanCAS executes a lightweight transaction (i.e. an UPDATE or INSERT
// statement containing an IF clause). If the transaction fails because
// the existing values did not match, the previous values will be stored
// in dest.
func (q *Query) ScanCAS(dest ...interface{}) (applied bool, err error) {
	q.disableSkipMetadata = true
	iter := q.Iter()
	if err := iter.checkErrAndNotFound(); err != nil {
		return false, err
	}
	if len(iter.Columns()) > 1 {
		dest = append([]interface{}{&applied}, dest...)
		iter.Scan(dest...)
	} else {
		iter.Scan(&applied)
	}
	return applied, iter.Close()
}

// MapScanCAS executes a lightweight transaction (i.e. an UPDATE or INSERT
// statement containing an IF clause). If the transaction fails because
// the existing values did not match, the previous values will be stored
// in dest map.
//
// As for INSERT .. IF NOT EXISTS, previous values will be returned as if
// SELECT * FROM. So using ScanCAS with INSERT is inherently prone to
// column mismatching. MapScanCAS is added to capture them safely.
func (q *Query) MapScanCAS(dest map[string]interface{}) (applied bool, err error) {
	q.disableSkipMetadata = true
	iter := q.Iter()
	if err := iter.checkErrAndNotFound(); err != nil {
		return false, err
	}
	iter.MapScan(dest)
	applied = dest["[applied]"].(bool)
	delete(dest, "[applied]")

	return applied, iter.Close()
}

// Release releases a query back into a pool of queries. Released Queries
// cannot be reused.
//
// Example:
// 		qry := session.Query("SELECT * FROM my_table")
// 		qry.Exec()
// 		qry.Release()
func (q *Query) Release() {
	q.reset()
	queryPool.Put(q)
}

// reset zeroes out all fields of a query so that it can be safely pooled.
func (q *Query) reset() {
	q.stmt = ""
	q.values = nil
	q.cons = 0
	q.pageSize = 0
	q.routingKey = nil
	q.routingKeyBuffer = nil
	q.pageState = nil
	q.prefetch = 0
	q.trace = nil
	q.session = nil
	q.rt = nil
	q.binding = nil
	q.attempts = 0
	q.totalLatency = 0
	q.serialCons = 0
	q.defaultTimestamp = false
	q.disableSkipMetadata = false
	q.disableAutoPage = false
	q.context = nil
}

// Iter represents an iterator that can be used to iterate over all rows that
// were returned by a query. The iterator might send additional queries to the
// database during the iteration if paging was enabled.
type Iter struct {
	err     error
	pos     int
	meta    resultMetadata
	numRows int
	next    *nextIter
	host    *HostInfo

	framer *framer
	closed int32
}

// Host returns the host which the query was sent to.
func (iter *Iter) Host() *HostInfo {
	return iter.host
}

// Columns returns the name and type of the selected columns.
func (iter *Iter) Columns() []ColumnInfo {
	return iter.meta.columns
}

type Scanner interface {
	// Next advances the row pointer to point at the next row, the row is valid until
	// the next call of Next. It returns true if there is a row which is available to be
	// scanned into with Scan.
	// Next must be called before every call to Scan.
	Next() bool

	// Scan copies the current row's columns into dest. If the length of dest does not equal
	// the number of columns returned in the row an error is returned. If an error is encountered
	// when unmarshalling a column into the value in dest an error is returned and the row is invalidated
	// until the next call to Next.
	// Next must be called before calling Scan, if it is not an error is returned.
	Scan(...interface{}) error

	// Err returns the if there was one during iteration that resulted in iteration being unable to complete.
	// Err will also release resources held by the iterator, the Scanner should not used after being called.
	Err() error
}

type iterScanner struct {
	iter *Iter
	cols [][]byte
}

func (is *iterScanner) Next() bool {
	iter := is.iter
	if iter.err != nil {
		return false
	}

	if iter.pos >= iter.numRows {
		if iter.next != nil {
			is.iter = iter.next.fetch()
			return is.Next()
		}
		return false
	}

	cols := make([][]byte, len(iter.meta.columns))
	for i := 0; i < len(cols); i++ {
		col, err := iter.readColumn()
		if err != nil {
			iter.err = err
			return false
		}
		cols[i] = col
	}
	is.cols = cols
	iter.pos++

	return true
}

func scanColumn(p []byte, col ColumnInfo, dest []interface{}) (int, error) {
	if dest[0] == nil {
		return 1, nil
	}

	if col.TypeInfo.Type() == TypeTuple {
		// this will panic, actually a bug, please report
		tuple := col.TypeInfo.(TupleTypeInfo)

		count := len(tuple.Elems)
		// here we pass in a slice of the struct which has the number number of
		// values as elements in the tuple
		if err := Unmarshal(col.TypeInfo, p, dest[:count]); err != nil {
			return 0, err
		}
		return count, nil
	} else {
		if err := Unmarshal(col.TypeInfo, p, dest[0]); err != nil {
			return 0, err
		}
		return 1, nil
	}
}

func (is *iterScanner) Scan(dest ...interface{}) error {
	if is.cols == nil {
		return errors.New("gocql: Scan called without calling Next")
	}

	iter := is.iter
	// currently only support scanning into an expand tuple, such that its the same
	// as scanning in more values from a single column
	if len(dest) != iter.meta.actualColCount {
		return fmt.Errorf("gocql: not enough columns to scan into: have %d want %d", len(dest), iter.meta.actualColCount)
	}

	// i is the current position in dest, could posible replace it and just use
	// slices of dest
	i := 0
	var err error
	for _, col := range iter.meta.columns {
		var n int
		n, err = scanColumn(is.cols[i], col, dest[i:])
		if err != nil {
			break
		}
		i += n
	}

	is.cols = nil

	return err
}

func (is *iterScanner) Err() error {
	iter := is.iter
	is.iter = nil
	is.cols = nil
	return iter.Close()
}

// Scanner returns a row Scanner which provides an interface to scan rows in a manner which is
// similar to database/sql. The iter should NOT be used again after calling this method.
func (iter *Iter) Scanner() Scanner {
	if iter == nil {
		return nil
	}

	return &iterScanner{iter: iter}
}

func (iter *Iter) readColumn() ([]byte, error) {
	return iter.framer.readBytesInternal()
}

// Scan consumes the next row of the iterator and copies the columns of the
// current row into the values pointed at by dest. Use nil as a dest value
// to skip the corresponding column. Scan might send additional queries
// to the database to retrieve the next set of rows if paging was enabled.
//
// Scan returns true if the row was successfully unmarshaled or false if the
// end of the result set was reached or if an error occurred. Close should
// be called afterwards to retrieve any potential errors.
func (iter *Iter) Scan(dest ...interface{}) bool {
	if iter.err != nil {
		return false
	}

	if iter.pos >= iter.numRows {
		if iter.next != nil {
			*iter = *iter.next.fetch()
			return iter.Scan(dest...)
		}
		return false
	}

	if iter.next != nil && iter.pos == iter.next.pos {
		go iter.next.fetch()
	}

	// currently only support scanning into an expand tuple, such that its the same
	// as scanning in more values from a single column
	if len(dest) != iter.meta.actualColCount {
		iter.err = fmt.Errorf("gocql: not enough columns to scan into: have %d want %d", len(dest), iter.meta.actualColCount)
		return false
	}

	// i is the current position in dest, could posible replace it and just use
	// slices of dest
	i := 0
	for _, col := range iter.meta.columns {
		colBytes, err := iter.readColumn()
		if err != nil {
			iter.err = err
			return false
		}

		n, err := scanColumn(colBytes, col, dest[i:])
		if err != nil {
			iter.err = err
			return false
		}
		i += n
	}

	iter.pos++
	return true
}

// GetCustomPayload returns any parsed custom payload results if given in the
// response from Cassandra. Note that the result is not a copy.
//
// This additional feature of CQL Protocol v4
// allows additional results and query information to be returned by
// custom QueryHandlers running in your C* cluster.
// See https://datastax.github.io/java-driver/manual/custom_payloads/
func (iter *Iter) GetCustomPayload() map[string][]byte {
	return iter.framer.header.customPayload
}

// Warnings returns any warnings generated if given in the response from Cassandra.
//
// This is only available starting with CQL Protocol v4.
func (iter *Iter) Warnings() []string {
	if iter.framer != nil {
		return iter.framer.header.warnings
	}
	return nil
}

// Close closes the iterator and returns any errors that happened during
// the query or the iteration.
func (iter *Iter) Close() error {
	if atomic.CompareAndSwapInt32(&iter.closed, 0, 1) {
		if iter.framer != nil {
			framerPool.Put(iter.framer)
			iter.framer = nil
		}
	}

	return iter.err
}

// WillSwitchPage detects if iterator reached end of current page
// and the next page is available.
func (iter *Iter) WillSwitchPage() bool {
	return iter.pos >= iter.numRows && iter.next != nil
}

// checkErrAndNotFound handle error and NotFound in one method.
func (iter *Iter) checkErrAndNotFound() error {
	if iter.err != nil {
		return iter.err
	} else if iter.numRows == 0 {
		return ErrNotFound
	}
	return nil
}

// PageState return the current paging state for a query which can be used for
// subsequent quries to resume paging this point.
func (iter *Iter) PageState() []byte {
	return iter.meta.pagingState
}

// NumRows returns the number of rows in this pagination, it will update when new
// pages are fetched, it is not the value of the total number of rows this iter
// will return unless there is only a single page returned.
func (iter *Iter) NumRows() int {
	return iter.numRows
}

type nextIter struct {
	qry  Query
	pos  int
	once sync.Once
	next *Iter
	conn *Conn
}

func (n *nextIter) fetch() *Iter {
	n.once.Do(func() {
		iter := n.qry.session.executor.attemptQuery(&n.qry, n.conn)
		if iter != nil && iter.err == nil {
			n.next = iter
		} else {
			n.next = n.qry.session.executeQuery(&n.qry)
		}
	})
	return n.next
}

type Batch struct {
	Type                  BatchType
	Entries               []BatchEntry
	Cons                  Consistency
	rt                    RetryPolicy
	attempts              int
	totalLatency          int64
	serialCons            SerialConsistency
	defaultTimestamp      bool
	defaultTimestampValue int64
	context               context.Context
}

// NewBatch creates a new batch operation without defaults from the cluster
func NewBatch(typ BatchType) *Batch {
	return &Batch{Type: typ}
}

// NewBatch creates a new batch operation using defaults defined in the cluster
func (s *Session) NewBatch(typ BatchType) *Batch {
	s.mu.RLock()
	batch := &Batch{Type: typ, rt: s.cfg.RetryPolicy, serialCons: s.cfg.SerialConsistency,
		Cons: s.cons, defaultTimestamp: s.cfg.DefaultTimestamp}
	s.mu.RUnlock()
	return batch
}

// Attempts returns the number of attempts made to execute the batch.
func (b *Batch) Attempts() int {
	return b.attempts
}

//Latency returns the average number of nanoseconds to execute a single attempt of the batch.
func (b *Batch) Latency() int64 {
	if b.attempts > 0 {
		return b.totalLatency / int64(b.attempts)
	}
	return 0
}

// GetConsistency returns the currently configured consistency level for the batch
// operation.
func (b *Batch) GetConsistency() Consistency {
	return b.Cons
}

// Query adds the query to the batch operation
func (b *Batch) Query(stmt string, args ...interface{}) {
	b.Entries = append(b.Entries, BatchEntry{Stmt: stmt, Args: args})
}

// Bind adds the query to the batch operation and correlates it with a binding callback
// that will be invoked when the batch is executed. The binding callback allows the application
// to define which query argument values will be marshalled as part of the batch execution.
func (b *Batch) Bind(stmt string, bind func(q *QueryInfo) ([]interface{}, error)) {
	b.Entries = append(b.Entries, BatchEntry{Stmt: stmt, binding: bind})
}

func (b *Batch) retryPolicy() RetryPolicy {
	return b.rt
}

// RetryPolicy sets the retry policy to use when executing the batch operation
func (b *Batch) RetryPolicy(r RetryPolicy) *Batch {
	b.rt = r
	return b
}

// WithContext will set the context to use during a query, it will be used to
// timeout when waiting for responses from Cassandra.
func (b *Batch) WithContext(ctx context.Context) *Batch {
	b.context = ctx
	return b
}

// Size returns the number of batch statements to be executed by the batch operation.
func (b *Batch) Size() int {
	return len(b.Entries)
}

// SerialConsistency sets the consistency level for the
// serial phase of conditional updates. That consistency can only be
// either SERIAL or LOCAL_SERIAL and if not present, it defaults to
// SERIAL. This option will be ignored for anything else that a
// conditional update/insert.
//
// Only available for protocol 3 and above
func (b *Batch) SerialConsistency(cons SerialConsistency) *Batch {
	b.serialCons = cons
	return b
}

// DefaultTimestamp will enable the with default timestamp flag on the query.
// If enable, this will replace the server side assigned
// timestamp as default timestamp. Note that a timestamp in the query itself
// will still override this timestamp. This is entirely optional.
//
// Only available on protocol >= 3
func (b *Batch) DefaultTimestamp(enable bool) *Batch {
	b.defaultTimestamp = enable
	return b
}

// WithTimestamp will enable the with default timestamp flag on the query
// like DefaultTimestamp does. But also allows to define value for timestamp.
// It works the same way as USING TIMESTAMP in the query itself, but
// should not break prepared query optimization
//
// Only available on protocol >= 3
func (b *Batch) WithTimestamp(timestamp int64) *Batch {
	b.DefaultTimestamp(true)
	b.defaultTimestampValue = timestamp
	return b
}

func (b *Batch) attempt(d time.Duration) {
	b.attempts++
	b.totalLatency += d.Nanoseconds()
	// TODO: track latencies per host and things as well instead of just total
}

func (b *Batch) GetRoutingKey() ([]byte, error) {
	// TODO: use the first statement in the batch as the routing key?
	return nil, nil
}

type BatchType byte

const (
	LoggedBatch   BatchType = 0
	UnloggedBatch BatchType = 1
	CounterBatch  BatchType = 2
)

type BatchEntry struct {
	Stmt    string
	Args    []interface{}
	binding func(q *QueryInfo) ([]interface{}, error)
}

type ColumnInfo struct {
	Keyspace string
	Table    string
	Name     string
	TypeInfo TypeInfo
}

func (c ColumnInfo) String() string {
	return fmt.Sprintf("[column keyspace=%s table=%s name=%s type=%v]", c.Keyspace, c.Table, c.Name, c.TypeInfo)
}

// routing key indexes LRU cache
type routingKeyInfoLRU struct {
	lru *lru.Cache
	mu  sync.Mutex
}

type routingKeyInfo struct {
	indexes []int
	types   []TypeInfo
}

func (r *routingKeyInfo) String() string {
	return fmt.Sprintf("routing key index=%v types=%v", r.indexes, r.types)
}

func (r *routingKeyInfoLRU) Remove(key string) {
	r.mu.Lock()
	r.lru.Remove(key)
	r.mu.Unlock()
}

//Max adjusts the maximum size of the cache and cleans up the oldest records if
//the new max is lower than the previous value. Not concurrency safe.
func (r *routingKeyInfoLRU) Max(max int) {
	r.mu.Lock()
	for r.lru.Len() > max {
		r.lru.RemoveOldest()
	}
	r.lru.MaxEntries = max
	r.mu.Unlock()
}

type inflightCachedEntry struct {
	wg    sync.WaitGroup
	err   error
	value interface{}
}

// Tracer is the interface implemented by query tracers. Tracers have the
// ability to obtain a detailed event log of all events that happened during
// the execution of a query from Cassandra. Gathering this information might
// be essential for debugging and optimizing queries, but this feature should
// not be used on production systems with very high load.
type Tracer interface {
	Trace(traceId []byte)
}

type traceWriter struct {
	session *Session
	w       io.Writer
	mu      sync.Mutex
}

// NewTraceWriter returns a simple Tracer implementation that outputs
// the event log in a textual format.
func NewTraceWriter(session *Session, w io.Writer) Tracer {
	return &traceWriter{session: session, w: w}
}

func (t *traceWriter) Trace(traceId []byte) {
	var (
		coordinator string
		duration    int
	)
	iter := t.session.control.query(`SELECT coordinator, duration
			FROM system_traces.sessions
			WHERE session_id = ?`, traceId)

	iter.Scan(&coordinator, &duration)
	if err := iter.Close(); err != nil {
		t.mu.Lock()
		fmt.Fprintln(t.w, "Error:", err)
		t.mu.Unlock()
		return
	}

	var (
		timestamp time.Time
		activity  string
		source    string
		elapsed   int
	)

	fmt.Fprintf(t.w, "Tracing session %016x (coordinator: %s, duration: %v):\n",
		traceId, coordinator, time.Duration(duration)*time.Microsecond)

	t.mu.Lock()
	defer t.mu.Unlock()

	iter = t.session.control.query(`SELECT event_id, activity, source, source_elapsed
			FROM system_traces.events
			WHERE session_id = ?`, traceId)

	for iter.Scan(&timestamp, &activity, &source, &elapsed) {
		fmt.Fprintf(t.w, "%s: %s (source: %s, elapsed: %d)\n",
			timestamp.Format("2006/01/02 15:04:05.999999"), activity, source, elapsed)
	}

	if err := iter.Close(); err != nil {
		fmt.Fprintln(t.w, "Error:", err)
	}
}

type Error struct {
	Code    int
	Message string
}

func (e Error) Error() string {
	return e.Message
}

var (
	ErrNotFound             = errors.New("not found")
	ErrUnavailable          = errors.New("unavailable")
	ErrUnsupported          = errors.New("feature not supported")
	ErrTooManyStmts         = errors.New("too many statements")
	ErrUseStmt              = errors.New("use statements aren't supported. Please see https://github.com/gocql/gocql for explanation.")
	ErrSessionClosed        = errors.New("session has been closed")
	ErrNoConnections        = errors.New("gocql: no hosts available in the pool")
	ErrNoKeyspace           = errors.New("no keyspace provided")
	ErrKeyspaceDoesNotExist = errors.New("keyspace does not exist")
	ErrNoMetadata           = errors.New("no metadata available")
)

type ErrProtocol struct{ error }

func NewErrProtocol(format string, args ...interface{}) error {
	return ErrProtocol{fmt.Errorf(format, args...)}
}

// BatchSizeMaximum is the maximum number of statements a batch operation can have.
// This limit is set by cassandra and could change in the future.
const BatchSizeMaximum = 65535
