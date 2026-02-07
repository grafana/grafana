// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

//go:generate stringer -type=Temporality

package metricdata // import "go.opentelemetry.io/otel/sdk/metric/metricdata"

// Temporality defines the window that an aggregation was calculated over.
type Temporality uint8

const (
	// undefinedTemporality represents an unset Temporality.
	//nolint:unused
	undefinedTemporality Temporality = iota

	// CumulativeTemporality defines a measurement interval that continues to
	// expand forward in time from a starting point. New measurements are
	// added to all previous measurements since a start time.
	CumulativeTemporality

	// DeltaTemporality defines a measurement interval that resets each cycle.
	// Measurements from one cycle are recorded independently, measurements
	// from other cycles do not affect them.
	DeltaTemporality
)

// MarshalText returns the byte encoded of t.
func (t Temporality) MarshalText() ([]byte, error) {
	return []byte(t.String()), nil
}
