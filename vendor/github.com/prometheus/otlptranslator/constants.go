// Copyright 2025 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
package otlptranslator

const (
	// ExemplarTraceIDKey is the key used to store the trace ID in Prometheus
	// exemplars:
	// https://github.com/open-telemetry/opentelemetry-specification/blob/e6eccba97ebaffbbfad6d4358408a2cead0ec2df/specification/compatibility/prometheus_and_openmetrics.md#exemplars
	ExemplarTraceIDKey = "trace_id"
	// ExemplarSpanIDKey is the key used to store the Span ID in Prometheus
	// exemplars:
	// https://github.com/open-telemetry/opentelemetry-specification/blob/e6eccba97ebaffbbfad6d4358408a2cead0ec2df/specification/compatibility/prometheus_and_openmetrics.md#exemplars
	ExemplarSpanIDKey = "span_id"
	// ScopeNameLabelKey is the name of the label key used to identify the name
	// of the OpenTelemetry scope which produced the metric:
	// https://github.com/open-telemetry/opentelemetry-specification/blob/e6eccba97ebaffbbfad6d4358408a2cead0ec2df/specification/compatibility/prometheus_and_openmetrics.md#instrumentation-scope
	ScopeNameLabelKey = "otel_scope_name"
	// ScopeVersionLabelKey is the name of the label key used to identify the
	// version of the OpenTelemetry scope which produced the metric:
	// https://github.com/open-telemetry/opentelemetry-specification/blob/e6eccba97ebaffbbfad6d4358408a2cead0ec2df/specification/compatibility/prometheus_and_openmetrics.md#instrumentation-scope
	ScopeVersionLabelKey = "otel_scope_version"
	// TargetInfoMetricName is the name of the metric used to preserve resource
	// attributes in Prometheus format:
	// https://github.com/open-telemetry/opentelemetry-specification/blob/e6eccba97ebaffbbfad6d4358408a2cead0ec2df/specification/compatibility/prometheus_and_openmetrics.md#resource-attributes-1
	// It originates from OpenMetrics:
	// https://github.com/OpenObservability/OpenMetrics/blob/1386544931307dff279688f332890c31b6c5de36/specification/OpenMetrics.md#supporting-target-metadata-in-both-push-based-and-pull-based-systems
	TargetInfoMetricName = "target_info"
)
