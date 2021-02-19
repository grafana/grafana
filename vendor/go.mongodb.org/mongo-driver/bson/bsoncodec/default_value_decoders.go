// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncodec

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"reflect"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson/bsonrw"
	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/x/bsonx/bsoncore"
)

var defaultValueDecoders DefaultValueDecoders

// DefaultValueDecoders is a namespace type for the default ValueDecoders used
// when creating a registry.
type DefaultValueDecoders struct{}

// RegisterDefaultDecoders will register the decoder methods attached to DefaultValueDecoders with
// the provided RegistryBuilder.
//
// There is no support for decoding map[string]interface{} becuase there is no decoder for
// interface{}, so users must either register this decoder themselves or use the
// EmptyInterfaceDecoder avaialble in the bson package.
func (dvd DefaultValueDecoders) RegisterDefaultDecoders(rb *RegistryBuilder) {
	if rb == nil {
		panic(errors.New("argument to RegisterDefaultDecoders must not be nil"))
	}

	rb.
		RegisterTypeDecoder(tBinary, ValueDecoderFunc(dvd.BinaryDecodeValue)).
		RegisterTypeDecoder(tUndefined, ValueDecoderFunc(dvd.UndefinedDecodeValue)).
		RegisterTypeDecoder(tDateTime, ValueDecoderFunc(dvd.DateTimeDecodeValue)).
		RegisterTypeDecoder(tNull, ValueDecoderFunc(dvd.NullDecodeValue)).
		RegisterTypeDecoder(tRegex, ValueDecoderFunc(dvd.RegexDecodeValue)).
		RegisterTypeDecoder(tDBPointer, ValueDecoderFunc(dvd.DBPointerDecodeValue)).
		RegisterTypeDecoder(tTimestamp, ValueDecoderFunc(dvd.TimestampDecodeValue)).
		RegisterTypeDecoder(tMinKey, ValueDecoderFunc(dvd.MinKeyDecodeValue)).
		RegisterTypeDecoder(tMaxKey, ValueDecoderFunc(dvd.MaxKeyDecodeValue)).
		RegisterTypeDecoder(tJavaScript, ValueDecoderFunc(dvd.JavaScriptDecodeValue)).
		RegisterTypeDecoder(tSymbol, ValueDecoderFunc(dvd.SymbolDecodeValue)).
		RegisterTypeDecoder(tByteSlice, defaultByteSliceCodec).
		RegisterTypeDecoder(tTime, defaultTimeCodec).
		RegisterTypeDecoder(tEmpty, defaultEmptyInterfaceCodec).
		RegisterTypeDecoder(tOID, ValueDecoderFunc(dvd.ObjectIDDecodeValue)).
		RegisterTypeDecoder(tDecimal, ValueDecoderFunc(dvd.Decimal128DecodeValue)).
		RegisterTypeDecoder(tJSONNumber, ValueDecoderFunc(dvd.JSONNumberDecodeValue)).
		RegisterTypeDecoder(tURL, ValueDecoderFunc(dvd.URLDecodeValue)).
		RegisterTypeDecoder(tCoreDocument, ValueDecoderFunc(dvd.CoreDocumentDecodeValue)).
		RegisterTypeDecoder(tCodeWithScope, ValueDecoderFunc(dvd.CodeWithScopeDecodeValue)).
		RegisterDefaultDecoder(reflect.Bool, ValueDecoderFunc(dvd.BooleanDecodeValue)).
		RegisterDefaultDecoder(reflect.Int, ValueDecoderFunc(dvd.IntDecodeValue)).
		RegisterDefaultDecoder(reflect.Int8, ValueDecoderFunc(dvd.IntDecodeValue)).
		RegisterDefaultDecoder(reflect.Int16, ValueDecoderFunc(dvd.IntDecodeValue)).
		RegisterDefaultDecoder(reflect.Int32, ValueDecoderFunc(dvd.IntDecodeValue)).
		RegisterDefaultDecoder(reflect.Int64, ValueDecoderFunc(dvd.IntDecodeValue)).
		RegisterDefaultDecoder(reflect.Uint, defaultUIntCodec).
		RegisterDefaultDecoder(reflect.Uint8, defaultUIntCodec).
		RegisterDefaultDecoder(reflect.Uint16, defaultUIntCodec).
		RegisterDefaultDecoder(reflect.Uint32, defaultUIntCodec).
		RegisterDefaultDecoder(reflect.Uint64, defaultUIntCodec).
		RegisterDefaultDecoder(reflect.Float32, ValueDecoderFunc(dvd.FloatDecodeValue)).
		RegisterDefaultDecoder(reflect.Float64, ValueDecoderFunc(dvd.FloatDecodeValue)).
		RegisterDefaultDecoder(reflect.Array, ValueDecoderFunc(dvd.ArrayDecodeValue)).
		RegisterDefaultDecoder(reflect.Map, defaultMapCodec).
		RegisterDefaultDecoder(reflect.Slice, defaultSliceCodec).
		RegisterDefaultDecoder(reflect.String, defaultStringCodec).
		RegisterDefaultDecoder(reflect.Struct, defaultStructCodec).
		RegisterDefaultDecoder(reflect.Ptr, NewPointerCodec()).
		RegisterTypeMapEntry(bsontype.Double, tFloat64).
		RegisterTypeMapEntry(bsontype.String, tString).
		RegisterTypeMapEntry(bsontype.Array, tA).
		RegisterTypeMapEntry(bsontype.Binary, tBinary).
		RegisterTypeMapEntry(bsontype.Undefined, tUndefined).
		RegisterTypeMapEntry(bsontype.ObjectID, tOID).
		RegisterTypeMapEntry(bsontype.Boolean, tBool).
		RegisterTypeMapEntry(bsontype.DateTime, tDateTime).
		RegisterTypeMapEntry(bsontype.Regex, tRegex).
		RegisterTypeMapEntry(bsontype.DBPointer, tDBPointer).
		RegisterTypeMapEntry(bsontype.JavaScript, tJavaScript).
		RegisterTypeMapEntry(bsontype.Symbol, tSymbol).
		RegisterTypeMapEntry(bsontype.CodeWithScope, tCodeWithScope).
		RegisterTypeMapEntry(bsontype.Int32, tInt32).
		RegisterTypeMapEntry(bsontype.Int64, tInt64).
		RegisterTypeMapEntry(bsontype.Timestamp, tTimestamp).
		RegisterTypeMapEntry(bsontype.Decimal128, tDecimal).
		RegisterTypeMapEntry(bsontype.MinKey, tMinKey).
		RegisterTypeMapEntry(bsontype.MaxKey, tMaxKey).
		RegisterTypeMapEntry(bsontype.Type(0), tD).
		RegisterTypeMapEntry(bsontype.EmbeddedDocument, tD).
		RegisterHookDecoder(tValueUnmarshaler, ValueDecoderFunc(dvd.ValueUnmarshalerDecodeValue)).
		RegisterHookDecoder(tUnmarshaler, ValueDecoderFunc(dvd.UnmarshalerDecodeValue))
}

