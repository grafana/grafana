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
// Provenance-includes-location: https://github.com/prometheus/prometheus/blob/93e991ef7ed19cc997a9360c8016cac3767b8057/storage/remote/otlptranslator/prometheus/metric_name_builder.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Copyright The Prometheus Authors
// Provenance-includes-location: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/95e8f8fdc2a9dc87230406c9a3cf02be4fd68bea/pkg/translator/prometheus/normalize_name.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Copyright The OpenTelemetry Authors.

package otlptranslator

import (
	"fmt"
	"slices"
	"strings"
	"unicode"
)

// The map to translate OTLP units to Prometheus units
// OTLP metrics use the c/s notation as specified at https://ucum.org/ucum.html
// (See also https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/semantic_conventions/README.md#instrument-units)
// Prometheus best practices for units: https://prometheus.io/docs/practices/naming/#base-units
// OpenMetrics specification for units: https://github.com/prometheus/OpenMetrics/blob/v1.0.0/specification/OpenMetrics.md#units-and-base-units
var unitMap = map[string]string{
	// Time
	"d":   "days",
	"h":   "hours",
	"min": "minutes",
	"s":   "seconds",
	"ms":  "milliseconds",
	"us":  "microseconds",
	"ns":  "nanoseconds",

	// Bytes
	"By":   "bytes",
	"KiBy": "kibibytes",
	"MiBy": "mebibytes",
	"GiBy": "gibibytes",
	"TiBy": "tibibytes",
	"KBy":  "kilobytes",
	"MBy":  "megabytes",
	"GBy":  "gigabytes",
	"TBy":  "terabytes",

	// SI
	"m": "meters",
	"V": "volts",
	"A": "amperes",
	"J": "joules",
	"W": "watts",
	"g": "grams",

	// Misc
	"Cel": "celsius",
	"Hz":  "hertz",
	"1":   "",
	"%":   "percent",
}

// The map that translates the "per" unit.
// Example: s => per second (singular).
var perUnitMap = map[string]string{
	"s":  "second",
	"m":  "minute",
	"h":  "hour",
	"d":  "day",
	"w":  "week",
	"mo": "month",
	"y":  "year",
}

// MetricNamer is a helper struct to build metric names.
// It converts OpenTelemetry Protocol (OTLP) metric names to Prometheus-compliant metric names.
//
// Example usage:
//
//	namer := MetricNamer{
//		WithMetricSuffixes: true,
//		UTF8Allowed:        false,
//	}
//
//	metric := Metric{
//		Name: "http.server.duration",
//		Unit: "s",
//		Type: MetricTypeHistogram,
//	}
//
//	result := namer.Build(metric) // "http_server_duration_seconds"
type MetricNamer struct {
	Namespace          string
	WithMetricSuffixes bool
	UTF8Allowed        bool
}

// NewMetricNamer creates a MetricNamer with the specified namespace (can be
// blank) and the requested Translation Strategy.
func NewMetricNamer(namespace string, strategy TranslationStrategyOption) MetricNamer {
	return MetricNamer{
		Namespace:          namespace,
		WithMetricSuffixes: strategy.ShouldAddSuffixes(),
		UTF8Allowed:        !strategy.ShouldEscape(),
	}
}

// Metric is a helper struct that holds information about a metric.
// It represents an OpenTelemetry metric with its name, unit, and type.
//
// Example:
//
//	metric := Metric{
//		Name: "http.server.request.duration",
//		Unit: "s",
//		Type: MetricTypeHistogram,
//	}
type Metric struct {
	Name string
	Unit string
	Type MetricType
}

