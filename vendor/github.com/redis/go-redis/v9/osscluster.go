package redis

import (
	"context"
	"crypto/tls"
	"fmt"
	"math"
	"net"
	"net/url"
	"runtime"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9/internal"
	"github.com/redis/go-redis/v9/internal/hashtag"
	"github.com/redis/go-redis/v9/internal/pool"
	"github.com/redis/go-redis/v9/internal/proto"
	"github.com/redis/go-redis/v9/internal/rand"
)

const (
	minLatencyMeasurementInterval = 10 * time.Second
)

var errClusterNoNodes = fmt.Errorf("redis: cluster has no nodes")

// ClusterOptions are used to configure a cluster client and should be
// passed to NewClusterClient.
type ClusterOptions struct {
	// A seed list of host:port addresses of cluster nodes.
	Addrs []string

	// ClientName will execute the `CLIENT SETNAME ClientName` command for each conn.
	ClientName string

	// NewClient creates a cluster node client with provided name and options.
	NewClient func(opt *Options) *Client

	// The maximum number of retries before giving up. Command is retried
	// on network errors and MOVED/ASK redirects.
	// Default is 3 retries.
	MaxRedirects int

	// Enables read-only commands on slave nodes.
	ReadOnly bool
	// Allows routing read-only commands to the closest master or slave node.
	// It automatically enables ReadOnly.
	RouteByLatency bool
	// Allows routing read-only commands to the random master or slave node.
	// It automatically enables ReadOnly.
	RouteRandomly bool

	// Optional function that returns cluster slots information.
	// It is useful to manually create cluster of standalone Redis servers
	// and load-balance read/write operations between master and slaves.
	// It can use service like ZooKeeper to maintain configuration information
	// and Cluster.ReloadState to manually trigger state reloading.
	ClusterSlots func(context.Context) ([]ClusterSlot, error)

	// Following options are copied from Options struct.

	Dialer func(ctx context.Context, network, addr string) (net.Conn, error)

	OnConnect func(ctx context.Context, cn *Conn) error

	Protocol                   int
	Username                   string
	Password                   string
	CredentialsProvider        func() (username string, password string)
	CredentialsProviderContext func(ctx context.Context) (username string, password string, err error)

	MaxRetries      int
	MinRetryBackoff time.Duration
	MaxRetryBackoff time.Duration

	DialTimeout           time.Duration
	ReadTimeout           time.Duration
	WriteTimeout          time.Duration
	ContextTimeoutEnabled bool

	PoolFIFO        bool
	PoolSize        int // applies per cluster node and not for the whole cluster
	PoolTimeout     time.Duration
	MinIdleConns    int
	MaxIdleConns    int
	MaxActiveConns  int // applies per cluster node and not for the whole cluster
	ConnMaxIdleTime time.Duration
	ConnMaxLifetime time.Duration

	TLSConfig *tls.Config

	// DisableIndentity - Disable set-lib on connect.
	//
	// default: false
	//
	// Deprecated: Use DisableIdentity instead.
	DisableIndentity bool

	// DisableIdentity is used to disable CLIENT SETINFO command on connect.
	//
	// default: false
	DisableIdentity bool

	IdentitySuffix string // Add suffix to client name. Default is empty.

	// UnstableResp3 enables Unstable mode for Redis Search module with RESP3.
	UnstableResp3 bool
}

func (opt *ClusterOptions) init() {
	switch opt.MaxRedirects {
	case -1:
		opt.MaxRedirects = 0
	case 0:
		opt.MaxRedirects = 3
	}

	if opt.RouteByLatency || opt.RouteRandomly {
		opt.ReadOnly = true
	}

	if opt.PoolSize == 0 {
		opt.PoolSize = 5 * runtime.GOMAXPROCS(0)
	}

	switch opt.ReadTimeout {
	case -1:
		opt.ReadTimeout = 0
	case 0:
		opt.ReadTimeout = 3 * time.Second
	}
	switch opt.WriteTimeout {
	case -1:
		opt.WriteTimeout = 0
	case 0:
		opt.WriteTimeout = opt.ReadTimeout
	}

	if opt.MaxRetries == 0 {
		opt.MaxRetries = -1
	}
	switch opt.MinRetryBackoff {
	case -1:
		opt.MinRetryBackoff = 0
	case 0:
		opt.MinRetryBackoff = 8 * time.Millisecond
	}
	switch opt.MaxRetryBackoff {
	case -1:
		opt.MaxRetryBackoff = 0
	case 0:
		opt.MaxRetryBackoff = 512 * time.Millisecond
	}

	if opt.NewClient == nil {
		opt.NewClient = NewClient
	}
}

// ParseClusterURL parses a URL into ClusterOptions that can be used to connect to Redis.
// The URL must be in the form:
//
//	redis://<user>:<password>@<host>:<port>
//	or
//	rediss://<user>:<password>@<host>:<port>
//
// To add additional addresses, specify the query parameter, "addr" one or more times. e.g:
//
//	redis://<user>:<password>@<host>:<port>?addr=<host2>:<port2>&addr=<host3>:<port3>
//	or
//	rediss://<user>:<password>@<host>:<port>?addr=<host2>:<port2>&addr=<host3>:<port3>
//
// Most Option fields can be set using query parameters, with the following restrictions:
//   - field names are mapped using snake-case conversion: to set MaxRetries, use max_retries
//   - only scalar type fields are supported (bool, int, time.Duration)
//   - for time.Duration fields, values must be a valid input for time.ParseDuration();
//     additionally a plain integer as value (i.e. without unit) is interpreted as seconds
//   - to disable a duration field, use value less than or equal to 0; to use the default
//     value, leave the value blank or remove the parameter
//   - only the last value is interpreted if a parameter is given multiple times
//   - fields "network", "addr", "username" and "password" can only be set using other
//     URL attributes (scheme, host, userinfo, resp.), query parameters using these
//     names will be treated as unknown parameters
//   - unknown parameter names will result in an error
//
// Example:
//
//	redis://user:password@localhost:6789?dial_timeout=3&read_timeout=6s&addr=localhost:6790&addr=localhost:6791
//	is equivalent to:
//	&ClusterOptions{
//		Addr:        ["localhost:6789", "localhost:6790", "localhost:6791"]
//		DialTimeout: 3 * time.Second, // no time unit = seconds
//		ReadTimeout: 6 * time.Second,
//	}
func ParseClusterURL(redisURL string) (*ClusterOptions, error) {
	o := &ClusterOptions{}

	u, err := url.Parse(redisURL)
	if err != nil {
		return nil, err
	}

	// add base URL to the array of addresses
	// more addresses may be added through the URL params
	h, p := getHostPortWithDefaults(u)
	o.Addrs = append(o.Addrs, net.JoinHostPort(h, p))

	// setup username, password, and other configurations
	o, err = setupClusterConn(u, h, o)
	if err != nil {
		return nil, err
	}

	return o, nil
}

