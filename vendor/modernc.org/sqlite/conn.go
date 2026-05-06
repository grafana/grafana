// Copyright 2025 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlite // import "modernc.org/sqlite"

import (
	"context"
	"database/sql/driver"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	"modernc.org/libc"
	"modernc.org/libc/sys/types"
	sqlite3 "modernc.org/sqlite/lib"
)

type conn struct {
	db  uintptr // *sqlite3.Xsqlite3
	tls *libc.TLS

	// Context handling can cause conn.Close and conn.interrupt to be invoked
	// concurrently.
	sync.Mutex

	writeTimeFormat   string
	beginMode         string
	intToTime         bool
	integerTimeFormat string
}

func newConn(dsn string) (*conn, error) {
	var query, vfsName string

	// Parse the query parameters from the dsn and them from the dsn if not prefixed by file:
	// https://github.com/mattn/go-sqlite3/blob/3392062c729d77820afc1f5cae3427f0de39e954/sqlite3.go#L1046
	// https://github.com/mattn/go-sqlite3/blob/3392062c729d77820afc1f5cae3427f0de39e954/sqlite3.go#L1383
	pos := strings.IndexRune(dsn, '?')
	if pos >= 1 {
		query = dsn[pos+1:]
		var err error
		vfsName, err = getVFSName(query)
		if err != nil {
			return nil, err
		}

		if !strings.HasPrefix(dsn, "file:") {
			dsn = dsn[:pos]
		}
	}

	c := &conn{tls: libc.NewTLS()}
	db, err := c.openV2(
		dsn,
		vfsName,
		sqlite3.SQLITE_OPEN_READWRITE|sqlite3.SQLITE_OPEN_CREATE|
			sqlite3.SQLITE_OPEN_FULLMUTEX|
			sqlite3.SQLITE_OPEN_URI,
	)
	if err != nil {
		return nil, err
	}

	c.db = db
	if err = c.extendedResultCodes(true); err != nil {
		c.Close()
		return nil, err
	}

	if err = applyQueryParams(c, query); err != nil {
		c.Close()
		return nil, err
	}

	return c, nil
}

// Attempt to parse s as a time. Return (s, false) if s is not
// recognized as a valid time encoding.
func (c *conn) parseTime(s string) (interface{}, bool) {
	if v, ok := c.parseTimeString(s, strings.Index(s, "m=")); ok {
		return v, true
	}

	ts := strings.TrimSuffix(s, "Z")

	for _, f := range parseTimeFormats {
		t, err := time.Parse(f, ts)
		if err == nil {
			return t, true
		}
	}

	return s, false
}

// Attempt to parse s as a time string produced by t.String().  If x > 0 it's
// the index of substring "m=" within s.  Return (s, false) if s is
// not recognized as a valid time encoding.
func (c *conn) parseTimeString(s0 string, x int) (interface{}, bool) {
	s := s0
	if x > 0 {
		s = s[:x] // "2006-01-02 15:04:05.999999999 -0700 MST m=+9999" -> "2006-01-02 15:04:05.999999999 -0700 MST "
	}
	s = strings.TrimSpace(s)
	if t, err := time.Parse("2006-01-02 15:04:05.999999999 -0700 MST", s); err == nil {
		return t, true
	}

	return s0, false
}

// writeTimeFormats are the names and formats supported
// by the `_time_format` DSN query param.
var writeTimeFormats = map[string]string{
	"sqlite": parseTimeFormats[0],
}

func (c *conn) formatTime(t time.Time) string {
	// Before configurable write time formats were supported,
	// time.Time.String was used. Maintain that default to
	// keep existing driver users formatting times the same.
	if c.writeTimeFormat == "" {
		return t.String()
	}
	return t.Format(c.writeTimeFormat)
}

// C documentation
//
//	const void *sqlite3_column_blob(sqlite3_stmt*, int iCol);
func (c *conn) columnBlob(pstmt uintptr, iCol int) (v []byte, err error) {
	p := sqlite3.Xsqlite3_column_blob(c.tls, pstmt, int32(iCol))
	len, err := c.columnBytes(pstmt, iCol)
	if err != nil {
		return nil, err
	}

	if p == 0 || len == 0 {
		return nil, nil
	}

	v = make([]byte, len)
	copy(v, (*libc.RawMem)(unsafe.Pointer(p))[:len:len])
	return v, nil
}

