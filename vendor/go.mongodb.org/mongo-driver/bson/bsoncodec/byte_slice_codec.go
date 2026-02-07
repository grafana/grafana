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

// ByteSliceCodec is the Codec used for []byte values.
//
// Deprecated: ByteSliceCodec will not be directly configurable in Go Driver
// 2.0. To configure the byte slice encode and decode behavior, use the
// configuration methods on a [go.mongodb.org/mongo-driver/bson.Encoder] or
// [go.mongodb.org/mongo-driver/bson.Decoder]. To configure the byte slice
// encode and decode behavior for a mongo.Client, use
// [go.mongodb.org/mongo-driver/mongo/options.ClientOptions.SetBSONOptions].
//
// For example, to configure a mongo.Client to encode nil byte slices as empty
// BSON binary values, use:
//
//	opt := options.Client().SetBSONOptions(&options.BSONOptions{
//	    NilByteSliceAsEmpty: true,
//	})
//
// See the deprecation notice for each field in ByteSliceCodec for the
// corresponding settings.
type ByteSliceCodec struct {
	// EncodeNilAsEmpty causes EncodeValue to marshal nil Go byte slices as empty BSON binary values
	// instead of BSON null.
	//
	// Deprecated: Use bson.Encoder.NilByteSliceAsEmpty or options.BSONOptions.NilByteSliceAsEmpty
	// instead.
	EncodeNilAsEmpty bool
}

var (
	defaultByteSliceCodec = NewByteSliceCodec()

	// Assert that defaultByteSliceCodec satisfies the typeDecoder interface, which allows it to be
	// used by collection type decoders (e.g. map, slice, etc) to set individual values in a
	// collection.
	_ typeDecoder = defaultByteSliceCodec
)

// NewByteSliceCodec returns a ByteSliceCodec with options opts.
//
// Deprecated: NewByteSliceCodec will not be available in Go Driver 2.0. See
// [ByteSliceCodec] for more details.
func NewByteSliceCodec(opts ...*bsonoptions.ByteSliceCodecOptions) *ByteSliceCodec {
	byteSliceOpt := bsonoptions.MergeByteSliceCodecOptions(opts...)
	codec := ByteSliceCodec{}
	if byteSliceOpt.EncodeNilAsEmpty != nil {
		codec.EncodeNilAsEmpty = *byteSliceOpt.EncodeNilAsEmpty
	}
	return &codec
}

// EncodeValue is the ValueEncoder for []byte.
func (bsc *ByteSliceCodec) EncodeValue(ec EncodeContext, vw bsonrw.ValueWriter, val reflect.Value) error {
	if !val.IsValid() || val.Type() != tByteSlice {
		return ValueEncoderError{Name: "ByteSliceEncodeValue", Types: []reflect.Type{tByteSlice}, Received: val}
	}
	if val.IsNil() && !bsc.EncodeNilAsEmpty && !ec.nilByteSliceAsEmpty {
		return vw.WriteNull()
	}
	return vw.WriteBinary(val.Interface().([]byte))
}

func (bsc *ByteSliceCodec) decodeType(_ DecodeContext, vr bsonrw.ValueReader, t reflect.Type) (reflect.Value, error) {
	if t != tByteSlice {
		return emptyValue, ValueDecoderError{
			Name:     "ByteSliceDecodeValue",
			Types:    []reflect.Type{tByteSlice},
			Received: reflect.Zero(t),
		}
	}

	var data []byte
	var err error
	switch vrType := vr.Type(); vrType {
	case bsontype.String:
		str, err := vr.ReadString()
		if err != nil {
			return emptyValue, err
		}
		data = []byte(str)
	case bsontype.Symbol:
		sym, err := vr.ReadSymbol()
		if err != nil {
			return emptyValue, err
		}
		data = []byte(sym)
	case bsontype.Binary:
		var subtype byte
		data, subtype, err = vr.ReadBinary()
		if err != nil {
			return emptyValue, err
		}
		if subtype != bsontype.BinaryGeneric && subtype != bsontype.BinaryBinaryOld {
			return emptyValue, decodeBinaryError{subtype: subtype, typeName: "[]byte"}
		}
	case bsontype.Null:
		err = vr.ReadNull()
	case bsontype.Undefined:
		err = vr.ReadUndefined()
	default:
		return emptyValue, fmt.Errorf("cannot decode %v into a []byte", vrType)
	}
	if err != nil {
		return emptyValue, err
	}

	return reflect.ValueOf(data), nil
}

// DecodeValue is the ValueDecoder for []byte.
func (bsc *ByteSliceCodec) DecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Type() != tByteSlice {
		return ValueDecoderError{Name: "ByteSliceDecodeValue", Types: []reflect.Type{tByteSlice}, Received: val}
	}

	elem, err := bsc.decodeType(dc, vr, tByteSlice)
	if err != nil {
		return err
	}

	val.Set(elem)
	return nil
}
