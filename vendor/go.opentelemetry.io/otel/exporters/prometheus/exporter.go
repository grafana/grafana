// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package prometheus // import "go.opentelemetry.io/otel/exporters/prometheus"

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/otlptranslator"
	"google.golang.org/protobuf/proto"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/prometheus/internal/counter"
	"go.opentelemetry.io/otel/exporters/prometheus/internal/observ"
	"go.opentelemetry.io/otel/internal/global"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	"go.opentelemetry.io/otel/sdk/resource"
)

const (
	targetInfoDescription = "Target metadata"

	scopeLabelPrefix  = "otel_scope_"
	scopeNameLabel    = scopeLabelPrefix + "name"
	scopeVersionLabel = scopeLabelPrefix + "version"
	scopeSchemaLabel  = scopeLabelPrefix + "schema_url"
)

var metricsPool = sync.Pool{
	New: func() any {
		return &metricdata.ResourceMetrics{}
	},
}

// Exporter is a Prometheus Exporter that embeds the OTel metric.Reader
// interface for easy instantiation with a MeterProvider.
type Exporter struct {
	metric.Reader
}

// MarshalLog returns logging data about the Exporter.
func (e *Exporter) MarshalLog() any {
	const t = "Prometheus exporter"

	if r, ok := e.Reader.(*metric.ManualReader); ok {
		under := r.MarshalLog()
		if data, ok := under.(struct {
			Type       string
			Registered bool
			Shutdown   bool
		}); ok {
			data.Type = t
			return data
		}
	}

	return struct{ Type string }{Type: t}
}

var _ metric.Reader = &Exporter{}

// keyVals is used to store resource attribute key value pairs.
type keyVals struct {
	keys []string
	vals []string
}

// collector is used to implement prometheus.Collector.
type collector struct {
	reader metric.Reader

	withoutUnits             bool
	withoutCounterSuffixes   bool
	disableScopeInfo         bool
	namespace                string
	resourceAttributesFilter attribute.Filter

	mu                sync.Mutex // mu protects all members below from the concurrent access.
	disableTargetInfo bool
	targetInfo        prometheus.Metric
	metricFamilies    map[string]*dto.MetricFamily
	resourceKeyVals   keyVals
	metricNamer       otlptranslator.MetricNamer
	labelNamer        otlptranslator.LabelNamer
	unitNamer         otlptranslator.UnitNamer

	inst *observ.Instrumentation
}

// New returns a Prometheus Exporter.
func New(opts ...Option) (*Exporter, error) {
	cfg := newConfig(opts...)

	// this assumes that the default temporality selector will always return cumulative.
	// we only support cumulative temporality, so building our own reader enforces this.
	// TODO (#3244): Enable some way to configure the reader, but not change temporality.
	reader := metric.NewManualReader(cfg.readerOpts...)

	labelNamer := otlptranslator.LabelNamer{UTF8Allowed: !cfg.translationStrategy.ShouldEscape()}
	escapedNamespace := cfg.namespace
	if escapedNamespace != "" {
		var err error
		// If the namespace needs to be escaped, do that now when creating the new
		// Collector object. The escaping is not persisted in the Config itself.
		escapedNamespace, err = labelNamer.Build(escapedNamespace)
		if err != nil {
			return nil, err
		}
	}

	collector := &collector{
		reader:                   reader,
		disableTargetInfo:        cfg.disableTargetInfo,
		withoutUnits:             cfg.withoutUnits,
		withoutCounterSuffixes:   cfg.withoutCounterSuffixes,
		disableScopeInfo:         cfg.disableScopeInfo,
		metricFamilies:           make(map[string]*dto.MetricFamily),
		namespace:                escapedNamespace,
		resourceAttributesFilter: cfg.resourceAttributesFilter,
		metricNamer:              otlptranslator.NewMetricNamer(escapedNamespace, cfg.translationStrategy),
		unitNamer:                otlptranslator.UnitNamer{UTF8Allowed: !cfg.translationStrategy.ShouldEscape()},
		labelNamer:               labelNamer,
	}

	if err := cfg.registerer.Register(collector); err != nil {
		return nil, fmt.Errorf("cannot register the collector: %w", err)
	}

	e := &Exporter{
		Reader: reader,
	}

	var err error
	collector.inst, err = observ.NewInstrumentation(counter.NextExporterID())

	return e, err
}

