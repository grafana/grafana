// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package metric // import "go.opentelemetry.io/otel/sdk/metric"

import (
	"context"
	"errors"
	"fmt"

	"go.opentelemetry.io/otel/internal/global"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/metric/embedded"
	"go.opentelemetry.io/otel/sdk/instrumentation"
	"go.opentelemetry.io/otel/sdk/metric/internal/aggregate"
)

// ErrInstrumentName indicates the created instrument has an invalid name.
// Valid names must consist of 255 or fewer characters including alphanumeric, _, ., -, / and start with a letter.
var ErrInstrumentName = errors.New("invalid instrument name")

// meter handles the creation and coordination of all metric instruments. A
// meter represents a single instrumentation scope; all metric telemetry
// produced by an instrumentation scope will use metric instruments from a
// single meter.
type meter struct {
	embedded.Meter

	scope instrumentation.Scope
	pipes pipelines

	int64Insts             *cacheWithErr[instID, *int64Inst]
	float64Insts           *cacheWithErr[instID, *float64Inst]
	int64ObservableInsts   *cacheWithErr[instID, int64Observable]
	float64ObservableInsts *cacheWithErr[instID, float64Observable]

	int64Resolver   resolver[int64]
	float64Resolver resolver[float64]
}

func newMeter(s instrumentation.Scope, p pipelines) *meter {
	// viewCache ensures instrument conflicts, including number conflicts, this
	// meter is asked to create are logged to the user.
	var viewCache cache[string, instID]

	var int64Insts cacheWithErr[instID, *int64Inst]
	var float64Insts cacheWithErr[instID, *float64Inst]
	var int64ObservableInsts cacheWithErr[instID, int64Observable]
	var float64ObservableInsts cacheWithErr[instID, float64Observable]

	return &meter{
		scope:                  s,
		pipes:                  p,
		int64Insts:             &int64Insts,
		float64Insts:           &float64Insts,
		int64ObservableInsts:   &int64ObservableInsts,
		float64ObservableInsts: &float64ObservableInsts,
		int64Resolver:          newResolver[int64](p, &viewCache),
		float64Resolver:        newResolver[float64](p, &viewCache),
	}
}

// Compile-time check meter implements metric.Meter.
var _ metric.Meter = (*meter)(nil)

// Int64Counter returns a new instrument identified by name and configured with
// options. The instrument is used to synchronously record increasing int64
// measurements during a computational operation.
func (m *meter) Int64Counter(name string, options ...metric.Int64CounterOption) (metric.Int64Counter, error) {
	cfg := metric.NewInt64CounterConfig(options...)
	const kind = InstrumentKindCounter
	p := int64InstProvider{m}
	i, err := p.lookup(kind, name, cfg.Description(), cfg.Unit())
	if err != nil {
		return i, err
	}

	return i, validateInstrumentName(name)
}

// Int64UpDownCounter returns a new instrument identified by name and
// configured with options. The instrument is used to synchronously record
// int64 measurements during a computational operation.
func (m *meter) Int64UpDownCounter(
	name string,
	options ...metric.Int64UpDownCounterOption,
) (metric.Int64UpDownCounter, error) {
	cfg := metric.NewInt64UpDownCounterConfig(options...)
	const kind = InstrumentKindUpDownCounter
	p := int64InstProvider{m}
	i, err := p.lookup(kind, name, cfg.Description(), cfg.Unit())
	if err != nil {
		return i, err
	}

	return i, validateInstrumentName(name)
}

// Int64Histogram returns a new instrument identified by name and configured
// with options. The instrument is used to synchronously record the
// distribution of int64 measurements during a computational operation.
func (m *meter) Int64Histogram(name string, options ...metric.Int64HistogramOption) (metric.Int64Histogram, error) {
	cfg := metric.NewInt64HistogramConfig(options...)
	p := int64InstProvider{m}
	i, err := p.lookupHistogram(name, cfg)
	if err != nil {
		return i, err
	}

	return i, validateInstrumentName(name)
}

