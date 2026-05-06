// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

// TimeCodecOptions represents all possible options for time.Time encoding and decoding.
//
// Deprecated: Use the bson.Encoder and bson.Decoder configuration methods to set the desired BSON marshal
// and unmarshal behavior instead.
type TimeCodecOptions struct {
	UseLocalTimeZone *bool // Specifies if we should decode into the local time zone. Defaults to false.
}

// TimeCodec creates a new *TimeCodecOptions
//
// Deprecated: Use the bson.Encoder and bson.Decoder configuration methods to set the desired BSON marshal
// and unmarshal behavior instead.
func TimeCodec() *TimeCodecOptions {
	return &TimeCodecOptions{}
}

// SetUseLocalTimeZone specifies if we should decode into the local time zone. Defaults to false.
//
// Deprecated: Use [go.mongodb.org/mongo-driver/bson.Decoder.UseLocalTimeZone] instead.
func (t *TimeCodecOptions) SetUseLocalTimeZone(b bool) *TimeCodecOptions {
	t.UseLocalTimeZone = &b
	return t
}

// MergeTimeCodecOptions combines the given *TimeCodecOptions into a single *TimeCodecOptions in a last one wins fashion.
//
// Deprecated: Merging options structs will not be supported in Go Driver 2.0. Users should create a
// single options struct instead.
func MergeTimeCodecOptions(opts ...*TimeCodecOptions) *TimeCodecOptions {
	t := TimeCodec()
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		if opt.UseLocalTimeZone != nil {
			t.UseLocalTimeZone = opt.UseLocalTimeZone
		}
	}

	return t
}
