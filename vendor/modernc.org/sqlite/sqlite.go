// Copyright 2017 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:generate go run generator.go -full-path-comments

package sqlite // import "modernc.org/sqlite"

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"math"
	"math/bits"
	"net/url"
	"reflect"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"modernc.org/libc"
	"modernc.org/libc/sys/types"
	sqlite3 "modernc.org/sqlite/lib"
)

var (
	_ driver.Conn   = (*conn)(nil)
	_ driver.Driver = (*Driver)(nil)
	//lint:ignore SA1019 TODO implement ExecerContext
	_ driver.Execer = (*conn)(nil)
	//lint:ignore SA1019 TODO implement QueryerContext
	_ driver.Queryer                        = (*conn)(nil)
	_ driver.Result                         = (*result)(nil)
	_ driver.Rows                           = (*rows)(nil)
	_ driver.RowsColumnTypeDatabaseTypeName = (*rows)(nil)
	_ driver.RowsColumnTypeLength           = (*rows)(nil)
	_ driver.RowsColumnTypeNullable         = (*rows)(nil)
	_ driver.RowsColumnTypePrecisionScale   = (*rows)(nil)
	_ driver.RowsColumnTypeScanType         = (*rows)(nil)
	_ driver.Stmt                           = (*stmt)(nil)
	_ driver.Tx                             = (*tx)(nil)
	_ error                                 = (*Error)(nil)
)

const (
	driverName              = "sqlite"
	ptrSize                 = unsafe.Sizeof(uintptr(0))
	sqliteLockedSharedcache = sqlite3.SQLITE_LOCKED | (1 << 8)
)

// https://gitlab.com/cznic/sqlite/-/issues/199
func init() {
	sqlite3.PatchIssue199()
}

// Error represents sqlite library error code.
type Error struct {
	msg  string
	code int
}

// Error implements error.
func (e *Error) Error() string { return e.msg }

// Code returns the sqlite result code for this error.
func (e *Error) Code() int { return e.code }

var (
	// ErrorCodeString maps Error.Code() to its string representation.
	ErrorCodeString = map[int]string{
		sqlite3.SQLITE_ABORT:             "Callback routine requested an abort (SQLITE_ABORT)",
		sqlite3.SQLITE_AUTH:              "Authorization denied (SQLITE_AUTH)",
		sqlite3.SQLITE_BUSY:              "The database file is locked (SQLITE_BUSY)",
		sqlite3.SQLITE_CANTOPEN:          "Unable to open the database file (SQLITE_CANTOPEN)",
		sqlite3.SQLITE_CONSTRAINT:        "Abort due to constraint violation (SQLITE_CONSTRAINT)",
		sqlite3.SQLITE_CORRUPT:           "The database disk image is malformed (SQLITE_CORRUPT)",
		sqlite3.SQLITE_DONE:              "sqlite3_step() has finished executing (SQLITE_DONE)",
		sqlite3.SQLITE_EMPTY:             "Internal use only (SQLITE_EMPTY)",
		sqlite3.SQLITE_ERROR:             "Generic error (SQLITE_ERROR)",
		sqlite3.SQLITE_FORMAT:            "Not used (SQLITE_FORMAT)",
		sqlite3.SQLITE_FULL:              "Insertion failed because database is full (SQLITE_FULL)",
		sqlite3.SQLITE_INTERNAL:          "Internal logic error in SQLite (SQLITE_INTERNAL)",
		sqlite3.SQLITE_INTERRUPT:         "Operation terminated by sqlite3_interrupt()(SQLITE_INTERRUPT)",
		sqlite3.SQLITE_IOERR | (1 << 8):  "(SQLITE_IOERR_READ)",
		sqlite3.SQLITE_IOERR | (10 << 8): "(SQLITE_IOERR_DELETE)",
		sqlite3.SQLITE_IOERR | (11 << 8): "(SQLITE_IOERR_BLOCKED)",
		sqlite3.SQLITE_IOERR | (12 << 8): "(SQLITE_IOERR_NOMEM)",
		sqlite3.SQLITE_IOERR | (13 << 8): "(SQLITE_IOERR_ACCESS)",
		sqlite3.SQLITE_IOERR | (14 << 8): "(SQLITE_IOERR_CHECKRESERVEDLOCK)",
		sqlite3.SQLITE_IOERR | (15 << 8): "(SQLITE_IOERR_LOCK)",
		sqlite3.SQLITE_IOERR | (16 << 8): "(SQLITE_IOERR_CLOSE)",
		sqlite3.SQLITE_IOERR | (17 << 8): "(SQLITE_IOERR_DIR_CLOSE)",
		sqlite3.SQLITE_IOERR | (2 << 8):  "(SQLITE_IOERR_SHORT_READ)",
		sqlite3.SQLITE_IOERR | (3 << 8):  "(SQLITE_IOERR_WRITE)",
		sqlite3.SQLITE_IOERR | (4 << 8):  "(SQLITE_IOERR_FSYNC)",
		sqlite3.SQLITE_IOERR | (5 << 8):  "(SQLITE_IOERR_DIR_FSYNC)",
		sqlite3.SQLITE_IOERR | (6 << 8):  "(SQLITE_IOERR_TRUNCATE)",
		sqlite3.SQLITE_IOERR | (7 << 8):  "(SQLITE_IOERR_FSTAT)",
		sqlite3.SQLITE_IOERR | (8 << 8):  "(SQLITE_IOERR_UNLOCK)",
		sqlite3.SQLITE_IOERR | (9 << 8):  "(SQLITE_IOERR_RDLOCK)",
		sqlite3.SQLITE_IOERR:             "Some kind of disk I/O error occurred (SQLITE_IOERR)",
		sqlite3.SQLITE_LOCKED | (1 << 8): "(SQLITE_LOCKED_SHAREDCACHE)",
		sqlite3.SQLITE_LOCKED:            "A table in the database is locked (SQLITE_LOCKED)",
		sqlite3.SQLITE_MISMATCH:          "Data type mismatch (SQLITE_MISMATCH)",
		sqlite3.SQLITE_MISUSE:            "Library used incorrectly (SQLITE_MISUSE)",
		sqlite3.SQLITE_NOLFS:             "Uses OS features not supported on host (SQLITE_NOLFS)",
		sqlite3.SQLITE_NOMEM:             "A malloc() failed (SQLITE_NOMEM)",
		sqlite3.SQLITE_NOTADB:            "File opened that is not a database file (SQLITE_NOTADB)",
		sqlite3.SQLITE_NOTFOUND:          "Unknown opcode in sqlite3_file_control() (SQLITE_NOTFOUND)",
		sqlite3.SQLITE_NOTICE:            "Notifications from sqlite3_log() (SQLITE_NOTICE)",
		sqlite3.SQLITE_PERM:              "Access permission denied (SQLITE_PERM)",
		sqlite3.SQLITE_PROTOCOL:          "Database lock protocol error (SQLITE_PROTOCOL)",
		sqlite3.SQLITE_RANGE:             "2nd parameter to sqlite3_bind out of range (SQLITE_RANGE)",
		sqlite3.SQLITE_READONLY:          "Attempt to write a readonly database (SQLITE_READONLY)",
		sqlite3.SQLITE_ROW:               "sqlite3_step() has another row ready (SQLITE_ROW)",
		sqlite3.SQLITE_SCHEMA:            "The database schema changed (SQLITE_SCHEMA)",
		sqlite3.SQLITE_TOOBIG:            "String or BLOB exceeds size limit (SQLITE_TOOBIG)",
		sqlite3.SQLITE_WARNING:           "Warnings from sqlite3_log() (SQLITE_WARNING)",
	}
)

