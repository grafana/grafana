// Copyright 2021 The Prometheus Authors
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
	"bytes"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/gogo/protobuf/types"
	"github.com/prometheus/common/model"

	"github.com/prometheus/prometheus/model/exemplar"
	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"

	dto "github.com/prometheus/prometheus/prompb/io/prometheus/client"
)

// floatFormatBufPool is exclusively used in formatOpenMetricsFloat.
var floatFormatBufPool = sync.Pool{
	New: func() interface{} {
		// To contain at most 17 digits and additional syntax for a float64.
		b := make([]byte, 0, 24)
		return &b
	},
}

// ProtobufParser parses the old Prometheus protobuf format and present it
// as the text-style textparse.Parser interface.
//
// It uses a tailored streaming protobuf dto.MetricStreamingDecoder that
// reuses internal protobuf structs and allows direct unmarshalling to Prometheus
// types like labels.
type ProtobufParser struct {
	dec *dto.MetricStreamingDecoder

	// Used for both the string returned by Series and Histogram, as well as,
	// metric family for Type, Unit and Help.
	entryBytes *bytes.Buffer

	lset    labels.Labels
	builder labels.ScratchBuilder // Held here to reduce allocations when building Labels.

	// fieldPos is the position within a Summary or (legacy) Histogram. -2
	// is the count. -1 is the sum. Otherwise, it is the index within
	// quantiles/buckets.
	fieldPos    int
	fieldsDone  bool // true if no more fields of a Summary or (legacy) Histogram to be processed.
	redoClassic bool // true after parsing a native histogram if we need to parse it again as a classic histogram.
	// exemplarPos is the position within the exemplars slice of a native histogram.
	exemplarPos int

	// exemplarReturned is set to true each time an exemplar has been
	// returned, and set back to false upon each Next() call.
	exemplarReturned bool

	// state is marked by the entry we are processing. EntryInvalid implies
	// that we have to decode the next MetricFamily.
	state Entry

	// Whether to also parse a classic histogram that is also present as a
	// native histogram.
	parseClassicHistograms bool
}

// NewProtobufParser returns a parser for the payload in the byte slice.
func NewProtobufParser(b []byte, parseClassicHistograms bool, st *labels.SymbolTable) Parser {
	return &ProtobufParser{
		dec:        dto.NewMetricStreamingDecoder(b),
		entryBytes: &bytes.Buffer{},
		builder:    labels.NewScratchBuilderWithSymbolTable(st, 16), // TODO(bwplotka): Try base builder.

		state:                  EntryInvalid,
		parseClassicHistograms: parseClassicHistograms,
	}
}

// Series returns the bytes of a series with a simple float64 as a
// value, the timestamp if set, and the value of the current sample.
func (p *ProtobufParser) Series() ([]byte, *int64, float64) {
	var (
		ts = &p.dec.TimestampMs // To save memory allocations, never nil.
		v  float64
	)
	switch p.dec.GetType() {
	case dto.MetricType_COUNTER:
		v = p.dec.GetCounter().GetValue()
	case dto.MetricType_GAUGE:
		v = p.dec.GetGauge().GetValue()
	case dto.MetricType_UNTYPED:
		v = p.dec.GetUntyped().GetValue()
	case dto.MetricType_SUMMARY:
		s := p.dec.GetSummary()
		switch p.fieldPos {
		case -2:
			v = float64(s.GetSampleCount())
		case -1:
			v = s.GetSampleSum()
			// Need to detect summaries without quantile here.
			if len(s.GetQuantile()) == 0 {
				p.fieldsDone = true
			}
		default:
			v = s.GetQuantile()[p.fieldPos].GetValue()
		}
	case dto.MetricType_HISTOGRAM, dto.MetricType_GAUGE_HISTOGRAM:
		// This should only happen for a classic histogram.
		h := p.dec.GetHistogram()
		switch p.fieldPos {
		case -2:
			v = h.GetSampleCountFloat()
			if v == 0 {
				v = float64(h.GetSampleCount())
			}
		case -1:
			v = h.GetSampleSum()
		default:
			bb := h.GetBucket()
			if p.fieldPos >= len(bb) {
				v = h.GetSampleCountFloat()
				if v == 0 {
					v = float64(h.GetSampleCount())
				}
			} else {
				v = bb[p.fieldPos].GetCumulativeCountFloat()
				if v == 0 {
					v = float64(bb[p.fieldPos].GetCumulativeCount())
				}
			}
		}
	default:
		panic("encountered unexpected metric type, this is a bug")
	}
	if *ts != 0 {
		return p.entryBytes.Bytes(), ts, v
	}
	// TODO(beorn7): We assume here that ts==0 means no timestamp. That's
	// not true in general, but proto3 originally has no distinction between
	// unset and default. At a later stage, the `optional` keyword was
	// (re-)introduced in proto3, but gogo-protobuf never got updated to
	// support it. (Note that setting `[(gogoproto.nullable) = true]` for
	// the `timestamp_ms` field doesn't help, either.) We plan to migrate
	// away from gogo-protobuf to an actively maintained protobuf
	// implementation. Once that's done, we can simply use the `optional`
	// keyword and check for the unset state explicitly.
	return p.entryBytes.Bytes(), nil, v
}

