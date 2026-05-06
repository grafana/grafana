// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package metric // import "go.opentelemetry.io/otel/sdk/metric"

import (
	"context"
	"errors"

	"go.opentelemetry.io/otel/sdk/metric/metricdata"
)

// errDuplicateRegister is logged by a Reader when an attempt to registered it
// more than once occurs.
var errDuplicateRegister = errors.New("duplicate reader registration")

// ErrReaderNotRegistered is returned if Collect or Shutdown are called before
// the reader is registered with a MeterProvider.
var ErrReaderNotRegistered = errors.New("reader is not registered")

// ErrReaderShutdown is returned if Collect or Shutdown are called after a
// reader has been Shutdown once.
var ErrReaderShutdown = errors.New("reader is shutdown")

// errNonPositiveDuration is logged when an environmental variable
// has non-positive value.
var errNonPositiveDuration = errors.New("non-positive duration")

// Reader is the interface used between the SDK and an
// exporter.  Control flow is bi-directional through the
// Reader, since the SDK initiates ForceFlush and Shutdown
// while the exporter initiates collection.  The Register() method here
// informs the Reader that it can begin reading, signaling the
// start of bi-directional control flow.
//
// Typically, push-based exporters that are periodic will
// implement PeriodicExporter themselves and construct a
// PeriodicReader to satisfy this interface.
//
// Pull-based exporters will typically implement Register
// themselves, since they read on demand.
//
// Warning: methods may be added to this interface in minor releases.
type Reader interface {
	// register registers a Reader with a MeterProvider.
	// The producer argument allows the Reader to signal the sdk to collect
	// and send aggregated metric measurements.
	register(sdkProducer)

	// temporality reports the Temporality for the instrument kind provided.
	//
	// This method needs to be concurrent safe with itself and all the other
	// Reader methods.
	temporality(InstrumentKind) metricdata.Temporality

	// aggregation returns what Aggregation to use for an instrument kind.
	//
	// This method needs to be concurrent safe with itself and all the other
	// Reader methods.
	aggregation(InstrumentKind) Aggregation // nolint:revive  // import-shadow for method scoped by type.

	// Collect gathers and returns all metric data related to the Reader from
	// the SDK and stores it in rm. An error is returned if this is called
	// after Shutdown or if rm is nil.
	//
	// This method needs to be concurrent safe, and the cancellation of the
	// passed context is expected to be honored.
	Collect(ctx context.Context, rm *metricdata.ResourceMetrics) error
	// DO NOT CHANGE: any modification will not be backwards compatible and
	// must never be done outside of a new major release.

	// Shutdown flushes all metric measurements held in an export pipeline and releases any
	// held computational resources.
	//
	// This deadline or cancellation of the passed context are honored. An appropriate
	// error will be returned in these situations. There is no guaranteed that all
	// telemetry be flushed or all resources have been released in these
	// situations.
	//
	// After Shutdown is called, calls to Collect will perform no operation and instead will return
	// an error indicating the shutdown state.
	//
	// This method needs to be concurrent safe.
	Shutdown(context.Context) error
	// DO NOT CHANGE: any modification will not be backwards compatible and
	// must never be done outside of a new major release.
}

// sdkProducer produces metrics for a Reader.
type sdkProducer interface {
	// produce returns aggregated metrics from a single collection.
	//
	// This method is safe to call concurrently.
	produce(context.Context, *metricdata.ResourceMetrics) error
}

// Producer produces metrics for a Reader from an external source.
type Producer interface {
	// DO NOT CHANGE: any modification will not be backwards compatible and
	// must never be done outside of a new major release.

	// Produce returns aggregated metrics from an external source.
	//
	// This method should be safe to call concurrently.
	Produce(context.Context) ([]metricdata.ScopeMetrics, error)
	// DO NOT CHANGE: any modification will not be backwards compatible and
	// must never be done outside of a new major release.
}

// produceHolder is used as an atomic.Value to wrap the non-concrete producer
// type.
type produceHolder struct {
	produce func(context.Context, *metricdata.ResourceMetrics) error
}

