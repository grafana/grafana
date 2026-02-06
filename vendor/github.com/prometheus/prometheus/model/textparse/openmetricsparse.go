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

//go:generate go get -u modernc.org/golex
//go:generate golex -o=openmetricslex.l.go openmetricslex.l

package textparse

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/cespare/xxhash/v2"
	"github.com/prometheus/common/model"

	"github.com/prometheus/prometheus/model/exemplar"
	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/value"
)

type openMetricsLexer struct {
	b     []byte
	i     int
	start int
	err   error
	state int
}

// buf returns the buffer of the current token.
func (l *openMetricsLexer) buf() []byte {
	return l.b[l.start:l.i]
}

// next advances the openMetricsLexer to the next character.
func (l *openMetricsLexer) next() byte {
	l.i++
	if l.i >= len(l.b) {
		l.err = io.EOF
		return byte(tEOF)
	}
	// Lex struggles with null bytes. If we are in a label value or help string, where
	// they are allowed, consume them here immediately.
	for l.b[l.i] == 0 && (l.state == sLValue || l.state == sMeta2 || l.state == sComment) {
		l.i++
		if l.i >= len(l.b) {
			l.err = io.EOF
			return byte(tEOF)
		}
	}
	return l.b[l.i]
}

func (l *openMetricsLexer) Error(es string) {
	l.err = errors.New(es)
}

// OpenMetricsParser parses samples from a byte slice of samples in the official
// OpenMetrics text exposition format.
// This is based on the working draft https://docs.google.com/document/u/1/d/1KwV0mAXwwbvvifBvDKH_LU1YjyXE_wxCkHNoCGq1GX0/edit
type OpenMetricsParser struct {
	l         *openMetricsLexer
	builder   labels.ScratchBuilder
	series    []byte
	mfNameLen int // length of metric family name to get from series.
	text      []byte
	mtype     model.MetricType
	val       float64
	ts        int64
	hasTS     bool
	start     int
	// offsets is a list of offsets into series that describe the positions
	// of the metric name and label names and values for this series.
	// p.offsets[0] is the start character of the metric name.
	// p.offsets[1] is the end of the metric name.
	// Subsequently, p.offsets is a pair of pair of offsets for the positions
	// of the label name and value start and end characters.
	offsets []int

	eOffsets      []int
	exemplar      []byte
	exemplarVal   float64
	exemplarTs    int64
	hasExemplarTs bool

	// Created timestamp parsing state.
	ct        int64
	ctHashSet uint64
	// ignoreExemplar instructs the parser to not overwrite exemplars (to keep them while peeking ahead).
	ignoreExemplar bool
	// visitedMFName is the metric family name of the last visited metric when peeking ahead
	// for _created series during the execution of the CreatedTimestamp method.
	visitedMFName []byte
	skipCTSeries  bool
}

type openMetricsParserOptions struct {
	SkipCTSeries bool
}

type OpenMetricsOption func(*openMetricsParserOptions)

// WithOMParserCTSeriesSkipped turns off exposing _created lines
// as series, which makes those only used for parsing created timestamp
// for `CreatedTimestamp` method purposes.
//
// It's recommended to use this option to avoid using _created lines for other
// purposes than created timestamp, but leave false by default for the
// best-effort compatibility.
func WithOMParserCTSeriesSkipped() OpenMetricsOption {
	return func(o *openMetricsParserOptions) {
		o.SkipCTSeries = true
	}
}

// NewOpenMetricsParser returns a new parser for the byte slice with option to skip CT series parsing.
func NewOpenMetricsParser(b []byte, st *labels.SymbolTable, opts ...OpenMetricsOption) Parser {
	options := &openMetricsParserOptions{}

	for _, opt := range opts {
		opt(options)
	}

	parser := &OpenMetricsParser{
		l:            &openMetricsLexer{b: b},
		builder:      labels.NewScratchBuilderWithSymbolTable(st, 16),
		skipCTSeries: options.SkipCTSeries,
	}

	return parser
}

// Series returns the bytes of the series, the timestamp if set, and the value
// of the current sample.
func (p *OpenMetricsParser) Series() ([]byte, *int64, float64) {
	if p.hasTS {
		ts := p.ts
		return p.series, &ts, p.val
	}
	return p.series, nil, p.val
}