// Describe implements prometheus.Collector.
func (*collector) Describe(chan<- *prometheus.Desc) {
	// The Opentelemetry SDK doesn't have information on which will exist when the collector
	// is registered. By returning nothing we are an "unchecked" collector in Prometheus,
	// and assume responsibility for consistency of the metrics produced.
	//
	// See https://pkg.go.dev/github.com/prometheus/client_golang@v1.13.0/prometheus#hdr-Custom_Collectors_and_constant_Metrics
}

// Collect implements prometheus.Collector.
//
// This method is safe to call concurrently.
func (c *collector) Collect(ch chan<- prometheus.Metric) {
	var err error
	// Blocked by this issue: Propagate context.Context through Gather and Collect (#1538)
	// https://github.com/prometheus/client_golang/issues/1538.
	ctx := context.TODO()

	if c.inst != nil {
		timer := c.inst.RecordOperationDuration(ctx)
		defer func() { timer.Stop(err) }()
	}

	metrics := metricsPool.Get().(*metricdata.ResourceMetrics)
	defer metricsPool.Put(metrics)

	endCollection := func(error) {}
	if c.inst != nil {
		endCollection = c.inst.RecordCollectionDuration(ctx).Stop
	}
	err = c.reader.Collect(ctx, metrics)
	endCollection(err)

	if err != nil {
		if errors.Is(err, metric.ErrReaderShutdown) {
			return
		}
		otel.Handle(err)
		if errors.Is(err, metric.ErrReaderNotRegistered) {
			return
		}
	}

	global.Debug("Prometheus exporter export", "Data", metrics)

	// Initialize (once) targetInfo and disableTargetInfo.
	func() {
		c.mu.Lock()
		defer c.mu.Unlock()

		if c.targetInfo == nil && !c.disableTargetInfo {
			targetInfo, e := c.createInfoMetric(
				otlptranslator.TargetInfoMetricName,
				targetInfoDescription,
				metrics.Resource,
			)
			if e != nil {
				// If the target info metric is invalid, disable sending it.
				c.disableTargetInfo = true
				otel.Handle(e)
				err = errors.Join(err, fmt.Errorf("failed to createInfoMetric: %w", e))
				return
			}

			c.targetInfo = targetInfo
		}
	}()

	if !c.disableTargetInfo {
		ch <- c.targetInfo
	}

	if c.resourceAttributesFilter != nil && len(c.resourceKeyVals.keys) == 0 {
		e := c.createResourceAttributes(metrics.Resource)
		if e != nil {
			otel.Handle(e)
			err = errors.Join(err, fmt.Errorf("failed to createResourceAttributes: %w", e))
			return
		}
	}

	for j, scopeMetrics := range metrics.ScopeMetrics {
		n := len(c.resourceKeyVals.keys) + 2 // resource attrs + scope name + scope version
		kv := keyVals{
			keys: make([]string, 0, n),
			vals: make([]string, 0, n),
		}

		if !c.disableScopeInfo {
			kv.keys = append(kv.keys, scopeNameLabel, scopeVersionLabel, scopeSchemaLabel)
			kv.vals = append(kv.vals, scopeMetrics.Scope.Name, scopeMetrics.Scope.Version, scopeMetrics.Scope.SchemaURL)

			attrKeys, attrVals, e := getAttrs(scopeMetrics.Scope.Attributes, c.labelNamer)
			if e != nil {
				reportError(ch, nil, e)
				err = errors.Join(err, fmt.Errorf("failed to getAttrs for ScopeMetrics %d: %w", j, e))
				continue
			}
			for i := range attrKeys {
				attrKeys[i] = scopeLabelPrefix + attrKeys[i]
			}
			kv.keys = append(kv.keys, attrKeys...)
			kv.vals = append(kv.vals, attrVals...)
		}

		kv.keys = append(kv.keys, c.resourceKeyVals.keys...)
		kv.vals = append(kv.vals, c.resourceKeyVals.vals...)

		for k, m := range scopeMetrics.Metrics {
			typ := c.metricType(m)
			if typ == nil {
				reportError(ch, nil, errInvalidMetricType)
				continue
			}
			name, e := c.getName(m)
			if e != nil {
				reportError(ch, nil, e)
				err = errors.Join(err, fmt.Errorf("failed to getAttrs for ScopeMetrics %d, Metrics %d: %w", j, k, e))
				continue
			}

			drop, help := c.validateMetrics(name, m.Description, typ)
			if drop {
				reportError(ch, nil, errInvalidMetric)
				continue
			}

			if help != "" {
				m.Description = help
			}

			switch v := m.Data.(type) {
			case metricdata.Histogram[int64]:
				addHistogramMetric(ch, v, m, name, kv, c.labelNamer, c.inst, ctx)
			case metricdata.Histogram[float64]:
				addHistogramMetric(ch, v, m, name, kv, c.labelNamer, c.inst, ctx)
			case metricdata.ExponentialHistogram[int64]:
				addExponentialHistogramMetric(ch, v, m, name, kv, c.labelNamer, c.inst, ctx)
			case metricdata.ExponentialHistogram[float64]:
				addExponentialHistogramMetric(ch, v, m, name, kv, c.labelNamer, c.inst, ctx)
			case metricdata.Sum[int64]:
				addSumMetric(ch, v, m, name, kv, c.labelNamer, c.inst, ctx)
			case metricdata.Sum[float64]:
				addSumMetric(ch, v, m, name, kv, c.labelNamer, c.inst, ctx)
			case metricdata.Gauge[int64]:
				addGaugeMetric(ch, v, m, name, kv, c.labelNamer, c.inst, ctx)
			case metricdata.Gauge[float64]:
				addGaugeMetric(ch, v, m, name, kv, c.labelNamer, c.inst, ctx)
			}
		}
	}
}

