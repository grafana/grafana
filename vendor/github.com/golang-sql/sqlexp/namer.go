// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlexp

import (
	"context"
	"database/sql/driver"
	"errors"
	"reflect"
)

const (
	DialectPostgres = "postgres"
	DialectTSQL     = "tsql"
	DialectMySQL    = "mysql"
	DialectSQLite   = "sqlite"
	DialectOracle   = "oracle"
)

// Namer returns the name of the database and the SQL dialect it
// uses.
type Namer interface {
	// Name of the database management system.
	//
	// Examples:
	//    "posgresql-9.6"
	//    "sqlserver-10.54.32"
	//    "cockroachdb-1.0"
	Name() string

	// Dialect of SQL used in the database.
	Dialect() string
}

// DriverNamer may be implemented on the driver.Driver interface.
// It may need to request information from the server to return
// the correct information.
type DriverNamer interface {
	Namer(ctx context.Context) (Namer, error)
}

// NamerFromDriver returns the DriverNamer from the DB if
// it is implemented.
func NamerFromDriver(d driver.Driver, ctx context.Context) (Namer, error) {
	if q, is := d.(DriverNamer); is {
		return q.Namer(ctx)
	}
	dv := reflect.ValueOf(d)

	d, found := internalDrivers[dv.Type().String()]
	if found {
		if q, is := d.(DriverNamer); is {
			return q.Namer(ctx)
		}
	}
	return nil, errors.New("namer not found")
}