// Histogram returns (nil, nil, nil, nil) for now because OpenMetrics does not
// support sparse histograms yet.
func (p *OpenMetricsParser) Histogram() ([]byte, *int64, *histogram.Histogram, *histogram.FloatHistogram) {
	return nil, nil, nil, nil
}

// Help returns the metric name and help text in the current entry.
// Must only be called after Next returned a help entry.
// The returned byte slices become invalid after the next call to Next.
func (p *OpenMetricsParser) Help() ([]byte, []byte) {
	m := p.l.b[p.offsets[0]:p.offsets[1]]

	// Replacer causes allocations. Replace only when necessary.
	if strings.IndexByte(yoloString(p.text), byte('\\')) >= 0 {
		// OpenMetrics always uses the Prometheus format label value escaping.
		return m, []byte(lvalReplacer.Replace(string(p.text)))
	}
	return m, p.text
}

// Type returns the metric name and type in the current entry.
// Must only be called after Next returned a type entry.
// The returned byte slices become invalid after the next call to Next.
func (p *OpenMetricsParser) Type() ([]byte, model.MetricType) {
	return p.l.b[p.offsets[0]:p.offsets[1]], p.mtype
}

// Unit returns the metric name and unit in the current entry.
// Must only be called after Next returned a unit entry.
// The returned byte slices become invalid after the next call to Next.
func (p *OpenMetricsParser) Unit() ([]byte, []byte) {
	return p.l.b[p.offsets[0]:p.offsets[1]], p.text
}

// Comment returns the text of the current comment.
// Must only be called after Next returned a comment entry.
// The returned byte slice becomes invalid after the next call to Next.
func (p *OpenMetricsParser) Comment() []byte {
	return p.text
}

// Labels writes the labels of the current sample into the passed labels.
func (p *OpenMetricsParser) Labels(l *labels.Labels) {
	s := yoloString(p.series)

	p.builder.Reset()
	metricName := unreplace(s[p.offsets[0]-p.start : p.offsets[1]-p.start])
	p.builder.Add(labels.MetricName, metricName)

	for i := 2; i < len(p.offsets); i += 4 {
		a := p.offsets[i] - p.start
		b := p.offsets[i+1] - p.start
		label := unreplace(s[a:b])
		c := p.offsets[i+2] - p.start
		d := p.offsets[i+3] - p.start
		value := normalizeFloatsInLabelValues(p.mtype, label, unreplace(s[c:d]))

		p.builder.Add(label, value)
	}

	p.builder.Sort()
	*l = p.builder.Labels()
}

// Exemplar writes the exemplar of the current sample into the passed exemplar.
// It returns whether an exemplar exists. As OpenMetrics only ever has one
// exemplar per sample, every call after the first (for the same sample) will
// always return false.
func (p *OpenMetricsParser) Exemplar(e *exemplar.Exemplar) bool {
	if len(p.exemplar) == 0 {
		return false
	}

	// Allocate the full immutable string immediately, so we just
	// have to create references on it below.
	s := string(p.exemplar)

	e.Value = p.exemplarVal
	if p.hasExemplarTs {
		e.HasTs = true
		e.Ts = p.exemplarTs
	}

	p.builder.Reset()
	for i := 0; i < len(p.eOffsets); i += 4 {
		a := p.eOffsets[i] - p.start
		b := p.eOffsets[i+1] - p.start
		c := p.eOffsets[i+2] - p.start
		d := p.eOffsets[i+3] - p.start

		p.builder.Add(s[a:b], s[c:d])
	}

	p.builder.Sort()
	e.Labels = p.builder.Labels()

	// Wipe exemplar so that future calls return false.
	p.exemplar = p.exemplar[:0]
	return true
}