// setupClusterConn gets the username and password from the URL and the query parameters.
func setupClusterConn(u *url.URL, host string, o *ClusterOptions) (*ClusterOptions, error) {
	switch u.Scheme {
	case "rediss":
		o.TLSConfig = &tls.Config{ServerName: host}
		fallthrough
	case "redis":
		o.Username, o.Password = getUserPassword(u)
	default:
		return nil, fmt.Errorf("redis: invalid URL scheme: %s", u.Scheme)
	}

	// retrieve the configuration from the query parameters
	o, err := setupClusterQueryParams(u, o)
	if err != nil {
		return nil, err
	}

	return o, nil
}

// setupClusterQueryParams converts query parameters in u to option value in o.
func setupClusterQueryParams(u *url.URL, o *ClusterOptions) (*ClusterOptions, error) {
	q := queryOptions{q: u.Query()}

	o.Protocol = q.int("protocol")
	o.ClientName = q.string("client_name")
	o.MaxRedirects = q.int("max_redirects")
	o.ReadOnly = q.bool("read_only")
	o.RouteByLatency = q.bool("route_by_latency")
	o.RouteRandomly = q.bool("route_randomly")
	o.MaxRetries = q.int("max_retries")
	o.MinRetryBackoff = q.duration("min_retry_backoff")
	o.MaxRetryBackoff = q.duration("max_retry_backoff")
	o.DialTimeout = q.duration("dial_timeout")
	o.ReadTimeout = q.duration("read_timeout")
	o.WriteTimeout = q.duration("write_timeout")
	o.PoolFIFO = q.bool("pool_fifo")
	o.PoolSize = q.int("pool_size")
	o.MinIdleConns = q.int("min_idle_conns")
	o.MaxIdleConns = q.int("max_idle_conns")
	o.MaxActiveConns = q.int("max_active_conns")
	o.PoolTimeout = q.duration("pool_timeout")
	o.ConnMaxLifetime = q.duration("conn_max_lifetime")
	o.ConnMaxIdleTime = q.duration("conn_max_idle_time")

	if q.err != nil {
		return nil, q.err
	}

	// addr can be specified as many times as needed
	addrs := q.strings("addr")
	for _, addr := range addrs {
		h, p, err := net.SplitHostPort(addr)
		if err != nil || h == "" || p == "" {
			return nil, fmt.Errorf("redis: unable to parse addr param: %s", addr)
		}

		o.Addrs = append(o.Addrs, net.JoinHostPort(h, p))
	}

	// any parameters left?
	if r := q.remaining(); len(r) > 0 {
		return nil, fmt.Errorf("redis: unexpected option: %s", strings.Join(r, ", "))
	}

	return o, nil
}

func (opt *ClusterOptions) clientOptions() *Options {
	return &Options{
		ClientName: opt.ClientName,
		Dialer:     opt.Dialer,
		OnConnect:  opt.OnConnect,

		Protocol:                   opt.Protocol,
		Username:                   opt.Username,
		Password:                   opt.Password,
		CredentialsProvider:        opt.CredentialsProvider,
		CredentialsProviderContext: opt.CredentialsProviderContext,

		MaxRetries:      opt.MaxRetries,
		MinRetryBackoff: opt.MinRetryBackoff,
		MaxRetryBackoff: opt.MaxRetryBackoff,

		DialTimeout:           opt.DialTimeout,
		ReadTimeout:           opt.ReadTimeout,
		WriteTimeout:          opt.WriteTimeout,
		ContextTimeoutEnabled: opt.ContextTimeoutEnabled,

		PoolFIFO:         opt.PoolFIFO,
		PoolSize:         opt.PoolSize,
		PoolTimeout:      opt.PoolTimeout,
		MinIdleConns:     opt.MinIdleConns,
		MaxIdleConns:     opt.MaxIdleConns,
		MaxActiveConns:   opt.MaxActiveConns,
		ConnMaxIdleTime:  opt.ConnMaxIdleTime,
		ConnMaxLifetime:  opt.ConnMaxLifetime,
		DisableIdentity:  opt.DisableIdentity,
		DisableIndentity: opt.DisableIdentity,
		IdentitySuffix:   opt.IdentitySuffix,
		TLSConfig:        opt.TLSConfig,
		// If ClusterSlots is populated, then we probably have an artificial
		// cluster whose nodes are not in clustering mode (otherwise there isn't
		// much use for ClusterSlots config).  This means we cannot execute the
		// READONLY command against that node -- setting readOnly to false in such
		// situations in the options below will prevent that from happening.
		readOnly:      opt.ReadOnly && opt.ClusterSlots == nil,
		UnstableResp3: opt.UnstableResp3,
	}
}

//------------------------------------------------------------------------------

type clusterNode struct {
	Client *Client

	latency    uint32 // atomic
	generation uint32 // atomic
	failing    uint32 // atomic

	// last time the latency measurement was performed for the node, stored in nanoseconds
	// from epoch
	lastLatencyMeasurement int64 // atomic
}

func newClusterNode(clOpt *ClusterOptions, addr string) *clusterNode {
	opt := clOpt.clientOptions()
	opt.Addr = addr
	node := clusterNode{
		Client: clOpt.NewClient(opt),
	}

	node.latency = math.MaxUint32
	if clOpt.RouteByLatency {
		go node.updateLatency()
	}

	return &node
}

func (n *clusterNode) String() string {
	return n.Client.String()
}

func (n *clusterNode) Close() error {
	return n.Client.Close()
}

const maximumNodeLatency = 1 * time.Minute

func (n *clusterNode) updateLatency() {
	const numProbe = 10
	var dur uint64

	successes := 0
	for i := 0; i < numProbe; i++ {
		time.Sleep(time.Duration(10+rand.Intn(10)) * time.Millisecond)

		start := time.Now()
		err := n.Client.Ping(context.TODO()).Err()
		if err == nil {
			dur += uint64(time.Since(start) / time.Microsecond)
			successes++
		}
	}

	var latency float64
	if successes == 0 {
		// If none of the pings worked, set latency to some arbitrarily high value so this node gets
		// least priority.
		latency = float64((maximumNodeLatency) / time.Microsecond)
	} else {
		latency = float64(dur) / float64(successes)
	}
	atomic.StoreUint32(&n.latency, uint32(latency+0.5))
	n.SetLastLatencyMeasurement(time.Now())
}

func (n *clusterNode) Latency() time.Duration {
	latency := atomic.LoadUint32(&n.latency)
	return time.Duration(latency) * time.Microsecond
}

func (n *clusterNode) MarkAsFailing() {
	atomic.StoreUint32(&n.failing, uint32(time.Now().Unix()))
}