// C documentation
//
//	int sqlite3_column_bytes(sqlite3_stmt*, int iCol);
func (c *conn) columnBytes(pstmt uintptr, iCol int) (_ int, err error) {
	v := sqlite3.Xsqlite3_column_bytes(c.tls, pstmt, int32(iCol))
	return int(v), nil
}

// C documentation
//
//	const unsigned char *sqlite3_column_text(sqlite3_stmt*, int iCol);
func (c *conn) columnText(pstmt uintptr, iCol int) (v string, err error) {
	p := sqlite3.Xsqlite3_column_text(c.tls, pstmt, int32(iCol))
	len, err := c.columnBytes(pstmt, iCol)
	if err != nil {
		return "", err
	}

	if p == 0 || len == 0 {
		return "", nil
	}

	b := make([]byte, len)
	copy(b, (*libc.RawMem)(unsafe.Pointer(p))[:len:len])
	return string(b), nil
}

// C documentation
//
//	double sqlite3_column_double(sqlite3_stmt*, int iCol);
func (c *conn) columnDouble(pstmt uintptr, iCol int) (v float64, err error) {
	v = sqlite3.Xsqlite3_column_double(c.tls, pstmt, int32(iCol))
	return v, nil
}

// C documentation
//
//	sqlite3_int64 sqlite3_column_int64(sqlite3_stmt*, int iCol);
func (c *conn) columnInt64(pstmt uintptr, iCol int) (v int64, err error) {
	v = sqlite3.Xsqlite3_column_int64(c.tls, pstmt, int32(iCol))
	return v, nil
}

// C documentation
//
//	int sqlite3_column_type(sqlite3_stmt*, int iCol);
func (c *conn) columnType(pstmt uintptr, iCol int) (_ int, err error) {
	v := sqlite3.Xsqlite3_column_type(c.tls, pstmt, int32(iCol))
	return int(v), nil
}

// C documentation
//
//	const char *sqlite3_column_decltype(sqlite3_stmt*,int);
func (c *conn) columnDeclType(pstmt uintptr, iCol int) string {
	return libc.GoString(sqlite3.Xsqlite3_column_decltype(c.tls, pstmt, int32(iCol)))
}

// C documentation
//
//	const char *sqlite3_column_name(sqlite3_stmt*, int N);
func (c *conn) columnName(pstmt uintptr, n int) (string, error) {
	p := sqlite3.Xsqlite3_column_name(c.tls, pstmt, int32(n))
	return libc.GoString(p), nil
}

// C documentation
//
//	int sqlite3_column_count(sqlite3_stmt *pStmt);
func (c *conn) columnCount(pstmt uintptr) (_ int, err error) {
	v := sqlite3.Xsqlite3_column_count(c.tls, pstmt)
	return int(v), nil
}

// C documentation
//
//	sqlite3_int64 sqlite3_last_insert_rowid(sqlite3*);
func (c *conn) lastInsertRowID() (v int64, _ error) {
	return sqlite3.Xsqlite3_last_insert_rowid(c.tls, c.db), nil
}

// C documentation
//
//	int sqlite3_changes(sqlite3*);
func (c *conn) changes() (int, error) {
	v := sqlite3.Xsqlite3_changes(c.tls, c.db)
	return int(v), nil
}

// C documentation
//
//	int sqlite3_step(sqlite3_stmt*);
func (c *conn) step(pstmt uintptr) (int, error) {
	for {
		switch rc := sqlite3.Xsqlite3_step(c.tls, pstmt); rc {
		case sqliteLockedSharedcache:
			if err := c.retry(pstmt); err != nil {
				return sqlite3.SQLITE_LOCKED, err
			}
		case
			sqlite3.SQLITE_DONE,
			sqlite3.SQLITE_ROW:

			return int(rc), nil
		default:
			return int(rc), c.errstr(rc)
		}
	}
}

