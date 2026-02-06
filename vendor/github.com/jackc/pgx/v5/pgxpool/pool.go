package pgxpool

import (
	"context"
	"errors"
	"math/rand"
	"runtime"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/puddle/v2"
)

var (
	defaultMaxConns          = int32(4)
	defaultMinConns          = int32(0)
	defaultMinIdleConns      = int32(0)
	defaultMaxConnLifetime   = time.Hour
	defaultMaxConnIdleTime   = time.Minute * 30
	defaultHealthCheckPeriod = time.Minute
)

type connResource struct {
	conn       *pgx.Conn
	conns      []Conn
	poolRows   []poolRow
	poolRowss  []poolRows
	maxAgeTime time.Time
}

func (cr *connResource) getConn(p *Pool, res *puddle.Resource[*connResource]) *Conn {
	if len(cr.conns) == 0 {
		cr.conns = make([]Conn, 128)
	}

	c := &cr.conns[len(cr.conns)-1]
	cr.conns = cr.conns[0 : len(cr.conns)-1]

	c.res = res
	c.p = p

	return c
}

func (cr *connResource) getPoolRow(c *Conn, r pgx.Row) *poolRow {
	if len(cr.poolRows) == 0 {
		cr.poolRows = make([]poolRow, 128)
	}

	pr := &cr.poolRows[len(cr.poolRows)-1]
	cr.poolRows = cr.poolRows[0 : len(cr.poolRows)-1]

	pr.c = c
	pr.r = r

	return pr
}

func (cr *connResource) getPoolRows(c *Conn, r pgx.Rows) *poolRows {
	if len(cr.poolRowss) == 0 {
		cr.poolRowss = make([]poolRows, 128)
	}

	pr := &cr.poolRowss[len(cr.poolRowss)-1]
	cr.poolRowss = cr.poolRowss[0 : len(cr.poolRowss)-1]

	pr.c = c
	pr.r = r

	return pr
}

// Pool allows for connection reuse.
type Pool struct {
	// 64 bit fields accessed with atomics must be at beginning of struct to guarantee alignment for certain 32-bit
	// architectures. See BUGS section of https://pkg.go.dev/sync/atomic and https://github.com/jackc/pgx/issues/1288.
	newConnsCount        int64
	lifetimeDestroyCount int64
	idleDestroyCount     int64

	p                     *puddle.Pool[*connResource]
	config                *Config
	beforeConnect         func(context.Context, *pgx.ConnConfig) error
	afterConnect          func(context.Context, *pgx.Conn) error
	prepareConn           func(context.Context, *pgx.Conn) (bool, error)
	afterRelease          func(*pgx.Conn) bool
	beforeClose           func(*pgx.Conn)
	shouldPing            func(context.Context, ShouldPingParams) bool
	minConns              int32
	minIdleConns          int32
	maxConns              int32
	maxConnLifetime       time.Duration
	maxConnLifetimeJitter time.Duration
	maxConnIdleTime       time.Duration
	healthCheckPeriod     time.Duration

	healthCheckChan chan struct{}

	acquireTracer AcquireTracer
	releaseTracer ReleaseTracer

	closeOnce sync.Once
	closeChan chan struct{}
}

// ShouldPingParams are the parameters passed to ShouldPing.
type ShouldPingParams struct {
	Conn         *pgx.Conn
	IdleDuration time.Duration
}

