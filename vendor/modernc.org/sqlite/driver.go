// Copyright 2025 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlite // import "modernc.org/sqlite"

import (
	"database/sql/driver"
	"fmt"

	"modernc.org/sqlite/vtab"
)

// Driver implements database/sql/driver.Driver.
type Driver struct {
	// user defined functions that are added to every new connection on Open
	udfs map[string]*userDefinedFunction
	// collations that are added to every new connection on Open
	collations map[string]*collation
	// connection hooks are called after a connection is opened
	connectionHooks []ConnectionHookFn
	// modules holds registered virtual table modules that should be added to
	// every new connection on Open.
	modules map[string]vtab.Module
}

var d = &Driver{
	udfs:            make(map[string]*userDefinedFunction, 0),
	collations:      make(map[string]*collation, 0),
	connectionHooks: make([]ConnectionHookFn, 0),
	modules:         make(map[string]vtab.Module, 0),
}

func newDriver() *Driver { return d }

// Open returns a new connection to the database. The name is a string in a
// driver-specific format.
//
// Open may return a cached connection (one previously closed), but doing so is
// unnecessary; the sql package maintains a pool of idle connections for
// efficient re-use.
//
// The returned connection is only used by one goroutine at a time.
//
// The name may be a filename, e.g., "/tmp/mydata.sqlite", or a URI, in which
// case it may include a '?' followed by one or more query parameters.
// For example, "file:///tmp/mydata.sqlite?_pragma=foreign_keys(1)&_time_format=sqlite".
// The supported query parameters are:
//
// _pragma: Each value will be run as a "PRAGMA ..." statement (with the PRAGMA
// keyword added for you). May be specified more than once, '&'-separated. For more
// information on supported PRAGMAs see: https://www.sqlite.org/pragma.html
//
// _time_format: The name of a format to use when writing time values to the
// database. Currently the only supported value is "sqlite", which corresponds
// to format 7 from https://www.sqlite.org/lang_datefunc.html#time_values,
// including the timezone specifier. If this parameter is not specified, then
// the default String() format will be used.
//
// _time_integer_format: The name of a integer format to use when writing time values.
// By default, the time is stored as string and the format can be set with _time_format
// parameter. If _time_integer_format is set, the time will be stored as an integer and
// the integer value will depend on the integer format.
// If you decide to set both _time_format and _time_integer_format, the time will be
// converted as integer and the _time_format value will be ignored.
// Currently the supported value are "unix","unix_milli", "unix_micro" and "unix_nano",
// which corresponds to seconds, milliseconds, microseconds or nanoseconds
// since unixepoch (1 January 1970 00:00:00 UTC).
//
// _inttotime: Enable conversion of time column (DATE, DATETIME,TIMESTAMP) from integer
// to time if the field contain integer (int64).
//
// _txlock: The locking behavior to use when beginning a transaction. May be
// "deferred" (the default), "immediate", or "exclusive" (case insensitive). See:
// https://www.sqlite.org/lang_transaction.html#deferred_immediate_and_exclusive_transactions
func (d *Driver) Open(name string) (conn driver.Conn, err error) {
	if dmesgs {
		defer func() {
			dmesg("name %q: (driver.Conn %p, err %v)", name, conn, err)
		}()
	}
	c, err := newConn(name)
	if err != nil {
		return nil, err
	}

	for _, udf := range d.udfs {
		if err = c.createFunctionInternal(udf); err != nil {
			c.Close()
			return nil, err
		}
	}
	for _, coll := range d.collations {
		if err = c.createCollationInternal(coll); err != nil {
			c.Close()
			return nil, err
		}
	}
	for _, connHookFn := range d.connectionHooks {
		if err = connHookFn(c, name); err != nil {
			c.Close()
			return nil, fmt.Errorf("connection hook: %w", err)
		}
	}
	// Register any vtab modules with this connection.
	// Note: vtab module registration applies to new connections only. If a
	// module is registered after a connection has been opened, that existing
	// connection will not see the module; open a new connection to use it.
	if err := c.registerModules(); err != nil {
		c.Close()
		return nil, err
	}
	return c, nil
}

// RegisterConnectionHook registers a function to be called after each connection
// is opened. This is called after all the connection has been set up.
func (d *Driver) RegisterConnectionHook(fn ConnectionHookFn) {
	d.connectionHooks = append(d.connectionHooks, fn)
}