// Int64Gauge returns a new instrument identified by name and configured
// with options. The instrument is used to synchronously record the
// distribution of int64 measurements during a computational operation.
func (m *meter) Int64Gauge(name string, options ...metric.Int64GaugeOption) (metric.Int64Gauge, error) {
	cfg := metric.NewInt64GaugeConfig(options...)
	const kind = InstrumentKindGauge
	p := int64InstProvider{m}
	i, err := p.lookup(kind, name, cfg.Description(), cfg.Unit())
	if err != nil {
		return i, err
	}

	return i, validateInstrumentName(name)
}

// int64ObservableInstrument returns a new observable identified by the Instrument.
// It registers callbacks for each reader's pipeline.
func (m *meter) int64ObservableInstrument(id Instrument, callbacks []metric.Int64Callback) (int64Observable, error) {
	key := instID{
		Name:        id.Name,
		Description: id.Description,
		Unit:        id.Unit,
		Kind:        id.Kind,
	}
	if m.int64ObservableInsts.HasKey(key) && len(callbacks) > 0 {
		warnRepeatedObservableCallbacks(id)
	}
	return m.int64ObservableInsts.Lookup(key, func() (int64Observable, error) {
		inst := newInt64Observable(m, id.Kind, id.Name, id.Description, id.Unit)
		for _, insert := range m.int64Resolver.inserters {
			// Connect the measure functions for instruments in this pipeline with the
			// callbacks for this pipeline.
			in, err := insert.Instrument(id, insert.readerDefaultAggregation(id.Kind))
			if err != nil {
				return inst, err
			}
			// Drop aggregation
			if len(in) == 0 {
				inst.dropAggregation = true
				continue
			}
			inst.appendMeasures(in)

			// Add the measures to the pipeline. It is required to maintain
			// measures per pipeline to avoid calling the measure that
			// is not part of the pipeline.
			insert.pipeline.addInt64Measure(inst.observableID, in)
			for _, cback := range callbacks {
				inst := int64Observer{measures: in}
				fn := cback
				insert.addCallback(func(ctx context.Context) error { return fn(ctx, inst) })
			}
		}
		return inst, validateInstrumentName(id.Name)
	})
}

// Int64ObservableCounter returns a new instrument identified by name and
// configured with options. The instrument is used to asynchronously record
// increasing int64 measurements once per a measurement collection cycle.
// Only the measurements recorded during the collection cycle are exported.
//
// If Int64ObservableCounter is invoked repeatedly with the same Name,
// Description, and Unit, only the first set of callbacks provided are used.
// Use meter.RegisterCallback and Registration.Unregister to manage callbacks
// if instrumentation can be created multiple times with different callbacks.
func (m *meter) Int64ObservableCounter(
	name string,
	options ...metric.Int64ObservableCounterOption,
) (metric.Int64ObservableCounter, error) {
	cfg := metric.NewInt64ObservableCounterConfig(options...)
	id := Instrument{
		Name:        name,
		Description: cfg.Description(),
		Unit:        cfg.Unit(),
		Kind:        InstrumentKindObservableCounter,
		Scope:       m.scope,
	}
	return m.int64ObservableInstrument(id, cfg.Callbacks())
}

// Int64ObservableUpDownCounter returns a new instrument identified by name and
// configured with options. The instrument is used to asynchronously record
// int64 measurements once per a measurement collection cycle. Only the
// measurements recorded during the collection cycle are exported.
//
// If Int64ObservableUpDownCounter is invoked repeatedly with the same Name,
// Description, and Unit, only the first set of callbacks provided are used.
// Use meter.RegisterCallback and Registration.Unregister to manage callbacks
// if instrumentation can be created multiple times with different callbacks.
func (m *meter) Int64ObservableUpDownCounter(
	name string,
	options ...metric.Int64ObservableUpDownCounterOption,
) (metric.Int64ObservableUpDownCounter, error) {
	cfg := metric.NewInt64ObservableUpDownCounterConfig(options...)
	id := Instrument{
		Name:        name,
		Description: cfg.Description(),
		Unit:        cfg.Unit(),
		Kind:        InstrumentKindObservableUpDownCounter,
		Scope:       m.scope,
	}
	return m.int64ObservableInstrument(id, cfg.Callbacks())
}