// CreatedTimestamp returns the created timestamp for a current Metric if exists or nil.
// NOTE(Maniktherana): Might use additional CPU/mem resources due to deep copy of parser required for peeking given 1.0 OM specification on _created series.
func (p *OpenMetricsParser) CreatedTimestamp() int64 {
	if !typeRequiresCT(p.mtype) {
		// Not a CT supported metric type, fast path.
		p.ctHashSet = 0 // Use ctHashSet as a single way of telling "empty cache"
		return 0
	}

	var (
		buf      []byte
		currName []byte
	)
	if len(p.series) > 1 && p.series[0] == '{' && p.series[1] == '"' {
		// special case for UTF-8 encoded metric family names.
		currName = p.series[p.offsets[0]-p.start : p.mfNameLen+2]
	} else {
		currName = p.series[p.offsets[0]-p.start : p.mfNameLen]
	}

	currHash := p.seriesHash(&buf, currName)
	// Check cache, perhaps we fetched something already.
	if currHash == p.ctHashSet && p.ct > 0 {
		return p.ct
	}

	// Create a new lexer to reset the parser once this function is done executing.
	resetLexer := &openMetricsLexer{
		b:     p.l.b,
		i:     p.l.i,
		start: p.l.start,
		err:   p.l.err,
		state: p.l.state,
	}

	p.skipCTSeries = false

	p.ignoreExemplar = true
	savedStart := p.start
	defer func() {
		p.ignoreExemplar = false
		p.start = savedStart
		p.l = resetLexer
	}()

	for {
		eType, err := p.Next()
		if err != nil {
			// This means p.Next() will give error too later on, so def no CT line found.
			// This might result in partial scrape with wrong/missing CT, but only
			// spec improvement would help.
			// TODO: Make sure OM 1.1/2.0 pass CT via metadata or exemplar-like to avoid this.
			p.resetCTParseValues()
			return 0
		}
		if eType != EntrySeries {
			// Assume we hit different family, no CT line found.
			p.resetCTParseValues()
			return 0
		}

		peekedName := p.series[p.offsets[0]-p.start : p.offsets[1]-p.start]
		if len(peekedName) < 8 || string(peekedName[len(peekedName)-8:]) != "_created" {
			// Not a CT line, search more.
			continue
		}

		// Remove _created suffix.
		peekedHash := p.seriesHash(&buf, peekedName[:len(peekedName)-8])
		if peekedHash != currHash {
			// Found CT line for a different series, for our series no CT.
			p.resetCTParseValues()
			return 0
		}

		// All timestamps in OpenMetrics are Unix Epoch in seconds. Convert to milliseconds.
		// https://github.com/prometheus/OpenMetrics/blob/v1.0.0/specification/OpenMetrics.md#timestamps
		ct := int64(p.val * 1000.0)
		p.setCTParseValues(ct, currHash, currName, true)
		return ct
	}
}

var (
	leBytes       = []byte{108, 101}
	quantileBytes = []byte{113, 117, 97, 110, 116, 105, 108, 101}
)

// seriesHash generates a hash based on the metric family name and the offsets
// of label names and values from the parsed OpenMetrics data. It skips quantile
// and le labels for summaries and histograms respectively.
func (p *OpenMetricsParser) seriesHash(offsetsArr *[]byte, metricFamilyName []byte) uint64 {
	// Iterate through p.offsets to find the label names and values.
	for i := 2; i < len(p.offsets); i += 4 {
		lStart := p.offsets[i] - p.start
		lEnd := p.offsets[i+1] - p.start
		label := p.series[lStart:lEnd]
		// Skip quantile and le labels for summaries and histograms.
		if p.mtype == model.MetricTypeSummary && bytes.Equal(label, quantileBytes) {
			continue
		}
		if p.mtype == model.MetricTypeHistogram && bytes.Equal(label, leBytes) {
			continue
		}
		*offsetsArr = append(*offsetsArr, p.series[lStart:lEnd]...)
		vStart := p.offsets[i+2] - p.start
		vEnd := p.offsets[i+3] - p.start
		*offsetsArr = append(*offsetsArr, p.series[vStart:vEnd]...)
	}

	*offsetsArr = append(*offsetsArr, metricFamilyName...)
	hashedOffsets := xxhash.Sum64(*offsetsArr)

	// Reset the offsets array for later reuse.
	*offsetsArr = (*offsetsArr)[:0]
	return hashedOffsets
}