// Config is the configuration struct for creating a pool. It must be created by [ParseConfig] and then it can be
// modified.
type Config struct {
	ConnConfig *pgx.ConnConfig

	// BeforeConnect is called before a new connection is made. It is passed a copy of the underlying pgx.ConnConfig and
	// will not impact any existing open connections.
	BeforeConnect func(context.Context, *pgx.ConnConfig) error

	// AfterConnect is called after a connection is established, but before it is added to the pool.
	AfterConnect func(context.Context, *pgx.Conn) error

	// BeforeAcquire is called before a connection is acquired from the pool. It must return true to allow the
	// acquisition or false to indicate that the connection should be destroyed and a different connection should be
	// acquired.
	//
	// Deprecated: Use PrepareConn instead. If both PrepareConn and BeforeAcquire are set, PrepareConn will take
	// precedence, ignoring BeforeAcquire.
	BeforeAcquire func(context.Context, *pgx.Conn) bool

	// PrepareConn is called before a connection is acquired from the pool. If this function returns true, the connection
	// is considered valid, otherwise the connection is destroyed. If the function returns a non-nil error, the instigating
	// query will fail with the returned error.
	//
	// Specifically, this means that:
	//
	// 	- If it returns true and a nil error, the query proceeds as normal.
	// 	- If it returns true and an error, the connection will be returned to the pool, and the instigating query will fail with the returned error.
	// 	- If it returns false, and an error, the connection will be destroyed, and the query will fail with the returned error.
	// 	- If it returns false and a nil error, the connection will be destroyed, and the instigating query will be retried on a new connection.
	PrepareConn func(context.Context, *pgx.Conn) (bool, error)

	// AfterRelease is called after a connection is released, but before it is returned to the pool. It must return true to
	// return the connection to the pool or false to destroy the connection.
	AfterRelease func(*pgx.Conn) bool

	// BeforeClose is called right before a connection is closed and removed from the pool.
	BeforeClose func(*pgx.Conn)

	// ShouldPing is called after a connection is acquired from the pool. If it returns true, the connection is pinged to check for liveness.
	// If this func is not set, the default behavior is to ping connections that have been idle for at least 1 second.
	ShouldPing func(context.Context, ShouldPingParams) bool

	// MaxConnLifetime is the duration since creation after which a connection will be automatically closed.
	MaxConnLifetime time.Duration

	// MaxConnLifetimeJitter is the duration after MaxConnLifetime to randomly decide to close a connection.
	// This helps prevent all connections from being closed at the exact same time, starving the pool.
	MaxConnLifetimeJitter time.Duration

	// MaxConnIdleTime is the duration after which an idle connection will be automatically closed by the health check.
	MaxConnIdleTime time.Duration

	// MaxConns is the maximum size of the pool. The default is the greater of 4 or runtime.NumCPU().
	MaxConns int32

	// MinConns is the minimum size of the pool. After connection closes, the pool might dip below MinConns. A low
	// number of MinConns might mean the pool is empty after MaxConnLifetime until the health check has a chance
	// to create new connections.
	MinConns int32

	// MinIdleConns is the minimum number of idle connections in the pool. You can increase this to ensure that
	// there are always idle connections available. This can help reduce tail latencies during request processing,
	// as you can avoid the latency of establishing a new connection while handling requests. It is superior
	// to MinConns for this purpose.
	// Similar to MinConns, the pool might temporarily dip below MinIdleConns after connection closes.
	MinIdleConns int32

	// HealthCheckPeriod is the duration between checks of the health of idle connections.
	HealthCheckPeriod time.Duration

	createdByParseConfig bool // Used to enforce created by ParseConfig rule.
}

// Copy returns a deep copy of the config that is safe to use and modify.
// The only exception is the tls.Config:
// according to the tls.Config docs it must not be modified after creation.
func (c *Config) Copy() *Config {
	newConfig := new(Config)
	*newConfig = *c
	newConfig.ConnConfig = c.ConnConfig.Copy()
	return newConfig
}

// ConnString returns the connection string as parsed by pgxpool.ParseConfig into pgxpool.Config.
func (c *Config) ConnString() string { return c.ConnConfig.ConnString() }

// New creates a new Pool. See [ParseConfig] for information on connString format.
func New(ctx context.Context, connString string) (*Pool, error) {
	config, err := ParseConfig(connString)
	if err != nil {
		return nil, err
	}

	return NewWithConfig(ctx, config)
}