func (n *clusterNode) Failing() bool {
	const timeout = 15 // 15 seconds

	failing := atomic.LoadUint32(&n.failing)
	if failing == 0 {
		return false
	}
	if time.Now().Unix()-int64(failing) < timeout {
		return true
	}
	atomic.StoreUint32(&n.failing, 0)
	return false
}

func (n *clusterNode) Generation() uint32 {
	return atomic.LoadUint32(&n.generation)
}

func (n *clusterNode) LastLatencyMeasurement() int64 {
	return atomic.LoadInt64(&n.lastLatencyMeasurement)
}

func (n *clusterNode) SetGeneration(gen uint32) {
	for {
		v := atomic.LoadUint32(&n.generation)
		if gen < v || atomic.CompareAndSwapUint32(&n.generation, v, gen) {
			break
		}
	}
}

func (n *clusterNode) SetLastLatencyMeasurement(t time.Time) {
	for {
		v := atomic.LoadInt64(&n.lastLatencyMeasurement)
		if t.UnixNano() < v || atomic.CompareAndSwapInt64(&n.lastLatencyMeasurement, v, t.UnixNano()) {
			break
		}
	}
}

//------------------------------------------------------------------------------

type clusterNodes struct {
	opt *ClusterOptions

	mu          sync.RWMutex
	addrs       []string
	nodes       map[string]*clusterNode
	activeAddrs []string
	closed      bool
	onNewNode   []func(rdb *Client)

	_generation uint32 // atomic
}

func newClusterNodes(opt *ClusterOptions) *clusterNodes {
	return &clusterNodes{
		opt: opt,

		addrs: opt.Addrs,
		nodes: make(map[string]*clusterNode),
	}
}

func (c *clusterNodes) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}
	c.closed = true

	var firstErr error
	for _, node := range c.nodes {
		if err := node.Client.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}

	c.nodes = nil
	c.activeAddrs = nil

	return firstErr
}

func (c *clusterNodes) OnNewNode(fn func(rdb *Client)) {
	c.mu.Lock()
	c.onNewNode = append(c.onNewNode, fn)
	c.mu.Unlock()
}

func (c *clusterNodes) Addrs() ([]string, error) {
	var addrs []string

	c.mu.RLock()
	closed := c.closed //nolint:ifshort
	if !closed {
		if len(c.activeAddrs) > 0 {
			addrs = make([]string, len(c.activeAddrs))
			copy(addrs, c.activeAddrs)
		} else {
			addrs = make([]string, len(c.addrs))
			copy(addrs, c.addrs)
		}
	}
	c.mu.RUnlock()

	if closed {
		return nil, pool.ErrClosed
	}
	if len(addrs) == 0 {
		return nil, errClusterNoNodes
	}
	return addrs, nil
}

func (c *clusterNodes) NextGeneration() uint32 {
	return atomic.AddUint32(&c._generation, 1)
}

// GC removes unused nodes.
func (c *clusterNodes) GC(generation uint32) {
	//nolint:prealloc
	var collected []*clusterNode

	c.mu.Lock()

	c.activeAddrs = c.activeAddrs[:0]
	now := time.Now()
	for addr, node := range c.nodes {
		if node.Generation() >= generation {
			c.activeAddrs = append(c.activeAddrs, addr)
			if c.opt.RouteByLatency && node.LastLatencyMeasurement() < now.Add(-minLatencyMeasurementInterval).UnixNano() {
				go node.updateLatency()
			}
			continue
		}

		delete(c.nodes, addr)
		collected = append(collected, node)
	}

	c.mu.Unlock()

	for _, node := range collected {
		_ = node.Client.Close()
	}
}

func (c *clusterNodes) GetOrCreate(addr string) (*clusterNode, error) {
	node, err := c.get(addr)
	if err != nil {
		return nil, err
	}
	if node != nil {
		return node, nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil, pool.ErrClosed
	}

	node, ok := c.nodes[addr]
	if ok {
		return node, nil
	}

	node = newClusterNode(c.opt, addr)
	for _, fn := range c.onNewNode {
		fn(node.Client)
	}

	c.addrs = appendIfNotExists(c.addrs, addr)
	c.nodes[addr] = node

	return node, nil
}

func (c *clusterNodes) get(addr string) (*clusterNode, error) {
	var node *clusterNode
	var err error
	c.mu.RLock()
	if c.closed {
		err = pool.ErrClosed
	} else {
		node = c.nodes[addr]
	}
	c.mu.RUnlock()
	return node, err
}

func (c *clusterNodes) All() ([]*clusterNode, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.closed {
		return nil, pool.ErrClosed
	}

	cp := make([]*clusterNode, 0, len(c.nodes))
	for _, node := range c.nodes {
		cp = append(cp, node)
	}
	return cp, nil
}

func (c *clusterNodes) Random() (*clusterNode, error) {
	addrs, err := c.Addrs()
	if err != nil {
		return nil, err
	}

	n := rand.Intn(len(addrs))
	return c.GetOrCreate(addrs[n])
}

//------------------------------------------------------------------------------

type clusterSlot struct {
	start, end int
	nodes      []*clusterNode
}

type clusterSlotSlice []*clusterSlot

func (p clusterSlotSlice) Len() int {
	return len(p)
}

func (p clusterSlotSlice) Less(i, j int) bool {
	return p[i].start < p[j].start
}

func (p clusterSlotSlice) Swap(i, j int) {
	p[i], p[j] = p[j], p[i]
}

type clusterState struct {
	nodes   *clusterNodes
	Masters []*clusterNode
	Slaves  []*clusterNode

	slots []*clusterSlot

	generation uint32
	createdAt  time.Time
}

func newClusterState(
	nodes *clusterNodes, slots []ClusterSlot, origin string,
) (*clusterState, error) {
	c := clusterState{
		nodes: nodes,

		slots: make([]*clusterSlot, 0, len(slots)),

		generation: nodes.NextGeneration(),
		createdAt:  time.Now(),
	}

	originHost, _, _ := net.SplitHostPort(origin)
	isLoopbackOrigin := isLoopback(originHost)

	for _, slot := range slots {
		var nodes []*clusterNode
		for i, slotNode := range slot.Nodes {
			addr := slotNode.Addr
			if !isLoopbackOrigin {
				addr = replaceLoopbackHost(addr, originHost)
			}

			node, err := c.nodes.GetOrCreate(addr)
			if err != nil {
				return nil, err
			}

			node.SetGeneration(c.generation)
			nodes = append(nodes, node)

			if i == 0 {
				c.Masters = appendUniqueNode(c.Masters, node)
			} else {
				c.Slaves = appendUniqueNode(c.Slaves, node)
			}
		}

		c.slots = append(c.slots, &clusterSlot{
			start: slot.Start,
			end:   slot.End,
			nodes: nodes,
		})
	}

	sort.Sort(clusterSlotSlice(c.slots))

	time.AfterFunc(time.Minute, func() {
		nodes.GC(c.generation)
	})

	return &c, nil
}