// setCTParseValues sets the parser to the state after CreatedTimestamp method was called and CT was found.
// This is useful to prevent re-parsing the same series again and early return the CT value.
func (p *OpenMetricsParser) setCTParseValues(ct int64, ctHashSet uint64, mfName []byte, skipCTSeries bool) {
	p.ct = ct
	p.ctHashSet = ctHashSet
	p.visitedMFName = mfName
	p.skipCTSeries = skipCTSeries // Do we need to set it?
}

// resetCTParseValues resets the parser to the state before CreatedTimestamp method was called.
func (p *OpenMetricsParser) resetCTParseValues() {
	p.ctHashSet = 0
	p.skipCTSeries = true
}

// typeRequiresCT returns true if the metric type requires a _created timestamp.
func typeRequiresCT(t model.MetricType) bool {
	switch t {
	case model.MetricTypeCounter, model.MetricTypeSummary, model.MetricTypeHistogram:
		return true
	default:
		return false
	}
}

// nextToken returns the next token from the openMetricsLexer.
func (p *OpenMetricsParser) nextToken() token {
	tok := p.l.Lex()
	return tok
}

func (p *OpenMetricsParser) parseError(exp string, got token) error {
	e := p.l.i + 1
	if len(p.l.b) < e {
		e = len(p.l.b)
	}
	return fmt.Errorf("%s, got %q (%q) while parsing: %q", exp, p.l.b[p.l.start:e], got, p.l.b[p.start:e])
}

// Next advances the parser to the next sample.
// It returns (EntryInvalid, io.EOF) if no samples were read.
func (p *OpenMetricsParser) Next() (Entry, error) {
	var err error

	p.start = p.l.i
	p.offsets = p.offsets[:0]
	if !p.ignoreExemplar {
		p.eOffsets = p.eOffsets[:0]
		p.exemplar = p.exemplar[:0]
		p.exemplarVal = 0
		p.hasExemplarTs = false
	}

	switch t := p.nextToken(); t {
	case tEOFWord:
		if t := p.nextToken(); t != tEOF {
			return EntryInvalid, errors.New("unexpected data after # EOF")
		}
		return EntryInvalid, io.EOF
	case tEOF:
		return EntryInvalid, errors.New("data does not end with # EOF")
	case tHelp, tType, tUnit:
		switch t2 := p.nextToken(); t2 {
		case tMName:
			mStart := p.l.start
			mEnd := p.l.i
			if p.l.b[mStart] == '"' && p.l.b[mEnd-1] == '"' {
				mStart++
				mEnd--
			}
			p.mfNameLen = mEnd - mStart
			p.offsets = append(p.offsets, mStart, mEnd)
		default:
			return EntryInvalid, p.parseError("expected metric name after "+t.String(), t2)
		}
		switch t2 := p.nextToken(); t2 {
		case tText:
			if len(p.l.buf()) > 1 {
				p.text = p.l.buf()[1 : len(p.l.buf())-1]
			} else {
				p.text = []byte{}
			}
		default:
			return EntryInvalid, fmt.Errorf("expected text in %s", t.String())
		}
		switch t {
		case tType:
			switch s := yoloString(p.text); s {
			case "counter":
				p.mtype = model.MetricTypeCounter
			case "gauge":
				p.mtype = model.MetricTypeGauge
			case "histogram":
				p.mtype = model.MetricTypeHistogram
			case "gaugehistogram":
				p.mtype = model.MetricTypeGaugeHistogram
			case "summary":
				p.mtype = model.MetricTypeSummary
			case "info":
				p.mtype = model.MetricTypeInfo
			case "stateset":
				p.mtype = model.MetricTypeStateset
			case "unknown":
				p.mtype = model.MetricTypeUnknown
			default:
				return EntryInvalid, fmt.Errorf("invalid metric type %q", s)
			}
		case tHelp:
			if !utf8.Valid(p.text) {
				return EntryInvalid, fmt.Errorf("help text %q is not a valid utf8 string", p.text)
			}
		}
		switch t {
		case tHelp:
			return EntryHelp, nil
		case tType:
			return EntryType, nil
		case tUnit:
			m := yoloString(p.l.b[p.offsets[0]:p.offsets[1]])
			u := yoloString(p.text)
			if len(u) > 0 {
				if !strings.HasSuffix(m, u) || len(m) < len(u)+1 || p.l.b[p.offsets[1]-len(u)-1] != '_' {
					return EntryInvalid, fmt.Errorf("unit %q not a suffix of metric %q", u, m)
				}
			}
			return EntryUnit, nil
		}

	case tBraceOpen:
		// We found a brace, so make room for the eventual metric name. If these
		// values aren't updated, then the metric name was not set inside the
		// braces and we can return an error.
		if len(p.offsets) == 0 {
			p.offsets = []int{-1, -1}
		}
		if p.offsets, err = p.parseLVals(p.offsets, false); err != nil {
			return EntryInvalid, err
		}

		p.series = p.l.b[p.start:p.l.i]
		if err := p.parseSeriesEndOfLine(p.nextToken()); err != nil {
			return EntryInvalid, err
		}
		if p.skipCTSeries && p.isCreatedSeries() {
			return p.Next()
		}
		return EntrySeries, nil
	case tMName:
		p.offsets = append(p.offsets, p.start, p.l.i)
		p.series = p.l.b[p.start:p.l.i]

		t2 := p.nextToken()
		if t2 == tBraceOpen {
			p.offsets, err = p.parseLVals(p.offsets, false)
			if err != nil {
				return EntryInvalid, err
			}
			p.series = p.l.b[p.start:p.l.i]
			t2 = p.nextToken()
		}

		if err := p.parseSeriesEndOfLine(t2); err != nil {
			return EntryInvalid, err
		}
		if p.skipCTSeries && p.isCreatedSeries() {
			return p.Next()
		}
		return EntrySeries, nil
	default:
		err = p.parseError("expected a valid start token", t)
	}
	return EntryInvalid, err
}