// NewWithConfig creates a new Pool. config must have been created by [ParseConfig].
func NewWithConfig(ctx context.Context, config *Config) (*Pool, error) {
	// Default values are set in ParseConfig. Enforce initial creation by ParseConfig rather than setting defaults from
	// zero values.
	if !config.createdByParseConfig {
		panic("config must be created by ParseConfig")
	}

	prepareConn := config.PrepareConn
	if prepareConn == nil && config.BeforeAcquire != nil {
		prepareConn = func(ctx context.Context, conn *pgx.Conn) (bool, error) {
			return config.BeforeAcquire(ctx, conn), nil
		}
	}

	p := &Pool{
		config:                config,
		beforeConnect:         config.BeforeConnect,
		afterConnect:          config.AfterConnect,
		prepareConn:           prepareConn,
		afterRelease:          config.AfterRelease,
		beforeClose:           config.BeforeClose,
		minConns:              config.MinConns,
		minIdleConns:          config.MinIdleConns,
		maxConns:              config.MaxConns,
		maxConnLifetime:       config.MaxConnLifetime,
		maxConnLifetimeJitter: config.MaxConnLifetimeJitter,
		maxConnIdleTime:       config.MaxConnIdleTime,
		healthCheckPeriod:     config.HealthCheckPeriod,
		healthCheckChan:       make(chan struct{}, 1),
		closeChan:             make(chan struct{}),
	}

	if t, ok := config.ConnConfig.Tracer.(AcquireTracer); ok {
		p.acquireTracer = t
	}

	if t, ok := config.ConnConfig.Tracer.(ReleaseTracer); ok {
		p.releaseTracer = t
	}

	if config.ShouldPing != nil {
		p.shouldPing = config.ShouldPing
	} else {
		p.shouldPing = func(ctx context.Context, params ShouldPingParams) bool {
			return params.IdleDuration > time.Second
		}
	}

	var err error
	p.p, err = puddle.NewPool(
		&puddle.Config[*connResource]{
			Constructor: func(ctx context.Context) (*connResource, error) {
				atomic.AddInt64(&p.newConnsCount, 1)
				connConfig := p.config.ConnConfig.Copy()

				// Connection will continue in background even if Acquire is canceled. Ensure that a connect won't hang forever.
				if connConfig.ConnectTimeout <= 0 {
					connConfig.ConnectTimeout = 2 * time.Minute
				}

				if p.beforeConnect != nil {
					if err := p.beforeConnect(ctx, connConfig); err != nil {
						return nil, err
					}
				}

				conn, err := pgx.ConnectConfig(ctx, connConfig)
				if err != nil {
					return nil, err
				}

				if p.afterConnect != nil {
					err = p.afterConnect(ctx, conn)
					if err != nil {
						conn.Close(ctx)
						return nil, err
					}
				}

				jitterSecs := rand.Float64() * config.MaxConnLifetimeJitter.Seconds()
				maxAgeTime := time.Now().Add(config.MaxConnLifetime).Add(time.Duration(jitterSecs) * time.Second)

				cr := &connResource{
					conn:       conn,
					conns:      make([]Conn, 64),
					poolRows:   make([]poolRow, 64),
					poolRowss:  make([]poolRows, 64),
					maxAgeTime: maxAgeTime,
				}

				return cr, nil
			},
			Destructor: func(value *connResource) {
				ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
				conn := value.conn
				if p.beforeClose != nil {
					p.beforeClose(conn)
				}
				conn.Close(ctx)
				select {
				case <-conn.PgConn().CleanupDone():
				case <-ctx.Done():
				}
				cancel()
			},
			MaxSize: config.MaxConns,
		},
	)
	if err != nil {
		return nil, err
	}

	go func() {
		targetIdleResources := max(int(p.minConns), int(p.minIdleConns))
		p.createIdleResources(ctx, targetIdleResources)
		p.backgroundHealthCheck()
	}()

	return p, nil
}

