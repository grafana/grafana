// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlexp

import (
	"context"
	"database/sql/driver"
	"fmt"
)

type postgresql struct{}

var (
	_ DriverNamer       = postgresql{}
	_ DriverQuoter      = postgresql{}
	_ DriverSavepointer = postgresql{}
)

func (postgresql) Open(string) (driver.Conn, error) {
	panic("not implemented")
}

func (postgresql) Namer(ctx context.Context) (Namer, error) {
	return pgNamer{}, nil
}

func (postgresql) Quoter(ctx context.Context) (Quoter, error) {
	panic("not implemented")
}

func (postgresql) Savepointer() (Savepointer, error) {
	return pgSavepointer{}, nil
}

type pgNamer struct{}

func (pgNamer) Name() string {
	return "postgresql"
}
func (pgNamer) Dialect() string {
	return DialectPostgres
}

type pgQuoter struct{}

func (pgQuoter) ID(name string) string {
	return ""
}
func (pgQuoter) Value(v interface{}) string {
	return ""
}

type pgSavepointer struct{}

func (pgSavepointer) Release(name string) string {
	return fmt.Sprintf("release savepoint %s;", name)
}

func (pgSavepointer) Create(name string) string {
	return fmt.Sprintf("savepoint %s;", name)
}

func (pgSavepointer) Rollback(name string) string {
	return fmt.Sprintf("rollback to savepoint %s;", name)
}
