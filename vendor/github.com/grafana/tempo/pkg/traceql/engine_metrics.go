package traceql

import (
	"container/heap"
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"sort"
	"sync"
	"time"

	"github.com/grafana/tempo/pkg/tempopb"
	commonv1proto "github.com/grafana/tempo/pkg/tempopb/common/v1"
	v1 "github.com/grafana/tempo/pkg/tempopb/common/v1"
	"github.com/grafana/tempo/pkg/util"
	"github.com/prometheus/prometheus/model/labels"
)

const (
	internalLabelMetaType = "__meta_type"
	internalMetaTypeCount = "__count"
	internalLabelBucket   = "__bucket"
	maxExemplars          = 100
	maxExemplarsPerBucket = 2
	// NormalNaN is a quiet NaN. This is also math.NaN().
	normalNaN uint64 = 0x7ff8000000000001
)

func DefaultQueryRangeStep(start, end uint64) uint64 {
	delta := time.Duration(end - start)

	// Try to get this many data points
	// Our baseline is is 1 hour @ 15s intervals
	baseline := delta / 240

	// Round down in intervals of 5s
	interval := baseline / (5 * time.Second) * (5 * time.Second)

	if interval < 5*time.Second {
		// Round down in intervals of 1s
		interval = baseline / time.Second * time.Second
	}

	if interval < time.Second {
		return uint64(time.Second.Nanoseconds())
	}

	return uint64(interval.Nanoseconds())
}

// IntervalCount is the number of intervals in the range with step.
func IntervalCount(start, end, step uint64) int {
	start = alignStart(start, step)
	end = alignEnd(end, step)

	intervals := (end - start) / step
	intervals++
	return int(intervals)
}

// TimestampOf the given interval with the start and step.
func TimestampOf(interval, start, step uint64) uint64 {
	start = alignStart(start, step)
	return start + interval*step
}

// IntervalOf the given timestamp within the range and step.
func IntervalOf(ts, start, end, step uint64) int {
	start = alignStart(start, step)
	end = alignEnd(end, step) + step

	if ts < start || ts > end || end == start || step == 0 {
		// Invalid
		return -1
	}

	return int((ts - start) / step)
}

// IntervalOfMs is the same as IntervalOf except the input and calculations are in unix milliseconds.
func IntervalOfMs(tsmills int64, start, end, step uint64) int {
	ts := uint64(time.Duration(tsmills) * time.Millisecond)
	start -= start % uint64(time.Millisecond)
	end -= end % uint64(time.Millisecond)
	return IntervalOf(ts, start, end, step)
}

// TrimToBlockOverlap returns the aligned overlap between the given time and block ranges,
// the block's borders are included.
// If the request is instantaneous, it returns an updated step to match the new time range.
// It assumes that blockEnd is aligned to seconds.
func TrimToBlockOverlap(start, end, step uint64, blockStart, blockEnd time.Time) (uint64, uint64, uint64) {
	wasInstant := end-start == step

	start2 := uint64(blockStart.UnixNano())
	// Block's endTime is rounded down to the nearest second and considered inclusive.
	// In order to include the right border with nanoseconds, we add 1 second
	blockEnd = blockEnd.Add(time.Second)
	end2 := uint64(blockEnd.UnixNano())

	start = max(start, start2)
	end = min(end, end2)

	if wasInstant {
		// Alter step to maintain instant nature
		step = end - start
	}

	return start, end, step
}

// TrimToBefore shortens the query window to only include before the given time.
// Request must be in unix nanoseconds already.
func TrimToBefore(req *tempopb.QueryRangeRequest, before time.Time) {
	wasInstant := IsInstant(*req)
	beforeNs := uint64(before.UnixNano())

	req.Start = min(req.Start, beforeNs)
	req.End = min(req.End, beforeNs)

	if wasInstant {
		// Maintain instant nature of the request
		req.Step = req.End - req.Start
	}
}

// TrimToAfter shortens the query window to only include after the given time.
// Request must be in unix nanoseconds already.
func TrimToAfter(req *tempopb.QueryRangeRequest, before time.Time) {
	wasInstant := IsInstant(*req)
	beforeNs := uint64(before.UnixNano())

	req.Start = max(req.Start, beforeNs)
	req.End = max(req.End, beforeNs)

	if wasInstant {
		// Maintain instant nature of the request
		req.Step = req.End - req.Start
	}
}

func IsInstant(req tempopb.QueryRangeRequest) bool {
	return req.End-req.Start == req.Step
}

// AlignRequest shifts the start and end times of the request to align with the step
// interval.  This gives more consistent results across refreshes of queries like "last 1 hour".
// Without alignment each refresh is shifted by seconds or even milliseconds and the time series
// calculations are sublty different each time. It's not wrong, but less preferred behavior.
func AlignRequest(req *tempopb.QueryRangeRequest) {
	if IsInstant(*req) {
		return
	}

	// It doesn't really matter but the request fields are expected to be in nanoseconds.
	req.Start = alignStart(req.Start, req.Step)
	req.End = alignEnd(req.End, req.Step)
}

// Start time is rounded down to next step
func alignStart(start, step uint64) uint64 {
	if step == 0 {
		return 0
	}
	return start - start%step
}

// End time is rounded up to next step
func alignEnd(end, step uint64) uint64 {
	if step == 0 {
		return 0
	}

	mod := end % step
	if mod == 0 {
		return end
	}

	return end + (step - mod)
}

type Label struct {
	Name  string
	Value Static
}

type Labels []Label

func LabelsFromProto(ls []v1.KeyValue) Labels {
	out := make(Labels, 0, len(ls))
	for _, l := range ls {
		out = append(out, Label{Name: l.Key, Value: StaticFromAnyValue(l.Value)})
	}
	return out
}

// String returns the prometheus-formatted version of the labels. Which is downcasting
// the typed TraceQL values to strings, with some special casing.
func (ls Labels) String() string {
	promLabels := labels.NewBuilder(nil)
	for _, l := range ls {
		var promValue string
		switch {
		case l.Value.Type == TypeNil:
			promValue = "<nil>"
		case l.Value.Type == TypeString:
			s := l.Value.EncodeToString(false)
			if s == "nil" {
				promValue = "<nil>"
			} else if s == "" {
				promValue = "<empty>"
			} else {
				promValue = s
			}
		default:
			promValue = l.Value.EncodeToString(false)
		}
		promLabels.Set(l.Name, promValue)
	}

	return promLabels.Labels().String()
}

type Exemplar struct {
	Labels      Labels
	Value       float64
	TimestampMs uint64
}

