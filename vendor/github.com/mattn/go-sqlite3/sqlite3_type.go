// Copyright (C) 2019 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

package sqlite3

/*
#ifndef USE_LIBSQLITE3
#include "sqlite3-binding.h"
#else
#include <sqlite3.h>
#endif
*/
import "C"
import (
	"database/sql"
	"reflect"
	"strings"
)

// ColumnTypeDatabaseTypeName implement RowsColumnTypeDatabaseTypeName.
func (rc *SQLiteRows) ColumnTypeDatabaseTypeName(i int) string {
	return C.GoString(C.sqlite3_column_decltype(rc.s.s, C.int(i)))
}

/*
func (rc *SQLiteRows) ColumnTypeLength(index int) (length int64, ok bool) {
	return 0, false
}

func (rc *SQLiteRows) ColumnTypePrecisionScale(index int) (precision, scale int64, ok bool) {
	return 0, 0, false
}
*/

// ColumnTypeNullable implement RowsColumnTypeNullable.
func (rc *SQLiteRows) ColumnTypeNullable(i int) (nullable, ok bool) {
	return true, true
}

// ColumnTypeScanType implement RowsColumnTypeScanType.
func (rc *SQLiteRows) ColumnTypeScanType(i int) reflect.Type {
	//ct := C.sqlite3_column_type(rc.s.s, C.int(i))  // Always returns 5
	return scanType(C.GoString(C.sqlite3_column_decltype(rc.s.s, C.int(i))))
}

const (
	SQLITE_INTEGER = iota
	SQLITE_TEXT
	SQLITE_BLOB
	SQLITE_REAL
	SQLITE_NUMERIC
	SQLITE_TIME
	SQLITE_BOOL
	SQLITE_NULL
)

func scanType(cdt string) reflect.Type {
	t := strings.ToUpper(cdt)
	i := databaseTypeConvSqlite(t)
	switch i {
	case SQLITE_INTEGER:
		return reflect.TypeOf(sql.NullInt64{})
	case SQLITE_TEXT:
		return reflect.TypeOf(sql.NullString{})
	case SQLITE_BLOB:
		return reflect.TypeOf(sql.RawBytes{})
	case SQLITE_REAL:
		return reflect.TypeOf(sql.NullFloat64{})
	case SQLITE_NUMERIC:
		return reflect.TypeOf(sql.NullFloat64{})
	case SQLITE_BOOL:
		return reflect.TypeOf(sql.NullBool{})
	case SQLITE_TIME:
		return reflect.TypeOf(sql.NullTime{})
	}
	return reflect.TypeOf(new(any))
}

func databaseTypeConvSqlite(t string) int {
	if strings.Contains(t, "INT") {
		return SQLITE_INTEGER
	}
	if t == "CLOB" || t == "TEXT" ||
		strings.Contains(t, "CHAR") {
		return SQLITE_TEXT
	}
	if t == "BLOB" {
		return SQLITE_BLOB
	}
	if t == "REAL" || t == "FLOAT" ||
		strings.Contains(t, "DOUBLE") {
		return SQLITE_REAL
	}
	if t == "DATE" || t == "DATETIME" ||
		t == "TIMESTAMP" {
		return SQLITE_TIME
	}
	if t == "NUMERIC" ||
		strings.Contains(t, "DECIMAL") {
		return SQLITE_NUMERIC
	}
	if t == "BOOLEAN" {
		return SQLITE_BOOL
	}

	return SQLITE_NULL
}
