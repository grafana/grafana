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

var (
	defaultValueDecoders DefaultValueDecoders
	errCannotTruncate    = errors.New("float64 can only be truncated to a lower precision type when truncation is enabled")
)

type decodeBinaryError struct {
	subtype  byte
	typeName string
}

func (d decodeBinaryError) Error() string {
	return fmt.Sprintf("only binary values with subtype 0x00 or 0x02 can be decoded into %s, but got subtype %v", d.typeName, d.subtype)
}

func newDefaultStructCodec() *StructCodec {
	codec, err := NewStructCodec(DefaultStructTagParser)
	if err != nil {
		// This function is called from the codec registration path, so errors can't be propagated. If there's an error
		// constructing the StructCodec, we panic to avoid losing it.
		panic(fmt.Errorf("error creating default StructCodec: %w", err))
	}
	return codec
}

// DefaultValueDecoders is a namespace type for the default ValueDecoders used
// when creating a registry.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
type DefaultValueDecoders struct{}

// RegisterDefaultDecoders will register the decoder methods attached to DefaultValueDecoders with
// the provided RegistryBuilder.
//
// There is no support for decoding map[string]interface{} because there is no decoder for
// interface{}, so users must either register this decoder themselves or use the
// EmptyInterfaceDecoder available in the bson package.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) RegisterDefaultDecoders(rb *RegistryBuilder) {
	if rb == nil {
		panic(errors.New("argument to RegisterDefaultDecoders must not be nil"))
	}

	intDecoder := decodeAdapter{dvd.IntDecodeValue, dvd.intDecodeType}
	floatDecoder := decodeAdapter{dvd.FloatDecodeValue, dvd.floatDecodeType}

	rb.
		RegisterTypeDecoder(tD, ValueDecoderFunc(dvd.DDecodeValue)).
		RegisterTypeDecoder(tBinary, decodeAdapter{dvd.BinaryDecodeValue, dvd.binaryDecodeType}).
		RegisterTypeDecoder(tUndefined, decodeAdapter{dvd.UndefinedDecodeValue, dvd.undefinedDecodeType}).
		RegisterTypeDecoder(tDateTime, decodeAdapter{dvd.DateTimeDecodeValue, dvd.dateTimeDecodeType}).
		RegisterTypeDecoder(tNull, decodeAdapter{dvd.NullDecodeValue, dvd.nullDecodeType}).
		RegisterTypeDecoder(tRegex, decodeAdapter{dvd.RegexDecodeValue, dvd.regexDecodeType}).
		RegisterTypeDecoder(tDBPointer, decodeAdapter{dvd.DBPointerDecodeValue, dvd.dBPointerDecodeType}).
		RegisterTypeDecoder(tTimestamp, decodeAdapter{dvd.TimestampDecodeValue, dvd.timestampDecodeType}).
		RegisterTypeDecoder(tMinKey, decodeAdapter{dvd.MinKeyDecodeValue, dvd.minKeyDecodeType}).
		RegisterTypeDecoder(tMaxKey, decodeAdapter{dvd.MaxKeyDecodeValue, dvd.maxKeyDecodeType}).
		RegisterTypeDecoder(tJavaScript, decodeAdapter{dvd.JavaScriptDecodeValue, dvd.javaScriptDecodeType}).
		RegisterTypeDecoder(tSymbol, decodeAdapter{dvd.SymbolDecodeValue, dvd.symbolDecodeType}).
		RegisterTypeDecoder(tByteSlice, defaultByteSliceCodec).
		RegisterTypeDecoder(tTime, defaultTimeCodec).
		RegisterTypeDecoder(tEmpty, defaultEmptyInterfaceCodec).
		RegisterTypeDecoder(tCoreArray, defaultArrayCodec).
		RegisterTypeDecoder(tOID, decodeAdapter{dvd.ObjectIDDecodeValue, dvd.objectIDDecodeType}).
		RegisterTypeDecoder(tDecimal, decodeAdapter{dvd.Decimal128DecodeValue, dvd.decimal128DecodeType}).
		RegisterTypeDecoder(tJSONNumber, decodeAdapter{dvd.JSONNumberDecodeValue, dvd.jsonNumberDecodeType}).
		RegisterTypeDecoder(tURL, decodeAdapter{dvd.URLDecodeValue, dvd.urlDecodeType}).
		RegisterTypeDecoder(tCoreDocument, ValueDecoderFunc(dvd.CoreDocumentDecodeValue)).
		RegisterTypeDecoder(tCodeWithScope, decodeAdapter{dvd.CodeWithScopeDecodeValue, dvd.codeWithScopeDecodeType}).
		RegisterDefaultDecoder(reflect.Bool, decodeAdapter{dvd.BooleanDecodeValue, dvd.booleanDecodeType}).
		RegisterDefaultDecoder(reflect.Int, intDecoder).
		RegisterDefaultDecoder(reflect.Int8, intDecoder).
		RegisterDefaultDecoder(reflect.Int16, intDecoder).
		RegisterDefaultDecoder(reflect.Int32, intDecoder).
		RegisterDefaultDecoder(reflect.Int64, intDecoder).
		RegisterDefaultDecoder(reflect.Uint, defaultUIntCodec).
		RegisterDefaultDecoder(reflect.Uint8, defaultUIntCodec).
		RegisterDefaultDecoder(reflect.Uint16, defaultUIntCodec).
		RegisterDefaultDecoder(reflect.Uint32, defaultUIntCodec).
		RegisterDefaultDecoder(reflect.Uint64, defaultUIntCodec).
		RegisterDefaultDecoder(reflect.Float32, floatDecoder).
		RegisterDefaultDecoder(reflect.Float64, floatDecoder).
		RegisterDefaultDecoder(reflect.Array, ValueDecoderFunc(dvd.ArrayDecodeValue)).
		RegisterDefaultDecoder(reflect.Map, defaultMapCodec).
		RegisterDefaultDecoder(reflect.Slice, defaultSliceCodec).
		RegisterDefaultDecoder(reflect.String, defaultStringCodec).
		RegisterDefaultDecoder(reflect.Struct, newDefaultStructCodec()).
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

