// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package metric // import "go.opentelemetry.io/otel/sdk/metric"

import (
	"container/list"
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"

	"go.opentelemetry.io/otel/internal/global"
	"go.opentelemetry.io/otel/metric/embedded"
	"go.opentelemetry.io/otel/sdk/instrumentation"
	"go.opentelemetry.io/otel/sdk/metric/exemplar"
	"go.opentelemetry.io/otel/sdk/metric/internal"
	"go.opentelemetry.io/otel/sdk/metric/internal/aggregate"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	"go.opentelemetry.io/otel/sdk/resource"
)

var (
	errCreatingAggregators     = errors.New("could not create all aggregators")
	errIncompatibleAggregation = errors.New("incompatible aggregation")
	errUnknownAggregation      = errors.New("unrecognized aggregation")
)

// instrumentSync is a synchronization point between a pipeline and an
// instrument's aggregate function.
type instrumentSync struct {
	name        string
	description string
	unit        string
	compAgg     aggregate.ComputeAggregation
}

func newPipeline(
	res *resource.Resource,
	reader Reader,
	views []View,
	exemplarFilter exemplar.Filter,
	cardinalityLimit int,
) *pipeline {
	if res == nil {
		res = resource.Empty()
	}
	return &pipeline{
		resource:         res,
		reader:           reader,
		views:            views,
		int64Measures:    map[observableID[int64]][]aggregate.Measure[int64]{},
		float64Measures:  map[observableID[float64]][]aggregate.Measure[float64]{},
		exemplarFilter:   exemplarFilter,
		cardinalityLimit: cardinalityLimit,
		// aggregations is lazy allocated when needed.
	}
}

// pipeline connects all of the instruments created by a meter provider to a Reader.
// This is the object that will be `Reader.register()` when a meter provider is created.
//
// As instruments are created the instrument should be checked if it exists in
// the views of a the Reader, and if so each aggregate function should be added
// to the pipeline.
type pipeline struct {
	resource *resource.Resource

	reader Reader
	views  []View

	sync.Mutex
	int64Measures    map[observableID[int64]][]aggregate.Measure[int64]
	float64Measures  map[observableID[float64]][]aggregate.Measure[float64]
	aggregations     map[instrumentation.Scope][]instrumentSync
	callbacks        []func(context.Context) error
	multiCallbacks   list.List
	exemplarFilter   exemplar.Filter
	cardinalityLimit int
}

// addInt64Measure adds a new int64 measure to the pipeline for each observer.
func (p *pipeline) addInt64Measure(id observableID[int64], m []aggregate.Measure[int64]) {
	p.Lock()
	defer p.Unlock()
	p.int64Measures[id] = m
}

// addFloat64Measure adds a new float64 measure to the pipeline for each observer.
func (p *pipeline) addFloat64Measure(id observableID[float64], m []aggregate.Measure[float64]) {
	p.Lock()
	defer p.Unlock()
	p.float64Measures[id] = m
}

// addSync adds the instrumentSync to pipeline p with scope. This method is not
// idempotent. Duplicate calls will result in duplicate additions, it is the
// callers responsibility to ensure this is called with unique values.
func (p *pipeline) addSync(scope instrumentation.Scope, iSync instrumentSync) {
	p.Lock()
	defer p.Unlock()
	if p.aggregations == nil {
		p.aggregations = map[instrumentation.Scope][]instrumentSync{
			scope: {iSync},
		}
		return
	}
	p.aggregations[scope] = append(p.aggregations[scope], iSync)
}

type multiCallback func(context.Context) error

// addMultiCallback registers a multi-instrument callback to be run when
// `produce()` is called.
func (p *pipeline) addMultiCallback(c multiCallback) (unregister func()) {
	p.Lock()
	defer p.Unlock()
	e := p.multiCallbacks.PushBack(c)
	return func() {
		p.Lock()
		p.multiCallbacks.Remove(e)
		p.Unlock()
	}
}

