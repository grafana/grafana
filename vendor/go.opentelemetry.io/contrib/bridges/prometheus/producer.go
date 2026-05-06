// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package prometheus // import "go.opentelemetry.io/contrib/bridges/prometheus"

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/instrumentation"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
)

const (
	scopeName    = "go.opentelemetry.io/contrib/bridges/prometheus"
	traceIDLabel = "trace_id"
	spanIDLabel  = "span_id"
)

var (
	errUnsupportedType = errors.New("unsupported metric type")
	processStartTime   = time.Now()
)

type producer struct {
	gatherers prometheus.Gatherers
}

// NewMetricProducer returns a metric.Producer that fetches metrics from
// Prometheus. This can be used to allow Prometheus instrumentation to be
// added to an OpenTelemetry export pipeline.
func NewMetricProducer(opts ...Option) metric.Producer {
	cfg := newConfig(opts...)
	return &producer{
		gatherers: cfg.gatherers,
	}
}

func (p *producer) Produce(context.Context) ([]metricdata.ScopeMetrics, error) {
	now := time.Now()
	var errs multierr
	otelMetrics := make([]metricdata.Metrics, 0)
	for _, gatherer := range p.gatherers {
		promMetrics, err := gatherer.Gather()
		if err != nil {
			errs = append(errs, err)
			continue
		}
		m, err := convertPrometheusMetricsInto(promMetrics, now)
		otelMetrics = append(otelMetrics, m...)
		if err != nil {
			errs = append(errs, err)
		}
	}
	if errs.errOrNil() != nil {
		otel.Handle(errs.errOrNil())
	}
	if len(otelMetrics) == 0 {
		return nil, nil
	}
	return []metricdata.ScopeMetrics{{
		Scope: instrumentation.Scope{
			Name: scopeName,
		},
		Metrics: otelMetrics,
	}}, nil
}

func convertPrometheusMetricsInto(promMetrics []*dto.MetricFamily, now time.Time) ([]metricdata.Metrics, error) {
	var errs multierr
	otelMetrics := make([]metricdata.Metrics, 0)
	for _, pm := range promMetrics {
		if len(pm.GetMetric()) == 0 {
			// This shouldn't ever happen
			continue
		}
		newMetric := metricdata.Metrics{
			Name:        pm.GetName(),
			Description: pm.GetHelp(),
		}
		switch pm.GetType() {
		case dto.MetricType_GAUGE:
			newMetric.Data = convertGauge(pm.GetMetric(), now)
		case dto.MetricType_COUNTER:
			newMetric.Data = convertCounter(pm.GetMetric(), now)
		case dto.MetricType_SUMMARY:
			newMetric.Data = convertSummary(pm.GetMetric(), now)
		case dto.MetricType_HISTOGRAM:
			if isExponentialHistogram(pm.GetMetric()[0].GetHistogram()) {
				newMetric.Data = convertExponentialHistogram(pm.GetMetric(), now)
			} else {
				newMetric.Data = convertHistogram(pm.GetMetric(), now)
			}
		default:
			// MetricType_GAUGE_HISTOGRAM, MetricType_UNTYPED
			errs = append(errs, fmt.Errorf("%w: %v for metric %v", errUnsupportedType, pm.GetType(), pm.GetName()))
			continue
		}
		otelMetrics = append(otelMetrics, newMetric)
	}
	return otelMetrics, errs.errOrNil()
}

func isExponentialHistogram(hist *dto.Histogram) bool {
	// The prometheus go client ensures at least one of these is non-zero
	// so it can be distinguished from a fixed-bucket histogram.
	// https://github.com/prometheus/client_golang/blob/7ac90362b02729a65109b33d172bafb65d7dab50/prometheus/histogram.go#L818
	return hist.GetZeroThreshold() > 0 ||
		hist.GetZeroCount() > 0 ||
		len(hist.GetPositiveSpan()) > 0 ||
		len(hist.GetNegativeSpan()) > 0
}

func convertGauge(metrics []*dto.Metric, now time.Time) metricdata.Gauge[float64] {
	otelGauge := metricdata.Gauge[float64]{
		DataPoints: make([]metricdata.DataPoint[float64], len(metrics)),
	}
	for i, m := range metrics {
		dp := metricdata.DataPoint[float64]{
			Attributes: convertLabels(m.GetLabel()),
			Time:       now,
			Value:      m.GetGauge().GetValue(),
		}
		if m.GetTimestampMs() != 0 {
			dp.Time = time.UnixMilli(m.GetTimestampMs())
		}
		otelGauge.DataPoints[i] = dp
	}
	return otelGauge
}

