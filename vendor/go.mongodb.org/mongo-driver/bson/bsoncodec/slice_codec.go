// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncodec

import (
	"errors"
	"fmt"
	"reflect"

	"go.mongodb.org/mongo-driver/bson/bsonoptions"
	"go.mongodb.org/mongo-driver/bson/bsonrw"
	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var defaultSliceCodec = NewSliceCodec()

// SliceCodec is the Codec used for slice values.
//
// Deprecated: SliceCodec will not be directly configurable in Go Driver 2.0. To
// configure the slice encode and decode behavior, use the configuration methods
// on a [go.mongodb.org/mongo-driver/bson.Encoder] or
// [go.mongodb.org/mongo-driver/bson.Decoder]. To configure the slice encode and
// decode behavior for a mongo.Client, use
// [go.mongodb.org/mongo-driver/mongo/options.ClientOptions.SetBSONOptions].
//
// For example, to configure a mongo.Client to marshal nil Go slices as empty
// BSON arrays, use:
//
//	opt := options.Client().SetBSONOptions(&options.BSONOptions{
//	    NilSliceAsEmpty: true,
//	})
//
// See the deprecation notice for each field in SliceCodec for the corresponding
// settings.
type SliceCodec struct {
	// EncodeNilAsEmpty causes EncodeValue to marshal nil Go slices as empty BSON arrays instead of
	// BSON null.
	//
	// Deprecated: Use bson.Encoder.NilSliceAsEmpty instead.
	EncodeNilAsEmpty bool
}

// NewSliceCodec returns a MapCodec with options opts.
//
// Deprecated: NewSliceCodec will not be available in Go Driver 2.0. See
// [SliceCodec] for more details.
func NewSliceCodec(opts ...*bsonoptions.SliceCodecOptions) *SliceCodec {
	sliceOpt := bsonoptions.MergeSliceCodecOptions(opts...)

	codec := SliceCodec{}
	if sliceOpt.EncodeNilAsEmpty != nil {
		codec.EncodeNilAsEmpty = *sliceOpt.EncodeNilAsEmpty
	}
	return &codec
}

// EncodeValue is the ValueEncoder for slice types.
func (sc SliceCodec) EncodeValue(ec EncodeContext, vw bsonrw.ValueWriter, val reflect.Value) error {
	if !val.IsValid() || val.Kind() != reflect.Slice {
		return ValueEncoderError{Name: "SliceEncodeValue", Kinds: []reflect.Kind{reflect.Slice}, Received: val}
	}

	if val.IsNil() && !sc.EncodeNilAsEmpty && !ec.nilSliceAsEmpty {
		return vw.WriteNull()
	}

	// If we have a []byte we want to treat it as a binary instead of as an array.
	if val.Type().Elem() == tByte {
		byteSlice := make([]byte, val.Len())
		reflect.Copy(reflect.ValueOf(byteSlice), val)
		return vw.WriteBinary(byteSlice)
	}

	// If we have a []primitive.E we want to treat it as a document instead of as an array.
	if val.Type() == tD || val.Type().ConvertibleTo(tD) {
		d := val.Convert(tD).Interface().(primitive.D)

		dw, err := vw.WriteDocument()
		if err != nil {
			return err
		}

		for _, e := range d {
			err = encodeElement(ec, dw, e)
			if err != nil {
				return err
			}
		}

		return dw.WriteDocumentEnd()
	}

	aw, err := vw.WriteArray()
	if err != nil {
		return err
	}

	elemType := val.Type().Elem()
	encoder, err := ec.LookupEncoder(elemType)
	if err != nil && elemType.Kind() != reflect.Interface {
		return err
	}

	for idx := 0; idx < val.Len(); idx++ {
		currEncoder, currVal, lookupErr := defaultValueEncoders.lookupElementEncoder(ec, encoder, val.Index(idx))
		if lookupErr != nil && !errors.Is(lookupErr, errInvalidValue) {
			return lookupErr
		}

		vw, err := aw.WriteArrayElement()
		if err != nil {
			return err
		}

		if errors.Is(lookupErr, errInvalidValue) {
			err = vw.WriteNull()
			if err != nil {
				return err
			}
			continue
		}

		err = currEncoder.EncodeValue(ec, vw, currVal)
		if err != nil {
			return err
		}
	}
	return aw.WriteArrayEnd()
}

// DecodeValue is the ValueDecoder for slice types.
func (sc *SliceCodec) DecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Kind() != reflect.Slice {
		return ValueDecoderError{Name: "SliceDecodeValue", Kinds: []reflect.Kind{reflect.Slice}, Received: val}
	}

	switch vrType := vr.Type(); vrType {
	case bsontype.Array:
	case bsontype.Null:
		val.Set(reflect.Zero(val.Type()))
		return vr.ReadNull()
	case bsontype.Undefined:
		val.Set(reflect.Zero(val.Type()))
		return vr.ReadUndefined()
	case bsontype.Type(0), bsontype.EmbeddedDocument:
		if val.Type().Elem() != tE {
			return fmt.Errorf("cannot decode document into %s", val.Type())
		}
	case bsontype.Binary:
		if val.Type().Elem() != tByte {
			return fmt.Errorf("SliceDecodeValue can only decode a binary into a byte array, got %v", vrType)
		}
		data, subtype, err := vr.ReadBinary()
		if err != nil {
			return err
		}
		if subtype != bsontype.BinaryGeneric && subtype != bsontype.BinaryBinaryOld {
			return fmt.Errorf("SliceDecodeValue can only be used to decode subtype 0x00 or 0x02 for %s, got %v", bsontype.Binary, subtype)
		}

		if val.IsNil() {
			val.Set(reflect.MakeSlice(val.Type(), 0, len(data)))
		}
		val.SetLen(0)
		val.Set(reflect.AppendSlice(val, reflect.ValueOf(data)))
		return nil
	case bsontype.String:
		if sliceType := val.Type().Elem(); sliceType != tByte {
			return fmt.Errorf("SliceDecodeValue can only decode a string into a byte array, got %v", sliceType)
		}
		str, err := vr.ReadString()
		if err != nil {
			return err
		}
		byteStr := []byte(str)

		if val.IsNil() {
			val.Set(reflect.MakeSlice(val.Type(), 0, len(byteStr)))
		}
		val.SetLen(0)
		val.Set(reflect.AppendSlice(val, reflect.ValueOf(byteStr)))
		return nil
	default:
		return fmt.Errorf("cannot decode %v into a slice", vrType)
	}

	var elemsFunc func(DecodeContext, bsonrw.ValueReader, reflect.Value) ([]reflect.Value, error)
	switch val.Type().Elem() {
	case tE:
		dc.Ancestor = val.Type()
		elemsFunc = defaultValueDecoders.decodeD
	default:
		elemsFunc = defaultValueDecoders.decodeDefault
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
