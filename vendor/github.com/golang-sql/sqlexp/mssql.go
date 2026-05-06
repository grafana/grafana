// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlexp

import (
	"context"
	"database/sql/driver"
	"fmt"
	"strings"
)

type mssql struct{}

var (
	_ DriverNamer       = mssql{}
	_ DriverQuoter      = mssql{}
	_ DriverSavepointer = mssql{}
)

func (mssql) Open(string) (driver.Conn, error) {
	panic("not implemented")
}

func (mssql) Namer(ctx context.Context) (Namer, error) {
	return sqlServerNamer{}, nil
}

func (mssql) Quoter(ctx context.Context) (Quoter, error) {
	return sqlServerQuoter{}, nil
}

func (mssql) Savepointer() (Savepointer, error) {
	return sqlServerSavepointer{}, nil
}

type sqlServerNamer struct{}

func (sqlServerNamer) Name() string {
	return "sqlserver"
}
func (sqlServerNamer) Dialect() string {
	return DialectTSQL
}

type sqlServerQuoter struct{}

func (sqlServerQuoter) ID(name string) string {
	return "[" + strings.Replace(name, "]", "]]", -1) + "]"
}
func (sqlServerQuoter) Value(v interface{}) string {
	switch v := v.(type) {
	default:
		panic("unsupported value")
	case string:
		return "'" + strings.Replace(v, "'", "''", -1) + "'"
	}
}

type sqlServerSavepointer struct{}

func (sqlServerSavepointer) Release(name string) string {
	return ""
}

func (sqlServerSavepointer) Create(name string) string {
	return fmt.Sprintf("save tran %s;", name)
}

func (sqlServerSavepointer) Rollback(name string) string {
	return fmt.Sprintf("rollback tran %s;", name)
}
