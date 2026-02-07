// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pmetric // import "go.opentelemetry.io/collector/pdata/pmetric"

const noRecordValueMask = uint32(1)

var DefaultDataPointFlags = DataPointFlags(0)

// DataPointFlags defines how a metric aggregator reports aggregated values.
// It describes how those values relate to the time interval over which they are aggregated.
type DataPointFlags uint32

// NoRecordedValue returns true if the DataPointFlags contains the NoRecordedValue flag.
func (ms DataPointFlags) NoRecordedValue() bool {
	return uint32(ms)&noRecordValueMask != 0
}

// WithNoRecordedValue returns a new DataPointFlags, with the NoRecordedValue flag set to the given value.
func (ms DataPointFlags) WithNoRecordedValue(b bool) DataPointFlags {
	orig := uint32(ms)
	if b {
		orig |= noRecordValueMask
	} else {
		orig &^= noRecordValueMask
	}
	return DataPointFlags(orig)
}
