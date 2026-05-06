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
	"errors"
	"fmt"
	"mime"

	"github.com/prometheus/common/model"

	"github.com/prometheus/prometheus/model/exemplar"
	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
)

// Parser parses samples from a byte slice of samples in different exposition formats.
type Parser interface {
	// Series returns the bytes of a series with a simple float64 as a
	// value, the timestamp if set, and the value of the current sample.
	// TODO(bwplotka): Similar to CreatedTimestamp, have ts == 0 meaning no timestamp provided.
	// We already accepted in many places (PRW, proto parsing histograms) that 0 timestamp is not a
	// a valid timestamp. If needed it can be represented as 0+1ms.
	Series() ([]byte, *int64, float64)

	// Histogram returns the bytes of a series with a sparse histogram as a
	// value, the timestamp if set, and the histogram in the current sample.
	// Depending on the parsed input, the function returns an (integer) Histogram
	// or a FloatHistogram, with the respective other return value being nil.
	// TODO(bwplotka): Similar to CreatedTimestamp, have ts == 0 meaning no timestamp provided.
	// We already accepted in many places (PRW, proto parsing histograms) that 0 timestamp is not a
	// a valid timestamp. If needed it can be represented as 0+1ms.
	Histogram() ([]byte, *int64, *histogram.Histogram, *histogram.FloatHistogram)

	// Help returns the metric name and help text in the current entry.
	// Must only be called after Next returned a help entry.
	// The returned byte slices become invalid after the next call to Next.
	Help() ([]byte, []byte)

	// Type returns the metric name and type in the current entry.
	// Must only be called after Next returned a type entry.
	// The returned byte slices become invalid after the next call to Next.
	Type() ([]byte, model.MetricType)

	// Unit returns the metric name and unit in the current entry.
	// Must only be called after Next returned a unit entry.
	// The returned byte slices become invalid after the next call to Next.
	Unit() ([]byte, []byte)

	// Comment returns the text of the current comment.
	// Must only be called after Next returned a comment entry.
	// The returned byte slice becomes invalid after the next call to Next.
	Comment() []byte

	// Labels writes the labels of the current sample into the passed labels.
	// The values of the "le" labels of classic histograms and "quantile" labels
	// of summaries should follow the OpenMetrics formatting rules.
	Labels(l *labels.Labels)

	// Exemplar writes the exemplar of the current sample into the passed
	// exemplar. It can be called repeatedly to retrieve multiple exemplars
	// for the same sample. It returns false once all exemplars are
	// retrieved (including the case where no exemplars exist at all).
	Exemplar(l *exemplar.Exemplar) bool

	// CreatedTimestamp returns the created timestamp (in milliseconds) for the
	// current sample. It returns 0 if it is unknown e.g. if it wasn't set or
	// if the scrape protocol or metric type does not support created timestamps.
	CreatedTimestamp() int64

	// Next advances the parser to the next sample.
	// It returns (EntryInvalid, io.EOF) if no samples were read.
	Next() (Entry, error)
}

// extractMediaType returns the mediaType of a required parser. It tries first to
// extract a valid and supported mediaType from contentType. If that fails,
// the provided fallbackType (possibly an empty string) is returned, together with
// an error. fallbackType is used as-is without further validation.
func extractMediaType(contentType, fallbackType string) (string, error) {
	if contentType == "" {
		if fallbackType == "" {
			return "", errors.New("non-compliant scrape target sending blank Content-Type and no fallback_scrape_protocol specified for target")
		}
		return fallbackType, fmt.Errorf("non-compliant scrape target sending blank Content-Type, using fallback_scrape_protocol %q", fallbackType)
	}

	// We have a contentType, parse it.
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		if fallbackType == "" {
			retErr := fmt.Errorf("cannot parse Content-Type %q and no fallback_scrape_protocol for target", contentType)
			return "", errors.Join(retErr, err)
		}
		retErr := fmt.Errorf("could not parse received Content-Type %q, using fallback_scrape_protocol %q", contentType, fallbackType)
		return fallbackType, errors.Join(retErr, err)
	}

	// We have a valid media type, either we recognise it and can use it
	// or we have to error.
	switch mediaType {
	case "application/openmetrics-text", "application/vnd.google.protobuf", "text/plain":
		return mediaType, nil
	}
	// We're here because we have no recognised mediaType.
	if fallbackType == "" {
		return "", fmt.Errorf("received unsupported Content-Type %q and no fallback_scrape_protocol specified for target", contentType)
	}
	return fallbackType, fmt.Errorf("received unsupported Content-Type %q, using fallback_scrape_protocol %q", contentType, fallbackType)
}

// New returns a new parser of the byte slice.
//
// This function no longer guarantees to return a valid parser.
//
// It only returns a valid parser if the supplied contentType and fallbackType allow.
// An error may also be returned if fallbackType had to be used or there was some
// other error parsing the supplied Content-Type.
// If the returned parser is nil then the scrape must fail.
func New(b []byte, contentType, fallbackType string, parseClassicHistograms, skipOMCTSeries bool, st *labels.SymbolTable) (Parser, error) {
	mediaType, err := extractMediaType(contentType, fallbackType)
	// err may be nil or something we want to warn about.

	switch mediaType {
	case "application/openmetrics-text":
		return NewOpenMetricsParser(b, st, func(o *openMetricsParserOptions) {
			o.SkipCTSeries = skipOMCTSeries
		}), err
	case "application/vnd.google.protobuf":
		return NewProtobufParser(b, parseClassicHistograms, st), err
	case "text/plain":
		return NewPromParser(b, st), err
	default:
		return nil, err
	}
}

// Entry represents the type of a parsed entry.
type Entry int

const (
	EntryInvalid   Entry = -1
	EntryType      Entry = 0
	EntryHelp      Entry = 1
	EntrySeries    Entry = 2 // EntrySeries marks a series with a simple float64 as value.
	EntryComment   Entry = 3
	EntryUnit      Entry = 4
	EntryHistogram Entry = 5 // EntryHistogram marks a series with a native histogram as a value.
)
