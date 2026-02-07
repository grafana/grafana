// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

// MapCodecOptions represents all possible options for map encoding and decoding.
//
// Deprecated: Use the bson.Encoder and bson.Decoder configuration methods to set the desired BSON marshal
// and unmarshal behavior instead.
type MapCodecOptions struct {
	DecodeZerosMap   *bool // Specifies if the map should be zeroed before decoding into it. Defaults to false.
	EncodeNilAsEmpty *bool // Specifies if a nil map should encode as an empty document instead of null. Defaults to false.
	// Specifies how keys should be handled. If false, the behavior matches encoding/json, where the encoding key type must
	// either be a string, an integer type, or implement bsoncodec.KeyMarshaler and the decoding key type must either be a
	// string, an integer type, or implement bsoncodec.KeyUnmarshaler. If true, keys are encoded with fmt.Sprint() and the
	// encoding key type must be a string, an integer type, or a float. If true, the use of Stringer will override
	// TextMarshaler/TextUnmarshaler. Defaults to false.
	EncodeKeysWithStringer *bool
}

// MapCodec creates a new *MapCodecOptions
//
// Deprecated: Use the bson.Encoder and bson.Decoder configuration methods to set the desired BSON marshal
// and unmarshal behavior instead.
func MapCodec() *MapCodecOptions {
	return &MapCodecOptions{}
}

// SetDecodeZerosMap specifies if the map should be zeroed before decoding into it. Defaults to false.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.Decoder.ZeroMaps] instead.
func (t *MapCodecOptions) SetDecodeZerosMap(b bool) *MapCodecOptions {
	t.DecodeZerosMap = &b
	return t
}

// SetEncodeNilAsEmpty specifies if a nil map should encode as an empty document instead of null. Defaults to false.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.Encoder.NilMapAsEmpty] instead.
func (t *MapCodecOptions) SetEncodeNilAsEmpty(b bool) *MapCodecOptions {
	t.EncodeNilAsEmpty = &b
	return t
}

// SetEncodeKeysWithStringer specifies how keys should be handled. If false, the behavior matches encoding/json, where the
// encoding key type must either be a string, an integer type, or implement bsoncodec.KeyMarshaler and the decoding key
// type must either be a string, an integer type, or implement bsoncodec.KeyUnmarshaler. If true, keys are encoded with
// fmt.Sprint() and the encoding key type must be a string, an integer type, or a float. If true, the use of Stringer
// will override TextMarshaler/TextUnmarshaler. Defaults to false.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.Encoder.StringifyMapKeysWithFmt] instead.
func (t *MapCodecOptions) SetEncodeKeysWithStringer(b bool) *MapCodecOptions {
	t.EncodeKeysWithStringer = &b
	return t
}

// MergeMapCodecOptions combines the given *MapCodecOptions into a single *MapCodecOptions in a last one wins fashion.
//
// Deprecated: Merging options structs will not be supported in Go Driver 2.0. Users should create a
// single options struct instead.
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
		if opt.EncodeKeysWithStringer != nil {
			s.EncodeKeysWithStringer = opt.EncodeKeysWithStringer
		}
	}

	return s
}
