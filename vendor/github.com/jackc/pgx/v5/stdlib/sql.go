// Package stdlib is the compatibility layer from pgx to database/sql.
//
// A database/sql connection can be established through sql.Open.
//
//	db, err := sql.Open("pgx", "postgres://pgx_md5:secret@localhost:5432/pgx_test?sslmode=disable")
//	if err != nil {
//	  return err
//	}
//
// Or from a keyword/value string.
//
//	db, err := sql.Open("pgx", "user=postgres password=secret host=localhost port=5432 database=pgx_test sslmode=disable")
//	if err != nil {
//	  return err
//	}
//
// Or from a *pgxpool.Pool.
//
//	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
//	if err != nil {
//	  return err
//	}
//
//	db := stdlib.OpenDBFromPool(pool)
//
// Or a pgx.ConnConfig can be used to set configuration not accessible via connection string. In this case the
// pgx.ConnConfig must first be registered with the driver. This registration returns a connection string which is used
// with sql.Open.
//
//	connConfig, _ := pgx.ParseConfig(os.Getenv("DATABASE_URL"))
//	connConfig.Tracer = &tracelog.TraceLog{Logger: myLogger, LogLevel: tracelog.LogLevelInfo}
//	connStr := stdlib.RegisterConnConfig(connConfig)
//	db, _ := sql.Open("pgx", connStr)
//
// pgx uses standard PostgreSQL positional parameters in queries. e.g. $1, $2. It does not support named parameters.
//
//	db.QueryRow("select * from users where id=$1", userID)
//
// (*sql.Conn) Raw() can be used to get a *pgx.Conn from the standard database/sql.DB connection pool. This allows
// operations that use pgx specific functionality.
//
//	// Given db is a *sql.DB
//	conn, err := db.Conn(context.Background())
//	if err != nil {
//	  // handle error from acquiring connection from DB pool
//	}
//
//	err = conn.Raw(func(driverConn any) error {
//	  conn := driverConn.(*stdlib.Conn).Conn() // conn is a *pgx.Conn
//	  // Do pgx specific stuff with conn
//	  conn.CopyFrom(...)
//	  return nil
//	})
//	if err != nil {
//	  // handle error that occurred while using *pgx.Conn
//	}
//
// # PostgreSQL Specific Data Types
//
// The pgtype package provides support for PostgreSQL specific types. *pgtype.Map.SQLScanner is an adapter that makes
// these types usable as a sql.Scanner.
//
//	m := pgtype.NewMap()
//	var a []int64
//	err := db.QueryRow("select '{1,2,3}'::bigint[]").Scan(m.SQLScanner(&a))
package stdlib

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"math"
	"math/rand/v2"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Only intrinsic types should be binary format with database/sql.
var databaseSQLResultFormats pgx.QueryResultFormatsByOID

var pgxDriver *Driver

func init() {
	pgxDriver = &Driver{
		configs: make(map[string]*pgx.ConnConfig),
	}

	// if pgx driver was already registered by different pgx major version then we
	// skip registration under the default name.
	if !slices.Contains(sql.Drivers(), "pgx") {
		sql.Register("pgx", pgxDriver)
	}
	sql.Register("pgx/v5", pgxDriver)

	databaseSQLResultFormats = pgx.QueryResultFormatsByOID{
		pgtype.BoolOID:        1,
		pgtype.ByteaOID:       1,
		pgtype.CIDOID:         1,
		pgtype.DateOID:        1,
		pgtype.Float4OID:      1,
		pgtype.Float8OID:      1,
		pgtype.Int2OID:        1,
		pgtype.Int4OID:        1,
		pgtype.Int8OID:        1,
		pgtype.OIDOID:         1,
		pgtype.TimestampOID:   1,
		pgtype.TimestamptzOID: 1,
		pgtype.XIDOID:         1,
	}
}

// OptionOpenDB options for configuring the driver when opening a new db pool.
type OptionOpenDB func(*connector)

