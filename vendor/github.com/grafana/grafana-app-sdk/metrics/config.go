package metrics

import "github.com/prometheus/client_golang/prometheus"

// ExporterConfig is the configuration used for the Exporter
type ExporterConfig struct {
	Registerer prometheus.Registerer
	Gatherer   prometheus.Gatherer
}

// Config is the general set of configuration options for creating prometheus Collectors
type Config struct {
	// Namespace for the collectors
	Namespace string
	// NativeHistogramBucketFactor is used for native histograms, see
	// https://pkg.go.dev/github.com/prometheus/client_golang/prometheus#HistogramOpts
	NativeHistogramBucketFactor float64
	// NativeHistogramMaxBucketNumber is used to define the max number of buckets
	// in a native histogram, see https://pkg.go.dev/github.com/prometheus/client_golang/prometheus#HistogramOpts
	NativeHistogramMaxBucketNumber uint32
}

// DefaultConfig returns a Config with the provided namespace and all other values set to defaults.
func DefaultConfig(namespace string) Config {
	return Config{
		Namespace:                      namespace,
		NativeHistogramBucketFactor:    1,
		NativeHistogramMaxBucketNumber: 10,
	}
}