func replaceLoopbackHost(nodeAddr, originHost string) string {
	nodeHost, nodePort, err := net.SplitHostPort(nodeAddr)
	if err != nil {
		return nodeAddr
	}

	nodeIP := net.ParseIP(nodeHost)
	if nodeIP == nil {
		return nodeAddr
	}

	if !nodeIP.IsLoopback() {
		return nodeAddr
	}

	// Use origin host which is not loopback and node port.
	return net.JoinHostPort(originHost, nodePort)
}

func isLoopback(host string) bool {
	ip := net.ParseIP(host)
	if ip == nil {
		return true
	}
	return ip.IsLoopback()
}

func (c *clusterState) slotMasterNode(slot int) (*clusterNode, error) {
	nodes := c.slotNodes(slot)
	if len(nodes) > 0 {
		return nodes[0], nil
	}
	return c.nodes.Random()
}

func (c *clusterState) slotSlaveNode(slot int) (*clusterNode, error) {
	nodes := c.slotNodes(slot)
	switch len(nodes) {
	case 0:
		return c.nodes.Random()
	case 1:
		return nodes[0], nil
	case 2:
		if slave := nodes[1]; !slave.Failing() {
			return slave, nil
		}
		return nodes[0], nil
	default:
		var slave *clusterNode
		for i := 0; i < 10; i++ {
			n := rand.Intn(len(nodes)-1) + 1
			slave = nodes[n]
			if !slave.Failing() {
				return slave, nil
			}
		}

		// All slaves are loading - use master.
		return nodes[0], nil
	}
}

func (c *clusterState) slotClosestNode(slot int) (*clusterNode, error) {
	nodes := c.slotNodes(slot)
	if len(nodes) == 0 {
		return c.nodes.Random()
	}

	var allNodesFailing = true
	var (
		closestNonFailingNode *clusterNode
		closestNode           *clusterNode
		minLatency            time.Duration
	)

	// setting the max possible duration as zerovalue for minlatency
	minLatency = time.Duration(math.MaxInt64)

	for _, n := range nodes {
		if closestNode == nil || n.Latency() < minLatency {
			closestNode = n
			minLatency = n.Latency()
			if !n.Failing() {
				closestNonFailingNode = n
				allNodesFailing = false
			}
		}
	}

	// pick the healthly node with the lowest latency
	if !allNodesFailing && closestNonFailingNode != nil {
		return closestNonFailingNode, nil
	}

	// if all nodes are failing, we will pick the temporarily failing node with lowest latency
	if minLatency < maximumNodeLatency && closestNode != nil {
		internal.Logger.Printf(context.TODO(), "redis: all nodes are marked as failed, picking the temporarily failing node with lowest latency")
		return closestNode, nil
	}

	// If all nodes are having the maximum latency(all pings are failing) - return a random node across the cluster
	internal.Logger.Printf(context.TODO(), "redis: pings to all nodes are failing, picking a random node across the cluster")
	return c.nodes.Random()
}

func (c *clusterState) slotRandomNode(slot int) (*clusterNode, error) {
	nodes := c.slotNodes(slot)
	if len(nodes) == 0 {
		return c.nodes.Random()
	}
	if len(nodes) == 1 {
		return nodes[0], nil
	}
	randomNodes := rand.Perm(len(nodes))
	for _, idx := range randomNodes {
		if node := nodes[idx]; !node.Failing() {
			return node, nil
		}
	}
	return nodes[randomNodes[0]], nil
}

func (c *clusterState) slotNodes(slot int) []*clusterNode {
	i := sort.Search(len(c.slots), func(i int) bool {
		return c.slots[i].end >= slot
	})
	if i >= len(c.slots) {
		return nil
	}
	x := c.slots[i]
	if slot >= x.start && slot <= x.end {
		return x.nodes
	}
	return nil
}

//------------------------------------------------------------------------------

type clusterStateHolder struct {
	load func(ctx context.Context) (*clusterState, error)

	state     atomic.Value
	reloading uint32 // atomic
}

func newClusterStateHolder(fn func(ctx context.Context) (*clusterState, error)) *clusterStateHolder {
	return &clusterStateHolder{
		load: fn,
	}
}

func (c *clusterStateHolder) Reload(ctx context.Context) (*clusterState, error) {
	state, err := c.load(ctx)
	if err != nil {
		return nil, err
	}
	c.state.Store(state)
	return state, nil
}

func (c *clusterStateHolder) LazyReload() {
	if !atomic.CompareAndSwapUint32(&c.reloading, 0, 1) {
		return
	}
	go func() {
		defer atomic.StoreUint32(&c.reloading, 0)

		_, err := c.Reload(context.Background())
		if err != nil {
			return
		}
		time.Sleep(200 * time.Millisecond)
	}()
}

func (c *clusterStateHolder) Get(ctx context.Context) (*clusterState, error) {
	v := c.state.Load()
	if v == nil {
		return c.Reload(ctx)
	}

	state := v.(*clusterState)
	if time.Since(state.createdAt) > 10*time.Second {
		c.LazyReload()
	}
	return state, nil
}

func (c *clusterStateHolder) ReloadOrGet(ctx context.Context) (*clusterState, error) {
	state, err := c.Reload(ctx)
	if err == nil {
		return state, nil
	}
	return c.Get(ctx)
}

//------------------------------------------------------------------------------

// ClusterClient is a Redis Cluster client representing a pool of zero
// or more underlying connections. It's safe for concurrent use by
// multiple goroutines.
type ClusterClient struct {
	opt           *ClusterOptions
	nodes         *clusterNodes
	state         *clusterStateHolder
	cmdsInfoCache *cmdsInfoCache
	cmdable
	hooksMixin
}

// NewClusterClient returns a Redis Cluster client as described in
// http://redis.io/topics/cluster-spec.
func NewClusterClient(opt *ClusterOptions) *ClusterClient {
	if opt == nil {
		panic("redis: NewClusterClient nil options")
	}
	opt.init()

	c := &ClusterClient{
		opt:   opt,
		nodes: newClusterNodes(opt),
	}

	c.state = newClusterStateHolder(c.loadState)
	c.cmdsInfoCache = newCmdsInfoCache(c.cmdsInfo)
	c.cmdable = c.Process

	c.initHooks(hooks{
		dial:       nil,
		process:    c.process,
		pipeline:   c.processPipeline,
		txPipeline: c.processTxPipeline,
	})

	return c
}

// Options returns read-only Options that were used to create the client.
func (c *ClusterClient) Options() *ClusterOptions {
	return c.opt
}