// Int64ObservableGauge returns a new instrument identified by name and
// configured with options. The instrument is used to asynchronously record
// instantaneous int64 measurements once per a measurement collection cycle.
// Only the measurements recorded during the collection cycle are exported.
//
// If Int64ObservableGauge is invoked repeatedly with the same Name,
// Description, and Unit, only the first set of callbacks provided are used.
// Use meter.RegisterCallback and Registration.Unregister to manage callbacks
// if instrumentation can be created multiple times with different callbacks.
func (m *meter) Int64ObservableGauge(
	name string,
	options ...metric.Int64ObservableGaugeOption,
) (metric.Int64ObservableGauge, error) {
	cfg := metric.NewInt64ObservableGaugeConfig(options...)
	id := Instrument{
		Name:        name,
		Description: cfg.Description(),
		Unit:        cfg.Unit(),
		Kind:        InstrumentKindObservableGauge,
		Scope:       m.scope,
	}
	return m.int64ObservableInstrument(id, cfg.Callbacks())
}

// Float64Counter returns a new instrument identified by name and configured
// with options. The instrument is used to synchronously record increasing
// float64 measurements during a computational operation.
func (m *meter) Float64Counter(name string, options ...metric.Float64CounterOption) (metric.Float64Counter, error) {
	cfg := metric.NewFloat64CounterConfig(options...)
	const kind = InstrumentKindCounter
	p := float64InstProvider{m}
	i, err := p.lookup(kind, name, cfg.Description(), cfg.Unit())
	if err != nil {
		return i, err
	}

	return i, validateInstrumentName(name)
}

// Float64UpDownCounter returns a new instrument identified by name and
// configured with options. The instrument is used to synchronously record
// float64 measurements during a computational operation.
func (m *meter) Float64UpDownCounter(
	name string,
	options ...metric.Float64UpDownCounterOption,
) (metric.Float64UpDownCounter, error) {
	cfg := metric.NewFloat64UpDownCounterConfig(options...)
	const kind = InstrumentKindUpDownCounter
	p := float64InstProvider{m}
	i, err := p.lookup(kind, name, cfg.Description(), cfg.Unit())
	if err != nil {
		return i, err
	}

	return i, validateInstrumentName(name)
}

// Float64Histogram returns a new instrument identified by name and configured
// with options. The instrument is used to synchronously record the
// distribution of float64 measurements during a computational operation.
func (m *meter) Float64Histogram(
	name string,
	options ...metric.Float64HistogramOption,
) (metric.Float64Histogram, error) {
	cfg := metric.NewFloat64HistogramConfig(options...)
	p := float64InstProvider{m}
	i, err := p.lookupHistogram(name, cfg)
	if err != nil {
		return i, err
	}

	return i, validateInstrumentName(name)
}

// Float64Gauge returns a new instrument identified by name and configured
// with options. The instrument is used to synchronously record the
// distribution of float64 measurements during a computational operation.
func (m *meter) Float64Gauge(name string, options ...metric.Float64GaugeOption) (metric.Float64Gauge, error) {
	cfg := metric.NewFloat64GaugeConfig(options...)
	const kind = InstrumentKindGauge
	p := float64InstProvider{m}
	i, err := p.lookup(kind, name, cfg.Description(), cfg.Unit())
	if err != nil {
		return i, err
	}

	return i, validateInstrumentName(name)
}