type TimeSeries struct {
	Labels    Labels
	Values    []float64
	Exemplars []Exemplar
}

// SeriesSet is a set of unique timeseries. They are mapped by the "Prometheus"-style
// text description: {x="a",y="b"} for convenience.
type SeriesSet map[string]TimeSeries

func (set SeriesSet) ToProto(req *tempopb.QueryRangeRequest) []*tempopb.TimeSeries {
	resp := make([]*tempopb.TimeSeries, 0, len(set))

	for promLabels, s := range set {
		labels := make([]commonv1proto.KeyValue, 0, len(s.Labels))
		for _, label := range s.Labels {
			labels = append(labels,
				commonv1proto.KeyValue{
					Key:   label.Name,
					Value: label.Value.AsAnyValue(),
				},
			)
		}

		start, end := req.Start, req.End
		start = alignStart(start, req.Step)
		end = alignEnd(end, req.Step)

		intervals := IntervalCount(start, end, req.Step)
		samples := make([]tempopb.Sample, 0, intervals)
		for i, value := range s.Values {
			ts := TimestampOf(uint64(i), req.Start, req.Step)

			// todo: this loop should be able to be restructured to directly pass over
			// the desired intervals
			if ts < start || ts > end || math.IsNaN(value) {
				continue
			}

			samples = append(samples, tempopb.Sample{
				TimestampMs: time.Unix(0, int64(ts)).UnixMilli(),
				Value:       value,
			})
		}
		// Do not include empty TimeSeries
		if len(samples) == 0 {
			continue
		}

		var exemplars []tempopb.Exemplar
		if len(s.Exemplars) > 0 {
			exemplars = make([]tempopb.Exemplar, 0, len(s.Exemplars))
		}
		for _, e := range s.Exemplars {
			// skip exemplars that has NaN value
			i := IntervalOfMs(int64(e.TimestampMs), start, end, req.Step)
			if i < 0 || i >= len(s.Values) || math.IsNaN(s.Values[i]) { // strict bounds check
				continue
			}

			labels := make([]commonv1proto.KeyValue, 0, len(e.Labels))
			for _, label := range e.Labels {
				labels = append(labels,
					commonv1proto.KeyValue{
						Key:   label.Name,
						Value: label.Value.AsAnyValue(),
					},
				)
			}

			exemplars = append(exemplars, tempopb.Exemplar{
				Labels:      labels,
				Value:       e.Value,
				TimestampMs: int64(e.TimestampMs),
			})
		}

		ss := &tempopb.TimeSeries{
			PromLabels: promLabels,
			Labels:     labels,
			Samples:    samples,
			Exemplars:  exemplars,
		}

		resp = append(resp, ss)
	}

	return resp
}

// VectorAggregator turns a vector of spans into a single numeric scalar
type VectorAggregator interface {
	Observe(s Span)
	Sample() float64
}

// RangeAggregator sorts spans into time slots
// TODO - for efficiency we probably combine this with VectorAggregator (see todo about CountOverTimeAggregator)
type RangeAggregator interface {
	Observe(s Span)
	ObserveExemplar(float64, uint64, Labels)
	Samples() []float64
	Exemplars() []Exemplar
	Length() int
}

// SpanAggregator sorts spans into series
type SpanAggregator interface {
	Observe(Span)
	ObserveExemplar(Span, float64, uint64)
	Series() SeriesSet
	Length() int
}

// CountOverTimeAggregator counts the number of spans. It can also
// calculate the rate when given a multiplier.
// TODO - Rewrite me to be []float64 which is more efficient
type CountOverTimeAggregator struct {
	count    float64
	rateMult float64
}

var _ VectorAggregator = (*CountOverTimeAggregator)(nil)

func NewCountOverTimeAggregator() *CountOverTimeAggregator {
	return &CountOverTimeAggregator{
		rateMult: 1.0,
	}
}

func NewRateAggregator(rateMult float64) *CountOverTimeAggregator {
	return &CountOverTimeAggregator{
		rateMult: rateMult,
	}
}

func (c *CountOverTimeAggregator) Observe(_ Span) {
	c.count++
}

func (c *CountOverTimeAggregator) Sample() float64 {
	return c.count * c.rateMult
}

// MinOverTimeAggregator it calculates the mininum value over time. It can also
// calculate the rate when given a multiplier.
type OverTimeAggregator struct {
	getSpanAttValue func(s Span) float64
	agg             func(current, n float64) float64
	val             float64
}

var _ VectorAggregator = (*OverTimeAggregator)(nil)

func NewOverTimeAggregator(attr Attribute, op SimpleAggregationOp) *OverTimeAggregator {
	var fn func(s Span) float64
	var agg func(current, n float64) float64

	switch op {
	case maxOverTimeAggregation:
		agg = maxOverTime()
	case minOverTimeAggregation:
		agg = minOverTime()
	case sumOverTimeAggregation:
		agg = sumOverTime()
	}

	switch attr {
	case IntrinsicDurationAttribute:
		fn = func(s Span) float64 {
			return float64(s.DurationNanos()) / float64(time.Second)
		}
	default:
		fn = func(s Span) float64 {
			f, a := FloatizeAttribute(s, attr)
			if a == TypeNil {
				return math.Float64frombits(normalNaN)
			}
			return f
		}
	}

	return &OverTimeAggregator{
		getSpanAttValue: fn,
		agg:             agg,
		val:             math.Float64frombits(normalNaN),
	}
}

func (c *OverTimeAggregator) Observe(s Span) {
	c.val = c.agg(c.val, c.getSpanAttValue(s))
}

func (c *OverTimeAggregator) Sample() float64 {
	return c.val
}

// StepAggregator sorts spans into time slots using a step interval like 30s or 1m
type StepAggregator struct {
	start, end, step uint64
	intervals        int
	vectors          []VectorAggregator
	exemplars        []Exemplar
	exemplarBuckets  *bucketSet
}

var _ RangeAggregator = (*StepAggregator)(nil)

func NewStepAggregator(start, end, step uint64, innerAgg func() VectorAggregator) *StepAggregator {
	intervals := IntervalCount(start, end, step)
	vectors := make([]VectorAggregator, intervals)
	for i := range vectors {
		vectors[i] = innerAgg()
	}

	exemplars := make([]Exemplar, 0, maxExemplars)

	return &StepAggregator{
		start:           start,
		end:             end,
		step:            step,
		intervals:       intervals,
		vectors:         vectors,
		exemplars:       exemplars,
		exemplarBuckets: newBucketSet(intervals),
	}
}

