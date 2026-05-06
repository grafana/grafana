// Copyright 2017 The Prometheus Authors
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
//go:generate golex -o=promlex.l.go promlex.l

package textparse

import (
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"unicode/utf8"
	"unsafe"

	"github.com/prometheus/common/model"

	"github.com/prometheus/prometheus/model/exemplar"
	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/value"
)

type promlexer struct {
	b     []byte
	i     int
	start int
	err   error
	state int
}

type token int

const (
	tInvalid   token = -1
	tEOF       token = 0
	tLinebreak token = iota
	tWhitespace
	tHelp
	tType
	tUnit
	tEOFWord
	tText
	tComment
	tBlank
	tMName
	tQString
	tBraceOpen
	tBraceClose
	tLName
	tLValue
	tComma
	tEqual
	tTimestamp
	tValue
)

func (t token) String() string {
	switch t {
	case tInvalid:
		return "INVALID"
	case tEOF:
		return "EOF"
	case tLinebreak:
		return "LINEBREAK"
	case tWhitespace:
		return "WHITESPACE"
	case tHelp:
		return "HELP"
	case tType:
		return "TYPE"
	case tUnit:
		return "UNIT"
	case tEOFWord:
		return "EOFWORD"
	case tText:
		return "TEXT"
	case tComment:
		return "COMMENT"
	case tBlank:
		return "BLANK"
	case tMName:
		return "MNAME"
	case tQString:
		return "QSTRING"
	case tBraceOpen:
		return "BOPEN"
	case tBraceClose:
		return "BCLOSE"
	case tLName:
		return "LNAME"
	case tLValue:
		return "LVALUE"
	case tEqual:
		return "EQUAL"
	case tComma:
		return "COMMA"
	case tTimestamp:
		return "TIMESTAMP"
	case tValue:
		return "VALUE"
	}
	return fmt.Sprintf("<invalid: %d>", t)
}

// buf returns the buffer of the current token.
func (l *promlexer) buf() []byte {
	return l.b[l.start:l.i]
}

func (l *promlexer) cur() byte {
	return l.b[l.i]
}

// next advances the promlexer to the next character.
func (l *promlexer) next() byte {
	l.i++
	if l.i >= len(l.b) {
		l.err = io.EOF
		return byte(tEOF)
	}
	// Lex struggles with null bytes. If we are in a label value or help string, where
	// they are allowed, consume them here immediately.
	for l.b[l.i] == 0 && (l.state == sLValue || l.state == sMeta2 || l.state == sComment) {
		l.i++
	}
	return l.b[l.i]
}

func (l *promlexer) Error(es string) {
	l.err = errors.New(es)
}

// PromParser parses samples from a byte slice of samples in the official
// Prometheus text exposition format.
type PromParser struct {
	l       *promlexer
	builder labels.ScratchBuilder
	series  []byte
	text    []byte
	mtype   model.MetricType
	val     float64
	ts      int64
	hasTS   bool
	start   int
	// offsets is a list of offsets into series that describe the positions
	// of the metric name and label names and values for this series.
	// p.offsets[0] is the start character of the metric name.
	// p.offsets[1] is the end of the metric name.
	// Subsequently, p.offsets is a pair of pair of offsets for the positions
	// of the label name and value start and end characters.
	offsets []int
}

// NewPromParser returns a new parser of the byte slice.
func NewPromParser(b []byte, st *labels.SymbolTable) Parser {
	return &PromParser{
		l:       &promlexer{b: append(b, '\n')},
		builder: labels.NewScratchBuilderWithSymbolTable(st, 16),
	}
}

// Series returns the bytes of the series, the timestamp if set, and the value
// of the current sample.
func (p *PromParser) Series() ([]byte, *int64, float64) {
	if p.hasTS {
		return p.series, &p.ts, p.val
	}
	return p.series, nil, p.val
}

// Histogram returns (nil, nil, nil, nil) for now because the Prometheus text
// format does not support sparse histograms yet.
func (p *PromParser) Histogram() ([]byte, *int64, *histogram.Histogram, *histogram.FloatHistogram) {
	return nil, nil, nil, nil
}

// Help returns the metric name and help text in the current entry.
// Must only be called after Next returned a help entry.
// The returned byte slices become invalid after the next call to Next.
func (p *PromParser) Help() ([]byte, []byte) {
	m := p.l.b[p.offsets[0]:p.offsets[1]]

	// Replacer causes allocations. Replace only when necessary.
	if strings.IndexByte(yoloString(p.text), byte('\\')) >= 0 {
		return m, []byte(helpReplacer.Replace(string(p.text)))
	}
	return m, p.text
}