// float64ObservableInstrument returns a new observable identified by the Instrument.
// It registers callbacks for each reader's pipeline.
func (m *meter) float64ObservableInstrument(
	id Instrument,
	callbacks []metric.Float64Callback,
) (float64Observable, error) {
	key := instID{
		Name:        id.Name,
		Description: id.Description,
		Unit:        id.Unit,
		Kind:        id.Kind,
	}
	if m.int64ObservableInsts.HasKey(key) && len(callbacks) > 0 {
		warnRepeatedObservableCallbacks(id)
	}
	return m.float64ObservableInsts.Lookup(key, func() (float64Observable, error) {
		inst := newFloat64Observable(m, id.Kind, id.Name, id.Description, id.Unit)
		for _, insert := range m.float64Resolver.inserters {
			// Connect the measure functions for instruments in this pipeline with the
			// callbacks for this pipeline.
			in, err := insert.Instrument(id, insert.readerDefaultAggregation(id.Kind))
			if err != nil {
				return inst, err
			}
			// Drop aggregation
			if len(in) == 0 {
				inst.dropAggregation = true
				continue
			}
			inst.appendMeasures(in)

			// Add the measures to the pipeline. It is required to maintain
			// measures per pipeline to avoid calling the measure that
			// is not part of the pipeline.
			insert.pipeline.addFloat64Measure(inst.observableID, in)
			for _, cback := range callbacks {
				inst := float64Observer{measures: in}
				fn := cback
				insert.addCallback(func(ctx context.Context) error { return fn(ctx, inst) })
			}
		}
		return inst, validateInstrumentName(id.Name)
	})
}

// Float64ObservableCounter returns a new instrument identified by name and
// configured with options. The instrument is used to asynchronously record
// increasing float64 measurements once per a measurement collection cycle.
// Only the measurements recorded during the collection cycle are exported.
//
// If Float64ObservableCounter is invoked repeatedly with the same Name,
// Description, and Unit, only the first set of callbacks provided are used.
// Use meter.RegisterCallback and Registration.Unregister to manage callbacks
// if instrumentation can be created multiple times with different callbacks.
func (m *meter) Float64ObservableCounter(
	name string,
	options ...metric.Float64ObservableCounterOption,
) (metric.Float64ObservableCounter, error) {
	cfg := metric.NewFloat64ObservableCounterConfig(options...)
	id := Instrument{
		Name:        name,
		Description: cfg.Description(),
		Unit:        cfg.Unit(),
		Kind:        InstrumentKindObservableCounter,
		Scope:       m.scope,
	}
	return m.float64ObservableInstrument(id, cfg.Callbacks())
}

// Float64ObservableUpDownCounter returns a new instrument identified by name
// and configured with options. The instrument is used to asynchronously record
// float64 measurements once per a measurement collection cycle. Only the
// measurements recorded during the collection cycle are exported.
//
// If Float64ObservableUpDownCounter is invoked repeatedly with the same Name,
// Description, and Unit, only the first set of callbacks provided are used.
// Use meter.RegisterCallback and Registration.Unregister to manage callbacks
// if instrumentation can be created multiple times with different callbacks.
func (m *meter) Float64ObservableUpDownCounter(
	name string,
	options ...metric.Float64ObservableUpDownCounterOption,
) (metric.Float64ObservableUpDownCounter, error) {
	cfg := metric.NewFloat64ObservableUpDownCounterConfig(options...)
	id := Instrument{
		Name:        name,
		Description: cfg.Description(),
		Unit:        cfg.Unit(),
		Kind:        InstrumentKindObservableUpDownCounter,
		Scope:       m.scope,
	}
	return m.float64ObservableInstrument(id, cfg.Callbacks())
}

// Float64ObservableGauge returns a new instrument identified by name and
// configured with options. The instrument is used to asynchronously record
// instantaneous float64 measurements once per a measurement collection cycle.
// Only the measurements recorded during the collection cycle are exported.
//
// If Float64ObservableGauge is invoked repeatedly with the same Name,
// Description, and Unit, only the first set of callbacks provided are used.
// Use meter.RegisterCallback and Registration.Unregister to manage callbacks
// if instrumentation can be created multiple times with different callbacks.
func (m *meter) Float64ObservableGauge(
	name string,
	options ...metric.Float64ObservableGaugeOption,
) (metric.Float64ObservableGauge, error) {
	cfg := metric.NewFloat64ObservableGaugeConfig(options...)
	id := Instrument{
		Name:        name,
		Description: cfg.Description(),
		Unit:        cfg.Unit(),
		Kind:        InstrumentKindObservableGauge,
		Scope:       m.scope,
	}
	return m.float64ObservableInstrument(id, cfg.Callbacks())
}

