// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

// UIntCodecOptions represents all possible options for uint encoding and decoding.
type UIntCodecOptions struct {
	EncodeToMinSize *bool // Specifies if all uints except uint64 should be decoded to minimum size bsontype. Defaults to false.
}

// UIntCodec creates a new *UIntCodecOptions
func UIntCodec() *UIntCodecOptions {
	return &UIntCodecOptions{}
}

// SetEncodeToMinSize specifies if all uints except uint64 should be decoded to minimum size bsontype. Defaults to false.
func (u *UIntCodecOptions) SetEncodeToMinSize(b bool) *UIntCodecOptions {
	u.EncodeToMinSize = &b
	return u
}

// MergeUIntCodecOptions combines the given *UIntCodecOptions into a single *UIntCodecOptions in a last one wins fashion.
func MergeUIntCodecOptions(opts ...*UIntCodecOptions) *UIntCodecOptions {
	u := UIntCodec()
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		if opt.EncodeToMinSize != nil {
			u.EncodeToMinSize = opt.EncodeToMinSize
		}
	}

	return u
}
