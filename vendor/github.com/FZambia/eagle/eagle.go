// Package eagle provides a functionality to export Prometheus metrics
// aggregated over configured time interval. This can be useful when you
// want to use Prometheus library to instrument your code but still want
// to periodically export metrics to non Prometheus monitoring systems.
package eagle

import (
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

const defaultQuantileSep = "."

// MetricType is a type for different supported metric types.
type MetricType string

// Various metric types eagle supports.
const (
	MetricTypeCounter = "counter"
	MetricTypeGauge   = "gauge"
	MetricTypeSummary = "summary"
)

// Eagle allows to periodically export Prometheus metrics
// aggregated over configured time interval.
type Eagle struct {
	mu          sync.RWMutex
	gatherer    prometheus.Gatherer
	interval    time.Duration
	sink        chan<- Metrics
	quantileSep string
	values      map[string]float64
	deltas      map[string]float64
	closeOnce   sync.Once
	closeCh     chan struct{}
}

// Config of Eagle instance.
type Config struct {
	Gatherer    prometheus.Gatherer
	Interval    time.Duration
	Sink        chan<- Metrics
	QuantileSep string
}

// New creates new Eagle.
func New(c Config) *Eagle {
	e := &Eagle{
		gatherer:    c.Gatherer,
		interval:    c.Interval,
		sink:        c.Sink,
		quantileSep: defaultQuantileSep,
		values:      make(map[string]float64),
		deltas:      make(map[string]float64),
		closeCh:     make(chan struct{}),
	}
	if c.QuantileSep != "" {
		e.quantileSep = c.QuantileSep
	}
	go e.aggregate()
	return e
}

// Close closes Eagle.
func (e *Eagle) Close() error {
	e.closeOnce.Do(func() {
		close(e.closeCh)
	})
	return nil
}

// MetricValue is a concrete value of certain metric.
type MetricValue struct {
	Name   string   `json:"name"`
	Labels []string `json:"labels,omitempty"`
	Value  float64  `json:"value"`
}

// Metric is a single Prometheus metric that can have many MetricValue.
type Metric struct {
	Type      MetricType    `json:"type"`
	Namespace string        `json:"namespace"`
	Subsystem string        `json:"subsystem"`
	Name      string        `json:"name"`
	Help      string        `json:"help,omitempty"`
	Values    []MetricValue `json:"values,omitempty"`
}

// Metrics represent collection of aggregated Prometheus metrics.
type Metrics struct {
	Items []Metric `json:"items,omitempty"`
}

// Flatten is a helper method to flatten metrics into map[string]float64.
func (m Metrics) Flatten(sep string) map[string]float64 {
	result := make(map[string]float64)
	for _, item := range m.Items {
		for _, metricValue := range item.Values {
			parts := []string{}
			if item.Namespace != "" {
				parts = append(parts, item.Namespace)
			}
			if item.Subsystem != "" {
				parts = append(parts, item.Subsystem)
			}
			if item.Name != "" {
				parts = append(parts, item.Name)
			}
			if metricValue.Name != "" {
				parts = append(parts, metricValue.Name)
			}
			parts = append(parts, metricValue.Labels...)
			key := strings.Join(parts, sep)
			result[key] = metricValue.Value
		}
	}
	return result
}

type metricLabel struct {
	Name  string
	Value string
}

func getCacheKey(name string, labels []metricLabel, suffix string) string {
	key := name
	path := joinLabels(labels, ".")
	if path != "" {
		key += "." + path
	}
	if suffix != "" {
		key += "." + suffix
	}
	return key
}

func quantileString(val float64) string {
	q := fmt.Sprintf("%d", int(val*1000))
	if len(q) > 2 {
		q = strings.TrimSuffix(q, "0")
	}
	return q
}

func (e *Eagle) aggregateOnce() {
	mfs, err := e.gatherer.Gather()
	if err != nil {
		return
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	for _, mf := range mfs {
		typ := mf.GetType()
		name := mf.GetName()
		for _, m := range mf.GetMetric() {
			if typ == dto.MetricType_COUNTER {
				counter := m.GetCounter()
				cacheKey := getCacheKey(name, getLabels(m.GetLabel()), "")
				if previousVal, ok := e.values[cacheKey]; ok {
					e.deltas[cacheKey] = counter.GetValue() - previousVal
				} else {
					e.deltas[cacheKey] = counter.GetValue()
				}
				e.values[cacheKey] = counter.GetValue()
			} else if typ == dto.MetricType_SUMMARY {
				summary := m.GetSummary()
				count := summary.GetSampleCount()
				sum := summary.GetSampleSum()
				cacheKey := getCacheKey(name, getLabels(m.GetLabel()), "sum")
				if previousVal, ok := e.values[cacheKey]; ok {
					e.deltas[cacheKey] = sum - previousVal
				} else {
					e.deltas[cacheKey] = sum
				}
				e.values[cacheKey] = sum

				cacheKey = getCacheKey(name, getLabels(m.GetLabel()), "count")
				if previousVal, ok := e.values[cacheKey]; ok {
					e.deltas[cacheKey] = float64(count) - previousVal
				} else {
					e.deltas[cacheKey] = float64(count)
				}
				e.values[cacheKey] = float64(count)
			}
		}
	}
	if e.sink != nil {
		metrics, err := e.getMetrics(mfs)
		if err != nil {
			return
		}
		select {
		case e.sink <- metrics:
		default:
			return
		}
	}
}

func (e *Eagle) aggregate() {
	for {
		select {
		case <-time.After(e.interval):
			e.aggregateOnce()
		case <-e.closeCh:
			return
		}
	}
}

func getLabels(pairs []*dto.LabelPair) []metricLabel {
	labels := []metricLabel{}
	for _, pair := range pairs {
		val := pair.GetValue()
		if val == "" {
			continue
		}
		label := metricLabel{pair.GetName(), val}
		labels = append(labels, label)
	}
	return labels
}

func flattenLabels(labels []metricLabel) []string {
	l := []string{}
	for _, label := range labels {
		l = append(l, label.Name)
		l = append(l, label.Value)
	}
	return l
}

func joinLabels(labels []metricLabel, sep string) string {
	chunks := []string{}
	for _, lbl := range labels {
		chunks = append(chunks, lbl.Name)
		chunks = append(chunks, lbl.Value)
	}
	if len(chunks) == 0 {
		return ""
	}
	return strings.Join(chunks, sep)
}

// Lock must be held outside.
func (e *Eagle) getMetrics(mfs []*dto.MetricFamily) (Metrics, error) {
	metrics := Metrics{
		Items: make([]Metric, 0),
	}
	for _, mf := range mfs {
		typ := mf.GetType()
		name := mf.GetName()
		parts := strings.SplitN(name, "_", 3)
		var namespace, subsystem, shortName string
		if len(parts) == 3 {
			namespace, subsystem, shortName = parts[0], parts[1], parts[2]
		} else {
			namespace, subsystem = parts[0], parts[1]
		}
		metric := Metric{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      shortName,
			Help:      mf.GetHelp(),
			Values:    make([]MetricValue, 0),
		}
		for _, m := range mf.GetMetric() {
			if typ == dto.MetricType_COUNTER {
				metric.Type = MetricTypeCounter
				counter := m.GetCounter()
				labels := getLabels(m.GetLabel())
				cacheKey := getCacheKey(name, labels, "")
				deltaVal, ok := e.deltas[cacheKey]
				if !ok {
					deltaVal = counter.GetValue()
				}
				value := MetricValue{
					Name:   "",
					Labels: flattenLabels(labels),
					Value:  deltaVal,
				}
				metric.Values = append(metric.Values, value)
			} else if typ == dto.MetricType_GAUGE {
				metric.Type = MetricTypeGauge
				gauge := m.GetGauge()
				labels := getLabels(m.GetLabel())
				chunks := []string{}
				for _, lbl := range labels {
					chunks = append(chunks, lbl.Name)
					chunks = append(chunks, lbl.Value)
				}
				value := MetricValue{
					Name:   "",
					Labels: flattenLabels(labels),
					Value:  gauge.GetValue(),
				}
				metric.Values = append(metric.Values, value)
			} else if typ == dto.MetricType_SUMMARY {
				metric.Type = MetricTypeSummary
				summary := m.GetSummary()
				count := summary.GetSampleCount()
				sum := summary.GetSampleSum()
				quantiles := summary.GetQuantile()
				labels := getLabels(m.GetLabel())

				deltaVal, ok := e.deltas[getCacheKey(name, labels, "sum")]
				if !ok {
					deltaVal = sum
				}
				value := MetricValue{
					Name:   "sum",
					Labels: flattenLabels(labels),
					Value:  deltaVal,
				}
				metric.Values = append(metric.Values, value)

				deltaVal, ok = e.deltas[getCacheKey(name, labels, "count")]
				if !ok {
					deltaVal = float64(count)
				}
				value = MetricValue{
					Name:   "count",
					Labels: flattenLabels(labels),
					Value:  deltaVal,
				}
				metric.Values = append(metric.Values, value)

				for _, quantile := range quantiles {
					value := quantile.GetValue()
					if math.IsNaN(value) {
						continue
					}
					v := MetricValue{
						Name:   "quantile" + e.quantileSep + quantileString(quantile.GetQuantile()),
						Labels: flattenLabels(labels),
						Value:  quantile.GetValue(),
					}
					metric.Values = append(metric.Values, v)
				}
			} else {
				continue
			}
		}
		metrics.Items = append(metrics.Items, metric)
	}

	return metrics, nil
}

// Export actual Metrics once.
func (e *Eagle) Export() (Metrics, error) {
	mfs, err := e.gatherer.Gather()
	if err != nil {
		return Metrics{}, err
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.getMetrics(mfs)
}