func validateInstrumentName(name string) error {
	if name == "" {
		return fmt.Errorf("%w: %s: is empty", ErrInstrumentName, name)
	}
	if len(name) > 255 {
		return fmt.Errorf("%w: %s: longer than 255 characters", ErrInstrumentName, name)
	}
	if !isAlpha([]rune(name)[0]) {
		return fmt.Errorf("%w: %s: must start with a letter", ErrInstrumentName, name)
	}
	if len(name) == 1 {
		return nil
	}
	for _, c := range name[1:] {
		if !isAlphanumeric(c) && c != '_' && c != '.' && c != '-' && c != '/' {
			return fmt.Errorf("%w: %s: must only contain [A-Za-z0-9_.-/]", ErrInstrumentName, name)
		}
	}
	return nil
}

func isAlpha(c rune) bool {
	return ('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z')
}

func isAlphanumeric(c rune) bool {
	return isAlpha(c) || ('0' <= c && c <= '9')
}

func warnRepeatedObservableCallbacks(id Instrument) {
	inst := fmt.Sprintf(
		"Instrument{Name: %q, Description: %q, Kind: %q, Unit: %q}",
		id.Name, id.Description, "InstrumentKind"+id.Kind.String(), id.Unit,
	)
	global.Warn(
		"Repeated observable instrument creation with callbacks. Ignoring new callbacks. Use meter.RegisterCallback and Registration.Unregister to manage callbacks.",
		"instrument",
		inst,
	)
}

// RegisterCallback registers f to be called each collection cycle so it will
// make observations for insts during those cycles.
//
// The only instruments f can make observations for are insts. All other
// observations will be dropped and an error will be logged.
//
// Only instruments from this meter can be registered with f, an error is
// returned if other instrument are provided.
//
// Only observations made in the callback will be exported. Unlike synchronous
// instruments, asynchronous callbacks can "forget" attribute sets that are no
// longer relevant by omitting the observation during the callback.
//
// The returned Registration can be used to unregister f.
func (m *meter) RegisterCallback(f metric.Callback, insts ...metric.Observable) (metric.Registration, error) {
	if len(insts) == 0 {
		// Don't allocate a observer if not needed.
		return noopRegister{}, nil
	}

	var err error
	validInstruments := make([]metric.Observable, 0, len(insts))
	for _, inst := range insts {
		switch o := inst.(type) {
		case int64Observable:
			if e := o.registerable(m); e != nil {
				if !errors.Is(e, errEmptyAgg) {
					err = errors.Join(err, e)
				}
				continue
			}

			validInstruments = append(validInstruments, inst)
		case float64Observable:
			if e := o.registerable(m); e != nil {
				if !errors.Is(e, errEmptyAgg) {
					err = errors.Join(err, e)
				}
				continue
			}

			validInstruments = append(validInstruments, inst)
		default:
			// Instrument external to the SDK.
			return nil, errors.New("invalid observable: from different implementation")
		}
	}

	if len(validInstruments) == 0 {
		// All insts use drop aggregation or are invalid.
		return noopRegister{}, err
	}

	unregs := make([]func(), len(m.pipes))
	for ix, pipe := range m.pipes {
		reg := newObserver(pipe)
		for _, inst := range validInstruments {
			switch o := inst.(type) {
			case int64Observable:
				reg.registerInt64(o.observableID)
			case float64Observable:
				reg.registerFloat64(o.observableID)
			}
		}

		// Some or all instruments were valid.
		cBack := func(ctx context.Context) error { return f(ctx, reg) }
		unregs[ix] = pipe.addMultiCallback(cBack)
	}

	return unregisterFuncs{f: unregs}, err
}