// ShouldPingParams are passed to OptionShouldPing to decide whether to ping before reusing a connection.
type ShouldPingParams struct {
	// Conn is the underlying pgx connection.
	Conn *pgx.Conn
	// IdleDuration is how long it has been since ResetSession last ran.
	IdleDuration time.Duration
}

// OptionShouldPing controls whether stdlib should issue a liveness ping before reusing a connection.
// If the function returns true, stdlib will ping.
// If it returns false, stdlib will skip the ping.
// If not provided, default is ping only when IdleDuration > 1s.
func OptionShouldPing(f func(context.Context, ShouldPingParams) bool) OptionOpenDB {
	return func(dc *connector) { dc.ShouldPing = f }
}

// OptionBeforeConnect provides a callback for before connect. It is passed a shallow copy of the ConnConfig that will
// be used to connect, so only its immediate members should be modified. Used only if db is opened with *pgx.ConnConfig.
func OptionBeforeConnect(bc func(context.Context, *pgx.ConnConfig) error) OptionOpenDB {
	return func(dc *connector) {
		dc.BeforeConnect = bc
	}
}

// OptionAfterConnect provides a callback for after connect. Used only if db is opened with *pgx.ConnConfig.
func OptionAfterConnect(ac func(context.Context, *pgx.Conn) error) OptionOpenDB {
	return func(dc *connector) {
		dc.AfterConnect = ac
	}
}

// OptionResetSession provides a callback that can be used to add custom logic prior to executing a query on the
// connection if the connection has been used before.
// If ResetSessionFunc returns ErrBadConn error the connection will be discarded.
func OptionResetSession(rs func(context.Context, *pgx.Conn) error) OptionOpenDB {
	return func(dc *connector) {
		dc.ResetSession = rs
	}
}

// RandomizeHostOrderFunc is a BeforeConnect hook that randomizes the host order in the provided connConfig, so that a
// new host becomes primary each time. This is useful to distribute connections for multi-master databases like
// CockroachDB. If you use this you likely should set https://golang.org/pkg/database/sql/#DB.SetConnMaxLifetime as well
// to ensure that connections are periodically rebalanced across your nodes.
func RandomizeHostOrderFunc(ctx context.Context, connConfig *pgx.ConnConfig) error {
	if len(connConfig.Fallbacks) == 0 {
		return nil
	}

	newFallbacks := append([]*pgconn.FallbackConfig{{
		Host:      connConfig.Host,
		Port:      connConfig.Port,
		TLSConfig: connConfig.TLSConfig,
	}}, connConfig.Fallbacks...)

	rand.Shuffle(len(newFallbacks), func(i, j int) {
		newFallbacks[i], newFallbacks[j] = newFallbacks[j], newFallbacks[i]
	})

	// Use the one that sorted last as the primary and keep the rest as the fallbacks
	newPrimary := newFallbacks[len(newFallbacks)-1]
	connConfig.Host = newPrimary.Host
	connConfig.Port = newPrimary.Port
	connConfig.TLSConfig = newPrimary.TLSConfig
	connConfig.Fallbacks = newFallbacks[:len(newFallbacks)-1]
	return nil
}

func GetConnector(config pgx.ConnConfig, opts ...OptionOpenDB) driver.Connector {
	c := connector{
		ConnConfig:    config,
		BeforeConnect: func(context.Context, *pgx.ConnConfig) error { return nil }, // noop before connect by default
		AfterConnect:  func(context.Context, *pgx.Conn) error { return nil },       // noop after connect by default
		ResetSession:  func(context.Context, *pgx.Conn) error { return nil },       // noop reset session by default
		driver:        pgxDriver,
	}

	for _, opt := range opts {
		opt(&c)
	}
	return c
}