// Build builds a metric name for the specified metric.
//
// The method applies different transformations based on the MetricNamer configuration:
//   - If UTF8Allowed is true, doesn't translate names - all characters must be valid UTF-8, however.
//   - If UTF8Allowed is false, translates metric names to comply with legacy Prometheus name scheme by escaping invalid characters to `_`.
//   - If WithMetricSuffixes is true, adds appropriate suffixes based on type and unit.
//
// See rules at https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels
//
// Examples:
//
//	namer := MetricNamer{WithMetricSuffixes: true, UTF8Allowed: false}
//
//	// Counter gets _total suffix
//	counter := Metric{Name: "requests.count", Unit: "1", Type: MetricTypeMonotonicCounter}
//	result := namer.Build(counter) // "requests_count_total"
//
//	// Gauge with unit suffix
//	gauge := Metric{Name: "memory.usage", Unit: "By", Type: MetricTypeGauge}
//	result = namer.Build(gauge) // "memory_usage_bytes"
func (mn *MetricNamer) Build(metric Metric) (string, error) {
	if mn.UTF8Allowed {
		return mn.buildMetricName(metric.Name, metric.Unit, metric.Type)
	}
	return mn.buildCompliantMetricName(metric.Name, metric.Unit, metric.Type)
}

func (mn *MetricNamer) buildCompliantMetricName(name, unit string, metricType MetricType) (normalizedName string, err error) {
	defer func() {
		if len(normalizedName) == 0 {
			err = fmt.Errorf("normalization for metric %q resulted in empty name", name)
			return
		}

		if normalizedName == name {
			return
		}

		// Check that the resulting normalized name contains at least one non-underscore character
		for _, c := range normalizedName {
			if c != '_' {
				return
			}
		}
		err = fmt.Errorf("normalization for metric %q resulted in invalid name %q", name, normalizedName)
		normalizedName = ""
	}()

	// Full normalization following standard Prometheus naming conventions
	if mn.WithMetricSuffixes {
		normalizedName = normalizeName(name, unit, metricType, mn.Namespace)
		return
	}

	// Simple case (no full normalization, no units, etc.).
	metricName := strings.Join(strings.FieldsFunc(name, func(r rune) bool {
		return !isValidCompliantMetricChar(r) && r != '_'
	}), "_")

	// Namespace?
	if mn.Namespace != "" {
		namespace := strings.Join(strings.FieldsFunc(mn.Namespace, func(r rune) bool {
			return !isValidCompliantMetricChar(r) && r != '_'
		}), "_")
		normalizedName = namespace + "_" + metricName
		return
	}

	// Metric name starts with a digit? Prefix it with an underscore.
	if metricName != "" && unicode.IsDigit(rune(metricName[0])) {
		metricName = "_" + metricName
	}

	normalizedName = metricName
	return
}

// isValidCompliantMetricChar checks if a rune is a valid metric name character (a-z, A-Z, 0-9, :).
func isValidCompliantMetricChar(r rune) bool {
	return (r >= 'a' && r <= 'z') ||
		(r >= 'A' && r <= 'Z') ||
		(r >= '0' && r <= '9') ||
		r == ':'
}

// replaceInvalidMetricChar replaces invalid metric name characters with underscore.
func replaceInvalidMetricChar(r rune) rune {
	if isValidCompliantMetricChar(r) {
		return r
	}
	return '_'
}

// Build a normalized name for the specified metric.
func normalizeName(name, unit string, metricType MetricType, namespace string) string {
	// Split metric name into "tokens" (of supported metric name runes).
	// Note that this has the side effect of replacing multiple consecutive underscores with a single underscore.
	// This is part of the OTel to Prometheus specification: https://github.com/open-telemetry/opentelemetry-specification/blob/v1.38.0/specification/compatibility/prometheus_and_openmetrics.md#otlp-metric-points-to-prometheus.
	nameTokens := strings.FieldsFunc(
		name,
		func(r rune) bool { return !isValidCompliantMetricChar(r) },
	)

	mainUnitSuffix, perUnitSuffix := buildUnitSuffixes(unit)
	nameTokens = addUnitTokens(nameTokens, cleanUpUnit(mainUnitSuffix), cleanUpUnit(perUnitSuffix))

	// Append _total for Counters
	if metricType == MetricTypeMonotonicCounter {
		nameTokens = append(removeItem(nameTokens, "total"), "total")
	}

	// Append _ratio for metrics with unit "1"
	// Some OTel receivers improperly use unit "1" for counters of objects
	// See https://github.com/open-telemetry/opentelemetry-collector-contrib/issues?q=is%3Aissue+some+metric+units+don%27t+follow+otel+semantic+conventions
	// Until these issues have been fixed, we're appending `_ratio` for gauges ONLY
	// Theoretically, counters could be ratios as well, but it's absurd (for mathematical reasons)
	if unit == "1" && metricType == MetricTypeGauge {
		nameTokens = append(removeItem(nameTokens, "ratio"), "ratio")
	}

	// Namespace?
	if namespace != "" {
		nameTokens = append([]string{namespace}, nameTokens...)
	}

	// Build the string from the tokens, separated with underscores
	normalizedName := strings.Join(nameTokens, "_")

	// Metric name cannot start with a digit, so prefix it with "_" in this case
	if normalizedName != "" && unicode.IsDigit(rune(normalizedName[0])) {
		normalizedName = "_" + normalizedName
	}

	return normalizedName
}