// BooleanDecodeValue is the ValueDecoderFunc for bool types.
func (dvd DefaultValueDecoders) BooleanDecodeValue(dctx DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.IsValid() || !val.CanSet() || val.Kind() != reflect.Bool {
		return ValueDecoderError{Name: "BooleanDecodeValue", Kinds: []reflect.Kind{reflect.Bool}, Received: val}
	}

	var b bool
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Int32:
		i32, err := vr.ReadInt32()
		if err != nil {
			return err
		}
		b = (i32 != 0)
	case bsontype.Int64:
		i64, err := vr.ReadInt64()
		if err != nil {
			return err
		}
		b = (i64 != 0)
	case bsontype.Double:
		f64, err := vr.ReadDouble()
		if err != nil {
			return err
		}
		b = (f64 != 0)
	case bsontype.Boolean:
		b, err = vr.ReadBoolean()
		if err != nil {
			return err
		}
	case bsontype.Null:
		if err = vr.ReadNull(); err != nil {
			return err
		}
	default:
		return fmt.Errorf("cannot decode %v into a boolean", vrType)
	}
	val.SetBool(b)
	return nil
}

// IntDecodeValue is the ValueDecoderFunc for int types.
func (dvd DefaultValueDecoders) IntDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() {
		return ValueDecoderError{
			Name:     "IntDecodeValue",
			Kinds:    []reflect.Kind{reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Int},
			Received: val,
		}
	}

	var i64 int64
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Int32:
		i32, err := vr.ReadInt32()
		if err != nil {
			return err
		}
		i64 = int64(i32)
	case bsontype.Int64:
		i64, err = vr.ReadInt64()
		if err != nil {
			return err
		}
	case bsontype.Double:
		f64, err := vr.ReadDouble()
		if err != nil {
			return err
		}
		if !dc.Truncate && math.Floor(f64) != f64 {
			return errors.New("IntDecodeValue can only truncate float64 to an integer type when truncation is enabled")
		}
		if f64 > float64(math.MaxInt64) {
			return fmt.Errorf("%g overflows int64", f64)
		}
		i64 = int64(f64)
	case bsontype.Boolean:
		b, err := vr.ReadBoolean()
		if err != nil {
			return err
		}
		if b {
			i64 = 1
		}
	case bsontype.Null:
		if err = vr.ReadNull(); err != nil {
			return err
		}
	default:
		return fmt.Errorf("cannot decode %v into an integer type", vrType)
	}

	switch val.Kind() {
	case reflect.Int8:
		if i64 < math.MinInt8 || i64 > math.MaxInt8 {
			return fmt.Errorf("%d overflows int8", i64)
		}
	case reflect.Int16:
		if i64 < math.MinInt16 || i64 > math.MaxInt16 {
			return fmt.Errorf("%d overflows int16", i64)
		}
	case reflect.Int32:
		if i64 < math.MinInt32 || i64 > math.MaxInt32 {
			return fmt.Errorf("%d overflows int32", i64)
		}
	case reflect.Int64:
	case reflect.Int:
		if int64(int(i64)) != i64 { // Can we fit this inside of an int
			return fmt.Errorf("%d overflows int", i64)
		}
	default:
		return ValueDecoderError{
			Name:     "IntDecodeValue",
			Kinds:    []reflect.Kind{reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Int},
			Received: val,
		}
	}

	val.SetInt(i64)
	return nil
}

