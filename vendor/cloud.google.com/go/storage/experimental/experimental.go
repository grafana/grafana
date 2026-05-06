// Copyright 2024 Google LLC
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

// Package experimental is a collection of experimental features that might
// have some rough edges to them. Housing experimental features in this package
// results in a user accessing these APIs as `experimental.Foo`, thereby making
// it explicit that the feature is experimental and using them in production
// code is at their own risk.
//
// All APIs in this package are experimental.
package experimental

import (
	"time"

	"cloud.google.com/go/storage/internal"
	"go.opentelemetry.io/otel/sdk/metric"
	"google.golang.org/api/option"
)

// WithMetricInterval provides a [option.ClientOption] that may be passed to [storage.NewGRPCClient].
// It sets how often to emit metrics [metric.WithInterval] when using
// [metric.NewPeriodicReader]
// When using Cloud Monitoring interval must be at minimum 1 [time.Minute].
func WithMetricInterval(metricInterval time.Duration) option.ClientOption {
	return internal.WithMetricInterval.(func(time.Duration) option.ClientOption)(metricInterval)
}

// WithMetricExporter provides a [option.ClientOption] that may be passed to [storage.NewGRPCClient].
// Set an alternate client-side metric Exporter to emit metrics through.
// Must implement [metric.Exporter]
func WithMetricExporter(ex *metric.Exporter) option.ClientOption {
	return internal.WithMetricExporter.(func(*metric.Exporter) option.ClientOption)(ex)
}

// WithReadStallTimeout provides a [option.ClientOption] that may be passed to [storage.NewClient].
// It enables the client to retry stalled requests when starting a download from
// Cloud Storage. If the timeout elapses with no response from the server, the request
// is automatically retried.
// The timeout is initially set to ReadStallTimeoutConfig.Min. The client tracks
// latency across all read requests from the client for each bucket accessed, and can
// adjust the timeout higher to the target percentile when latency for request to that
// bucket is high.
// Currently, this is supported only for downloads ([storage.NewReader] and
// [storage.NewRangeReader] calls) and only for the XML API. Other read APIs (gRPC & JSON)
// will be supported soon.
func WithReadStallTimeout(rstc *ReadStallTimeoutConfig) option.ClientOption {
	return internal.WithReadStallTimeout.(func(config *ReadStallTimeoutConfig) option.ClientOption)(rstc)
}

// ReadStallTimeoutConfig defines the timeout which is adjusted dynamically based on
// past observed latencies.
type ReadStallTimeoutConfig struct {
	// Min is the minimum duration of the timeout. The default value is 500ms. Requests
	// taking shorter than this value to return response headers will never time out.
	// In general, you should choose a Min value that is greater than the typical value
	// for the target percentile.
	Min time.Duration

	// TargetPercentile is the percentile to target for the dynamic timeout. The default
	// value is 0.99. At the default percentile, at most 1% of requests will be timed out
	// and retried.
	TargetPercentile float64
}

// WithGRPCBidiReads provides an [option.ClientOption] that may be passed to
// [cloud.google.com/go/storage.NewGRPCClient].
// It enables the client to use bi-directional gRPC APIs for downloads rather than the
// server streaming API. In particular, it allows users to use the
// [cloud.google.com/go/storage.MultiRangeDownloader]
// surface, which requires bi-directional streaming.
//
// The bi-directional API is in private preview; please contact your account manager if
// interested.
func WithGRPCBidiReads() option.ClientOption {
	return internal.WithGRPCBidiReads.(func() option.ClientOption)()
}

// WithZonalBucketAPIs provides an [option.ClientOption] that may be passed to
// [cloud.google.com/go/storage.NewGRPCClient].
// It enables the client to use bi-directional gRPC APIs for downloads rather than the
// server streaming API (same as [WithGRPCBidiReads]) as well as appendable
// object semantics for uploads. By setting this option, both upload and download
// paths will use zonal bucket compatible APIs by default.
//
// Zonal buckets and rapid storage is in private preview; please contact your
// account manager if interested.
func WithZonalBucketAPIs() option.ClientOption {
	return internal.WithZonalBucketAPIs.(func() option.ClientOption)()
}