// addUnitTokens will add the suffixes to the nameTokens if they are not already present.
// It will also remove trailing underscores from the main suffix to avoid double underscores
// when joining the tokens.
//
// If the 'per' unit ends with underscore, the underscore will be removed. If the per unit is just
// 'per_', it will be entirely removed.
func addUnitTokens(nameTokens []string, mainUnitSuffix, perUnitSuffix string) []string {
	if slices.Contains(nameTokens, mainUnitSuffix) {
		mainUnitSuffix = ""
	}

	if perUnitSuffix == "per_" {
		perUnitSuffix = ""
	} else {
		perUnitSuffix = strings.TrimSuffix(perUnitSuffix, "_")
		if slices.Contains(nameTokens, perUnitSuffix) {
			perUnitSuffix = ""
		}
	}

	if perUnitSuffix != "" {
		mainUnitSuffix = strings.TrimSuffix(mainUnitSuffix, "_")
	}

	if mainUnitSuffix != "" {
		nameTokens = append(nameTokens, mainUnitSuffix)
	}
	if perUnitSuffix != "" {
		nameTokens = append(nameTokens, perUnitSuffix)
	}
	return nameTokens
}

// Remove the specified value from the slice.
func removeItem(slice []string, value string) []string {
	newSlice := make([]string, 0, len(slice))
	for _, sliceEntry := range slice {
		if sliceEntry != value {
			newSlice = append(newSlice, sliceEntry)
		}
	}
	return newSlice
}

func (mn *MetricNamer) buildMetricName(inputName, unit string, metricType MetricType) (name string, err error) {
	name = inputName
	if mn.Namespace != "" {
		name = mn.Namespace + "_" + name
	}

	if mn.WithMetricSuffixes {
		// Append _ratio for metrics with unit "1"
		// Some OTel receivers improperly use unit "1" for counters of objects
		// See https://github.com/open-telemetry/opentelemetry-collector-contrib/issues?q=is%3Aissue+some+metric+units+don%27t+follow+otel+semantic+conventions
		// Until these issues have been fixed, we're appending `_ratio` for gauges ONLY
		// Theoretically, counters could be ratios as well, but it's absurd (for mathematical reasons)
		if unit == "1" && metricType == MetricTypeGauge {
			name = trimSuffixAndDelimiter(name, "ratio")
			defer func() {
				name += "_ratio"
			}()
		}

		// Append _total for Counters.
		if metricType == MetricTypeMonotonicCounter {
			name = trimSuffixAndDelimiter(name, "total")
			defer func() {
				name += "_total"
			}()
		}

		mainUnitSuffix, perUnitSuffix := buildUnitSuffixes(unit)
		if perUnitSuffix != "" {
			name = trimSuffixAndDelimiter(name, perUnitSuffix)
			defer func() {
				name = name + "_" + perUnitSuffix
			}()
		}
		// We don't need to trim and re-append the suffix here because this is
		// the inner-most suffix.
		if mainUnitSuffix != "" && !strings.HasSuffix(name, mainUnitSuffix) {
			name = name + "_" + mainUnitSuffix
		}
	}
	return
}

// trimSuffixAndDelimiter trims a suffix, plus one extra character which is
// assumed to be a delimiter.
func trimSuffixAndDelimiter(name, suffix string) string {
	if strings.HasSuffix(name, suffix) && len(name) > len(suffix)+1 {
		return name[:len(name)-(len(suffix)+1)]
	}
	return name
}
