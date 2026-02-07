// Copyright (c) 2019 The Jaeger Authors.
// Copyright (c) 2017 Uber Technologies, Inc.
// SPDX-License-Identifier: Apache-2.0

package model

const (
	// SampledFlag is the bit set in Flags in order to define a span as a sampled span
	SampledFlag = Flags(1)
	// DebugFlag is the bit set in Flags in order to define a span as a debug span
	DebugFlag = Flags(2)
	// FirehoseFlag is the bit in Flags in order to define a span as a firehose span
	FirehoseFlag = Flags(8)
)

// Flags is a bit map of flags for a span
type Flags uint32

// ------- Flags -------

// SetSampled sets the Flags as sampled
func (f *Flags) SetSampled() {
	f.setFlags(SampledFlag)
}

// SetDebug set the Flags as sampled
func (f *Flags) SetDebug() {
	f.setFlags(DebugFlag)
}

// SetFirehose set the Flags as firehose enabled
func (f *Flags) SetFirehose() {
	f.setFlags(FirehoseFlag)
}

func (f *Flags) setFlags(bit Flags) {
	*f |= bit
}

// IsSampled returns true if the Flags denote sampling
func (f Flags) IsSampled() bool {
	return f.checkFlags(SampledFlag)
}

// IsDebug returns true if the Flags denote debugging
// Debugging can be useful in testing tracing availability or correctness
func (f Flags) IsDebug() bool {
	return f.checkFlags(DebugFlag)
}

// IsFirehoseEnabled returns true if firehose is enabled
// Firehose is used to decide whether to index a span or not
func (f Flags) IsFirehoseEnabled() bool {
	return f.checkFlags(FirehoseFlag)
}

func (f Flags) checkFlags(bit Flags) bool {
	return f&bit == bit
}
