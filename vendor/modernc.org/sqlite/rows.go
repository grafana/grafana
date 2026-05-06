// Copyright 2025 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlite // import "modernc.org/sqlite"

import (
	"database/sql/driver"
	"fmt"
	"io"
	"math"
	"reflect"
	"strings"
	"time"

	sqlite3 "modernc.org/sqlite/lib"
)

type rows struct {
	allocs  []uintptr
	c       *conn
	columns []string
	pstmt   uintptr

	doStep    bool
	empty     bool
	reuseStmt bool // If true, Close() resets instead of finalizing
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

	if r.reuseStmt {
		// Reset the statement for reuse instead of finalizing it
		if e := r.c.reset(r.pstmt); e != nil {
			return e
		}
		return r.c.clearBindings(r.pstmt)
	}

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
						// Check for explicit opt-in first.  This fixes the bug for micro/nano users
						// without breaking the legacy heuristic for existing users.
						switch r.c.integerTimeFormat {
						case "unix_micro":
							dest[i] = time.UnixMicro(v).UTC()
							continue
						case "unix_nano":
							dest[i] = time.Unix(0, v).UTC()
							continue
						}

						// Legacy Heuristic (mattn/go-sqlite3 compatibility).  NOTE: This heuristic
						// fails for Millisecond timestamps representing dates before Sept 9, 2001
						// (value < 1e12).

						// Is it a seconds timestamp or a milliseconds
						// timestamp?
						if v > 1e12 || v < -1e12 {
							// Milliseconds
							dest[i] = time.UnixMilli(v).UTC()
						} else {
							// Seconds
							dest[i] = time.Unix(v, 0).UTC()
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

// C documentation
//
//	int sqlite3_reset(sqlite3_stmt *pStmt);
func (c *conn) reset(pstmt uintptr) error {
	if rc := sqlite3.Xsqlite3_reset(c.tls, pstmt); rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}
	return nil
}
