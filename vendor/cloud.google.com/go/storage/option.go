// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import (
	"os"
	"strconv"
	"time"

	"cloud.google.com/go/storage/experimental"
	storageinternal "cloud.google.com/go/storage/internal"
	"go.opentelemetry.io/otel/sdk/metric"
	"google.golang.org/api/option"
	"google.golang.org/api/option/internaloption"
)

const (
	dynamicReadReqIncreaseRateEnv     = "DYNAMIC_READ_REQ_INCREASE_RATE"
	dynamicReadReqInitialTimeoutEnv   = "DYNAMIC_READ_REQ_INITIAL_TIMEOUT"
	defaultDynamicReadReqIncreaseRate = 15.0
	defaultDynamicReqdReqMaxTimeout   = 1 * time.Hour
	defaultDynamicReadReqMinTimeout   = 500 * time.Millisecond
	defaultTargetPercentile           = 0.99
)

func init() {
	// initialize experimental options
	storageinternal.WithMetricExporter = withMetricExporter
	storageinternal.WithMetricInterval = withMetricInterval
	storageinternal.WithReadStallTimeout = withReadStallTimeout
	storageinternal.WithGRPCBidiReads = withGRPCBidiReads
	storageinternal.WithZonalBucketAPIs = withZonalBucketAPIs
}

// getDynamicReadReqIncreaseRateFromEnv returns the value set in the env variable.
// It returns defaultDynamicReadReqIncreaseRate if env is not set or the set value is invalid.
func getDynamicReadReqIncreaseRateFromEnv() float64 {
	increaseRate := os.Getenv(dynamicReadReqIncreaseRateEnv)
	if increaseRate == "" {
		return defaultDynamicReadReqIncreaseRate
	}

	val, err := strconv.ParseFloat(increaseRate, 64)
	if err != nil {
		return defaultDynamicReadReqIncreaseRate
	}
	return val
}

// getDynamicReadReqInitialTimeoutSecFromEnv returns the value set in the env variable.
// It returns the passed defaultVal if env is not set or the set value is invalid.
func getDynamicReadReqInitialTimeoutSecFromEnv(defaultVal time.Duration) time.Duration {
	initialTimeout := os.Getenv(dynamicReadReqInitialTimeoutEnv)
	if initialTimeout == "" {
		return defaultVal
	}

	val, err := time.ParseDuration(initialTimeout)
	if err != nil {
		return defaultVal
	}
	return val
}

// set through storageClientOptions.
type storageConfig struct {
	useJSONforReads        bool
	readAPIWasSet          bool
	disableClientMetrics   bool
	metricExporter         *metric.Exporter
	metricInterval         time.Duration
	manualReader           *metric.ManualReader
	readStallTimeoutConfig *experimental.ReadStallTimeoutConfig
	grpcBidiReads          bool
	grpcAppendableUploads  bool
}

// newStorageConfig generates a new storageConfig with all the given
// storageClientOptions applied.
func newStorageConfig(opts ...option.ClientOption) storageConfig {
	var conf storageConfig
	for _, opt := range opts {
		if storageOpt, ok := opt.(storageClientOption); ok {
			storageOpt.ApplyStorageOpt(&conf)
		}
	}
	return conf
}

// A storageClientOption is an option for a Google Storage client.
type storageClientOption interface {
	option.ClientOption
	ApplyStorageOpt(*storageConfig)
}

// WithJSONReads is an option that may be passed to [NewClient].
// It sets the client to use the Cloud Storage JSON API for object
// reads. Currently, the default API used for reads is XML, but JSON will
// become the default in a future release.
//
// Setting this option is required to use the GenerationNotMatch condition. We
// also recommend using JSON reads to ensure consistency with other client
// operations (all of which use JSON by default).
//
// Note that when this option is set, reads will return a zero date for
// [ReaderObjectAttrs].LastModified and may return a different value for
// [ReaderObjectAttrs].CacheControl.
func WithJSONReads() option.ClientOption {
	return &withReadAPI{useJSON: true}
}

// WithXMLReads is an option that may be passed to [NewClient].
// It sets the client to use the Cloud Storage XML API for object reads.
//
// This is the current default, but the default will switch to JSON in a future
// release.
func WithXMLReads() option.ClientOption {
	return &withReadAPI{useJSON: false}
}

type withReadAPI struct {
	internaloption.EmbeddableAdapter
	useJSON bool
}

func (w *withReadAPI) ApplyStorageOpt(c *storageConfig) {
	c.useJSONforReads = w.useJSON
	c.readAPIWasSet = true
}

type withDisabledClientMetrics struct {
	internaloption.EmbeddableAdapter
	disabledClientMetrics bool
}