// downscaleExponentialBucket re-aggregates bucket counts when downscaling to a coarser resolution.
func downscaleExponentialBucket(bucket metricdata.ExponentialBucket, scaleDelta int32) metricdata.ExponentialBucket {
	if len(bucket.Counts) == 0 || scaleDelta < 1 {
		return metricdata.ExponentialBucket{
			Offset: bucket.Offset >> scaleDelta,
			Counts: append([]uint64(nil), bucket.Counts...), // copy slice
		}
	}

	// The new offset is scaled down
	newOffset := bucket.Offset >> scaleDelta

	// Pre-calculate the new bucket count to avoid growing slice
	// Each group of 2^scaleDelta buckets will merge into one bucket
	//nolint:gosec // Length is bounded by slice allocation
	lastBucketIdx := bucket.Offset + int32(len(bucket.Counts)) - 1
	lastNewIdx := lastBucketIdx >> scaleDelta
	newBucketCount := int(lastNewIdx - newOffset + 1)

	if newBucketCount <= 0 {
		return metricdata.ExponentialBucket{
			Offset: newOffset,
			Counts: []uint64{},
		}
	}

	newCounts := make([]uint64, newBucketCount)

	// Merge buckets according to the scale difference
	for i, count := range bucket.Counts {
		if count == 0 {
			continue
		}

		// Calculate which new bucket this count belongs to
		//nolint:gosec // Index is bounded by loop iteration
		originalIdx := bucket.Offset + int32(i)
		newIdx := originalIdx >> scaleDelta

		// Calculate the position in the new counts array
		position := newIdx - newOffset
		//nolint:gosec // Length is bounded by allocation
		if position >= 0 && position < int32(len(newCounts)) {
			newCounts[position] += count
		}
	}

	return metricdata.ExponentialBucket{
		Offset: newOffset,
		Counts: newCounts,
	}
}