// Histogram returns the bytes of a series with a native histogram as a value,
// the timestamp if set, and the native histogram in the current sample.
//
// The Compact method is called before returning the Histogram (or FloatHistogram).
//
// If the SampleCountFloat or the ZeroCountFloat in the proto message is > 0,
// the histogram is parsed and returned as a FloatHistogram and nil is returned
// as the (integer) Histogram return value. Otherwise, it is parsed and returned
// as an (integer) Histogram and nil is returned as the FloatHistogram return
// value.
func (p *ProtobufParser) Histogram() ([]byte, *int64, *histogram.Histogram, *histogram.FloatHistogram) {
	var (
		ts = &p.dec.TimestampMs // To save memory allocations, never nil.
		h  = p.dec.GetHistogram()
	)

	if p.parseClassicHistograms && len(h.GetBucket()) > 0 {
		p.redoClassic = true
	}
	if h.GetSampleCountFloat() > 0 || h.GetZeroCountFloat() > 0 {
		// It is a float histogram.
		fh := histogram.FloatHistogram{
			Count:         h.GetSampleCountFloat(),
			Sum:           h.GetSampleSum(),
			ZeroThreshold: h.GetZeroThreshold(),
			ZeroCount:     h.GetZeroCountFloat(),
			Schema:        h.GetSchema(),

			// Decoder reuses slices, so we need to copy.
			PositiveSpans:   make([]histogram.Span, len(h.GetPositiveSpan())),
			PositiveBuckets: make([]float64, len(h.GetPositiveCount())),
			NegativeSpans:   make([]histogram.Span, len(h.GetNegativeSpan())),
			NegativeBuckets: make([]float64, len(h.GetNegativeCount())),
		}
		for i, span := range h.GetPositiveSpan() {
			fh.PositiveSpans[i].Offset = span.GetOffset()
			fh.PositiveSpans[i].Length = span.GetLength()
		}
		for i, cnt := range h.GetPositiveCount() {
			fh.PositiveBuckets[i] = cnt
		}
		for i, span := range h.GetNegativeSpan() {
			fh.NegativeSpans[i].Offset = span.GetOffset()
			fh.NegativeSpans[i].Length = span.GetLength()
		}
		for i, cnt := range h.GetNegativeCount() {
			fh.NegativeBuckets[i] = cnt
		}
		if p.dec.GetType() == dto.MetricType_GAUGE_HISTOGRAM {
			fh.CounterResetHint = histogram.GaugeType
		}
		fh.Compact(0)
		if *ts != 0 {
			return p.entryBytes.Bytes(), ts, nil, &fh
		}
		// Nasty hack: Assume that ts==0 means no timestamp. That's not true in
		// general, but proto3 has no distinction between unset and
		// default. Need to avoid in the final format.
		return p.entryBytes.Bytes(), nil, nil, &fh
	}

	// TODO(bwplotka): Create sync.Pool for those structs.
	sh := histogram.Histogram{
		Count:           h.GetSampleCount(),
		Sum:             h.GetSampleSum(),
		ZeroThreshold:   h.GetZeroThreshold(),
		ZeroCount:       h.GetZeroCount(),
		Schema:          h.GetSchema(),
		PositiveSpans:   make([]histogram.Span, len(h.GetPositiveSpan())),
		PositiveBuckets: make([]int64, len(h.GetPositiveDelta())),
		NegativeSpans:   make([]histogram.Span, len(h.GetNegativeSpan())),
		NegativeBuckets: make([]int64, len(h.GetNegativeDelta())),
	}
	for i, span := range h.GetPositiveSpan() {
		sh.PositiveSpans[i].Offset = span.GetOffset()
		sh.PositiveSpans[i].Length = span.GetLength()
	}
	for i, cnt := range h.GetPositiveDelta() {
		sh.PositiveBuckets[i] = cnt
	}
	for i, span := range h.GetNegativeSpan() {
		sh.NegativeSpans[i].Offset = span.GetOffset()
		sh.NegativeSpans[i].Length = span.GetLength()
	}
	for i, cnt := range h.GetNegativeDelta() {
		sh.NegativeBuckets[i] = cnt
	}
	if p.dec.GetType() == dto.MetricType_GAUGE_HISTOGRAM {
		sh.CounterResetHint = histogram.GaugeType
	}
	sh.Compact(0)
	if *ts != 0 {
		return p.entryBytes.Bytes(), ts, &sh, nil
	}
	return p.entryBytes.Bytes(), nil, &sh, nil
}

