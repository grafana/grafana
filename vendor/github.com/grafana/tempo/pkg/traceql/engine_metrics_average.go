package traceql

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/grafana/tempo/pkg/tempopb"
	v1 "github.com/grafana/tempo/pkg/tempopb/common/v1"
	"github.com/prometheus/prometheus/model/labels"
)

// Average over time aggregator
type averageOverTimeAggregator struct {
	by   []Attribute
	attr Attribute
	// Average over time span aggregator
	agg SpanAggregator
	// Average over time series aggregator
	seriesAgg  SeriesAggregator
	exemplarFn getExemplar
	mode       AggregateMode
}

var _ firstStageElement = (*averageOverTimeAggregator)(nil)

func newAverageOverTimeMetricsAggregator(attr Attribute, by []Attribute) *averageOverTimeAggregator {
	return &averageOverTimeAggregator{
		attr: attr,
		by:   by,
	}
}

func (a *averageOverTimeAggregator) init(q *tempopb.QueryRangeRequest, mode AggregateMode) {
	a.seriesAgg = &averageOverTimeSeriesAggregator{
		weightedAverageSeries: make(map[string]*averageSeries),
		len:                   IntervalCount(q.Start, q.End, q.Step),
		start:                 q.Start,
		end:                   q.End,
		step:                  q.Step,
		exemplarBuckets:       newBucketSet(IntervalCount(q.Start, q.End, q.Step)),
	}

	if mode == AggregateModeRaw {
		a.agg = newAvgOverTimeSpanAggregator(a.attr, a.by, q.Start, q.End, q.Step)
	}

	a.mode = mode
	a.exemplarFn = exemplarFnFor(a.attr)
}

func (a *averageOverTimeAggregator) observe(span Span) {
	a.agg.Observe(span)
}

func (a *averageOverTimeAggregator) observeExemplar(span Span) {
	v, ts := a.exemplarFn(span)
	a.agg.ObserveExemplar(span, v, ts)
}

func (a *averageOverTimeAggregator) observeSeries(ss []*tempopb.TimeSeries) {
	a.seriesAgg.Combine(ss)
}

func (a *averageOverTimeAggregator) result() SeriesSet {
	if a.agg != nil {
		return a.agg.Series()
	}

	// In the frontend-version the results come from
	// the job-level aggregator
	ss := a.seriesAgg.Results()
	if a.mode == AggregateModeFinal {
		for i := range ss {
			if strings.Contains(i, internalLabelMetaType) {
				delete(ss, i)
			}
		}
	}
	return ss
}

func (a *averageOverTimeAggregator) length() int {
	if a.agg != nil {
		return a.agg.Length()
	}
	return a.seriesAgg.Length()
}

