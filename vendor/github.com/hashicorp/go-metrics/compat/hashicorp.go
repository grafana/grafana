//go:build hashicorpmetrics
// +build hashicorpmetrics

package metrics

import (
	"io"
	"net/url"
	"syscall"
	"time"

	"github.com/hashicorp/go-metrics"
)

const (
	// DefaultSignal is used with DefaultInmemSignal
	DefaultSignal = metrics.DefaultSignal
)

func AddSample(key []string, val float32) {
	metrics.AddSample(key, val)
}
func AddSampleWithLabels(key []string, val float32, labels []Label) {
	metrics.AddSampleWithLabels(key, val, labels)
}
func EmitKey(key []string, val float32) {
	metrics.EmitKey(key, val)
}
func IncrCounter(key []string, val float32) {
	metrics.IncrCounter(key, val)
}
func IncrCounterWithLabels(key []string, val float32, labels []Label) {
	metrics.IncrCounterWithLabels(key, val, labels)
}
func MeasureSince(key []string, start time.Time) {
	metrics.MeasureSince(key, start)
}
func MeasureSinceWithLabels(key []string, start time.Time, labels []Label) {
	metrics.MeasureSinceWithLabels(key, start, labels)
}
func SetGauge(key []string, val float32) {
	metrics.SetGauge(key, val)
}
func SetGaugeWithLabels(key []string, val float32, labels []Label) {
	metrics.SetGaugeWithLabels(key, val, labels)
}
func Shutdown() {
	metrics.Shutdown()
}
func UpdateFilter(allow, block []string) {
	metrics.UpdateFilter(allow, block)
}
func UpdateFilterAndLabels(allow, block, allowedLabels, blockedLabels []string) {
	metrics.UpdateFilterAndLabels(allow, block, allowedLabels, blockedLabels)
}

type AggregateSample = metrics.AggregateSample
type BlackholeSink = metrics.BlackholeSink
type Config = metrics.Config
type Encoder = metrics.Encoder
type FanoutSink = metrics.FanoutSink
type GaugeValue = metrics.GaugeValue
type InmemSignal = metrics.InmemSignal
type InmemSink = metrics.InmemSink
type IntervalMetrics = metrics.IntervalMetrics
type Label = metrics.Label
type MetricSink = metrics.MetricSink
type Metrics = metrics.Metrics
type MetricsSummary = metrics.MetricsSummary
type PointValue = metrics.PointValue
type SampledValue = metrics.SampledValue
type ShutdownSink = metrics.ShutdownSink
type StatsdSink = metrics.StatsdSink
type StatsiteSink = metrics.StatsiteSink

func DefaultConfig(serviceName string) *Config {
	return metrics.DefaultConfig(serviceName)
}

func DefaultInmemSignal(inmem *InmemSink) *InmemSignal {
	return metrics.DefaultInmemSignal(inmem)
}
func NewInmemSignal(inmem *InmemSink, sig syscall.Signal, w io.Writer) *InmemSignal {
	return metrics.NewInmemSignal(inmem, sig, w)
}

func NewInmemSink(interval, retain time.Duration) *InmemSink {
	return metrics.NewInmemSink(interval, retain)
}

func NewIntervalMetrics(intv time.Time) *IntervalMetrics {
	return metrics.NewIntervalMetrics(intv)
}

func NewInmemSinkFromURL(u *url.URL) (MetricSink, error) {
	return metrics.NewInmemSinkFromURL(u)
}

func NewMetricSinkFromURL(urlStr string) (MetricSink, error) {
	return metrics.NewMetricSinkFromURL(urlStr)
}

func NewStatsdSinkFromURL(u *url.URL) (MetricSink, error) {
	return metrics.NewStatsdSinkFromURL(u)
}

func NewStatsiteSinkFromURL(u *url.URL) (MetricSink, error) {
	return metrics.NewStatsiteSinkFromURL(u)
}

func Default() *Metrics {
	return metrics.Default()
}

func New(conf *Config, sink MetricSink) (*Metrics, error) {
	return metrics.New(conf, sink)
}

func NewGlobal(conf *Config, sink MetricSink) (*Metrics, error) {
	return metrics.NewGlobal(conf, sink)
}

func NewStatsdSink(addr string) (*StatsdSink, error) {
	return metrics.NewStatsdSink(addr)
}

func NewStatsiteSink(addr string) (*StatsiteSink, error) {
	return metrics.NewStatsiteSink(addr)
}
