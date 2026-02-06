package protocol

import (
	"fmt"
	"io"
	"strings"
	"sync"
	"time"
)

const (
	maxErrorBufferSize = 1024
)

// TimeFunc is used to override the default time for a metric
// with no specified timestamp.
type TimeFunc func() time.Time

// ParseError indicates a error in the parsing of the text.
type ParseError struct {
	Offset     int
	LineOffset int
	LineNumber int
	Column     int
	msg        string
	buf        string
}

func (e *ParseError) Error() string {
	buffer := e.buf[e.LineOffset:]
	eol := strings.IndexAny(buffer, "\r\n")
	if eol >= 0 {
		buffer = buffer[:eol]
	}
	if len(buffer) > maxErrorBufferSize {
		buffer = buffer[:maxErrorBufferSize] + "..."
	}
	return fmt.Sprintf("metric parse error: %s at %d:%d: %q", e.msg, e.LineNumber, e.Column, buffer)
}

// Parser is an InfluxDB Line Protocol parser that implements the
// parsers.Parser interface.
type Parser struct {
	DefaultTags map[string]string

	sync.Mutex
	*machine
	handler *MetricHandler
}

// NewParser returns a Parser than accepts line protocol
func NewParser(handler *MetricHandler) *Parser {
	return &Parser{
		machine: NewMachine(handler),
		handler: handler,
	}
}

// NewSeriesParser returns a Parser than accepts a measurement and tagset
func NewSeriesParser(handler *MetricHandler) *Parser {
	return &Parser{
		machine: NewSeriesMachine(handler),
		handler: handler,
	}
}

// SetTimeFunc allows default times to be set when no time is specified
// for a metric in line-protocol.
func (p *Parser) SetTimeFunc(f TimeFunc) {
	p.handler.SetTimeFunc(f)
}

// Parse interprets line-protocol bytes as many metrics.
func (p *Parser) Parse(input []byte) ([]Metric, error) {
	p.Lock()
	defer p.Unlock()
	metrics := make([]Metric, 0)
	p.machine.SetData(input)

	for {
		err := p.machine.Next()
		if err == EOF {
			break
		}

		if err != nil {
			return nil, &ParseError{
				Offset:     p.machine.Position(),
				LineOffset: p.machine.LineOffset(),
				LineNumber: p.machine.LineNumber(),
				Column:     p.machine.Column(),
				msg:        err.Error(),
				buf:        string(input),
			}
		}

		metric, err := p.handler.Metric()
		if err != nil {
			return nil, err
		}

		if metric == nil {
			continue
		}

		metrics = append(metrics, metric)
	}

	return metrics, nil
}

// StreamParser is an InfluxDB Line Protocol parser.  It is not safe for
// concurrent use in multiple goroutines.
type StreamParser struct {
	machine *streamMachine
	handler *MetricHandler
}

// NewStreamParser parses from a reader and iterates the machine
// metric by metric.  Not safe for concurrent use in multiple goroutines.
func NewStreamParser(r io.Reader) *StreamParser {
	handler := NewMetricHandler()
	return &StreamParser{
		machine: NewStreamMachine(r, handler),
		handler: handler,
	}
}

// SetTimeFunc changes the function used to determine the time of metrics
// without a timestamp.  The default TimeFunc is time.Now.  Useful mostly for
// testing, or perhaps if you want all metrics to have the same timestamp.
func (p *StreamParser) SetTimeFunc(f TimeFunc) {
	p.handler.SetTimeFunc(f)
}

// SetTimePrecision specifies units for the time stamp.
func (p *StreamParser) SetTimePrecision(u time.Duration) {
	p.handler.SetTimePrecision(u)
}

// Next parses the next item from the stream.  You can repeat calls to this
// function until it returns EOF.
func (p *StreamParser) Next() (Metric, error) {
	err := p.machine.Next()
	if err == EOF {
		return nil, EOF
	}

	if err != nil {
		return nil, &ParseError{
			Offset:     p.machine.Position(),
			LineOffset: p.machine.LineOffset(),
			LineNumber: p.machine.LineNumber(),
			Column:     p.machine.Column(),
			msg:        err.Error(),
			buf:        p.machine.LineText(),
		}
	}

	metric, err := p.handler.Metric()
	if err != nil {
		return nil, err
	}

	return metric, nil
}

// Position returns the current byte offset into the data.
func (p *StreamParser) Position() int {
	return p.machine.Position()
}

// LineOffset returns the byte offset of the current line.
func (p *StreamParser) LineOffset() int {
	return p.machine.LineOffset()
}

// LineNumber returns the current line number.  Lines are counted based on the
// regular expression `\r?\n`.
func (p *StreamParser) LineNumber() int {
	return p.machine.LineNumber()
}

// Column returns the current column.
func (p *StreamParser) Column() int {
	return p.machine.Column()
}

// LineText returns the text of the current line that has been parsed so far.
func (p *StreamParser) LineText() string {
	return p.machine.LineText()
}