// ParseConfig builds a Config from connString. It parses connString with the same behavior as [pgx.ParseConfig] with the
// addition of the following variables:
//
//   - pool_max_conns: integer greater than 0 (default 4)
//   - pool_min_conns: integer 0 or greater (default 0)
//   - pool_max_conn_lifetime: duration string (default 1 hour)
//   - pool_max_conn_idle_time: duration string (default 30 minutes)
//   - pool_health_check_period: duration string (default 1 minute)
//   - pool_max_conn_lifetime_jitter: duration string (default 0)
//
// See Config for definitions of these arguments.
//
//	# Example Keyword/Value
//	user=jack password=secret host=pg.example.com port=5432 dbname=mydb sslmode=verify-ca pool_max_conns=10 pool_max_conn_lifetime=1h30m
//
//	# Example URL
//	postgres://jack:secret@pg.example.com:5432/mydb?sslmode=verify-ca&pool_max_conns=10&pool_max_conn_lifetime=1h30m
func ParseConfig(connString string) (*Config, error) {
	connConfig, err := pgx.ParseConfig(connString)
	if err != nil {
		return nil, err
	}

	config := &Config{
		ConnConfig:           connConfig,
		createdByParseConfig: true,
	}

	if s, ok := config.ConnConfig.Config.RuntimeParams["pool_max_conns"]; ok {
		delete(connConfig.Config.RuntimeParams, "pool_max_conns")
		n, err := strconv.ParseInt(s, 10, 32)
		if err != nil {
			return nil, pgconn.NewParseConfigError(connString, "cannot parse pool_max_conns", err)
		}
		if n < 1 {
			return nil, pgconn.NewParseConfigError(connString, "pool_max_conns too small", err)
		}
		config.MaxConns = int32(n)
	} else {
		config.MaxConns = defaultMaxConns
		if numCPU := int32(runtime.NumCPU()); numCPU > config.MaxConns {
			config.MaxConns = numCPU
		}
	}

	if s, ok := config.ConnConfig.Config.RuntimeParams["pool_min_conns"]; ok {
		delete(connConfig.Config.RuntimeParams, "pool_min_conns")
		n, err := strconv.ParseInt(s, 10, 32)
		if err != nil {
			return nil, pgconn.NewParseConfigError(connString, "cannot parse pool_min_conns", err)
		}
		config.MinConns = int32(n)
	} else {
		config.MinConns = defaultMinConns
	}

	if s, ok := config.ConnConfig.Config.RuntimeParams["pool_min_idle_conns"]; ok {
		delete(connConfig.Config.RuntimeParams, "pool_min_idle_conns")
		n, err := strconv.ParseInt(s, 10, 32)
		if err != nil {
			return nil, pgconn.NewParseConfigError(connString, "cannot parse pool_min_idle_conns", err)
		}
		config.MinIdleConns = int32(n)
	} else {
		config.MinIdleConns = defaultMinIdleConns
	}

	if s, ok := config.ConnConfig.Config.RuntimeParams["pool_max_conn_lifetime"]; ok {
		delete(connConfig.Config.RuntimeParams, "pool_max_conn_lifetime")
		d, err := time.ParseDuration(s)
		if err != nil {
			return nil, pgconn.NewParseConfigError(connString, "cannot parse pool_max_conn_lifetime", err)
		}
		config.MaxConnLifetime = d
	} else {
		config.MaxConnLifetime = defaultMaxConnLifetime
	}

	if s, ok := config.ConnConfig.Config.RuntimeParams["pool_max_conn_idle_time"]; ok {
		delete(connConfig.Config.RuntimeParams, "pool_max_conn_idle_time")
		d, err := time.ParseDuration(s)
		if err != nil {
			return nil, pgconn.NewParseConfigError(connString, "cannot parse pool_max_conn_idle_time", err)
		}
		config.MaxConnIdleTime = d
	} else {
		config.MaxConnIdleTime = defaultMaxConnIdleTime
	}

	if s, ok := config.ConnConfig.Config.RuntimeParams["pool_health_check_period"]; ok {
		delete(connConfig.Config.RuntimeParams, "pool_health_check_period")
		d, err := time.ParseDuration(s)
		if err != nil {
			return nil, pgconn.NewParseConfigError(connString, "cannot parse pool_health_check_period", err)
		}
		config.HealthCheckPeriod = d
	} else {
		config.HealthCheckPeriod = defaultHealthCheckPeriod
	}

	if s, ok := config.ConnConfig.Config.RuntimeParams["pool_max_conn_lifetime_jitter"]; ok {
		delete(connConfig.Config.RuntimeParams, "pool_max_conn_lifetime_jitter")
		d, err := time.ParseDuration(s)
		if err != nil {
			return nil, pgconn.NewParseConfigError(connString, "cannot parse pool_max_conn_lifetime_jitter", err)
		}
		config.MaxConnLifetimeJitter = d
	}

	return config, nil
}

