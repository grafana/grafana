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
// Provenance-includes-location: https://github.com/prometheus/prometheus/blob/93e991ef7ed19cc997a9360c8016cac3767b8057/storage/remote/otlptranslator/prometheus/normalize_label.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Copyright The Prometheus Authors
// Provenance-includes-location: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/95e8f8fdc2a9dc87230406c9a3cf02be4fd68bea/pkg/translator/prometheus/normalize_label.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Copyright The OpenTelemetry Authors.

package otlptranslator

import (
	"errors"
	"fmt"
	"strings"
	"unicode"
)

// LabelNamer is a helper struct to build label names.
// It translates OpenTelemetry Protocol (OTLP) attribute names to Prometheus-compliant label names.
//
// Example usage:
//
//	namer := LabelNamer{UTF8Allowed: false}
//	result := namer.Build("http.method") // "http_method"
type LabelNamer struct {
	UTF8Allowed bool
	// UnderscoreLabelSanitization, if true, enabled prepending 'key' to labels
	// starting with '_'. Reserved labels starting with `__` are not modified.
	//
	// Deprecated: This will be removed in a future version of otlptranslator.
	UnderscoreLabelSanitization bool
	// PreserveMultipleUnderscores enables preserving of multiple
	// consecutive underscores in label names when UTF8Allowed is false.
	// This option is discouraged as it violates the OpenTelemetry to Prometheus
	// specification https://github.com/open-telemetry/opentelemetry-specification/blob/v1.38.0/specification/compatibility/prometheus_and_openmetrics.md#otlp-metric-points-to-prometheus),
	// but may be needed for compatibility with legacy systems that rely on the old behavior.
	PreserveMultipleUnderscores bool
}

// Build normalizes the specified label to follow Prometheus label names standard.
//
// Translation rules:
//   - Replaces invalid characters with underscores
//   - Prefixes labels with invalid start characters (numbers or `_`) with "key"
//   - Preserves double underscore labels (reserved names)
//   - If UTF8Allowed is true, returns label as-is
//
// Examples:
//
//	namer := LabelNamer{UTF8Allowed: false}
//	namer.Build("http.method")     // "http_method"
//	namer.Build("123invalid")      // "key_123invalid"
//	namer.Build("__reserved__")    // "__reserved__" (preserved)
func (ln *LabelNamer) Build(label string) (string, error) {
	if len(label) == 0 {
		return "", errors.New("label name is empty")
	}

	if ln.UTF8Allowed {
		if hasUnderscoresOnly(label) {
			return "", fmt.Errorf("label name %q contains only underscores", label)
		}
		return label, nil
	}

	normalizedName := sanitizeLabelName(label, ln.PreserveMultipleUnderscores)

	// If label starts with a number, prepend with "key_".
	if unicode.IsDigit(rune(normalizedName[0])) {
		normalizedName = "key_" + normalizedName
	} else if ln.UnderscoreLabelSanitization && strings.HasPrefix(normalizedName, "_") && !strings.HasPrefix(normalizedName, "__") {
		normalizedName = "key" + normalizedName
	}

	if hasUnderscoresOnly(normalizedName) {
		return "", fmt.Errorf("normalization for label name %q resulted in invalid name %q", label, normalizedName)
	}

	return normalizedName, nil
}

func hasUnderscoresOnly(label string) bool {
	for _, c := range label {
		if c != '_' {
			return false
		}
	}
	return true
}