func (c *conn) retry(pstmt uintptr) error {
	mu := mutexAlloc(c.tls)
	(*mutex)(unsafe.Pointer(mu)).Lock()
	rc := sqlite3.Xsqlite3_unlock_notify(
		c.tls,
		c.db,
		*(*uintptr)(unsafe.Pointer(&struct {
			f func(*libc.TLS, uintptr, int32)
		}{unlockNotify})),
		mu,
	)
	if rc == sqlite3.SQLITE_LOCKED { // Deadlock, see https://www.sqlite.org/c3ref/unlock_notify.html
		(*mutex)(unsafe.Pointer(mu)).Unlock()
		mutexFree(c.tls, mu)
		return c.errstr(rc)
	}

	(*mutex)(unsafe.Pointer(mu)).Lock()
	(*mutex)(unsafe.Pointer(mu)).Unlock()
	mutexFree(c.tls, mu)
	if pstmt != 0 {
		sqlite3.Xsqlite3_reset(c.tls, pstmt)
	}
	return nil
}

func (c *conn) bind(pstmt uintptr, n int, args []driver.NamedValue) (allocs []uintptr, err error) {
	defer func() {
		if err == nil {
			return
		}

		for _, v := range allocs {
			c.free(v)
		}
		allocs = nil
	}()

	for i := 1; i <= n; i++ {
		name, err := c.bindParameterName(pstmt, i)
		if err != nil {
			return allocs, err
		}

		var found bool
		var v driver.NamedValue
		for _, v = range args {
			if name != "" {
				// For ?NNN and $NNN params, match if NNN == v.Ordinal.
				//
				// Supporting this for $NNN is a special case that makes eg
				// `select $1, $2, $3 ...` work without needing to use
				// sql.Named.
				if (name[0] == '?' || name[0] == '$') && name[1:] == strconv.Itoa(v.Ordinal) {
					found = true
					break
				}

				// sqlite supports '$', '@' and ':' prefixes for string
				// identifiers and '?' for numeric, so we cannot
				// combine different prefixes with the same name
				// because `database/sql` requires variable names
				// to start with a letter
				if name[1:] == v.Name[:] {
					found = true
					break
				}
			} else {
				if v.Ordinal == i {
					found = true
					break
				}
			}
		}

		if !found {
			if name != "" {
				return allocs, fmt.Errorf("missing named argument %q", name[1:])
			}

			return allocs, fmt.Errorf("missing argument with index %d", i)
		}

		var p uintptr
		switch x := v.Value.(type) {
		case int64:
			if err := c.bindInt64(pstmt, i, x); err != nil {
				return allocs, err
			}
		case float64:
			if err := c.bindDouble(pstmt, i, x); err != nil {
				return allocs, err
			}
		case bool:
			v := 0
			if x {
				v = 1
			}
			if err := c.bindInt(pstmt, i, v); err != nil {
				return allocs, err
			}
		case []byte:
			if p, err = c.bindBlob(pstmt, i, x); err != nil {
				return allocs, err
			}
		case string:
			if p, err = c.bindText(pstmt, i, x); err != nil {
				return allocs, err
			}
		case time.Time:
			switch c.integerTimeFormat {
			case "unix":
				if err := c.bindInt64(pstmt, i, x.Unix()); err != nil {
					return allocs, err
				}
			case "unix_milli":
				if err := c.bindInt64(pstmt, i, x.UnixMilli()); err != nil {
					return allocs, err
				}
			case "unix_micro":
				if err := c.bindInt64(pstmt, i, x.UnixMicro()); err != nil {
					return allocs, err
				}
			case "unix_nano":
				if err := c.bindInt64(pstmt, i, x.UnixNano()); err != nil {
					return allocs, err
				}
			default:
				if p, err = c.bindText(pstmt, i, c.formatTime(x)); err != nil {
					return allocs, err
				}
			}

		case nil:
			if p, err = c.bindNull(pstmt, i); err != nil {
				return allocs, err
			}
		default:
			return allocs, fmt.Errorf("sqlite: invalid driver.Value type %T", x)
		}
		if p != 0 {
			allocs = append(allocs, p)
		}
	}
	return allocs, nil
}

// C documentation
//
//	int sqlite3_bind_null(sqlite3_stmt*, int);
func (c *conn) bindNull(pstmt uintptr, idx1 int) (uintptr, error) {
	if rc := sqlite3.Xsqlite3_bind_null(c.tls, pstmt, int32(idx1)); rc != sqlite3.SQLITE_OK {
		return 0, c.errstr(rc)
	}

	return 0, nil
}

