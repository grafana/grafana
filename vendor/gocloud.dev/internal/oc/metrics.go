// Copyright 2019 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package oc supports OpenCensus tracing and metrics for the Go Cloud Development Kit.
package oc

import (
	"go.opencensus.io/plugin/ocgrpc"
	"go.opencensus.io/stats"
	"go.opencensus.io/stats/view"
	"go.opencensus.io/tag"
)

// LatencyMeasure returns the measure for method call latency used
// by Go CDK APIs.
func LatencyMeasure(pkg string) *stats.Float64Measure {
	return stats.Float64(
		pkg+"/latency",
		"Latency of method call",
		stats.UnitMilliseconds)
}

// Tag keys used for the standard Go CDK views.
var (
	MethodKey   = tag.MustNewKey("gocdk_method")
	StatusKey   = tag.MustNewKey("gocdk_status")
	ProviderKey = tag.MustNewKey("gocdk_provider")
)

// Views returns the views supported by Go CDK APIs.
func Views(pkg string, latencyMeasure *stats.Float64Measure) []*view.View {
	return []*view.View{
		{
			Name:        pkg + "/completed_calls",
			Measure:     latencyMeasure,
			Description: "Count of method calls by provider, method and status.",
			TagKeys:     []tag.Key{ProviderKey, MethodKey, StatusKey},
			Aggregation: view.Count(),
		},
		{
			Name:        pkg + "/latency",
			Measure:     latencyMeasure,
			Description: "Distribution of method latency, by provider and method.",
			TagKeys:     []tag.Key{ProviderKey, MethodKey},
			Aggregation: ocgrpc.DefaultMillisecondsDistribution,
		},
	}
}