func init() {
	sql.Register(driverName, newDriver())
}

type result struct {
	lastInsertID int64
	rowsAffected int
}

func newResult(c *conn) (_ *result, err error) {
	r := &result{}
	if r.rowsAffected, err = c.changes(); err != nil {
		return nil, err
	}

	if r.lastInsertID, err = c.lastInsertRowID(); err != nil {
		return nil, err
	}

	return r, nil
}

// LastInsertId returns the database's auto-generated ID after, for example, an
// INSERT into a table with primary key.
func (r *result) LastInsertId() (int64, error) {
	if r == nil {
		return 0, nil
	}

	return r.lastInsertID, nil
}

// RowsAffected returns the number of rows affected by the query.
func (r *result) RowsAffected() (int64, error) {
	if r == nil {
		return 0, nil
	}

	return int64(r.rowsAffected), nil
}

type rows struct {
	allocs  []uintptr
	c       *conn
	columns []string
	pstmt   uintptr

	doStep bool
	empty  bool
}

func newRows(c *conn, pstmt uintptr, allocs []uintptr, empty bool) (r *rows, err error) {
	r = &rows{c: c, pstmt: pstmt, allocs: allocs, empty: empty}

	defer func() {
		if err != nil {
			r.Close()
			r = nil
		}
	}()

	n, err := c.columnCount(pstmt)
	if err != nil {
		return nil, err
	}

	r.columns = make([]string, n)
	for i := range r.columns {
		if r.columns[i], err = r.c.columnName(pstmt, i); err != nil {
			return nil, err
		}
	}

	return r, nil
}

// Close closes the rows iterator.
func (r *rows) Close() (err error) {
	for _, v := range r.allocs {
		r.c.free(v)
	}
	r.allocs = nil
	return r.c.finalize(r.pstmt)
}

// Columns returns the names of the columns. The number of columns of the
// result is inferred from the length of the slice. If a particular column name
// isn't known, an empty string should be returned for that entry.
func (r *rows) Columns() (c []string) {
	return r.columns
}

// Next is called to populate the next row of data into the provided slice. The
// provided slice will be the same size as the Columns() are wide.
//
// Next should return io.EOF when there are no more rows.
func (r *rows) Next(dest []driver.Value) (err error) {
	if r.empty {
		return io.EOF
	}

	rc := sqlite3.SQLITE_ROW
	if r.doStep {
		if rc, err = r.c.step(r.pstmt); err != nil {
			return err
		}
	}

	r.doStep = true
	switch rc {
	case sqlite3.SQLITE_ROW:
		if g, e := len(dest), len(r.columns); g != e {
			return fmt.Errorf("sqlite: Next: have %v destination values, expected %v", g, e)
		}

		for i := range dest {
			ct, err := r.c.columnType(r.pstmt, i)
			if err != nil {
				return err
			}

			switch ct {
			case sqlite3.SQLITE_INTEGER:
				v, err := r.c.columnInt64(r.pstmt, i)
				if err != nil {
					return err
				}

				if !r.c.intToTime {
					dest[i] = v
				} else {
					// Inspired by mattn/go-sqlite3:
					// https://github.com/mattn/go-sqlite3/blob/f76bae4b0044cbba8fb2c72b8e4559e8fbcffd86/sqlite3.go#L2254-L2262
					// but we put make this compatibility optional behind a DSN
					// query parameter, because this changes API behavior, so an
					// opt-in is needed.
					switch r.ColumnTypeDatabaseTypeName(i) {
					case "DATE", "DATETIME", "TIMESTAMP":
						// Is it a seconds timestamp or a milliseconds
						// timestamp?
						if v > 1e12 || v < -1e12 {
							// time.Unix expects nanoseconds, but this is a
							// milliseconds timestamp, so convert ms->ns.
							v *= int64(time.Millisecond)
							dest[i] = time.Unix(0, v).UTC()
						} else {
							dest[i] = time.Unix(v, 0)
						}
					default:
						dest[i] = v
					}
				}
			case sqlite3.SQLITE_FLOAT:
				v, err := r.c.columnDouble(r.pstmt, i)
				if err != nil {
					return err
				}

				dest[i] = v
			case sqlite3.SQLITE_TEXT:
				v, err := r.c.columnText(r.pstmt, i)
				if err != nil {
					return err
				}

				switch r.ColumnTypeDatabaseTypeName(i) {
				case "DATE", "DATETIME", "TIMESTAMP":
					dest[i], _ = r.c.parseTime(v)
				default:
					dest[i] = v
				}
			case sqlite3.SQLITE_BLOB:
				v, err := r.c.columnBlob(r.pstmt, i)
				if err != nil {
					return err
				}

				dest[i] = v
			case sqlite3.SQLITE_NULL:
				dest[i] = nil
			default:
				return fmt.Errorf("internal error: rc %d", rc)
			}
		}
		return nil
	case sqlite3.SQLITE_DONE:
		return io.EOF
	default:
		return r.c.errstr(int32(rc))
	}
}

