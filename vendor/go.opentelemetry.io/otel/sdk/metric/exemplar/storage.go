// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package exemplar // import "go.opentelemetry.io/otel/sdk/metric/exemplar"

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// storage is an exemplar storage for [Reservoir] implementations.
type storage struct {
	// measurements are the measurements sampled.
	//
	// This does not use []metricdata.Exemplar because it potentially would
	// require an allocation for trace and span IDs in the hot path of Offer.
	measurements []measurement
}

func newStorage(n int) *storage {
	return &storage{measurements: make([]measurement, n)}
}

func (r *storage) store(idx int, m measurement) {
	r.measurements[idx] = m
}

// Collect returns all the held exemplars.
//
// The Reservoir state is preserved after this call.
func (r *storage) Collect(dest *[]Exemplar) {
	*dest = reset(*dest, len(r.measurements), len(r.measurements))
	var n int
	for _, m := range r.measurements {
		if !m.valid {
			continue
		}

		m.exemplar(&(*dest)[n])
		n++
	}
	*dest = (*dest)[:n]
}

// measurement is a measurement made by a telemetry system.
type measurement struct {
	// FilteredAttributes are the attributes dropped during the measurement.
	FilteredAttributes []attribute.KeyValue
	// Time is the time when the measurement was made.
	Time time.Time
	// Value is the value of the measurement.
	Value Value
	// SpanContext is the SpanContext active when a measurement was made.
	SpanContext trace.SpanContext

	valid bool
}

// newMeasurement returns a new non-empty Measurement.
func newMeasurement(ctx context.Context, ts time.Time, v Value, droppedAttr []attribute.KeyValue) measurement {
	return measurement{
		FilteredAttributes: droppedAttr,
		Time:               ts,
		Value:              v,
		SpanContext:        trace.SpanContextFromContext(ctx),
		valid:              true,
	}
}

// exemplar returns m as an [Exemplar].
func (m measurement) exemplar(dest *Exemplar) {
	dest.FilteredAttributes = m.FilteredAttributes
	dest.Time = m.Time
	dest.Value = m.Value

	if m.SpanContext.HasTraceID() {
		traceID := m.SpanContext.TraceID()
		dest.TraceID = traceID[:]
	} else {
		dest.TraceID = dest.TraceID[:0]
	}

	if m.SpanContext.HasSpanID() {
		spanID := m.SpanContext.SpanID()
		dest.SpanID = spanID[:]
	} else {
		dest.SpanID = dest.SpanID[:0]
	}
}

func reset[T any](s []T, length, capacity int) []T {
	if cap(s) < capacity {
		return make([]T, length, capacity)
	}
	return s[:length]
}