func (s *StepAggregator) Observe(span Span) {
	interval := IntervalOf(span.StartTimeUnixNanos(), s.start, s.end, s.step)
	if interval == -1 {
		return
	}
	s.vectors[interval].Observe(span)
}

func (s *StepAggregator) ObserveExemplar(value float64, ts uint64, lbls Labels) {
	if s.exemplarBuckets.testTotal() {
		return
	}
	interval := IntervalOfMs(int64(ts), s.start, s.end, s.step)
	if s.exemplarBuckets.addAndTest(interval) {
		return
	}

	s.exemplars = append(s.exemplars, Exemplar{
		Labels:      lbls,
		Value:       value,
		TimestampMs: ts,
	})
}

func (s *StepAggregator) Samples() []float64 {
	ss := make([]float64, len(s.vectors))
	for i, v := range s.vectors {
		ss[i] = v.Sample()
	}
	return ss
}

func (s *StepAggregator) Exemplars() []Exemplar {
	return s.exemplars
}

func (s *StepAggregator) Length() int {
	return 0
}

const maxGroupBys = 5 // TODO - This isn't ideal but see comment below.

// FastValues is an array of attribute values (static values) that can be used
// as a map key.  This offers good performance and works with native Go maps and
// has no chance for collisions (whereas a hash32 has a non-zero chance of
// collisions).  However, it means we have to arbitrarily set an upper limit on
// the maximum number of values.

type (
	FastStatic1 [1]StaticMapKey
	FastStatic2 [2]StaticMapKey
	FastStatic3 [3]StaticMapKey
	FastStatic4 [4]StaticMapKey
	FastStatic5 [5]StaticMapKey
)

type FastStatic interface {
	FastStatic1 | FastStatic2 | FastStatic3 | FastStatic4 | FastStatic5
}

type (
	StaticVals1 [1]Static
	StaticVals2 [2]Static
	StaticVals3 [3]Static
	StaticVals4 [4]Static
	StaticVals5 [5]Static
)

type StaticVals interface {
	StaticVals1 | StaticVals2 | StaticVals3 | StaticVals4 | StaticVals5
}

// GroupingAggregator groups spans into series based on attribute values.
type GroupingAggregator[F FastStatic, S StaticVals] struct {
	// Config
	by          []Attribute               // Original attributes: .foo
	byLookups   [][]Attribute             // Lookups: span.foo resource.foo
	byFunc      func(Span) (Static, bool) // Dynamic label calculated by a callback
	byFuncLabel string                    // Name of the dynamic label
	innerAgg    func() RangeAggregator

	// Data
	series     map[F]aggregatorWitValues[S]
	lastSeries aggregatorWitValues[S]
	buf        fastStaticWithValues[F, S]
	lastBuf    fastStaticWithValues[F, S]
}

type aggregatorWitValues[S StaticVals] struct {
	agg  RangeAggregator
	vals S
}

type fastStaticWithValues[F FastStatic, S StaticVals] struct {
	fast F
	vals S
}

var _ SpanAggregator = (*GroupingAggregator[FastStatic1, StaticVals1])(nil)

func NewGroupingAggregator(aggName string, innerAgg func() RangeAggregator, by []Attribute, byFunc func(Span) (Static, bool), byFuncLabel string) SpanAggregator {
	if len(by) == 0 && byFunc == nil {
		return &UngroupedAggregator{
			name:     aggName,
			innerAgg: innerAgg(),
		}
	}

	lookups := make([][]Attribute, len(by))
	for i, attr := range by {
		if attr.Intrinsic == IntrinsicNone && attr.Scope == AttributeScopeNone {
			// Unscoped attribute. Check span-level, then resource-level.
			// TODO - Is this taken care of by span.AttributeFor now?
			lookups[i] = []Attribute{
				NewScopedAttribute(AttributeScopeSpan, false, attr.Name),
				NewScopedAttribute(AttributeScopeResource, false, attr.Name),
			}
		} else {
			lookups[i] = []Attribute{attr}
		}
	}

	aggNum := len(lookups)
	if byFunc != nil {
		aggNum++
	}

	switch aggNum {
	case 1:
		return newGroupingAggregator[FastStatic1, StaticVals1](innerAgg, by, byFunc, byFuncLabel, lookups)
	case 2:
		return newGroupingAggregator[FastStatic2, StaticVals2](innerAgg, by, byFunc, byFuncLabel, lookups)
	case 3:
		return newGroupingAggregator[FastStatic3, StaticVals3](innerAgg, by, byFunc, byFuncLabel, lookups)
	case 4:
		return newGroupingAggregator[FastStatic4, StaticVals4](innerAgg, by, byFunc, byFuncLabel, lookups)
	case 5:
		return newGroupingAggregator[FastStatic5, StaticVals5](innerAgg, by, byFunc, byFuncLabel, lookups)
	default:
		panic("unsupported number of group-bys")
	}
}

func newGroupingAggregator[F FastStatic, S StaticVals](innerAgg func() RangeAggregator, by []Attribute, byFunc func(Span) (Static, bool), byFuncLabel string, lookups [][]Attribute) SpanAggregator {
	return &GroupingAggregator[F, S]{
		series:      map[F]aggregatorWitValues[S]{},
		by:          by,
		byFunc:      byFunc,
		byFuncLabel: byFuncLabel,
		byLookups:   lookups,
		innerAgg:    innerAgg,
	}
}

// getGroupingValues gets the grouping values for the span and stores them in the buffer.
// Returns false if the span should be dropped.
func (g *GroupingAggregator[F, S]) getGroupingValues(span Span) bool {
	// Get grouping values
	// Reuse same buffer
	// There is no need to reset, the number of group-by attributes
	// is fixed after creation.
	for i, lookups := range g.byLookups {
		val := lookup(lookups, span)
		g.buf.vals[i] = val
		g.buf.fast[i] = val.MapKey()
	}

	// If dynamic label exists calculate and append it
	if g.byFunc != nil {
		v, ok := g.byFunc(span)
		if !ok {
			// Totally drop this span
			return false
		}
		g.buf.vals[len(g.byLookups)] = v
		g.buf.fast[len(g.byLookups)] = v.MapKey()
	}

	return true
}

// getSeries gets the series for the current span.
// It will reuse the last series if possible.
func (g *GroupingAggregator[F, S]) getSeries() aggregatorWitValues[S] {
	// Fast path
	if g.lastSeries.agg != nil && g.lastBuf.fast == g.buf.fast {
		return g.lastSeries
	}

	s, ok := g.series[g.buf.fast]
	if !ok {
		s.agg = g.innerAgg()
		s.vals = g.buf.vals
		g.series[g.buf.fast] = s
	}

	g.lastBuf = g.buf
	g.lastSeries = s
	return s
}

