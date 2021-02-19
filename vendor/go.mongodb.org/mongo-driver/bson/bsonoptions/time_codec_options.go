// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonoptions

// TimeCodecOptions represents all possible options for time.Time encoding and decoding.
type TimeCodecOptions struct {
	UseLocalTimeZone *bool // Specifies if we should decode into the local time zone. Defaults to false.
}

// TimeCodec creates a new *TimeCodecOptions
func TimeCodec() *TimeCodecOptions {
	return &TimeCodecOptions{}
}

// SetUseLocalTimeZone specifies if we should decode into the local time zone. Defaults to false.
func (t *TimeCodecOptions) SetUseLocalTimeZone(b bool) *TimeCodecOptions {
	t.UseLocalTimeZone = &b
	return t
}

// MergeTimeCodecOptions combines the given *TimeCodecOptions into a single *TimeCodecOptions in a last one wins fashion.
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