// Close closes all connections in the pool and rejects future Acquire calls. Blocks until all connections are returned
// to pool and closed.
func (p *Pool) Close() {
	p.closeOnce.Do(func() {
		close(p.closeChan)
		p.p.Close()
	})
}

func (p *Pool) isExpired(res *puddle.Resource[*connResource]) bool {
	return time.Now().After(res.Value().maxAgeTime)
}

func (p *Pool) triggerHealthCheck() {
	go func() {
		// Destroy is asynchronous so we give it time to actually remove itself from
		// the pool otherwise we might try to check the pool size too soon
		time.Sleep(500 * time.Millisecond)
		select {
		case p.healthCheckChan <- struct{}{}:
		default:
		}
	}()
}

func (p *Pool) backgroundHealthCheck() {
	ticker := time.NewTicker(p.healthCheckPeriod)
	defer ticker.Stop()
	for {
		select {
		case <-p.closeChan:
			return
		case <-p.healthCheckChan:
			p.checkHealth()
		case <-ticker.C:
			p.checkHealth()
		}
	}
}

func (p *Pool) checkHealth() {
	for {
		// If checkMinConns failed we don't destroy any connections since we couldn't
		// even get to minConns
		if err := p.checkMinConns(); err != nil {
			// Should we log this error somewhere?
			break
		}
		if !p.checkConnsHealth() {
			// Since we didn't destroy any connections we can stop looping
			break
		}
		// Technically Destroy is asynchronous but 500ms should be enough for it to
		// remove it from the underlying pool
		select {
		case <-p.closeChan:
			return
		case <-time.After(500 * time.Millisecond):
		}
	}
}

// checkConnsHealth will check all idle connections, destroy a connection if
// it's idle or too old, and returns true if any were destroyed
func (p *Pool) checkConnsHealth() bool {
	var destroyed bool
	totalConns := p.Stat().TotalConns()
	resources := p.p.AcquireAllIdle()
	for _, res := range resources {
		// We're okay going under minConns if the lifetime is up
		if p.isExpired(res) && totalConns >= p.minConns {
			atomic.AddInt64(&p.lifetimeDestroyCount, 1)
			res.Destroy()
			destroyed = true
			// Since Destroy is async we manually decrement totalConns.
			totalConns--
		} else if res.IdleDuration() > p.maxConnIdleTime && totalConns > p.minConns {
			atomic.AddInt64(&p.idleDestroyCount, 1)
			res.Destroy()
			destroyed = true
			// Since Destroy is async we manually decrement totalConns.
			totalConns--
		} else {
			res.ReleaseUnused()
		}
	}
	return destroyed
}

func (p *Pool) checkMinConns() error {
	// TotalConns can include ones that are being destroyed but we should have
	// sleep(500ms) around all of the destroys to help prevent that from throwing
	// off this check

	// Create the number of connections needed to get to both minConns and minIdleConns
	toCreate := max(p.minConns-p.Stat().TotalConns(), p.minIdleConns-p.Stat().IdleConns())
	if toCreate > 0 {
		return p.createIdleResources(context.Background(), int(toCreate))
	}
	return nil
}

func (p *Pool) createIdleResources(parentCtx context.Context, targetResources int) error {
	ctx, cancel := context.WithCancel(parentCtx)
	defer cancel()

	errs := make(chan error, targetResources)

	for i := 0; i < targetResources; i++ {
		go func() {
			err := p.p.CreateResource(ctx)
			// Ignore ErrNotAvailable since it means that the pool has become full since we started creating resource.
			if err == puddle.ErrNotAvailable {
				err = nil
			}
			errs <- err
		}()
	}

	var firstError error
	for i := 0; i < targetResources; i++ {
		err := <-errs
		if err != nil && firstError == nil {
			cancel()
			firstError = err
		}
	}

	return firstError
}

