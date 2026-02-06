package metrics

import (
	"os"
	"sync"
	"sync/atomic"
	"time"

	iradix "github.com/hashicorp/go-immutable-radix"
)

// Config is used to configure metrics settings
type Config struct {
	ServiceName          string        // Prefixed with keys to separate services
	HostName             string        // Hostname to use. If not provided and EnableHostname, it will be os.Hostname
	EnableHostname       bool          // Enable prefixing gauge values with hostname
	EnableHostnameLabel  bool          // Enable adding hostname to labels
	EnableServiceLabel   bool          // Enable adding service to labels
	EnableRuntimeMetrics bool          // Enables profiling of runtime metrics (GC, Goroutines, Memory)
	EnableTypePrefix     bool          // Prefixes key with a type ("counter", "gauge", "timer")
	TimerGranularity     time.Duration // Granularity of timers.
	ProfileInterval      time.Duration // Interval to profile runtime metrics

	AllowedPrefixes []string // A list of metric prefixes to allow, with '.' as the separator
	BlockedPrefixes []string // A list of metric prefixes to block, with '.' as the separator
	AllowedLabels   []string // A list of metric labels to allow, with '.' as the separator
	BlockedLabels   []string // A list of metric labels to block, with '.' as the separator
	FilterDefault   bool     // Whether to allow metrics by default
}

// Metrics represents an instance of a metrics sink that can
// be used to emit
type Metrics struct {
	Config
	lastNumGC     uint32
	sink          MetricSink
	filter        *iradix.Tree
	allowedLabels map[string]bool
	blockedLabels map[string]bool
	filterLock    sync.RWMutex // Lock filters and allowedLabels/blockedLabels access
}

// Shared global metrics instance
var globalMetrics atomic.Value // *Metrics

func init() {
	// Initialize to a blackhole sink to avoid errors
	globalMetrics.Store(&Metrics{sink: &BlackholeSink{}})
}

// Default returns the shared global metrics instance.
func Default() *Metrics {
	return globalMetrics.Load().(*Metrics)
}

// DefaultConfig provides a sane default configuration
func DefaultConfig(serviceName string) *Config {
	c := &Config{
		ServiceName:          serviceName, // Use client provided service
		HostName:             "",
		EnableHostname:       true,             // Enable hostname prefix
		EnableRuntimeMetrics: true,             // Enable runtime profiling
		EnableTypePrefix:     false,            // Disable type prefix
		TimerGranularity:     time.Millisecond, // Timers are in milliseconds
		ProfileInterval:      time.Second,      // Poll runtime every second
		FilterDefault:        true,             // Don't filter metrics by default
	}

	// Try to get the hostname
	name, _ := os.Hostname()
	c.HostName = name
	return c
}

// New is used to create a new instance of Metrics
func New(conf *Config, sink MetricSink) (*Metrics, error) {
	met := &Metrics{}
	met.Config = *conf
	met.sink = sink
	met.UpdateFilterAndLabels(conf.AllowedPrefixes, conf.BlockedPrefixes, conf.AllowedLabels, conf.BlockedLabels)

	// Start the runtime collector
	if conf.EnableRuntimeMetrics {
		go met.collectStats()
	}
	return met, nil
}

// NewGlobal is the same as New, but it assigns the metrics object to be
// used globally as well as returning it.
func NewGlobal(conf *Config, sink MetricSink) (*Metrics, error) {
	metrics, err := New(conf, sink)
	if err == nil {
		globalMetrics.Store(metrics)
	}
	return metrics, err
}

// Proxy all the methods to the globalMetrics instance
func SetGauge(key []string, val float32) {
	globalMetrics.Load().(*Metrics).SetGauge(key, val)
}

func SetGaugeWithLabels(key []string, val float32, labels []Label) {
	globalMetrics.Load().(*Metrics).SetGaugeWithLabels(key, val, labels)
}

func EmitKey(key []string, val float32) {
	globalMetrics.Load().(*Metrics).EmitKey(key, val)
}

func IncrCounter(key []string, val float32) {
	globalMetrics.Load().(*Metrics).IncrCounter(key, val)
}

func IncrCounterWithLabels(key []string, val float32, labels []Label) {
	globalMetrics.Load().(*Metrics).IncrCounterWithLabels(key, val, labels)
}

func AddSample(key []string, val float32) {
	globalMetrics.Load().(*Metrics).AddSample(key, val)
}

func AddSampleWithLabels(key []string, val float32, labels []Label) {
	globalMetrics.Load().(*Metrics).AddSampleWithLabels(key, val, labels)
}

func MeasureSince(key []string, start time.Time) {
	globalMetrics.Load().(*Metrics).MeasureSince(key, start)
}

func MeasureSinceWithLabels(key []string, start time.Time, labels []Label) {
	globalMetrics.Load().(*Metrics).MeasureSinceWithLabels(key, start, labels)
}

func UpdateFilter(allow, block []string) {
	globalMetrics.Load().(*Metrics).UpdateFilter(allow, block)
}

// UpdateFilterAndLabels set allow/block prefixes of metrics while allowedLabels
// and blockedLabels - when not nil - allow filtering of labels in order to
// block/allow globally labels (especially useful when having large number of
// values for a given label). See README.md for more information about usage.
func UpdateFilterAndLabels(allow, block, allowedLabels, blockedLabels []string) {
	globalMetrics.Load().(*Metrics).UpdateFilterAndLabels(allow, block, allowedLabels, blockedLabels)
}

// Shutdown disables metric collection, then blocks while attempting to flush metrics to storage.
// WARNING: Not all MetricSink backends support this functionality, and calling this will cause them to leak resources.
// This is intended for use immediately prior to application exit.
func Shutdown() {
	m := globalMetrics.Load().(*Metrics)
	// Swap whatever MetricSink is currently active with a BlackholeSink. Callers must not have a
	// reason to expect that calls to the library will successfully collect metrics after Shutdown
	// has been called.
	globalMetrics.Store(&Metrics{sink: &BlackholeSink{}})
	m.Shutdown()
}