// Observe the span by looking up its group-by attributes, mapping to the series,
// and passing to the inner aggregate.  This is a critical hot path.
func (g *GroupingAggregator[F, S]) Observe(span Span) {
	if !g.getGroupingValues(span) {
		return
	}

	s := g.getSeries()
	s.agg.Observe(span)
}

func (g *GroupingAggregator[F, S]) ObserveExemplar(span Span, value float64, ts uint64) {
	if !g.getGroupingValues(span) {
		return
	}

	s := g.getSeries()

	// Observe exemplar
	all := span.AllAttributes()
	lbls := make(Labels, 0, len(all))
	for k, v := range span.AllAttributes() {
		lbls = append(lbls, Label{k.String(), v})
	}
	s.agg.ObserveExemplar(value, ts, lbls)
}

func (g *GroupingAggregator[F, S]) Length() int {
	return len(g.series)
}

// labelsFor gives the final labels for the series. Slower and not on the hot path.
// This is tweaked to match what prometheus does where possible with an exception.
// In the case of all values missing.
// (1) Standard case: a label is created for each group-by value in the series:
//
//	Ex: rate() by (x,y) can yield:
//	{x=a,y=b}
//	{x=c,y=d}
//	etc
//
// (2) Nils are dropped. A nil can be present for any label, so any combination
// of the remaining labels is possible. Label order is preserved.
//
//	Ex: rate() by (x,y,z) can yield all of these combinations:
//	{x=..., y=..., z=...}
//	{x=...,        z=...}
//	{x=...              }
//	{       y=..., z=...}
//	{       y=...       }
//	etc
//
// (3) Exceptional case: All Nils. For the TraceQL data-type aware labels we still drop
// all nils which results in an empty label set. But Prometheus-style always have
// at least 1 label, so in that case we have to force at least 1 label or else things
// may not be handled correctly downstream.  In this case we take the first label and
// make it the string "nil"
//
//	Ex: rate() by (x,y,z) and all nil yields:
//	{x="nil"}
func (g *GroupingAggregator[F, S]) labelsFor(vals S) (Labels, string) {
	labels := make(Labels, 0, len(g.by)+1)
	for i := range g.by {
		if vals[i].Type == TypeNil {
			continue
		}
		labels = append(labels, Label{g.by[i].String(), vals[i]})
	}
	if g.byFunc != nil {
		labels = append(labels, Label{g.byFuncLabel, vals[len(g.by)]})
	}

	if len(labels) == 0 {
		// When all nil then force one
		labels = append(labels, Label{g.by[0].String(), NewStaticNil()})
	}

	return labels, labels.String()
}

func (g *GroupingAggregator[F, S]) Series() SeriesSet {
	ss := SeriesSet{}

	for _, s := range g.series {
		labels, promLabels := g.labelsFor(s.vals)

		ss[promLabels] = TimeSeries{
			Labels:    labels,
			Values:    s.agg.Samples(),
			Exemplars: s.agg.Exemplars(),
		}
	}

	return ss
}

// UngroupedAggregator builds a single series with no labels. e.g. {} | rate()
type UngroupedAggregator struct {
	name     string
	innerAgg RangeAggregator
}

var _ SpanAggregator = (*UngroupedAggregator)(nil)

func (u *UngroupedAggregator) Observe(span Span) {
	u.innerAgg.Observe(span)
}

func (u *UngroupedAggregator) ObserveExemplar(span Span, value float64, ts uint64) {
	all := span.AllAttributes()
	lbls := make(Labels, 0, len(all))
	for k, v := range all {
		lbls = append(lbls, Label{k.String(), v})
	}
	u.innerAgg.ObserveExemplar(value, ts, lbls)
}

func (u *UngroupedAggregator) Length() int {
	return 0
}

// Series output.
// This is tweaked to match what prometheus does.  For ungrouped metrics we
// fill in a placeholder metric name with the name of the aggregation.
// rate() => {__name__=rate}
func (u *UngroupedAggregator) Series() SeriesSet {
	l := labels.FromStrings(labels.MetricName, u.name)
	return SeriesSet{
		l.String(): {
			Labels:    []Label{{labels.MetricName, NewStaticString(u.name)}},
			Values:    u.innerAgg.Samples(),
			Exemplars: u.innerAgg.Exemplars(),
		},
	}
}

func (e *Engine) CompileMetricsQueryRangeNonRaw(req *tempopb.QueryRangeRequest, mode AggregateMode) (*MetricsFrontendEvaluator, error) {
	if req.Start <= 0 {
		return nil, fmt.Errorf("start required")
	}
	if req.End <= 0 {
		return nil, fmt.Errorf("end required")
	}
	if req.End <= req.Start {
		return nil, fmt.Errorf("end must be greater than start")
	}
	if req.Step <= 0 {
		return nil, fmt.Errorf("step required")
	}

	_, _, metricsPipeline, metricsSecondStage, _, err := Compile(req.Query)
	if err != nil {
		return nil, fmt.Errorf("compiling query: %w", err)
	}

	// for metrics queries, we need a metrics pipeline
	if metricsPipeline == nil {
		return nil, fmt.Errorf("not a metrics query")
	}

	metricsPipeline.init(req, mode)
	mfe := &MetricsFrontendEvaluator{
		metricsPipeline: metricsPipeline,
	}

	// only run metrics second stage if we have second stage and query mode = final,
	// as we are not sharding them now in lower layers.
	if metricsSecondStage != nil && mode == AggregateModeFinal {
		metricsSecondStage.init(req)
		mfe.metricsSecondStage = metricsSecondStage
	}

	return mfe, nil
}

