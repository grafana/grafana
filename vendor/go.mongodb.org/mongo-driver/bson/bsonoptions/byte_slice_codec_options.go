// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

// ByteSliceCodecOptions represents all possible options for byte slice encoding and decoding.
type ByteSliceCodecOptions struct {
	EncodeNilAsEmpty *bool // Specifies if a nil byte slice should encode as an empty binary instead of null. Defaults to false.
}

// ByteSliceCodec creates a new *ByteSliceCodecOptions
func ByteSliceCodec() *ByteSliceCodecOptions {
	return &ByteSliceCodecOptions{}
}

// SetEncodeNilAsEmpty specifies  if a nil byte slice should encode as an empty binary instead of null. Defaults to false.
func (bs *ByteSliceCodecOptions) SetEncodeNilAsEmpty(b bool) *ByteSliceCodecOptions {
	bs.EncodeNilAsEmpty = &b
	return bs
}

// MergeByteSliceCodecOptions combines the given *ByteSliceCodecOptions into a single *ByteSliceCodecOptions in a last one wins fashion.
func MergeByteSliceCodecOptions(opts ...*ByteSliceCodecOptions) *ByteSliceCodecOptions {
	bs := ByteSliceCodec()
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		if opt.EncodeNilAsEmpty != nil {
			bs.EncodeNilAsEmpty = opt.EncodeNilAsEmpty
		}
	}

	return bs
}
