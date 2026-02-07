// Copyright (C) 2019 G.J.R. Timmer <gjr.timmer@gmail.com>.
// Copyright (C) 2018 segment.com <friends@segment.com>
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

//go:build cgo
// +build cgo

package sqlite3

// SQLitePreUpdateData represents all of the data available during a
// pre-update hook call.
type SQLitePreUpdateData struct {
	Conn         *SQLiteConn
	Op           int
	DatabaseName string
	TableName    string
	OldRowID     int64
	NewRowID     int64
}