// C documentation
//
//	int sqlite3_bind_text(sqlite3_stmt*,int,const char*,int,void(*)(void*));
func (c *conn) bindText(pstmt uintptr, idx1 int, value string) (uintptr, error) {
	p, err := libc.CString(value)
	if err != nil {
		return 0, err
	}

	if rc := sqlite3.Xsqlite3_bind_text(c.tls, pstmt, int32(idx1), p, int32(len(value)), 0); rc != sqlite3.SQLITE_OK {
		c.free(p)
		return 0, c.errstr(rc)
	}

	return p, nil
}

// C documentation
//
//	int sqlite3_bind_int(sqlite3_stmt*, int, int);
func (c *conn) bindInt(pstmt uintptr, idx1, value int) (err error) {
	if rc := sqlite3.Xsqlite3_bind_int(c.tls, pstmt, int32(idx1), int32(value)); rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}

	return nil
}

// C documentation
//
//	int sqlite3_bind_double(sqlite3_stmt*, int, double);
func (c *conn) bindDouble(pstmt uintptr, idx1 int, value float64) (err error) {
	if rc := sqlite3.Xsqlite3_bind_double(c.tls, pstmt, int32(idx1), value); rc != 0 {
		return c.errstr(rc)
	}

	return nil
}

// C documentation
//
//	int sqlite3_bind_int64(sqlite3_stmt*, int, sqlite3_int64);
func (c *conn) bindInt64(pstmt uintptr, idx1 int, value int64) (err error) {
	if rc := sqlite3.Xsqlite3_bind_int64(c.tls, pstmt, int32(idx1), value); rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}

	return nil
}

// C documentation
//
//	const char *sqlite3_bind_parameter_name(sqlite3_stmt*, int);
func (c *conn) bindParameterName(pstmt uintptr, i int) (string, error) {
	p := sqlite3.Xsqlite3_bind_parameter_name(c.tls, pstmt, int32(i))
	return libc.GoString(p), nil
}

// C documentation
//
//	int sqlite3_bind_parameter_count(sqlite3_stmt*);
func (c *conn) bindParameterCount(pstmt uintptr) (_ int, err error) {
	r := sqlite3.Xsqlite3_bind_parameter_count(c.tls, pstmt)
	return int(r), nil
}

// C documentation
//
//	int sqlite3_finalize(sqlite3_stmt *pStmt);
func (c *conn) finalize(pstmt uintptr) error {
	if rc := sqlite3.Xsqlite3_finalize(c.tls, pstmt); rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}

	return nil
}

// C documentation
//
//	int sqlite3_prepare_v2(
//	sqlite3 *db,            /* Database handle */
//	const char *zSql,       /* SQL statement, UTF-8 encoded */
//	int nByte,              /* Maximum length of zSql in bytes. */
//	sqlite3_stmt **ppStmt,  /* OUT: Statement handle */
//	const char **pzTail     /* OUT: Pointer to unused portion of zSql */
//	);
func (c *conn) prepareV2(zSQL *uintptr) (pstmt uintptr, err error) {
	var ppstmt, pptail uintptr

	defer func() {
		c.free(ppstmt)
		c.free(pptail)
	}()

	if ppstmt, err = c.malloc(int(ptrSize)); err != nil {
		return 0, err
	}

	if pptail, err = c.malloc(int(ptrSize)); err != nil {
		return 0, err
	}

	for {
		// https://gitlab.com/cznic/sqlite/-/issues/236
		// trc("Xsqlite3_prepare_v2(`%s`)", libc.GoString(*zSQL))
		switch rc := sqlite3.Xsqlite3_prepare_v2(c.tls, c.db, *zSQL, -1, ppstmt, pptail); rc {
		case sqlite3.SQLITE_OK:
			*zSQL = *(*uintptr)(unsafe.Pointer(pptail))
			return *(*uintptr)(unsafe.Pointer(ppstmt)), nil
		case sqliteLockedSharedcache:
			if err := c.retry(0); err != nil {
				return 0, err
			}
		default:
			return 0, c.errstr(rc)
		}
	}
}