// DDecodeValue is the ValueDecoderFunc for primitive.D instances.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) DDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.IsValid() || !val.CanSet() || val.Type() != tD {
		return ValueDecoderError{Name: "DDecodeValue", Kinds: []reflect.Kind{reflect.Slice}, Received: val}
	}

	switch vrType := vr.Type(); vrType {
	case bsontype.Type(0), bsontype.EmbeddedDocument:
		dc.Ancestor = tD
	case bsontype.Null:
		val.Set(reflect.Zero(val.Type()))
		return vr.ReadNull()
	default:
		return fmt.Errorf("cannot decode %v into a primitive.D", vrType)
	}

	dr, err := vr.ReadDocument()
	if err != nil {
		return err
	}

	decoder, err := dc.LookupDecoder(tEmpty)
	if err != nil {
		return err
	}
	tEmptyTypeDecoder, _ := decoder.(typeDecoder)

	// Use the elements in the provided value if it's non nil. Otherwise, allocate a new D instance.
	var elems primitive.D
	if !val.IsNil() {
		val.SetLen(0)
		elems = val.Interface().(primitive.D)
	} else {
		elems = make(primitive.D, 0)
	}

	for {
		key, elemVr, err := dr.ReadElement()
		if errors.Is(err, bsonrw.ErrEOD) {
			break
		} else if err != nil {
			return err
		}

		// Pass false for convert because we don't need to call reflect.Value.Convert for tEmpty.
		elem, err := decodeTypeOrValueWithInfo(decoder, tEmptyTypeDecoder, dc, elemVr, tEmpty, false)
		if err != nil {
			return err
		}

		elems = append(elems, primitive.E{Key: key, Value: elem.Interface()})
	}

	val.Set(reflect.ValueOf(elems))
	return nil
}

func (dvd DefaultValueDecoders) booleanDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t.Kind() != reflect.Bool {
		return emptyValue, ValueDecoderError{
			Name:     "BooleanDecodeValue",
			Kinds:    []reflect.Kind{reflect.Bool},
			Received: reflect.Zero(t),
		}
	}

	var b bool
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Int32:
		i32, err := vr.ReadInt32()
		if err != nil {
			return emptyValue, err
		}
		b = (i32 != 0)
	case bsontype.Int64:
		i64, err := vr.ReadInt64()
		if err != nil {
			return emptyValue, err
		}
		b = (i64 != 0)
	case bsontype.Double:
		f64, err := vr.ReadDouble()
		if err != nil {
			return emptyValue, err
		}
		b = (f64 != 0)
	case bsontype.Boolean:
		b, err = vr.ReadBoolean()
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a boolean", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(b), nil
}