func (a *averageOverTimeAggregator) extractConditions(request *FetchSpansRequest) {
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

func (a *averageOverTimeAggregator) validate() error {
	if len(a.by) >= maxGroupBys {
		return newUnsupportedError(fmt.Sprintf("metrics group by %v values", len(a.by)))
	}
	return nil
}

func (a *averageOverTimeAggregator) String() string {
	s := strings.Builder{}

	s.WriteString(metricsAggregateAvgOverTime.String())
	s.WriteString("(")
	if a.attr != (Attribute{}) {
		s.WriteString(a.attr.String())
	}
	s.WriteString(")")

	if len(a.by) > 0 {
		s.WriteString("by(")
		for i, b := range a.by {
			s.WriteString(b.String())
			if i < len(a.by)-1 {
				s.WriteString(",")
			}
		}
		s.WriteString(")")
	}
	return s.String()
}

type averageOverTimeSeriesAggregator struct {
	weightedAverageSeries map[string]*averageSeries
	len                   int
	start, end, step      uint64
	exemplarBuckets       *bucketSet
}

type averageValue struct {
	mean         float64
	compensation float64
	weight       float64
}

// Adds an increment to the existing mean using Kahan sumnmation algorithm.
// The compensation is accumulated and not applied to reduce the error
func (a *averageValue) add(inc float64) {
	if math.IsInf(a.mean, 0) {
		if math.IsInf(inc, 0) && (a.mean > 0) == (inc > 0) {
			// The `mean` and `ic` values are `Inf` of the same sign.  They
			// can't be subtracted, but the value of `mean` is correct
			// already.
			return
		}
		if !math.IsInf(inc, 0) && !math.IsNaN(inc) {
			// At this stage, the mean is an infinite. If the added
			// value is neither an Inf or a Nan, we can keep that mean
			// value.
			return
		}
	}
	val, c := kahanSumInc(inc, a.mean, a.compensation)
	a.mean = val
	a.compensation = c
}

type averageSeries struct {
	values    []averageValue
	labels    Labels
	Exemplars []Exemplar
}

func newAverageSeries(l int, lenExemplars int, labels Labels) averageSeries {
	s := averageSeries{
		values:    make([]averageValue, l),
		labels:    labels,
		Exemplars: make([]Exemplar, 0, lenExemplars),
	}
	// Init to nan to discriminate uninitialized values from 0
	for i := range s.values {
		s.values[i].mean = nan
		s.values[i].weight = nan
	}
	return s
}

// it adds the compensation to the final value to retain precission
func (k *averageSeries) getAvgSeries() TimeSeries {
	ts := TimeSeries{
		Labels:    k.labels,
		Values:    make([]float64, len(k.values)),
		Exemplars: k.Exemplars,
	}

	for i, v := range k.values {
		ts.Values[i] = v.mean + v.compensation
	}
	return ts
}

func (k *averageSeries) getCountSeries() TimeSeries {
	countLabels := append(k.labels, Label{internalLabelMetaType, NewStaticString(internalMetaTypeCount)})
	ts := TimeSeries{
		Labels: countLabels,
		Values: make([]float64, len(k.values)),
	}
	for i, v := range k.values {
		ts.Values[i] = v.weight
	}
	return ts
}

// It increments the mean based on a new value
func (k *averageSeries) addIncrementMean(interval int, inc float64) {
	currentMean := k.values[interval]
	if math.IsNaN(currentMean.mean) && !math.IsNaN(inc) {
		k.values[interval] = averageValue{mean: inc, weight: 1}
		return
	}
	currentMean.weight++
	currentMean.add(inc/currentMean.weight - currentMean.mean/currentMean.weight)
	k.values[interval] = currentMean
}

// It calculates the incremental weighted mean using kahan-neumaier summation and a delta approach.
// By adding incremental values we prevent overflow
func (k *averageSeries) addWeigthedMean(interval int, mean float64, weight float64) {
	currentMean := k.values[interval]
	if math.IsNaN(currentMean.mean) && !math.IsNaN(mean) {
		k.values[interval] = averageValue{mean: mean, weight: weight}
		return
	}

	sumWeights := currentMean.weight + weight
	meanDelta := ((mean - currentMean.mean) * weight) / sumWeights
	meanDelta -= currentMean.compensation

	currentMean.add(meanDelta)
	k.values[interval] = currentMean
}

var (
	_   SeriesAggregator = (*averageOverTimeSeriesAggregator)(nil)
	nan                  = math.Float64frombits(normalNaN)
)

func (b *averageOverTimeSeriesAggregator) Combine(in []*tempopb.TimeSeries) {
	// We traverse the TimeSeries to initialize new TimeSeries and map the counter series with the position in the `in` array
	countPosMapper := make(map[string]int, len(in)/2)
	for i, ts := range in {
		_, ok := b.weightedAverageSeries[ts.PromLabels]
		if strings.Contains(ts.PromLabels, internalLabelMetaType) {
			// Label series without the count metatype, this will match with its average series
			avgSeriesPromLabel := getLabels(ts.Labels, internalLabelMetaType).String()
			// mapping of the position of the count series in the time series array
			countPosMapper[avgSeriesPromLabel] = i
		} else if !ok {
			promLabels := getLabels(ts.Labels, "")
			s := newAverageSeries(b.len, len(ts.Exemplars), promLabels)
			b.weightedAverageSeries[ts.PromLabels] = &s
		}
	}
	for _, ts := range in {
		existing, ok := b.weightedAverageSeries[ts.PromLabels]
		if !ok {
			// This is a counter series, we can skip it
			continue
		}
		for i, sample := range ts.Samples {
			pos := IntervalOfMs(sample.TimestampMs, b.start, b.end, b.step)
			if pos < 0 || pos >= len(b.weightedAverageSeries[ts.PromLabels].values) {
				continue
			}

			incomingMean := sample.Value
			incomingWeight := in[countPosMapper[ts.PromLabels]].Samples[i].Value
			existing.addWeigthedMean(pos, incomingMean, incomingWeight)
			b.aggregateExemplars(ts, b.weightedAverageSeries[ts.PromLabels])
		}
	}
}

func (b *averageOverTimeSeriesAggregator) aggregateExemplars(ts *tempopb.TimeSeries, existing *averageSeries) {
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
		value := exemplar.Value
		if math.IsNaN(value) {
			value = 0 // TODO: Use the value of the series at the same timestamp
		}
		existing.Exemplars = append(existing.Exemplars, Exemplar{
			Labels:      labels,
			Value:       value,
			TimestampMs: uint64(exemplar.TimestampMs),
		})
	}
}

