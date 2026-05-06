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

// BUG(kardianos): Both the Quoter and Namer may need to access the server.

// Quoter returns safe and valid SQL strings to use when building a SQL text.
type Quoter interface {
	// ID quotes identifiers such as schema, table, or column names.
	// ID does not operate on multipart identifiers such as "public.Table",
	// it only operates on single identifiers such as "public" and "Table".
	ID(name string) string

	// Value quotes database values such as string or []byte types as strings
	// that are suitable and safe to embed in SQL text. The returned value
	// of a string will include all surrounding quotes.
	//
	// If a value type is not supported it must panic.
	Value(v interface{}) string
}

// DriverQuoter returns a Quoter interface and is suitable for extending
// the driver.Driver type.
//
// The driver may need to hit the database to determine how it is configured to
// ensure the correct escaping rules are used.
type DriverQuoter interface {
	Quoter(ctx context.Context) (Quoter, error)
}

// QuoterFromDriver takes a database driver, often obtained through a sql.DB.Driver
// call or from using it directly to get the quoter interface.
//
// Currently MssqlDriver is hard-coded to also return a valided Quoter.
func QuoterFromDriver(d driver.Driver, ctx context.Context) (Quoter, error) {
	if q, is := d.(DriverQuoter); is {
		return q.Quoter(ctx)
	}
	dv := reflect.ValueOf(d)

	d, found := internalDrivers[dv.Type().String()]
	if found {
		if q, is := d.(DriverQuoter); is {
			return q.Quoter(ctx)
		}
	}
	return nil, errors.New("quoter interface not found")
}
