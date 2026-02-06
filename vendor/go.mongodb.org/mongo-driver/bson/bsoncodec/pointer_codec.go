// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncodec

import (
	"reflect"

	"go.mongodb.org/mongo-driver/bson/bsonrw"
	"go.mongodb.org/mongo-driver/bson/bsontype"
)

var _ ValueEncoder = &PointerCodec{}
var _ ValueDecoder = &PointerCodec{}

// PointerCodec is the Codec used for pointers.
//
// Deprecated: PointerCodec will not be directly accessible in Go Driver 2.0. To
// override the default pointer encode and decode behavior, create a new registry
// with [go.mongodb.org/mongo-driver/bson.NewRegistry] and register a new
// encoder and decoder for pointers.
//
// For example,
//
//	reg := bson.NewRegistry()
//	reg.RegisterKindEncoder(reflect.Ptr, myPointerEncoder)
//	reg.RegisterKindDecoder(reflect.Ptr, myPointerDecoder)
type PointerCodec struct {
	ecache typeEncoderCache
	dcache typeDecoderCache
}

// NewPointerCodec returns a PointerCodec that has been initialized.
//
// Deprecated: NewPointerCodec will not be available in Go Driver 2.0. See
// [PointerCodec] for more details.
func NewPointerCodec() *PointerCodec {
	return &PointerCodec{}
}

// EncodeValue handles encoding a pointer by either encoding it to BSON Null if the pointer is nil
// or looking up an encoder for the type of value the pointer points to.
func (pc *PointerCodec) EncodeValue(ec EncodeContext, vw bsonrw.ValueWriter, val reflect.Value) error {
	if val.Kind() != reflect.Ptr {
		if !val.IsValid() {
			return vw.WriteNull()
		}
		return ValueEncoderError{Name: "PointerCodec.EncodeValue", Kinds: []reflect.Kind{reflect.Ptr}, Received: val}
	}

	if val.IsNil() {
		return vw.WriteNull()
	}

	typ := val.Type()
	if v, ok := pc.ecache.Load(typ); ok {
		if v == nil {
			return ErrNoEncoder{Type: typ}
		}
		return v.EncodeValue(ec, vw, val.Elem())
	}
	// TODO(charlie): handle concurrent requests for the same type
	enc, err := ec.LookupEncoder(typ.Elem())
	enc = pc.ecache.LoadOrStore(typ, enc)
	if err != nil {
		return err
	}
	return enc.EncodeValue(ec, vw, val.Elem())
}

// DecodeValue handles decoding a pointer by looking up a decoder for the type it points to and
// using that to decode. If the BSON value is Null, this method will set the pointer to nil.
func (pc *PointerCodec) DecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Kind() != reflect.Ptr {
		return ValueDecoderError{Name: "PointerCodec.DecodeValue", Kinds: []reflect.Kind{reflect.Ptr}, Received: val}
	}

	typ := val.Type()
	if vr.Type() == bsontype.Null {
		val.Set(reflect.Zero(typ))
		return vr.ReadNull()
	}
	if vr.Type() == bsontype.Undefined {
		val.Set(reflect.Zero(typ))
		return vr.ReadUndefined()
	}

	if val.IsNil() {
		val.Set(reflect.New(typ.Elem()))
	}

	if v, ok := pc.dcache.Load(typ); ok {
		if v == nil {
			return ErrNoDecoder{Type: typ}
		}
		return v.DecodeValue(dc, vr, val.Elem())
	}
	// TODO(charlie): handle concurrent requests for the same type
	dec, err := dc.LookupDecoder(typ.Elem())
	dec = pc.dcache.LoadOrStore(typ, dec)
	if err != nil {
		return err
	}
	return dec.DecodeValue(dc, vr, val.Elem())
}
