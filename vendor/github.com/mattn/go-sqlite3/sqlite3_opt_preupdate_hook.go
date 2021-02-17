// Copyright (C) 2019 G.J.R. Timmer <gjr.timmer@gmail.com>.
// Copyright (C) 2018 segment.com <friends@segment.com>
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// +build sqlite_preupdate_hook

package sqlite3

/*
#cgo CFLAGS: -DSQLITE_ENABLE_PREUPDATE_HOOK
#cgo LDFLAGS: -lm

#ifndef USE_LIBSQLITE3
#include <sqlite3-binding.h>
#else
#include <sqlite3.h>
#endif
#include <stdlib.h>
#include <string.h>

void preUpdateHookTrampoline(void*, sqlite3 *, int, char *, char *, sqlite3_int64, sqlite3_int64);
*/
import "C"
import (
	"errors"
	"unsafe"
)

// RegisterPreUpdateHook sets the pre-update hook for a connection.
//
// The callback is passed a SQLitePreUpdateData struct with the data for
// the update, as well as methods for fetching copies of impacted data.
//
// If there is an existing update hook for this connection, it will be
// removed. If callback is nil the existing hook (if any) will be removed
// without creating a new one.
func (c *SQLiteConn) RegisterPreUpdateHook(callback func(SQLitePreUpdateData)) {
	if callback == nil {
		C.sqlite3_preupdate_hook(c.db, nil, nil)
	} else {
		C.sqlite3_preupdate_hook(c.db, (*[0]byte)(unsafe.Pointer(C.preUpdateHookTrampoline)), unsafe.Pointer(newHandle(c, callback)))
	}
}

// Depth returns the source path of the write, see sqlite3_preupdate_depth()
func (d *SQLitePreUpdateData) Depth() int {
	return int(C.sqlite3_preupdate_depth(d.Conn.db))
}

// Count returns the number of columns in the row
func (d *SQLitePreUpdateData) Count() int {
	return int(C.sqlite3_preupdate_count(d.Conn.db))
}

func (d *SQLitePreUpdateData) row(dest []interface{}, new bool) error {
	for i := 0; i < d.Count() && i < len(dest); i++ {
		var val *C.sqlite3_value
		var src interface{}

		// Initially I tried making this just a function pointer argument, but
		// it's absurdly complicated to pass C function pointers.
		if new {
			C.sqlite3_preupdate_new(d.Conn.db, C.int(i), &val)
		} else {
			C.sqlite3_preupdate_old(d.Conn.db, C.int(i), &val)
		}

		switch C.sqlite3_value_type(val) {
		case C.SQLITE_INTEGER:
			src = int64(C.sqlite3_value_int64(val))
		case C.SQLITE_FLOAT:
			src = float64(C.sqlite3_value_double(val))
		case C.SQLITE_BLOB:
			len := C.sqlite3_value_bytes(val)
			blobptr := C.sqlite3_value_blob(val)
			src = C.GoBytes(blobptr, len)
		case C.SQLITE_TEXT:
			len := C.sqlite3_value_bytes(val)
			cstrptr := unsafe.Pointer(C.sqlite3_value_text(val))
			src = C.GoBytes(cstrptr, len)
		case C.SQLITE_NULL:
			src = nil
		}

		err := convertAssign(&dest[i], src)
		if err != nil {
			return err
		}
	}

	return nil
}

// Old populates dest with the row data to be replaced. This works similar to
// database/sql's Rows.Scan()
func (d *SQLitePreUpdateData) Old(dest ...interface{}) error {
	if d.Op == SQLITE_INSERT {
		return errors.New("There is no old row for INSERT operations")
	}
	return d.row(dest, false)
}

// New populates dest with the replacement row data. This works similar to
// database/sql's Rows.Scan()
func (d *SQLitePreUpdateData) New(dest ...interface{}) error {
	if d.Op == SQLITE_DELETE {
		return errors.New("There is no new row for DELETE operations")
	}
	return d.row(dest, true)
}