// produce returns aggregated metrics from a single collection.
//
// This method is safe to call concurrently.
func (p *pipeline) produce(ctx context.Context, rm *metricdata.ResourceMetrics) error {
	// Only check if context is already cancelled before starting, not inside or after callback loops.
	// If this method returns after executing some callbacks but before running all aggregations,
	// internal aggregation state can be corrupted and result in incorrect data returned
	// by future produce calls.
	if err := ctx.Err(); err != nil {
		return err
	}

	p.Lock()
	defer p.Unlock()

	var err error
	for _, c := range p.callbacks {
		// TODO make the callbacks parallel. ( #3034 )
		if e := c(ctx); e != nil {
			err = errors.Join(err, e)
		}
	}
	for e := p.multiCallbacks.Front(); e != nil; e = e.Next() {
		// TODO make the callbacks parallel. ( #3034 )
		f := e.Value.(multiCallback)
		if e := f(ctx); e != nil {
			err = errors.Join(err, e)
		}
	}

	rm.Resource = p.resource
	rm.ScopeMetrics = internal.ReuseSlice(rm.ScopeMetrics, len(p.aggregations))

	i := 0
	for scope, instruments := range p.aggregations {
		rm.ScopeMetrics[i].Metrics = internal.ReuseSlice(rm.ScopeMetrics[i].Metrics, len(instruments))
		j := 0
		for _, inst := range instruments {
			data := rm.ScopeMetrics[i].Metrics[j].Data
			if n := inst.compAgg(&data); n > 0 {
				rm.ScopeMetrics[i].Metrics[j].Name = inst.name
				rm.ScopeMetrics[i].Metrics[j].Description = inst.description
				rm.ScopeMetrics[i].Metrics[j].Unit = inst.unit
				rm.ScopeMetrics[i].Metrics[j].Data = data
				j++
			}
		}
		rm.ScopeMetrics[i].Metrics = rm.ScopeMetrics[i].Metrics[:j]
		if len(rm.ScopeMetrics[i].Metrics) > 0 {
			rm.ScopeMetrics[i].Scope = scope
			i++
		}
	}

	rm.ScopeMetrics = rm.ScopeMetrics[:i]

	return err
}

// inserter facilitates inserting of new instruments from a single scope into a
// pipeline.
type inserter[N int64 | float64] struct {
	// aggregators is a cache that holds aggregate function inputs whose
	// outputs have been inserted into the underlying reader pipeline. This
	// cache ensures no duplicate aggregate functions are inserted into the
	// reader pipeline and if a new request during an instrument creation asks
	// for the same aggregate function input the same instance is returned.
	aggregators *cache[instID, aggVal[N]]

	// views is a cache that holds instrument identifiers for all the
	// instruments a Meter has created, it is provided from the Meter that owns
	// this inserter. This cache ensures during the creation of instruments
	// with the same name but different options (e.g. description, unit) a
	// warning message is logged.
	views *cache[string, instID]

	pipeline *pipeline
}

func newInserter[N int64 | float64](p *pipeline, vc *cache[string, instID]) *inserter[N] {
	if vc == nil {
		vc = &cache[string, instID]{}
	}
	return &inserter[N]{
		aggregators: &cache[instID, aggVal[N]]{},
		views:       vc,
		pipeline:    p,
	}
}