// BooleanDecodeValue is the ValueDecoderFunc for bool types.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) BooleanDecodeValue(dctx DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.IsValid() || !val.CanSet() || val.Kind() != reflect.Bool {
		return ValueDecoderError{Name: "BooleanDecodeValue", Kinds: []reflect.Kind{reflect.Bool}, Received: val}
	}

	elem, err := dvd.booleanDecodeType(dctx, vr, val.Type())
	if err != nil {
		return err
	}

	val.SetBool(elem.Bool())
	return nil
}

func (DefaultValueDecoders) intDecodeType(dc DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	var i64 int64
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Int32:
		i32, err := vr.ReadInt32()
		if err != nil {
			return emptyValue, err
		}
		i64 = int64(i32)
	case bsontype.Int64:
		i64, err = vr.ReadInt64()
		if err != nil {
			return emptyValue, err
		}
	case bsontype.Double:
		f64, err := vr.ReadDouble()
		if err != nil {
			return emptyValue, err
		}
		if !dc.Truncate && math.Floor(f64) != f64 {
			return emptyValue, errCannotTruncate
		}
		if f64 > float64(math.MaxInt64) {
			return emptyValue, fmt.Errorf("%g overflows int64", f64)
		}
		i64 = int64(f64)
	case bsontype.Boolean:
		b, err := vr.ReadBoolean()
		if err != nil {
			return emptyValue, err
		}
		if b {
			i64 = 1
		}
	case bsontype.Null:
		if err = vr.ReadNull(); err != nil {
			return emptyValue, err
		}
	case bsontype.Undefined:
		if err = vr.ReadUndefined(); err != nil {
			return emptyValue, err
		}
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into an integer type", vrType)
	}

	switch t.Kind() {
	case reflect.Int8:
		if i64 < math.MinInt8 || i64 > math.MaxInt8 {
			return emptyValue, fmt.Errorf("%d overflows int8", i64)
		}

		return reflect.ValueOf(int8(i64)), nil
	case reflect.Int16:
		if i64 < math.MinInt16 || i64 > math.MaxInt16 {
			return emptyValue, fmt.Errorf("%d overflows int16", i64)
		}

		return reflect.ValueOf(int16(i64)), nil
	case reflect.Int32:
		if i64 < math.MinInt32 || i64 > math.MaxInt32 {
			return emptyValue, fmt.Errorf("%d overflows int32", i64)
		}

		return reflect.ValueOf(int32(i64)), nil
	case reflect.Int64:
		return reflect.ValueOf(i64), nil
	case reflect.Int:
		if i64 > math.MaxInt { // Can we fit this inside of an int
			return emptyValue, fmt.Errorf("%d overflows int", i64)
		}

		return reflect.ValueOf(int(i64)), nil
	default:
		return emptyValue, ValueDecoderError{
			Name:     "IntDecodeValue",
			Kinds:    []reflect.Kind{reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Int},
			Received: reflect.Zero(t),
		}
	}
}

// IntDecodeValue is the ValueDecoderFunc for int types.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) IntDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() {
		return ValueDecoderError{
			Name:     "IntDecodeValue",
			Kinds:    []reflect.Kind{reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Int},
			Received: val,
		}
	}

	elem, err := dvd.intDecodeType(dc, vr, val.Type())
	if err != nil {
		return err
	}

	val.SetInt(elem.Int())
	return nil
}

// UintDecodeValue is the ValueDecoderFunc for uint types.
//
// Deprecated: UintDecodeValue is not registered by default. Use UintCodec.DecodeValue instead.
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
		if i64 < 0 || uint64(i64) > uint64(math.MaxUint) { // Can we fit this inside of an uint
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

func (dvd DefaultValueDecoders) floatDecodeType(dc DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	var f float64
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Int32:
		i32, err := vr.ReadInt32()
		if err != nil {
			return emptyValue, err
		}
		f = float64(i32)
	case bsontype.Int64:
		i64, err := vr.ReadInt64()
		if err != nil {
			return emptyValue, err
		}
		f = float64(i64)
	case bsontype.Double:
		f, err = vr.ReadDouble()
		if err != nil {
			return emptyValue, err
		}
	case bsontype.Boolean:
		b, err := vr.ReadBoolean()
		if err != nil {
			return emptyValue, err
		}
		if b {
			f = 1
		}
	case bsontype.Null:
		if err = vr.ReadNull(); err != nil {
			return emptyValue, err
		}
	case bsontype.Undefined:
		if err = vr.ReadUndefined(); err != nil {
			return emptyValue, err
		}
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a float32 or float64 type", vrType)
	}

	switch t.Kind() {
	case reflect.Float32:
		if !dc.Truncate && float64(float32(f)) != f {
			return emptyValue, errCannotTruncate
		}

		return reflect.ValueOf(float32(f)), nil
	case reflect.Float64:
		return reflect.ValueOf(f), nil
	default:
		return emptyValue, ValueDecoderError{
			Name:     "FloatDecodeValue",
			Kinds:    []reflect.Kind{reflect.Float32, reflect.Float64},
			Received: reflect.Zero(t),
		}
	}
}

