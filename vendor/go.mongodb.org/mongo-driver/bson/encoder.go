// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bson

import (
	"errors"
	"reflect"
	"sync"

	"go.mongodb.org/mongo-driver/bson/bsoncodec"
	"go.mongodb.org/mongo-driver/bson/bsonrw"
)

// This pool is used to keep the allocations of Encoders down. This is only used for the Marshal*
// methods and is not consumable from outside of this package. The Encoders retrieved from this pool
// must have both Reset and SetRegistry called on them.
var encPool = sync.Pool{
	New: func() interface{} {
		return new(Encoder)
	},
}

// An Encoder writes a serialization format to an output stream. It writes to a bsonrw.ValueWriter
// as the destination of BSON data.
type Encoder struct {
	ec bsoncodec.EncodeContext
	vw bsonrw.ValueWriter

	errorOnInlineDuplicates bool
	intMinSize              bool
	stringifyMapKeysWithFmt bool
	nilMapAsEmpty           bool
	nilSliceAsEmpty         bool
	nilByteSliceAsEmpty     bool
	omitZeroStruct          bool
	useJSONStructTags       bool
}

// NewEncoder returns a new encoder that uses the DefaultRegistry to write to vw.
func NewEncoder(vw bsonrw.ValueWriter) (*Encoder, error) {
	// TODO:(GODRIVER-2719): Remove error return value.
	if vw == nil {
		return nil, errors.New("cannot create a new Encoder with a nil ValueWriter")
	}

	return &Encoder{
		ec: bsoncodec.EncodeContext{Registry: DefaultRegistry},
		vw: vw,
	}, nil
}

// NewEncoderWithContext returns a new encoder that uses EncodeContext ec to write to vw.
//
// Deprecated: Use [NewEncoder] and use the Encoder configuration methods to set the desired marshal
// behavior instead.
func NewEncoderWithContext(ec bsoncodec.EncodeContext, vw bsonrw.ValueWriter) (*Encoder, error) {
	if ec.Registry == nil {
		ec = bsoncodec.EncodeContext{Registry: DefaultRegistry}
	}
	if vw == nil {
		return nil, errors.New("cannot create a new Encoder with a nil ValueWriter")
	}

	return &Encoder{
		ec: ec,
		vw: vw,
	}, nil
}

// Encode writes the BSON encoding of val to the stream.
//
// See [Marshal] for details about BSON marshaling behavior.
func (e *Encoder) Encode(val interface{}) error {
	if marshaler, ok := val.(Marshaler); ok {
		// TODO(skriptble): Should we have a MarshalAppender interface so that we can have []byte reuse?
		buf, err := marshaler.MarshalBSON()
		if err != nil {
			return err
		}
		return bsonrw.Copier{}.CopyDocumentFromBytes(e.vw, buf)
	}

	encoder, err := e.ec.LookupEncoder(reflect.TypeOf(val))
	if err != nil {
		return err
	}

	// Copy the configurations applied to the Encoder over to the EncodeContext, which actually
	// communicates those configurations to the default ValueEncoders.
	if e.errorOnInlineDuplicates {
		e.ec.ErrorOnInlineDuplicates()
	}
	if e.intMinSize {
		e.ec.MinSize = true
	}
	if e.stringifyMapKeysWithFmt {
		e.ec.StringifyMapKeysWithFmt()
	}
	if e.nilMapAsEmpty {
		e.ec.NilMapAsEmpty()
	}
	if e.nilSliceAsEmpty {
		e.ec.NilSliceAsEmpty()
	}
	if e.nilByteSliceAsEmpty {
		e.ec.NilByteSliceAsEmpty()
	}
	if e.omitZeroStruct {
		e.ec.OmitZeroStruct()
	}
	if e.useJSONStructTags {
		e.ec.UseJSONStructTags()
	}

	return encoder.EncodeValue(e.ec, e.vw, reflect.ValueOf(val))
}

// Reset will reset the state of the Encoder, using the same *EncodeContext used in
// the original construction but using vw.
func (e *Encoder) Reset(vw bsonrw.ValueWriter) error {
	// TODO:(GODRIVER-2719): Remove error return value.
	e.vw = vw
	return nil
}

// SetRegistry replaces the current registry of the Encoder with r.
func (e *Encoder) SetRegistry(r *bsoncodec.Registry) error {
	// TODO:(GODRIVER-2719): Remove error return value.
	e.ec.Registry = r
	return nil
}

// SetContext replaces the current EncodeContext of the encoder with ec.
//
// Deprecated: Use the Encoder configuration methods set the desired marshal behavior instead.
func (e *Encoder) SetContext(ec bsoncodec.EncodeContext) error {
	// TODO:(GODRIVER-2719): Remove error return value.
	e.ec = ec
	return nil
}

// ErrorOnInlineDuplicates causes the Encoder to return an error if there is a duplicate field in
// the marshaled BSON when the "inline" struct tag option is set.
func (e *Encoder) ErrorOnInlineDuplicates() {
	e.errorOnInlineDuplicates = true
}

// IntMinSize causes the Encoder to marshal Go integer values (int, int8, int16, int32, int64, uint,
// uint8, uint16, uint32, or uint64) as the minimum BSON int size (either 32 or 64 bits) that can
// represent the integer value.
func (e *Encoder) IntMinSize() {
	e.intMinSize = true
}

// StringifyMapKeysWithFmt causes the Encoder to convert Go map keys to BSON document field name
// strings using fmt.Sprint instead of the default string conversion logic.
func (e *Encoder) StringifyMapKeysWithFmt() {
	e.stringifyMapKeysWithFmt = true
}

// NilMapAsEmpty causes the Encoder to marshal nil Go maps as empty BSON documents instead of BSON
// null.
func (e *Encoder) NilMapAsEmpty() {
	e.nilMapAsEmpty = true
}

// NilSliceAsEmpty causes the Encoder to marshal nil Go slices as empty BSON arrays instead of BSON
// null.
func (e *Encoder) NilSliceAsEmpty() {
	e.nilSliceAsEmpty = true
}

// NilByteSliceAsEmpty causes the Encoder to marshal nil Go byte slices as empty BSON binary values
// instead of BSON null.
func (e *Encoder) NilByteSliceAsEmpty() {
	e.nilByteSliceAsEmpty = true
}

// TODO(GODRIVER-2820): Update the description to remove the note about only examining exported
// TODO struct fields once the logic is updated to also inspect private struct fields.

// OmitZeroStruct causes the Encoder to consider the zero value for a struct (e.g. MyStruct{})
// as empty and omit it from the marshaled BSON when the "omitempty" struct tag option is set.
//
// Note that the Encoder only examines exported struct fields when determining if a struct is the
// zero value. It considers pointers to a zero struct value (e.g. &MyStruct{}) not empty.
func (e *Encoder) OmitZeroStruct() {
	e.omitZeroStruct = true
}

// UseJSONStructTags causes the Encoder to fall back to using the "json" struct tag if a "bson"
// struct tag is not specified.
func (e *Encoder) UseJSONStructTags() {
	e.useJSONStructTags = true
}
