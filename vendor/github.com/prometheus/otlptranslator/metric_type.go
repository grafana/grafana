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

package otlptranslator

// MetricType is a representation of metric types from OpenTelemetry.
// Different types of Sums were introduced based on their metric temporalities.
// For more details, see:
// https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/data-model.md#sums
type MetricType int

const (
	// MetricTypeUnknown represents an unknown metric type.
	MetricTypeUnknown = iota
	// MetricTypeNonMonotonicCounter represents a counter that is not monotonically increasing, also known as delta counter.
	MetricTypeNonMonotonicCounter
	// MetricTypeMonotonicCounter represents a counter that is monotonically increasing, also known as cumulative counter.
	MetricTypeMonotonicCounter
	// MetricTypeGauge represents a gauge metric.
	MetricTypeGauge
	// MetricTypeHistogram represents a histogram metric.
	MetricTypeHistogram
	// MetricTypeExponentialHistogram represents an exponential histogram metric.
	MetricTypeExponentialHistogram
	// MetricTypeSummary represents a summary metric.
	MetricTypeSummary
)