// Help returns the metric name and help text in the current entry.
// Must only be called after Next returned a help entry.
// The returned byte slices become invalid after the next call to Next.
func (p *ProtobufParser) Help() ([]byte, []byte) {
	return p.entryBytes.Bytes(), yoloBytes(p.dec.GetHelp())
}

// Type returns the metric name and type in the current entry.
// Must only be called after Next returned a type entry.
// The returned byte slices become invalid after the next call to Next.
func (p *ProtobufParser) Type() ([]byte, model.MetricType) {
	n := p.entryBytes.Bytes()
	switch p.dec.GetType() {
	case dto.MetricType_COUNTER:
		return n, model.MetricTypeCounter
	case dto.MetricType_GAUGE:
		return n, model.MetricTypeGauge
	case dto.MetricType_HISTOGRAM:
		return n, model.MetricTypeHistogram
	case dto.MetricType_GAUGE_HISTOGRAM:
		return n, model.MetricTypeGaugeHistogram
	case dto.MetricType_SUMMARY:
		return n, model.MetricTypeSummary
	}
	return n, model.MetricTypeUnknown
}

// Unit returns the metric unit in the current entry.
// Must only be called after Next returned a unit entry.
// The returned byte slices become invalid after the next call to Next.
func (p *ProtobufParser) Unit() ([]byte, []byte) {
	return p.entryBytes.Bytes(), []byte(p.dec.GetUnit())
}

// Comment always returns nil because comments aren't supported by the protobuf
// format.
func (p *ProtobufParser) Comment() []byte {
	return nil
}

// Labels writes the labels of the current sample into the passed labels.
func (p *ProtobufParser) Labels(l *labels.Labels) {
	*l = p.lset.Copy()
}

