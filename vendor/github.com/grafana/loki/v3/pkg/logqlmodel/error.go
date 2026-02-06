package logqlmodel

import (
	"errors"
	"fmt"

	"github.com/prometheus/prometheus/model/labels"
)

// Those errors are useful for comparing error returned by the engine.
// e.g. errors.Is(err,logqlmodel.ErrParse) let you know if this is a ast parsing error.
var (
	ErrParse                            = errors.New("failed to parse the log query")
	ErrPipeline                         = errors.New("failed execute pipeline")
	ErrLimit                            = errors.New("limit reached while evaluating the query")
	ErrIntervalLimit                    = errors.New("[interval] value exceeds limit")
	ErrBlocked                          = errors.New("query blocked by policy")
	ErrParseMatchers                    = errors.New("only label matchers are supported")
	ErrUnsupportedSyntaxForInstantQuery = errors.New("log queries are not supported as an instant query type, please change your query to a range query type")
	ErrorLabel                          = "__error__"
	PreserveErrorLabel                  = "__preserve_error__"
	ErrorDetailsLabel                   = "__error_details__"
)

// ParseError is what is returned when we failed to parse.
type ParseError struct {
	msg       string
	line, col int
}

func (p ParseError) Error() string {
	if p.col == 0 && p.line == 0 {
		return fmt.Sprintf("parse error : %s", p.msg)
	}
	return fmt.Sprintf("parse error at line %d, col %d: %s", p.line, p.col, p.msg)
}

// Is allows to use errors.Is(err,ErrParse) on this error.
func (p ParseError) Is(target error) bool {
	return target == ErrParse
}

func NewParseError(msg string, line, col int) ParseError {
	return ParseError{
		msg:  msg,
		line: line,
		col:  col,
	}
}

func NewStageError(expr string, err error) ParseError {
	return ParseError{
		msg:  fmt.Sprintf(`stage '%s' : %s`, expr, err),
		line: 0,
		col:  0,
	}
}

type PipelineError struct {
	metric    labels.Labels
	errorType string
}

func NewPipelineErr(metric labels.Labels) *PipelineError {
	return &PipelineError{
		metric:    metric,
		errorType: metric.Get(ErrorLabel),
	}
}

func (e PipelineError) Error() string {
	return fmt.Sprintf(
		"pipeline error: '%s' for series: '%s'.\n"+
			"Use a label filter to intentionally skip this error. (e.g | __error__!=\"%s\").\n"+
			"To skip all potential errors you can match empty errors.(e.g __error__=\"\")\n"+
			"The label filter can also be specified after unwrap. (e.g | unwrap latency | __error__=\"\" )\n",
		e.errorType, e.metric, e.errorType)
}

// Is allows to use errors.Is(err,ErrPipeline) on this error.
func (e PipelineError) Is(target error) bool {
	return target == ErrPipeline
}

type LimitError struct {
	error
}

func NewSeriesLimitError(limit int) *LimitError {
	return &LimitError{
		error: fmt.Errorf("maximum of series (%d) reached for a single query", limit),
	}
}

// Is allows to use errors.Is(err,ErrLimit) on this error.
func (e LimitError) Is(target error) bool {
	return target == ErrLimit
}
