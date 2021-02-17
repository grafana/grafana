// Copyright (C) 2019 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// +build !cgo

package sqlite3

import (
	"database/sql"
	"database/sql/driver"
	"errors"
)

var errorMsg = errors.New("Binary was compiled with 'CGO_ENABLED=0', go-sqlite3 requires cgo to work. This is a stub")

func init() {
	sql.Register("sqlite3", &SQLiteDriver{})
}

type (
	SQLiteDriver struct {
		Extensions  []string
		ConnectHook func(*SQLiteConn) error
	}
	SQLiteConn struct{}
)

func (SQLiteDriver) Open(s string) (driver.Conn, error)                        { return nil, errorMsg }
func (c *SQLiteConn) RegisterAggregator(string, interface{}, bool) error       { return errorMsg }
func (c *SQLiteConn) RegisterAuthorizer(func(int, string, string, string) int) {}
func (c *SQLiteConn) RegisterCollation(string, func(string, string) int) error { return errorMsg }
func (c *SQLiteConn) RegisterCommitHook(func() int)                            {}
func (c *SQLiteConn) RegisterFunc(string, interface{}, bool) error             { return errorMsg }
func (c *SQLiteConn) RegisterRollbackHook(func())                              {}
func (c *SQLiteConn) RegisterUpdateHook(func(int, string, string, int64))      {}
