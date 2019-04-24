// Go MySQL Driver - A MySQL-Driver for Go's database/sql package
//
// Copyright 2017 The Go-MySQL-Driver Authors. All rights reserved.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at http://mozilla.org/MPL/2.0/.

package mysql

import (
	"database/sql"
	"reflect"
)

func (mf *mysqlField) typeDatabaseName() string {
	switch mf.fieldType {
	case fieldTypeBit:
		return "BIT"
	case fieldTypeBLOB:
		if mf.charSet != collations[binaryCollation] {
			return "TEXT"
		}
		return "BLOB"
	case fieldTypeDate:
		return "DATE"
	case fieldTypeDateTime:
		return "DATETIME"
	case fieldTypeDecimal:
		return "DECIMAL"
	case fieldTypeDouble:
		return "DOUBLE"
	case fieldTypeEnum:
		return "ENUM"
	case fieldTypeFloat:
		return "FLOAT"
	case fieldTypeGeometry:
		return "GEOMETRY"
	case fieldTypeInt24:
		return "MEDIUMINT"
	case fieldTypeJSON:
		return "JSON"
	case fieldTypeLong:
		return "INT"
	case fieldTypeLongBLOB:
		if mf.charSet != collations[binaryCollation] {
			return "LONGTEXT"
		}
		return "LONGBLOB"
	case fieldTypeLongLong:
		return "BIGINT"
	case fieldTypeMediumBLOB:
		if mf.charSet != collations[binaryCollation] {
			return "MEDIUMTEXT"
		}
		return "MEDIUMBLOB"
	case fieldTypeNewDate:
		return "DATE"
	case fieldTypeNewDecimal:
		return "DECIMAL"
	case fieldTypeNULL:
		return "NULL"
	case fieldTypeSet:
		return "SET"
	case fieldTypeShort:
		return "SMALLINT"
	case fieldTypeString:
		if mf.charSet == collations[binaryCollation] {
			return "BINARY"
		}
		return "CHAR"
	case fieldTypeTime:
		return "TIME"
	case fieldTypeTimestamp:
		return "TIMESTAMP"
	case fieldTypeTiny:
		return "TINYINT"
	case fieldTypeTinyBLOB:
		if mf.charSet != collations[binaryCollation] {
			return "TINYTEXT"
		}
		return "TINYBLOB"
	case fieldTypeVarChar:
		if mf.charSet == collations[binaryCollation] {
			return "VARBINARY"
		}
		return "VARCHAR"
	case fieldTypeVarString:
		if mf.charSet == collations[binaryCollation] {
			return "VARBINARY"
		}
		return "VARCHAR"
	case fieldTypeYear:
		return "YEAR"
	default:
		return ""
	}
}

var (
	scanTypeFloat32   = reflect.TypeOf(float32(0))
	scanTypeFloat64   = reflect.TypeOf(float64(0))
	scanTypeInt8      = reflect.TypeOf(int8(0))
	scanTypeInt16     = reflect.TypeOf(int16(0))
	scanTypeInt32     = reflect.TypeOf(int32(0))
	scanTypeInt64     = reflect.TypeOf(int64(0))
	scanTypeNullFloat = reflect.TypeOf(sql.NullFloat64{})
	scanTypeNullInt   = reflect.TypeOf(sql.NullInt64{})
	scanTypeNullTime  = reflect.TypeOf(NullTime{})
	scanTypeUint8     = reflect.TypeOf(uint8(0))
	scanTypeUint16    = reflect.TypeOf(uint16(0))
	scanTypeUint32    = reflect.TypeOf(uint32(0))
	scanTypeUint64    = reflect.TypeOf(uint64(0))
	scanTypeRawBytes  = reflect.TypeOf(sql.RawBytes{})
	scanTypeUnknown   = reflect.TypeOf(new(interface{}))
)

type mysqlField struct {
	tableName string
	name      string
	length    uint32
	flags     fieldFlag
	fieldType fieldType
	decimals  byte
	charSet   uint8
}

func (mf *mysqlField) scanType() reflect.Type {
	switch mf.fieldType {
	case fieldTypeTiny:
		if mf.flags&flagNotNULL != 0 {
			if mf.flags&flagUnsigned != 0 {
				return scanTypeUint8
			}
			return scanTypeInt8
		}
		return scanTypeNullInt

	case fieldTypeShort, fieldTypeYear:
		if mf.flags&flagNotNULL != 0 {
			if mf.flags&flagUnsigned != 0 {
				return scanTypeUint16
			}
			return scanTypeInt16
		}
		return scanTypeNullInt

	case fieldTypeInt24, fieldTypeLong:
		if mf.flags&flagNotNULL != 0 {
			if mf.flags&flagUnsigned != 0 {
				return scanTypeUint32
			}
			return scanTypeInt32
		}
		return scanTypeNullInt

	case fieldTypeLongLong:
		if mf.flags&flagNotNULL != 0 {
			if mf.flags&flagUnsigned != 0 {
				return scanTypeUint64
			}
			return scanTypeInt64
		}
		return scanTypeNullInt

	case fieldTypeFloat:
		if mf.flags&flagNotNULL != 0 {
			return scanTypeFloat32
		}
		return scanTypeNullFloat

	case fieldTypeDouble:
		if mf.flags&flagNotNULL != 0 {
			return scanTypeFloat64
		}
		return scanTypeNullFloat

	case fieldTypeDecimal, fieldTypeNewDecimal, fieldTypeVarChar,
		fieldTypeBit, fieldTypeEnum, fieldTypeSet, fieldTypeTinyBLOB,
		fieldTypeMediumBLOB, fieldTypeLongBLOB, fieldTypeBLOB,
		fieldTypeVarString, fieldTypeString, fieldTypeGeometry, fieldTypeJSON,
		fieldTypeTime:
		return scanTypeRawBytes

	case fieldTypeDate, fieldTypeNewDate,
		fieldTypeTimestamp, fieldTypeDateTime:
		// NullTime is always returned for more consistent behavior as it can
		// handle both cases of parseTime regardless if the field is nullable.
		return scanTypeNullTime

	default:
		return scanTypeUnknown
	}
}