// UintDecodeValue is the ValueDecoderFunc for uint types.
// This method is deprecated and does not have any stability guarantees. It may be removed in the
// future. Use UIntCodec.DecodeValue instead.
func (dvd DefaultValueDecoders) UintDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	var i64 int64
	var err error
	switch vr.Type() {
	case bsontype.Int32:
		i32, err := vr.ReadInt32()
		if err != nil {
			return err
		}
		i64 = int64(i32)
	case bsontype.Int64:
		i64, err = vr.ReadInt64()
		if err != nil {
			return err
		}
	case bsontype.Double:
		f64, err := vr.ReadDouble()
		if err != nil {
			return err
		}
		if !dc.Truncate && math.Floor(f64) != f64 {
			return errors.New("UintDecodeValue can only truncate float64 to an integer type when truncation is enabled")
		}
		if f64 > float64(math.MaxInt64) {
			return fmt.Errorf("%g overflows int64", f64)
		}
		i64 = int64(f64)
	case bsontype.Boolean:
		b, err := vr.ReadBoolean()
		if err != nil {
			return err
		}
		if b {
			i64 = 1
		}
	default:
		return fmt.Errorf("cannot decode %v into an integer type", vr.Type())
	}

	if !val.CanSet() {
		return ValueDecoderError{
			Name:     "UintDecodeValue",
			Kinds:    []reflect.Kind{reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uint},
			Received: val,
		}
	}

	switch val.Kind() {
	case reflect.Uint8:
		if i64 < 0 || i64 > math.MaxUint8 {
			return fmt.Errorf("%d overflows uint8", i64)
		}
	case reflect.Uint16:
		if i64 < 0 || i64 > math.MaxUint16 {
			return fmt.Errorf("%d overflows uint16", i64)
		}
	case reflect.Uint32:
		if i64 < 0 || i64 > math.MaxUint32 {
			return fmt.Errorf("%d overflows uint32", i64)
		}
	case reflect.Uint64:
		if i64 < 0 {
			return fmt.Errorf("%d overflows uint64", i64)
		}
	case reflect.Uint:
		if i64 < 0 || int64(uint(i64)) != i64 { // Can we fit this inside of an uint
			return fmt.Errorf("%d overflows uint", i64)
		}
	default:
		return ValueDecoderError{
			Name:     "UintDecodeValue",
			Kinds:    []reflect.Kind{reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uint},
			Received: val,
		}
	}

	val.SetUint(uint64(i64))
	return nil
}

// FloatDecodeValue is the ValueDecoderFunc for float types.
func (dvd DefaultValueDecoders) FloatDecodeValue(ec DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() {
		return ValueDecoderError{
			Name:     "FloatDecodeValue",
			Kinds:    []reflect.Kind{reflect.Float32, reflect.Float64},
			Received: val,
		}
	}

	var f float64
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Int32:
		i32, err := vr.ReadInt32()
		if err != nil {
			return err
		}
		f = float64(i32)
	case bsontype.Int64:
		i64, err := vr.ReadInt64()
		if err != nil {
			return err
		}
		f = float64(i64)
	case bsontype.Double:
		f, err = vr.ReadDouble()
		if err != nil {
			return err
		}
	case bsontype.Boolean:
		b, err := vr.ReadBoolean()
		if err != nil {
			return err
		}
		if b {
			f = 1
		}
	case bsontype.Null:
		if err = vr.ReadNull(); err != nil {
			return err
		}
	default:
		return fmt.Errorf("cannot decode %v into a float32 or float64 type", vrType)
	}

	switch val.Kind() {
	case reflect.Float32:
		if !ec.Truncate && float64(float32(f)) != f {
			return errors.New("FloatDecodeValue can only convert float64 to float32 when truncation is allowed")
		}
	case reflect.Float64:
	default:
		return ValueDecoderError{Name: "FloatDecodeValue", Kinds: []reflect.Kind{reflect.Float32, reflect.Float64}, Received: val}
	}

	val.SetFloat(f)
	return nil
}

// StringDecodeValue is the ValueDecoderFunc for string types.
// This method is deprecated and does not have any stability guarantees. It may be removed in the
// future. Use StringCodec.DecodeValue instead.
func (dvd DefaultValueDecoders) StringDecodeValue(dctx DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	var str string
	var err error
	switch vr.Type() {
	// TODO(GODRIVER-577): Handle JavaScript and Symbol BSON types when allowed.
	case bsontype.String:
		str, err = vr.ReadString()
		if err != nil {
			return err
		}
	default:
		return fmt.Errorf("cannot decode %v into a string type", vr.Type())
	}
	if !val.CanSet() || val.Kind() != reflect.String {
		return ValueDecoderError{Name: "StringDecodeValue", Kinds: []reflect.Kind{reflect.String}, Received: val}
	}

	val.SetString(str)
	return nil
}