func addExponentialHistogramMetric[N int64 | float64](
	ch chan<- prometheus.Metric,
	histogram metricdata.ExponentialHistogram[N],
	m metricdata.Metrics,
	name string,
	kv keyVals,
	labelNamer otlptranslator.LabelNamer,
	inst *observ.Instrumentation,
	ctx context.Context,
) {
	var err error
	var success int64
	if inst != nil {
		op := inst.ExportMetrics(ctx, int64(len(histogram.DataPoints)))
		defer func() { op.End(success, err) }()
	}

	for j, dp := range histogram.DataPoints {
		keys, values, e := getAttrs(dp.Attributes, labelNamer)
		if e != nil {
			reportError(ch, nil, e)
			err = errors.Join(err, fmt.Errorf("failed to getAttrs for histogram.DataPoints %d: %w", j, e))
			continue
		}
		keys = append(keys, kv.keys...)
		values = append(values, kv.vals...)

		desc := prometheus.NewDesc(name, m.Description, keys, nil)

		// Prometheus native histograms support scales in the range [-4, 8]
		scale := dp.Scale
		if scale < -4 {
			// Reject scales below -4 as they cannot be represented in Prometheus
			reportError(
				ch,
				desc,
				fmt.Errorf("%w: %d (min -4)", errEHScaleBelowMin, scale),
			)
			err = errors.Join(err, e)
			continue
		}

		// If scale > 8, we need to downscale the buckets to match the clamped scale
		positiveBucket := dp.PositiveBucket
		negativeBucket := dp.NegativeBucket
		if scale > 8 {
			scaleDelta := scale - 8
			positiveBucket = downscaleExponentialBucket(dp.PositiveBucket, scaleDelta)
			negativeBucket = downscaleExponentialBucket(dp.NegativeBucket, scaleDelta)
			scale = 8
		}

		// From spec: note that Prometheus Native Histograms buckets are indexed by upper boundary while Exponential Histograms are indexed by lower boundary, the result being that the Offset fields are different-by-one.
		positiveBuckets := make(map[int]int64)
		for i, c := range positiveBucket.Counts {
			if c > math.MaxInt64 {
				e := fmt.Errorf("positive count %d is too large to be represented as int64", c)
				otel.Handle(e)
				err = errors.Join(err, e)
				continue
			}
			positiveBuckets[int(positiveBucket.Offset)+i+1] = int64(c) // nolint: gosec  // Size check above.
		}

		negativeBuckets := make(map[int]int64)
		for i, c := range negativeBucket.Counts {
			if c > math.MaxInt64 {
				e := fmt.Errorf("negative count %d is too large to be represented as int64", c)
				otel.Handle(e)
				err = errors.Join(err, e)
				continue
			}
			negativeBuckets[int(negativeBucket.Offset)+i+1] = int64(c) // nolint: gosec  // Size check above.
		}

		m, e := prometheus.NewConstNativeHistogram(
			desc,
			dp.Count,
			float64(dp.Sum),
			positiveBuckets,
			negativeBuckets,
			dp.ZeroCount,
			scale,
			dp.ZeroThreshold,
			dp.StartTime,
			values...)
		if e != nil {
			reportError(ch, desc, e)
			err = errors.Join(
				err,
				fmt.Errorf("failed to NewConstNativeHistogram for histogram.DataPoints %d: %w", j, e),
			)
			continue
		}
		m = addExemplars(m, dp.Exemplars, labelNamer)
		ch <- m

		success++
	}
}

