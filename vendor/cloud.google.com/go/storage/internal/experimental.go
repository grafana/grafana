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

// All options in this package are experimental.

package internal

var (
	// WithMetricInterval is a function which is implemented by storage package.
	// It sets how often to emit metrics when using NewPeriodicReader and must be
	// greater than 1 minute.
	WithMetricInterval any // func (*time.Duration) option.ClientOption

	// WithMetricExporter is a function which is implemented by storage package.
	// Set an alternate client-side metric Exporter to emit metrics through.
	WithMetricExporter any // func (*metric.Exporter) option.ClientOption

	// WithReadStallTimeout is a function which is implemented by storage package.
	// It takes ReadStallTimeoutConfig as inputs and returns a option.ClientOption.
	WithReadStallTimeout any // func (*ReadStallTimeoutConfig) option.ClientOption

	// WithGRPCBidiReads is a function which is implemented by the storage package.
	// It sets the gRPC client to use the BidiReadObject API for downloads.
	WithGRPCBidiReads any // func() option.ClientOption

	// WithZonalBucketAPIs is a function which is implemented by the storage package.
	// It sets the gRPC client to use the BidiReadObject API for downloads and
	// appendable object semantics by default for uploads.
	WithZonalBucketAPIs any // func() option.ClientOption
)