// JavaScriptDecodeValue is the ValueDecoderFunc for the primitive.JavaScript type.
func (DefaultValueDecoders) JavaScriptDecodeValue(dctx DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tJavaScript {
		return ValueDecoderError{Name: "JavaScriptDecodeValue", Types: []reflect.Type{tJavaScript}, Received: val}
	}

	var js string
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.JavaScript:
		js, err = vr.ReadJavascript()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a primitive.JavaScript", vrType)
	}

	if err != nil {
		return err
	}
	val.SetString(js)
	return nil
}

// SymbolDecodeValue is the ValueDecoderFunc for the primitive.Symbol type.
func (DefaultValueDecoders) SymbolDecodeValue(dctx DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tSymbol {
		return ValueDecoderError{Name: "SymbolDecodeValue", Types: []reflect.Type{tSymbol}, Received: val}
	}

	var symbol string
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.String:
		symbol, err = vr.ReadString()
		if err != nil {
			return err
		}
	case bsontype.Symbol:
		symbol, err = vr.ReadSymbol()
		if err != nil {
			return err
		}
	case bsontype.Binary:
		data, subtype, err := vr.ReadBinary()
		if err != nil {
			return err
		}
		if subtype != bsontype.BinaryGeneric && subtype != bsontype.BinaryBinaryOld {
			return fmt.Errorf("SymbolDecodeValue can only be used to decode subtype 0x00 or 0x02 for %s, got %v", bsontype.Binary, subtype)
		}
		symbol = string(data)
	case bsontype.Null:
		if err = vr.ReadNull(); err != nil {
			return err
		}
	default:
		return fmt.Errorf("cannot decode %v into a primitive.Symbol", vrType)
	}

	val.SetString(symbol)
	return nil
}

// BinaryDecodeValue is the ValueDecoderFunc for Binary.
func (DefaultValueDecoders) BinaryDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tBinary {
		return ValueDecoderError{Name: "BinaryDecodeValue", Types: []reflect.Type{tBinary}, Received: val}
	}

	var data []byte
	var subtype byte
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Binary:
		data, subtype, err = vr.ReadBinary()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a Binary", vrType)
	}

	if err != nil {
		return err
	}
	val.Set(reflect.ValueOf(primitive.Binary{Subtype: subtype, Data: data}))
	return nil
}

// UndefinedDecodeValue is the ValueDecoderFunc for Undefined.
func (DefaultValueDecoders) UndefinedDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tUndefined {
		return ValueDecoderError{Name: "UndefinedDecodeValue", Types: []reflect.Type{tUndefined}, Received: val}
	}

	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into an Undefined", vr.Type())
	}

	if err != nil {
		return err
	}
	val.Set(reflect.ValueOf(primitive.Undefined{}))
	return nil
}

// ObjectIDDecodeValue is the ValueDecoderFunc for primitive.ObjectID.
func (dvd DefaultValueDecoders) ObjectIDDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tOID {
		return ValueDecoderError{Name: "ObjectIDDecodeValue", Types: []reflect.Type{tOID}, Received: val}
	}

	var oid primitive.ObjectID
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.ObjectID:
		oid, err = vr.ReadObjectID()
		if err != nil {
			return err
		}
	case bsontype.String:
		str, err := vr.ReadString()
		if err != nil {
			return err
		}
		if len(str) != 12 {
			return fmt.Errorf("an ObjectID string must be exactly 12 bytes long (got %v)", len(str))
		}
		byteArr := []byte(str)
		copy(oid[:], byteArr)
	case bsontype.Null:
		if err = vr.ReadNull(); err != nil {
			return err
		}
	default:
		return fmt.Errorf("cannot decode %v into an ObjectID", vrType)
	}

	val.Set(reflect.ValueOf(oid))
	return nil
}

// DateTimeDecodeValue is the ValueDecoderFunc for DateTime.
func (DefaultValueDecoders) DateTimeDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tDateTime {
		return ValueDecoderError{Name: "DateTimeDecodeValue", Types: []reflect.Type{tDateTime}, Received: val}
	}

	var dt int64
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.DateTime:
		dt, err = vr.ReadDateTime()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a DateTime", vrType)
	}

	if err != nil {
		return err
	}
	val.Set(reflect.ValueOf(primitive.DateTime(dt)))
	return nil
}

// NullDecodeValue is the ValueDecoderFunc for Null.
func (DefaultValueDecoders) NullDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tNull {
		return ValueDecoderError{Name: "NullDecodeValue", Types: []reflect.Type{tNull}, Received: val}
	}

	if vrType := vr.Type(); vrType != bsontype.Null {
		return fmt.Errorf("cannot decode %v into a Null", vrType)
	}

	val.Set(reflect.ValueOf(primitive.Null{}))
	return vr.ReadNull()
}

// RegexDecodeValue is the ValueDecoderFunc for Regex.
func (DefaultValueDecoders) RegexDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tRegex {
		return ValueDecoderError{Name: "RegexDecodeValue", Types: []reflect.Type{tRegex}, Received: val}
	}

	var pattern, options string
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Regex:
		pattern, options, err = vr.ReadRegex()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a Regex", vrType)
	}

	if err != nil {
		return err
	}
	val.Set(reflect.ValueOf(primitive.Regex{Pattern: pattern, Options: options}))
	return nil
}