// Instrument inserts the instrument inst with instUnit into a pipeline. All
// views the pipeline contains are matched against, and any matching view that
// creates a unique aggregate function will have its output inserted into the
// pipeline and its input included in the returned slice.
//
// The returned aggregate function inputs are ensured to be deduplicated and
// unique. If another view in another pipeline that is cached by this
// inserter's cache has already inserted the same aggregate function for the
// same instrument, that functions input instance is returned.
//
// If another instrument has already been inserted by this inserter, or any
// other using the same cache, and it conflicts with the instrument being
// inserted in this call, an aggregate function input matching the arguments
// will still be returned but an Info level log message will also be logged to
// the OTel global logger.
//
// If the passed instrument would result in an incompatible aggregate function,
// an error is returned and that aggregate function output is not inserted nor
// is its input returned.
//
// If an instrument is determined to use a Drop aggregation, that instrument is
// not inserted nor returned.
func (i *inserter[N]) Instrument(inst Instrument, readerAggregation Aggregation) ([]aggregate.Measure[N], error) {
	var (
		matched  bool
		measures []aggregate.Measure[N]
	)

	var err error
	seen := make(map[uint64]struct{})
	for _, v := range i.pipeline.views {
		stream, match := v(inst)
		if !match {
			continue
		}
		matched = true
		in, id, e := i.cachedAggregator(inst.Scope, inst.Kind, stream, readerAggregation)
		if e != nil {
			err = errors.Join(err, e)
		}
		if in == nil { // Drop aggregation.
			continue
		}
		if _, ok := seen[id]; ok {
			// This aggregate function has already been added.
			continue
		}
		seen[id] = struct{}{}
		measures = append(measures, in)
	}

	if err != nil {
		err = errors.Join(errCreatingAggregators, err)
	}

	if matched {
		return measures, err
	}

	// Apply implicit default view if no explicit matched.
	stream := Stream{
		Name:        inst.Name,
		Description: inst.Description,
		Unit:        inst.Unit,
	}
	in, _, e := i.cachedAggregator(inst.Scope, inst.Kind, stream, readerAggregation)
	if e != nil {
		if err == nil {
			err = errCreatingAggregators
		}
		err = errors.Join(err, e)
	}
	if in != nil {
		// Ensured to have not seen given matched was false.
		measures = append(measures, in)
	}
	return measures, err
}

// addCallback registers a single instrument callback to be run when
// `produce()` is called.
func (i *inserter[N]) addCallback(cback func(context.Context) error) {
	i.pipeline.Lock()
	defer i.pipeline.Unlock()
	i.pipeline.callbacks = append(i.pipeline.callbacks, cback)
}

var aggIDCount uint64

// aggVal is the cached value in an aggregators cache.
type aggVal[N int64 | float64] struct {
	ID      uint64
	Measure aggregate.Measure[N]
	Err     error
}

// readerDefaultAggregation returns the default aggregation for the instrument
// kind based on the reader's aggregation preferences. This is used unless the
// aggregation is overridden with a view.
func (i *inserter[N]) readerDefaultAggregation(kind InstrumentKind) Aggregation {
	aggregation := i.pipeline.reader.aggregation(kind)
	switch aggregation.(type) {
	case nil, AggregationDefault:
		// If the reader returns default or nil use the default selector.
		aggregation = DefaultAggregationSelector(kind)
	default:
		// Deep copy and validate before using.
		aggregation = aggregation.copy()
		if err := aggregation.err(); err != nil {
			orig := aggregation
			aggregation = DefaultAggregationSelector(kind)
			global.Error(
				err, "using default aggregation instead",
				"aggregation", orig,
				"replacement", aggregation,
			)
		}
	}
	return aggregation
}

