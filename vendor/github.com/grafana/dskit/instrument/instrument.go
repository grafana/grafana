// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/instrument/instrument.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

//lint:file-ignore faillint Changing from prometheus to promauto package would be a breaking change for consumers

package instrument

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/dskit/grpcutil"
	"github.com/grafana/dskit/tracing"
	"github.com/grafana/dskit/user"
)

// DefBuckets are histogram buckets for the response time (in seconds)
// of a network service, including one that is responding very slowly.
var DefBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100}

// Collector describes something that collects data before and/or after a task.
type Collector interface {
	Register()
	Before(ctx context.Context, method string, start time.Time)
	After(ctx context.Context, method, statusCode string, start time.Time)
}

// HistogramCollector collects the duration of a request
type HistogramCollector struct {
	metric *prometheus.HistogramVec
}

// HistogramCollectorBuckets define the buckets when passing the metric
var HistogramCollectorBuckets = []string{"operation", "status_code"}

// NewHistogramCollectorFromOpts creates a Collector from histogram options.
// It makes sure that the buckets are named properly and should be preferred over
// NewHistogramCollector().
func NewHistogramCollectorFromOpts(opts prometheus.HistogramOpts) *HistogramCollector {
	metric := prometheus.NewHistogramVec(opts, HistogramCollectorBuckets)
	return &HistogramCollector{metric}
}

// NewHistogramCollector creates a Collector from a metric.
func NewHistogramCollector(metric *prometheus.HistogramVec) *HistogramCollector {
	return &HistogramCollector{metric}
}

// Register registers metrics.
func (c *HistogramCollector) Register() {
	prometheus.MustRegister(c.metric)
}

// Before collects for the upcoming request.
func (c *HistogramCollector) Before(context.Context, string, time.Time) {
}

// After collects when the request is done.
func (c *HistogramCollector) After(ctx context.Context, method, statusCode string, start time.Time) {
	if c.metric != nil {
		ObserveWithExemplar(ctx, c.metric.WithLabelValues(method, statusCode), time.Since(start).Seconds())
	}
}

// ObserveWithExemplar adds a sample to a histogram, and adds an exemplar if the context has a sampled trace.
// 'histogram' parameter must be castable to prometheus.ExemplarObserver or function will panic
// (this will always work for a HistogramVec).
func ObserveWithExemplar(ctx context.Context, histogram prometheus.Observer, seconds float64) {
	if traceID, ok := tracing.ExtractSampledTraceID(ctx); ok {
		histogram.(prometheus.ExemplarObserver).ObserveWithExemplar(
			seconds,
			prometheus.Labels{"trace_id": traceID, "traceID": traceID},
		)
		return
	}
	histogram.Observe(seconds)
}

// JobCollector collects metrics for jobs. Designed for batch jobs which run on a regular,
// not-too-frequent, non-overlapping interval. We can afford to measure duration directly
// with gauges, and compute quantile with quantile_over_time.
type JobCollector struct {
	start, end, duration *prometheus.GaugeVec
	started, completed   *prometheus.CounterVec
}

// NewJobCollector instantiates JobCollector which creates its metrics.
func NewJobCollector(namespace string) *JobCollector {
	return &JobCollector{
		start: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: "job",
			Name:      "latest_start_timestamp",
			Help:      "Unix UTC timestamp of most recent job start time",
		}, []string{"operation"}),
		end: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: "job",
			Name:      "latest_end_timestamp",
			Help:      "Unix UTC timestamp of most recent job end time",
		}, []string{"operation", "status_code"}),
		duration: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: "job",
			Name:      "latest_duration_seconds",
			Help:      "duration of most recent job",
		}, []string{"operation", "status_code"}),
		started: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: "job",
			Name:      "started_total",
			Help:      "Number of jobs started",
		}, []string{"operation"}),
		completed: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: "job",
			Name:      "completed_total",
			Help:      "Number of jobs completed",
		}, []string{"operation", "status_code"}),
	}
}

// Register registers metrics.
func (c *JobCollector) Register() {
	prometheus.MustRegister(c.start)
	prometheus.MustRegister(c.end)
	prometheus.MustRegister(c.duration)
	prometheus.MustRegister(c.started)
	prometheus.MustRegister(c.completed)
}

// Before collects for the upcoming request.
func (c *JobCollector) Before(_ context.Context, method string, start time.Time) {
	c.start.WithLabelValues(method).Set(float64(start.UTC().Unix()))
	c.started.WithLabelValues(method).Inc()
}

// After collects when the request is done.
func (c *JobCollector) After(_ context.Context, method, statusCode string, start time.Time) {
	end := time.Now()
	c.end.WithLabelValues(method, statusCode).Set(float64(end.UTC().Unix()))
	c.duration.WithLabelValues(method, statusCode).Set(end.Sub(start).Seconds())
	c.completed.WithLabelValues(method, statusCode).Inc()
}

// CollectedRequest runs a tracked request. It uses the given Collector to monitor requests.
//
// If `f` returns no error we log "200" as status code, otherwise "500". Pass in a function
// for `toStatusCode` to overwrite this behaviour. It will also emit an OpenTracing span if
// you have a global tracer configured.
func CollectedRequest(ctx context.Context, method string, col Collector, toStatusCode func(error) string, f func(context.Context) error) error {
	if toStatusCode == nil {
		toStatusCode = ErrorCode
	}
	sp, newCtx := tracing.StartSpanFromContext(ctx, method, tracing.SpanKindRPCClient{})
	defer sp.Finish()
	if userID, err := user.ExtractUserID(ctx); err == nil {
		sp.SetTag("user", userID)
	}
	if orgID, err := user.ExtractOrgID(ctx); err == nil {
		sp.SetTag("organization", orgID)
	}

	start := time.Now()
	col.Before(newCtx, method, start)
	err := f(newCtx)
	col.After(newCtx, method, toStatusCode(err), start)

	if err != nil {
		if !grpcutil.IsCanceled(err) {
			sp.SetError()
		}
		sp.LogError(err)
	}
	return err
}

// ErrorCode converts an error into an HTTP status code
func ErrorCode(err error) string {
	if err == nil {
		return "200"
	}
	return "500"
}