// Type returns the metric name and type in the current entry.
// Must only be called after Next returned a type entry.
// The returned byte slices become invalid after the next call to Next.
func (p *PromParser) Type() ([]byte, model.MetricType) {
	return p.l.b[p.offsets[0]:p.offsets[1]], p.mtype
}

// Unit returns the metric name and unit in the current entry.
// Must only be called after Next returned a unit entry.
// The returned byte slices become invalid after the next call to Next.
func (p *PromParser) Unit() ([]byte, []byte) {
	// The Prometheus format does not have units.
	return nil, nil
}

// Comment returns the text of the current comment.
// Must only be called after Next returned a comment entry.
// The returned byte slice becomes invalid after the next call to Next.
func (p *PromParser) Comment() []byte {
	return p.text
}

// Labels writes the labels of the current sample into the passed labels.
func (p *PromParser) Labels(l *labels.Labels) {
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

// Exemplar implements the Parser interface. However, since the classic
// Prometheus text format does not support exemplars, this implementation simply
// returns false and does nothing else.
func (p *PromParser) Exemplar(*exemplar.Exemplar) bool {
	return false
}

// CreatedTimestamp returns 0 as it's not implemented yet.
// TODO(bwplotka): https://github.com/prometheus/prometheus/issues/12980
func (p *PromParser) CreatedTimestamp() int64 {
	return 0
}

// nextToken returns the next token from the promlexer. It skips over tabs
// and spaces.
func (p *PromParser) nextToken() token {
	for {
		if tok := p.l.Lex(); tok != tWhitespace {
			return tok
		}
	}
}

func (p *PromParser) parseError(exp string, got token) error {
	e := p.l.i + 1
	if len(p.l.b) < e {
		e = len(p.l.b)
	}
	return fmt.Errorf("%s, got %q (%q) while parsing: %q", exp, p.l.b[p.l.start:e], got, p.l.b[p.start:e])
}

// Next advances the parser to the next sample.
// It returns (EntryInvalid, io.EOF) if no samples were read.
func (p *PromParser) Next() (Entry, error) {
	var err error

	p.start = p.l.i
	p.offsets = p.offsets[:0]

	switch t := p.nextToken(); t {
	case tEOF:
		return EntryInvalid, io.EOF
	case tLinebreak:
		// Allow full blank lines.
		return p.Next()

	case tHelp, tType:
		switch t2 := p.nextToken(); t2 {
		case tMName:
			mStart := p.l.start
			mEnd := p.l.i
			if p.l.b[mStart] == '"' && p.l.b[mEnd-1] == '"' {
				mStart++
				mEnd--
			}
			p.offsets = append(p.offsets, mStart, mEnd)
		default:
			return EntryInvalid, p.parseError("expected metric name after "+t.String(), t2)
		}
		switch t2 := p.nextToken(); t2 {
		case tText:
			if len(p.l.buf()) > 1 {
				p.text = p.l.buf()[1:]
			} else {
				p.text = []byte{}
			}
		default:
			return EntryInvalid, fmt.Errorf("expected text in %s, got %v", t.String(), t2.String())
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
			case "summary":
				p.mtype = model.MetricTypeSummary
			case "untyped":
				p.mtype = model.MetricTypeUnknown
			default:
				return EntryInvalid, fmt.Errorf("invalid metric type %q", s)
			}
		case tHelp:
			if !utf8.Valid(p.text) {
				return EntryInvalid, fmt.Errorf("help text %q is not a valid utf8 string", p.text)
			}
		}
		if t := p.nextToken(); t != tLinebreak {
			return EntryInvalid, p.parseError("linebreak expected after metadata", t)
		}
		switch t {
		case tHelp:
			return EntryHelp, nil
		case tType:
			return EntryType, nil
		}
	case tComment:
		p.text = p.l.buf()
		if t := p.nextToken(); t != tLinebreak {
			return EntryInvalid, p.parseError("linebreak expected after comment", t)
		}
		return EntryComment, nil
	case tBraceOpen:
		// We found a brace, so make room for the eventual metric name. If these
		// values aren't updated, then the metric name was not set inside the
		// braces and we can return an error.
		if len(p.offsets) == 0 {
			p.offsets = []int{-1, -1}
		}
		if err := p.parseLVals(); err != nil {
			return EntryInvalid, err
		}

		p.series = p.l.b[p.start:p.l.i]
		return p.parseMetricSuffix(p.nextToken())
	case tMName:
		p.offsets = append(p.offsets, p.start, p.l.i)
		p.series = p.l.b[p.start:p.l.i]
		t2 := p.nextToken()
		// If there's a brace, consume and parse the label values.
		if t2 == tBraceOpen {
			if err := p.parseLVals(); err != nil {
				return EntryInvalid, err
			}
			p.series = p.l.b[p.start:p.l.i]
			t2 = p.nextToken()
		}
		return p.parseMetricSuffix(t2)

	default:
		err = p.parseError("expected a valid start token", t)
	}
	return EntryInvalid, err
}

