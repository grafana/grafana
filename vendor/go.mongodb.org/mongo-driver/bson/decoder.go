// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bson

import (
	"errors"
	"fmt"
	"reflect"
	"sync"

	"go.mongodb.org/mongo-driver/bson/bsoncodec"
	"go.mongodb.org/mongo-driver/bson/bsonrw"
)

// ErrDecodeToNil is the error returned when trying to decode to a nil value
var ErrDecodeToNil = errors.New("cannot Decode to nil value")

// This pool is used to keep the allocations of Decoders down. This is only used for the Marshal*
// methods and is not consumable from outside of this package. The Decoders retrieved from this pool
// must have both Reset and SetRegistry called on them.
var decPool = sync.Pool{
	New: func() interface{} {
		return new(Decoder)
	},
}

// A Decoder reads and decodes BSON documents from a stream. It reads from a bsonrw.ValueReader as
// the source of BSON data.
type Decoder struct {
	dc bsoncodec.DecodeContext
	vr bsonrw.ValueReader

	// We persist defaultDocumentM and defaultDocumentD on the Decoder to prevent overwriting from
	// (*Decoder).SetContext.
	defaultDocumentM bool
	defaultDocumentD bool

	binaryAsSlice     bool
	useJSONStructTags bool
	useLocalTimeZone  bool
	zeroMaps          bool
	zeroStructs       bool
}

// NewDecoder returns a new decoder that uses the DefaultRegistry to read from vr.
func NewDecoder(vr bsonrw.ValueReader) (*Decoder, error) {
	if vr == nil {
		return nil, errors.New("cannot create a new Decoder with a nil ValueReader")
	}

	return &Decoder{
		dc: bsoncodec.DecodeContext{Registry: DefaultRegistry},
		vr: vr,
	}, nil
}

// NewDecoderWithContext returns a new decoder that uses DecodeContext dc to read from vr.
//
// Deprecated: Use [NewDecoder] and use the Decoder configuration methods set the desired unmarshal
// behavior instead.
func NewDecoderWithContext(dc bsoncodec.DecodeContext, vr bsonrw.ValueReader) (*Decoder, error) {
	if dc.Registry == nil {
		dc.Registry = DefaultRegistry
	}
	if vr == nil {
		return nil, errors.New("cannot create a new Decoder with a nil ValueReader")
	}

	return &Decoder{
		dc: dc,
		vr: vr,
	}, nil
}

// Decode reads the next BSON document from the stream and decodes it into the
// value pointed to by val.
//
// See [Unmarshal] for details about BSON unmarshaling behavior.
func (d *Decoder) Decode(val interface{}) error {
	if unmarshaler, ok := val.(Unmarshaler); ok {
		// TODO(skriptble): Reuse a []byte here and use the AppendDocumentBytes method.
		buf, err := bsonrw.Copier{}.CopyDocumentToBytes(d.vr)
		if err != nil {
			return err
		}
		return unmarshaler.UnmarshalBSON(buf)
	}

	rval := reflect.ValueOf(val)
	switch rval.Kind() {
	case reflect.Ptr:
		if rval.IsNil() {
			return ErrDecodeToNil
		}
		rval = rval.Elem()
	case reflect.Map:
		if rval.IsNil() {
			return ErrDecodeToNil
		}
	default:
		return fmt.Errorf("argument to Decode must be a pointer or a map, but got %v", rval)
	}
	decoder, err := d.dc.LookupDecoder(rval.Type())
	if err != nil {
		return err
	}

	if d.defaultDocumentM {
		d.dc.DefaultDocumentM()
	}
	if d.defaultDocumentD {
		d.dc.DefaultDocumentD()
	}
	if d.binaryAsSlice {
		d.dc.BinaryAsSlice()
	}
	if d.useJSONStructTags {
		d.dc.UseJSONStructTags()
	}
	if d.useLocalTimeZone {
		d.dc.UseLocalTimeZone()
	}
	if d.zeroMaps {
		d.dc.ZeroMaps()
	}
	if d.zeroStructs {
		d.dc.ZeroStructs()
	}

	return decoder.DecodeValue(d.dc, d.vr, rval)
}

// Reset will reset the state of the decoder, using the same *DecodeContext used in
// the original construction but using vr for reading.
func (d *Decoder) Reset(vr bsonrw.ValueReader) error {
	// TODO:(GODRIVER-2719): Remove error return value.
	d.vr = vr
	return nil
}

// SetRegistry replaces the current registry of the decoder with r.
func (d *Decoder) SetRegistry(r *bsoncodec.Registry) error {
	// TODO:(GODRIVER-2719): Remove error return value.
	d.dc.Registry = r
	return nil
}

// SetContext replaces the current registry of the decoder with dc.
//
// Deprecated: Use the Decoder configuration methods to set the desired unmarshal behavior instead.
func (d *Decoder) SetContext(dc bsoncodec.DecodeContext) error {
	// TODO:(GODRIVER-2719): Remove error return value.
	d.dc = dc
	return nil
}

// DefaultDocumentM causes the Decoder to always unmarshal documents into the primitive.M type. This
// behavior is restricted to data typed as "interface{}" or "map[string]interface{}".
func (d *Decoder) DefaultDocumentM() {
	d.defaultDocumentM = true
}

// DefaultDocumentD causes the Decoder to always unmarshal documents into the primitive.D type. This
// behavior is restricted to data typed as "interface{}" or "map[string]interface{}".
func (d *Decoder) DefaultDocumentD() {
	d.defaultDocumentD = true
}

// AllowTruncatingDoubles causes the Decoder to truncate the fractional part of BSON "double" values
// when attempting to unmarshal them into a Go integer (int, int8, int16, int32, or int64) struct
// field. The truncation logic does not apply to BSON "decimal128" values.
func (d *Decoder) AllowTruncatingDoubles() {
	d.dc.Truncate = true
}

// BinaryAsSlice causes the Decoder to unmarshal BSON binary field values that are the "Generic" or
// "Old" BSON binary subtype as a Go byte slice instead of a primitive.Binary.
func (d *Decoder) BinaryAsSlice() {
	d.binaryAsSlice = true
}

// UseJSONStructTags causes the Decoder to fall back to using the "json" struct tag if a "bson"
// struct tag is not specified.
func (d *Decoder) UseJSONStructTags() {
	d.useJSONStructTags = true
}

// UseLocalTimeZone causes the Decoder to unmarshal time.Time values in the local timezone instead
// of the UTC timezone.
func (d *Decoder) UseLocalTimeZone() {
	d.useLocalTimeZone = true
}

// ZeroMaps causes the Decoder to delete any existing values from Go maps in the destination value
// passed to Decode before unmarshaling BSON documents into them.
func (d *Decoder) ZeroMaps() {
	d.zeroMaps = true
}

// ZeroStructs causes the Decoder to delete any existing values from Go structs in the destination
// value passed to Decode before unmarshaling BSON documents into them.
func (d *Decoder) ZeroStructs() {
	d.zeroStructs = true
}