// Acquire returns a connection (*Conn) from the Pool
func (p *Pool) Acquire(ctx context.Context) (c *Conn, err error) {
	if p.acquireTracer != nil {
		ctx = p.acquireTracer.TraceAcquireStart(ctx, p, TraceAcquireStartData{})
		defer func() {
			var conn *pgx.Conn
			if c != nil {
				conn = c.Conn()
			}
			p.acquireTracer.TraceAcquireEnd(ctx, p, TraceAcquireEndData{Conn: conn, Err: err})
		}()
	}

	// Try to acquire from the connection pool up to maxConns + 1 times, so that
	// any that fatal errors would empty the pool and still at least try 1 fresh
	// connection.
	for range p.maxConns + 1 {
		res, err := p.p.Acquire(ctx)
		if err != nil {
			return nil, err
		}

		cr := res.Value()

		shouldPingParams := ShouldPingParams{Conn: cr.conn, IdleDuration: res.IdleDuration()}
		if p.shouldPing(ctx, shouldPingParams) {
			err := cr.conn.Ping(ctx)
			if err != nil {
				res.Destroy()
				continue
			}
		}

		if p.prepareConn != nil {
			ok, err := p.prepareConn(ctx, cr.conn)
			if !ok {
				res.Destroy()
			}
			if err != nil {
				if ok {
					res.Release()
				}
				return nil, err
			}
			if !ok {
				continue
			}
		}

		return cr.getConn(p, res), nil
	}
	return nil, errors.New("pgxpool: detected infinite loop acquiring connection; likely bug in PrepareConn or BeforeAcquire hook")
}

// AcquireFunc acquires a *Conn and calls f with that *Conn. ctx will only affect the Acquire. It has no effect on the
// call of f. The return value is either an error acquiring the *Conn or the return value of f. The *Conn is
// automatically released after the call of f.
func (p *Pool) AcquireFunc(ctx context.Context, f func(*Conn) error) error {
	conn, err := p.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	return f(conn)
}

// AcquireAllIdle atomically acquires all currently idle connections. Its intended use is for health check and
// keep-alive functionality. It does not update pool statistics.
func (p *Pool) AcquireAllIdle(ctx context.Context) []*Conn {
	resources := p.p.AcquireAllIdle()
	conns := make([]*Conn, 0, len(resources))
	for _, res := range resources {
		cr := res.Value()
		if p.prepareConn != nil {
			ok, err := p.prepareConn(ctx, cr.conn)
			if !ok || err != nil {
				res.Destroy()
				continue
			}
		}
		conns = append(conns, cr.getConn(p, res))
	}

	return conns
}

// Reset closes all connections, but leaves the pool open. It is intended for use when an error is detected that would
// disrupt all connections (such as a network interruption or a server state change).
//
// It is safe to reset a pool while connections are checked out. Those connections will be closed when they are returned
// to the pool.
func (p *Pool) Reset() {
	p.p.Reset()
}

// Config returns a copy of config that was used to initialize this pool.
func (p *Pool) Config() *Config { return p.config.Copy() }

// Stat returns a pgxpool.Stat struct with a snapshot of Pool statistics.
func (p *Pool) Stat() *Stat {
	return &Stat{
		s:                    p.p.Stat(),
		newConnsCount:        atomic.LoadInt64(&p.newConnsCount),
		lifetimeDestroyCount: atomic.LoadInt64(&p.lifetimeDestroyCount),
		idleDestroyCount:     atomic.LoadInt64(&p.idleDestroyCount),
	}
}

// Exec acquires a connection from the Pool and executes the given SQL.
// SQL can be either a prepared statement name or an SQL string.
// Arguments should be referenced positionally from the SQL string as $1, $2, etc.
// The acquired connection is returned to the pool when the Exec function returns.
func (p *Pool) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	c, err := p.Acquire(ctx)
	if err != nil {
		return pgconn.CommandTag{}, err
	}
	defer c.Release()

	return c.Exec(ctx, sql, arguments...)
}