// FloatDecodeValue is the ValueDecoderFunc for float types.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) FloatDecodeValue(ec DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() {
		return ValueDecoderError{
			Name:     "FloatDecodeValue",
			Kinds:    []reflect.Kind{reflect.Float32, reflect.Float64},
			Received: val,
		}
	}

	elem, err := dvd.floatDecodeType(ec, vr, val.Type())
	if err != nil {
		return err
	}

	val.SetFloat(elem.Float())
	return nil
}

// StringDecodeValue is the ValueDecoderFunc for string types.
//
// Deprecated: StringDecodeValue is not registered by default. Use StringCodec.DecodeValue instead.
func (dvd DefaultValueDecoders) StringDecodeValue(_ DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
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

func (DefaultValueDecoders) javaScriptDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tJavaScript {
		return emptyValue, ValueDecoderError{
			Name:     "JavaScriptDecodeValue",
			Types:    []reflect.Type{tJavaScript},
			Received: reflect.Zero(t),
		}
	}

	var js string
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.JavaScript:
		js, err = vr.ReadJavascript()
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a primitive.JavaScript", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.JavaScript(js)), nil
}

// JavaScriptDecodeValue is the ValueDecoderFunc for the primitive.JavaScript type.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) JavaScriptDecodeValue(dctx DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tJavaScript {
		return ValueDecoderError{Name: "JavaScriptDecodeValue", Types: []reflect.Type{tJavaScript}, Received: val}
	}

	elem, err := dvd.javaScriptDecodeType(dctx, vr, tJavaScript)
	if err != nil {
		return err
	}

	val.SetString(elem.String())
	return nil
}

func (DefaultValueDecoders) symbolDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tSymbol {
		return emptyValue, ValueDecoderError{
			Name:     "SymbolDecodeValue",
			Types:    []reflect.Type{tSymbol},
			Received: reflect.Zero(t),
		}
	}

	var symbol string
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.String:
		symbol, err = vr.ReadString()
	case bsontype.Symbol:
		symbol, err = vr.ReadSymbol()
	case bsontype.Binary:
		data, subtype, err := vr.ReadBinary()
		if err != nil {
			return emptyValue, err
		}

		if subtype != bsontype.BinaryGeneric && subtype != bsontype.BinaryBinaryOld {
			return emptyValue, decodeBinaryError{subtype: subtype, typeName: "primitive.Symbol"}
		}
		symbol = string(data)
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a primitive.Symbol", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.Symbol(symbol)), nil
}

// SymbolDecodeValue is the ValueDecoderFunc for the primitive.Symbol type.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) SymbolDecodeValue(dctx DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tSymbol {
		return ValueDecoderError{Name: "SymbolDecodeValue", Types: []reflect.Type{tSymbol}, Received: val}
	}

	elem, err := dvd.symbolDecodeType(dctx, vr, tSymbol)
	if err != nil {
		return err
	}

	val.SetString(elem.String())
	return nil
}

func (DefaultValueDecoders) binaryDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tBinary {
		return emptyValue, ValueDecoderError{
			Name:     "BinaryDecodeValue",
			Types:    []reflect.Type{tBinary},
			Received: reflect.Zero(t),
		}
	}

	var data []byte
	var subtype byte
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Binary:
		data, subtype, err = vr.ReadBinary()
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a Binary", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.Binary{Subtype: subtype, Data: data}), nil
}

// BinaryDecodeValue is the ValueDecoderFunc for Binary.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) BinaryDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tBinary {
		return ValueDecoderError{Name: "BinaryDecodeValue", Types: []reflect.Type{tBinary}, Received: val}
	}

	elem, err := dvd.binaryDecodeType(dc, vr, tBinary)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (DefaultValueDecoders) undefinedDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tUndefined {
		return emptyValue, ValueDecoderError{
			Name:     "UndefinedDecodeValue",
			Types:    []reflect.Type{tUndefined},
			Received: reflect.Zero(t),
		}
	}

	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into an Undefined", vr.Type())
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.Undefined{}), nil
}

