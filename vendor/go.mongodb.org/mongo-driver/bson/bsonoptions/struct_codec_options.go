// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

var defaultOverwriteDuplicatedInlinedFields = true

// StructCodecOptions represents all possible options for struct encoding and decoding.
//
// Deprecated: Use the bson.Encoder and bson.Decoder configuration methods to set the desired BSON marshal
// and unmarshal behavior instead.
type StructCodecOptions struct {
	DecodeZeroStruct                 *bool // Specifies if structs should be zeroed before decoding into them. Defaults to false.
	DecodeDeepZeroInline             *bool // Specifies if structs should be recursively zeroed when a inline value is decoded. Defaults to false.
	EncodeOmitDefaultStruct          *bool // Specifies if default structs should be considered empty by omitempty. Defaults to false.
	AllowUnexportedFields            *bool // Specifies if unexported fields should be marshaled/unmarshaled. Defaults to false.
	OverwriteDuplicatedInlinedFields *bool // Specifies if fields in inlined structs can be overwritten by higher level struct fields with the same key. Defaults to true.
}

// StructCodec creates a new *StructCodecOptions
//
// Deprecated: Use the bson.Encoder and bson.Decoder configuration methods to set the desired BSON marshal
// and unmarshal behavior instead.
func StructCodec() *StructCodecOptions {
	return &StructCodecOptions{}
}

// SetDecodeZeroStruct specifies if structs should be zeroed before decoding into them. Defaults to false.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.Decoder.ZeroStructs] instead.
func (t *StructCodecOptions) SetDecodeZeroStruct(b bool) *StructCodecOptions {
	t.DecodeZeroStruct = &b
	return t
}

// SetDecodeDeepZeroInline specifies if structs should be zeroed before decoding into them. Defaults to false.
//
// Deprecated: DecodeDeepZeroInline will not be supported in Go Driver 2.0.
func (t *StructCodecOptions) SetDecodeDeepZeroInline(b bool) *StructCodecOptions {
	t.DecodeDeepZeroInline = &b
	return t
}

// SetEncodeOmitDefaultStruct specifies if default structs should be considered empty by omitempty. A default struct has all
// its values set to their default value. Defaults to false.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.Encoder.OmitZeroStruct] instead.
func (t *StructCodecOptions) SetEncodeOmitDefaultStruct(b bool) *StructCodecOptions {
	t.EncodeOmitDefaultStruct = &b
	return t
}

// SetOverwriteDuplicatedInlinedFields specifies if inlined struct fields can be overwritten by higher level struct fields with the
// same bson key. When true and decoding, values will be written to the outermost struct with a matching key, and when
// encoding, keys will have the value of the top-most matching field. When false, decoding and encoding will error if
// there are duplicate keys after the struct is inlined. Defaults to true.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.Encoder.ErrorOnInlineDuplicates] instead.
func (t *StructCodecOptions) SetOverwriteDuplicatedInlinedFields(b bool) *StructCodecOptions {
	t.OverwriteDuplicatedInlinedFields = &b
	return t
}

// SetAllowUnexportedFields specifies if unexported fields should be marshaled/unmarshaled. Defaults to false.
//
// Deprecated: AllowUnexportedFields does not work on recent versions of Go and will not be
// supported in Go Driver 2.0.
func (t *StructCodecOptions) SetAllowUnexportedFields(b bool) *StructCodecOptions {
	t.AllowUnexportedFields = &b
	return t
}

// MergeStructCodecOptions combines the given *StructCodecOptions into a single *StructCodecOptions in a last one wins fashion.
//
// Deprecated: Merging options structs will not be supported in Go Driver 2.0. Users should create a
// single options struct instead.
func MergeStructCodecOptions(opts ...*StructCodecOptions) *StructCodecOptions {
	s := &StructCodecOptions{
		OverwriteDuplicatedInlinedFields: &defaultOverwriteDuplicatedInlinedFields,
	}
	for _, opt := range opts {
		if opt == nil {
			continue
		}

		if opt.DecodeZeroStruct != nil {
			s.DecodeZeroStruct = opt.DecodeZeroStruct
		}
		if opt.DecodeDeepZeroInline != nil {
			s.DecodeDeepZeroInline = opt.DecodeDeepZeroInline
		}
		if opt.EncodeOmitDefaultStruct != nil {
			s.EncodeOmitDefaultStruct = opt.EncodeOmitDefaultStruct
		}
		if opt.OverwriteDuplicatedInlinedFields != nil {
			s.OverwriteDuplicatedInlinedFields = opt.OverwriteDuplicatedInlinedFields
		}
		if opt.AllowUnexportedFields != nil {
			s.AllowUnexportedFields = opt.AllowUnexportedFields
		}
	}

	return s
}