// Query acquires a connection and executes a query that returns pgx.Rows.
// Arguments should be referenced positionally from the SQL string as $1, $2, etc.
// See pgx.Rows documentation to close the returned Rows and return the acquired connection to the Pool.
//
// If there is an error, the returned pgx.Rows will be returned in an error state.
// If preferred, ignore the error returned from Query and handle errors using the returned pgx.Rows.
//
// For extra control over how the query is executed, the types QuerySimpleProtocol, QueryResultFormats, and
// QueryResultFormatsByOID may be used as the first args to control exactly how the query is executed. This is rarely
// needed. See the documentation for those types for details.
func (p *Pool) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	c, err := p.Acquire(ctx)
	if err != nil {
		return errRows{err: err}, err
	}

	rows, err := c.Query(ctx, sql, args...)
	if err != nil {
		c.Release()
		return errRows{err: err}, err
	}

	return c.getPoolRows(rows), nil
}

// QueryRow acquires a connection and executes a query that is expected
// to return at most one row (pgx.Row). Errors are deferred until pgx.Row's
// Scan method is called. If the query selects no rows, pgx.Row's Scan will
// return ErrNoRows. Otherwise, pgx.Row's Scan scans the first selected row
// and discards the rest. The acquired connection is returned to the Pool when
// pgx.Row's Scan method is called.
//
// Arguments should be referenced positionally from the SQL string as $1, $2, etc.
//
// For extra control over how the query is executed, the types QuerySimpleProtocol, QueryResultFormats, and
// QueryResultFormatsByOID may be used as the first args to control exactly how the query is executed. This is rarely
// needed. See the documentation for those types for details.
func (p *Pool) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	c, err := p.Acquire(ctx)
	if err != nil {
		return errRow{err: err}
	}

	row := c.QueryRow(ctx, sql, args...)
	return c.getPoolRow(row)
}

func (p *Pool) SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults {
	c, err := p.Acquire(ctx)
	if err != nil {
		return errBatchResults{err: err}
	}

	br := c.SendBatch(ctx, b)
	return &poolBatchResults{br: br, c: c}
}

// Begin acquires a connection from the Pool and starts a transaction. Unlike database/sql, the context only affects the begin command. i.e. there is no
// auto-rollback on context cancellation. Begin initiates a transaction block without explicitly setting a transaction mode for the block (see BeginTx with TxOptions if transaction mode is required).
// *pgxpool.Tx is returned, which implements the pgx.Tx interface.
// Commit or Rollback must be called on the returned transaction to finalize the transaction block.
func (p *Pool) Begin(ctx context.Context) (pgx.Tx, error) {
	return p.BeginTx(ctx, pgx.TxOptions{})
}

// BeginTx acquires a connection from the Pool and starts a transaction with pgx.TxOptions determining the transaction mode.
// Unlike database/sql, the context only affects the begin command. i.e. there is no auto-rollback on context cancellation.
// *pgxpool.Tx is returned, which implements the pgx.Tx interface.
// Commit or Rollback must be called on the returned transaction to finalize the transaction block.
func (p *Pool) BeginTx(ctx context.Context, txOptions pgx.TxOptions) (pgx.Tx, error) {
	c, err := p.Acquire(ctx)
	if err != nil {
		return nil, err
	}

	t, err := c.BeginTx(ctx, txOptions)
	if err != nil {
		c.Release()
		return nil, err
	}

	return &Tx{t: t, c: c}, nil
}

func (p *Pool) CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
	c, err := p.Acquire(ctx)
	if err != nil {
		return 0, err
	}
	defer c.Release()

	return c.Conn().CopyFrom(ctx, tableName, columnNames, rowSrc)
}

// Ping acquires a connection from the Pool and executes an empty sql statement against it.
// If the sql returns without error, the database Ping is considered successful, otherwise, the error is returned.
func (p *Pool) Ping(ctx context.Context) error {
	c, err := p.Acquire(ctx)
	if err != nil {
		return err
	}
	defer c.Release()
	return c.Ping(ctx)
}