// UndefinedDecodeValue is the ValueDecoderFunc for Undefined.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) UndefinedDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tUndefined {
		return ValueDecoderError{Name: "UndefinedDecodeValue", Types: []reflect.Type{tUndefined}, Received: val}
	}

	elem, err := dvd.undefinedDecodeType(dc, vr, tUndefined)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

// Accept both 12-byte string and pretty-printed 24-byte hex string formats.
func (dvd DefaultValueDecoders) objectIDDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tOID {
		return emptyValue, ValueDecoderError{
			Name:     "ObjectIDDecodeValue",
			Types:    []reflect.Type{tOID},
			Received: reflect.Zero(t),
		}
	}

	var oid primitive.ObjectID
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.ObjectID:
		oid, err = vr.ReadObjectID()
		if err != nil {
			return emptyValue, err
		}
	case bsontype.String:
		str, err := vr.ReadString()
		if err != nil {
			return emptyValue, err
		}
		if oid, err = primitive.ObjectIDFromHex(str); err == nil {
			break
		}
		if len(str) != 12 {
			return emptyValue, fmt.Errorf("an ObjectID string must be exactly 12 bytes long (got %v)", len(str))
		}
		byteArr := []byte(str)
		copy(oid[:], byteArr)
	case bsontype.Null:
		if err = vr.ReadNull(); err != nil {
			return emptyValue, err
		}
	case bsontype.Undefined:
		if err = vr.ReadUndefined(); err != nil {
			return emptyValue, err
		}
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into an ObjectID", vrType)
	}

	return reflect.ValueOf(oid), nil
}

// ObjectIDDecodeValue is the ValueDecoderFunc for primitive.ObjectID.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) ObjectIDDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tOID {
		return ValueDecoderError{Name: "ObjectIDDecodeValue", Types: []reflect.Type{tOID}, Received: val}
	}

	elem, err := dvd.objectIDDecodeType(dc, vr, tOID)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (DefaultValueDecoders) dateTimeDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tDateTime {
		return emptyValue, ValueDecoderError{
			Name:     "DateTimeDecodeValue",
			Types:    []reflect.Type{tDateTime},
			Received: reflect.Zero(t),
		}
	}

	var dt int64
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.DateTime:
		dt, err = vr.ReadDateTime()
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a DateTime", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.DateTime(dt)), nil
}

// DateTimeDecodeValue is the ValueDecoderFunc for DateTime.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) DateTimeDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tDateTime {
		return ValueDecoderError{Name: "DateTimeDecodeValue", Types: []reflect.Type{tDateTime}, Received: val}
	}

	elem, err := dvd.dateTimeDecodeType(dc, vr, tDateTime)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (DefaultValueDecoders) nullDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tNull {
		return emptyValue, ValueDecoderError{
			Name:     "NullDecodeValue",
			Types:    []reflect.Type{tNull},
			Received: reflect.Zero(t),
		}
	}

	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	case bsontype.Null:
		err = vr.ReadNull()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a Null", vr.Type())
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.Null{}), nil
}

// NullDecodeValue is the ValueDecoderFunc for Null.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) NullDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tNull {
		return ValueDecoderError{Name: "NullDecodeValue", Types: []reflect.Type{tNull}, Received: val}
	}

	elem, err := dvd.nullDecodeType(dc, vr, tNull)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (DefaultValueDecoders) regexDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tRegex {
		return emptyValue, ValueDecoderError{
			Name:     "RegexDecodeValue",
			Types:    []reflect.Type{tRegex},
			Received: reflect.Zero(t),
		}
	}

	var pattern, options string
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Regex:
		pattern, options, err = vr.ReadRegex()
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a Regex", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.Regex{Pattern: pattern, Options: options}), nil
}

// RegexDecodeValue is the ValueDecoderFunc for Regex.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) RegexDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tRegex {
		return ValueDecoderError{Name: "RegexDecodeValue", Types: []reflect.Type{tRegex}, Received: val}
	}

	elem, err := dvd.regexDecodeType(dc, vr, tRegex)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (DefaultValueDecoders) dBPointerDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tDBPointer {
		return emptyValue, ValueDecoderError{
			Name:     "DBPointerDecodeValue",
			Types:    []reflect.Type{tDBPointer},
			Received: reflect.Zero(t),
		}
	}

	var ns string
	var pointer primitive.ObjectID
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.DBPointer:
		ns, pointer, err = vr.ReadDBPointer()
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a DBPointer", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.DBPointer{DB: ns, Pointer: pointer}), nil
}