// C documentation
//
//	void sqlite3_interrupt(sqlite3*);
func (c *conn) interrupt(pdb uintptr) (err error) {
	c.Lock() // Defend against race with .Close invoked by context handling.

	defer c.Unlock()

	if c.tls != nil {
		sqlite3.Xsqlite3_interrupt(c.tls, pdb)
	}
	return nil
}

// C documentation
//
//	int sqlite3_extended_result_codes(sqlite3*, int onoff);
func (c *conn) extendedResultCodes(on bool) error {
	if rc := sqlite3.Xsqlite3_extended_result_codes(c.tls, c.db, libc.Bool32(on)); rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}

	return nil
}

// C documentation
//
//	int sqlite3_open_v2(
//	const char *filename,   /* Database filename (UTF-8) */
//	sqlite3 **ppDb,         /* OUT: SQLite db handle */
//	int flags,              /* Flags */
//	const char *zVfs        /* Name of VFS module to use */
//	);
func (c *conn) openV2(name, vfsName string, flags int32) (uintptr, error) {
	var p, s, vfs uintptr

	defer func() {
		if p != 0 {
			c.free(p)
		}
		if s != 0 {
			c.free(s)
		}
		if vfs != 0 {
			c.free(vfs)
		}
	}()

	p, err := c.malloc(int(ptrSize))
	if err != nil {
		return 0, err
	}

	if s, err = libc.CString(name); err != nil {
		return 0, err
	}

	if vfsName != "" {
		if vfs, err = libc.CString(vfsName); err != nil {
			return 0, err
		}
	}

	if rc := sqlite3.Xsqlite3_open_v2(c.tls, s, p, flags, vfs); rc != sqlite3.SQLITE_OK {
		return 0, c.errstr(rc)
	}

	return *(*uintptr)(unsafe.Pointer(p)), nil
}

func (c *conn) malloc(n int) (uintptr, error) {
	if p := libc.Xmalloc(c.tls, types.Size_t(n)); p != 0 || n == 0 {
		return p, nil
	}

	return 0, fmt.Errorf("sqlite: cannot allocate %d bytes of memory", n)
}

func (c *conn) free(p uintptr) {
	if p != 0 {
		libc.Xfree(c.tls, p)
	}
}

// C documentation
//
//	const char *sqlite3_errstr(int);
func (c *conn) errstr(rc int32) error {
	p := sqlite3.Xsqlite3_errstr(c.tls, rc)
	str := libc.GoString(p)
	p = sqlite3.Xsqlite3_errmsg(c.tls, c.db)
	var s string
	if rc == sqlite3.SQLITE_BUSY {
		s = " (SQLITE_BUSY)"
	}
	switch msg := libc.GoString(p); {
	case msg == str:
		return &Error{msg: fmt.Sprintf("%s (%v)%s", str, rc, s), code: int(rc)}
	default:
		return &Error{msg: fmt.Sprintf("%s: %s (%v)%s", str, msg, rc, s), code: int(rc)}
	}
}

// Begin starts a transaction.
//
// Deprecated: Drivers should implement ConnBeginTx instead (or additionally).
func (c *conn) Begin() (dt driver.Tx, err error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p: (driver.Tx %p, err %v)", c, dt, err)
		}()
	}
	return c.begin(context.Background(), driver.TxOptions{})
}

func (c *conn) begin(ctx context.Context, opts driver.TxOptions) (t driver.Tx, err error) {
	return newTx(ctx, c, opts)
}

// Close invalidates and potentially stops any current prepared statements and
// transactions, marking this connection as no longer in use.
//
// Because the sql package maintains a free pool of connections and only calls
// Close when there's a surplus of idle connections, it shouldn't be necessary
// for drivers to do their own connection caching.
func (c *conn) Close() (err error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p: err %v", c, err)
		}()
	}
	c.Lock() // Defend against race with .interrupt invoked by context handling.

	defer c.Unlock()

	if c.db != 0 {
		if err := c.closeV2(c.db); err != nil {
			return err
		}

		c.db = 0
	}

	if c.tls != nil {
		c.tls.Close()
		c.tls = nil
	}
	return nil
}

// C documentation
//
//	int sqlite3_close_v2(sqlite3*);
func (c *conn) closeV2(db uintptr) error {
	if rc := sqlite3.Xsqlite3_close_v2(c.tls, db); rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}

	return nil
}

