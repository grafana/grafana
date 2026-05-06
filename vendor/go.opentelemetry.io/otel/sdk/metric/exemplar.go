// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package metric // import "go.opentelemetry.io/otel/sdk/metric"

import (
	"runtime"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/metric/exemplar"
	"go.opentelemetry.io/otel/sdk/metric/internal/aggregate"
)

// ExemplarReservoirProviderSelector selects the
// [exemplar.ReservoirProvider] to use
// based on the [Aggregation] of the metric.
type ExemplarReservoirProviderSelector func(Aggregation) exemplar.ReservoirProvider

// reservoirFunc returns the appropriately configured exemplar reservoir
// creation func based on the passed InstrumentKind and filter configuration.
func reservoirFunc[N int64 | float64](
	provider exemplar.ReservoirProvider,
	filter exemplar.Filter,
) func(attribute.Set) aggregate.FilteredExemplarReservoir[N] {
	return func(attrs attribute.Set) aggregate.FilteredExemplarReservoir[N] {
		return aggregate.NewFilteredExemplarReservoir[N](filter, provider(attrs))
	}
}

// DefaultExemplarReservoirProviderSelector returns the default
// [exemplar.ReservoirProvider] for the
// provided [Aggregation].
//
// For explicit bucket histograms with more than 1 bucket, it uses the
// [exemplar.HistogramReservoirProvider].
// For exponential histograms, it uses the
// [exemplar.FixedSizeReservoirProvider]
// with a size of min(20, max_buckets).
// For all other aggregations, it uses the
// [exemplar.FixedSizeReservoirProvider]
// with a size equal to the number of CPUs.
//
// Exemplar default reservoirs MAY change in a minor version bump. No
// guarantees are made on the shape or statistical properties of returned
// exemplars.
func DefaultExemplarReservoirProviderSelector(agg Aggregation) exemplar.ReservoirProvider {
	// https://github.com/open-telemetry/opentelemetry-specification/blob/d4b241f451674e8f611bb589477680341006ad2b/specification/metrics/sdk.md#exemplar-defaults
	// Explicit bucket histogram aggregation with more than 1 bucket will
	// use AlignedHistogramBucketExemplarReservoir.
	a, ok := agg.(AggregationExplicitBucketHistogram)
	if ok && len(a.Boundaries) > 0 {
		return exemplar.HistogramReservoirProvider(a.Boundaries)
	}

	var n int
	if a, ok := agg.(AggregationBase2ExponentialHistogram); ok {
		// Base2 Exponential Histogram Aggregation SHOULD use a
		// SimpleFixedSizeExemplarReservoir with a reservoir equal to the
		// smaller of the maximum number of buckets configured on the
		// aggregation or twenty (e.g. min(20, max_buckets)).
		n = min(int(a.MaxSize), 20)
	} else {
		// https://github.com/open-telemetry/opentelemetry-specification/blob/e94af89e3d0c01de30127a0f423e912f6cda7bed/specification/metrics/sdk.md#simplefixedsizeexemplarreservoir
		//   This Exemplar reservoir MAY take a configuration parameter for
		//   the size of the reservoir. If no size configuration is
		//   provided, the default size MAY be the number of possible
		//   concurrent threads (e.g. number of CPUs) to help reduce
		//   contention. Otherwise, a default size of 1 SHOULD be used.
		//
		// Use runtime.GOMAXPROCS instead of runtime.NumCPU to support
		// containerized environments that may have less than the total number
		// of logical CPUs available on the local machine allocated to it.
		n = max(runtime.GOMAXPROCS(0), 1)
	}

	return exemplar.FixedSizeReservoirProvider(n)
}