// CompileMetricsQueryRange returns an evaluator that can be reused across multiple data sources.
// Dedupe spans parameter is an indicator of whether to expected duplicates in the datasource. For
// example if the datasource is replication factor=1 or only a single block then we know there
// aren't duplicates, and we can make some optimizations.
func (e *Engine) CompileMetricsQueryRange(req *tempopb.QueryRangeRequest, exemplars int, timeOverlapCutoff float64, allowUnsafeQueryHints bool) (*MetricsEvaluator, error) {
	if req.Start <= 0 {
		return nil, fmt.Errorf("start required")
	}
	if req.End <= 0 {
		return nil, fmt.Errorf("end required")
	}
	if req.End <= req.Start {
		return nil, fmt.Errorf("end must be greater than start")
	}
	if req.Step <= 0 {
		return nil, fmt.Errorf("step required")
	}

	expr, eval, metricsPipeline, _, storageReq, err := Compile(req.Query)
	if err != nil {
		return nil, fmt.Errorf("compiling query: %w", err)
	}

	if metricsPipeline == nil {
		return nil, fmt.Errorf("not a metrics query")
	}

	if v, ok := expr.Hints.GetInt(HintExemplars, allowUnsafeQueryHints); ok {
		exemplars = v
	}

	// This initializes all step buffers, counters, etc
	metricsPipeline.init(req, AggregateModeRaw)

	me := &MetricsEvaluator{
		storageReq:        storageReq,
		metricsPipeline:   metricsPipeline,
		timeOverlapCutoff: timeOverlapCutoff,
		maxExemplars:      exemplars,
		exemplarMap:       make(map[string]struct{}, exemplars), // TODO: Lazy, use bloom filter, CM sketch or something
	}

	// Span start time (always required)
	if !storageReq.HasAttribute(IntrinsicSpanStartTimeAttribute) {
		// Technically we only need the start time of matching spans, so we add it to the second pass.
		// However this is often optimized back to the first pass when it lets us avoid a second pass altogether.
		storageReq.SecondPassConditions = append(storageReq.SecondPassConditions, Condition{Attribute: IntrinsicSpanStartTimeAttribute})
	}

	// Timestamp filtering
	// (1) Include any overlapping trace
	//     It can be faster to skip the trace-level timestamp check
	//     when all or most of the traces overlap the window.
	//     So this is done dynamically on a per-fetcher basis in Do()
	// (2) Only include spans that started in this time frame.
	//     This is checked outside the fetch layer in the evaluator. Timestamp
	//     is only checked on the spans that are the final results.
	// TODO - I think there are cases where we can push this down.
	// Queries like {status=error} | rate() don't assert inter-span conditions
	// and we could filter on span start time without affecting correctness.
	// Queries where we can't are like:  {A} >> {B} | rate() because only require
	// that {B} occurs within our time range but {A} is allowed to occur any time.
	me.checkTime = true
	me.start = req.Start
	me.end = req.End

	if me.maxExemplars > 0 {
		cb := func() bool { return me.exemplarCount < me.maxExemplars }
		meta := ExemplarMetaConditionsWithout(cb, storageReq.SecondPassConditions, storageReq.AllConditions)
		storageReq.SecondPassConditions = append(storageReq.SecondPassConditions, meta...)
	}
	// Setup second pass callback.  It might be optimized away
	storageReq.SecondPass = func(s *Spanset) ([]*Spanset, error) {
		// The traceql engine isn't thread-safe.
		// But parallelization is required for good metrics performance.
		// So we do external locking here.
		me.mtx.Lock()
		defer me.mtx.Unlock()
		return eval([]*Spanset{s})
	}

	optimize(storageReq)

	return me, nil
}

// optimize numerous things within the request that is specific to metrics.
func optimize(req *FetchSpansRequest) {
	if !req.AllConditions || req.SecondPassSelectAll {
		return
	}

	// Unscoped attributes like .foo require the second pass to evaluate
	for _, c := range req.Conditions {
		if c.Attribute.Scope == AttributeScopeNone && c.Attribute.Intrinsic == IntrinsicNone {
			// Unscoped (non-intrinsic) attribute
			return
		}
	}

	// There is an issue where multiple conditions &&'ed on the same
	// attribute can look like AllConditions==true, but are implemented
	// in the storage layer like ||'ed and require the second pass callback (engine).
	// TODO(mdisibio) - This would be a big performance improvement if we can fix the storage layer
	// Example:
	//   { span.http.status_code >= 500 && span.http.status_code < 600 } | rate() by (span.http.status_code)
	exists := make(map[Attribute]struct{}, len(req.Conditions))
	for _, c := range req.Conditions {
		if _, ok := exists[c.Attribute]; ok {
			// Don't optimize
			return
		}
		exists[c.Attribute] = struct{}{}
	}

	// Special optimization for queries like:
	//  {} | rate()
	//  {} | rate() by (rootName)
	//  {} | rate() by (resource.service.name)
	// When the second pass consists only of intrinsics, then it's possible to
	// move them to the first pass and increase performance. It avoids the second pass/bridge
	// layer and doesn't alter the correctness of the query.
	// This can't be done for plain attributes or in all cases.
	if len(req.SecondPassConditions) > 0 {
		if !allIntrinsics(req.SecondPassConditions) {
			// Cannot move them.
			return
		}

		// Move all to first pass
		req.Conditions = append(req.Conditions, req.SecondPassConditions...)
		req.SecondPassConditions = nil
	}

	// If the remaining first layer is a single condition, then we can
	// eliminate the callback.
	if len(req.Conditions) == 1 {
		req.SecondPass = nil
		return
	}

	// Finally if the entire remaining first layer is intrinsics, then we can
	// elmininate the callback.
	// TODO(mdisibio): We can't eliminate the callback if other conditions exist, despite AllConditions, because the storage layer
	// doesn't strictly honor AllConditions for multiple attributes of the same type in the shared columns.
	// For example: { span.string_a = "foo" && span.string_b = "bar" } | rate()
	// This query requires the callback to assert the attributes correctly.
	// Dedicated columns aren't affected but we don't have the information to distinguish that here.
	if len(req.Conditions) > 0 && allIntrinsics(req.Conditions) {
		req.SecondPass = nil
	}
}

func allIntrinsics(conds []Condition) bool {
	for _, cond := range conds {
		if cond.Attribute.Intrinsic != IntrinsicNone {
			continue
		}

		// This is a very special case. resource.service.name is also always present
		// (required by spec) so it can be moved too.
		if cond.Attribute.Scope == AttributeScopeResource && cond.Attribute.Name == "service.name" {
			continue
		}

		// Anything else is not an intrinsic
		return false
	}
	return true
}

func lookup(needles []Attribute, haystack Span) Static {
	for _, n := range needles {
		if v, ok := haystack.AttributeFor(n); ok {
			return v
		}
	}

	return NewStaticNil()
}

type MetricsEvaluator struct {
	start, end                      uint64
	checkTime                       bool
	maxExemplars, exemplarCount     int
	exemplarMap                     map[string]struct{}
	timeOverlapCutoff               float64
	storageReq                      *FetchSpansRequest
	metricsPipeline                 firstStageElement
	spansTotal, spansDeduped, bytes uint64
	mtx                             sync.Mutex
}