// ResetSession is called prior to executing a query on the connection if the
// connection has been used before. If the driver returns ErrBadConn the
// connection is discarded.
func (c *conn) ResetSession(ctx context.Context) error {
	if !c.usable() {
		return driver.ErrBadConn
	}

	return nil
}

// IsValid is called prior to placing the connection into the connection pool.
// The connection will be discarded if false is returned.
func (c *conn) IsValid() bool {
	return c.usable()
}

func (c *conn) usable() bool {
	return c.db != 0 && sqlite3.Xsqlite3_is_interrupted(c.tls, c.db) == 0
}

type userDefinedFunction struct {
	zFuncName uintptr
	nArg      int32
	eTextRep  int32
	pApp      uintptr

	scalar   bool
	freeOnce sync.Once
}

func (c *conn) createFunctionInternal(fun *userDefinedFunction) error {
	var rc int32

	if fun.scalar {
		rc = sqlite3.Xsqlite3_create_function(
			c.tls,
			c.db,
			fun.zFuncName,
			fun.nArg,
			fun.eTextRep,
			fun.pApp,
			cFuncPointer(funcTrampoline),
			0,
			0,
		)
	} else {
		rc = sqlite3.Xsqlite3_create_window_function(
			c.tls,
			c.db,
			fun.zFuncName,
			fun.nArg,
			fun.eTextRep,
			fun.pApp,
			cFuncPointer(stepTrampoline),
			cFuncPointer(finalTrampoline),
			cFuncPointer(valueTrampoline),
			cFuncPointer(inverseTrampoline),
			0,
		)
	}

	if rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}
	return nil
}

func (c *conn) createCollationInternal(coll *collation) error {
	rc := sqlite3.Xsqlite3_create_collation_v2(
		c.tls,
		c.db,
		coll.zName,
		coll.enc,
		coll.pApp,
		cFuncPointer(collationTrampoline),
		0,
	)
	if rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}
	return nil
}

// Execer is an optional interface that may be implemented by a Conn.
//
// If a Conn does not implement Execer, the sql package's DB.Exec will first
// prepare a query, execute the statement, and then close the statement.
//
// Exec may return ErrSkip.
//
// Deprecated: Drivers should implement ExecerContext instead.
func (c *conn) Exec(query string, args []driver.Value) (dr driver.Result, err error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p, query %q, args %v: (driver.Result %p, err %v)", c, query, args, dr, err)
		}()
	}
	return c.exec(context.Background(), query, toNamedValues(args))
}

func (c *conn) exec(ctx context.Context, query string, args []driver.NamedValue) (r driver.Result, err error) {
	s, err := c.prepare(ctx, query)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err2 := s.Close(); err2 != nil && err == nil {
			err = err2
		}
	}()

	return s.(*stmt).exec(ctx, args)
}

// Prepare returns a prepared statement, bound to this connection.
func (c *conn) Prepare(query string) (ds driver.Stmt, err error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p, query %q: (driver.Stmt %p, err %v)", c, query, ds, err)
		}()
	}
	return c.prepare(context.Background(), query)
}

func (c *conn) prepare(ctx context.Context, query string) (s driver.Stmt, err error) {
	//TODO use ctx
	return newStmt(c, query)
}

// Queryer is an optional interface that may be implemented by a Conn.
//
// If a Conn does not implement Queryer, the sql package's DB.Query will first
// prepare a query, execute the statement, and then close the statement.
//
// Query may return ErrSkip.
//
// Deprecated: Drivers should implement QueryerContext instead.
func (c *conn) Query(query string, args []driver.Value) (dr driver.Rows, err error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p, query %q, args %v: (driver.Rows %p, err %v)", c, query, args, dr, err)
		}()
	}
	return c.query(context.Background(), query, toNamedValues(args))
}

