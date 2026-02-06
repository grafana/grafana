// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pmetric // import "go.opentelemetry.io/collector/pdata/pmetric"

// MarshalSizer is the interface that groups the basic Marshal and Size methods
type MarshalSizer interface {
	Marshaler
	Sizer
}

// Marshaler marshals pmetric.Metrics into bytes.
type Marshaler interface {
	// MarshalMetrics the given pmetric.Metrics into bytes.
	// If the error is not nil, the returned bytes slice cannot be used.
	MarshalMetrics(md Metrics) ([]byte, error)
}

// Unmarshaler unmarshalls bytes into pmetric.Metrics.
type Unmarshaler interface {
	// UnmarshalMetrics the given bytes into pmetric.Metrics.
	// If the error is not nil, the returned pmetric.Metrics cannot be used.
	UnmarshalMetrics(buf []byte) (Metrics, error)
}

// Sizer is an optional interface implemented by the Marshaler, that calculates the size of a marshaled Metrics.
type Sizer interface {
	// MetricsSize returns the size in bytes of a marshaled Metrics.
	MetricsSize(md Metrics) int
}