func addHistogramMetric[N int64 | float64](
	ch chan<- prometheus.Metric,
	histogram metricdata.Histogram[N],
	m metricdata.Metrics,
	name string,
	kv keyVals,
	labelNamer otlptranslator.LabelNamer,
	inst *observ.Instrumentation,
	ctx context.Context,
) {
	var err error
	var success int64
	if inst != nil {
		op := inst.ExportMetrics(ctx, int64(len(histogram.DataPoints)))
		defer func() { op.End(success, err) }()
	}

	for j, dp := range histogram.DataPoints {
		keys, values, e := getAttrs(dp.Attributes, labelNamer)
		if e != nil {
			reportError(ch, nil, e)
			err = errors.Join(err, fmt.Errorf("failed to getAttrs for histogram.DataPoints %d: %w", j, e))
			continue
		}
		keys = append(keys, kv.keys...)
		values = append(values, kv.vals...)

		desc := prometheus.NewDesc(name, m.Description, keys, nil)
		buckets := make(map[float64]uint64, len(dp.Bounds))

		cumulativeCount := uint64(0)
		for i, bound := range dp.Bounds {
			cumulativeCount += dp.BucketCounts[i]
			buckets[bound] = cumulativeCount
		}
		m, e := prometheus.NewConstHistogram(desc, dp.Count, float64(dp.Sum), buckets, values...)
		if e != nil {
			reportError(ch, desc, e)
			err = errors.Join(err, fmt.Errorf("failed to NewConstMetric for histogram.DataPoints %d: %w", j, e))
			continue
		}
		m = addExemplars(m, dp.Exemplars, labelNamer)
		ch <- m

		success++
	}
}

func addSumMetric[N int64 | float64](
	ch chan<- prometheus.Metric,
	sum metricdata.Sum[N],
	m metricdata.Metrics,
	name string,
	kv keyVals,
	labelNamer otlptranslator.LabelNamer,
	inst *observ.Instrumentation,
	ctx context.Context,
) {
	var err error
	var success int64
	if inst != nil {
		op := inst.ExportMetrics(ctx, int64(len(sum.DataPoints)))
		defer func() { op.End(success, err) }()
	}

	valueType := prometheus.CounterValue
	if !sum.IsMonotonic {
		valueType = prometheus.GaugeValue
	}

	for i, dp := range sum.DataPoints {
		keys, values, e := getAttrs(dp.Attributes, labelNamer)
		if e != nil {
			reportError(ch, nil, e)
			err = errors.Join(err, fmt.Errorf("failed to getAttrs for sum.DataPoints %d: %w", i, e))
			continue
		}
		keys = append(keys, kv.keys...)
		values = append(values, kv.vals...)

		desc := prometheus.NewDesc(name, m.Description, keys, nil)
		m, e := prometheus.NewConstMetric(desc, valueType, float64(dp.Value), values...)
		if e != nil {
			reportError(ch, desc, e)
			err = errors.Join(err, fmt.Errorf("failed to NewConstMetric for sum.DataPoints %d: %w", i, e))
			continue
		}
		// GaugeValues don't support Exemplars at this time
		// https://github.com/prometheus/client_golang/blob/aef8aedb4b6e1fb8ac1c90790645169125594096/prometheus/metric.go#L199
		if valueType != prometheus.GaugeValue {
			m = addExemplars(m, dp.Exemplars, labelNamer)
		}
		ch <- m

		success++
	}
}

func addGaugeMetric[N int64 | float64](
	ch chan<- prometheus.Metric,
	gauge metricdata.Gauge[N],
	m metricdata.Metrics,
	name string,
	kv keyVals,
	labelNamer otlptranslator.LabelNamer,
	inst *observ.Instrumentation,
	ctx context.Context,
) {
	var err error
	var success int64
	if inst != nil {
		op := inst.ExportMetrics(ctx, int64(len(gauge.DataPoints)))
		defer func() { op.End(success, err) }()
	}

	for i, dp := range gauge.DataPoints {
		keys, values, e := getAttrs(dp.Attributes, labelNamer)
		if e != nil {
			reportError(ch, nil, e)
			err = errors.Join(err, fmt.Errorf("failed to getAttrs for gauge.DataPoints %d: %w", i, e))
			continue
		}
		keys = append(keys, kv.keys...)
		values = append(values, kv.vals...)

		desc := prometheus.NewDesc(name, m.Description, keys, nil)
		m, e := prometheus.NewConstMetric(desc, prometheus.GaugeValue, float64(dp.Value), values...)
		if e != nil {
			reportError(ch, desc, e)
			err = errors.Join(err, fmt.Errorf("failed to NewConstMetric for gauge.DataPoints %d: %w", i, e))
			continue
		}
		ch <- m

		success++
	}
}

