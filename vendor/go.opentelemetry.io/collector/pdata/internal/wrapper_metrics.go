// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"

import (
	otlpcollectormetrics "go.opentelemetry.io/collector/pdata/internal/data/protogen/collector/metrics/v1"
	otlpmetrics "go.opentelemetry.io/collector/pdata/internal/data/protogen/metrics/v1"
)

type Metrics struct {
	orig  *otlpcollectormetrics.ExportMetricsServiceRequest
	state *State
}

func GetOrigMetrics(ms Metrics) *otlpcollectormetrics.ExportMetricsServiceRequest {
	return ms.orig
}

func GetMetricsState(ms Metrics) *State {
	return ms.state
}

func SetMetricsState(ms Metrics, state State) {
	*ms.state = state
}

func NewMetrics(orig *otlpcollectormetrics.ExportMetricsServiceRequest, state *State) Metrics {
	return Metrics{orig: orig, state: state}
}

// MetricsToProto internal helper to convert Metrics to protobuf representation.
func MetricsToProto(l Metrics) otlpmetrics.MetricsData {
	return otlpmetrics.MetricsData{
		ResourceMetrics: l.orig.ResourceMetrics,
	}
}

// MetricsFromProto internal helper to convert protobuf representation to Metrics.
// This function set exclusive state assuming that it's called only once per Metrics.
func MetricsFromProto(orig otlpmetrics.MetricsData) Metrics {
	state := StateMutable
	return NewMetrics(&otlpcollectormetrics.ExportMetricsServiceRequest{
		ResourceMetrics: orig.ResourceMetrics,
	}, &state)
}