func timeRangeOverlap(reqStart, reqEnd, dataStart, dataEnd uint64) float64 {
	st := max(reqStart, dataStart)
	end := min(reqEnd, dataEnd)

	if end <= st {
		return 0
	}

	return float64(end-st) / float64(dataEnd-dataStart)
}

// Do metrics on the given source of data and merge the results into the working set.  Optionally, if provided,
// uses the known time range of the data for last-minute optimizations. Time range is unix nanos

func (e *MetricsEvaluator) Do(ctx context.Context, f SpansetFetcher, fetcherStart, fetcherEnd uint64, maxSeries int) error {
	// Make a copy of the request so we can modify it.
	storageReq := *e.storageReq

	if fetcherStart > 0 && fetcherEnd > 0 &&
		// exclude special case for a block with the same start and end
		fetcherStart != fetcherEnd {
		// Dynamically decide whether to use the trace-level timestamp columns
		// for filtering.
		overlap := timeRangeOverlap(e.start, e.end, fetcherStart, fetcherEnd)

		if overlap == 0.0 {
			// This shouldn't happen but might as well check.
			// No overlap == nothing to do
			return nil
		}

		// Our heuristic is if the overlap between the given fetcher (i.e. block)
		// and the request is less than X%, use them.  Above X%, the cost of loading
		// them doesn't outweight the benefits. The default 20% was measured in
		// local benchmarking.
		if overlap < e.timeOverlapCutoff {
			storageReq.StartTimeUnixNanos = e.start
			storageReq.EndTimeUnixNanos = e.end // Should this be exclusive?
		}
	}

	fetch, err := f.Fetch(ctx, storageReq)
	if errors.Is(err, util.ErrUnsupported) {
		return nil
	}
	if err != nil {
		return err
	}

	defer fetch.Results.Close()

	seriesCount := 0

	for {
		ss, err := fetch.Results.Next(ctx)
		if err != nil {
			return err
		}
		if ss == nil {
			break
		}

		e.mtx.Lock()

		var validSpansCount int
		var randomSpanIndex int

		needExemplar := e.maxExemplars > 0 && e.sampleExemplar(ss.TraceID)

		for i, s := range ss.Spans {
			if e.checkTime {
				st := s.StartTimeUnixNanos()
				if st < e.start || st >= e.end {
					continue
				}
			}

			validSpansCount++
			e.metricsPipeline.observe(s)

			if !needExemplar {
				continue
			}

			// Reservoir sampling - select a random span for exemplar
			// Each span has a 1/validSpansCount probability of being selected
			if validSpansCount == 1 || rand.Intn(validSpansCount) == 0 {
				randomSpanIndex = i
			}
		}
		e.spansTotal += uint64(validSpansCount)

		if needExemplar && validSpansCount > 0 {
			e.metricsPipeline.observeExemplar(ss.Spans[randomSpanIndex])
		}

		seriesCount = e.metricsPipeline.length()

		e.mtx.Unlock()
		ss.Release()

		if maxSeries > 0 && seriesCount >= maxSeries {
			break
		}
	}

	e.mtx.Lock()
	defer e.mtx.Unlock()
	e.bytes += fetch.Bytes()

	return nil
}

func (e *MetricsEvaluator) Length() int {
	return e.metricsPipeline.length()
}

func (e *MetricsEvaluator) Metrics() (uint64, uint64, uint64) {
	e.mtx.Lock()
	defer e.mtx.Unlock()

	return e.bytes, e.spansTotal, e.spansDeduped
}

func (e *MetricsEvaluator) Results() SeriesSet {
	// NOTE: skip processing of second stage because not all first stage functions can't be pushed down.
	// for example: if query has avg_over_time(), then we can't push it down to second stage, and second stage
	// can only be processed on the frontend.
	// we could do this but it would require knowing if the first stage functions
	// can be pushed down to second stage or not so we are skipping it for now, and will handle it later.
	return e.metricsPipeline.result()
}

func (e *MetricsEvaluator) sampleExemplar(id []byte) bool {
	if len(e.exemplarMap) >= e.maxExemplars {
		return false
	}
	if len(id) == 0 {
		return false
	}

	// Avoid sampling exemplars for the same trace
	// Check does zero allocs
	if _, ok := e.exemplarMap[string(id)]; ok {
		return false
	}

	e.exemplarMap[string(id)] = struct{}{}
	e.exemplarCount++
	return true
}

// MetricsFrontendEvaluator pipes the sharded job results back into the engine for the rest
// of the pipeline.  i.e. This evaluator is for the query-frontend.
type MetricsFrontendEvaluator struct {
	mtx                sync.Mutex
	metricsPipeline    firstStageElement
	metricsSecondStage secondStageElement
}

func (m *MetricsFrontendEvaluator) ObserveSeries(in []*tempopb.TimeSeries) {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	m.metricsPipeline.observeSeries(in)
}

func (m *MetricsFrontendEvaluator) Results() SeriesSet {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	results := m.metricsPipeline.result()

	if m.metricsSecondStage != nil {
		// metrics second stage is only set when query has second stage function and mode = final
		// if we have metrics second stage, pass first stage results through
		// second stage for further processing.
		results = m.metricsSecondStage.process(results)
	}

	return results
}

func (m *MetricsFrontendEvaluator) Length() int {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	return m.metricsPipeline.length()
}

type SeriesAggregator interface {
	Combine([]*tempopb.TimeSeries)
	Results() SeriesSet
	Length() int
}

type SimpleAggregationOp int

const (
	sumAggregation SimpleAggregationOp = iota
	minOverTimeAggregation
	maxOverTimeAggregation
	sumOverTimeAggregation
)

type SimpleAggregator struct {
	ss               SeriesSet
	exemplarBuckets  *bucketSet
	len              int
	aggregationFunc  func(existingValue float64, newValue float64) float64
	start, end, step uint64
	initWithNaN      bool
}

