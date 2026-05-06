// Copyright 2025 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlite // import "modernc.org/sqlite"

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
