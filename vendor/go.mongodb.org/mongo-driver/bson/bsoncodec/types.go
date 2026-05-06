// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncodec

import (
	"encoding/json"
	"net/url"
	"reflect"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/x/bsonx/bsoncore"
)

var tBool = reflect.TypeOf(false)
var tFloat64 = reflect.TypeOf(float64(0))
var tInt32 = reflect.TypeOf(int32(0))
var tInt64 = reflect.TypeOf(int64(0))
var tString = reflect.TypeOf("")
var tTime = reflect.TypeOf(time.Time{})

var tEmpty = reflect.TypeOf((*interface{})(nil)).Elem()
var tByteSlice = reflect.TypeOf([]byte(nil))
var tByte = reflect.TypeOf(byte(0x00))
var tURL = reflect.TypeOf(url.URL{})
var tJSONNumber = reflect.TypeOf(json.Number(""))

var tValueMarshaler = reflect.TypeOf((*ValueMarshaler)(nil)).Elem()
var tValueUnmarshaler = reflect.TypeOf((*ValueUnmarshaler)(nil)).Elem()
var tMarshaler = reflect.TypeOf((*Marshaler)(nil)).Elem()
var tUnmarshaler = reflect.TypeOf((*Unmarshaler)(nil)).Elem()
var tProxy = reflect.TypeOf((*Proxy)(nil)).Elem()
var tZeroer = reflect.TypeOf((*Zeroer)(nil)).Elem()

var tBinary = reflect.TypeOf(primitive.Binary{})
var tUndefined = reflect.TypeOf(primitive.Undefined{})
var tOID = reflect.TypeOf(primitive.ObjectID{})
var tDateTime = reflect.TypeOf(primitive.DateTime(0))
var tNull = reflect.TypeOf(primitive.Null{})
var tRegex = reflect.TypeOf(primitive.Regex{})
var tCodeWithScope = reflect.TypeOf(primitive.CodeWithScope{})
var tDBPointer = reflect.TypeOf(primitive.DBPointer{})
var tJavaScript = reflect.TypeOf(primitive.JavaScript(""))
var tSymbol = reflect.TypeOf(primitive.Symbol(""))
var tTimestamp = reflect.TypeOf(primitive.Timestamp{})
var tDecimal = reflect.TypeOf(primitive.Decimal128{})
var tMinKey = reflect.TypeOf(primitive.MinKey{})
var tMaxKey = reflect.TypeOf(primitive.MaxKey{})
var tD = reflect.TypeOf(primitive.D{})
var tA = reflect.TypeOf(primitive.A{})
var tE = reflect.TypeOf(primitive.E{})

var tCoreDocument = reflect.TypeOf(bsoncore.Document{})
var tCoreArray = reflect.TypeOf(bsoncore.Array{})
