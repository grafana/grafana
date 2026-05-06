// Package metrics defines the metrics APIs used by Smithy clients.
package metrics

import (
	"context"

	"github.com/aws/smithy-go"
)

// MeterProvider is the entry point for creating a Meter.
type MeterProvider interface {
	Meter(scope string, opts ...MeterOption) Meter
}

// MeterOption applies configuration to a Meter.
type MeterOption func(o *MeterOptions)

// MeterOptions represents configuration for a Meter.
type MeterOptions struct {
	Properties smithy.Properties
}

// Meter is the entry point for creation of measurement instruments.
type Meter interface {
	// integer/synchronous
	Int64Counter(name string, opts ...InstrumentOption) (Int64Counter, error)
	Int64UpDownCounter(name string, opts ...InstrumentOption) (Int64UpDownCounter, error)
	Int64Gauge(name string, opts ...InstrumentOption) (Int64Gauge, error)
	Int64Histogram(name string, opts ...InstrumentOption) (Int64Histogram, error)

	// integer/asynchronous
	Int64AsyncCounter(name string, callback Int64Callback, opts ...InstrumentOption) (AsyncInstrument, error)
	Int64AsyncUpDownCounter(name string, callback Int64Callback, opts ...InstrumentOption) (AsyncInstrument, error)
	Int64AsyncGauge(name string, callback Int64Callback, opts ...InstrumentOption) (AsyncInstrument, error)

	// floating-point/synchronous
	Float64Counter(name string, opts ...InstrumentOption) (Float64Counter, error)
	Float64UpDownCounter(name string, opts ...InstrumentOption) (Float64UpDownCounter, error)
	Float64Gauge(name string, opts ...InstrumentOption) (Float64Gauge, error)
	Float64Histogram(name string, opts ...InstrumentOption) (Float64Histogram, error)

	// floating-point/asynchronous
	Float64AsyncCounter(name string, callback Float64Callback, opts ...InstrumentOption) (AsyncInstrument, error)
	Float64AsyncUpDownCounter(name string, callback Float64Callback, opts ...InstrumentOption) (AsyncInstrument, error)
	Float64AsyncGauge(name string, callback Float64Callback, opts ...InstrumentOption) (AsyncInstrument, error)
}

// InstrumentOption applies configuration to an instrument.
type InstrumentOption func(o *InstrumentOptions)

// InstrumentOptions represents configuration for an instrument.
type InstrumentOptions struct {
	UnitLabel   string
	Description string
}

// Int64Counter measures a monotonically increasing int64 value.
type Int64Counter interface {
	Add(context.Context, int64, ...RecordMetricOption)
}

// Int64UpDownCounter measures a fluctuating int64 value.
type Int64UpDownCounter interface {
	Add(context.Context, int64, ...RecordMetricOption)
}

// Int64Gauge samples a discrete int64 value.
type Int64Gauge interface {
	Sample(context.Context, int64, ...RecordMetricOption)
}

// Int64Histogram records multiple data points for an int64 value.
type Int64Histogram interface {
	Record(context.Context, int64, ...RecordMetricOption)
}

// Float64Counter measures a monotonically increasing float64 value.
type Float64Counter interface {
	Add(context.Context, float64, ...RecordMetricOption)
}

// Float64UpDownCounter measures a fluctuating float64 value.
type Float64UpDownCounter interface {
	Add(context.Context, float64, ...RecordMetricOption)
}

// Float64Gauge samples a discrete float64 value.
type Float64Gauge interface {
	Sample(context.Context, float64, ...RecordMetricOption)
}

// Float64Histogram records multiple data points for an float64 value.
type Float64Histogram interface {
	Record(context.Context, float64, ...RecordMetricOption)
}

// AsyncInstrument is the universal handle returned for creation of all async
// instruments.
//
// Callers use the Stop() API to unregister the callback passed at instrument
// creation.
type AsyncInstrument interface {
	Stop()
}

// Int64Callback describes a function invoked when an async int64 instrument is
// read.
type Int64Callback func(context.Context, Int64Observer)

// Int64Observer is the interface passed to async int64 instruments.
//
// Callers use the Observe() API of this interface to report metrics to the
// underlying collector.
type Int64Observer interface {
	Observe(context.Context, int64, ...RecordMetricOption)
}

// Float64Callback describes a function invoked when an async float64
// instrument is read.
type Float64Callback func(context.Context, Float64Observer)

// Float64Observer is the interface passed to async int64 instruments.
//
// Callers use the Observe() API of this interface to report metrics to the
// underlying collector.
type Float64Observer interface {
	Observe(context.Context, float64, ...RecordMetricOption)
}

// RecordMetricOption applies configuration to a recorded metric.
type RecordMetricOption func(o *RecordMetricOptions)

// RecordMetricOptions represents configuration for a recorded metric.
type RecordMetricOptions struct {
	Properties smithy.Properties
}