// shutdownProducer produces an ErrReaderShutdown error always.
type shutdownProducer struct{}

// produce returns an ErrReaderShutdown error.
func (shutdownProducer) produce(context.Context, *metricdata.ResourceMetrics) error {
	return ErrReaderShutdown
}

// TemporalitySelector selects the temporality to use based on the InstrumentKind.
type TemporalitySelector func(InstrumentKind) metricdata.Temporality

// DefaultTemporalitySelector is the default TemporalitySelector used if
// WithTemporalitySelector is not provided. CumulativeTemporality will be used
// for all instrument kinds if this TemporalitySelector is used.
func DefaultTemporalitySelector(k InstrumentKind) metricdata.Temporality {
	return CumulativeTemporalitySelector(k)
}

// CumulativeTemporalitySelector is the TemporalitySelector that uses
// a cumulative temporality for all instrument kinds.
func CumulativeTemporalitySelector(InstrumentKind) metricdata.Temporality {
	return metricdata.CumulativeTemporality
}

// DeltaTemporalitySelector is the TemporalitySelector that uses
// a delta temporality for instrument kinds: counter, histogram, observable counter
// All other instruments use cumulative temporality.
func DeltaTemporalitySelector(k InstrumentKind) metricdata.Temporality {
	switch k {
	case InstrumentKindCounter, InstrumentKindHistogram, InstrumentKindObservableCounter:
		return metricdata.DeltaTemporality
	default:
		return metricdata.CumulativeTemporality
	}
}

// LowMemoryTemporalitySelector is the TemporalitySelector that uses
// delta temporality for counters and histograms. All other instruments use
// cumulative temporality.
func LowMemoryTemporalitySelector(k InstrumentKind) metricdata.Temporality {
	switch k {
	case InstrumentKindCounter, InstrumentKindHistogram:
		return metricdata.DeltaTemporality
	default:
		return metricdata.CumulativeTemporality
	}
}

// AggregationSelector selects the aggregation and the parameters to use for
// that aggregation based on the InstrumentKind.
//
// If the Aggregation returned is nil or DefaultAggregation, the selection from
// DefaultAggregationSelector will be used.
type AggregationSelector func(InstrumentKind) Aggregation

// DefaultAggregationSelector returns the default aggregation and parameters
// that will be used to summarize measurement made from an instrument of
// InstrumentKind. This AggregationSelector using the following selection
// mapping: Counter ⇨ Sum, Observable Counter ⇨ Sum, UpDownCounter ⇨ Sum,
// Observable UpDownCounter ⇨ Sum, Observable Gauge ⇨ LastValue,
// Histogram ⇨ ExplicitBucketHistogram.
func DefaultAggregationSelector(ik InstrumentKind) Aggregation {
	switch ik {
	case InstrumentKindCounter,
		InstrumentKindUpDownCounter,
		InstrumentKindObservableCounter,
		InstrumentKindObservableUpDownCounter:
		return AggregationSum{}
	case InstrumentKindObservableGauge, InstrumentKindGauge:
		return AggregationLastValue{}
	case InstrumentKindHistogram:
		return AggregationExplicitBucketHistogram{
			Boundaries: []float64{0, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000},
			NoMinMax:   false,
		}
	}
	panic("unknown instrument kind")
}

// ReaderOption is an option which can be applied to manual or Periodic
// readers.
type ReaderOption interface {
	PeriodicReaderOption
	ManualReaderOption
}

// WithProducer registers producers as an external Producer of metric data
// for this Reader.
func WithProducer(p Producer) ReaderOption {
	return producerOption{p: p}
}

type producerOption struct {
	p Producer
}

// applyManual returns a manualReaderConfig with option applied.
func (o producerOption) applyManual(c manualReaderConfig) manualReaderConfig {
	c.producers = append(c.producers, o.p)
	return c
}

// applyPeriodic returns a periodicReaderConfig with option applied.
func (o producerOption) applyPeriodic(c periodicReaderConfig) periodicReaderConfig {
	c.producers = append(c.producers, o.p)
	return c
}