// ReloadState reloads cluster state. If available it calls ClusterSlots func
// to get cluster slots information.
func (c *ClusterClient) ReloadState(ctx context.Context) {
	c.state.LazyReload()
}

// Close closes the cluster client, releasing any open resources.
//
// It is rare to Close a ClusterClient, as the ClusterClient is meant
// to be long-lived and shared between many goroutines.
func (c *ClusterClient) Close() error {
	return c.nodes.Close()
}

// Do create a Cmd from the args and processes the cmd.
func (c *ClusterClient) Do(ctx context.Context, args ...interface{}) *Cmd {
	cmd := NewCmd(ctx, args...)
	_ = c.Process(ctx, cmd)
	return cmd
}

func (c *ClusterClient) Process(ctx context.Context, cmd Cmder) error {
	err := c.processHook(ctx, cmd)
	cmd.SetErr(err)
	return err
}

func (c *ClusterClient) process(ctx context.Context, cmd Cmder) error {
	slot := c.cmdSlot(ctx, cmd)
	var node *clusterNode
	var moved bool
	var ask bool
	var lastErr error
	for attempt := 0; attempt <= c.opt.MaxRedirects; attempt++ {
		// MOVED and ASK responses are not transient errors that require retry delay; they
		// should be attempted immediately.
		if attempt > 0 && !moved && !ask {
			if err := internal.Sleep(ctx, c.retryBackoff(attempt)); err != nil {
				return err
			}
		}

		if node == nil {
			var err error
			node, err = c.cmdNode(ctx, cmd.Name(), slot)
			if err != nil {
				return err
			}
		}

		if ask {
			ask = false

			pipe := node.Client.Pipeline()
			_ = pipe.Process(ctx, NewCmd(ctx, "asking"))
			_ = pipe.Process(ctx, cmd)
			_, lastErr = pipe.Exec(ctx)
		} else {
			lastErr = node.Client.Process(ctx, cmd)
		}

		// If there is no error - we are done.
		if lastErr == nil {
			return nil
		}
		if isReadOnly := isReadOnlyError(lastErr); isReadOnly || lastErr == pool.ErrClosed {
			if isReadOnly {
				c.state.LazyReload()
			}
			node = nil
			continue
		}

		// If slave is loading - pick another node.
		if c.opt.ReadOnly && isLoadingError(lastErr) {
			node.MarkAsFailing()
			node = nil
			continue
		}

		var addr string
		moved, ask, addr = isMovedError(lastErr)
		if moved || ask {
			c.state.LazyReload()

			var err error
			node, err = c.nodes.GetOrCreate(addr)
			if err != nil {
				return err
			}
			continue
		}

		if shouldRetry(lastErr, cmd.readTimeout() == nil) {
			// First retry the same node.
			if attempt == 0 {
				continue
			}

			// Second try another node.
			node.MarkAsFailing()
			node = nil
			continue
		}

		return lastErr
	}
	return lastErr
}

func (c *ClusterClient) OnNewNode(fn func(rdb *Client)) {
	c.nodes.OnNewNode(fn)
}

// ForEachMaster concurrently calls the fn on each master node in the cluster.
// It returns the first error if any.
func (c *ClusterClient) ForEachMaster(
	ctx context.Context,
	fn func(ctx context.Context, client *Client) error,
) error {
	state, err := c.state.ReloadOrGet(ctx)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 1)

	for _, master := range state.Masters {
		wg.Add(1)
		go func(node *clusterNode) {
			defer wg.Done()
			err := fn(ctx, node.Client)
			if err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}(master)
	}

	wg.Wait()

	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

// ForEachSlave concurrently calls the fn on each slave node in the cluster.
// It returns the first error if any.
func (c *ClusterClient) ForEachSlave(
	ctx context.Context,
	fn func(ctx context.Context, client *Client) error,
) error {
	state, err := c.state.ReloadOrGet(ctx)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 1)

	for _, slave := range state.Slaves {
		wg.Add(1)
		go func(node *clusterNode) {
			defer wg.Done()
			err := fn(ctx, node.Client)
			if err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}(slave)
	}

	wg.Wait()

	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

// ForEachShard concurrently calls the fn on each known node in the cluster.
// It returns the first error if any.
func (c *ClusterClient) ForEachShard(
	ctx context.Context,
	fn func(ctx context.Context, client *Client) error,
) error {
	state, err := c.state.ReloadOrGet(ctx)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 1)

	worker := func(node *clusterNode) {
		defer wg.Done()
		err := fn(ctx, node.Client)
		if err != nil {
			select {
			case errCh <- err:
			default:
			}
		}
	}

	for _, node := range state.Masters {
		wg.Add(1)
		go worker(node)
	}
	for _, node := range state.Slaves {
		wg.Add(1)
		go worker(node)
	}

	wg.Wait()

	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

// PoolStats returns accumulated connection pool stats.
func (c *ClusterClient) PoolStats() *PoolStats {
	var acc PoolStats

	state, _ := c.state.Get(context.TODO())
	if state == nil {
		return &acc
	}

	for _, node := range state.Masters {
		s := node.Client.connPool.Stats()
		acc.Hits += s.Hits
		acc.Misses += s.Misses
		acc.Timeouts += s.Timeouts

		acc.TotalConns += s.TotalConns
		acc.IdleConns += s.IdleConns
		acc.StaleConns += s.StaleConns
	}

	for _, node := range state.Slaves {
		s := node.Client.connPool.Stats()
		acc.Hits += s.Hits
		acc.Misses += s.Misses
		acc.Timeouts += s.Timeouts

		acc.TotalConns += s.TotalConns
		acc.IdleConns += s.IdleConns
		acc.StaleConns += s.StaleConns
	}

	return &acc
}

func (c *ClusterClient) loadState(ctx context.Context) (*clusterState, error) {
	if c.opt.ClusterSlots != nil {
		slots, err := c.opt.ClusterSlots(ctx)
		if err != nil {
			return nil, err
		}
		return newClusterState(c.nodes, slots, "")
	}

	addrs, err := c.nodes.Addrs()
	if err != nil {
		return nil, err
	}

	var firstErr error

	for _, idx := range rand.Perm(len(addrs)) {
		addr := addrs[idx]

		node, err := c.nodes.GetOrCreate(addr)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}

		slots, err := node.Client.ClusterSlots(ctx).Result()
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}

		return newClusterState(c.nodes, slots, node.Client.opt.Addr)
	}

	/*
	 * No node is connectable. It's possible that all nodes' IP has changed.
	 * Clear activeAddrs to let client be able to re-connect using the initial
	 * setting of the addresses (e.g. [redis-cluster-0:6379, redis-cluster-1:6379]),
	 * which might have chance to resolve domain name and get updated IP address.
	 */
	c.nodes.mu.Lock()
	c.nodes.activeAddrs = nil
	c.nodes.mu.Unlock()

	return nil, firstErr
}