// getAttrs converts the attribute.Set to two lists of matching Prometheus-style
// keys and values.
func getAttrs(attrs attribute.Set, labelNamer otlptranslator.LabelNamer) ([]string, []string, error) {
	keys := make([]string, 0, attrs.Len())
	values := make([]string, 0, attrs.Len())
	itr := attrs.Iter()

	if labelNamer.UTF8Allowed {
		// Do not perform sanitization if prometheus supports UTF-8.
		for itr.Next() {
			kv := itr.Attribute()
			keys = append(keys, string(kv.Key))
			values = append(values, kv.Value.Emit())
		}
	} else {
		// It sanitizes invalid characters and handles duplicate keys
		// (due to sanitization) by sorting and concatenating the values following the spec.
		keysMap := make(map[string][]string)
		for itr.Next() {
			kv := itr.Attribute()
			key, err := labelNamer.Build(string(kv.Key))
			if err != nil {
				// TODO(#7066) Handle this error better.
				return nil, nil, err
			}
			if _, ok := keysMap[key]; !ok {
				keysMap[key] = []string{kv.Value.Emit()}
			} else {
				// if the sanitized key is a duplicate, append to the list of keys
				keysMap[key] = append(keysMap[key], kv.Value.Emit())
			}
		}
		for key, vals := range keysMap {
			keys = append(keys, key)
			slices.Sort(vals)
			values = append(values, strings.Join(vals, ";"))
		}
	}
	return keys, values, nil
}

func (c *collector) createInfoMetric(name, description string, res *resource.Resource) (prometheus.Metric, error) {
	keys, values, err := getAttrs(*res.Set(), c.labelNamer)
	if err != nil {
		return nil, err
	}
	desc := prometheus.NewDesc(name, description, keys, nil)
	return prometheus.NewConstMetric(desc, prometheus.GaugeValue, float64(1), values...)
}

// getName returns the sanitized name, translated according to the selected
// TranslationStrategy and namespace option.
func (c *collector) getName(m metricdata.Metrics) (string, error) {
	translatorMetric := otlptranslator.Metric{
		Name: m.Name,
		Type: c.namingMetricType(m),
	}
	if !c.withoutUnits {
		translatorMetric.Unit = m.Unit
	}
	return c.metricNamer.Build(translatorMetric)
}

func (*collector) metricType(m metricdata.Metrics) *dto.MetricType {
	switch v := m.Data.(type) {
	case metricdata.ExponentialHistogram[int64], metricdata.ExponentialHistogram[float64]:
		return dto.MetricType_HISTOGRAM.Enum()
	case metricdata.Histogram[int64], metricdata.Histogram[float64]:
		return dto.MetricType_HISTOGRAM.Enum()
	case metricdata.Sum[float64]:
		if v.IsMonotonic {
			return dto.MetricType_COUNTER.Enum()
		}
		return dto.MetricType_GAUGE.Enum()
	case metricdata.Sum[int64]:
		if v.IsMonotonic {
			return dto.MetricType_COUNTER.Enum()
		}
		return dto.MetricType_GAUGE.Enum()
	case metricdata.Gauge[int64], metricdata.Gauge[float64]:
		return dto.MetricType_GAUGE.Enum()
	}
	return nil
}

