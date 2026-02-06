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

import "strings"

// UnitNamer is a helper for building compliant unit names.
// It processes OpenTelemetry Protocol (OTLP) unit strings and converts them
// to Prometheus-compliant unit names.
//
// Example usage:
//
//	namer := UnitNamer{UTF8Allowed: false}
//	result := namer.Build("s")     // "seconds"
//	result = namer.Build("By/s")   // "bytes_per_second"
type UnitNamer struct {
	UTF8Allowed bool
}

// Build builds a unit name for the specified unit string.
// It processes the unit by splitting it into main and per components,
// applying unit mappings, and cleaning up invalid characters when UTF8Allowed is false.
//
// Unit mappings include:
//   - Time: s→seconds, ms→milliseconds, h→hours
//   - Bytes: By→bytes, KBy→kilobytes, MBy→megabytes
//   - SI: m→meters, V→volts, W→watts
//   - Special: 1→"" (empty), %→percent
//
// Examples:
//
//	namer := UnitNamer{UTF8Allowed: false}
//	namer.Build("s")           // "seconds"
//	namer.Build("requests/s")  // "requests_per_second"
//	namer.Build("1")           // "" (dimensionless)
func (un *UnitNamer) Build(unit string) string {
	mainUnit, perUnit := buildUnitSuffixes(unit)
	if !un.UTF8Allowed {
		mainUnit, perUnit = cleanUpUnit(mainUnit), cleanUpUnit(perUnit)
	}

	var u string
	switch {
	case mainUnit != "" && perUnit != "":
		u = mainUnit + "_" + perUnit
	case mainUnit != "":
		u = mainUnit
	default:
		u = perUnit
	}

	// Clean up leading and trailing underscores
	if len(u) > 0 && u[0:1] == "_" {
		u = u[1:]
	}
	if len(u) > 0 && u[len(u)-1:] == "_" {
		u = u[:len(u)-1]
	}

	return u
}

// Retrieve the Prometheus "basic" unit corresponding to the specified "basic" unit.
// Returns the specified unit if not found in unitMap.
func unitMapGetOrDefault(unit string) string {
	if promUnit, ok := unitMap[unit]; ok {
		return promUnit
	}
	return unit
}

// Retrieve the Prometheus "per" unit corresponding to the specified "per" unit.
// Returns the specified unit if not found in perUnitMap.
func perUnitMapGetOrDefault(perUnit string) string {
	if promPerUnit, ok := perUnitMap[perUnit]; ok {
		return promPerUnit
	}
	return perUnit
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

// cleanUpUnit cleans up unit so it matches model.LabelNameRE.
func cleanUpUnit(unit string) string {
	// Multiple consecutive underscores are replaced with a single underscore.
	// This is part of the OTel to Prometheus specification: https://github.com/open-telemetry/opentelemetry-specification/blob/v1.38.0/specification/compatibility/prometheus_and_openmetrics.md#otlp-metric-points-to-prometheus.
	return strings.TrimPrefix(collapseMultipleUnderscores(
		strings.Map(replaceInvalidMetricChar, unit),
	), "_")
}
