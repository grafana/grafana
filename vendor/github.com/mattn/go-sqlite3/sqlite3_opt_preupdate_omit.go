// Copyright (C) 2019 G.J.R. Timmer <gjr.timmer@gmail.com>.
// Copyright (C) 2018 segment.com <friends@segment.com>
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// +build !sqlite_preupdate_hook,cgo

package sqlite3

// RegisterPreUpdateHook sets the pre-update hook for a connection.
//
// The callback is passed a SQLitePreUpdateData struct with the data for
// the update, as well as methods for fetching copies of impacted data.
//
// If there is an existing update hook for this connection, it will be
// removed. If callback is nil the existing hook (if any) will be removed
// without creating a new one.
func (c *SQLiteConn) RegisterPreUpdateHook(callback func(SQLitePreUpdateData)) {
	// NOOP
}
