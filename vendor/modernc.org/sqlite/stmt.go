// Copyright 2025 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlite // import "modernc.org/sqlite"

import (
	"context"
	"database/sql/driver"
	"sync/atomic"
	"unsafe"

	"modernc.org/libc"
	sqlite3 "modernc.org/sqlite/lib"
)

type stmt struct {
	c     *conn
	psql  uintptr
	pstmt uintptr // The cached SQLite statement handle
}

func newStmt(c *conn, sql string) (*stmt, error) {
	p, err := libc.CString(sql)
	if err != nil {
		return nil, err
	}
	s := &stmt{c: c, psql: p}

	// Attempt to prepare the statement immediately
	// We make a copy of the pointer because prepareV2 advances it
	psql := p
	pstmt, err := c.prepareV2(&psql)
	if err != nil {
		c.free(p)
		return nil, err
	}

	// Check if there is trailing SQL (indicating a script/multi-statement)
	// If *psql (the tail) is 0, we consumed the whole string.
	hasTail := *(*byte)(unsafe.Pointer(psql)) != 0
	if pstmt != 0 && !hasTail {
		// Optimization: Single statement. Cache it.
		s.pstmt = pstmt
		return s, nil
	}

	// It is either a script (hasTail) or a comment-only string (pstmt==0).
	// For scripts: Finalize now. We will re-parse iteratively in Exec/Query
	// to handle the multiple statements correctly using the existing loop logic.
	if pstmt != 0 {
		if err := c.finalize(pstmt); err != nil {
			c.free(p)
			return nil, err
		}
	}

	return s, nil
}

// Close closes the statement.
//
// As of Go 1.1, a Stmt will not be closed if it's in use by any queries.
func (s *stmt) Close() (err error) {
	if s.pstmt != 0 {
		if e := s.c.finalize(s.pstmt); e != nil {
			err = e
		}
		s.pstmt = 0
	}
	if s.psql != 0 {
		s.c.free(s.psql)
		s.psql = 0
	}
	return err
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

	// OPTIMIZED PATH: Single Cached Statement
	if s.pstmt != 0 {
		err = func() error {
			// Bind
			n, err := s.c.bindParameterCount(s.pstmt)
			if err != nil {
				return err
			}
			if n != 0 {
				allocs, err := s.c.bind(s.pstmt, n, args)
				if err != nil {
					return err
				}
				// Free allocations after step
				if len(allocs) != 0 {
					defer func() {
						for _, v := range allocs {
							s.c.free(v)
						}
					}()
				}
			}

			// Step
			rc, err := s.c.step(s.pstmt)
			if err != nil {
				return err
			}

			// Handle Result
			switch rc & 0xff {
			case sqlite3.SQLITE_DONE, sqlite3.SQLITE_ROW:
				r, err = newResult(s.c)
			default:
				return s.c.errstr(int32(rc))
			}
			return nil
		}()

		// RESET (Crucial: Do not finalize)
		// We must reset the VM to allow reuse.
		// We also clear bindings to prevent leaking memory or state to next call.
		if resetErr := s.c.reset(s.pstmt); resetErr != nil && err == nil {
			err = resetErr
		}
		if clearErr := s.c.clearBindings(s.pstmt); clearErr != nil && err == nil {
			err = clearErr
		}
		return r, err
	}

	// FALLBACK PATH: Multi-statement script
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

	// OPTIMIZED PATH: Single Cached Statement
	if s.pstmt != 0 {
		// Bind
		n, err := s.c.bindParameterCount(s.pstmt)
		if err != nil {
			return nil, err
		}
		if n != 0 {
			if allocs, err = s.c.bind(s.pstmt, n, args); err != nil {
				return nil, err
			}
		}

		// Step
		rc, err := s.c.step(s.pstmt)
		if err != nil {
			// On error, we must free allocs manually because 'newRows' won't take ownership
			for _, v := range allocs {
				s.c.free(v)
			}
			s.c.reset(s.pstmt)
			s.c.clearBindings(s.pstmt)
			return nil, err
		}

		// Handle Result
		switch rc & 0xff {
		case sqlite3.SQLITE_ROW:
			// Pass reuseStmt=true
			if r, err = newRows(s.c, s.pstmt, allocs, false); err != nil {
				s.c.reset(s.pstmt)
				s.c.clearBindings(s.pstmt)
				return nil, err
			}
			r.(*rows).reuseStmt = true
			return r, nil

		case sqlite3.SQLITE_DONE:
			// No rows. Reset immediately.
			// We still return a rows object (empty), but we can reset the stmt now
			// because the empty rows object won't call step() again.
			// However, standard newRows behavior expects a valid stmt to get columns.
			// Let's rely on newRows to read columns, then it returns.

			// Actually, if we pass reuseStmt=true to an empty set,
			// rows.Close() will eventually reset it.
			if r, err = newRows(s.c, s.pstmt, allocs, true); err != nil {
				s.c.reset(s.pstmt)
				s.c.clearBindings(s.pstmt)
				return nil, err
			}
			r.(*rows).reuseStmt = true
			return r, nil

		default:
			// Error case
			for _, v := range allocs {
				s.c.free(v)
			}
			s.c.reset(s.pstmt)
			s.c.clearBindings(s.pstmt)
			return nil, s.c.errstr(int32(rc))
		}
	}

	// FALLBACK PATH: Multi-statement script
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

// ExecContext implements driver.StmtExecContext
func (s *stmt) ExecContext(ctx context.Context, args []driver.NamedValue) (dr driver.Result, err error) {
	if dmesgs {
		defer func() {
			dmesg("stmt %p, ctx %p, args %v: (driver.Result %p, err %v)", s, ctx, args, dr, err)
		}()
	}
	return s.exec(ctx, args)
}

// QueryContext implements driver.StmtQueryContext
func (s *stmt) QueryContext(ctx context.Context, args []driver.NamedValue) (dr driver.Rows, err error) {
	if dmesgs {
		defer func() {
			dmesg("stmt %p, ctx %p, args %v: (driver.Rows %p, err %v)", s, ctx, args, dr, err)
		}()
	}
	return s.query(ctx, args)
}

// C documentation
//
//	int sqlite3_clear_bindings(sqlite3_stmt*);
func (c *conn) clearBindings(pstmt uintptr) error {
	if rc := sqlite3.Xsqlite3_clear_bindings(c.tls, pstmt); rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}
	return nil
}