// DBPointerDecodeValue is the ValueDecoderFunc for DBPointer.
func (DefaultValueDecoders) DBPointerDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tDBPointer {
		return ValueDecoderError{Name: "DBPointerDecodeValue", Types: []reflect.Type{tDBPointer}, Received: val}
	}

	var ns string
	var pointer primitive.ObjectID
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.DBPointer:
		ns, pointer, err = vr.ReadDBPointer()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a DBPointer", vrType)
	}

	if err != nil {
		return err
	}
	val.Set(reflect.ValueOf(primitive.DBPointer{DB: ns, Pointer: pointer}))
	return nil
}

// TimestampDecodeValue is the ValueDecoderFunc for Timestamp.
func (DefaultValueDecoders) TimestampDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tTimestamp {
		return ValueDecoderError{Name: "TimestampDecodeValue", Types: []reflect.Type{tTimestamp}, Received: val}
	}

	var t, incr uint32
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Timestamp:
		t, incr, err = vr.ReadTimestamp()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a Timestamp", vrType)
	}

	if err != nil {
		return err
	}
	val.Set(reflect.ValueOf(primitive.Timestamp{T: t, I: incr}))
	return nil
}

// MinKeyDecodeValue is the ValueDecoderFunc for MinKey.
func (DefaultValueDecoders) MinKeyDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tMinKey {
		return ValueDecoderError{Name: "MinKeyDecodeValue", Types: []reflect.Type{tMinKey}, Received: val}
	}

	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.MinKey:
		err = vr.ReadMinKey()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a MinKey", vr.Type())
	}

	if err != nil {
		return err
	}
	val.Set(reflect.ValueOf(primitive.MinKey{}))
	return nil
}

// MaxKeyDecodeValue is the ValueDecoderFunc for MaxKey.
func (DefaultValueDecoders) MaxKeyDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tMaxKey {
		return ValueDecoderError{Name: "MaxKeyDecodeValue", Types: []reflect.Type{tMaxKey}, Received: val}
	}

	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.MaxKey:
		err = vr.ReadMaxKey()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a MaxKey", vr.Type())
	}

	if err != nil {
		return err
	}
	val.Set(reflect.ValueOf(primitive.MaxKey{}))
	return nil
}

// Decimal128DecodeValue is the ValueDecoderFunc for primitive.Decimal128.
func (dvd DefaultValueDecoders) Decimal128DecodeValue(dctx DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tDecimal {
		return ValueDecoderError{Name: "Decimal128DecodeValue", Types: []reflect.Type{tDecimal}, Received: val}
	}

	var d128 primitive.Decimal128
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Decimal128:
		d128, err = vr.ReadDecimal128()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a primitive.Decimal128", vr.Type())
	}

	if err != nil {
		return err
	}
	val.Set(reflect.ValueOf(d128))
	return err
}

// JSONNumberDecodeValue is the ValueDecoderFunc for json.Number.
func (dvd DefaultValueDecoders) JSONNumberDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tJSONNumber {
		return ValueDecoderError{Name: "JSONNumberDecodeValue", Types: []reflect.Type{tJSONNumber}, Received: val}
	}

	switch vrType := vr.Type(); vrType {
	case bsontype.Double:
		f64, err := vr.ReadDouble()
		if err != nil {
			return err
		}
		val.Set(reflect.ValueOf(json.Number(strconv.FormatFloat(f64, 'f', -1, 64))))
	case bsontype.Int32:
		i32, err := vr.ReadInt32()
		if err != nil {
			return err
		}
		val.Set(reflect.ValueOf(json.Number(strconv.FormatInt(int64(i32), 10))))
	case bsontype.Int64:
		i64, err := vr.ReadInt64()
		if err != nil {
			return err
		}
		val.Set(reflect.ValueOf(json.Number(strconv.FormatInt(i64, 10))))
	case bsontype.Null:
		if err := vr.ReadNull(); err != nil {
			return err
		}
		val.SetString("")
	default:
		return fmt.Errorf("cannot decode %v into a json.Number", vrType)
	}

	return nil
}

// URLDecodeValue is the ValueDecoderFunc for url.URL.
func (dvd DefaultValueDecoders) URLDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tURL {
		return ValueDecoderError{Name: "URLDecodeValue", Types: []reflect.Type{tURL}, Received: val}
	}

	switch vrType := vr.Type(); vrType {
	case bsontype.String:
		str, err := vr.ReadString()
		if err != nil {
			return err
		}

		parsedURL, err := url.Parse(str)
		if err != nil {
			return err
		}
		val.Set(reflect.ValueOf(parsedURL).Elem())
		return nil
	case bsontype.Null:
		if err := vr.ReadNull(); err != nil {
			return err
		}
		val.Set(reflect.ValueOf(url.URL{}))
		return nil
	default:
		return fmt.Errorf("cannot decode %v into a *url.URL", vrType)
	}
}