// WithDisabledClientMetrics is an option that may be passed to [NewClient].
// gRPC metrics are enabled by default in the GCS client and will export the
// gRPC telemetry discussed in [gRFC/66] and [gRFC/78] to
// [Google Cloud Monitoring]. The option is used to disable metrics.
// Google Cloud Support can use this information to more quickly diagnose
// problems related to GCS and gRPC.
// Sending this data does not incur any billing charges, and requires minimal
// CPU (a single RPC every few minutes) or memory (a few KiB to batch the
// telemetry).
//
// The default is to enable client metrics. To opt-out of metrics collected use
// this option.
//
// [gRFC/66]: https://github.com/grpc/proposal/blob/master/A66-otel-stats.md
// [gRFC/78]: https://github.com/grpc/proposal/blob/master/A78-grpc-metrics-wrr-pf-xds.md
// [Google Cloud Monitoring]: https://cloud.google.com/monitoring/docs
func WithDisabledClientMetrics() option.ClientOption {
	return &withDisabledClientMetrics{disabledClientMetrics: true}
}

func (w *withDisabledClientMetrics) ApplyStorageOpt(c *storageConfig) {
	c.disableClientMetrics = w.disabledClientMetrics
}

type withMeterOptions struct {
	internaloption.EmbeddableAdapter
	// set sampling interval
	interval time.Duration
}

func withMetricInterval(interval time.Duration) option.ClientOption {
	return &withMeterOptions{interval: interval}
}

func (w *withMeterOptions) ApplyStorageOpt(c *storageConfig) {
	c.metricInterval = w.interval
}

type withMetricExporterConfig struct {
	internaloption.EmbeddableAdapter
	// exporter override
	metricExporter *metric.Exporter
}

func withMetricExporter(ex *metric.Exporter) option.ClientOption {
	return &withMetricExporterConfig{metricExporter: ex}
}

func (w *withMetricExporterConfig) ApplyStorageOpt(c *storageConfig) {
	c.metricExporter = w.metricExporter
}

type withTestMetricReaderConfig struct {
	internaloption.EmbeddableAdapter
	// reader override
	metricReader *metric.ManualReader
}

func withTestMetricReader(ex *metric.ManualReader) option.ClientOption {
	return &withTestMetricReaderConfig{metricReader: ex}
}

func (w *withTestMetricReaderConfig) ApplyStorageOpt(c *storageConfig) {
	c.manualReader = w.metricReader
}

// WithReadStallTimeout is an option that may be passed to [NewClient].
// It enables the client to retry the stalled read request, happens as part of
// storage.Reader creation. As the name suggest, timeout is adjusted dynamically
// based on past observed read-req latencies.
//
// This is only supported for the read operation and that too for http(XML) client.
// Grpc read-operation will be supported soon.
func withReadStallTimeout(rstc *experimental.ReadStallTimeoutConfig) option.ClientOption {
	// TODO (raj-prince): To keep separate dynamicDelay instance for different BucketHandle.
	// Currently, dynamicTimeout is kept at the client and hence shared across all the
	// BucketHandle, which is not the ideal state. As latency depends on location of VM
	// and Bucket, and read latency of different buckets may lie in different range.
	// Hence having a separate dynamicTimeout instance at BucketHandle level will
	// be better
	if rstc.Min == time.Duration(0) {
		rstc.Min = defaultDynamicReadReqMinTimeout
	}
	if rstc.TargetPercentile == 0 {
		rstc.TargetPercentile = defaultTargetPercentile
	}
	return &withReadStallTimeoutConfig{
		readStallTimeoutConfig: rstc,
	}
}

type withReadStallTimeoutConfig struct {
	internaloption.EmbeddableAdapter
	readStallTimeoutConfig *experimental.ReadStallTimeoutConfig
}

func (wrstc *withReadStallTimeoutConfig) ApplyStorageOpt(config *storageConfig) {
	config.readStallTimeoutConfig = wrstc.readStallTimeoutConfig
}

func withGRPCBidiReads() option.ClientOption {
	return &withGRPCBidiReadsConfig{}
}

type withGRPCBidiReadsConfig struct {
	internaloption.EmbeddableAdapter
}

func (w *withGRPCBidiReadsConfig) ApplyStorageOpt(config *storageConfig) {
	config.grpcBidiReads = true
}

func withZonalBucketAPIs() option.ClientOption {
	return &withZonalBucketAPIsConfig{}
}

type withZonalBucketAPIsConfig struct {
	internaloption.EmbeddableAdapter
}

func (w *withZonalBucketAPIsConfig) ApplyStorageOpt(config *storageConfig) {
	// Use both appendable upload semantics and bidi reads.
	config.grpcAppendableUploads = true
	config.grpcBidiReads = true
}
