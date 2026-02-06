package traceql

import (
	"fmt"
	"math"
	"time"

	"github.com/grafana/tempo/pkg/tempopb"
)

type firstStageElement interface {
	Element
	extractConditions(request *FetchSpansRequest)
	init(req *tempopb.QueryRangeRequest, mode AggregateMode)
	observe(Span) // TODO - batching?
	observeExemplar(Span)
	observeSeries([]*tempopb.TimeSeries) // Re-entrant metrics on the query-frontend.  Using proto version for efficiency
	result() SeriesSet
	length() int
}

type getExemplar func(Span) (float64, uint64)

// MetricsAggregate is a placeholder in the AST for a metrics aggregation
// pipeline element. It has a superset of the properties of them all, and
// builds them later via init() so that appropriate buffers can be allocated
// for the query time range and step, and different implementations for
// shardable and unshardable pipelines.
type MetricsAggregate struct {
	op         MetricsAggregateOp
	by         []Attribute
	attr       Attribute
	floats     []float64
	agg        SpanAggregator
	seriesAgg  SeriesAggregator
	exemplarFn getExemplar
	// Type of operation for simple aggregatation in layers 2 and 3
	simpleAggregationOp SimpleAggregationOp
}

func newMetricsAggregate(agg MetricsAggregateOp, by []Attribute) *MetricsAggregate {
	return &MetricsAggregate{
		op: agg,
		by: by,
	}
}

func newMetricsAggregateWithAttr(agg MetricsAggregateOp, attr Attribute, by []Attribute) *MetricsAggregate {
	return &MetricsAggregate{
		op:   agg,
		attr: attr,
		by:   by,
	}
}

func newMetricsAggregateQuantileOverTime(attr Attribute, qs []float64, by []Attribute) *MetricsAggregate {
	return &MetricsAggregate{
		op:     metricsAggregateQuantileOverTime,
		floats: qs,
		attr:   attr,
		by:     by,
	}
}

func (a *MetricsAggregate) extractConditions(request *FetchSpansRequest) {
	// For metrics aggregators based on a span attribute we have to include it
	includeAttribute := a.attr != (Attribute{}) && !request.HasAttribute(a.attr)
	if includeAttribute {
		request.SecondPassConditions = append(request.SecondPassConditions, Condition{
			Attribute: a.attr,
		})
	}

	for _, b := range a.by {
		if !request.HasAttribute(b) {
			request.SecondPassConditions = append(request.SecondPassConditions, Condition{
				Attribute: b,
			})
		}
	}
}

func (a *MetricsAggregate) init(q *tempopb.QueryRangeRequest, mode AggregateMode) {
	// Raw mode:

	var innerAgg func() VectorAggregator
	var byFunc func(Span) (Static, bool)
	var byFuncLabel string

	switch a.op {
	case metricsAggregateCountOverTime:
		innerAgg = func() VectorAggregator { return NewCountOverTimeAggregator() }
		a.simpleAggregationOp = sumAggregation
		a.exemplarFn = exemplarNaN

	case metricsAggregateMinOverTime:
		innerAgg = func() VectorAggregator { return NewOverTimeAggregator(a.attr, minOverTimeAggregation) }
		a.simpleAggregationOp = minOverTimeAggregation
		a.exemplarFn = exemplarFnFor(a.attr)

	case metricsAggregateMaxOverTime:
		innerAgg = func() VectorAggregator { return NewOverTimeAggregator(a.attr, maxOverTimeAggregation) }
		a.simpleAggregationOp = maxOverTimeAggregation
		a.exemplarFn = exemplarFnFor(a.attr)

	case metricsAggregateSumOverTime:
		innerAgg = func() VectorAggregator { return NewOverTimeAggregator(a.attr, sumOverTimeAggregation) }
		a.simpleAggregationOp = sumOverTimeAggregation
		a.exemplarFn = exemplarFnFor(a.attr)

	case metricsAggregateRate:
		innerAgg = func() VectorAggregator { return NewRateAggregator(1.0 / time.Duration(q.Step).Seconds()) }
		a.simpleAggregationOp = sumAggregation
		a.exemplarFn = exemplarNaN

	case metricsAggregateHistogramOverTime:
		innerAgg = func() VectorAggregator { return NewCountOverTimeAggregator() }
		byFunc = bucketizeFnFor(a.attr)
		byFuncLabel = internalLabelBucket
		a.simpleAggregationOp = sumAggregation
		a.exemplarFn = exemplarNaN // Histogram final series are counts so exemplars are placeholders

	case metricsAggregateQuantileOverTime:
		innerAgg = func() VectorAggregator { return NewCountOverTimeAggregator() }
		byFunc = bucketizeFnFor(a.attr)
		byFuncLabel = internalLabelBucket
		a.simpleAggregationOp = sumAggregation
		a.exemplarFn = exemplarFnFor(a.attr)
	}

	switch mode {
	case AggregateModeSum:
		a.initSum(q)
		return

	case AggregateModeFinal:
		a.initFinal(q)
		return
	}

	a.agg = NewGroupingAggregator(a.op.String(), func() RangeAggregator {
		return NewStepAggregator(q.Start, q.End, q.Step, innerAgg)
	}, a.by, byFunc, byFuncLabel)
}