// namingMetricType provides the metric type for naming purposes.
func (c *collector) namingMetricType(m metricdata.Metrics) otlptranslator.MetricType {
	switch v := m.Data.(type) {
	case metricdata.ExponentialHistogram[int64], metricdata.ExponentialHistogram[float64]:
		return otlptranslator.MetricTypeHistogram
	case metricdata.Histogram[int64], metricdata.Histogram[float64]:
		return otlptranslator.MetricTypeHistogram
	case metricdata.Sum[float64]:
		// If counter suffixes are disabled, treat them like non-monotonic
		// suffixes for the purposes of naming.
		if v.IsMonotonic && !c.withoutCounterSuffixes {
			return otlptranslator.MetricTypeMonotonicCounter
		}
		return otlptranslator.MetricTypeNonMonotonicCounter
	case metricdata.Sum[int64]:
		// If counter suffixes are disabled, treat them like non-monotonic
		// suffixes for the purposes of naming.
		if v.IsMonotonic && !c.withoutCounterSuffixes {
			return otlptranslator.MetricTypeMonotonicCounter
		}
		return otlptranslator.MetricTypeNonMonotonicCounter
	case metricdata.Gauge[int64], metricdata.Gauge[float64]:
		return otlptranslator.MetricTypeGauge
	case metricdata.Summary:
		return otlptranslator.MetricTypeSummary
	}
	return otlptranslator.MetricTypeUnknown
}

func (c *collector) createResourceAttributes(res *resource.Resource) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	resourceAttrs, _ := res.Set().Filter(c.resourceAttributesFilter)
	resourceKeys, resourceValues, err := getAttrs(resourceAttrs, c.labelNamer)
	if err != nil {
		return err
	}

	c.resourceKeyVals = keyVals{keys: resourceKeys, vals: resourceValues}
	return nil
}

func (c *collector) validateMetrics(name, description string, metricType *dto.MetricType) (drop bool, help string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	emf, exist := c.metricFamilies[name]

	if !exist {
		c.metricFamilies[name] = &dto.MetricFamily{
			Name: proto.String(name),
			Help: proto.String(description),
			Type: metricType,
		}
		return false, ""
	}

	if emf.GetType() != *metricType {
		global.Error(
			errors.New("instrument type conflict"),
			"Using existing type definition.",
			"instrument", name,
			"existing", emf.GetType(),
			"dropped", *metricType,
		)
		return true, ""
	}
	if emf.GetHelp() != description {
		global.Info(
			"Instrument description conflict, using existing",
			"instrument", name,
			"existing", emf.GetHelp(),
			"dropped", description,
		)
		return false, emf.GetHelp()
	}

	return false, ""
}

func addExemplars[N int64 | float64](
	m prometheus.Metric,
	exemplars []metricdata.Exemplar[N],
	labelNamer otlptranslator.LabelNamer,
) prometheus.Metric {
	if len(exemplars) == 0 {
		return m
	}
	promExemplars := make([]prometheus.Exemplar, len(exemplars))
	for i, exemplar := range exemplars {
		labels, err := attributesToLabels(exemplar.FilteredAttributes, labelNamer)
		if err != nil {
			otel.Handle(err)
			return m
		}
		// Overwrite any existing trace ID or span ID attributes
		labels[otlptranslator.ExemplarTraceIDKey] = hex.EncodeToString(exemplar.TraceID)
		labels[otlptranslator.ExemplarSpanIDKey] = hex.EncodeToString(exemplar.SpanID)
		promExemplars[i] = prometheus.Exemplar{
			Value:     float64(exemplar.Value),
			Timestamp: exemplar.Time,
			Labels:    labels,
		}
	}
	metricWithExemplar, err := prometheus.NewMetricWithExemplars(m, promExemplars...)
	if err != nil {
		// If there are errors creating the metric with exemplars, just warn
		// and return the metric without exemplars.
		otel.Handle(err)
		return m
	}
	return metricWithExemplar
}

func attributesToLabels(attrs []attribute.KeyValue, labelNamer otlptranslator.LabelNamer) (prometheus.Labels, error) {
	labels := make(map[string]string)
	for _, attr := range attrs {
		name, err := labelNamer.Build(string(attr.Key))
		if err != nil {
			return nil, err
		}
		labels[name] = attr.Value.Emit()
	}
	return labels, nil
}

func reportError(ch chan<- prometheus.Metric, desc *prometheus.Desc, err error) {
	if desc == nil {
		desc = prometheus.NewInvalidDesc(err)
	}
	ch <- prometheus.NewInvalidMetric(desc, err)
}
