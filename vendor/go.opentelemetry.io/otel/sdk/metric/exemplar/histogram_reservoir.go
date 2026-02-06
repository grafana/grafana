// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package exemplar // import "go.opentelemetry.io/otel/sdk/metric/exemplar"

import (
	"context"
	"slices"
	"sort"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/metric/internal/reservoir"
)

// HistogramReservoirProvider is a provider of [HistogramReservoir].
func HistogramReservoirProvider(bounds []float64) ReservoirProvider {
	cp := slices.Clone(bounds)
	slices.Sort(cp)
	return func(attribute.Set) Reservoir {
		return NewHistogramReservoir(cp)
	}
}

// NewHistogramReservoir returns a [HistogramReservoir] that samples the last
// measurement that falls within a histogram bucket. The histogram bucket
// upper-boundaries are define by bounds.
//
// The passed bounds must be sorted before calling this function.
func NewHistogramReservoir(bounds []float64) *HistogramReservoir {
	return &HistogramReservoir{
		bounds:  bounds,
		storage: newStorage(len(bounds) + 1),
	}
}

var _ Reservoir = &HistogramReservoir{}

// HistogramReservoir is a [Reservoir] that samples the last measurement that
// falls within a histogram bucket. The histogram bucket upper-boundaries are
// define by bounds.
type HistogramReservoir struct {
	reservoir.ConcurrentSafe
	*storage
	mu sync.Mutex

	// bounds are bucket bounds in ascending order.
	bounds []float64
}

// Offer accepts the parameters associated with a measurement. The
// parameters will be stored as an exemplar if the Reservoir decides to
// sample the measurement.
//
// The passed ctx needs to contain any baggage or span that were active
// when the measurement was made. This information may be used by the
// Reservoir in making a sampling decision.
//
// The time t is the time when the measurement was made. The v and a
// parameters are the value and dropped (filtered) attributes of the
// measurement respectively.
func (r *HistogramReservoir) Offer(ctx context.Context, t time.Time, v Value, a []attribute.KeyValue) {
	var n float64
	switch v.Type() {
	case Int64ValueType:
		n = float64(v.Int64())
	case Float64ValueType:
		n = v.Float64()
	default:
		panic("unknown value type")
	}

	idx := sort.SearchFloat64s(r.bounds, n)
	m := newMeasurement(ctx, t, v, a)

	r.mu.Lock()
	defer r.mu.Unlock()
	r.store(idx, m)
}

// Collect returns all the held exemplars.
//
// The Reservoir state is preserved after this call.
func (r *HistogramReservoir) Collect(dest *[]Exemplar) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.storage.Collect(dest)
}