// DBPointerDecodeValue is the ValueDecoderFunc for DBPointer.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) DBPointerDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tDBPointer {
		return ValueDecoderError{Name: "DBPointerDecodeValue", Types: []reflect.Type{tDBPointer}, Received: val}
	}

	elem, err := dvd.dBPointerDecodeType(dc, vr, tDBPointer)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (DefaultValueDecoders) timestampDecodeType(_ DecodeContext, vr bsonrw.ValueReader, reflectType reflect.Type) (reflect.Value, error) {
	if reflectType != tTimestamp {
		return emptyValue, ValueDecoderError{
			Name:     "TimestampDecodeValue",
			Types:    []reflect.Type{tTimestamp},
			Received: reflect.Zero(reflectType),
		}
	}

	var t, incr uint32
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Timestamp:
		t, incr, err = vr.ReadTimestamp()
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a Timestamp", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.Timestamp{T: t, I: incr}), nil
}

// TimestampDecodeValue is the ValueDecoderFunc for Timestamp.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) TimestampDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tTimestamp {
		return ValueDecoderError{Name: "TimestampDecodeValue", Types: []reflect.Type{tTimestamp}, Received: val}
	}

	elem, err := dvd.timestampDecodeType(dc, vr, tTimestamp)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (DefaultValueDecoders) minKeyDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tMinKey {
		return emptyValue, ValueDecoderError{
			Name:     "MinKeyDecodeValue",
			Types:    []reflect.Type{tMinKey},
			Received: reflect.Zero(t),
		}
	}

	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.MinKey:
		err = vr.ReadMinKey()
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a MinKey", vr.Type())
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.MinKey{}), nil
}

// MinKeyDecodeValue is the ValueDecoderFunc for MinKey.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) MinKeyDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tMinKey {
		return ValueDecoderError{Name: "MinKeyDecodeValue", Types: []reflect.Type{tMinKey}, Received: val}
	}

	elem, err := dvd.minKeyDecodeType(dc, vr, tMinKey)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (DefaultValueDecoders) maxKeyDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tMaxKey {
		return emptyValue, ValueDecoderError{
			Name:     "MaxKeyDecodeValue",
			Types:    []reflect.Type{tMaxKey},
			Received: reflect.Zero(t),
		}
	}

	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.MaxKey:
		err = vr.ReadMaxKey()
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a MaxKey", vr.Type())
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(primitive.MaxKey{}), nil
}

// MaxKeyDecodeValue is the ValueDecoderFunc for MaxKey.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) MaxKeyDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tMaxKey {
		return ValueDecoderError{Name: "MaxKeyDecodeValue", Types: []reflect.Type{tMaxKey}, Received: val}
	}

	elem, err := dvd.maxKeyDecodeType(dc, vr, tMaxKey)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (dvd DefaultValueDecoders) decimal128DecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tDecimal {
		return emptyValue, ValueDecoderError{
			Name:     "Decimal128DecodeValue",
			Types:    []reflect.Type{tDecimal},
			Received: reflect.Zero(t),
		}
	}

	var d128 primitive.Decimal128
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Decimal128:
		d128, err = vr.ReadDecimal128()
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a primitive.Decimal128", vr.Type())
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(d128), nil
}

// Decimal128DecodeValue is the ValueDecoderFunc for primitive.Decimal128.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) Decimal128DecodeValue(dctx DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tDecimal {
		return ValueDecoderError{Name: "Decimal128DecodeValue", Types: []reflect.Type{tDecimal}, Received: val}
	}

	elem, err := dvd.decimal128DecodeType(dctx, vr, tDecimal)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (dvd DefaultValueDecoders) jsonNumberDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tJSONNumber {
		return emptyValue, ValueDecoderError{
			Name:     "JSONNumberDecodeValue",
			Types:    []reflect.Type{tJSONNumber},
			Received: reflect.Zero(t),
		}
	}

	var jsonNum json.Number
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.Double:
		f64, err := vr.ReadDouble()
		if err != nil {
			return emptyValue, err
		}
		jsonNum = json.Number(strconv.FormatFloat(f64, 'f', -1, 64))
	case bsontype.Int32:
		i32, err := vr.ReadInt32()
		if err != nil {
			return emptyValue, err
		}
		jsonNum = json.Number(strconv.FormatInt(int64(i32), 10))
	case bsontype.Int64:
		i64, err := vr.ReadInt64()
		if err != nil {
			return emptyValue, err
		}
		jsonNum = json.Number(strconv.FormatInt(i64, 10))
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a json.Number", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(jsonNum), nil
}