// TimeDecodeValue is the ValueDecoderFunc for time.Time.
// This method is deprecated and does not have any stability guarantees. It may be removed in the
// future. Use Time.DecodeValue instead.
func (dvd DefaultValueDecoders) TimeDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if vr.Type() != bsontype.DateTime {
		return fmt.Errorf("cannot decode %v into a time.Time", vr.Type())
	}

	dt, err := vr.ReadDateTime()
	if err != nil {
		return err
	}

	if !val.CanSet() || val.Type() != tTime {
		return ValueDecoderError{Name: "TimeDecodeValue", Types: []reflect.Type{tTime}, Received: val}
	}

	val.Set(reflect.ValueOf(time.Unix(dt/1000, dt%1000*1000000).UTC()))
	return nil
}

// ByteSliceDecodeValue is the ValueDecoderFunc for []byte.
// This method is deprecated and does not have any stability guarantees. It may be removed in the
// future. Use ByteSliceCodec.DecodeValue instead.
func (dvd DefaultValueDecoders) ByteSliceDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if vr.Type() != bsontype.Binary && vr.Type() != bsontype.Null {
		return fmt.Errorf("cannot decode %v into a []byte", vr.Type())
	}

	if !val.CanSet() || val.Type() != tByteSlice {
		return ValueDecoderError{Name: "ByteSliceDecodeValue", Types: []reflect.Type{tByteSlice}, Received: val}
	}

	if vr.Type() == bsontype.Null {
		val.Set(reflect.Zero(val.Type()))
		return vr.ReadNull()
	}

	data, subtype, err := vr.ReadBinary()
	if err != nil {
		return err
	}
	if subtype != 0x00 {
		return fmt.Errorf("ByteSliceDecodeValue can only be used to decode subtype 0x00 for %s, got %v", bsontype.Binary, subtype)
	}

	val.Set(reflect.ValueOf(data))
	return nil
}

// MapDecodeValue is the ValueDecoderFunc for map[string]* types.
// This method is deprecated and does not have any stability guarantees. It may be removed in the
// future. Use Map.DecodeValue instead.
func (dvd DefaultValueDecoders) MapDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Kind() != reflect.Map || val.Type().Key().Kind() != reflect.String {
		return ValueDecoderError{Name: "MapDecodeValue", Kinds: []reflect.Kind{reflect.Map}, Received: val}
	}

	switch vr.Type() {
	case bsontype.Type(0), bsontype.EmbeddedDocument:
	case bsontype.Null:
		val.Set(reflect.Zero(val.Type()))
		return vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a %s", vr.Type(), val.Type())
	}

	dr, err := vr.ReadDocument()
	if err != nil {
		return err
	}

	if val.IsNil() {
		val.Set(reflect.MakeMap(val.Type()))
	}

	eType := val.Type().Elem()
	decoder, err := dc.LookupDecoder(eType)
	if err != nil {
		return err
	}

	if eType == tEmpty {
		dc.Ancestor = val.Type()
	}

	keyType := val.Type().Key()
	for {
		key, vr, err := dr.ReadElement()
		if err == bsonrw.ErrEOD {
			break
		}
		if err != nil {
			return err
		}

		elem := reflect.New(eType).Elem()

		err = decoder.DecodeValue(dc, vr, elem)
		if err != nil {
			return err
		}

		val.SetMapIndex(reflect.ValueOf(key).Convert(keyType), elem)
	}
	return nil
}

// ArrayDecodeValue is the ValueDecoderFunc for array types.
func (dvd DefaultValueDecoders) ArrayDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.IsValid() || val.Kind() != reflect.Array {
		return ValueDecoderError{Name: "ArrayDecodeValue", Kinds: []reflect.Kind{reflect.Array}, Received: val}
	}

	switch vrType := vr.Type(); vrType {
	case bsontype.Array:
	case bsontype.Type(0), bsontype.EmbeddedDocument:
		if val.Type().Elem() != tE {
			return fmt.Errorf("cannot decode document into %s", val.Type())
		}
	case bsontype.Binary:
		if val.Type().Elem() != tByte {
			return fmt.Errorf("ArrayDecodeValue can only be used to decode binary into a byte array, got %v", vrType)
		}
		data, subtype, err := vr.ReadBinary()
		if err != nil {
			return err
		}
		if subtype != bsontype.BinaryGeneric && subtype != bsontype.BinaryBinaryOld {
			return fmt.Errorf("ArrayDecodeValue can only be used to decode subtype 0x00 or 0x02 for %s, got %v", bsontype.Binary, subtype)
		}

		if len(data) > val.Len() {
			return fmt.Errorf("more elements returned in array than can fit inside %s", val.Type())
		}

		for idx, elem := range data {
			val.Index(idx).Set(reflect.ValueOf(elem))
		}
		return nil
	case bsontype.Null:
		val.Set(reflect.Zero(val.Type()))
		return vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into an array", vrType)
	}

	var elemsFunc func(DecodeContext, bsonrw.ValueReader, reflect.Value) ([]reflect.Value, error)
	switch val.Type().Elem() {
	case tE:
		elemsFunc = dvd.decodeD
	default:
		elemsFunc = dvd.decodeDefault
	}

	elems, err := elemsFunc(dc, vr, val)
	if err != nil {
		return err
	}

	if len(elems) > val.Len() {
		return fmt.Errorf("more elements returned in array than can fit inside %s, got %v elements", val.Type(), len(elems))
	}

	for idx, elem := range elems {
		val.Index(idx).Set(elem)
	}

	return nil
}

