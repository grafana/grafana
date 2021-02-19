// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

// SliceCodecOptions represents all possible options for slice encoding and decoding.
type SliceCodecOptions struct {
	EncodeNilAsEmpty *bool // Specifies if a nil slice should encode as an empty array instead of null. Defaults to false.
}

// SliceCodec creates a new *SliceCodecOptions
func SliceCodec() *SliceCodecOptions {
	return &SliceCodecOptions{}
}

// SetEncodeNilAsEmpty specifies  if a nil slice should encode as an empty array instead of null. Defaults to false.
func (s *SliceCodecOptions) SetEncodeNilAsEmpty(b bool) *SliceCodecOptions {
	s.EncodeNilAsEmpty = &b
	return s
}

// MergeSliceCodecOptions combines the given *SliceCodecOptions into a single *SliceCodecOptions in a last one wins fashion.
func MergeSliceCodecOptions(opts ...*SliceCodecOptions) *SliceCodecOptions {
	s := SliceCodec()
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		if opt.EncodeNilAsEmpty != nil {
			s.EncodeNilAsEmpty = opt.EncodeNilAsEmpty
		}
	}

	return s
}