func (c *ClusterClient) Pipeline() Pipeliner {
	pipe := Pipeline{
		exec: pipelineExecer(c.processPipelineHook),
	}
	pipe.init()
	return &pipe
}

func (c *ClusterClient) Pipelined(ctx context.Context, fn func(Pipeliner) error) ([]Cmder, error) {
	return c.Pipeline().Pipelined(ctx, fn)
}

func (c *ClusterClient) processPipeline(ctx context.Context, cmds []Cmder) error {
	cmdsMap := newCmdsMap()

	if err := c.mapCmdsByNode(ctx, cmdsMap, cmds); err != nil {
		setCmdsErr(cmds, err)
		return err
	}

	for attempt := 0; attempt <= c.opt.MaxRedirects; attempt++ {
		if attempt > 0 {
			if err := internal.Sleep(ctx, c.retryBackoff(attempt)); err != nil {
				setCmdsErr(cmds, err)
				return err
			}
		}

		failedCmds := newCmdsMap()
		var wg sync.WaitGroup

		for node, cmds := range cmdsMap.m {
			wg.Add(1)
			go func(node *clusterNode, cmds []Cmder) {
				defer wg.Done()
				c.processPipelineNode(ctx, node, cmds, failedCmds)
			}(node, cmds)
		}

		wg.Wait()
		if len(failedCmds.m) == 0 {
			break
		}
		cmdsMap = failedCmds
	}

	return cmdsFirstErr(cmds)
}

func (c *ClusterClient) mapCmdsByNode(ctx context.Context, cmdsMap *cmdsMap, cmds []Cmder) error {
	state, err := c.state.Get(ctx)
	if err != nil {
		return err
	}

	if c.opt.ReadOnly && c.cmdsAreReadOnly(ctx, cmds) {
		for _, cmd := range cmds {
			slot := c.cmdSlot(ctx, cmd)
			node, err := c.slotReadOnlyNode(state, slot)
			if err != nil {
				return err
			}
			cmdsMap.Add(node, cmd)
		}
		return nil
	}

	for _, cmd := range cmds {
		slot := c.cmdSlot(ctx, cmd)
		node, err := state.slotMasterNode(slot)
		if err != nil {
			return err
		}
		cmdsMap.Add(node, cmd)
	}
	return nil
}

func (c *ClusterClient) cmdsAreReadOnly(ctx context.Context, cmds []Cmder) bool {
	for _, cmd := range cmds {
		cmdInfo := c.cmdInfo(ctx, cmd.Name())
		if cmdInfo == nil || !cmdInfo.ReadOnly {
			return false
		}
	}
	return true
}

func (c *ClusterClient) processPipelineNode(
	ctx context.Context, node *clusterNode, cmds []Cmder, failedCmds *cmdsMap,
) {
	_ = node.Client.withProcessPipelineHook(ctx, cmds, func(ctx context.Context, cmds []Cmder) error {
		cn, err := node.Client.getConn(ctx)
		if err != nil {
			if !isContextError(err) {
				node.MarkAsFailing()
			}
			_ = c.mapCmdsByNode(ctx, failedCmds, cmds)
			setCmdsErr(cmds, err)
			return err
		}

		var processErr error
		defer func() {
			node.Client.releaseConn(ctx, cn, processErr)
		}()
		processErr = c.processPipelineNodeConn(ctx, node, cn, cmds, failedCmds)

		return processErr
	})
}

func (c *ClusterClient) processPipelineNodeConn(
	ctx context.Context, node *clusterNode, cn *pool.Conn, cmds []Cmder, failedCmds *cmdsMap,
) error {
	if err := cn.WithWriter(c.context(ctx), c.opt.WriteTimeout, func(wr *proto.Writer) error {
		return writeCmds(wr, cmds)
	}); err != nil {
		if isBadConn(err, false, node.Client.getAddr()) {
			node.MarkAsFailing()
		}
		if shouldRetry(err, true) {
			_ = c.mapCmdsByNode(ctx, failedCmds, cmds)
		}
		setCmdsErr(cmds, err)
		return err
	}

	return cn.WithReader(c.context(ctx), c.opt.ReadTimeout, func(rd *proto.Reader) error {
		return c.pipelineReadCmds(ctx, node, rd, cmds, failedCmds)
	})
}

func (c *ClusterClient) pipelineReadCmds(
	ctx context.Context,
	node *clusterNode,
	rd *proto.Reader,
	cmds []Cmder,
	failedCmds *cmdsMap,
) error {
	for i, cmd := range cmds {
		err := cmd.readReply(rd)
		cmd.SetErr(err)

		if err == nil {
			continue
		}

		if c.checkMovedErr(ctx, cmd, err, failedCmds) {
			continue
		}

		if c.opt.ReadOnly && isBadConn(err, false, node.Client.getAddr()) {
			node.MarkAsFailing()
		}

		if !isRedisError(err) {
			if shouldRetry(err, true) {
				_ = c.mapCmdsByNode(ctx, failedCmds, cmds)
			}
			setCmdsErr(cmds[i+1:], err)
			return err
		}
	}

	if err := cmds[0].Err(); err != nil && shouldRetry(err, true) {
		_ = c.mapCmdsByNode(ctx, failedCmds, cmds)
		return err
	}

	return nil
}

func (c *ClusterClient) checkMovedErr(
	ctx context.Context, cmd Cmder, err error, failedCmds *cmdsMap,
) bool {
	moved, ask, addr := isMovedError(err)
	if !moved && !ask {
		return false
	}

	node, err := c.nodes.GetOrCreate(addr)
	if err != nil {
		return false
	}

	if moved {
		c.state.LazyReload()
		failedCmds.Add(node, cmd)
		return true
	}

	if ask {
		failedCmds.Add(node, NewCmd(ctx, "asking"), cmd)
		return true
	}

	panic("not reached")
}

// TxPipeline acts like Pipeline, but wraps queued commands with MULTI/EXEC.
func (c *ClusterClient) TxPipeline() Pipeliner {
	pipe := Pipeline{
		exec: func(ctx context.Context, cmds []Cmder) error {
			cmds = wrapMultiExec(ctx, cmds)
			return c.processTxPipelineHook(ctx, cmds)
		},
	}
	pipe.init()
	return &pipe
}

func (c *ClusterClient) TxPipelined(ctx context.Context, fn func(Pipeliner) error) ([]Cmder, error) {
	return c.TxPipeline().Pipelined(ctx, fn)
}