// SliceDecodeValue is the ValueDecoderFunc for slice types.
// This method is deprecated and does not have any stability guarantees. It may be removed in the
// future. Use SliceCodec.DecodeValue instead.
func (dvd DefaultValueDecoders) SliceDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Kind() != reflect.Slice {
		return ValueDecoderError{Name: "SliceDecodeValue", Kinds: []reflect.Kind{reflect.Slice}, Received: val}
	}

	switch vr.Type() {
	case bsontype.Array:
	case bsontype.Null:
		val.Set(reflect.Zero(val.Type()))
		return vr.ReadNull()
	case bsontype.Type(0), bsontype.EmbeddedDocument:
		if val.Type().Elem() != tE {
			return fmt.Errorf("cannot decode document into %s", val.Type())
		}
	default:
		return fmt.Errorf("cannot decode %v into a slice", vr.Type())
	}

	var elemsFunc func(DecodeContext, bsonrw.ValueReader, reflect.Value) ([]reflect.Value, error)
	switch val.Type().Elem() {
	case tE:
		dc.Ancestor = val.Type()
		elemsFunc = dvd.decodeD
	default:
		elemsFunc = dvd.decodeDefault
	}

	elems, err := elemsFunc(dc, vr, val)
	if err != nil {
		return err
	}

	if val.IsNil() {
		val.Set(reflect.MakeSlice(val.Type(), 0, len(elems)))
	}

	val.SetLen(0)
	val.Set(reflect.Append(val, elems...))

	return nil
}

// ValueUnmarshalerDecodeValue is the ValueDecoderFunc for ValueUnmarshaler implementations.
func (dvd DefaultValueDecoders) ValueUnmarshalerDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.IsValid() || (!val.Type().Implements(tValueUnmarshaler) && !reflect.PtrTo(val.Type()).Implements(tValueUnmarshaler)) {
		return ValueDecoderError{Name: "ValueUnmarshalerDecodeValue", Types: []reflect.Type{tValueUnmarshaler}, Received: val}
	}

	if val.Kind() == reflect.Ptr && val.IsNil() {
		if !val.CanSet() {
			return ValueDecoderError{Name: "ValueUnmarshalerDecodeValue", Types: []reflect.Type{tValueUnmarshaler}, Received: val}
		}
		val.Set(reflect.New(val.Type().Elem()))
	}

	if !val.Type().Implements(tValueUnmarshaler) {
		if !val.CanAddr() {
			return ValueDecoderError{Name: "ValueUnmarshalerDecodeValue", Types: []reflect.Type{tValueUnmarshaler}, Received: val}
		}
		val = val.Addr() // If they type doesn't implement the interface, a pointer to it must.
	}

	t, src, err := bsonrw.Copier{}.CopyValueToBytes(vr)
	if err != nil {
		return err
	}

	fn := val.Convert(tValueUnmarshaler).MethodByName("UnmarshalBSONValue")
	errVal := fn.Call([]reflect.Value{reflect.ValueOf(t), reflect.ValueOf(src)})[0]
	if !errVal.IsNil() {
		return errVal.Interface().(error)
	}
	return nil
}

// UnmarshalerDecodeValue is the ValueDecoderFunc for Unmarshaler implementations.
func (dvd DefaultValueDecoders) UnmarshalerDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.IsValid() || (!val.Type().Implements(tUnmarshaler) && !reflect.PtrTo(val.Type()).Implements(tUnmarshaler)) {
		return ValueDecoderError{Name: "UnmarshalerDecodeValue", Types: []reflect.Type{tUnmarshaler}, Received: val}
	}

	if val.Kind() == reflect.Ptr && val.IsNil() {
		if !val.CanSet() {
			return ValueDecoderError{Name: "UnmarshalerDecodeValue", Types: []reflect.Type{tUnmarshaler}, Received: val}
		}
		val.Set(reflect.New(val.Type().Elem()))
	}

	if !val.Type().Implements(tUnmarshaler) {
		if !val.CanAddr() {
			return ValueDecoderError{Name: "UnmarshalerDecodeValue", Types: []reflect.Type{tUnmarshaler}, Received: val}
		}
		val = val.Addr() // If they type doesn't implement the interface, a pointer to it must.
	}

	_, src, err := bsonrw.Copier{}.CopyValueToBytes(vr)
	if err != nil {
		return err
	}

	fn := val.Convert(tUnmarshaler).MethodByName("UnmarshalBSON")
	errVal := fn.Call([]reflect.Value{reflect.ValueOf(src)})[0]
	if !errVal.IsNil() {
		return errVal.Interface().(error)
	}
	return nil
}