// cachedAggregator returns the appropriate aggregate input and output
// functions for an instrument configuration. If the exact instrument has been
// created within the inst.Scope, those aggregate function instances will be
// returned. Otherwise, new computed aggregate functions will be cached and
// returned.
//
// If the instrument configuration conflicts with an instrument that has
// already been created (e.g. description, unit, data type) a warning will be
// logged at the "Info" level with the global OTel logger. Valid new aggregate
// functions for the instrument configuration will still be returned without an
// error.
//
// If the instrument defines an unknown or incompatible aggregation, an error
// is returned.
func (i *inserter[N]) cachedAggregator(
	scope instrumentation.Scope,
	kind InstrumentKind,
	stream Stream,
	readerAggregation Aggregation,
) (meas aggregate.Measure[N], aggID uint64, err error) {
	switch stream.Aggregation.(type) {
	case nil:
		// The aggregation was not overridden with a view. Use the aggregation
		// provided by the reader.
		stream.Aggregation = readerAggregation
	case AggregationDefault:
		// The view explicitly requested the default aggregation.
		stream.Aggregation = DefaultAggregationSelector(kind)
	}
	if stream.ExemplarReservoirProviderSelector == nil {
		stream.ExemplarReservoirProviderSelector = DefaultExemplarReservoirProviderSelector
	}

	if err := isAggregatorCompatible(kind, stream.Aggregation); err != nil {
		return nil, 0, fmt.Errorf(
			"creating aggregator with instrumentKind: %d, aggregation %v: %w",
			kind, stream.Aggregation, err,
		)
	}

	id := i.instID(kind, stream)
	// If there is a conflict, the specification says the view should
	// still be applied and a warning should be logged.
	i.logConflict(id)

	// If there are requests for the same instrument with different name
	// casing, the first-seen needs to be returned. Use a normalize ID for the
	// cache lookup to ensure the correct comparison.
	normID := id.normalize()
	cv := i.aggregators.Lookup(normID, func() aggVal[N] {
		b := aggregate.Builder[N]{
			Temporality: i.pipeline.reader.temporality(kind),
			ReservoirFunc: reservoirFunc[N](
				stream.ExemplarReservoirProviderSelector(stream.Aggregation),
				i.pipeline.exemplarFilter,
			),
		}
		b.Filter = stream.AttributeFilter
		// A value less than or equal to zero will disable the aggregation
		// limits for the builder (an all the created aggregates).
		// cardinalityLimit will be 0 by default if unset (or
		// unrecognized input). Use that value directly.
		b.AggregationLimit = i.pipeline.cardinalityLimit
		in, out, err := i.aggregateFunc(b, stream.Aggregation, kind)
		if err != nil {
			return aggVal[N]{0, nil, err}
		}
		if in == nil { // Drop aggregator.
			return aggVal[N]{0, nil, nil}
		}
		i.pipeline.addSync(scope, instrumentSync{
			// Use the first-seen name casing for this and all subsequent
			// requests of this instrument.
			name:        stream.Name,
			description: stream.Description,
			unit:        stream.Unit,
			compAgg:     out,
		})
		id := atomic.AddUint64(&aggIDCount, 1)
		return aggVal[N]{id, in, err}
	})
	return cv.Measure, cv.ID, cv.Err
}

// logConflict validates if an instrument with the same case-insensitive name
// as id has already been created. If that instrument conflicts with id, a
// warning is logged.
func (i *inserter[N]) logConflict(id instID) {
	// The API specification defines names as case-insensitive. If there is a
	// different casing of a name it needs to be a conflict.
	name := id.normalize().Name
	existing := i.views.Lookup(name, func() instID { return id })
	if id == existing {
		return
	}

	const msg = "duplicate metric stream definitions"
	args := []any{
		"names", fmt.Sprintf("%q, %q", existing.Name, id.Name),
		"descriptions", fmt.Sprintf("%q, %q", existing.Description, id.Description),
		"kinds", fmt.Sprintf("%s, %s", existing.Kind, id.Kind),
		"units", fmt.Sprintf("%s, %s", existing.Unit, id.Unit),
		"numbers", fmt.Sprintf("%s, %s", existing.Number, id.Number),
	}

	// The specification recommends logging a suggested view to resolve
	// conflicts if possible.
	//
	// https://github.com/open-telemetry/opentelemetry-specification/blob/v1.21.0/specification/metrics/sdk.md#duplicate-instrument-registration
	if id.Unit != existing.Unit || id.Number != existing.Number {
		// There is no view resolution for these, don't make a suggestion.
		global.Warn(msg, args...)
		return
	}

	var stream string
	if id.Name != existing.Name || id.Kind != existing.Kind {
		stream = `Stream{Name: "{{NEW_NAME}}"}`
	} else if id.Description != existing.Description {
		stream = fmt.Sprintf("Stream{Description: %q}", existing.Description)
	}

	inst := fmt.Sprintf(
		"Instrument{Name: %q, Description: %q, Kind: %q, Unit: %q}",
		id.Name, id.Description, "InstrumentKind"+id.Kind.String(), id.Unit,
	)
	args = append(args, "suggested.view", fmt.Sprintf("NewView(%s, %s)", inst, stream))

	global.Warn(msg, args...)
}

