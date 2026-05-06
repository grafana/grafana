// Copyright 2025 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlite // import "modernc.org/sqlite"

import (
	"context"
	"database/sql/driver"

	"modernc.org/libc"
	sqlite3 "modernc.org/sqlite/lib"
)

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