// GetPoolConnector creates a new driver.Connector from the given *pgxpool.Pool. By using this be sure to set the
// maximum idle connections of the *sql.DB created with this connector to zero since they must be managed from the
// *pgxpool.Pool. This is required to avoid acquiring all the connections from the pgxpool and starving any direct
// users of the pgxpool.
func GetPoolConnector(pool *pgxpool.Pool, opts ...OptionOpenDB) driver.Connector {
	c := connector{
		pool:         pool,
		ResetSession: func(context.Context, *pgx.Conn) error { return nil }, // noop reset session by default
		driver:       pgxDriver,
	}

	for _, opt := range opts {
		opt(&c)
	}

	return c
}

func OpenDB(config pgx.ConnConfig, opts ...OptionOpenDB) *sql.DB {
	c := GetConnector(config, opts...)
	return sql.OpenDB(c)
}

// OpenDBFromPool creates a new *sql.DB from the given *pgxpool.Pool. Note that this method automatically sets the
// maximum number of idle connections in *sql.DB to zero, since they must be managed from the *pgxpool.Pool. This is
// required to avoid acquiring all the connections from the pgxpool and starving any direct users of the pgxpool. Note
// that closing the returned *sql.DB will not close the *pgxpool.Pool.
func OpenDBFromPool(pool *pgxpool.Pool, opts ...OptionOpenDB) *sql.DB {
	c := GetPoolConnector(pool, opts...)
	db := sql.OpenDB(c)
	db.SetMaxIdleConns(0)
	return db
}

type connector struct {
	pgx.ConnConfig
	pool          *pgxpool.Pool
	BeforeConnect func(context.Context, *pgx.ConnConfig) error // function to call before creation of every new connection
	AfterConnect  func(context.Context, *pgx.Conn) error       // function to call after creation of every new connection
	ResetSession  func(context.Context, *pgx.Conn) error       // function is called before a connection is reused
	ShouldPing    func(context.Context, ShouldPingParams) bool // function to decide if stdlib should ping before reusing a connection
	driver        *Driver
}

// Connect implement driver.Connector interface
func (c connector) Connect(ctx context.Context) (driver.Conn, error) {
	var (
		connConfig pgx.ConnConfig
		conn       *pgx.Conn
		close      func(context.Context) error
		err        error
	)

	if c.pool == nil {
		// Create a shallow copy of the config, so that BeforeConnect can safely modify it
		connConfig = c.ConnConfig

		if err = c.BeforeConnect(ctx, &connConfig); err != nil {
			return nil, err
		}

		if conn, err = pgx.ConnectConfig(ctx, &connConfig); err != nil {
			return nil, err
		}

		if err = c.AfterConnect(ctx, conn); err != nil {
			return nil, err
		}

		close = conn.Close
	} else {
		var pconn *pgxpool.Conn

		pconn, err = c.pool.Acquire(ctx)
		if err != nil {
			return nil, err
		}

		conn = pconn.Conn()

		close = func(_ context.Context) error {
			pconn.Release()
			return nil
		}
	}

	return &Conn{
		conn:             conn,
		close:            close,
		driver:           c.driver,
		connConfig:       connConfig,
		resetSessionFunc: c.ResetSession,
		shouldPing:       c.ShouldPing,
		psRefCounts:      make(map[*pgconn.StatementDescription]int),
	}, nil
}

// Driver implement driver.Connector interface
func (c connector) Driver() driver.Driver {
	return c.driver
}

// GetDefaultDriver returns the driver initialized in the init function
// and used when the pgx driver is registered.
func GetDefaultDriver() driver.Driver {
	return pgxDriver
}

type Driver struct {
	configMutex sync.Mutex
	configs     map[string]*pgx.ConnConfig
	sequence    int
}

func (d *Driver) Open(name string) (driver.Conn, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second) // Ensure eventual timeout
	defer cancel()

	connector, err := d.OpenConnector(name)
	if err != nil {
		return nil, err
	}
	return connector.Connect(ctx)
}

