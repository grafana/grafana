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
// Provenance-includes-location: https://github.com/prometheus/prometheus/blob/93e991ef7ed19cc997a9360c8016cac3767b8057/storage/remote/otlptranslator/prometheus/strconv.go.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Copyright The Prometheus Authors
// Provenance-includes-location: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/95e8f8fdc2a9dc87230406c9a3cf02be4fd68bea/pkg/translator/prometheus/normalize_name_test.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Copyright The OpenTelemetry Authors.

package otlptranslator

import (
	"strings"
)

// sanitizeLabelName replaces any characters not valid according to the
// classical Prometheus label naming scheme with an underscore.
// When preserveMultipleUnderscores is true, multiple consecutive underscores are preserved.
// When false, multiple consecutive underscores are collapsed to a single underscore.
func sanitizeLabelName(name string, preserveMultipleUnderscores bool) string {
	nameLength := len(name)

	if preserveMultipleUnderscores {
		// Simple case: just replace invalid characters, preserve multiple underscores
		var b strings.Builder
		b.Grow(nameLength)
		for _, r := range name {
			if isValidCompliantLabelChar(r) {
				b.WriteRune(r)
			} else {
				b.WriteRune('_')
			}
		}
		return b.String()
	}

	isReserved, labelName := isReservedLabel(name)
	if isReserved {
		name = labelName
	}

	// Collapse multiple underscores while replacing invalid characters.
	var b strings.Builder
	b.Grow(nameLength)
	prevWasUnderscore := false

	for _, r := range name {
		if isValidCompliantLabelChar(r) {
			b.WriteRune(r)
			prevWasUnderscore = false
		} else if !prevWasUnderscore {
			// Invalid character - replace with underscore.
			b.WriteRune('_')
			prevWasUnderscore = true
		}
	}
	if isReserved {
		return "__" + b.String() + "__"
	}
	return b.String()
}

// isValidCompliantLabelChar checks if a rune is a valid label name character (a-z, A-Z, 0-9).
func isValidCompliantLabelChar(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')
}

// isReservedLabel checks if a label is a reserved label.
// Reserved labels are labels that start and end with exactly __.
// The returned label name is the label name without the __ prefix and suffix.
func isReservedLabel(name string) (bool, string) {
	if len(name) < 4 {
		return false, ""
	}
	if !strings.HasPrefix(name, "__") || !strings.HasSuffix(name, "__") {
		return false, ""
	}
	return true, name[2 : len(name)-2]
}

// collapseMultipleUnderscores replaces multiple consecutive underscores with a single underscore.
// This is equivalent to regexp.MustCompile(`__+`).ReplaceAllString(s, "_") but without using regex.
func collapseMultipleUnderscores(s string) string {
	if len(s) == 0 {
		return s
	}

	var b strings.Builder
	b.Grow(len(s))
	prevWasUnderscore := false

	for _, r := range s {
		if r == '_' {
			if !prevWasUnderscore {
				b.WriteRune('_')
				prevWasUnderscore = true
			}
			// Skip consecutive underscores
		} else {
			b.WriteRune(r)
			prevWasUnderscore = false
		}
	}

	return b.String()
}
