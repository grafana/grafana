// Copyright 2024 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlite // import "modernc.org/sqlite"

import (
	"runtime"
	"unsafe"

	"modernc.org/libc"
	sqlite3 "modernc.org/sqlite/lib"
)

// Access to sqlite3_file_control
type FileControl interface {
	// Set or query SQLITE_FCNTL_PERSIST_WAL, returns set mode or query result
	FileControlPersistWAL(dbName string, mode int) (int, error)
}

var _ FileControl = (*conn)(nil)

func (c *conn) FileControlPersistWAL(dbName string, mode int) (int, error) {
	i32 := int32(mode)
	pi32 := &i32

	var p runtime.Pinner
	p.Pin(pi32)
	defer p.Unpin()

	err := c.fileControl(dbName, sqlite3.SQLITE_FCNTL_PERSIST_WAL, (uintptr)(unsafe.Pointer(pi32)))
	return int(i32), err
}

func (c *conn) fileControl(dbName string, op int, pArg uintptr) error {
	zDbName, err := libc.CString(dbName)
	if err != nil {
		return err
	}
	defer c.free(zDbName)

	if rc := sqlite3.Xsqlite3_file_control(c.tls, c.db, zDbName, int32(op), pArg); rc != sqlite3.SQLITE_OK {
		return c.errstr(rc)
	}

	return nil
}