func (p *OpenMetricsParser) parseComment() error {
	var err error

	if p.ignoreExemplar {
		for t := p.nextToken(); t != tLinebreak; t = p.nextToken() {
			if t == tEOF {
				return errors.New("data does not end with # EOF")
			}
		}
		return nil
	}

	// Parse the labels.
	p.eOffsets, err = p.parseLVals(p.eOffsets, true)
	if err != nil {
		return err
	}
	p.exemplar = p.l.b[p.start:p.l.i]

	// Get the value.
	p.exemplarVal, err = p.getFloatValue(p.nextToken(), "exemplar labels")
	if err != nil {
		return err
	}

	// Read the optional timestamp.
	p.hasExemplarTs = false
	switch t2 := p.nextToken(); t2 {
	case tEOF:
		return errors.New("data does not end with # EOF")
	case tLinebreak:
		break
	case tTimestamp:
		p.hasExemplarTs = true
		var ts float64
		// A float is enough to hold what we need for millisecond resolution.
		if ts, err = parseFloat(yoloString(p.l.buf()[1:])); err != nil {
			return fmt.Errorf("%w while parsing: %q", err, p.l.b[p.start:p.l.i])
		}
		if math.IsNaN(ts) || math.IsInf(ts, 0) {
			return fmt.Errorf("invalid exemplar timestamp %f", ts)
		}
		p.exemplarTs = int64(ts * 1000)
		switch t3 := p.nextToken(); t3 {
		case tLinebreak:
		default:
			return p.parseError("expected next entry after exemplar timestamp", t3)
		}
	default:
		return p.parseError("expected timestamp or comment", t2)
	}
	return nil
}

