package e2e

import (
	io_prometheus_client "github.com/prometheus/client_model/go"
	"github.com/prometheus/prometheus/model/labels"
)

var (
	DefaultMetricsOptions = MetricsOptions{
		GetValue:           getMetricValue,
		WaitMissingMetrics: false,
	}
)

// GetMetricValueFunc defined the signature of a function used to get the metric value.
type GetMetricValueFunc func(m *io_prometheus_client.Metric) float64

// MetricsOption defined the signature of a function used to manipulate options.
type MetricsOption func(*MetricsOptions)

// MetricsOptions is the structure holding all options.
type MetricsOptions struct {
	GetValue           GetMetricValueFunc
	LabelMatchers      []*labels.Matcher
	WaitMissingMetrics bool
	SkipMissingMetrics bool
}

// WithMetricCount is an option to get the histogram/summary count as metric value.
func WithMetricCount(opts *MetricsOptions) {
	opts.GetValue = getMetricCount
}

// WithLabelMatchers is an option to filter only matching series.
func WithLabelMatchers(matchers ...*labels.Matcher) MetricsOption {
	return func(opts *MetricsOptions) {
		opts.LabelMatchers = matchers
	}
}

// WithWaitMissingMetrics is an option to wait whenever an expected metric is missing. If this
// option is not enabled, will return error on missing metrics.
func WaitMissingMetrics(opts *MetricsOptions) {
	opts.WaitMissingMetrics = true
}

// SkipWaitMissingMetrics is an option to skip/ignore whenever an expected metric is missing.
func SkipMissingMetrics(opts *MetricsOptions) {
	opts.SkipMissingMetrics = true
}

func buildMetricsOptions(opts []MetricsOption) MetricsOptions {
	result := DefaultMetricsOptions
	for _, opt := range opts {
		opt(&result)
	}
	return result
}
