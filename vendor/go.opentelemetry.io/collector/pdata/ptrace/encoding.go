// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package ptrace // import "go.opentelemetry.io/collector/pdata/ptrace"

// MarshalSizer is the interface that groups the basic Marshal and Size methods
type MarshalSizer interface {
	Marshaler
	Sizer
}

// Marshaler marshals Traces into bytes.
type Marshaler interface {
	// MarshalTraces the given Traces into bytes.
	// If the error is not nil, the returned bytes slice cannot be used.
	MarshalTraces(td Traces) ([]byte, error)
}

// Unmarshaler unmarshalls bytes into Traces.
type Unmarshaler interface {
	// UnmarshalTraces the given bytes into Traces.
	// If the error is not nil, the returned Traces cannot be used.
	UnmarshalTraces(buf []byte) (Traces, error)
}

// Sizer is an optional interface implemented by the Marshaler,
// that calculates the size of a marshaled Traces.
type Sizer interface {
	// TracesSize returns the size in bytes of a marshaled Traces.
	TracesSize(td Traces) int
}