func bucketizeFnFor(attr Attribute) func(Span) (Static, bool) {
	switch attr {
	case IntrinsicDurationAttribute:
		// Optimal implementation for duration attribute
		return bucketizeDuration
	default:
		// Basic implementation for all other attributes
		return bucketizeAttribute(attr)
	}
}

func bucketizeDuration(s Span) (Static, bool) {
	d := s.DurationNanos()
	if d < 2 {
		return NewStaticNil(), false
	}
	// Bucket is in seconds
	return NewStaticFloat(Log2Bucketize(d) / float64(time.Second)), true
}

// exemplarAttribute captures a closure around the attribute so it doesn't have to be passed along with every span.
// should be more efficient.
func bucketizeAttribute(a Attribute) func(Span) (Static, bool) {
	return func(s Span) (Static, bool) {
		f, t := FloatizeAttribute(s, a)

		switch t {
		case TypeInt:
			if f < 2 {
				return NewStaticNil(), false
			}
			// Bucket is the value rounded up to the nearest power of 2
			return NewStaticFloat(Log2Bucketize(uint64(f))), true
		case TypeDuration:
			if f < 2 {
				return NewStaticNil(), false
			}
			// Bucket is log2(nanos) converted to float seconds
			return NewStaticFloat(Log2Bucketize(uint64(f)) / float64(time.Second)), true
		default:
			// TODO(mdisibio) - Add support for floats, we need to map them into buckets.
			// Because of the range of floats, we need a native histogram approach.
			return NewStaticNil(), false
		}
	}
}

func exemplarFnFor(a Attribute) func(Span) (float64, uint64) {
	switch a {
	case IntrinsicDurationAttribute:
		return exemplarDuration
	case Attribute{}:
		// This records exemplars without a value, and they
		// are attached to the series at the end.
		return exemplarNaN
	default:
		return exemplarAttribute(a)
	}
}

func exemplarNaN(s Span) (float64, uint64) {
	return math.NaN(), s.StartTimeUnixNanos() / uint64(time.Millisecond)
}

func exemplarDuration(s Span) (float64, uint64) {
	v := float64(s.DurationNanos()) / float64(time.Second)
	t := s.StartTimeUnixNanos() / uint64(time.Millisecond)
	return v, t
}

// exemplarAttribute captures a closure around the attribute so it doesn't have to be passed along with every span.
// should be more efficient.
func exemplarAttribute(a Attribute) func(Span) (float64, uint64) {
	return func(s Span) (float64, uint64) {
		v, _ := FloatizeAttribute(s, a)
		t := s.StartTimeUnixNanos() / uint64(time.Millisecond)
		return v, t
	}
}

func (a *MetricsAggregate) initSum(q *tempopb.QueryRangeRequest) {
	// Currently all metrics are summed by job to produce
	// intermediate results. This will change when adding min/max/topk/etc
	a.seriesAgg = NewSimpleCombiner(q, a.simpleAggregationOp)
}

func (a *MetricsAggregate) initFinal(q *tempopb.QueryRangeRequest) {
	switch a.op {
	case metricsAggregateQuantileOverTime:
		a.seriesAgg = NewHistogramAggregator(q, a.floats)
	default:
		// These are simple additions by series
		a.seriesAgg = NewSimpleCombiner(q, a.simpleAggregationOp)
	}
}