// parseLVals parses the contents inside the braces.
func (p *PromParser) parseLVals() error {
	t := p.nextToken()
	for {
		curTStart := p.l.start
		curTI := p.l.i
		switch t {
		case tBraceClose:
			return nil
		case tLName:
		case tQString:
		default:
			return p.parseError("expected label name", t)
		}

		t = p.nextToken()
		// A quoted string followed by a comma or brace is a metric name. Set the
		// offsets and continue processing.
		if t == tComma || t == tBraceClose {
			if p.offsets[0] != -1 || p.offsets[1] != -1 {
				return fmt.Errorf("metric name already set while parsing: %q", p.l.b[p.start:p.l.i])
			}
			p.offsets[0] = curTStart + 1
			p.offsets[1] = curTI - 1
			if t == tBraceClose {
				return nil
			}
			t = p.nextToken()
			continue
		}
		// We have a label name, and it might be quoted.
		if p.l.b[curTStart] == '"' {
			curTStart++
			curTI--
		}
		p.offsets = append(p.offsets, curTStart, curTI)
		if t != tEqual {
			return p.parseError("expected equal", t)
		}
		if t := p.nextToken(); t != tLValue {
			return p.parseError("expected label value", t)
		}
		if !utf8.Valid(p.l.buf()) {
			return fmt.Errorf("invalid UTF-8 label value: %q", p.l.buf())
		}

		// The promlexer ensures the value string is quoted. Strip first
		// and last character.
		p.offsets = append(p.offsets, p.l.start+1, p.l.i-1)

		// Free trailing commas are allowed. NOTE: this allows spaces between label
		// names, unlike in OpenMetrics. It is not clear if this is intended or an
		// accidental bug.
		if t = p.nextToken(); t == tComma {
			t = p.nextToken()
		}
	}
}

// parseMetricSuffix parses the end of the line after the metric name and
// labels. It starts parsing with the provided token.
func (p *PromParser) parseMetricSuffix(t token) (Entry, error) {
	if p.offsets[0] == -1 {
		return EntryInvalid, fmt.Errorf("metric name not set while parsing: %q", p.l.b[p.start:p.l.i])
	}
	if t != tValue {
		return EntryInvalid, p.parseError("expected value after metric", t)
	}
	var err error
	if p.val, err = parseFloat(yoloString(p.l.buf())); err != nil {
		return EntryInvalid, fmt.Errorf("%w while parsing: %q", err, p.l.b[p.start:p.l.i])
	}
	// Ensure canonical NaN value.
	if math.IsNaN(p.val) {
		p.val = math.Float64frombits(value.NormalNaN)
	}
	p.hasTS = false
	switch t := p.nextToken(); t {
	case tLinebreak:
		break
	case tTimestamp:
		p.hasTS = true
		if p.ts, err = strconv.ParseInt(yoloString(p.l.buf()), 10, 64); err != nil {
			return EntryInvalid, fmt.Errorf("%w while parsing: %q", err, p.l.b[p.start:p.l.i])
		}
		if t2 := p.nextToken(); t2 != tLinebreak {
			return EntryInvalid, p.parseError("expected next entry after timestamp", t2)
		}
	default:
		return EntryInvalid, p.parseError("expected timestamp or new record", t)
	}

	return EntrySeries, nil
}

var lvalReplacer = strings.NewReplacer(
	`\"`, "\"",
	`\\`, "\\",
	`\n`, "\n",
)

var helpReplacer = strings.NewReplacer(
	`\\`, "\\",
	`\n`, "\n",
)

func unreplace(s string) string {
	// Replacer causes allocations. Replace only when necessary.
	if strings.IndexByte(s, byte('\\')) >= 0 {
		return lvalReplacer.Replace(s)
	}
	return s
}

func yoloString(b []byte) string {
	return unsafe.String(unsafe.SliceData(b), len(b))
}

func yoloBytes(b string) []byte {
	return unsafe.Slice(unsafe.StringData(b), len(b))
}

func parseFloat(s string) (float64, error) {
	// Keep to pre-Go 1.13 float formats.
	if strings.ContainsAny(s, "pP_") {
		return 0, errors.New("unsupported character in float")
	}
	return strconv.ParseFloat(s, 64)
}
