// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package exemplar // import "go.opentelemetry.io/otel/sdk/metric/exemplar"

import (
	"context"
	"sync"
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

func (r *storage) store(ctx context.Context, idx int, ts time.Time, v Value, droppedAttr []attribute.KeyValue) {
	r.measurements[idx].mux.Lock()
	defer r.measurements[idx].mux.Unlock()
	r.measurements[idx].FilteredAttributes = droppedAttr
	r.measurements[idx].Time = ts
	r.measurements[idx].Value = v
	r.measurements[idx].Ctx = ctx
	r.measurements[idx].valid = true
}

// Collect returns all the held exemplars.
//
// The Reservoir state is preserved after this call.
func (r *storage) Collect(dest *[]Exemplar) {
	*dest = reset(*dest, len(r.measurements), len(r.measurements))
	var n int
	for i := range r.measurements {
		if r.measurements[i].exemplar(&(*dest)[n]) {
			n++
		}
	}
	*dest = (*dest)[:n]
}

// measurement is a measurement made by a telemetry system.
type measurement struct {
	mux sync.Mutex
	// FilteredAttributes are the attributes dropped during the measurement.
	FilteredAttributes []attribute.KeyValue
	// Time is the time when the measurement was made.
	Time time.Time
	// Value is the value of the measurement.
	Value Value
	// Ctx is the context active when a measurement was made.
	Ctx context.Context

	valid bool
}

// exemplar returns m as an [Exemplar].
// returns true if it populated the exemplar.
func (m *measurement) exemplar(dest *Exemplar) bool {
	m.mux.Lock()
	defer m.mux.Unlock()
	if !m.valid {
		return false
	}

	dest.FilteredAttributes = m.FilteredAttributes
	dest.Time = m.Time
	dest.Value = m.Value

	sc := trace.SpanContextFromContext(m.Ctx)
	if sc.HasTraceID() {
		traceID := sc.TraceID()
		dest.TraceID = traceID[:]
	} else {
		dest.TraceID = dest.TraceID[:0]
	}

	if sc.HasSpanID() {
		spanID := sc.SpanID()
		dest.SpanID = spanID[:]
	} else {
		dest.SpanID = dest.SpanID[:0]
	}
	return true
}

func reset[T any](s []T, length, capacity int) []T {
	if cap(s) < capacity {
		return make([]T, length, capacity)
	}
	return s[:length]
}