type observer struct {
	embedded.Observer

	pipe    *pipeline
	float64 map[observableID[float64]]struct{}
	int64   map[observableID[int64]]struct{}
}

func newObserver(p *pipeline) observer {
	return observer{
		pipe:    p,
		float64: make(map[observableID[float64]]struct{}),
		int64:   make(map[observableID[int64]]struct{}),
	}
}

func (r observer) registerFloat64(id observableID[float64]) {
	r.float64[id] = struct{}{}
}

func (r observer) registerInt64(id observableID[int64]) {
	r.int64[id] = struct{}{}
}

var (
	errUnknownObserver = errors.New("unknown observable instrument")
	errUnregObserver   = errors.New("observable instrument not registered for callback")
)

func (r observer) ObserveFloat64(o metric.Float64Observable, v float64, opts ...metric.ObserveOption) {
	var oImpl float64Observable
	switch conv := o.(type) {
	case float64Observable:
		oImpl = conv
	default:
		global.Error(errUnknownObserver, "failed to record")
		return
	}

	if _, registered := r.float64[oImpl.observableID]; !registered {
		if !oImpl.dropAggregation {
			global.Error(errUnregObserver, "failed to record",
				"name", oImpl.name,
				"description", oImpl.description,
				"unit", oImpl.unit,
				"number", fmt.Sprintf("%T", float64(0)),
			)
		}
		return
	}
	c := metric.NewObserveConfig(opts)
	// Access to r.pipe.float64Measure is already guarded by a lock in pipeline.produce.
	// TODO (#5946): Refactor pipeline and observable measures.
	measures := r.pipe.float64Measures[oImpl.observableID]
	for _, m := range measures {
		m(context.Background(), v, c.Attributes())
	}
}

func (r observer) ObserveInt64(o metric.Int64Observable, v int64, opts ...metric.ObserveOption) {
	var oImpl int64Observable
	switch conv := o.(type) {
	case int64Observable:
		oImpl = conv
	default:
		global.Error(errUnknownObserver, "failed to record")
		return
	}

	if _, registered := r.int64[oImpl.observableID]; !registered {
		if !oImpl.dropAggregation {
			global.Error(errUnregObserver, "failed to record",
				"name", oImpl.name,
				"description", oImpl.description,
				"unit", oImpl.unit,
				"number", fmt.Sprintf("%T", int64(0)),
			)
		}
		return
	}
	c := metric.NewObserveConfig(opts)
	// Access to r.pipe.int64Measures is already guarded b a lock in pipeline.produce.
	// TODO (#5946): Refactor pipeline and observable measures.
	measures := r.pipe.int64Measures[oImpl.observableID]
	for _, m := range measures {
		m(context.Background(), v, c.Attributes())
	}
}

type noopRegister struct{ embedded.Registration }

func (noopRegister) Unregister() error {
	return nil
}

// int64InstProvider provides int64 OpenTelemetry instruments.
type int64InstProvider struct{ *meter }

func (p int64InstProvider) aggs(kind InstrumentKind, name, desc, u string) ([]aggregate.Measure[int64], error) {
	inst := Instrument{
		Name:        name,
		Description: desc,
		Unit:        u,
		Kind:        kind,
		Scope:       p.scope,
	}
	return p.int64Resolver.Aggregators(inst)
}

func (p int64InstProvider) histogramAggs(
	name string,
	cfg metric.Int64HistogramConfig,
) ([]aggregate.Measure[int64], error) {
	boundaries := cfg.ExplicitBucketBoundaries()
	aggError := AggregationExplicitBucketHistogram{Boundaries: boundaries}.err()
	if aggError != nil {
		// If boundaries are invalid, ignore them.
		boundaries = nil
	}
	inst := Instrument{
		Name:        name,
		Description: cfg.Description(),
		Unit:        cfg.Unit(),
		Kind:        InstrumentKindHistogram,
		Scope:       p.scope,
	}
	measures, err := p.int64Resolver.HistogramAggregators(inst, boundaries)
	return measures, errors.Join(aggError, err)
}