func (c *ClusterClient) processTxPipeline(ctx context.Context, cmds []Cmder) error {
	// Trim multi .. exec.
	cmds = cmds[1 : len(cmds)-1]

	state, err := c.state.Get(ctx)
	if err != nil {
		setCmdsErr(cmds, err)
		return err
	}

	cmdsMap := c.mapCmdsBySlot(ctx, cmds)
	for slot, cmds := range cmdsMap {
		node, err := state.slotMasterNode(slot)
		if err != nil {
			setCmdsErr(cmds, err)
			continue
		}

		cmdsMap := map[*clusterNode][]Cmder{node: cmds}
		for attempt := 0; attempt <= c.opt.MaxRedirects; attempt++ {
			if attempt > 0 {
				if err := internal.Sleep(ctx, c.retryBackoff(attempt)); err != nil {
					setCmdsErr(cmds, err)
					return err
				}
			}

			failedCmds := newCmdsMap()
			var wg sync.WaitGroup

			for node, cmds := range cmdsMap {
				wg.Add(1)
				go func(node *clusterNode, cmds []Cmder) {
					defer wg.Done()
					c.processTxPipelineNode(ctx, node, cmds, failedCmds)
				}(node, cmds)
			}

			wg.Wait()
			if len(failedCmds.m) == 0 {
				break
			}
			cmdsMap = failedCmds.m
		}
	}

	return cmdsFirstErr(cmds)
}

func (c *ClusterClient) mapCmdsBySlot(ctx context.Context, cmds []Cmder) map[int][]Cmder {
	cmdsMap := make(map[int][]Cmder)
	for _, cmd := range cmds {
		slot := c.cmdSlot(ctx, cmd)
		cmdsMap[slot] = append(cmdsMap[slot], cmd)
	}
	return cmdsMap
}

func (c *ClusterClient) processTxPipelineNode(
	ctx context.Context, node *clusterNode, cmds []Cmder, failedCmds *cmdsMap,
) {
	cmds = wrapMultiExec(ctx, cmds)
	_ = node.Client.withProcessPipelineHook(ctx, cmds, func(ctx context.Context, cmds []Cmder) error {
		cn, err := node.Client.getConn(ctx)
		if err != nil {
			_ = c.mapCmdsByNode(ctx, failedCmds, cmds)
			setCmdsErr(cmds, err)
			return err
		}

		var processErr error
		defer func() {
			node.Client.releaseConn(ctx, cn, processErr)
		}()
		processErr = c.processTxPipelineNodeConn(ctx, node, cn, cmds, failedCmds)

		return processErr
	})
}

func (c *ClusterClient) processTxPipelineNodeConn(
	ctx context.Context, node *clusterNode, cn *pool.Conn, cmds []Cmder, failedCmds *cmdsMap,
) error {
	if err := cn.WithWriter(c.context(ctx), c.opt.WriteTimeout, func(wr *proto.Writer) error {
		return writeCmds(wr, cmds)
	}); err != nil {
		if shouldRetry(err, true) {
			_ = c.mapCmdsByNode(ctx, failedCmds, cmds)
		}
		setCmdsErr(cmds, err)
		return err
	}

	return cn.WithReader(c.context(ctx), c.opt.ReadTimeout, func(rd *proto.Reader) error {
		statusCmd := cmds[0].(*StatusCmd)
		// Trim multi and exec.
		trimmedCmds := cmds[1 : len(cmds)-1]

		if err := c.txPipelineReadQueued(
			ctx, rd, statusCmd, trimmedCmds, failedCmds,
		); err != nil {
			setCmdsErr(cmds, err)

			moved, ask, addr := isMovedError(err)
			if moved || ask {
				return c.cmdsMoved(ctx, trimmedCmds, moved, ask, addr, failedCmds)
			}

			return err
		}

		return pipelineReadCmds(rd, trimmedCmds)
	})
}

func (c *ClusterClient) txPipelineReadQueued(
	ctx context.Context,
	rd *proto.Reader,
	statusCmd *StatusCmd,
	cmds []Cmder,
	failedCmds *cmdsMap,
) error {
	// Parse queued replies.
	if err := statusCmd.readReply(rd); err != nil {
		return err
	}

	for _, cmd := range cmds {
		err := statusCmd.readReply(rd)
		if err == nil || c.checkMovedErr(ctx, cmd, err, failedCmds) || isRedisError(err) {
			continue
		}
		return err
	}

	// Parse number of replies.
	line, err := rd.ReadLine()
	if err != nil {
		if err == Nil {
			err = TxFailedErr
		}
		return err
	}

	if line[0] != proto.RespArray {
		return fmt.Errorf("redis: expected '*', but got line %q", line)
	}

	return nil
}

func (c *ClusterClient) cmdsMoved(
	ctx context.Context, cmds []Cmder,
	moved, ask bool,
	addr string,
	failedCmds *cmdsMap,
) error {
	node, err := c.nodes.GetOrCreate(addr)
	if err != nil {
		return err
	}

	if moved {
		c.state.LazyReload()
		for _, cmd := range cmds {
			failedCmds.Add(node, cmd)
		}
		return nil
	}

	if ask {
		for _, cmd := range cmds {
			failedCmds.Add(node, NewCmd(ctx, "asking"), cmd)
		}
		return nil
	}

	return nil
}

func (c *ClusterClient) Watch(ctx context.Context, fn func(*Tx) error, keys ...string) error {
	if len(keys) == 0 {
		return fmt.Errorf("redis: Watch requires at least one key")
	}

	slot := hashtag.Slot(keys[0])
	for _, key := range keys[1:] {
		if hashtag.Slot(key) != slot {
			err := fmt.Errorf("redis: Watch requires all keys to be in the same slot")
			return err
		}
	}

	node, err := c.slotMasterNode(ctx, slot)
	if err != nil {
		return err
	}

	for attempt := 0; attempt <= c.opt.MaxRedirects; attempt++ {
		if attempt > 0 {
			if err := internal.Sleep(ctx, c.retryBackoff(attempt)); err != nil {
				return err
			}
		}

		err = node.Client.Watch(ctx, fn, keys...)
		if err == nil {
			break
		}

		moved, ask, addr := isMovedError(err)
		if moved || ask {
			node, err = c.nodes.GetOrCreate(addr)
			if err != nil {
				return err
			}
			continue
		}

		if isReadOnly := isReadOnlyError(err); isReadOnly || err == pool.ErrClosed {
			if isReadOnly {
				c.state.LazyReload()
			}
			node, err = c.slotMasterNode(ctx, slot)
			if err != nil {
				return err
			}
			continue
		}

		if shouldRetry(err, true) {
			continue
		}

		return err
	}

	return err
}

