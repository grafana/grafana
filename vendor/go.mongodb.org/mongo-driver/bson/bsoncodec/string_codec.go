// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncodec

import (
	"fmt"
	"reflect"

	"go.mongodb.org/mongo-driver/bson/bsonoptions"
	"go.mongodb.org/mongo-driver/bson/bsonrw"
	"go.mongodb.org/mongo-driver/bson/bsontype"
)

// StringCodec is the Codec used for string values.
//
// Deprecated: StringCodec will not be directly accessible in Go Driver 2.0. To
// override the default string encode and decode behavior, create a new registry
// with [go.mongodb.org/mongo-driver/bson.NewRegistry] and register a new
// encoder and decoder for strings.
//
// For example,
//
//	reg := bson.NewRegistry()
//	reg.RegisterKindEncoder(reflect.String, myStringEncoder)
//	reg.RegisterKindDecoder(reflect.String, myStringDecoder)
type StringCodec struct {
	// DecodeObjectIDAsHex specifies if object IDs should be decoded as their hex representation.
	// If false, a string made from the raw object ID bytes will be used. Defaults to true.
	//
	// Deprecated: Decoding object IDs as raw bytes will not be supported in Go Driver 2.0.
	DecodeObjectIDAsHex bool
}

var (
	defaultStringCodec = NewStringCodec()

	// Assert that defaultStringCodec satisfies the typeDecoder interface, which allows it to be
	// used by collection type decoders (e.g. map, slice, etc) to set individual values in a
	// collection.
	_ typeDecoder = defaultStringCodec
)

// NewStringCodec returns a StringCodec with options opts.
//
// Deprecated: NewStringCodec will not be available in Go Driver 2.0. See
// [StringCodec] for more details.
func NewStringCodec(opts ...*bsonoptions.StringCodecOptions) *StringCodec {
	stringOpt := bsonoptions.MergeStringCodecOptions(opts...)
	return &StringCodec{*stringOpt.DecodeObjectIDAsHex}
}

// EncodeValue is the ValueEncoder for string types.
func (sc *StringCodec) EncodeValue(_ EncodeContext, vw bsonrw.ValueWriter, val reflect.Value) error {
	if val.Kind() != reflect.String {
		return ValueEncoderError{
			Name:     "StringEncodeValue",
			Kinds:    []reflect.Kind{reflect.String},
			Received: val,
		}
	}

	return vw.WriteString(val.String())
}

func (sc *StringCodec) decodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t.Kind() != reflect.String {
		return emptyValue, ValueDecoderError{
			Name:     "StringDecodeValue",
			Kinds:    []reflect.Kind{reflect.String},
			Received: reflect.Zero(t),
		}
	}

	var str string
	var err error
	switch vr.Type() {
	case bsontype.String:
		str, err = vr.ReadString()
		if err != nil {
			return emptyValue, err
		}
	case bsontype.ObjectID:
		oid, err := vr.ReadObjectID()
		if err != nil {
			return emptyValue, err
		}
		if sc.DecodeObjectIDAsHex {
			str = oid.Hex()
		} else {
			// TODO(GODRIVER-2796): Return an error here instead of decoding to a garbled string.
			byteArray := [12]byte(oid)
			str = string(byteArray[:])
		}
	case bsontype.Symbol:
		str, err = vr.ReadSymbol()
		if err != nil {
			return emptyValue, err
		}
	case bsontype.Binary:
		data, subtype, err := vr.ReadBinary()
		if err != nil {
			return emptyValue, err
		}
		if subtype != bsontype.BinaryGeneric && subtype != bsontype.BinaryBinaryOld {
			return emptyValue, decodeBinaryError{subtype: subtype, typeName: "string"}
		}
		str = string(data)
	case bsontype.Null:
		if err = vr.ReadNull(); err != nil {
			return emptyValue, err
		}
	case bsontype.Undefined:
		if err = vr.ReadUndefined(); err != nil {
			return emptyValue, err
		}
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a string type", vr.Type())
	}

	return reflect.ValueOf(str), nil
}

// DecodeValue is the ValueDecoder for string types.
func (sc *StringCodec) DecodeValue(dctx DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Kind() != reflect.String {
		return ValueDecoderError{Name: "StringDecodeValue", Kinds: []reflect.Kind{reflect.String}, Received: val}
	}

	elem, err := sc.decodeType(dctx, vr, val.Type())
	if err != nil {
		return err
	}

	val.SetString(elem.String())
	return nil
}