func convertCounter(metrics []*dto.Metric, now time.Time) metricdata.Sum[float64] {
	otelCounter := metricdata.Sum[float64]{
		DataPoints:  make([]metricdata.DataPoint[float64], len(metrics)),
		Temporality: metricdata.CumulativeTemporality,
		IsMonotonic: true,
	}
	for i, m := range metrics {
		dp := metricdata.DataPoint[float64]{
			Attributes: convertLabels(m.GetLabel()),
			StartTime:  processStartTime,
			Time:       now,
			Value:      m.GetCounter().GetValue(),
		}
		if ex := m.GetCounter().GetExemplar(); ex != nil {
			dp.Exemplars = []metricdata.Exemplar[float64]{convertExemplar(ex)}
		}
		createdTs := m.GetCounter().GetCreatedTimestamp()
		if createdTs.IsValid() {
			dp.StartTime = createdTs.AsTime()
		}
		if m.GetTimestampMs() != 0 {
			dp.Time = time.UnixMilli(m.GetTimestampMs())
		}
		otelCounter.DataPoints[i] = dp
	}
	return otelCounter
}

func convertExponentialHistogram(metrics []*dto.Metric, now time.Time) metricdata.ExponentialHistogram[float64] {
	otelExpHistogram := metricdata.ExponentialHistogram[float64]{
		DataPoints:  make([]metricdata.ExponentialHistogramDataPoint[float64], len(metrics)),
		Temporality: metricdata.CumulativeTemporality,
	}
	for i, m := range metrics {
		dp := metricdata.ExponentialHistogramDataPoint[float64]{
			Attributes:    convertLabels(m.GetLabel()),
			StartTime:     processStartTime,
			Time:          now,
			Count:         m.GetHistogram().GetSampleCount(),
			Sum:           m.GetHistogram().GetSampleSum(),
			Scale:         m.GetHistogram().GetSchema(),
			ZeroCount:     m.GetHistogram().GetZeroCount(),
			ZeroThreshold: m.GetHistogram().GetZeroThreshold(),
			PositiveBucket: convertExponentialBuckets(
				m.GetHistogram().GetPositiveSpan(),
				m.GetHistogram().GetPositiveDelta(),
			),
			NegativeBucket: convertExponentialBuckets(
				m.GetHistogram().GetNegativeSpan(),
				m.GetHistogram().GetNegativeDelta(),
			),
			// TODO: Support exemplars
		}
		createdTs := m.GetHistogram().GetCreatedTimestamp()
		if createdTs.IsValid() {
			dp.StartTime = createdTs.AsTime()
		}
		if t := m.GetTimestampMs(); t != 0 {
			dp.Time = time.UnixMilli(t)
		}
		otelExpHistogram.DataPoints[i] = dp
	}
	return otelExpHistogram
}

func convertExponentialBuckets(bucketSpans []*dto.BucketSpan, deltas []int64) metricdata.ExponentialBucket {
	if len(bucketSpans) == 0 {
		return metricdata.ExponentialBucket{}
	}
	// Prometheus Native Histograms buckets are indexed by upper boundary
	// while Exponential Histograms are indexed by lower boundary, the result
	// being that the Offset fields are different-by-one.
	initialOffset := bucketSpans[0].GetOffset() - 1
	// We will have one bucket count for each delta, and zeros for the offsets
	// after the initial offset.
	lenCounts := len(deltas)
	for i, bs := range bucketSpans {
		if i != 0 {
			lenCounts += int(bs.GetOffset())
		}
	}
	counts := make([]uint64, lenCounts)
	deltaIndex := 0
	countIndex := int32(0)
	count := int64(0)
	for i, bs := range bucketSpans {
		// Do not insert zeroes if this is the first bucketSpan, since those
		// zeroes are accounted for in the Offset field.
		if i != 0 {
			// Increase the count index by the Offset to insert Offset zeroes
			countIndex += bs.GetOffset()
		}
		for j := uint32(0); j < bs.GetLength(); j++ {
			// Convert deltas to the cumulative number of observations
			count += deltas[deltaIndex]
			deltaIndex++
			// count should always be positive after accounting for deltas
			if count > 0 {
				counts[countIndex] = uint64(count)
			}
			countIndex++
		}
	}
	return metricdata.ExponentialBucket{
		Offset: initialOffset,
		Counts: counts,
	}
}

func convertHistogram(metrics []*dto.Metric, now time.Time) metricdata.Histogram[float64] {
	otelHistogram := metricdata.Histogram[float64]{
		DataPoints:  make([]metricdata.HistogramDataPoint[float64], len(metrics)),
		Temporality: metricdata.CumulativeTemporality,
	}
	for i, m := range metrics {
		bounds, bucketCounts, exemplars := convertBuckets(m.GetHistogram().GetBucket(), m.GetHistogram().GetSampleCount())
		dp := metricdata.HistogramDataPoint[float64]{
			Attributes:   convertLabels(m.GetLabel()),
			StartTime:    processStartTime,
			Time:         now,
			Count:        m.GetHistogram().GetSampleCount(),
			Sum:          m.GetHistogram().GetSampleSum(),
			Bounds:       bounds,
			BucketCounts: bucketCounts,
			Exemplars:    exemplars,
		}
		createdTs := m.GetHistogram().GetCreatedTimestamp()
		if createdTs.IsValid() {
			dp.StartTime = createdTs.AsTime()
		}
		if m.GetTimestampMs() != 0 {
			dp.Time = time.UnixMilli(m.GetTimestampMs())
		}
		otelHistogram.DataPoints[i] = dp
	}
	return otelHistogram
}