func (c *ClusterClient) pubSub() *PubSub {
	var node *clusterNode
	pubsub := &PubSub{
		opt: c.opt.clientOptions(),

		newConn: func(ctx context.Context, channels []string) (*pool.Conn, error) {
			if node != nil {
				panic("node != nil")
			}

			var err error
			if len(channels) > 0 {
				slot := hashtag.Slot(channels[0])
				node, err = c.slotMasterNode(ctx, slot)
			} else {
				node, err = c.nodes.Random()
			}
			if err != nil {
				return nil, err
			}

			cn, err := node.Client.newConn(context.TODO())
			if err != nil {
				node = nil

				return nil, err
			}

			return cn, nil
		},
		closeConn: func(cn *pool.Conn) error {
			err := node.Client.connPool.CloseConn(cn)
			node = nil
			return err
		},
	}
	pubsub.init()

	return pubsub
}

// Subscribe subscribes the client to the specified channels.
// Channels can be omitted to create empty subscription.
func (c *ClusterClient) Subscribe(ctx context.Context, channels ...string) *PubSub {
	pubsub := c.pubSub()
	if len(channels) > 0 {
		_ = pubsub.Subscribe(ctx, channels...)
	}
	return pubsub
}

// PSubscribe subscribes the client to the given patterns.
// Patterns can be omitted to create empty subscription.
func (c *ClusterClient) PSubscribe(ctx context.Context, channels ...string) *PubSub {
	pubsub := c.pubSub()
	if len(channels) > 0 {
		_ = pubsub.PSubscribe(ctx, channels...)
	}
	return pubsub
}

// SSubscribe Subscribes the client to the specified shard channels.
func (c *ClusterClient) SSubscribe(ctx context.Context, channels ...string) *PubSub {
	pubsub := c.pubSub()
	if len(channels) > 0 {
		_ = pubsub.SSubscribe(ctx, channels...)
	}
	return pubsub
}

func (c *ClusterClient) retryBackoff(attempt int) time.Duration {
	return internal.RetryBackoff(attempt, c.opt.MinRetryBackoff, c.opt.MaxRetryBackoff)
}

func (c *ClusterClient) cmdsInfo(ctx context.Context) (map[string]*CommandInfo, error) {
	// Try 3 random nodes.
	const nodeLimit = 3

	addrs, err := c.nodes.Addrs()
	if err != nil {
		return nil, err
	}

	var firstErr error

	perm := rand.Perm(len(addrs))
	if len(perm) > nodeLimit {
		perm = perm[:nodeLimit]
	}

	for _, idx := range perm {
		addr := addrs[idx]

		node, err := c.nodes.GetOrCreate(addr)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}

		info, err := node.Client.Command(ctx).Result()
		if err == nil {
			return info, nil
		}
		if firstErr == nil {
			firstErr = err
		}
	}

	if firstErr == nil {
		panic("not reached")
	}
	return nil, firstErr
}

func (c *ClusterClient) cmdInfo(ctx context.Context, name string) *CommandInfo {
	cmdsInfo, err := c.cmdsInfoCache.Get(ctx)
	if err != nil {
		internal.Logger.Printf(context.TODO(), "getting command info: %s", err)
		return nil
	}

	info := cmdsInfo[name]
	if info == nil {
		internal.Logger.Printf(context.TODO(), "info for cmd=%s not found", name)
	}
	return info
}

func (c *ClusterClient) cmdSlot(ctx context.Context, cmd Cmder) int {
	args := cmd.Args()
	if args[0] == "cluster" && (args[1] == "getkeysinslot" || args[1] == "countkeysinslot") {
		return args[2].(int)
	}

	return cmdSlot(cmd, cmdFirstKeyPos(cmd))
}

func cmdSlot(cmd Cmder, pos int) int {
	if pos == 0 {
		return hashtag.RandomSlot()
	}
	firstKey := cmd.stringArg(pos)
	return hashtag.Slot(firstKey)
}

func (c *ClusterClient) cmdNode(
	ctx context.Context,
	cmdName string,
	slot int,
) (*clusterNode, error) {
	state, err := c.state.Get(ctx)
	if err != nil {
		return nil, err
	}

	if c.opt.ReadOnly {
		cmdInfo := c.cmdInfo(ctx, cmdName)
		if cmdInfo != nil && cmdInfo.ReadOnly {
			return c.slotReadOnlyNode(state, slot)
		}
	}
	return state.slotMasterNode(slot)
}

func (c *ClusterClient) slotReadOnlyNode(state *clusterState, slot int) (*clusterNode, error) {
	if c.opt.RouteByLatency {
		return state.slotClosestNode(slot)
	}
	if c.opt.RouteRandomly {
		return state.slotRandomNode(slot)
	}
	return state.slotSlaveNode(slot)
}

func (c *ClusterClient) slotMasterNode(ctx context.Context, slot int) (*clusterNode, error) {
	state, err := c.state.Get(ctx)
	if err != nil {
		return nil, err
	}
	return state.slotMasterNode(slot)
}

// SlaveForKey gets a client for a replica node to run any command on it.
// This is especially useful if we want to run a particular lua script which has
// only read only commands on the replica.
// This is because other redis commands generally have a flag that points that
// they are read only and automatically run on the replica nodes
// if ClusterOptions.ReadOnly flag is set to true.
func (c *ClusterClient) SlaveForKey(ctx context.Context, key string) (*Client, error) {
	state, err := c.state.Get(ctx)
	if err != nil {
		return nil, err
	}
	slot := hashtag.Slot(key)
	node, err := c.slotReadOnlyNode(state, slot)
	if err != nil {
		return nil, err
	}
	return node.Client, err
}

// MasterForKey return a client to the master node for a particular key.
func (c *ClusterClient) MasterForKey(ctx context.Context, key string) (*Client, error) {
	slot := hashtag.Slot(key)
	node, err := c.slotMasterNode(ctx, slot)
	if err != nil {
		return nil, err
	}
	return node.Client, err
}

func (c *ClusterClient) context(ctx context.Context) context.Context {
	if c.opt.ContextTimeoutEnabled {
		return ctx
	}
	return context.Background()
}

func appendUniqueNode(nodes []*clusterNode, node *clusterNode) []*clusterNode {
	for _, n := range nodes {
		if n == node {
			return nodes
		}
	}
	return append(nodes, node)
}

func appendIfNotExists(ss []string, es ...string) []string {
loop:
	for _, e := range es {
		for _, s := range ss {
			if s == e {
				continue loop
			}
		}
		ss = append(ss, e)
	}
	return ss
}

//------------------------------------------------------------------------------

type cmdsMap struct {
	mu sync.Mutex
	m  map[*clusterNode][]Cmder
}

func newCmdsMap() *cmdsMap {
	return &cmdsMap{
		m: make(map[*clusterNode][]Cmder),
	}
}

func (m *cmdsMap) Add(node *clusterNode, cmds ...Cmder) {
	m.mu.Lock()
	m.m[node] = append(m.m[node], cmds...)
	m.mu.Unlock()
}