func (*inserter[N]) instID(kind InstrumentKind, stream Stream) instID {
	var zero N
	return instID{
		Name:        stream.Name,
		Description: stream.Description,
		Unit:        stream.Unit,
		Kind:        kind,
		Number:      fmt.Sprintf("%T", zero),
	}
}

// aggregateFunc returns new aggregate functions matching agg, kind, and
// monotonic. If the agg is unknown or temporality is invalid, an error is
// returned.
func (i *inserter[N]) aggregateFunc(
	b aggregate.Builder[N],
	agg Aggregation,
	kind InstrumentKind,
) (meas aggregate.Measure[N], comp aggregate.ComputeAggregation, err error) {
	switch a := agg.(type) {
	case AggregationDefault:
		return i.aggregateFunc(b, DefaultAggregationSelector(kind), kind)
	case AggregationDrop:
		// Return nil in and out to signify the drop aggregator.
	case AggregationLastValue:
		switch kind {
		case InstrumentKindGauge:
			meas, comp = b.LastValue()
		case InstrumentKindObservableGauge:
			meas, comp = b.PrecomputedLastValue()
		}
	case AggregationSum:
		switch kind {
		case InstrumentKindObservableCounter:
			meas, comp = b.PrecomputedSum(true)
		case InstrumentKindObservableUpDownCounter:
			meas, comp = b.PrecomputedSum(false)
		case InstrumentKindCounter, InstrumentKindHistogram:
			meas, comp = b.Sum(true)
		default:
			// InstrumentKindUpDownCounter, InstrumentKindObservableGauge, and
			// instrumentKindUndefined or other invalid instrument kinds.
			meas, comp = b.Sum(false)
		}
	case AggregationExplicitBucketHistogram:
		var noSum bool
		switch kind {
		case InstrumentKindUpDownCounter, InstrumentKindObservableUpDownCounter, InstrumentKindObservableGauge, InstrumentKindGauge:
			// The sum should not be collected for any instrument that can make
			// negative measurements:
			// https://github.com/open-telemetry/opentelemetry-specification/blob/v1.21.0/specification/metrics/sdk.md#histogram-aggregations
			noSum = true
		}
		meas, comp = b.ExplicitBucketHistogram(a.Boundaries, a.NoMinMax, noSum)
	case AggregationBase2ExponentialHistogram:
		var noSum bool
		switch kind {
		case InstrumentKindUpDownCounter, InstrumentKindObservableUpDownCounter, InstrumentKindObservableGauge, InstrumentKindGauge:
			// The sum should not be collected for any instrument that can make
			// negative measurements:
			// https://github.com/open-telemetry/opentelemetry-specification/blob/v1.21.0/specification/metrics/sdk.md#histogram-aggregations
			noSum = true
		}
		meas, comp = b.ExponentialBucketHistogram(a.MaxSize, a.MaxScale, a.NoMinMax, noSum)

	default:
		err = errUnknownAggregation
	}

	return meas, comp, err
}