func convertBuckets(buckets []*dto.Bucket, sampleCount uint64) ([]float64, []uint64, []metricdata.Exemplar[float64]) {
	if len(buckets) == 0 {
		// This should never happen
		return nil, nil, nil
	}
	// buckets will only include the +Inf bucket if there is an exemplar for it
	// https://github.com/prometheus/client_golang/blob/d038ab96c0c7b9cd217a39072febd610bcdf1fd8/prometheus/metric.go#L189
	// we need to handle the case where it is present, or where it is missing.
	hasInf := math.IsInf(buckets[len(buckets)-1].GetUpperBound(), +1)
	var bounds []float64
	var bucketCounts []uint64
	if hasInf {
		bounds = make([]float64, len(buckets)-1)
		bucketCounts = make([]uint64, len(buckets))
	} else {
		bounds = make([]float64, len(buckets))
		bucketCounts = make([]uint64, len(buckets)+1)
	}
	exemplars := make([]metricdata.Exemplar[float64], 0)
	var previousCount uint64
	for i, bucket := range buckets {
		// The last bound may be the +Inf bucket, which is implied in OTel, but
		// is explicit in Prometheus. Skip the last boundary if it is the +Inf
		// bound.
		if bound := bucket.GetUpperBound(); !math.IsInf(bound, +1) {
			bounds[i] = bound
		}
		previousCount, bucketCounts[i] = bucket.GetCumulativeCount(), bucket.GetCumulativeCount()-previousCount
		if ex := bucket.GetExemplar(); ex != nil {
			exemplars = append(exemplars, convertExemplar(ex))
		}
	}
	if !hasInf {
		// The Inf bucket was missing, so set the last bucket counts to the
		// overall count
		bucketCounts[len(bucketCounts)-1] = sampleCount - previousCount
	}
	return bounds, bucketCounts, exemplars
}

func convertSummary(metrics []*dto.Metric, now time.Time) metricdata.Summary {
	otelSummary := metricdata.Summary{
		DataPoints: make([]metricdata.SummaryDataPoint, len(metrics)),
	}
	for i, m := range metrics {
		dp := metricdata.SummaryDataPoint{
			Attributes:     convertLabels(m.GetLabel()),
			StartTime:      processStartTime,
			Time:           now,
			Count:          m.GetSummary().GetSampleCount(),
			Sum:            m.GetSummary().GetSampleSum(),
			QuantileValues: convertQuantiles(m.GetSummary().GetQuantile()),
		}
		createdTs := m.GetSummary().GetCreatedTimestamp()
		if createdTs.IsValid() {
			dp.StartTime = createdTs.AsTime()
		}
		if t := m.GetTimestampMs(); t != 0 {
			dp.Time = time.UnixMilli(t)
		}
		otelSummary.DataPoints[i] = dp
	}
	return otelSummary
}

func convertQuantiles(quantiles []*dto.Quantile) []metricdata.QuantileValue {
	otelQuantiles := make([]metricdata.QuantileValue, len(quantiles))
	for i, quantile := range quantiles {
		dp := metricdata.QuantileValue{
			Quantile: quantile.GetQuantile(),
			Value:    quantile.GetValue(),
		}
		otelQuantiles[i] = dp
	}
	return otelQuantiles
}

func convertLabels(labels []*dto.LabelPair) attribute.Set {
	kvs := make([]attribute.KeyValue, len(labels))
	for i, l := range labels {
		kvs[i] = attribute.String(l.GetName(), l.GetValue())
	}
	return attribute.NewSet(kvs...)
}

func convertExemplar(exemplar *dto.Exemplar) metricdata.Exemplar[float64] {
	attrs := make([]attribute.KeyValue, 0)
	var traceID, spanID []byte
	// find the trace ID and span ID in attributes, if it exists
	for _, label := range exemplar.GetLabel() {
		if label.GetName() == traceIDLabel {
			traceID = []byte(label.GetValue())
		} else if label.GetName() == spanIDLabel {
			spanID = []byte(label.GetValue())
		} else {
			attrs = append(attrs, attribute.String(label.GetName(), label.GetValue()))
		}
	}
	return metricdata.Exemplar[float64]{
		Value:              exemplar.GetValue(),
		Time:               exemplar.GetTimestamp().AsTime(),
		TraceID:            traceID,
		SpanID:             spanID,
		FilteredAttributes: attrs,
	}
}

type multierr []error

func (e multierr) errOrNil() error {
	if len(e) == 0 {
		return nil
	} else if len(e) == 1 {
		return e[0]
	}
	return e
}

func (e multierr) Error() string {
	es := make([]string, len(e))
	for i, err := range e {
		es[i] = fmt.Sprintf("* %s", err)
	}
	return strings.Join(es, "\n\t")
}