func (d *Driver) OpenConnector(name string) (driver.Connector, error) {
	return &driverConnector{driver: d, name: name}, nil
}

func (d *Driver) registerConnConfig(c *pgx.ConnConfig) string {
	d.configMutex.Lock()
	connStr := fmt.Sprintf("registeredConnConfig%d", d.sequence)
	d.sequence++
	d.configs[connStr] = c
	d.configMutex.Unlock()
	return connStr
}

func (d *Driver) unregisterConnConfig(connStr string) {
	d.configMutex.Lock()
	delete(d.configs, connStr)
	d.configMutex.Unlock()
}

type driverConnector struct {
	driver *Driver
	name   string
}

func (dc *driverConnector) Connect(ctx context.Context) (driver.Conn, error) {
	var connConfig *pgx.ConnConfig

	dc.driver.configMutex.Lock()
	connConfig = dc.driver.configs[dc.name]
	dc.driver.configMutex.Unlock()

	if connConfig == nil {
		var err error
		connConfig, err = pgx.ParseConfig(dc.name)
		if err != nil {
			return nil, err
		}
	}

	conn, err := pgx.ConnectConfig(ctx, connConfig)
	if err != nil {
		return nil, err
	}

	c := &Conn{
		conn:             conn,
		close:            conn.Close,
		driver:           dc.driver,
		connConfig:       *connConfig,
		resetSessionFunc: func(context.Context, *pgx.Conn) error { return nil },
		psRefCounts:      make(map[*pgconn.StatementDescription]int),
	}

	return c, nil
}

func (dc *driverConnector) Driver() driver.Driver {
	return dc.driver
}

// RegisterConnConfig registers a ConnConfig and returns the connection string to use with Open.
func RegisterConnConfig(c *pgx.ConnConfig) string {
	return pgxDriver.registerConnConfig(c)
}

// UnregisterConnConfig removes the ConnConfig registration for connStr.
func UnregisterConnConfig(connStr string) {
	pgxDriver.unregisterConnConfig(connStr)
}

type Conn struct {
	conn                 *pgx.Conn
	close                func(context.Context) error
	driver               *Driver
	connConfig           pgx.ConnConfig
	resetSessionFunc     func(context.Context, *pgx.Conn) error       // Function is called before a connection is reused
	shouldPing           func(context.Context, ShouldPingParams) bool // Function to decide if stdlib should ping before reusing a connection
	lastResetSessionTime time.Time

	// psRefCounts contains reference counts for prepared statements. Prepare uses the underlying pgx logic to generate
	// deterministic statement names from the statement text. If this query has already been prepared then the existing
	// *pgconn.StatementDescription will be returned. However, this means that if Close is called on the returned Stmt
	// then the underlying prepared statement will be closed even when the underlying prepared statement is still in use
	// by another database/sql Stmt. To prevent this psRefCounts keeps track of how many database/sql statements are using
	// the same underlying statement and only closes the underlying statement when the reference count reaches 0.
	psRefCounts map[*pgconn.StatementDescription]int
}

// Conn returns the underlying *pgx.Conn
func (c *Conn) Conn() *pgx.Conn {
	return c.conn
}

func (c *Conn) Prepare(query string) (driver.Stmt, error) {
	return c.PrepareContext(context.Background(), query)
}

func (c *Conn) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
	if c.conn.IsClosed() {
		return nil, driver.ErrBadConn
	}

	sd, err := c.conn.Prepare(ctx, query, query)
	if err != nil {
		return nil, err
	}
	c.psRefCounts[sd]++

	return &Stmt{sd: sd, conn: c}, nil
}

func (c *Conn) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()
	return c.close(ctx)
}

func (c *Conn) Begin() (driver.Tx, error) {
	return c.BeginTx(context.Background(), driver.TxOptions{})
}

