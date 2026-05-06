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
// Provenance-includes-location: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/95e8f8fdc2a9dc87230406c9a3cf02be4fd68bea/pkg/translator/prometheus/normalize_label.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Copyright The OpenTelemetry Authors.

package prometheus

import (
	"strings"
	"unicode"

	"github.com/prometheus/prometheus/util/strutil"
)

// Normalizes the specified label to follow Prometheus label names standard.
//
// See rules at https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels.
//
// Labels that start with non-letter rune will be prefixed with "key_".
// An exception is made for double-underscores which are allowed.
func NormalizeLabel(label string) string {
	// Trivial case.
	if len(label) == 0 {
		return label
	}

	label = strutil.SanitizeLabelName(label)

	// If label starts with a number, prepend with "key_".
	if unicode.IsDigit(rune(label[0])) {
		label = "key_" + label
	} else if strings.HasPrefix(label, "_") && !strings.HasPrefix(label, "__") {
		label = "key" + label
	}

	return label
}
