// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bson

import (
	"bytes"

	"go.mongodb.org/mongo-driver/bson/bsoncodec"
	"go.mongodb.org/mongo-driver/bson/bsonrw"
	"go.mongodb.org/mongo-driver/bson/bsontype"
)

// Unmarshaler is the interface implemented by types that can unmarshal a BSON
// document representation of themselves. The input can be assumed to be a valid
// encoding of a BSON document. UnmarshalBSON must copy the JSON data if it
// wishes to retain the data after returning.
//
// Unmarshaler is only used to unmarshal full BSON documents. To create custom
// BSON unmarshaling behavior for individual values in a BSON document,
// implement the ValueUnmarshaler interface instead.
type Unmarshaler interface {
	UnmarshalBSON([]byte) error
}

// ValueUnmarshaler is the interface implemented by types that can unmarshal a
// BSON value representation of themselves. The input can be assumed to be a
// valid encoding of a BSON value. UnmarshalBSONValue must copy the BSON value
// bytes if it wishes to retain the data after returning.
//
// ValueUnmarshaler is only used to unmarshal individual values in a BSON
// document. To create custom BSON unmarshaling behavior for an entire BSON
// document, implement the Unmarshaler interface instead.
type ValueUnmarshaler interface {
	UnmarshalBSONValue(bsontype.Type, []byte) error
}

// Unmarshal parses the BSON-encoded data and stores the result in the value
// pointed to by val. If val is nil or not a pointer, Unmarshal returns
// InvalidUnmarshalError.
//
// When unmarshaling BSON, if the BSON value is null and the Go value is a
// pointer, the pointer is set to nil without calling UnmarshalBSONValue.
func Unmarshal(data []byte, val interface{}) error {
	return UnmarshalWithRegistry(DefaultRegistry, data, val)
}

// UnmarshalWithRegistry parses the BSON-encoded data using Registry r and
// stores the result in the value pointed to by val. If val is nil or not
// a pointer, UnmarshalWithRegistry returns InvalidUnmarshalError.
//
// Deprecated: Use [NewDecoder] and specify the Registry by calling [Decoder.SetRegistry] instead:
//
//	dec, err := bson.NewDecoder(bsonrw.NewBSONDocumentReader(data))
//	if err != nil {
//		panic(err)
//	}
//	dec.SetRegistry(reg)
//
// See [Decoder] for more examples.
func UnmarshalWithRegistry(r *bsoncodec.Registry, data []byte, val interface{}) error {
	vr := bsonrw.NewBSONDocumentReader(data)
	return unmarshalFromReader(bsoncodec.DecodeContext{Registry: r}, vr, val)
}

// UnmarshalWithContext parses the BSON-encoded data using DecodeContext dc and
// stores the result in the value pointed to by val. If val is nil or not
// a pointer, UnmarshalWithRegistry returns InvalidUnmarshalError.
//
// Deprecated: Use [NewDecoder] and use the Decoder configuration methods to set the desired unmarshal
// behavior instead:
//
//	dec, err := bson.NewDecoder(bsonrw.NewBSONDocumentReader(data))
//	if err != nil {
//		panic(err)
//	}
//	dec.DefaultDocumentM()
//
// See [Decoder] for more examples.
func UnmarshalWithContext(dc bsoncodec.DecodeContext, data []byte, val interface{}) error {
	vr := bsonrw.NewBSONDocumentReader(data)
	return unmarshalFromReader(dc, vr, val)
}

// UnmarshalValue parses the BSON value of type t with bson.DefaultRegistry and
// stores the result in the value pointed to by val. If val is nil or not a pointer,
// UnmarshalValue returns an error.
func UnmarshalValue(t bsontype.Type, data []byte, val interface{}) error {
	return UnmarshalValueWithRegistry(DefaultRegistry, t, data, val)
}

// UnmarshalValueWithRegistry parses the BSON value of type t with registry r and
// stores the result in the value pointed to by val. If val is nil or not a pointer,
// UnmarshalValue returns an error.
//
// Deprecated: Using a custom registry to unmarshal individual BSON values will not be supported in
// Go Driver 2.0.
func UnmarshalValueWithRegistry(r *bsoncodec.Registry, t bsontype.Type, data []byte, val interface{}) error {
	vr := bsonrw.NewBSONValueReader(t, data)
	return unmarshalFromReader(bsoncodec.DecodeContext{Registry: r}, vr, val)
}

// UnmarshalExtJSON parses the extended JSON-encoded data and stores the result
// in the value pointed to by val. If val is nil or not a pointer, Unmarshal
// returns InvalidUnmarshalError.
func UnmarshalExtJSON(data []byte, canonical bool, val interface{}) error {
	return UnmarshalExtJSONWithRegistry(DefaultRegistry, data, canonical, val)
}

// UnmarshalExtJSONWithRegistry parses the extended JSON-encoded data using
// Registry r and stores the result in the value pointed to by val. If val is
// nil or not a pointer, UnmarshalWithRegistry returns InvalidUnmarshalError.
//
// Deprecated: Use [NewDecoder] and specify the Registry by calling [Decoder.SetRegistry] instead:
//
//	vr, err := bsonrw.NewExtJSONValueReader(bytes.NewReader(data), true)
//	if err != nil {
//		panic(err)
//	}
//	dec, err := bson.NewDecoder(vr)
//	if err != nil {
//		panic(err)
//	}
//	dec.SetRegistry(reg)
//
// See [Decoder] for more examples.
func UnmarshalExtJSONWithRegistry(r *bsoncodec.Registry, data []byte, canonical bool, val interface{}) error {
	ejvr, err := bsonrw.NewExtJSONValueReader(bytes.NewReader(data), canonical)
	if err != nil {
		return err
	}

	return unmarshalFromReader(bsoncodec.DecodeContext{Registry: r}, ejvr, val)
}

// UnmarshalExtJSONWithContext parses the extended JSON-encoded data using
// DecodeContext dc and stores the result in the value pointed to by val. If val is
// nil or not a pointer, UnmarshalWithRegistry returns InvalidUnmarshalError.
//
// Deprecated: Use [NewDecoder] and use the Decoder configuration methods to set the desired unmarshal
// behavior instead:
//
//	vr, err := bsonrw.NewExtJSONValueReader(bytes.NewReader(data), true)
//	if err != nil {
//		panic(err)
//	}
//	dec, err := bson.NewDecoder(vr)
//	if err != nil {
//		panic(err)
//	}
//	dec.DefaultDocumentM()
//
// See [Decoder] for more examples.
func UnmarshalExtJSONWithContext(dc bsoncodec.DecodeContext, data []byte, canonical bool, val interface{}) error {
	ejvr, err := bsonrw.NewExtJSONValueReader(bytes.NewReader(data), canonical)
	if err != nil {
		return err
	}

	return unmarshalFromReader(dc, ejvr, val)
}

func unmarshalFromReader(dc bsoncodec.DecodeContext, vr bsonrw.ValueReader, val interface{}) error {
	dec := decPool.Get().(*Decoder)
	defer decPool.Put(dec)

	err := dec.Reset(vr)
	if err != nil {
		return err
	}
	err = dec.SetContext(dc)
	if err != nil {
		return err
	}

	return dec.Decode(val)
}