// Exemplar writes the exemplar of the current sample into the passed
// exemplar. It returns if an exemplar exists or not. In case of a native
// histogram, the exemplars in the native histogram will be returned.
// If this field is empty, the classic bucket section is still used for exemplars.
// To ingest all exemplars, call the Exemplar method repeatedly until it returns false.
func (p *ProtobufParser) Exemplar(ex *exemplar.Exemplar) bool {
	if p.exemplarReturned && p.state == EntrySeries {
		// We only ever return one exemplar per (non-native-histogram) series.
		return false
	}
	var exProto *dto.Exemplar
	switch p.dec.GetType() {
	case dto.MetricType_COUNTER:
		exProto = p.dec.GetCounter().GetExemplar()
	case dto.MetricType_HISTOGRAM, dto.MetricType_GAUGE_HISTOGRAM:
		isClassic := p.state == EntrySeries
		if !isClassic && len(p.dec.GetHistogram().GetExemplars()) > 0 {
			exs := p.dec.GetHistogram().GetExemplars()
			for p.exemplarPos < len(exs) {
				exProto = exs[p.exemplarPos]
				p.exemplarPos++
				if exProto != nil && exProto.GetTimestamp() != nil {
					break
				}
			}
			if exProto != nil && exProto.GetTimestamp() == nil {
				return false
			}
		} else {
			bb := p.dec.GetHistogram().GetBucket()
			if p.fieldPos < 0 {
				if isClassic {
					return false // At _count or _sum.
				}
				p.fieldPos = 0 // Start at 1st bucket for native histograms.
			}
			for p.fieldPos < len(bb) {
				exProto = bb[p.fieldPos].GetExemplar()
				if isClassic {
					break
				}
				p.fieldPos++
				// We deliberately drop exemplars with no timestamp only for native histograms.
				if exProto != nil && (isClassic || exProto.GetTimestamp() != nil) {
					break // Found a classic histogram exemplar or a native histogram exemplar with a timestamp.
				}
			}
			// If the last exemplar for native histograms has no timestamp, ignore it.
			if !isClassic && exProto.GetTimestamp() == nil {
				return false
			}
		}
	default:
		return false
	}
	if exProto == nil {
		return false
	}
	ex.Value = exProto.GetValue()
	if ts := exProto.GetTimestamp(); ts != nil {
		ex.HasTs = true
		ex.Ts = ts.GetSeconds()*1000 + int64(ts.GetNanos()/1_000_000)
	}
	p.builder.Reset()
	for _, lp := range exProto.GetLabel() {
		p.builder.Add(lp.GetName(), lp.GetValue())
	}
	p.builder.Sort()
	ex.Labels = p.builder.Labels()
	p.exemplarReturned = true
	return true
}

// CreatedTimestamp returns CT or 0 if CT is not present on counters, summaries or histograms.
func (p *ProtobufParser) CreatedTimestamp() int64 {
	var ct *types.Timestamp
	switch p.dec.GetType() {
	case dto.MetricType_COUNTER:
		ct = p.dec.GetCounter().GetCreatedTimestamp()
	case dto.MetricType_SUMMARY:
		ct = p.dec.GetSummary().GetCreatedTimestamp()
	case dto.MetricType_HISTOGRAM, dto.MetricType_GAUGE_HISTOGRAM:
		ct = p.dec.GetHistogram().GetCreatedTimestamp()
	default:
	}
	if ct == nil {
		return 0
	}
	// Same as the gogo proto types.TimestampFromProto but straight to integer.
	// and without validation.
	return ct.GetSeconds()*1e3 + int64(ct.GetNanos())/1e6
}

