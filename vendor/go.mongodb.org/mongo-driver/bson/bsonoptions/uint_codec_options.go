// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

// UIntCodecOptions represents all possible options for uint encoding and decoding.
//
// Deprecated: Use the bson.Encoder and bson.Decoder configuration methods to set the desired BSON marshal
// and unmarshal behavior instead.
type UIntCodecOptions struct {
	EncodeToMinSize *bool // Specifies if all uints except uint64 should be decoded to minimum size bsontype. Defaults to false.
}

// UIntCodec creates a new *UIntCodecOptions
//
// Deprecated: Use the bson.Encoder and bson.Decoder configuration methods to set the desired BSON marshal
// and unmarshal behavior instead.
func UIntCodec() *UIntCodecOptions {
	return &UIntCodecOptions{}
}

// SetEncodeToMinSize specifies if all uints except uint64 should be decoded to minimum size bsontype. Defaults to false.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.Encoder.IntMinSize] instead.
func (u *UIntCodecOptions) SetEncodeToMinSize(b bool) *UIntCodecOptions {
	u.EncodeToMinSize = &b
	return u
}

// MergeUIntCodecOptions combines the given *UIntCodecOptions into a single *UIntCodecOptions in a last one wins fashion.
//
// Deprecated: Merging options structs will not be supported in Go Driver 2.0. Users should create a
// single options struct instead.
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