// JSONNumberDecodeValue is the ValueDecoderFunc for json.Number.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) JSONNumberDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tJSONNumber {
		return ValueDecoderError{Name: "JSONNumberDecodeValue", Types: []reflect.Type{tJSONNumber}, Received: val}
	}

	elem, err := dvd.jsonNumberDecodeType(dc, vr, tJSONNumber)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

func (dvd DefaultValueDecoders) urlDecodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tURL {
		return emptyValue, ValueDecoderError{
			Name:     "URLDecodeValue",
			Types:    []reflect.Type{tURL},
			Received: reflect.Zero(t),
		}
	}

	urlPtr := &url.URL{}
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.String:
		var str string // Declare str here to avoid shadowing err during the ReadString call.
		str, err = vr.ReadString()
		if err != nil {
			return emptyValue, err
		}

		urlPtr, err = url.Parse(str)
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a *url.URL", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(urlPtr).Elem(), nil
}

// URLDecodeValue is the ValueDecoderFunc for url.URL.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) URLDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tURL {
		return ValueDecoderError{Name: "URLDecodeValue", Types: []reflect.Type{tURL}, Received: val}
	}

	elem, err := dvd.urlDecodeType(dc, vr, tURL)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}

// TimeDecodeValue is the ValueDecoderFunc for time.Time.
//
// Deprecated: TimeDecodeValue is not registered by default. Use TimeCodec.DecodeValue instead.
func (dvd DefaultValueDecoders) TimeDecodeValue(_ DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
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
//
// Deprecated: ByteSliceDecodeValue is not registered by default. Use ByteSliceCodec.DecodeValue instead.
func (dvd DefaultValueDecoders) ByteSliceDecodeValue(_ DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
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
//
// Deprecated: MapDecodeValue is not registered by default. Use MapCodec.DecodeValue instead.
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
		if errors.Is(err, bsonrw.ErrEOD) {
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
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
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
	case bsontype.Undefined:
		val.Set(reflect.Zero(val.Type()))
		return vr.ReadUndefined()
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
//
// Deprecated: SliceDecodeValue is not registered by default. Use SliceCodec.DecodeValue instead.
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
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) ValueUnmarshalerDecodeValue(_ DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.IsValid() || (!val.Type().Implements(tValueUnmarshaler) && !reflect.PtrTo(val.Type()).Implements(tValueUnmarshaler)) {
		return ValueDecoderError{Name: "ValueUnmarshalerDecodeValue", Types: []reflect.Type{tValueUnmarshaler}, Received: val}
	}

	// If BSON value is null and the go value is a pointer, then don't call
	// UnmarshalBSONValue. Even if the Go pointer is already initialized (i.e.,
	// non-nil), encountering null in BSON will result in the pointer being
	// directly set to nil here. Since the pointer is being replaced with nil,
	// there is no opportunity (or reason) for the custom UnmarshalBSONValue logic
	// to be called.
	if vr.Type() == bsontype.Null && val.Kind() == reflect.Ptr {
		val.Set(reflect.Zero(val.Type()))

		return vr.ReadNull()
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
		val = val.Addr() // If the type doesn't implement the interface, a pointer to it must.
	}

	t, src, err := bsonrw.Copier{}.CopyValueToBytes(vr)
	if err != nil {
		return err
	}

	m, ok := val.Interface().(ValueUnmarshaler)
	if !ok {
		// NB: this error should be unreachable due to the above checks
		return ValueDecoderError{Name: "ValueUnmarshalerDecodeValue", Types: []reflect.Type{tValueUnmarshaler}, Received: val}
	}
	return m.UnmarshalBSONValue(t, src)
}

// UnmarshalerDecodeValue is the ValueDecoderFunc for Unmarshaler implementations.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) UnmarshalerDecodeValue(_ DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.IsValid() || (!val.Type().Implements(tUnmarshaler) && !reflect.PtrTo(val.Type()).Implements(tUnmarshaler)) {
		return ValueDecoderError{Name: "UnmarshalerDecodeValue", Types: []reflect.Type{tUnmarshaler}, Received: val}
	}

	if val.Kind() == reflect.Ptr && val.IsNil() {
		if !val.CanSet() {
			return ValueDecoderError{Name: "UnmarshalerDecodeValue", Types: []reflect.Type{tUnmarshaler}, Received: val}
		}
		val.Set(reflect.New(val.Type().Elem()))
	}

	_, src, err := bsonrw.Copier{}.CopyValueToBytes(vr)
	if err != nil {
		return err
	}

	// If the target Go value is a pointer and the BSON field value is empty, set the value to the
	// zero value of the pointer (nil) and don't call UnmarshalBSON. UnmarshalBSON has no way to
	// change the pointer value from within the function (only the value at the pointer address),
	// so it can't set the pointer to "nil" itself. Since the most common Go value for an empty BSON
	// field value is "nil", we set "nil" here and don't call UnmarshalBSON. This behavior matches
	// the behavior of the Go "encoding/json" unmarshaler when the target Go value is a pointer and
	// the JSON field value is "null".
	if val.Kind() == reflect.Ptr && len(src) == 0 {
		val.Set(reflect.Zero(val.Type()))
		return nil
	}

	if !val.Type().Implements(tUnmarshaler) {
		if !val.CanAddr() {
			return ValueDecoderError{Name: "UnmarshalerDecodeValue", Types: []reflect.Type{tUnmarshaler}, Received: val}
		}
		val = val.Addr() // If the type doesn't implement the interface, a pointer to it must.
	}

	m, ok := val.Interface().(Unmarshaler)
	if !ok {
		// NB: this error should be unreachable due to the above checks
		return ValueDecoderError{Name: "UnmarshalerDecodeValue", Types: []reflect.Type{tUnmarshaler}, Received: val}
	}
	return m.UnmarshalBSON(src)
}

