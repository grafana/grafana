// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

// StructCodecOptions represents all possible options for struct encoding and decoding.
type StructCodecOptions struct {
	DecodeZeroStruct        *bool // Specifies if structs should be zeroed before decoding into them. Defaults to false.
	DecodeDeepZeroInline    *bool // Specifies if structs should be recursively zeroed when a inline value is decoded. Defaults to false.
	EncodeOmitDefaultStruct *bool // Specifies if default structs should be considered empty by omitempty. Defaults to false.
	AllowUnexportedFields   *bool // Specifies if unexported fields should be marshaled/unmarshaled. Defaults to false.
}

// StructCodec creates a new *StructCodecOptions
func StructCodec() *StructCodecOptions {
	return &StructCodecOptions{}
}

// SetDecodeZeroStruct specifies if structs should be zeroed before decoding into them. Defaults to false.
func (t *StructCodecOptions) SetDecodeZeroStruct(b bool) *StructCodecOptions {
	t.DecodeZeroStruct = &b
	return t
}

// SetDecodeDeepZeroInline specifies if structs should be zeroed before decoding into them. Defaults to false.
func (t *StructCodecOptions) SetDecodeDeepZeroInline(b bool) *StructCodecOptions {
	t.DecodeDeepZeroInline = &b
	return t
}

// SetEncodeOmitDefaultStruct specifies if default structs should be considered empty by omitempty. A default struct has all
// its values set to their default value. Defaults to false.
func (t *StructCodecOptions) SetEncodeOmitDefaultStruct(b bool) *StructCodecOptions {
	t.EncodeOmitDefaultStruct = &b
	return t
}

// SetAllowUnexportedFields specifies if unexported fields should be marshaled/unmarshaled. Defaults to false.
func (t *StructCodecOptions) SetAllowUnexportedFields(b bool) *StructCodecOptions {
	t.AllowUnexportedFields = &b
	return t
}

// MergeStructCodecOptions combines the given *StructCodecOptions into a single *StructCodecOptions in a last one wins fashion.
func MergeStructCodecOptions(opts ...*StructCodecOptions) *StructCodecOptions {
	s := StructCodec()
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
		if opt.AllowUnexportedFields != nil {
			s.AllowUnexportedFields = opt.AllowUnexportedFields
		}
	}

	return s
}