// isAggregatorCompatible checks if the aggregation can be used by the instrument.
// Current compatibility:
//
// | Instrument Kind          | Drop | LastValue | Sum | Histogram | Exponential Histogram |
// |--------------------------|------|-----------|-----|-----------|-----------------------|
// | Counter                  | ✓    |           | ✓   | ✓         | ✓                     |
// | UpDownCounter            | ✓    |           | ✓   | ✓         | ✓                     |
// | Histogram                | ✓    |           | ✓   | ✓         | ✓                     |
// | Gauge                    | ✓    | ✓         |     | ✓         | ✓                     |
// | Observable Counter       | ✓    |           | ✓   | ✓         | ✓                     |
// | Observable UpDownCounter | ✓    |           | ✓   | ✓         | ✓                     |
// | Observable Gauge         | ✓    | ✓         |     | ✓         | ✓                     |.
func isAggregatorCompatible(kind InstrumentKind, agg Aggregation) error {
	switch agg.(type) {
	case AggregationDefault:
		return nil
	case AggregationExplicitBucketHistogram, AggregationBase2ExponentialHistogram:
		switch kind {
		case InstrumentKindCounter,
			InstrumentKindUpDownCounter,
			InstrumentKindHistogram,
			InstrumentKindGauge,
			InstrumentKindObservableCounter,
			InstrumentKindObservableUpDownCounter,
			InstrumentKindObservableGauge:
			return nil
		default:
			return errIncompatibleAggregation
		}
	case AggregationSum:
		switch kind {
		case InstrumentKindObservableCounter, InstrumentKindObservableUpDownCounter, InstrumentKindCounter, InstrumentKindHistogram, InstrumentKindUpDownCounter:
			return nil
		default:
			// TODO: review need for aggregation check after
			// https://github.com/open-telemetry/opentelemetry-specification/issues/2710
			return errIncompatibleAggregation
		}
	case AggregationLastValue:
		switch kind {
		case InstrumentKindObservableGauge, InstrumentKindGauge:
			return nil
		}
		// TODO: review need for aggregation check after
		// https://github.com/open-telemetry/opentelemetry-specification/issues/2710
		return errIncompatibleAggregation
	case AggregationDrop:
		return nil
	default:
		// This is used passed checking for default, it should be an error at this point.
		return fmt.Errorf("%w: %v", errUnknownAggregation, agg)
	}
}

// pipelines is the group of pipelines connecting Readers with instrument
// measurement.
type pipelines []*pipeline

func newPipelines(
	res *resource.Resource,
	readers []Reader,
	views []View,
	exemplarFilter exemplar.Filter,
	cardinalityLimit int,
) pipelines {
	pipes := make([]*pipeline, 0, len(readers))
	for _, r := range readers {
		p := newPipeline(res, r, views, exemplarFilter, cardinalityLimit)
		r.register(p)
		pipes = append(pipes, p)
	}
	return pipes
}

type unregisterFuncs struct {
	embedded.Registration
	f []func()
}

func (u unregisterFuncs) Unregister() error {
	for _, f := range u.f {
		f()
	}
	return nil
}

// resolver facilitates resolving aggregate functions an instrument calls to
// aggregate measurements with while updating all pipelines that need to pull
// from those aggregations.
type resolver[N int64 | float64] struct {
	inserters []*inserter[N]
}

func newResolver[N int64 | float64](p pipelines, vc *cache[string, instID]) resolver[N] {
	in := make([]*inserter[N], len(p))
	for i := range in {
		in[i] = newInserter[N](p[i], vc)
	}
	return resolver[N]{in}
}

// Aggregators returns the Aggregators that must be updated by the instrument
// defined by key.
func (r resolver[N]) Aggregators(id Instrument) ([]aggregate.Measure[N], error) {
	var measures []aggregate.Measure[N]

	var err error
	for _, i := range r.inserters {
		in, e := i.Instrument(id, i.readerDefaultAggregation(id.Kind))
		if e != nil {
			err = errors.Join(err, e)
		}
		measures = append(measures, in...)
	}
	return measures, err
}

// HistogramAggregators returns the histogram Aggregators that must be updated by the instrument
// defined by key. If boundaries were provided on instrument instantiation, those take precedence
// over boundaries provided by the reader.
func (r resolver[N]) HistogramAggregators(id Instrument, boundaries []float64) ([]aggregate.Measure[N], error) {
	var measures []aggregate.Measure[N]

	var err error
	for _, i := range r.inserters {
		agg := i.readerDefaultAggregation(id.Kind)
		if histAgg, ok := agg.(AggregationExplicitBucketHistogram); ok && len(boundaries) > 0 {
			histAgg.Boundaries = boundaries
			agg = histAgg
		}
		in, e := i.Instrument(id, agg)
		if e != nil {
			err = errors.Join(err, e)
		}
		measures = append(measures, in...)
	}
	return measures, err
}