func getLabels(vals []v1.KeyValue, skipKey string) Labels {
	labels := make(Labels, 0, len(vals))
	for _, l := range vals {
		if skipKey != "" && l.Key == skipKey {
			continue
		}
		labels = append(labels, Label{
			Name:  l.Key,
			Value: StaticFromAnyValue(l.Value),
		})
	}
	return labels
}

func (b *averageOverTimeSeriesAggregator) Results() SeriesSet {
	ss := SeriesSet{}
	for k, v := range b.weightedAverageSeries {
		ss[k] = v.getAvgSeries()
		countSeries := v.getCountSeries()
		ss[countSeries.Labels.String()] = countSeries
	}
	return ss
}

func (b *averageOverTimeSeriesAggregator) Length() int {
	return len(b.weightedAverageSeries)
}

// Accumulated results of average over time
type avgOverTimeSeries[S StaticVals] struct {
	average         averageSeries
	exemplarBuckets *bucketSet
	vals            S
	initialized     bool
}

// In charge of calculating the average over time for a set of spans
// First aggregation layer
type avgOverTimeSpanAggregator[F FastStatic, S StaticVals] struct {
	// Config
	by              []Attribute   // Original attributes: .foo
	byLookups       [][]Attribute // Lookups: span.foo resource.foo
	getSpanAttValue func(s Span) float64
	start           uint64
	end             uint64
	step            uint64

	// Data
	series     map[F]avgOverTimeSeries[S]
	lastSeries avgOverTimeSeries[S]
	buf        fastStaticWithValues[F, S]
	lastBuf    fastStaticWithValues[F, S]
}

var _ SpanAggregator = (*avgOverTimeSpanAggregator[FastStatic1, StaticVals1])(nil)

func newAvgOverTimeSpanAggregator(attr Attribute, by []Attribute, start, end, step uint64) SpanAggregator {
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

	switch aggNum {
	case 2:
		return newAvgAggregator[FastStatic2, StaticVals2](attr, by, lookups, start, end, step)
	case 3:
		return newAvgAggregator[FastStatic3, StaticVals3](attr, by, lookups, start, end, step)
	case 4:
		return newAvgAggregator[FastStatic4, StaticVals4](attr, by, lookups, start, end, step)
	case 5:
		return newAvgAggregator[FastStatic5, StaticVals5](attr, by, lookups, start, end, step)
	default:
		return newAvgAggregator[FastStatic1, StaticVals1](attr, by, lookups, start, end, step)
	}
}