func NewSimpleCombiner(req *tempopb.QueryRangeRequest, op SimpleAggregationOp) *SimpleAggregator {
	l := IntervalCount(req.Start, req.End, req.Step)
	var initWithNaN bool
	var f func(existingValue float64, newValue float64) float64
	switch op {
	case minOverTimeAggregation:
		// Simple min aggregator. It calculates the minimum between existing values and a new sample
		f = minOverTime()
		initWithNaN = true
	case maxOverTimeAggregation:
		// Simple max aggregator. It calculates the maximum between existing values and a new sample
		f = maxOverTime()
		initWithNaN = true
	case sumOverTimeAggregation:
		f = sumOverTime()
		initWithNaN = true
	default:
		// Simple addition aggregator. It adds existing values with the new sample.
		f = func(existingValue float64, newValue float64) float64 { return existingValue + newValue }
		initWithNaN = false

	}
	return &SimpleAggregator{
		ss:              make(SeriesSet),
		exemplarBuckets: newBucketSet(l),
		len:             l,
		start:           req.Start,
		end:             req.End,
		step:            req.Step,
		aggregationFunc: f,
		initWithNaN:     initWithNaN,
	}
}

func (b *SimpleAggregator) Combine(in []*tempopb.TimeSeries) {
	nan := math.Float64frombits(normalNaN)

	for _, ts := range in {
		existing, ok := b.ss[ts.PromLabels]
		if !ok {
			// Convert proto labels to traceql labels
			labels := make(Labels, 0, len(ts.Labels))
			for _, l := range ts.Labels {
				labels = append(labels, Label{
					Name:  l.Key,
					Value: StaticFromAnyValue(l.Value),
				})
			}

			existing = TimeSeries{
				Labels:    labels,
				Values:    make([]float64, b.len),
				Exemplars: make([]Exemplar, 0, len(ts.Exemplars)),
			}
			if b.initWithNaN {
				for i := range existing.Values {
					existing.Values[i] = nan
				}
			}

			b.ss[ts.PromLabels] = existing
		}

		for _, sample := range ts.Samples {
			j := IntervalOfMs(sample.TimestampMs, b.start, b.end, b.step)
			if j >= 0 && j < len(existing.Values) {
				existing.Values[j] = b.aggregationFunc(existing.Values[j], sample.Value)
			}
		}

		b.aggregateExemplars(ts, &existing)

		b.ss[ts.PromLabels] = existing
	}
}

func (b *SimpleAggregator) aggregateExemplars(ts *tempopb.TimeSeries, existing *TimeSeries) {
	for _, exemplar := range ts.Exemplars {
		if b.exemplarBuckets.testTotal() {
			break
		}
		interval := IntervalOfMs(exemplar.TimestampMs, b.start, b.end, b.step)
		if b.exemplarBuckets.addAndTest(interval) {
			continue // Skip this exemplar and continue, next exemplar might fit in a different bucket	}
		}
		labels := make(Labels, 0, len(exemplar.Labels))
		for _, l := range exemplar.Labels {
			labels = append(labels, Label{
				Name:  l.Key,
				Value: StaticFromAnyValue(l.Value),
			})
		}
		existing.Exemplars = append(existing.Exemplars, Exemplar{
			Labels:      labels,
			Value:       exemplar.Value,
			TimestampMs: uint64(exemplar.TimestampMs),
		})
	}
}

func (b *SimpleAggregator) Results() SeriesSet {
	return b.ss
}

func (b *SimpleAggregator) Length() int {
	return len(b.ss)
}

type HistogramBucket struct {
	Max   float64
	Count int
}

type Histogram struct {
	Buckets []HistogramBucket
}

func (h *Histogram) Record(bucket float64, count int) {
	for i := range h.Buckets {
		if h.Buckets[i].Max == bucket {
			h.Buckets[i].Count += count
			return
		}
	}

	h.Buckets = append(h.Buckets, HistogramBucket{
		Max:   bucket,
		Count: count,
	})
}

type histSeries struct {
	labels Labels
	hist   []Histogram
}

type HistogramAggregator struct {
	ss               map[string]histSeries
	qs               []float64
	len              int
	start, end, step uint64
	exemplars        []Exemplar
	exemplarBuckets  *bucketSet
}

func NewHistogramAggregator(req *tempopb.QueryRangeRequest, qs []float64) *HistogramAggregator {
	l := IntervalCount(req.Start, req.End, req.Step)
	return &HistogramAggregator{
		qs:              qs,
		ss:              make(map[string]histSeries),
		len:             l,
		start:           req.Start,
		end:             req.End,
		step:            req.Step,
		exemplarBuckets: newBucketSet(l),
	}
}

func (h *HistogramAggregator) Combine(in []*tempopb.TimeSeries) {
	// var min, max time.Time

	for _, ts := range in {
		// Convert proto labels to traceql labels
		// while at the same time stripping the bucket label
		withoutBucket := make(Labels, 0, len(ts.Labels))
		var bucket Static
		for _, l := range ts.Labels {
			if l.Key == internalLabelBucket {
				// bucket = int(l.Value.GetIntValue())
				bucket = StaticFromAnyValue(l.Value)
				continue
			}
			withoutBucket = append(withoutBucket, Label{
				Name:  l.Key,
				Value: StaticFromAnyValue(l.Value),
			})
		}

		if bucket.Type == TypeNil {
			// Bad __bucket label?
			continue
		}

		withoutBucketStr := withoutBucket.String()

		existing, ok := h.ss[withoutBucketStr]
		if !ok {
			existing = histSeries{
				labels: withoutBucket,
				hist:   make([]Histogram, h.len),
			}
			h.ss[withoutBucketStr] = existing
		}

		b := bucket.Float()

		for _, sample := range ts.Samples {
			if sample.Value == 0 {
				continue
			}
			j := IntervalOfMs(sample.TimestampMs, h.start, h.end, h.step)
			if j >= 0 && j < len(existing.hist) {
				existing.hist[j].Record(b, int(sample.Value))
			}
		}

		for _, exemplar := range ts.Exemplars {
			if h.exemplarBuckets.testTotal() {
				break
			}
			interval := IntervalOfMs(exemplar.TimestampMs, h.start, h.end, h.step)
			if h.exemplarBuckets.addAndTest(interval) {
				continue // Skip this exemplar and continue, next exemplar might fit in a different bucket
			}

			labels := make(Labels, 0, len(exemplar.Labels))
			for _, l := range exemplar.Labels {
				labels = append(labels, Label{
					Name:  l.Key,
					Value: StaticFromAnyValue(l.Value),
				})
			}
			h.exemplars = append(h.exemplars, Exemplar{
				Labels:      labels,
				Value:       exemplar.Value,
				TimestampMs: uint64(exemplar.TimestampMs),
			})
		}
	}
}