func (a *MetricsAggregate) observe(span Span) {
	a.agg.Observe(span)
}

func (a *MetricsAggregate) observeExemplar(span Span) {
	v, ts := a.exemplarFn(span)
	a.agg.ObserveExemplar(span, v, ts)
}

func (a *MetricsAggregate) observeSeries(ss []*tempopb.TimeSeries) {
	a.seriesAgg.Combine(ss)
}

func (a *MetricsAggregate) result() SeriesSet {
	if a.agg != nil {
		return a.agg.Series()
	}

	// In the frontend-version the results come from
	// the job-level aggregator
	return a.seriesAgg.Results()
}

func (a *MetricsAggregate) length() int {
	if a.agg != nil {
		return a.agg.Length()
	}

	return a.seriesAgg.Length()
}

func (a *MetricsAggregate) validate() error {
	switch a.op {
	case metricsAggregateCountOverTime:
	case metricsAggregateMinOverTime:
	case metricsAggregateMaxOverTime:
	case metricsAggregateSumOverTime:
	case metricsAggregateRate:
	case metricsAggregateHistogramOverTime:
		if len(a.by) >= maxGroupBys {
			// We reserve a spot for the bucket so quantile has 1 less group by
			return newUnsupportedError(fmt.Sprintf("metrics group by %v values", len(a.by)))
		}
	case metricsAggregateQuantileOverTime:
		if len(a.by) >= maxGroupBys {
			// We reserve a spot for the bucket so quantile has 1 less group by
			return newUnsupportedError(fmt.Sprintf("metrics group by %v values", len(a.by)))
		}
		for _, q := range a.floats {
			if q < 0 || q > 1 {
				return fmt.Errorf("quantile must be between 0 and 1: %v", q)
			}
		}
	default:
		return newUnsupportedError(fmt.Sprintf("metrics aggregate operation (%v)", a.op))
	}

	if len(a.by) > maxGroupBys {
		return newUnsupportedError(fmt.Sprintf("metrics group by %v values", len(a.by)))
	}

	return nil
}

var _ firstStageElement = (*MetricsAggregate)(nil)

// secondStageElement represents operations that are performed
// in the second stage metrics pipeline, such as topK/bottomK, etc.
// these operations are performed on the metrics generated by the first stage.
//
// NOTE: find a batter name for this, maybe something like AggregateStage.
// This stage operates on metrics generated by the first stage and performs aggregation on traceql metrics.
// for now, calling it second stage is fine because it is the second stage in the pipeline.
// and we already have MetricsAggregate which is the in the first stage that operates on spans
// and produces metrics so we need to rename that to make things clear and avoid confusion.
type secondStageElement interface {
	Element
	init(req *tempopb.QueryRangeRequest)
	process(input SeriesSet) SeriesSet
}

type SecondStageOp int

const (
	OpTopK SecondStageOp = iota
	OpBottomK
)

var errInvalidLimit = fmt.Errorf("limit must be greater than 0")

func (op SecondStageOp) String() string {
	switch op {
	case OpTopK:
		return "topk"
	case OpBottomK:
		return "bottomk"
	}
	return "unknown"
}

// TopKBottomK handles second stage topK/bottomK operations
type TopKBottomK struct {
	op     SecondStageOp
	limit  int
	length int
}

func newTopKBottomK(op SecondStageOp, limit int) *TopKBottomK {
	return &TopKBottomK{op: op, limit: limit}
}

func (m *TopKBottomK) String() string {
	return fmt.Sprintf("%s(%d)", m.op.String(), m.limit)
}

func (m *TopKBottomK) validate() error {
	if m.limit <= 0 {
		return errInvalidLimit
	}
	return nil
}

func (m *TopKBottomK) init(req *tempopb.QueryRangeRequest) {
	m.length = IntervalCount(req.Start, req.End, req.Step)
}

func (m *TopKBottomK) process(input SeriesSet) SeriesSet {
	// if input size is less or equal to limit, return input as is
	if len(input) <= m.limit {
		return input
	}

	switch m.op {
	case OpTopK:
		return processTopK(input, m.length, m.limit)
	case OpBottomK:
		return processBottomK(input, m.length, m.limit)
	default:
		// unknown operation, return input SeriesSet, we shouldn't reach here
		return input
	}
}

var _ secondStageElement = (*TopKBottomK)(nil)
