// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncodec

import (
	"errors"
	"fmt"
	"math"
	"reflect"

	"go.mongodb.org/mongo-driver/bson/bsonoptions"
	"go.mongodb.org/mongo-driver/bson/bsonrw"
	"go.mongodb.org/mongo-driver/bson/bsontype"
)

var defaultUIntCodec = NewUIntCodec()

// UIntCodec is the Codec used for uint values.
type UIntCodec struct {
	EncodeToMinSize bool
}

var _ ValueCodec = &UIntCodec{}

// NewUIntCodec returns a UIntCodec with options opts.
func NewUIntCodec(opts ...*bsonoptions.UIntCodecOptions) *UIntCodec {
	uintOpt := bsonoptions.MergeUIntCodecOptions(opts...)

	codec := UIntCodec{}
	if uintOpt.EncodeToMinSize != nil {
		codec.EncodeToMinSize = *uintOpt.EncodeToMinSize
	}
	return &codec
}

// EncodeValue is the ValueEncoder for uint types.
func (uic *UIntCodec) EncodeValue(ec EncodeContext, vw bsonrw.ValueWriter, val reflect.Value) error {
	switch val.Kind() {
	case reflect.Uint8, reflect.Uint16:
		return vw.WriteInt32(int32(val.Uint()))
	case reflect.Uint, reflect.Uint32, reflect.Uint64:
		u64 := val.Uint()

		// If ec.MinSize or if encodeToMinSize is true for a non-uint64 value we should write val as an int32
		useMinSize := ec.MinSize || (uic.EncodeToMinSize && val.Kind() != reflect.Uint64)

		if u64 <= math.MaxInt32 && useMinSize {
			return vw.WriteInt32(int32(u64))
		}
		if u64 > math.MaxInt64 {
			return fmt.Errorf("%d overflows int64", u64)
		}
		return vw.WriteInt64(int64(u64))
	}

	return ValueEncoderError{
		Name:     "UintEncodeValue",
		Kinds:    []reflect.Kind{reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uint},
		Received: val,
	}
}

// DecodeValue is the ValueDecoder for uint types.
func (uic *UIntCodec) DecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() {
		return ValueDecoderError{
			Name:     "UintDecodeValue",
			Kinds:    []reflect.Kind{reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uint},
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
	case bsontype.Null:
		if err = vr.ReadNull(); err != nil {
			return err
		}
	default:
		return fmt.Errorf("cannot decode %v into an integer type", vrType)
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