func (h *HistogramAggregator) Results() SeriesSet {
	results := make(SeriesSet, len(h.ss)*len(h.qs))

	for _, in := range h.ss {
		// For each input series, we create a new series for each quantile.
		for _, q := range h.qs {
			// Append label for the quantile
			labels := append((Labels)(nil), in.labels...)
			labels = append(labels, Label{"p", NewStaticFloat(q)})
			s := labels.String()

			ts := TimeSeries{
				Labels:    labels,
				Values:    make([]float64, len(in.hist)),
				Exemplars: h.exemplars,
			}
			for i := range in.hist {

				buckets := in.hist[i].Buckets
				sort.Slice(buckets, func(i, j int) bool {
					return buckets[i].Max < buckets[j].Max
				})

				ts.Values[i] = Log2Quantile(q, buckets)
			}
			results[s] = ts
		}
	}
	return results
}

func (h *HistogramAggregator) Length() int {
	return len(h.ss) * len(h.qs)
}

// Log2Bucketize rounds the given value to the next powers-of-two bucket.
func Log2Bucketize(v uint64) float64 {
	if v < 2 {
		return -1
	}

	return math.Pow(2, math.Ceil(math.Log2(float64(v))))
}

// Log2Quantile returns the quantile given bucket labeled with float ranges and counts. Uses
// exponential power-of-two interpolation between buckets as needed.
func Log2Quantile(p float64, buckets []HistogramBucket) float64 {
	if math.IsNaN(p) ||
		p < 0 ||
		p > 1 ||
		len(buckets) == 0 {
		return 0
	}

	totalCount := 0
	for _, b := range buckets {
		totalCount += b.Count
	}

	if totalCount == 0 {
		return 0
	}

	// Maximum amount of samples to include. We round up to better handle
	// percentiles on low sample counts (<100).
	maxSamples := int(math.Ceil(p * float64(totalCount)))

	if maxSamples == 0 {
		// We have to read at least one sample.
		maxSamples = 1
	}

	// Find the bucket where the percentile falls in.
	var total, bucket int
	for i, b := range buckets {
		// Next bucket
		bucket = i

		// If we can't fully consume the samples in this bucket
		// then we are done.
		if total+b.Count > maxSamples {
			break
		}

		// Consume all samples in this bucket
		total += b.Count

		// p100 or happen to read the exact number of samples.
		// Quantile is the max range for the bucket. No reason
		// to enter interpolation below.
		if total == maxSamples {
			return b.Max
		}
	}

	// Fraction to interpolate between buckets, sample-count wise.
	// 0.5 means halfway
	interp := float64(maxSamples-total) / float64(buckets[bucket].Count)

	// Exponential interpolation between buckets
	// The current bucket represents the maximum value
	max := math.Log2(buckets[bucket].Max)
	var min float64
	if bucket > 0 {
		// Prior bucket represents the min
		min = math.Log2(buckets[bucket-1].Max)
	} else {
		// There is no prior bucket, assume powers of 2
		min = max - 1
	}
	mid := math.Pow(2, min+(max-min)*interp)
	return mid
}

var (
	_ SeriesAggregator = (*SimpleAggregator)(nil)
	_ SeriesAggregator = (*HistogramAggregator)(nil)
)

func FloatizeAttribute(s Span, a Attribute) (float64, StaticType) {
	v, ok := s.AttributeFor(a)
	if !ok {
		return 0, TypeNil
	}

	f := v.Float()
	if math.IsNaN(f) {
		return 0, TypeNil
	}
	return f, v.Type
}

// processTopK implements TopKBottomK topk method
func processTopK(input SeriesSet, valueLength, limit int) SeriesSet {
	result := make(SeriesSet)
	// Min heap for top-k (smallest values at top for easy replacement)
	h := &seriesHeap{}
	heap.Init(h)

	// process each timestamp
	for i := 0; i < valueLength; i++ {
		// process each series for this timestamp
		for key, series := range input {
			if i >= len(series.Values) {
				continue
			}

			value := series.Values[i]
			if math.IsNaN(value) {
				continue // Skip NaN values
			}

			// If heap not full yet, add the value
			if h.Len() < limit {
				heap.Push(h, seriesValue{
					key:   key,
					value: value,
				})
				continue
			}

			// If new value is greater than smallest in heap, replace it
			smallest := (*h)[0]
			if value > smallest.value {
				heap.Pop(h)
				heap.Push(h, seriesValue{
					key:   key,
					value: value,
				})
			}
		}

		// we have iterated over all series for this timestamp
		// empty the heap and record these series in result set
		for h.Len() > 0 {
			sv := heap.Pop(h).(seriesValue)
			initSeriesInResult(result, sv.key, input, valueLength)
			// Set only this timestamp's value
			result[sv.key].Values[i] = input[sv.key].Values[i]
		}
	}

	return result
}

// processBottomK implements TopKBottomK bottomk method
func processBottomK(input SeriesSet, valueLength, limit int) SeriesSet {
	result := make(SeriesSet)

	// Max heap for bottom-k (largest values at top for easy replacement)
	h := &reverseSeriesHeap{}
	heap.Init(h)

	// Process each timestamp
	for i := 0; i < valueLength; i++ {
		// Process each series for this timestamp
		for key, series := range input {
			if i >= len(series.Values) {
				continue
			}

			value := series.Values[i]
			if math.IsNaN(value) {
				continue // Skip NaN values
			}

			// If heap not full yet, add the value
			if h.Len() < limit {
				heap.Push(h, seriesValue{
					key:   key,
					value: value,
				})
				continue
			}

			// If new value is less than largest in heap, replace it
			largest := (*h)[0]
			if value < largest.value {
				heap.Pop(h)
				heap.Push(h, seriesValue{
					key:   key,
					value: value,
				})
			}
		}

		// we have iterated over all series for this timestamp
		// empty the heap and record these series in result set
		for h.Len() > 0 {
			sv := heap.Pop(h).(seriesValue)
			initSeriesInResult(result, sv.key, input, valueLength)
			// Set only this timestamp's value
			result[sv.key].Values[i] = input[sv.key].Values[i]
		}
	}

	return result
}

// initSeriesInResult ensures that a series exists in the result map, and
// initializes it with NaN values if it doesn't exist in the result set.
func initSeriesInResult(result SeriesSet, key string, input SeriesSet, valueLength int) {
	if _, exists := result[key]; exists {
		// series already exists, no need to initialize
		return
	}
	// series doesn't exist, initialize it
	// Copy the series labels and exemplars from the input
	result[key] = TimeSeries{
		Labels:    input[key].Labels,
		Values:    make([]float64, valueLength),
		Exemplars: input[key].Exemplars,
	}

	// Initialize all values to NaN because we only want to set values for this timestamp
	for j := range result[key].Values {
		result[key].Values[j] = math.NaN()
	}
}