// EmptyInterfaceDecodeValue is the ValueDecoderFunc for interface{}.
// This method is deprecated and does not have any stability guarantees. It may be removed in the
// future. Use EmptyInterfaceCodec.DecodeValue instead.
func (dvd DefaultValueDecoders) EmptyInterfaceDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tEmpty {
		return ValueDecoderError{Name: "EmptyInterfaceDecodeValue", Types: []reflect.Type{tEmpty}, Received: val}
	}

	rtype, err := dc.LookupTypeMapEntry(vr.Type())
	if err != nil {
		switch vr.Type() {
		case bsontype.EmbeddedDocument:
			if dc.Ancestor != nil {
				rtype = dc.Ancestor
				break
			}
			rtype = tD
		case bsontype.Null:
			val.Set(reflect.Zero(val.Type()))
			return vr.ReadNull()
		default:
			return err
		}
	}

	decoder, err := dc.LookupDecoder(rtype)
	if err != nil {
		return err
	}

	elem := reflect.New(rtype).Elem()
	err = decoder.DecodeValue(dc, vr, elem)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

// CoreDocumentDecodeValue is the ValueDecoderFunc for bsoncore.Document.
func (DefaultValueDecoders) CoreDocumentDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tCoreDocument {
		return ValueDecoderError{Name: "CoreDocumentDecodeValue", Types: []reflect.Type{tCoreDocument}, Received: val}
	}

	if val.IsNil() {
		val.Set(reflect.MakeSlice(val.Type(), 0, 0))
	}

	val.SetLen(0)

	cdoc, err := bsonrw.Copier{}.AppendDocumentBytes(val.Interface().(bsoncore.Document), vr)
	val.Set(reflect.ValueOf(cdoc))
	return err
}

func (dvd DefaultValueDecoders) decodeDefault(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) ([]reflect.Value, error) {
	elems := make([]reflect.Value, 0)

	ar, err := vr.ReadArray()
	if err != nil {
		return nil, err
	}

	eType := val.Type().Elem()

	decoder, err := dc.LookupDecoder(eType)
	if err != nil {
		return nil, err
	}

	for {
		vr, err := ar.ReadValue()
		if err == bsonrw.ErrEOA {
			break
		}
		if err != nil {
			return nil, err
		}

		elem := reflect.New(eType).Elem()

		err = decoder.DecodeValue(dc, vr, elem)
		if err != nil {
			return nil, err
		}
		elems = append(elems, elem)
	}

	return elems, nil
}

// CodeWithScopeDecodeValue is the ValueDecoderFunc for CodeWithScope.
func (dvd DefaultValueDecoders) CodeWithScopeDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tCodeWithScope {
		return ValueDecoderError{Name: "CodeWithScopeDecodeValue", Types: []reflect.Type{tCodeWithScope}, Received: val}
	}

	switch vrType := vr.Type(); vrType {
	case bsontype.CodeWithScope:
		code, dr, err := vr.ReadCodeWithScope()
		if err != nil {
			return err
		}

		scope := reflect.New(tD).Elem()
		elems, err := dvd.decodeElemsFromDocumentReader(dc, dr)
		if err != nil {
			return err
		}

		scope.Set(reflect.MakeSlice(tD, 0, len(elems)))
		scope.Set(reflect.Append(scope, elems...))

		val.Set(reflect.ValueOf(primitive.CodeWithScope{
			Code:  primitive.JavaScript(code),
			Scope: scope.Interface().(primitive.D),
		}))
		return nil
	case bsontype.Null:
		if err := vr.ReadNull(); err != nil {
			return err
		}
		val.Set(reflect.ValueOf(primitive.CodeWithScope{}))
		return nil
	default:
		return fmt.Errorf("cannot decode %v into a primitive.CodeWithScope", vrType)
	}
}

func (dvd DefaultValueDecoders) decodeD(dc DecodeContext, vr bsonrw.ValueReader, _ reflect.Value) ([]reflect.Value, error) {
	switch vr.Type() {
	case bsontype.Type(0), bsontype.EmbeddedDocument:
	default:
		return nil, fmt.Errorf("cannot decode %v into a D", vr.Type())
	}

	dr, err := vr.ReadDocument()
	if err != nil {
		return nil, err
	}

	return dvd.decodeElemsFromDocumentReader(dc, dr)
}

func (DefaultValueDecoders) decodeElemsFromDocumentReader(dc DecodeContext, dr bsonrw.DocumentReader) ([]reflect.Value, error) {
	decoder, err := dc.LookupDecoder(tEmpty)
	if err != nil {
		return nil, err
	}

	elems := make([]reflect.Value, 0)
	for {
		key, vr, err := dr.ReadElement()
		if err == bsonrw.ErrEOD {
			break
		}
		if err != nil {
			return nil, err
		}

		val := reflect.New(tEmpty).Elem()
		err = decoder.DecodeValue(dc, vr, val)
		if err != nil {
			return nil, err
		}

		elems = append(elems, reflect.ValueOf(primitive.E{Key: key, Value: val.Interface()}))
	}

	return elems, nil
}