// lookup returns the resolved instrumentImpl.
func (p int64InstProvider) lookup(kind InstrumentKind, name, desc, u string) (*int64Inst, error) {
	return p.int64Insts.Lookup(instID{
		Name:        name,
		Description: desc,
		Unit:        u,
		Kind:        kind,
	}, func() (*int64Inst, error) {
		aggs, err := p.aggs(kind, name, desc, u)
		return &int64Inst{measures: aggs}, err
	})
}

// lookupHistogram returns the resolved instrumentImpl.
func (p int64InstProvider) lookupHistogram(name string, cfg metric.Int64HistogramConfig) (*int64Inst, error) {
	return p.int64Insts.Lookup(instID{
		Name:        name,
		Description: cfg.Description(),
		Unit:        cfg.Unit(),
		Kind:        InstrumentKindHistogram,
	}, func() (*int64Inst, error) {
		aggs, err := p.histogramAggs(name, cfg)
		return &int64Inst{measures: aggs}, err
	})
}

// float64InstProvider provides float64 OpenTelemetry instruments.
type float64InstProvider struct{ *meter }

func (p float64InstProvider) aggs(kind InstrumentKind, name, desc, u string) ([]aggregate.Measure[float64], error) {
	inst := Instrument{
		Name:        name,
		Description: desc,
		Unit:        u,
		Kind:        kind,
		Scope:       p.scope,
	}
	return p.float64Resolver.Aggregators(inst)
}

func (p float64InstProvider) histogramAggs(
	name string,
	cfg metric.Float64HistogramConfig,
) ([]aggregate.Measure[float64], error) {
	boundaries := cfg.ExplicitBucketBoundaries()
	aggError := AggregationExplicitBucketHistogram{Boundaries: boundaries}.err()
	if aggError != nil {
		// If boundaries are invalid, ignore them.
		boundaries = nil
	}
	inst := Instrument{
		Name:        name,
		Description: cfg.Description(),
		Unit:        cfg.Unit(),
		Kind:        InstrumentKindHistogram,
		Scope:       p.scope,
	}
	measures, err := p.float64Resolver.HistogramAggregators(inst, boundaries)
	return measures, errors.Join(aggError, err)
}

// lookup returns the resolved instrumentImpl.
func (p float64InstProvider) lookup(kind InstrumentKind, name, desc, u string) (*float64Inst, error) {
	return p.float64Insts.Lookup(instID{
		Name:        name,
		Description: desc,
		Unit:        u,
		Kind:        kind,
	}, func() (*float64Inst, error) {
		aggs, err := p.aggs(kind, name, desc, u)
		return &float64Inst{measures: aggs}, err
	})
}

// lookupHistogram returns the resolved instrumentImpl.
func (p float64InstProvider) lookupHistogram(name string, cfg metric.Float64HistogramConfig) (*float64Inst, error) {
	return p.float64Insts.Lookup(instID{
		Name:        name,
		Description: cfg.Description(),
		Unit:        cfg.Unit(),
		Kind:        InstrumentKindHistogram,
	}, func() (*float64Inst, error) {
		aggs, err := p.histogramAggs(name, cfg)
		return &float64Inst{measures: aggs}, err
	})
}

type int64Observer struct {
	embedded.Int64Observer
	measures[int64]
}

func (o int64Observer) Observe(val int64, opts ...metric.ObserveOption) {
	c := metric.NewObserveConfig(opts)
	o.observe(val, c.Attributes())
}

type float64Observer struct {
	embedded.Float64Observer
	measures[float64]
}

func (o float64Observer) Observe(val float64, opts ...metric.ObserveOption) {
	c := metric.NewObserveConfig(opts)
	o.observe(val, c.Attributes())
}