func (p *OpenMetricsParser) parseLVals(offsets []int, isExemplar bool) ([]int, error) {
	t := p.nextToken()
	for {
		curTStart := p.l.start
		curTI := p.l.i
		switch t {
		case tBraceClose:
			return offsets, nil
		case tLName:
		case tQString:
		default:
			return nil, p.parseError("expected label name", t)
		}

		t = p.nextToken()
		// A quoted string followed by a comma or brace is a metric name. Set the
		// offsets and continue processing. If this is an exemplar, this format
		// is not allowed.
		if t == tComma || t == tBraceClose {
			if isExemplar {
				return nil, p.parseError("expected label name", t)
			}
			if offsets[0] != -1 || offsets[1] != -1 {
				return nil, fmt.Errorf("metric name already set while parsing: %q", p.l.b[p.start:p.l.i])
			}
			offsets[0] = curTStart + 1
			offsets[1] = curTI - 1
			if t == tBraceClose {
				return offsets, nil
			}
			t = p.nextToken()
			continue
		}
		// We have a label name, and it might be quoted.
		if p.l.b[curTStart] == '"' {
			curTStart++
			curTI--
		}
		offsets = append(offsets, curTStart, curTI)

		if t != tEqual {
			return nil, p.parseError("expected equal", t)
		}
		if t := p.nextToken(); t != tLValue {
			return nil, p.parseError("expected label value", t)
		}
		if !utf8.Valid(p.l.buf()) {
			return nil, fmt.Errorf("invalid UTF-8 label value: %q", p.l.buf())
		}

		// The openMetricsLexer ensures the value string is quoted. Strip first
		// and last character.
		offsets = append(offsets, p.l.start+1, p.l.i-1)

		// Free trailing commas are allowed.
		t = p.nextToken()
		if t == tComma {
			t = p.nextToken()
		} else if t != tBraceClose {
			return nil, p.parseError("expected comma or brace close", t)
		}
	}
}

// isCreatedSeries returns true if the current series is a _created series.
func (p *OpenMetricsParser) isCreatedSeries() bool {
	metricName := p.series[p.offsets[0]-p.start : p.offsets[1]-p.start]
	// check length so the metric is longer than len("_created")
	if typeRequiresCT(p.mtype) && len(metricName) >= 8 && string(metricName[len(metricName)-8:]) == "_created" {
		return true
	}
	return false
}

// parseSeriesEndOfLine parses the series end of the line (value, optional
// timestamp, commentary, etc.) after the metric name and labels.
// It starts parsing with the provided token.
func (p *OpenMetricsParser) parseSeriesEndOfLine(t token) error {
	if p.offsets[0] == -1 {
		return fmt.Errorf("metric name not set while parsing: %q", p.l.b[p.start:p.l.i])
	}

	var err error
	p.val, err = p.getFloatValue(t, "metric")
	if err != nil {
		return err
	}

	p.hasTS = false
	switch t2 := p.nextToken(); t2 {
	case tEOF:
		return errors.New("data does not end with # EOF")
	case tLinebreak:
		break
	case tComment:
		if err := p.parseComment(); err != nil {
			return err
		}
	case tTimestamp:
		p.hasTS = true
		var ts float64
		// A float is enough to hold what we need for millisecond resolution.
		if ts, err = parseFloat(yoloString(p.l.buf()[1:])); err != nil {
			return fmt.Errorf("%w while parsing: %q", err, p.l.b[p.start:p.l.i])
		}
		if math.IsNaN(ts) || math.IsInf(ts, 0) {
			return fmt.Errorf("invalid timestamp %f", ts)
		}
		p.ts = int64(ts * 1000)
		switch t3 := p.nextToken(); t3 {
		case tLinebreak:
		case tComment:
			if err := p.parseComment(); err != nil {
				return err
			}
		default:
			return p.parseError("expected next entry after timestamp", t3)
		}
	}

	return nil
}

func (p *OpenMetricsParser) getFloatValue(t token, after string) (float64, error) {
	if t != tValue {
		return 0, p.parseError(fmt.Sprintf("expected value after %v", after), t)
	}
	val, err := parseFloat(yoloString(p.l.buf()[1:]))
	if err != nil {
		return 0, fmt.Errorf("%w while parsing: %q", err, p.l.b[p.start:p.l.i])
	}
	// Ensure canonical NaN value.
	if math.IsNaN(p.exemplarVal) {
		val = math.Float64frombits(value.NormalNaN)
	}
	return val, nil
}

// normalizeFloatsInLabelValues ensures that values of the "le" labels of classic histograms and "quantile" labels
// of summaries follow OpenMetrics formatting rules.
func normalizeFloatsInLabelValues(t model.MetricType, l, v string) string {
	if (t == model.MetricTypeSummary && l == model.QuantileLabel) || (t == model.MetricTypeHistogram && l == model.BucketLabel) {
		f, err := strconv.ParseFloat(v, 64)
		if err == nil {
			return formatOpenMetricsFloat(f)
		}
	}
	return v
}
