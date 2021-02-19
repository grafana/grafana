// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

// MapCodecOptions represents all possible options for map encoding and decoding.
type MapCodecOptions struct {
	DecodeZerosMap   *bool // Specifies if the map should be zeroed before decoding into it. Defaults to false.
	EncodeNilAsEmpty *bool // Specifies if a nil map should encode as an empty document instead of null. Defaults to false.
}

// MapCodec creates a new *MapCodecOptions
func MapCodec() *MapCodecOptions {
	return &MapCodecOptions{}
}

// SetDecodeZerosMap specifies if the map should be zeroed before decoding into it. Defaults to false.
func (t *MapCodecOptions) SetDecodeZerosMap(b bool) *MapCodecOptions {
	t.DecodeZerosMap = &b
	return t
}

// SetEncodeNilAsEmpty specifies  if a nil map should encode as an empty document instead of null. Defaults to false.
func (t *MapCodecOptions) SetEncodeNilAsEmpty(b bool) *MapCodecOptions {
	t.EncodeNilAsEmpty = &b
	return t
}

// MergeMapCodecOptions combines the given *MapCodecOptions into a single *MapCodecOptions in a last one wins fashion.
func MergeMapCodecOptions(opts ...*MapCodecOptions) *MapCodecOptions {
	s := MapCodec()
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		if opt.DecodeZerosMap != nil {
			s.DecodeZerosMap = opt.DecodeZerosMap
		}
		if opt.EncodeNilAsEmpty != nil {
			s.EncodeNilAsEmpty = opt.EncodeNilAsEmpty
		}
	}

	return s
}