func (c *Conn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	if c.conn.IsClosed() {
		return nil, driver.ErrBadConn
	}

	var pgxOpts pgx.TxOptions
	switch sql.IsolationLevel(opts.Isolation) {
	case sql.LevelDefault:
	case sql.LevelReadUncommitted:
		pgxOpts.IsoLevel = pgx.ReadUncommitted
	case sql.LevelReadCommitted:
		pgxOpts.IsoLevel = pgx.ReadCommitted
	case sql.LevelRepeatableRead, sql.LevelSnapshot:
		pgxOpts.IsoLevel = pgx.RepeatableRead
	case sql.LevelSerializable:
		pgxOpts.IsoLevel = pgx.Serializable
	default:
		return nil, fmt.Errorf("unsupported isolation: %v", opts.Isolation)
	}

	if opts.ReadOnly {
		pgxOpts.AccessMode = pgx.ReadOnly
	}

	tx, err := c.conn.BeginTx(ctx, pgxOpts)
	if err != nil {
		return nil, err
	}

	return wrapTx{ctx: ctx, tx: tx}, nil
}

func (c *Conn) ExecContext(ctx context.Context, query string, argsV []driver.NamedValue) (driver.Result, error) {
	if c.conn.IsClosed() {
		return nil, driver.ErrBadConn
	}

	args := make([]any, len(argsV))
	convertNamedArguments(args, argsV)

	commandTag, err := c.conn.Exec(ctx, query, args...)
	// if we got a network error before we had a chance to send the query, retry
	if err != nil {
		if pgconn.SafeToRetry(err) {
			return nil, driver.ErrBadConn
		}
	}
	return driver.RowsAffected(commandTag.RowsAffected()), err
}

func (c *Conn) QueryContext(ctx context.Context, query string, argsV []driver.NamedValue) (driver.Rows, error) {
	if c.conn.IsClosed() {
		return nil, driver.ErrBadConn
	}

	args := make([]any, 1+len(argsV))
	args[0] = databaseSQLResultFormats
	convertNamedArguments(args[1:], argsV)

	rows, err := c.conn.Query(ctx, query, args...)
	if err != nil {
		if pgconn.SafeToRetry(err) {
			return nil, driver.ErrBadConn
		}
		return nil, err
	}

	// Preload first row because otherwise we won't know what columns are available when database/sql asks.
	more := rows.Next()
	if err = rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	return &Rows{conn: c, rows: rows, skipNext: true, skipNextMore: more}, nil
}

func (c *Conn) Ping(ctx context.Context) error {
	if c.conn.IsClosed() {
		return driver.ErrBadConn
	}

	err := c.conn.Ping(ctx)
	if err != nil {
		// A Ping failure implies some sort of fatal state. The connection is almost certainly already closed by the
		// failure, but manually close it just to be sure.
		c.Close()
		return driver.ErrBadConn
	}

	return nil
}

func (c *Conn) CheckNamedValue(*driver.NamedValue) error {
	// Underlying pgx supports sql.Scanner and driver.Valuer interfaces natively. So everything can be passed through directly.
	return nil
}

func (c *Conn) ResetSession(ctx context.Context) error {
	if c.conn.IsClosed() {
		return driver.ErrBadConn
	}

	now := time.Now()
	idle := now.Sub(c.lastResetSessionTime)

	doPing := idle > time.Second // default behavior: ping only if idle > 1s

	if c.shouldPing != nil {
		doPing = c.shouldPing(ctx, ShouldPingParams{
			Conn:         c.conn,
			IdleDuration: idle,
		})
	}

	if doPing {
		if err := c.conn.PgConn().Ping(ctx); err != nil {
			return driver.ErrBadConn
		}
	}

	c.lastResetSessionTime = now

	return c.resetSessionFunc(ctx, c.conn)
}

type Stmt struct {
	sd   *pgconn.StatementDescription
	conn *Conn
}