// Next advances the parser to the next "sample" (emulating the behavior of a
// text format parser). It returns (EntryInvalid, io.EOF) if no samples were
// read.
func (p *ProtobufParser) Next() (Entry, error) {
	p.exemplarReturned = false
	switch p.state {
	// Invalid state occurs on:
	// * First Next() call.
	// * Recursive call that tells Next to move to the next metric family.
	case EntryInvalid:
		p.exemplarPos = 0
		p.fieldPos = -2

		if err := p.dec.NextMetricFamily(); err != nil {
			return p.state, err
		}
		if err := p.dec.NextMetric(); err != nil {
			// Skip empty metric families.
			if errors.Is(err, io.EOF) {
				return p.Next()
			}
			return EntryInvalid, err
		}

		// We are at the beginning of a metric family. Put only the name
		// into entryBytes and validate only name, help, and type for now.
		name := p.dec.GetName()
		if !model.IsValidMetricName(model.LabelValue(name)) {
			return EntryInvalid, fmt.Errorf("invalid metric name: %s", name)
		}
		if help := p.dec.GetHelp(); !utf8.ValidString(help) {
			return EntryInvalid, fmt.Errorf("invalid help for metric %q: %s", name, help)
		}
		switch p.dec.GetType() {
		case dto.MetricType_COUNTER,
			dto.MetricType_GAUGE,
			dto.MetricType_HISTOGRAM,
			dto.MetricType_GAUGE_HISTOGRAM,
			dto.MetricType_SUMMARY,
			dto.MetricType_UNTYPED:
			// All good.
		default:
			return EntryInvalid, fmt.Errorf("unknown metric type for metric %q: %s", name, p.dec.GetType())
		}
		unit := p.dec.GetUnit()
		if len(unit) > 0 {
			if p.dec.GetType() == dto.MetricType_COUNTER && strings.HasSuffix(name, "_total") {
				if !strings.HasSuffix(name[:len(name)-6], unit) || len(name)-6 < len(unit)+1 || name[len(name)-6-len(unit)-1] != '_' {
					return EntryInvalid, fmt.Errorf("unit %q not a suffix of counter %q", unit, name)
				}
			} else if !strings.HasSuffix(name, unit) || len(name) < len(unit)+1 || name[len(name)-len(unit)-1] != '_' {
				return EntryInvalid, fmt.Errorf("unit %q not a suffix of metric %q", unit, name)
			}
		}
		p.entryBytes.Reset()
		p.entryBytes.WriteString(name)
		p.state = EntryHelp
	case EntryHelp:
		if p.dec.Unit != "" {
			p.state = EntryUnit
		} else {
			p.state = EntryType
		}
	case EntryUnit:
		p.state = EntryType
	case EntryType:
		t := p.dec.GetType()
		if (t == dto.MetricType_HISTOGRAM || t == dto.MetricType_GAUGE_HISTOGRAM) &&
			isNativeHistogram(p.dec.GetHistogram()) {
			p.state = EntryHistogram
		} else {
			p.state = EntrySeries
		}
		if err := p.onSeriesOrHistogramUpdate(); err != nil {
			return EntryInvalid, err
		}
	case EntrySeries:
		// Potentially a second series in the metric family.
		t := p.dec.GetType()
		if t == dto.MetricType_SUMMARY ||
			t == dto.MetricType_HISTOGRAM ||
			t == dto.MetricType_GAUGE_HISTOGRAM {
			// Non-trivial series (complex metrics, with magic suffixes).

			// Did we iterate over all the classic representations fields?
			// NOTE: p.fieldsDone is updated on p.onSeriesOrHistogramUpdate.
			if !p.fieldsDone {
				// Still some fields to iterate over.
				p.fieldPos++
				if err := p.onSeriesOrHistogramUpdate(); err != nil {
					return EntryInvalid, err
				}
				return p.state, nil
			}

			// Reset histogram fields.
			p.fieldPos = -2
			p.fieldsDone = false
			p.exemplarPos = 0

			// If this is a metric family containing native
			// histograms, it means we are here thanks to redoClassic state.
			// Return to native histograms for the consistent flow.
			if (t == dto.MetricType_HISTOGRAM || t == dto.MetricType_GAUGE_HISTOGRAM) &&
				isNativeHistogram(p.dec.GetHistogram()) {
				p.state = EntryHistogram
			}
		}
		// Is there another series?
		if err := p.dec.NextMetric(); err != nil {
			if errors.Is(err, io.EOF) {
				p.state = EntryInvalid
				return p.Next()
			}
			return EntryInvalid, err
		}
		if err := p.onSeriesOrHistogramUpdate(); err != nil {
			return EntryInvalid, err
		}
	case EntryHistogram:
		// Was Histogram() called and parseClassicHistograms is true?
		if p.redoClassic {
			p.redoClassic = false
			p.fieldPos = -3
			p.fieldsDone = false
			p.state = EntrySeries
			return p.Next() // Switch to classic histogram.
		}

		// Is there another series?
		if err := p.dec.NextMetric(); err != nil {
			if errors.Is(err, io.EOF) {
				p.state = EntryInvalid
				return p.Next()
			}
			return EntryInvalid, err
		}
		if err := p.onSeriesOrHistogramUpdate(); err != nil {
			return EntryInvalid, err
		}
	default:
		return EntryInvalid, fmt.Errorf("invalid protobuf parsing state: %d", p.state)
	}
	return p.state, nil
}

// onSeriesOrHistogramUpdate updates internal state before returning
// a series or histogram. It updates:
// * p.lset.
// * p.entryBytes.
// * p.fieldsDone depending on p.fieldPos.
func (p *ProtobufParser) onSeriesOrHistogramUpdate() error {
	p.builder.Reset()
	p.builder.Add(labels.MetricName, p.getMagicName())

	if err := p.dec.Label(&p.builder); err != nil {
		return err
	}

	if needed, name, value := p.getMagicLabel(); needed {
		p.builder.Add(name, value)
	}

	// Sort labels to maintain the sorted labels invariant.
	p.builder.Sort()
	p.builder.Overwrite(&p.lset)

	// entryBytes has to be unique for each series.
	p.entryBytes.Reset()
	p.lset.Range(func(l labels.Label) {
		if l.Name == labels.MetricName {
			p.entryBytes.WriteString(l.Value)
			return
		}
		p.entryBytes.WriteByte(model.SeparatorByte)
		p.entryBytes.WriteString(l.Name)
		p.entryBytes.WriteByte(model.SeparatorByte)
		p.entryBytes.WriteString(l.Value)
	})
	return nil
}