// EmptyInterfaceDecodeValue is the ValueDecoderFunc for interface{}.
//
// Deprecated: EmptyInterfaceDecodeValue is not registered by default. Use EmptyInterfaceCodec.DecodeValue instead.
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
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (DefaultValueDecoders) CoreDocumentDecodeValue(_ DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
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
	eTypeDecoder, _ := decoder.(typeDecoder)

	idx := 0
	for {
		vr, err := ar.ReadValue()
		if errors.Is(err, bsonrw.ErrEOA) {
			break
		}
		if err != nil {
			return nil, err
		}

		elem, err := decodeTypeOrValueWithInfo(decoder, eTypeDecoder, dc, vr, eType, true)
		if err != nil {
			return nil, newDecodeError(strconv.Itoa(idx), err)
		}
		elems = append(elems, elem)
		idx++
	}

	return elems, nil
}

func (dvd DefaultValueDecoders) readCodeWithScope(dc DecodeContext, vr bsonrw.ValueReader) (primitive.CodeWithScope, error) {
	var cws primitive.CodeWithScope

	code, dr, err := vr.ReadCodeWithScope()
	if err != nil {
		return cws, err
	}

	scope := reflect.New(tD).Elem()
	elems, err := dvd.decodeElemsFromDocumentReader(dc, dr)
	if err != nil {
		return cws, err
	}

	scope.Set(reflect.MakeSlice(tD, 0, len(elems)))
	scope.Set(reflect.Append(scope, elems...))

	cws = primitive.CodeWithScope{
		Code:  primitive.JavaScript(code),
		Scope: scope.Interface().(primitive.D),
	}
	return cws, nil
}

func (dvd DefaultValueDecoders) codeWithScopeDecodeType(dc DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tCodeWithScope {
		return emptyValue, ValueDecoderError{
			Name:     "CodeWithScopeDecodeValue",
			Types:    []reflect.Type{tCodeWithScope},
			Received: reflect.Zero(t),
		}
	}

	var cws primitive.CodeWithScope
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.CodeWithScope:
		cws, err = dvd.readCodeWithScope(dc, vr)
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a primitive.CodeWithScope", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(cws), nil
}

// CodeWithScopeDecodeValue is the ValueDecoderFunc for CodeWithScope.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.NewRegistry] to get a registry with all default
// value decoders registered.
func (dvd DefaultValueDecoders) CodeWithScopeDecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tCodeWithScope {
		return ValueDecoderError{Name: "CodeWithScopeDecodeValue", Types: []reflect.Type{tCodeWithScope}, Received: val}
	}

	elem, err := dvd.codeWithScopeDecodeType(dc, vr, tCodeWithScope)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
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
		if errors.Is(err, bsonrw.ErrEOD) {
			break
		}
		if err != nil {
			return nil, err
		}

		val := reflect.New(tEmpty).Elem()
		err = decoder.DecodeValue(dc, vr, val)
		if err != nil {
			return nil, newDecodeError(key, err)
		}

		elems = append(elems, reflect.ValueOf(primitive.E{Key: key, Value: val.Interface()}))
	}

	return elems, nil
}