func (s *Stmt) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()

	refCount := s.conn.psRefCounts[s.sd]
	if refCount == 1 {
		delete(s.conn.psRefCounts, s.sd)
	} else {
		s.conn.psRefCounts[s.sd]--
		return nil
	}

	return s.conn.conn.Deallocate(ctx, s.sd.SQL)
}

func (s *Stmt) NumInput() int {
	return len(s.sd.ParamOIDs)
}

func (s *Stmt) Exec(argsV []driver.Value) (driver.Result, error) {
	return nil, errors.New("Stmt.Exec deprecated and not implemented")
}

func (s *Stmt) ExecContext(ctx context.Context, argsV []driver.NamedValue) (driver.Result, error) {
	return s.conn.ExecContext(ctx, s.sd.SQL, argsV)
}

func (s *Stmt) Query(argsV []driver.Value) (driver.Rows, error) {
	return nil, errors.New("Stmt.Query deprecated and not implemented")
}

func (s *Stmt) QueryContext(ctx context.Context, argsV []driver.NamedValue) (driver.Rows, error) {
	return s.conn.QueryContext(ctx, s.sd.SQL, argsV)
}

type rowValueFunc func(src []byte) (driver.Value, error)

type Rows struct {
	conn         *Conn
	rows         pgx.Rows
	valueFuncs   []rowValueFunc
	skipNext     bool
	skipNextMore bool

	columnNames []string
}

func (r *Rows) Columns() []string {
	if r.columnNames == nil {
		fields := r.rows.FieldDescriptions()
		r.columnNames = make([]string, len(fields))
		for i, fd := range fields {
			r.columnNames[i] = string(fd.Name)
		}
	}

	return r.columnNames
}

// ColumnTypeDatabaseTypeName returns the database system type name. If the name is unknown the OID is returned.
func (r *Rows) ColumnTypeDatabaseTypeName(index int) string {
	if dt, ok := r.conn.conn.TypeMap().TypeForOID(r.rows.FieldDescriptions()[index].DataTypeOID); ok {
		return strings.ToUpper(dt.Name)
	}

	return strconv.FormatInt(int64(r.rows.FieldDescriptions()[index].DataTypeOID), 10)
}

const varHeaderSize = 4

// ColumnTypeLength returns the length of the column type if the column is a
// variable length type. If the column is not a variable length type ok
// should return false.
func (r *Rows) ColumnTypeLength(index int) (int64, bool) {
	fd := r.rows.FieldDescriptions()[index]

	switch fd.DataTypeOID {
	case pgtype.TextOID, pgtype.ByteaOID:
		return math.MaxInt64, true
	case pgtype.VarcharOID, pgtype.BPCharArrayOID:
		return int64(fd.TypeModifier - varHeaderSize), true
	case pgtype.VarbitOID:
		return int64(fd.TypeModifier), true
	default:
		return 0, false
	}
}

// ColumnTypePrecisionScale should return the precision and scale for decimal
// types. If not applicable, ok should be false.
func (r *Rows) ColumnTypePrecisionScale(index int) (precision, scale int64, ok bool) {
	fd := r.rows.FieldDescriptions()[index]

	switch fd.DataTypeOID {
	case pgtype.NumericOID:
		mod := fd.TypeModifier - varHeaderSize
		precision = int64((mod >> 16) & 0xffff)
		scale = int64(mod & 0xffff)
		return precision, scale, true
	default:
		return 0, 0, false
	}
}

// ColumnTypeScanType returns the value type that can be used to scan types into.
func (r *Rows) ColumnTypeScanType(index int) reflect.Type {
	fd := r.rows.FieldDescriptions()[index]

	switch fd.DataTypeOID {
	case pgtype.Float8OID:
		return reflect.TypeOf(float64(0))
	case pgtype.Float4OID:
		return reflect.TypeOf(float32(0))
	case pgtype.Int8OID:
		return reflect.TypeOf(int64(0))
	case pgtype.Int4OID:
		return reflect.TypeOf(int32(0))
	case pgtype.Int2OID:
		return reflect.TypeOf(int16(0))
	case pgtype.BoolOID:
		return reflect.TypeOf(false)
	case pgtype.NumericOID:
		return reflect.TypeOf(float64(0))
	case pgtype.DateOID, pgtype.TimestampOID, pgtype.TimestamptzOID:
		return reflect.TypeOf(time.Time{})
	case pgtype.ByteaOID:
		return reflect.TypeOf([]byte(nil))
	default:
		return reflect.TypeOf("")
	}
}

