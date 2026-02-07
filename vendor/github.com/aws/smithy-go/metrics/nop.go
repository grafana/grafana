package metrics

import "context"

// NopMeterProvider is a no-op metrics implementation.
type NopMeterProvider struct{}

var _ MeterProvider = (*NopMeterProvider)(nil)

// Meter returns a meter which creates no-op instruments.
func (NopMeterProvider) Meter(string, ...MeterOption) Meter {
	return NopMeter{}
}

// NopMeter creates no-op instruments.
type NopMeter struct{}

var _ Meter = (*NopMeter)(nil)

// Int64Counter creates a no-op instrument.
func (NopMeter) Int64Counter(string, ...InstrumentOption) (Int64Counter, error) {
	return nopInstrumentInt64, nil
}

// Int64UpDownCounter creates a no-op instrument.
func (NopMeter) Int64UpDownCounter(string, ...InstrumentOption) (Int64UpDownCounter, error) {
	return nopInstrumentInt64, nil
}

// Int64Gauge creates a no-op instrument.
func (NopMeter) Int64Gauge(string, ...InstrumentOption) (Int64Gauge, error) {
	return nopInstrumentInt64, nil
}

// Int64Histogram creates a no-op instrument.
func (NopMeter) Int64Histogram(string, ...InstrumentOption) (Int64Histogram, error) {
	return nopInstrumentInt64, nil
}

// Int64AsyncCounter creates a no-op instrument.
func (NopMeter) Int64AsyncCounter(string, Int64Callback, ...InstrumentOption) (AsyncInstrument, error) {
	return nopInstrumentInt64, nil
}

// Int64AsyncUpDownCounter creates a no-op instrument.
func (NopMeter) Int64AsyncUpDownCounter(string, Int64Callback, ...InstrumentOption) (AsyncInstrument, error) {
	return nopInstrumentInt64, nil
}

// Int64AsyncGauge creates a no-op instrument.
func (NopMeter) Int64AsyncGauge(string, Int64Callback, ...InstrumentOption) (AsyncInstrument, error) {
	return nopInstrumentInt64, nil
}

// Float64Counter creates a no-op instrument.
func (NopMeter) Float64Counter(string, ...InstrumentOption) (Float64Counter, error) {
	return nopInstrumentFloat64, nil
}

// Float64UpDownCounter creates a no-op instrument.
func (NopMeter) Float64UpDownCounter(string, ...InstrumentOption) (Float64UpDownCounter, error) {
	return nopInstrumentFloat64, nil
}

// Float64Gauge creates a no-op instrument.
func (NopMeter) Float64Gauge(string, ...InstrumentOption) (Float64Gauge, error) {
	return nopInstrumentFloat64, nil
}

// Float64Histogram creates a no-op instrument.
func (NopMeter) Float64Histogram(string, ...InstrumentOption) (Float64Histogram, error) {
	return nopInstrumentFloat64, nil
}

// Float64AsyncCounter creates a no-op instrument.
func (NopMeter) Float64AsyncCounter(string, Float64Callback, ...InstrumentOption) (AsyncInstrument, error) {
	return nopInstrumentFloat64, nil
}

// Float64AsyncUpDownCounter creates a no-op instrument.
func (NopMeter) Float64AsyncUpDownCounter(string, Float64Callback, ...InstrumentOption) (AsyncInstrument, error) {
	return nopInstrumentFloat64, nil
}

// Float64AsyncGauge creates a no-op instrument.
func (NopMeter) Float64AsyncGauge(string, Float64Callback, ...InstrumentOption) (AsyncInstrument, error) {
	return nopInstrumentFloat64, nil
}

type nopInstrument[N any] struct{}

func (nopInstrument[N]) Add(context.Context, N, ...RecordMetricOption)    {}
func (nopInstrument[N]) Sample(context.Context, N, ...RecordMetricOption) {}
func (nopInstrument[N]) Record(context.Context, N, ...RecordMetricOption) {}
func (nopInstrument[_]) Stop()                                            {}

var nopInstrumentInt64 = nopInstrument[int64]{}
var nopInstrumentFloat64 = nopInstrument[float64]{}
