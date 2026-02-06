// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bson

import (
	"go.mongodb.org/mongo-driver/bson/bsontype"
)

// BSON element types as described in https://bsonspec.org/spec.html.
const (
	TypeDouble           = bsontype.Double
	TypeString           = bsontype.String
	TypeEmbeddedDocument = bsontype.EmbeddedDocument
	TypeArray            = bsontype.Array
	TypeBinary           = bsontype.Binary
	TypeUndefined        = bsontype.Undefined
	TypeObjectID         = bsontype.ObjectID
	TypeBoolean          = bsontype.Boolean
	TypeDateTime         = bsontype.DateTime
	TypeNull             = bsontype.Null
	TypeRegex            = bsontype.Regex
	TypeDBPointer        = bsontype.DBPointer
	TypeJavaScript       = bsontype.JavaScript
	TypeSymbol           = bsontype.Symbol
	TypeCodeWithScope    = bsontype.CodeWithScope
	TypeInt32            = bsontype.Int32
	TypeTimestamp        = bsontype.Timestamp
	TypeInt64            = bsontype.Int64
	TypeDecimal128       = bsontype.Decimal128
	TypeMinKey           = bsontype.MinKey
	TypeMaxKey           = bsontype.MaxKey
)

// BSON binary element subtypes as described in https://bsonspec.org/spec.html.
const (
	TypeBinaryGeneric     = bsontype.BinaryGeneric
	TypeBinaryFunction    = bsontype.BinaryFunction
	TypeBinaryBinaryOld   = bsontype.BinaryBinaryOld
	TypeBinaryUUIDOld     = bsontype.BinaryUUIDOld
	TypeBinaryUUID        = bsontype.BinaryUUID
	TypeBinaryMD5         = bsontype.BinaryMD5
	TypeBinaryEncrypted   = bsontype.BinaryEncrypted
	TypeBinaryColumn      = bsontype.BinaryColumn
	TypeBinarySensitive   = bsontype.BinarySensitive
	TypeBinaryUserDefined = bsontype.BinaryUserDefined
)
