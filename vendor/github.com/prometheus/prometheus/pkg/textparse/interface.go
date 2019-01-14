// Copyright 2018 The Prometheus Authors
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

package textparse

import (
	"mime"

	"github.com/prometheus/prometheus/pkg/labels"
)

// Parser parses samples from a byte slice of samples in the official
// Prometheus and OpenMetrics text exposition formats.
type Parser interface {
	// Series returns the bytes of the series, the timestamp if set, and the value
	// of the current sample.
	Series() ([]byte, *int64, float64)

	// Help returns the metric name and help text in the current entry.
	// Must only be called after Next returned a help entry.
	// The returned byte slices become invalid after the next call to Next.
	Help() ([]byte, []byte)

	// Type returns the metric name and type in the current entry.
	// Must only be called after Next returned a type entry.
	// The returned byte slices become invalid after the next call to Next.
	Type() ([]byte, MetricType)

	// Unit returns the metric name and unit in the current entry.
	// Must only be called after Next returned a unit entry.
	// The returned byte slices become invalid after the next call to Next.
	Unit() ([]byte, []byte)

	// Comment returns the text of the current comment.
	// Must only be called after Next returned a comment entry.
	// The returned byte slice becomes invalid after the next call to Next.
	Comment() []byte

	// Metric writes the labels of the current sample into the passed labels.
	// It returns the string from which the metric was parsed.
	Metric(l *labels.Labels) string

	// Next advances the parser to the next sample. It returns false if no
	// more samples were read or an error occurred.
	Next() (Entry, error)
}

// New returns a new parser of the byte slice.
func New(b []byte, contentType string) Parser {
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err == nil && mediaType == "application/openmetrics-text" {
		return NewOpenMetricsParser(b)
	}
	return NewPromParser(b)
}

// Entry represents the type of a parsed entry.
type Entry int

const (
	EntryInvalid Entry = -1
	EntryType    Entry = 0
	EntryHelp    Entry = 1
	EntrySeries  Entry = 2
	EntryComment Entry = 3
	EntryUnit    Entry = 4
)

// MetricType represents metric type values.
type MetricType string

const (
	MetricTypeCounter        = "counter"
	MetricTypeGauge          = "gauge"
	MetricTypeHistogram      = "histogram"
	MetricTypeGaugeHistogram = "gaugehistogram"
	MetricTypeSummary        = "summary"
	MetricTypeInfo           = "info"
	MetricTypeStateset       = "stateset"
	MetricTypeUnknown        = "unknown"
)