func newAvgAggregator[F FastStatic, S StaticVals](attr Attribute, by []Attribute, lookups [][]Attribute, start, end, step uint64) SpanAggregator {
	var fn func(s Span) float64

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

	return &avgOverTimeSpanAggregator[F, S]{
		series:          map[F]avgOverTimeSeries[S]{},
		getSpanAttValue: fn,
		by:              by,
		byLookups:       lookups,
		start:           start,
		end:             end,
		step:            step,
	}
}

func (g *avgOverTimeSpanAggregator[F, S]) Observe(span Span) {
	interval := IntervalOf(span.StartTimeUnixNanos(), g.start, g.end, g.step)
	if interval == -1 {
		return
	}

	inc := g.getSpanAttValue(span)
	if math.IsNaN(inc) {
		return
	}

	s := g.getSeries(span)
	s.average.addIncrementMean(interval, inc)
}

func (g *avgOverTimeSpanAggregator[F, S]) ObserveExemplar(span Span, value float64, ts uint64) {
	s := g.getSeries(span)
	if s.exemplarBuckets.testTotal() {
		return
	}
	interval := IntervalOfMs(int64(ts), g.start, g.end, g.step)
	if s.exemplarBuckets.addAndTest(interval) {
		return
	}

	all := span.AllAttributes()
	lbls := make(Labels, 0, len(all))
	for k, v := range span.AllAttributes() {
		lbls = append(lbls, Label{k.String(), v})
	}

	s.average.Exemplars = append(s.average.Exemplars, Exemplar{
		Labels:      lbls,
		Value:       value,
		TimestampMs: ts,
	})
	g.series[g.buf.fast] = s
}

func (g *avgOverTimeSpanAggregator[F, S]) Length() int {
	return len(g.series)
}

func (g *avgOverTimeSpanAggregator[F, S]) labelsFor(vals S) (Labels, string) {
	if g.by == nil {
		serieLabel := make(Labels, 1, 2)
		serieLabel[0] = Label{labels.MetricName, NewStaticString(metricsAggregateAvgOverTime.String())}
		return serieLabel, serieLabel.String()
	}
	labels := make(Labels, 0, len(g.by)+1)
	for i := range g.by {
		if vals[i].Type == TypeNil {
			continue
		}
		labels = append(labels, Label{g.by[i].String(), vals[i]})
	}

	if len(labels) == 0 {
		// When all nil then force one
		labels = append(labels, Label{g.by[0].String(), NewStaticNil()})
	}

	return labels, labels.String()
}

func (g *avgOverTimeSpanAggregator[F, S]) Series() SeriesSet {
	ss := SeriesSet{}

	for _, s := range g.series {
		labels, promLabelsAvg := g.labelsFor(s.vals)
		s.average.labels = labels
		// Average series
		averageSeries := s.average.getAvgSeries()
		// Count series
		countSeries := s.average.getCountSeries()

		ss[promLabelsAvg] = averageSeries
		ss[countSeries.Labels.String()] = countSeries
	}

	return ss
}

// getSeries gets the series for the current span.
// It will reuse the last series if possible.
func (g *avgOverTimeSpanAggregator[F, S]) getSeries(span Span) avgOverTimeSeries[S] {
	// Get Grouping values
	for i, lookups := range g.byLookups {
		val := lookup(lookups, span)
		g.buf.vals[i] = val
		g.buf.fast[i] = val.MapKey()
	}

	// Fast path
	if g.lastBuf.fast == g.buf.fast && g.lastSeries.initialized {
		return g.lastSeries
	}

	s, ok := g.series[g.buf.fast]
	if !ok {
		intervals := IntervalCount(g.start, g.end, g.step)
		s = avgOverTimeSeries[S]{
			vals:            g.buf.vals,
			average:         newAverageSeries(intervals, maxExemplars, nil),
			exemplarBuckets: newBucketSet(intervals),
			initialized:     true,
		}
		g.series[g.buf.fast] = s
	}

	g.lastBuf = g.buf
	g.lastSeries = s
	return s
}
