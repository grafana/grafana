// Copyright 2017 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build go1.8
// +build go1.8

package sqlite // import "modernc.org/sqlite"

import (
	"context"
	"database/sql/driver"
)

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
