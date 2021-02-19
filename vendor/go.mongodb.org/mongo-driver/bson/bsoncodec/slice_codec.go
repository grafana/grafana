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
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var defaultSliceCodec = NewSliceCodec()

// SliceCodec is the Codec used for slice values.
type SliceCodec struct {
	EncodeNilAsEmpty bool
}

var _ ValueCodec = &MapCodec{}

// NewSliceCodec returns a MapCodec with options opts.
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

	if val.IsNil() && !sc.EncodeNilAsEmpty {
		return vw.WriteNull()
	}

	// If we have a []byte we want to treat it as a binary instead of as an array.
	if val.Type().Elem() == tByte {
		var byteSlice []byte
		for idx := 0; idx < val.Len(); idx++ {
			byteSlice = append(byteSlice, val.Index(idx).Interface().(byte))
		}
		return vw.WriteBinary(byteSlice)
	}

	// If we have a []primitive.E we want to treat it as a document instead of as an array.
	if val.Type().ConvertibleTo(tD) {
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
		if lookupErr != nil && lookupErr != errInvalidValue {
			return lookupErr
		}

		vw, err := aw.WriteArrayElement()
		if err != nil {
			return err
		}

		if lookupErr == errInvalidValue {
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
		for _, elem := range data {
			val.Set(reflect.Append(val, reflect.ValueOf(elem)))
		}
		return nil
	case bsontype.String:
		if val.Type().Elem() != tByte {
			return fmt.Errorf("SliceDecodeValue can only decode a string into a byte array, got %v", vrType)
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
		for _, elem := range byteStr {
			val.Set(reflect.Append(val, reflect.ValueOf(elem)))
		}
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
