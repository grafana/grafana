// Copyright 2024 The Prometheus Authors
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
// Provenance-includes-location: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/95e8f8fdc2a9dc87230406c9a3cf02be4fd68bea/pkg/translator/prometheus/normalize_name.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Copyright The OpenTelemetry Authors.

package prometheus

import (
	"regexp"
	"slices"
	"strings"
	"unicode"

	"go.opentelemetry.io/collector/pdata/pmetric"
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

// The map that translates the "per" unit
// Example: s => per second (singular)
var perUnitMap = map[string]string{
	"s":  "second",
	"m":  "minute",
	"h":  "hour",
	"d":  "day",
	"w":  "week",
	"mo": "month",
	"y":  "year",
}

// BuildCompliantMetricName builds a Prometheus-compliant metric name for the specified metric.
//
// Metric name is prefixed with specified namespace and underscore (if any).
// Namespace is not cleaned up. Make sure specified namespace follows Prometheus
// naming convention.
//
// See rules at https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels,
// https://prometheus.io/docs/practices/naming/#metric-and-label-naming
// and https://github.com/open-telemetry/opentelemetry-specification/blob/v1.38.0/specification/compatibility/prometheus_and_openmetrics.md#otlp-metric-points-to-prometheus.
func BuildCompliantMetricName(metric pmetric.Metric, namespace string, addMetricSuffixes bool) string {
	// Full normalization following standard Prometheus naming conventions
	if addMetricSuffixes {
		return normalizeName(metric, namespace)
	}

	// Simple case (no full normalization, no units, etc.).
	metricName := strings.Join(strings.FieldsFunc(metric.Name(), func(r rune) bool {
		return invalidMetricCharRE.MatchString(string(r))
	}), "_")

	// Namespace?
	if namespace != "" {
		return namespace + "_" + metricName
	}

	// Metric name starts with a digit? Prefix it with an underscore.
	if metricName != "" && unicode.IsDigit(rune(metricName[0])) {
		metricName = "_" + metricName
	}

	return metricName
}

var (
	nonMetricNameCharRE = regexp.MustCompile(`[^a-zA-Z0-9:]`)
	// Regexp for metric name characters that should be replaced with _.
	invalidMetricCharRE   = regexp.MustCompile(`[^a-zA-Z0-9:_]`)
	multipleUnderscoresRE = regexp.MustCompile(`__+`)
)

// Build a normalized name for the specified metric.
func normalizeName(metric pmetric.Metric, namespace string) string {
	// Split metric name into "tokens" (of supported metric name runes).
	// Note that this has the side effect of replacing multiple consecutive underscores with a single underscore.
	// This is part of the OTel to Prometheus specification: https://github.com/open-telemetry/opentelemetry-specification/blob/v1.38.0/specification/compatibility/prometheus_and_openmetrics.md#otlp-metric-points-to-prometheus.
	nameTokens := strings.FieldsFunc(
		metric.Name(),
		func(r rune) bool { return nonMetricNameCharRE.MatchString(string(r)) },
	)

	mainUnitSuffix, perUnitSuffix := buildUnitSuffixes(metric.Unit())
	nameTokens = addUnitTokens(nameTokens, cleanUpUnit(mainUnitSuffix), cleanUpUnit(perUnitSuffix))

	// Append _total for Counters
	if metric.Type() == pmetric.MetricTypeSum && metric.Sum().IsMonotonic() {
		nameTokens = append(removeItem(nameTokens, "total"), "total")
	}

	// Append _ratio for metrics with unit "1"
	// Some OTel receivers improperly use unit "1" for counters of objects
	// See https://github.com/open-telemetry/opentelemetry-collector-contrib/issues?q=is%3Aissue+some+metric+units+don%27t+follow+otel+semantic+conventions
	// Until these issues have been fixed, we're appending `_ratio` for gauges ONLY
	// Theoretically, counters could be ratios as well, but it's absurd (for mathematical reasons)
	if metric.Unit() == "1" && metric.Type() == pmetric.MetricTypeGauge {
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

// cleanUpUnit cleans up unit so it matches model.LabelNameRE.
func cleanUpUnit(unit string) string {
	// Multiple consecutive underscores are replaced with a single underscore.
	// This is part of the OTel to Prometheus specification: https://github.com/open-telemetry/opentelemetry-specification/blob/v1.38.0/specification/compatibility/prometheus_and_openmetrics.md#otlp-metric-points-to-prometheus.
	return strings.TrimPrefix(multipleUnderscoresRE.ReplaceAllString(
		nonMetricNameCharRE.ReplaceAllString(unit, "_"),
		"_",
	), "_")
}

// Retrieve the Prometheus "basic" unit corresponding to the specified "basic" unit
// Returns the specified unit if not found in unitMap
func unitMapGetOrDefault(unit string) string {
	if promUnit, ok := unitMap[unit]; ok {
		return promUnit
	}
	return unit
}

// Retrieve the Prometheus "per" unit corresponding to the specified "per" unit
// Returns the specified unit if not found in perUnitMap
func perUnitMapGetOrDefault(perUnit string) string {
	if promPerUnit, ok := perUnitMap[perUnit]; ok {
		return promPerUnit
	}
	return perUnit
}

// Remove the specified value from the slice
func removeItem(slice []string, value string) []string {
	newSlice := make([]string, 0, len(slice))
	for _, sliceEntry := range slice {
		if sliceEntry != value {
			newSlice = append(newSlice, sliceEntry)
		}
	}
	return newSlice
}

// BuildMetricName builds a valid metric name but without following Prometheus naming conventions.
// It doesn't do any character transformation, it only prefixes the metric name with the namespace, if any,
// and adds metric type suffixes, e.g. "_total" for counters and unit suffixes.
//
// Differently from BuildCompliantMetricName, it doesn't check for the presence of unit and type suffixes.
// If "addMetricSuffixes" is true, it will add them anyway.
//
// Please use BuildCompliantMetricName for a metric name that follows Prometheus naming conventions.
func BuildMetricName(metric pmetric.Metric, namespace string, addMetricSuffixes bool) string {
	metricName := metric.Name()

	if namespace != "" {
		metricName = namespace + "_" + metricName
	}

	if addMetricSuffixes {
		mainUnitSuffix, perUnitSuffix := buildUnitSuffixes(metric.Unit())
		if mainUnitSuffix != "" {
			metricName = metricName + "_" + mainUnitSuffix
		}
		if perUnitSuffix != "" {
			metricName = metricName + "_" + perUnitSuffix
		}

		// Append _total for Counters
		if metric.Type() == pmetric.MetricTypeSum && metric.Sum().IsMonotonic() {
			metricName = metricName + "_total"
		}

		// Append _ratio for metrics with unit "1"
		// Some OTel receivers improperly use unit "1" for counters of objects
		// See https://github.com/open-telemetry/opentelemetry-collector-contrib/issues?q=is%3Aissue+some+metric+units+don%27t+follow+otel+semantic+conventions
		// Until these issues have been fixed, we're appending `_ratio` for gauges ONLY
		// Theoretically, counters could be ratios as well, but it's absurd (for mathematical reasons)
		if metric.Unit() == "1" && metric.Type() == pmetric.MetricTypeGauge {
			metricName = metricName + "_ratio"
		}
	}
	return metricName
}

// buildUnitSuffixes builds the main and per unit suffixes for the specified unit
// but doesn't do any special character transformation to accommodate Prometheus naming conventions.
// Removing trailing underscores or appending suffixes is done in the caller.
func buildUnitSuffixes(unit string) (mainUnitSuffix, perUnitSuffix string) {
	// Split unit at the '/' if any
	unitTokens := strings.SplitN(unit, "/", 2)

	if len(unitTokens) > 0 {
		// Main unit
		// Update if not blank and doesn't contain '{}'
		mainUnitOTel := strings.TrimSpace(unitTokens[0])
		if mainUnitOTel != "" && !strings.ContainsAny(mainUnitOTel, "{}") {
			mainUnitSuffix = unitMapGetOrDefault(mainUnitOTel)
		}

		// Per unit
		// Update if not blank and doesn't contain '{}'
		if len(unitTokens) > 1 && unitTokens[1] != "" {
			perUnitOTel := strings.TrimSpace(unitTokens[1])
			if perUnitOTel != "" && !strings.ContainsAny(perUnitOTel, "{}") {
				perUnitSuffix = perUnitMapGetOrDefault(perUnitOTel)
			}
			if perUnitSuffix != "" {
				perUnitSuffix = "per_" + perUnitSuffix
			}
		}
	}

	return mainUnitSuffix, perUnitSuffix
}