// getMagicName usually just returns p.mf.GetType() but adds a magic suffix
// ("_count", "_sum", "_bucket") if needed according to the current parser
// state.
func (p *ProtobufParser) getMagicName() string {
	t := p.dec.GetType()
	if p.state == EntryHistogram || (t != dto.MetricType_HISTOGRAM && t != dto.MetricType_GAUGE_HISTOGRAM && t != dto.MetricType_SUMMARY) {
		return p.dec.GetName()
	}
	if p.fieldPos == -2 {
		return p.dec.GetName() + "_count"
	}
	if p.fieldPos == -1 {
		return p.dec.GetName() + "_sum"
	}
	if t == dto.MetricType_HISTOGRAM || t == dto.MetricType_GAUGE_HISTOGRAM {
		return p.dec.GetName() + "_bucket"
	}
	return p.dec.GetName()
}

// getMagicLabel returns if a magic label ("quantile" or "le") is needed and, if
// so, its name and value. It also sets p.fieldsDone if applicable.
func (p *ProtobufParser) getMagicLabel() (bool, string, string) {
	// Native histogram or _count and _sum series.
	if p.state == EntryHistogram || p.fieldPos < 0 {
		return false, "", ""
	}
	switch p.dec.GetType() {
	case dto.MetricType_SUMMARY:
		qq := p.dec.GetSummary().GetQuantile()
		q := qq[p.fieldPos]
		p.fieldsDone = p.fieldPos == len(qq)-1
		return true, model.QuantileLabel, formatOpenMetricsFloat(q.GetQuantile())
	case dto.MetricType_HISTOGRAM, dto.MetricType_GAUGE_HISTOGRAM:
		bb := p.dec.GetHistogram().GetBucket()
		if p.fieldPos >= len(bb) {
			p.fieldsDone = true
			return true, model.BucketLabel, "+Inf"
		}
		b := bb[p.fieldPos]
		p.fieldsDone = math.IsInf(b.GetUpperBound(), +1)
		return true, model.BucketLabel, formatOpenMetricsFloat(b.GetUpperBound())
	}
	return false, "", ""
}

// formatOpenMetricsFloat works like the usual Go string formatting of a float
// but appends ".0" if the resulting number would otherwise contain neither a
// "." nor an "e".
func formatOpenMetricsFloat(f float64) string {
	// A few common cases hardcoded.
	switch {
	case f == 1:
		return "1.0"
	case f == 0:
		return "0.0"
	case f == -1:
		return "-1.0"
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, +1):
		return "+Inf"
	case math.IsInf(f, -1):
		return "-Inf"
	}
	bp := floatFormatBufPool.Get().(*[]byte)
	defer floatFormatBufPool.Put(bp)

	*bp = strconv.AppendFloat((*bp)[:0], f, 'g', -1, 64)
	if bytes.ContainsAny(*bp, "e.") {
		return string(*bp)
	}
	*bp = append(*bp, '.', '0')
	return string(*bp)
}

// isNativeHistogram returns false iff the provided histograms has no spans at
// all (neither positive nor negative) and a zero threshold of 0 and a zero
// count of 0. In principle, this could still be meant to be a native histogram
// with a zero threshold of 0 and no observations yet. In that case,
// instrumentation libraries should add a "no-op" span (e.g. length zero, offset
// zero) to signal that the histogram is meant to be parsed as a native
// histogram. Failing to do so will cause Prometheus to parse it as a classic
// histogram as long as no observations have happened.
func isNativeHistogram(h *dto.Histogram) bool {
	return len(h.GetPositiveSpan()) > 0 ||
		len(h.GetNegativeSpan()) > 0 ||
		h.GetZeroThreshold() > 0 ||
		h.GetZeroCount() > 0
}