// Inspired by mattn/go-sqlite3: https://github.com/mattn/go-sqlite3/blob/ab91e934/sqlite3.go#L210-L226
//
// These time.Parse formats handle formats 1 through 7 listed at https://www.sqlite.org/lang_datefunc.html.
var parseTimeFormats = []string{
	"2006-01-02 15:04:05.999999999-07:00",
	"2006-01-02T15:04:05.999999999-07:00",
	"2006-01-02 15:04:05.999999999",
	"2006-01-02T15:04:05.999999999",
	"2006-01-02 15:04",
	"2006-01-02T15:04",
	"2006-01-02",
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

// RowsColumnTypeDatabaseTypeName may be implemented by Rows. It should return
// the database system type name without the length. Type names should be
// uppercase. Examples of returned types: "VARCHAR", "NVARCHAR", "VARCHAR2",
// "CHAR", "TEXT", "DECIMAL", "SMALLINT", "INT", "BIGINT", "BOOL", "[]BIGINT",
// "JSONB", "XML", "TIMESTAMP".
func (r *rows) ColumnTypeDatabaseTypeName(index int) string {
	return strings.ToUpper(r.c.columnDeclType(r.pstmt, index))
}

// RowsColumnTypeLength may be implemented by Rows. It should return the length
// of the column type if the column is a variable length type. If the column is
// not a variable length type ok should return false. If length is not limited
// other than system limits, it should return math.MaxInt64. The following are
// examples of returned values for various types:
//
//	TEXT          (math.MaxInt64, true)
//	varchar(10)   (10, true)
//	nvarchar(10)  (10, true)
//	decimal       (0, false)
//	int           (0, false)
//	bytea(30)     (30, true)
func (r *rows) ColumnTypeLength(index int) (length int64, ok bool) {
	t, err := r.c.columnType(r.pstmt, index)
	if err != nil {
		return 0, false
	}

	switch t {
	case sqlite3.SQLITE_INTEGER:
		return 0, false
	case sqlite3.SQLITE_FLOAT:
		return 0, false
	case sqlite3.SQLITE_TEXT:
		return math.MaxInt64, true
	case sqlite3.SQLITE_BLOB:
		return math.MaxInt64, true
	case sqlite3.SQLITE_NULL:
		return 0, false
	default:
		return 0, false
	}
}

// RowsColumnTypeNullable may be implemented by Rows. The nullable value should
// be true if it is known the column may be null, or false if the column is
// known to be not nullable. If the column nullability is unknown, ok should be
// false.
func (r *rows) ColumnTypeNullable(index int) (nullable, ok bool) {
	return true, true
}

// RowsColumnTypePrecisionScale may be implemented by Rows. It should return
// the precision and scale for decimal types. If not applicable, ok should be
// false. The following are examples of returned values for various types:
//
//	decimal(38, 4)    (38, 4, true)
//	int               (0, 0, false)
//	decimal           (math.MaxInt64, math.MaxInt64, true)
func (r *rows) ColumnTypePrecisionScale(index int) (precision, scale int64, ok bool) {
	return 0, 0, false
}

// RowsColumnTypeScanType may be implemented by Rows. It should return the
// value type that can be used to scan types into. For example, the database
// column type "bigint" this should return "reflect.TypeOf(int64(0))".
func (r *rows) ColumnTypeScanType(index int) reflect.Type {
	t, err := r.c.columnType(r.pstmt, index)
	if err != nil {
		return reflect.TypeOf("")
	}

	switch t {
	case sqlite3.SQLITE_INTEGER:
		switch strings.ToLower(r.c.columnDeclType(r.pstmt, index)) {
		case "boolean":
			return reflect.TypeOf(false)
		case "date", "datetime", "time", "timestamp":
			return reflect.TypeOf(time.Time{})
		default:
			return reflect.TypeOf(int64(0))
		}
	case sqlite3.SQLITE_FLOAT:
		return reflect.TypeOf(float64(0))
	case sqlite3.SQLITE_TEXT:
		return reflect.TypeOf("")
	case sqlite3.SQLITE_BLOB:
		return reflect.TypeOf([]byte(nil))
	case sqlite3.SQLITE_NULL:
		return reflect.TypeOf(nil)
	default:
		return reflect.TypeOf("")
	}
}

type stmt struct {
	c    *conn
	psql uintptr
}

func newStmt(c *conn, sql string) (*stmt, error) {
	p, err := libc.CString(sql)
	if err != nil {
		return nil, err
	}
	stm := stmt{c: c, psql: p}

	return &stm, nil
}

// Close closes the statement.
//
// As of Go 1.1, a Stmt will not be closed if it's in use by any queries.
func (s *stmt) Close() (err error) {
	s.c.free(s.psql)
	s.psql = 0
	return nil
}

// Exec executes a query that doesn't return rows, such as an INSERT or UPDATE.
//
// Deprecated: Drivers should implement StmtExecContext instead (or
// additionally).
func (s *stmt) Exec(args []driver.Value) (driver.Result, error) { //TODO StmtExecContext
	return s.exec(context.Background(), toNamedValues(args))
}

// toNamedValues converts []driver.Value to []driver.NamedValue
func toNamedValues(vals []driver.Value) (r []driver.NamedValue) {
	r = make([]driver.NamedValue, len(vals))
	for i, val := range vals {
		r[i] = driver.NamedValue{Value: val, Ordinal: i + 1}
	}
	return r
}

func (s *stmt) exec(ctx context.Context, args []driver.NamedValue) (r driver.Result, err error) {
	var pstmt uintptr
	var done int32
	if ctx != nil {
		if ctxDone := ctx.Done(); ctxDone != nil {
			select {
			case <-ctxDone:
				return nil, ctx.Err()
			default:
			}
			defer interruptOnDone(ctx, s.c, &done)()
		}
	}

	defer func() {
		if ctx != nil && atomic.LoadInt32(&done) != 0 {
			r, err = nil, ctx.Err()
		}
		if pstmt != 0 {
			// ensure stmt finalized.
			e := s.c.finalize(pstmt)

			if err == nil && e != nil {
				// prioritize original
				// returned error.
				err = e
			}
		}
	}()

	for psql := s.psql; *(*byte)(unsafe.Pointer(psql)) != 0 && atomic.LoadInt32(&done) == 0; {
		if pstmt, err = s.c.prepareV2(&psql); err != nil {
			return nil, err
		}

		if pstmt == 0 {
			continue
		}
		err = func() (err error) {
			n, err := s.c.bindParameterCount(pstmt)
			if err != nil {
				return err
			}

			if n != 0 {
				allocs, err := s.c.bind(pstmt, n, args)
				if err != nil {
					return err
				}

				if len(allocs) != 0 {
					defer func() {
						for _, v := range allocs {
							s.c.free(v)
						}
					}()
				}
			}

			rc, err := s.c.step(pstmt)
			if err != nil {
				return err
			}

			switch rc & 0xff {
			case sqlite3.SQLITE_DONE, sqlite3.SQLITE_ROW:
				r, err = newResult(s.c)
			default:
				return s.c.errstr(int32(rc))
			}

			return nil
		}()

		e := s.c.finalize(pstmt)
		pstmt = 0 // done with

		if err == nil && e != nil {
			// prioritize original
			// returned error.
			err = e
		}

		if err != nil {
			return nil, err
		}
	}
	return r, err
}

// NumInput returns the number of placeholder parameters.
//
// If NumInput returns >= 0, the sql package will sanity check argument counts
// from callers and return errors to the caller before the statement's Exec or
// Query methods are called.
//
// NumInput may also return -1, if the driver doesn't know its number of
// placeholders. In that case, the sql package will not sanity check Exec or
// Query argument counts.
func (s *stmt) NumInput() (n int) {
	return -1
}

// Query executes a query that may return rows, such as a
// SELECT.
//
// Deprecated: Drivers should implement StmtQueryContext instead (or
// additionally).
func (s *stmt) Query(args []driver.Value) (driver.Rows, error) { //TODO StmtQueryContext
	return s.query(context.Background(), toNamedValues(args))
}

func (s *stmt) query(ctx context.Context, args []driver.NamedValue) (r driver.Rows, err error) {
	var pstmt uintptr
	var done int32
	if ctx != nil {
		if ctxDone := ctx.Done(); ctxDone != nil {
			select {
			case <-ctxDone:
				return nil, ctx.Err()
			default:
			}
			defer interruptOnDone(ctx, s.c, &done)()
		}
	}

	var allocs []uintptr

	defer func() {
		if ctx != nil && atomic.LoadInt32(&done) != 0 {
			if r != nil {
				r.Close()
			}
			r, err = nil, ctx.Err()
		} else if r == nil && err == nil {
			r, err = newRows(s.c, pstmt, allocs, true)
		}

		if pstmt != 0 {
			// ensure stmt finalized.
			e := s.c.finalize(pstmt)

			if err == nil && e != nil {
				// prioritize original
				// returned error.
				err = e
			}
		}

	}()

	for psql := s.psql; *(*byte)(unsafe.Pointer(psql)) != 0 && atomic.LoadInt32(&done) == 0; {
		if pstmt, err = s.c.prepareV2(&psql); err != nil {
			return nil, err
		}

		if pstmt == 0 {
			continue
		}

		err = func() (err error) {
			n, err := s.c.bindParameterCount(pstmt)
			if err != nil {
				return err
			}

			if n != 0 {
				if allocs, err = s.c.bind(pstmt, n, args); err != nil {
					return err
				}
			}

			rc, err := s.c.step(pstmt)
			if err != nil {
				return err
			}

			switch rc & 0xff {
			case sqlite3.SQLITE_ROW:
				if r != nil {
					r.Close()
				}
				if r, err = newRows(s.c, pstmt, allocs, false); err != nil {
					return err
				}

				pstmt = 0
				return nil
			case sqlite3.SQLITE_DONE:
				if r == nil {
					if r, err = newRows(s.c, pstmt, allocs, true); err != nil {
						return err
					}
					pstmt = 0
					return nil
				}

				// nop
			default:
				return s.c.errstr(int32(rc))
			}

			if *(*byte)(unsafe.Pointer(psql)) == 0 {
				if r != nil {
					r.Close()
				}
				if r, err = newRows(s.c, pstmt, allocs, true); err != nil {
					return err
				}

				pstmt = 0
			}
			return nil
		}()

		e := s.c.finalize(pstmt)
		pstmt = 0 // done with

		if err == nil && e != nil {
			// prioritize original
			// returned error.
			err = e
		}

		if err != nil {
			return nil, err
		}
	}
	return r, err
}

type tx struct {
	c *conn
}

func newTx(ctx context.Context, c *conn, opts driver.TxOptions) (*tx, error) {
	r := &tx{c: c}

	sql := "begin"
	if !opts.ReadOnly && c.beginMode != "" {
		sql = "begin " + c.beginMode
	}

	if err := r.exec(ctx, sql); err != nil {
		return nil, err
	}

	return r, nil
}

// Commit implements driver.Tx.
func (t *tx) Commit() (err error) {
	return t.exec(context.Background(), "commit")
}

// Rollback implements driver.Tx.
func (t *tx) Rollback() (err error) {
	return t.exec(context.Background(), "rollback")
}

func (t *tx) exec(ctx context.Context, sql string) (err error) {
	psql, err := libc.CString(sql)
	if err != nil {
		return err
	}

	defer t.c.free(psql)
	//TODO use t.conn.ExecContext() instead

	if ctx != nil && ctx.Done() != nil {
		defer interruptOnDone(ctx, t.c, nil)()
	}

	if rc := sqlite3.Xsqlite3_exec(t.c.tls, t.c.db, psql, 0, 0, 0); rc != sqlite3.SQLITE_OK {
		return t.c.errstr(rc)
	}

	return nil
}

// interruptOnDone sets up a goroutine to interrupt the provided db when the
// context is canceled, and returns a function the caller must defer so it
// doesn't interrupt after the caller finishes.
func interruptOnDone(
	ctx context.Context,
	c *conn,
	done *int32,
) func() {
	if done == nil {
		var d int32
		done = &d
	}

	donech := make(chan struct{})

	go func() {
		select {
		case <-ctx.Done():
			// don't call interrupt if we were already done: it indicates that this
			// call to exec is no longer running and we would be interrupting
			// nothing, or even possibly an unrelated later call to exec.
			if atomic.AddInt32(done, 1) == 1 {
				c.interrupt(c.db)
			}
		case <-donech:
		}
	}()

	// the caller is expected to defer this function
	return func() {
		// set the done flag so that a context cancellation right after the caller
		// returns doesn't trigger a call to interrupt for some other statement.
		atomic.AddInt32(done, 1)
		close(donech)
	}
}

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

func getVFSName(query string) (r string, err error) {
	q, err := url.ParseQuery(query)
	if err != nil {
		return "", err
	}

	for _, v := range q["vfs"] {
		if r != "" && r != v {
			return "", fmt.Errorf("conflicting vfs query parameters: %v", q["vfs"])
		}

		r = v
	}

	return r, nil
}

func applyQueryParams(c *conn, query string) error {
	q, err := url.ParseQuery(query)
	if err != nil {
		return err
	}

	var a []string
	for _, v := range q["_pragma"] {
		a = append(a, v)
	}
	// Push 'busy_timeout' first, the rest in lexicographic order, case insenstive.
	// See https://gitlab.com/cznic/sqlite/-/issues/198#note_2233423463 for
	// discussion.
	sort.Slice(a, func(i, j int) bool {
		x, y := strings.TrimSpace(strings.ToLower(a[i])), strings.TrimSpace(strings.ToLower(a[j]))
		if strings.HasPrefix(x, "busy_timeout") {
			return true
		}
		if strings.HasPrefix(y, "busy_timeout") {
			return false
		}

		return x < y
	})
	for _, v := range a {
		cmd := "pragma " + v
		_, err := c.exec(context.Background(), cmd, nil)
		if err != nil {
			return err
		}
	}

	if v := q.Get("_time_format"); v != "" {
		f, ok := writeTimeFormats[v]
		if !ok {
			return fmt.Errorf("unknown _time_format %q", v)
		}
		c.writeTimeFormat = f
	}
	if v := q.Get("_time_integer_format"); v != "" {
		switch v {
		case "unix":
		case "unix_milli":
		case "unix_micro":
		case "unix_nano":
		default:
			return fmt.Errorf("unknown _time_integer_format %q", v)
		}
		c.integerTimeFormat = v
	}

	if v := q.Get("_txlock"); v != "" {
		lower := strings.ToLower(v)
		if lower != "deferred" && lower != "immediate" && lower != "exclusive" {
			return fmt.Errorf("unknown _txlock %q", v)
		}
		c.beginMode = v
	}

	if v := q.Get("_inttotime"); v != "" {
		onoff, err := strconv.ParseBool(v)
		if err != nil {
			return fmt.Errorf("unknown _inttotime %q, must be 1, t, T, TRUE, true, True, 0, f, F, FALSE, false, False",
				v)
		}
		c.intToTime = onoff
	}

	return nil
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

func unlockNotify(t *libc.TLS, ppArg uintptr, nArg int32) {
	for i := int32(0); i < nArg; i++ {
		mu := *(*uintptr)(unsafe.Pointer(ppArg))
		(*mutex)(unsafe.Pointer(mu)).Unlock()
		ppArg += ptrSize
	}
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

// FunctionImpl describes an [application-defined SQL function]. If Scalar is
// set, it is treated as a scalar function; otherwise, it is treated as an
// aggregate function using MakeAggregate.
//
// [application-defined SQL function]: https://sqlite.org/appfunc.html
type FunctionImpl struct {
	// NArgs is the required number of arguments that the function accepts.
	// If NArgs is negative, then the function is variadic.
	NArgs int32

	// If Deterministic is true, the function must always give the same
	// output when the input parameters are the same. This enables functions
	// to be used in additional contexts like the WHERE clause of partial
	// indexes and enables additional optimizations.
	//
	// See https://sqlite.org/c3ref/c_deterministic.html#sqlitedeterministic
	// for more details.
	Deterministic bool

	// Scalar is called when a scalar function is invoked in SQL. The
	// argument Values are not valid past the return of the function.
	Scalar func(ctx *FunctionContext, args []driver.Value) (driver.Value, error)

	// MakeAggregate is called at the beginning of each evaluation of an
	// aggregate function.
	MakeAggregate func(ctx FunctionContext) (AggregateFunction, error)
}

// An AggregateFunction is an invocation of an aggregate or window function. See
// the documentation for [aggregate function callbacks] and [application-defined
// window functions] for an overview.
//
// [aggregate function callbacks]: https://www.sqlite.org/appfunc.html#the_aggregate_function_callbacks
// [application-defined window functions]: https://www.sqlite.org/windowfunctions.html#user_defined_aggregate_window_functions
type AggregateFunction interface {
	// Step is called for each row of an aggregate function's SQL
	// invocation. The argument Values are not valid past the return of the
	// function.
	Step(ctx *FunctionContext, rowArgs []driver.Value) error

	// WindowInverse is called to remove the oldest presently aggregated
	// result of Step from the current window. The arguments are those
	// passed to Step for the row being removed. The argument Values are not
	// valid past the return of the function.
	WindowInverse(ctx *FunctionContext, rowArgs []driver.Value) error

	// WindowValue is called to get the current value of an aggregate
	// function. This is used to return the final value of the function,
	// whether it is used as a window function or not.
	WindowValue(ctx *FunctionContext) (driver.Value, error)

	// Final is called after all of the aggregate function's input rows have
	// been stepped through. No other methods will be called on the
	// AggregateFunction after calling Final. WindowValue returns the value
	// from the function.
	Final(ctx *FunctionContext)
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

type collation struct {
	zName uintptr
	pApp  uintptr
	enc   int32
}

// RegisterCollationUtf8 makes a Go function available as a collation named zName.
// impl receives two UTF-8 strings: left and right.
// The result needs to be:
//
// - 0 if left == right
// - 1 if left < right
// - +1 if left > right
//
// impl must always return the same result given the same inputs.
// Additionally, it must have the following properties for all strings A, B and C:
// - if A==B, then B==A
// - if A==B and B==C, then A==C
// - if A<B, then B>A
// - if A<B and B<C, then A<C.
//
// The new collation will be available to all new connections opened after
// executing RegisterCollationUtf8.
func RegisterCollationUtf8(
	zName string,
	impl func(left, right string) int,
) error {
	return registerCollation(zName, impl, sqlite3.SQLITE_UTF8)
}

// MustRegisterCollationUtf8 is like RegisterCollationUtf8 but panics on error.
func MustRegisterCollationUtf8(
	zName string,
	impl func(left, right string) int,
) {
	if err := RegisterCollationUtf8(zName, impl); err != nil {
		panic(err)
	}
}

func registerCollation(
	zName string,
	impl func(left, right string) int,
	enc int32,
) error {
	if _, ok := d.collations[zName]; ok {
		return fmt.Errorf("a collation %q is already registered", zName)
	}

	// dont free, collations registered on the driver live as long as the program
	name, err := libc.CString(zName)
	if err != nil {
		return err
	}

	xCollations.mu.Lock()
	id := xCollations.ids.next()
	xCollations.m[id] = impl
	xCollations.mu.Unlock()

	d.collations[zName] = &collation{
		zName: name,
		pApp:  id,
		enc:   enc,
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
	s, err := c.prepare(ctx, query)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err2 := s.Close(); err2 != nil && err == nil {
			err = err2
		}
	}()

	return s.(*stmt).query(ctx, args)
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

// Backup object is used to manage progress and cleanup an online backup. It
// is returned by NewBackup or NewRestore.
type Backup struct {
	srcConn *conn   // source database connection
	dstConn *conn   // destination database connection
	pBackup uintptr // sqlite3_backup object pointer
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

// Step will copy up to n pages between the source and destination databases
// specified by the backup object. If n is negative, all remaining source
// pages are copied.
// If it successfully copies n pages and there are still more pages to be
// copied, then the function returns true with no error. If it successfully
// finishes copying all pages from source to destination, then it returns
// false with no error. If an error occurs while running, then an error is
// returned.
func (b *Backup) Step(n int32) (bool, error) {
	rc := sqlite3.Xsqlite3_backup_step(b.srcConn.tls, b.pBackup, n)
	if rc == sqlite3.SQLITE_OK {
		return true, nil
	} else if rc == sqlite3.SQLITE_DONE {
		return false, nil
	} else {
		return false, b.srcConn.errstr(rc)
	}
}

// Finish releases all resources associated with the Backup object. The Backup
// object is invalid and may not be used following a call to Finish.
func (b *Backup) Finish() error {
	rc := sqlite3.Xsqlite3_backup_finish(b.srcConn.tls, b.pBackup)
	b.dstConn.Close()
	if rc == sqlite3.SQLITE_OK {
		return nil
	} else {
		return b.srcConn.errstr(rc)
	}
}

type ExecQuerierContext interface {
	driver.ExecerContext
	driver.QueryerContext
}

type HookRegisterer interface {
	RegisterPreUpdateHook(PreUpdateHookFn)
	RegisterCommitHook(CommitHookFn)
	RegisterRollbackHook(RollbackHookFn)
}

// Commit releases all resources associated with the Backup object but does not
// close the destination database connection.
//
// The destination database connection is returned to the caller or an error if raised.
// It is the responsibility of the caller to handle the connection closure.
func (b *Backup) Commit() (driver.Conn, error) {
	rc := sqlite3.Xsqlite3_backup_finish(b.srcConn.tls, b.pBackup)

	if rc == sqlite3.SQLITE_OK {
		return b.dstConn, nil
	} else {
		return nil, b.srcConn.errstr(rc)
	}
}

// ConnectionHookFn function type for a connection hook on the Driver. Connection
// hooks are called after the connection has been set up.
type ConnectionHookFn func(
	conn ExecQuerierContext,
	dsn string,
) error

// Driver implements database/sql/driver.Driver.
type Driver struct {
	// user defined functions that are added to every new connection on Open
	udfs map[string]*userDefinedFunction
	// collations that are added to every new connection on Open
	collations map[string]*collation
	// connection hooks are called after a connection is opened
	connectionHooks []ConnectionHookFn
}

var d = &Driver{
	udfs:            make(map[string]*userDefinedFunction, 0),
	collations:      make(map[string]*collation, 0),
	connectionHooks: make([]ConnectionHookFn, 0),
}

func newDriver() *Driver { return d }

// Open returns a new connection to the database. The name is a string in a
// driver-specific format.
//
// Open may return a cached connection (one previously closed), but doing so is
// unnecessary; the sql package maintains a pool of idle connections for
// efficient re-use.
//
// The returned connection is only used by one goroutine at a time.
//
// The name may be a filename, e.g., "/tmp/mydata.sqlite", or a URI, in which
// case it may include a '?' followed by one or more query parameters.
// For example, "file:///tmp/mydata.sqlite?_pragma=foreign_keys(1)&_time_format=sqlite".
// The supported query parameters are:
//
// _pragma: Each value will be run as a "PRAGMA ..." statement (with the PRAGMA
// keyword added for you). May be specified more than once, '&'-separated. For more
// information on supported PRAGMAs see: https://www.sqlite.org/pragma.html
//
// _time_format: The name of a format to use when writing time values to the
// database. Currently the only supported value is "sqlite", which corresponds
// to format 7 from https://www.sqlite.org/lang_datefunc.html#time_values,
// including the timezone specifier. If this parameter is not specified, then
// the default String() format will be used.
//
// _time_integer_format: The name of a integer format to use when writing time values.
// By default, the time is stored as string and the format can be set with _time_format
// parameter. If _time_integer_format is set, the time will be stored as an integer and
// the integer value will depend on the integer format.
// If you decide to set both _time_format and _time_integer_format, the time will be
// converted as integer and the _time_format value will be ignored.
// Currently the supported value are "unix","unix_milli", "unix_micro" and "unix_nano",
// which corresponds to seconds, milliseconds, microseconds or nanoseconds
// since unixepoch (1 January 1970 00:00:00 UTC).
//
// _inttotime: Enable conversion of time column (DATE, DATETIME,TIMESTAMP) from integer
// to time if the field contain integer (int64).
//
// _txlock: The locking behavior to use when beginning a transaction. May be
// "deferred" (the default), "immediate", or "exclusive" (case insensitive). See:
// https://www.sqlite.org/lang_transaction.html#deferred_immediate_and_exclusive_transactions
func (d *Driver) Open(name string) (conn driver.Conn, err error) {
	if dmesgs {
		defer func() {
			dmesg("name %q: (driver.Conn %p, err %v)", name, conn, err)
		}()
	}
	c, err := newConn(name)
	if err != nil {
		return nil, err
	}

	for _, udf := range d.udfs {
		if err = c.createFunctionInternal(udf); err != nil {
			c.Close()
			return nil, err
		}
	}
	for _, coll := range d.collations {
		if err = c.createCollationInternal(coll); err != nil {
			c.Close()
			return nil, err
		}
	}
	for _, connHookFn := range d.connectionHooks {
		if err = connHookFn(c, name); err != nil {
			c.Close()
			return nil, fmt.Errorf("connection hook: %w", err)
		}
	}
	return c, nil
}

// FunctionContext represents the context user defined functions execute in.
// Fields and/or methods of this type may get addedd in the future.
type FunctionContext struct {
	tls *libc.TLS
	ctx uintptr
}

const sqliteValPtrSize = unsafe.Sizeof(&sqlite3.Sqlite3_value{})

// RegisterFunction registers a function named zFuncName with nArg arguments.
// Passing -1 for nArg indicates the function is variadic. The FunctionImpl
// determines whether the function is deterministic or not, and whether it is a
// scalar function (when Scalar is defined) or an aggregate function (when
// Scalar is not defined and MakeAggregate is defined).
//
// The new function will be available to all new connections opened after
// executing RegisterFunction.
func RegisterFunction(
	zFuncName string,
	impl *FunctionImpl,
) error {
	return registerFunction(zFuncName, impl)
}

// MustRegisterFunction is like RegisterFunction but panics on error.
func MustRegisterFunction(
	zFuncName string,
	impl *FunctionImpl,
) {
	if err := RegisterFunction(zFuncName, impl); err != nil {
		panic(err)
	}
}

// RegisterScalarFunction registers a scalar function named zFuncName with nArg
// arguments. Passing -1 for nArg indicates the function is variadic.
//
// The new function will be available to all new connections opened after
// executing RegisterScalarFunction.
func RegisterScalarFunction(
	zFuncName string,
	nArg int32,
	xFunc func(ctx *FunctionContext, args []driver.Value) (driver.Value, error),
) (err error) {
	if dmesgs {
		defer func() {
			dmesg("zFuncName %q, nArg %v, xFunc %p: err %v", zFuncName, nArg, xFunc, err)
		}()
	}
	return registerFunction(zFuncName, &FunctionImpl{NArgs: nArg, Scalar: xFunc, Deterministic: false})
}

// MustRegisterScalarFunction is like RegisterScalarFunction but panics on
// error.
func MustRegisterScalarFunction(
	zFuncName string,
	nArg int32,
	xFunc func(ctx *FunctionContext, args []driver.Value) (driver.Value, error),
) {
	if dmesgs {
		dmesg("zFuncName %q, nArg %v, xFunc %p", zFuncName, nArg, xFunc)
	}
	if err := RegisterScalarFunction(zFuncName, nArg, xFunc); err != nil {
		panic(err)
	}
}

// MustRegisterDeterministicScalarFunction is like
// RegisterDeterministicScalarFunction but panics on error.
func MustRegisterDeterministicScalarFunction(
	zFuncName string,
	nArg int32,
	xFunc func(ctx *FunctionContext, args []driver.Value) (driver.Value, error),
) {
	if dmesgs {
		dmesg("zFuncName %q, nArg %v, xFunc %p", zFuncName, nArg, xFunc)
	}
	if err := RegisterDeterministicScalarFunction(zFuncName, nArg, xFunc); err != nil {
		panic(err)
	}
}

// RegisterDeterministicScalarFunction registers a deterministic scalar
// function named zFuncName with nArg arguments. Passing -1 for nArg indicates
// the function is variadic. A deterministic function means that the function
// always gives the same output when the input parameters are the same.
//
// The new function will be available to all new connections opened after
// executing RegisterDeterministicScalarFunction.
func RegisterDeterministicScalarFunction(
	zFuncName string,
	nArg int32,
	xFunc func(ctx *FunctionContext, args []driver.Value) (driver.Value, error),
) (err error) {
	if dmesgs {
		defer func() {
			dmesg("zFuncName %q, nArg %v, xFunc %p: err %v", zFuncName, nArg, xFunc, err)
		}()
	}
	return registerFunction(zFuncName, &FunctionImpl{NArgs: nArg, Scalar: xFunc, Deterministic: true})
}

func registerFunction(
	zFuncName string,
	impl *FunctionImpl,
) error {

	if _, ok := d.udfs[zFuncName]; ok {
		return fmt.Errorf("a function named %q is already registered", zFuncName)
	}

	// dont free, functions registered on the driver live as long as the program
	name, err := libc.CString(zFuncName)
	if err != nil {
		return err
	}

	var textrep int32 = sqlite3.SQLITE_UTF8

	if impl.Deterministic {
		textrep |= sqlite3.SQLITE_DETERMINISTIC
	}

	udf := &userDefinedFunction{
		zFuncName: name,
		nArg:      impl.NArgs,
		eTextRep:  textrep,
	}

	if impl.Scalar != nil {
		xFuncs.mu.Lock()
		id := xFuncs.ids.next()
		xFuncs.m[id] = impl.Scalar
		xFuncs.mu.Unlock()

		udf.scalar = true
		udf.pApp = id
	} else {
		xAggregateFactories.mu.Lock()
		id := xAggregateFactories.ids.next()
		xAggregateFactories.m[id] = impl.MakeAggregate
		xAggregateFactories.mu.Unlock()

		udf.pApp = id
	}

	d.udfs[zFuncName] = udf

	return nil
}

// RegisterConnectionHook registers a function to be called after each connection
// is opened. This is called after all the connection has been set up.
func (d *Driver) RegisterConnectionHook(fn ConnectionHookFn) {
	d.connectionHooks = append(d.connectionHooks, fn)
}

// RegisterConnectionHook registers a function to be called after each connection
// is opened. This is called after all the connection has been set up.
func RegisterConnectionHook(fn ConnectionHookFn) {
	d.RegisterConnectionHook(fn)
}

func origin(skip int) string {
	pc, fn, fl, _ := runtime.Caller(skip)
	f := runtime.FuncForPC(pc)
	var fns string
	if f != nil {
		fns = f.Name()
		if x := strings.LastIndex(fns, "."); x > 0 {
			fns = fns[x+1:]
		}
	}
	return fmt.Sprintf("%s:%d:%s", fn, fl, fns)
}

func errorResultFunction(tls *libc.TLS, ctx uintptr) func(error) {
	return func(res error) {
		errmsg, cerr := libc.CString(res.Error())
		if cerr != nil {
			panic(cerr)
		}
		defer libc.Xfree(tls, errmsg)
		sqlite3.Xsqlite3_result_error(tls, ctx, errmsg, -1)
		sqlite3.Xsqlite3_result_error_code(tls, ctx, sqlite3.SQLITE_ERROR)
	}
}

func functionArgs(tls *libc.TLS, argc int32, argv uintptr) []driver.Value {
	args := make([]driver.Value, argc)
	for i := int32(0); i < argc; i++ {
		valPtr := *(*uintptr)(unsafe.Pointer(argv + uintptr(i)*sqliteValPtrSize))

		switch valType := sqlite3.Xsqlite3_value_type(tls, valPtr); valType {
		case sqlite3.SQLITE_TEXT:
			args[i] = libc.GoString(sqlite3.Xsqlite3_value_text(tls, valPtr))
		case sqlite3.SQLITE_INTEGER:
			args[i] = sqlite3.Xsqlite3_value_int64(tls, valPtr)
		case sqlite3.SQLITE_FLOAT:
			args[i] = sqlite3.Xsqlite3_value_double(tls, valPtr)
		case sqlite3.SQLITE_NULL:
			args[i] = nil
		case sqlite3.SQLITE_BLOB:
			size := sqlite3.Xsqlite3_value_bytes(tls, valPtr)
			blobPtr := sqlite3.Xsqlite3_value_blob(tls, valPtr)
			v := make([]byte, size)
			if size != 0 {
				copy(v, (*libc.RawMem)(unsafe.Pointer(blobPtr))[:size:size])
			}
			args[i] = v
		default:
			panic(fmt.Sprintf("unexpected argument type %q passed by sqlite", valType))
		}
	}

	return args
}

func functionReturnValue(tls *libc.TLS, ctx uintptr, res driver.Value) error {
	switch resTyped := res.(type) {
	case nil:
		sqlite3.Xsqlite3_result_null(tls, ctx)
	case int64:
		sqlite3.Xsqlite3_result_int64(tls, ctx, resTyped)
	case float64:
		sqlite3.Xsqlite3_result_double(tls, ctx, resTyped)
	case bool:
		sqlite3.Xsqlite3_result_int(tls, ctx, libc.Bool32(resTyped))
	case time.Time:
		sqlite3.Xsqlite3_result_int64(tls, ctx, resTyped.Unix())
	case string:
		size := int32(len(resTyped))
		cstr, err := libc.CString(resTyped)
		if err != nil {
			panic(err)
		}
		defer libc.Xfree(tls, cstr)
		sqlite3.Xsqlite3_result_text(tls, ctx, cstr, size, sqlite3.SQLITE_TRANSIENT)
	case []byte:
		size := int32(len(resTyped))
		if size == 0 {
			sqlite3.Xsqlite3_result_zeroblob(tls, ctx, 0)
			return nil
		}
		p := libc.Xmalloc(tls, types.Size_t(size))
		if p == 0 {
			panic(fmt.Sprintf("unable to allocate space for blob: %d", size))
		}
		defer libc.Xfree(tls, p)
		copy((*libc.RawMem)(unsafe.Pointer(p))[:size:size], resTyped)

		sqlite3.Xsqlite3_result_blob(tls, ctx, p, size, sqlite3.SQLITE_TRANSIENT)
	default:
		return fmt.Errorf("function did not return a valid driver.Value: %T", resTyped)
	}

	return nil
}

// The below is all taken from zombiezen.com/go/sqlite. Aggregate functions need
// to maintain state (for instance, the count of values seen so far). We give
// each aggregate function an ID, generated by idGen, and put that in the pApp
// argument to sqlite3_create_function. We track this on the Go side in
// xAggregateFactories.
//
// When (if) the function is called is called by a query, we call the
// MakeAggregate factory function to set it up, and track that in
// xAggregateContext, retrieving it via sqlite3_aggregate_context.
//
// We also need to ensure that, for both aggregate and scalar functions, the
// function pointer we pass to SQLite meets certain rules on the Go side, so
// that the pointer remains valid.
var (
	xFuncs = struct {
		mu  sync.RWMutex
		m   map[uintptr]func(*FunctionContext, []driver.Value) (driver.Value, error)
		ids idGen
	}{
		m: make(map[uintptr]func(*FunctionContext, []driver.Value) (driver.Value, error)),
	}

	xAggregateFactories = struct {
		mu  sync.RWMutex
		m   map[uintptr]func(FunctionContext) (AggregateFunction, error)
		ids idGen
	}{
		m: make(map[uintptr]func(FunctionContext) (AggregateFunction, error)),
	}

	xAggregateContext = struct {
		mu  sync.RWMutex
		m   map[uintptr]AggregateFunction
		ids idGen
	}{
		m: make(map[uintptr]AggregateFunction),
	}

	xCollations = struct {
		mu  sync.RWMutex
		m   map[uintptr]func(string, string) int
		ids idGen
	}{
		m: make(map[uintptr]func(string, string) int),
	}
)

type idGen struct {
	bitset []uint64
}

func (gen *idGen) next() uintptr {
	base := uintptr(1)
	for i := 0; i < len(gen.bitset); i, base = i+1, base+64 {
		b := gen.bitset[i]
		if b != 1<<64-1 {
			n := uintptr(bits.TrailingZeros64(^b))
			gen.bitset[i] |= 1 << n
			return base + n
		}
	}
	gen.bitset = append(gen.bitset, 1)
	return base
}

func (gen *idGen) reclaim(id uintptr) {
	bit := id - 1
	gen.bitset[bit/64] &^= 1 << (bit % 64)
}

func makeAggregate(tls *libc.TLS, ctx uintptr) (AggregateFunction, uintptr) {
	goCtx := FunctionContext{tls: tls, ctx: ctx}
	aggCtx := (*uintptr)(unsafe.Pointer(sqlite3.Xsqlite3_aggregate_context(tls, ctx, int32(ptrSize))))
	setErrorResult := errorResultFunction(tls, ctx)
	if aggCtx == nil {
		setErrorResult(errors.New("insufficient memory for aggregate"))
		return nil, 0
	}
	if *aggCtx != 0 {
		// Already created.
		xAggregateContext.mu.RLock()
		f := xAggregateContext.m[*aggCtx]
		xAggregateContext.mu.RUnlock()
		return f, *aggCtx
	}

	factoryID := sqlite3.Xsqlite3_user_data(tls, ctx)
	xAggregateFactories.mu.RLock()
	factory := xAggregateFactories.m[factoryID]
	xAggregateFactories.mu.RUnlock()

	f, err := factory(goCtx)
	if err != nil {
		setErrorResult(err)
		return nil, 0
	}
	if f == nil {
		setErrorResult(errors.New("MakeAggregate function returned nil"))
		return nil, 0
	}

	xAggregateContext.mu.Lock()
	*aggCtx = xAggregateContext.ids.next()
	xAggregateContext.m[*aggCtx] = f
	xAggregateContext.mu.Unlock()
	return f, *aggCtx
}

// cFuncPointer converts a function defined by a function declaration to a C pointer.
// The result of using cFuncPointer on closures is undefined.
func cFuncPointer[T any](f T) uintptr {
	// This assumes the memory representation described in https://golang.org/s/go11func.
	//
	// cFuncPointer does its conversion by doing the following in order:
	// 1) Create a Go struct containing a pointer to a pointer to
	//    the function. It is assumed that the pointer to the function will be
	//    stored in the read-only data section and thus will not move.
	// 2) Convert the pointer to the Go struct to a pointer to uintptr through
	//    unsafe.Pointer. This is permitted via Rule #1 of unsafe.Pointer.
	// 3) Dereference the pointer to uintptr to obtain the function value as a
	//    uintptr. This is safe as long as function values are passed as pointers.
	return *(*uintptr)(unsafe.Pointer(&struct{ f T }{f}))
}

func funcTrampoline(tls *libc.TLS, ctx uintptr, argc int32, argv uintptr) {
	id := sqlite3.Xsqlite3_user_data(tls, ctx)
	xFuncs.mu.RLock()
	xFunc := xFuncs.m[id]
	xFuncs.mu.RUnlock()

	setErrorResult := errorResultFunction(tls, ctx)
	res, err := xFunc(&FunctionContext{}, functionArgs(tls, argc, argv))

	if err != nil {
		setErrorResult(err)
		return
	}

	err = functionReturnValue(tls, ctx, res)
	if err != nil {
		setErrorResult(err)
	}
}

func stepTrampoline(tls *libc.TLS, ctx uintptr, argc int32, argv uintptr) {
	impl, _ := makeAggregate(tls, ctx)
	if impl == nil {
		return
	}

	setErrorResult := errorResultFunction(tls, ctx)
	err := impl.Step(&FunctionContext{}, functionArgs(tls, argc, argv))
	if err != nil {
		setErrorResult(err)
	}
}

func inverseTrampoline(tls *libc.TLS, ctx uintptr, argc int32, argv uintptr) {
	impl, _ := makeAggregate(tls, ctx)
	if impl == nil {
		return
	}

	setErrorResult := errorResultFunction(tls, ctx)
	err := impl.WindowInverse(&FunctionContext{}, functionArgs(tls, argc, argv))
	if err != nil {
		setErrorResult(err)
	}
}

func valueTrampoline(tls *libc.TLS, ctx uintptr) {
	impl, _ := makeAggregate(tls, ctx)
	if impl == nil {
		return
	}

	setErrorResult := errorResultFunction(tls, ctx)
	res, err := impl.WindowValue(&FunctionContext{})
	if err != nil {
		setErrorResult(err)
	} else {
		err = functionReturnValue(tls, ctx, res)
		if err != nil {
			setErrorResult(err)
		}
	}
}

func finalTrampoline(tls *libc.TLS, ctx uintptr) {
	impl, id := makeAggregate(tls, ctx)
	if impl == nil {
		return
	}

	setErrorResult := errorResultFunction(tls, ctx)
	res, err := impl.WindowValue(&FunctionContext{})
	if err != nil {
		setErrorResult(err)
	} else {
		err = functionReturnValue(tls, ctx, res)
		if err != nil {
			setErrorResult(err)
		}
	}
	impl.Final(&FunctionContext{})

	xAggregateContext.mu.Lock()
	defer xAggregateContext.mu.Unlock()
	delete(xAggregateContext.m, id)
	xAggregateContext.ids.reclaim(id)
}

func collationTrampoline(tls *libc.TLS, pApp uintptr, nLeft int32, zLeft uintptr, nRight int32, zRight uintptr) int32 {
	xCollations.mu.RLock()
	xCollation := xCollations.m[pApp]
	xCollations.mu.RUnlock()

	left := string(libc.GoBytes(zLeft, int(nLeft)))
	right := string(libc.GoBytes(zRight, int(nRight)))

	// res is of type int, which can be 64-bit wide
	// Since we just need to know if the value is positive, negative, or zero, we can ensure it's -1, 0, +1
	res := xCollation(left, right)
	switch {
	case res < 0:
		return -1
	case res == 0:
		return 0
	case res > 0:
		return 1
	default:
		// Should never hit here, make the compiler happy
		return 0
	}
}

// C documentation
//
//	int sqlite3_limit(sqlite3*, int id, int newVal);
func (c *conn) limit(id int, newVal int) int {
	return int(sqlite3.Xsqlite3_limit(c.tls, c.db, int32(id), int32(newVal)))
}

// Limit calls sqlite3_limit, see the docs at
// https://www.sqlite.org/c3ref/limit.html for details.
//
// To get a sql.Conn from a *sql.DB, use (*sql.DB).Conn().  Limits are bound to
// the particular instance of 'c', so getting a new connection only to pass it
// to Limit is possibly not useful above querying what are the various
// configured default values.
func Limit(c *sql.Conn, id int, newVal int) (r int, err error) {
	err = c.Raw(func(driverConn any) error {
		switch dc := driverConn.(type) {
		case *conn:
			r = dc.limit(id, newVal)
			return nil
		default:
			return fmt.Errorf("unexpected driverConn type: %T", driverConn)
		}
	})
	return r, err

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