func (c *conn) query(ctx context.Context, query string, args []driver.NamedValue) (r driver.Rows, err error) {
	// Use newStmt directly. c.prepare wraps this, but we need the concrete *stmt type
	// to manipulate the handle ownership below.
	s, err := newStmt(c, query)
	if err != nil {
		return nil, err
	}

	r, err = s.query(ctx, args)
	if err != nil {
		s.Close()
		return nil, err
	}

	// Fix for TestIssue118 / One-Shot Query Crash:
	// If the statement was cached (optimized path in newStmt), s.pstmt is valid.
	// s.query() sets r.reuseStmt = true by default for cached statements.
	//
	// However, since this is a transient statement created just for this query (db.Query),
	// s.Close() will be called immediately below. We must transfer ownership of the
	// sqlite statement handle to the rows object so it isn't finalized yet.
	if s.pstmt != 0 {
		// Steal the handle from the statement so s.Close() doesn't finalize it.
		s.pstmt = 0

		// Instruct rows to finalize the statement when done, rather than resetting it.
		r.(*rows).reuseStmt = false
	}

	// s.Close() now only frees the C-string allocation (psql), skipping the pstmt finalize
	// because we set s.pstmt to 0.
	if err := s.Close(); err != nil {
		r.Close()
		return nil, err
	}

	return r, nil
}

// Serialize returns a serialization of the main database. For an ordinary on-disk
// database file, the serialization is just a copy of the disk file. For an in-memory
// database or a "TEMP" database, the serialization is the same sequence of bytes
// which would be written to disk if that database where backed up to disk.
func (c *conn) Serialize() (v []byte, err error) {
	pLen := c.tls.Alloc(8)
	defer c.tls.Free(8)

	zSchema := sqlite3.Xsqlite3_db_name(c.tls, c.db, 0)
	if zSchema == 0 {
		return nil, fmt.Errorf("failed to get main db name")
	}

	pBuf := sqlite3.Xsqlite3_serialize(c.tls, c.db, zSchema, pLen, 0)
	bufLen := *(*sqlite3.Sqlite3_int64)(unsafe.Pointer(pLen))
	if pBuf != 0 {
		defer sqlite3.Xsqlite3_free(c.tls, pBuf)
	}
	if bufLen <= 0 {
		return nil, fmt.Errorf("invalid length returned: %d", bufLen)
	} else if pBuf == 0 || bufLen == 0 {
		return nil, nil
	}

	v = make([]byte, bufLen)
	copy(v, (*libc.RawMem)(unsafe.Pointer(pBuf))[:bufLen:bufLen])
	return v, nil
}

// Deserialize restore a database from the content returned by Serialize.
func (c *conn) Deserialize(buf []byte) (err error) {
	bufLen := len(buf)
	pBuf := c.tls.Alloc(bufLen) // free will be done if it fails or on close, must not be freed here

	copy((*libc.RawMem)(unsafe.Pointer(pBuf))[:bufLen:bufLen], buf)

	zSchema := sqlite3.Xsqlite3_db_name(c.tls, c.db, 0)
	if zSchema == 0 {
		return fmt.Errorf("failed to get main db name")
	}

	rc := sqlite3.Xsqlite3_deserialize(c.tls, c.db, zSchema, pBuf, int64(bufLen), int64(bufLen), sqlite3.SQLITE_DESERIALIZE_RESIZEABLE|sqlite3.SQLITE_DESERIALIZE_FREEONCLOSE)
	if rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}
	return nil
}

// NewBackup returns a Backup object that will create an online backup of
// current database to the databased pointed by the passed URI.
func (c *conn) NewBackup(dstUri string) (*Backup, error) {
	dstConn, err := newConn(dstUri)
	if err != nil {
		return nil, err
	}
	backup, err := c.backup(dstConn, false)
	if err != nil {
		dstConn.Close()
	}
	return backup, err
}

// NewRestore returns a Backup object that will restore a backup to current
// database from the databased pointed by the passed URI.
func (c *conn) NewRestore(srcUri string) (*Backup, error) {
	srcConn, err := newConn(srcUri)
	if err != nil {
		return nil, err
	}
	backup, err := c.backup(srcConn, true)
	if err != nil {
		srcConn.Close()
	}
	return backup, err
}