func (r *Rows) Close() error {
	r.rows.Close()
	return r.rows.Err()
}

func (r *Rows) Next(dest []driver.Value) error {
	m := r.conn.conn.TypeMap()
	fieldDescriptions := r.rows.FieldDescriptions()

	if r.valueFuncs == nil {
		r.valueFuncs = make([]rowValueFunc, len(fieldDescriptions))

		for i, fd := range fieldDescriptions {
			dataTypeOID := fd.DataTypeOID
			format := fd.Format

			switch fd.DataTypeOID {
			case pgtype.BoolOID:
				var d bool
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					return d, err
				}
			case pgtype.ByteaOID:
				var d []byte
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					return d, err
				}
			case pgtype.CIDOID, pgtype.OIDOID, pgtype.XIDOID:
				var d pgtype.Uint32
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					if err != nil {
						return nil, err
					}
					return d.Value()
				}
			case pgtype.DateOID:
				var d pgtype.Date
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					if err != nil {
						return nil, err
					}
					return d.Value()
				}
			case pgtype.Float4OID:
				var d float32
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					return float64(d), err
				}
			case pgtype.Float8OID:
				var d float64
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					return d, err
				}
			case pgtype.Int2OID:
				var d int16
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					return int64(d), err
				}
			case pgtype.Int4OID:
				var d int32
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					return int64(d), err
				}
			case pgtype.Int8OID:
				var d int64
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					return d, err
				}
			case pgtype.JSONOID, pgtype.JSONBOID:
				var d []byte
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					if err != nil {
						return nil, err
					}
					return d, nil
				}
			case pgtype.TimestampOID:
				var d pgtype.Timestamp
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					if err != nil {
						return nil, err
					}
					return d.Value()
				}
			case pgtype.TimestamptzOID:
				var d pgtype.Timestamptz
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					if err != nil {
						return nil, err
					}
					return d.Value()
				}
			case pgtype.XMLOID:
				var d []byte
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					if err != nil {
						return nil, err
					}
					return d, nil
				}
			default:
				var d string
				scanPlan := m.PlanScan(dataTypeOID, format, &d)
				r.valueFuncs[i] = func(src []byte) (driver.Value, error) {
					err := scanPlan.Scan(src, &d)
					return d, err
				}
			}
		}
	}

	var more bool
	if r.skipNext {
		more = r.skipNextMore
		r.skipNext = false
	} else {
		more = r.rows.Next()
	}

	if !more {
		if r.rows.Err() == nil {
			return io.EOF
		} else {
			return r.rows.Err()
		}
	}

	for i, rv := range r.rows.RawValues() {
		if rv != nil {
			var err error
			dest[i], err = r.valueFuncs[i](rv)
			if err != nil {
				return fmt.Errorf("convert field %d failed: %w", i, err)
			}
		} else {
			dest[i] = nil
		}
	}

	return nil
}

func convertNamedArguments(args []any, argsV []driver.NamedValue) {
	for i, v := range argsV {
		if v.Value != nil {
			args[i] = v.Value.(any)
		} else {
			args[i] = nil
		}
	}
}

type wrapTx struct {
	ctx context.Context
	tx  pgx.Tx
}

func (wtx wrapTx) Commit() error { return wtx.tx.Commit(wtx.ctx) }

func (wtx wrapTx) Rollback() error { return wtx.tx.Rollback(wtx.ctx) }
