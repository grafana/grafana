// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package aggregate // import "go.opentelemetry.io/otel/sdk/metric/internal/aggregate"

import (
	"context"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/metric/exemplar"
	"go.opentelemetry.io/otel/sdk/metric/internal/reservoir"
)

// FilteredExemplarReservoir wraps a [exemplar.Reservoir] with a filter.
type FilteredExemplarReservoir[N int64 | float64] interface {
	// Offer accepts the parameters associated with a measurement. The
	// parameters will be stored as an exemplar if the filter decides to
	// sample the measurement.
	//
	// The passed ctx needs to contain any baggage or span that were active
	// when the measurement was made. This information may be used by the
	// Reservoir in making a sampling decision.
	Offer(ctx context.Context, val N, attr []attribute.KeyValue)
	// Collect returns all the held exemplars in the reservoir.
	Collect(dest *[]exemplar.Exemplar)
}

// filteredExemplarReservoir handles the pre-sampled exemplar of measurements made.
type filteredExemplarReservoir[N int64 | float64] struct {
	filter    exemplar.Filter
	reservoir exemplar.Reservoir
	// The exemplar.Reservoir is not required to be concurrent safe, but
	// implementations can indicate that they are concurrent-safe by embedding
	// reservoir.ConcurrentSafe in order to improve performance.
	reservoirMux   sync.Mutex
	concurrentSafe bool
}

// NewFilteredExemplarReservoir creates a [FilteredExemplarReservoir] which only offers values
// that are allowed by the filter.
func NewFilteredExemplarReservoir[N int64 | float64](
	f exemplar.Filter,
	r exemplar.Reservoir,
) FilteredExemplarReservoir[N] {
	_, concurrentSafe := r.(reservoir.ConcurrentSafe)
	return &filteredExemplarReservoir[N]{
		filter:         f,
		reservoir:      r,
		concurrentSafe: concurrentSafe,
	}
}

func (f *filteredExemplarReservoir[N]) Offer(ctx context.Context, val N, attr []attribute.KeyValue) {
	if f.filter(ctx) {
		// only record the current time if we are sampling this measurement.
		ts := time.Now()
		if !f.concurrentSafe {
			f.reservoirMux.Lock()
			defer f.reservoirMux.Unlock()
		}
		f.reservoir.Offer(ctx, ts, exemplar.NewValue(val), attr)
	}
}

func (f *filteredExemplarReservoir[N]) Collect(dest *[]exemplar.Exemplar) {
	if !f.concurrentSafe {
		f.reservoirMux.Lock()
		defer f.reservoirMux.Unlock()
	}
	f.reservoir.Collect(dest)
}
