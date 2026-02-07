// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlexp

import (
	"database/sql/driver"
	"errors"
	"reflect"
)

type Savepointer interface {
	Release(name string) string
	Create(name string) string
	Rollback(name string) string
}

type DriverSavepointer interface {
	Savepointer() (Savepointer, error)
}

// SavepointFromDriver
func SavepointFromDriver(d driver.Driver) (Savepointer, error) {
	if q, is := d.(DriverSavepointer); is {
		return q.Savepointer()
	}
	dv := reflect.ValueOf(d)

	d, found := internalDrivers[dv.Type().String()]
	if found {
		if q, is := d.(DriverSavepointer); is {
			return q.Savepointer()
		}
	}
	return nil, errors.New("savepointer interface not found")
}