func (c *conn) backup(remoteConn *conn, restore bool) (_ *Backup, finalErr error) {
	srcSchema := sqlite3.Xsqlite3_db_name(c.tls, c.db, 0)
	if srcSchema == 0 {
		return nil, fmt.Errorf("failed to get main source db name")
	}

	dstSchema := sqlite3.Xsqlite3_db_name(remoteConn.tls, remoteConn.db, 0)
	if dstSchema == 0 {
		return nil, fmt.Errorf("failed to get main destination db name")
	}

	var pBackup uintptr
	if restore {
		pBackup = sqlite3.Xsqlite3_backup_init(c.tls, c.db, srcSchema, remoteConn.db, dstSchema)
	} else {
		pBackup = sqlite3.Xsqlite3_backup_init(c.tls, remoteConn.db, dstSchema, c.db, srcSchema)
	}
	if pBackup <= 0 {
		rc := sqlite3.Xsqlite3_errcode(c.tls, remoteConn.db)
		return nil, c.errstr(rc)
	}

	return &Backup{srcConn: c, dstConn: remoteConn, pBackup: pBackup}, nil
}

// C documentation
//
//	int sqlite3_limit(sqlite3*, int id, int newVal);
func (c *conn) limit(id int, newVal int) int {
	return int(sqlite3.Xsqlite3_limit(c.tls, c.db, int32(id), int32(newVal)))
}

// C documentation
//
//	int sqlite3_bind_blob(sqlite3_stmt*, int, const void*, int n, void(*)(void*));
func (c *conn) bindBlob(pstmt uintptr, idx1 int, value []byte) (uintptr, error) {
	if value == nil {
		if rc := sqlite3.Xsqlite3_bind_null(c.tls, pstmt, int32(idx1)); rc != sqlite3.SQLITE_OK {
			return 0, c.errstr(rc)
		}
		return 0, nil
	}

	p, err := c.malloc(len(value))
	if err != nil {
		return 0, err
	}
	if len(value) != 0 {
		copy((*libc.RawMem)(unsafe.Pointer(p))[:len(value):len(value)], value)
	}
	if rc := sqlite3.Xsqlite3_bind_blob(c.tls, pstmt, int32(idx1), p, int32(len(value)), 0); rc != sqlite3.SQLITE_OK {
		c.free(p)
		return 0, c.errstr(rc)
	}

	return p, nil
}

// Ping implements driver.Pinger
func (c *conn) Ping(ctx context.Context) (err error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p, ctx %p: err %v", c, ctx, err)
		}()
	}
	_, err = c.ExecContext(ctx, "select 1", nil)
	return err
}

// BeginTx implements driver.ConnBeginTx
func (c *conn) BeginTx(ctx context.Context, opts driver.TxOptions) (dt driver.Tx, err error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p, ctx %p, opts %+v: (driver.Tx %v, err %v)", c, ctx, opts, dt, err)
		}()
	}
	return c.begin(ctx, opts)
}

// PrepareContext implements driver.ConnPrepareContext
func (c *conn) PrepareContext(ctx context.Context, query string) (ds driver.Stmt, err error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p, ctx %p, query %q: (driver.Stmt %v, err %v)", c, ctx, query, ds, err)
		}()
	}
	return c.prepare(ctx, query)
}

// ExecContext implements driver.ExecerContext
func (c *conn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (dr driver.Result, err error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p, ctx %p, query %q, args %v: (driver.Result %p, err %v)", c, ctx, query, args, dr, err)
		}()
	}
	return c.exec(ctx, query, args)
}

// QueryContext implements driver.QueryerContext
func (c *conn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (dr driver.Rows, err error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p, ctx %p, query %q, args %v: (driver.Rows %p, err %v)", c, ctx, query, args, dr, err)
		}()
	}
	return c.query(ctx, query, args)
}

// IsReadOnly reports whether the database schema specified by dbName is read-only.
//
// dbName is the internal name of the attached database, not the filename.
// Use "main" for the primary database, "temp" for the temporary database,
// or the name used in an ATTACH statement.
func (c *conn) IsReadOnly(schema string) (bool, error) {
	if dmesgs {
		defer func() {
			dmesg("conn %p", c)
		}()
	}
	cs, err := libc.CString(schema)
	if err != nil {
		return false, err
	}

	defer libc.Xfree(c.tls, cs)

	switch r := sqlite3.Xsqlite3_db_readonly(c.tls, c.db, cs); r {
	case 1:
		return true, nil
	case 0:
		return false, nil
	case -1:
		return false, fmt.Errorf("not a name of a database on connection: '%s'", schema)
	default:
		return false, fmt.Errorf("unexpected sqlite3_db_readonly(%q) return value: %v", schema, r)
	}
}
