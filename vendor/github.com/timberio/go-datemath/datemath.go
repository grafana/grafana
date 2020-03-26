// Requires golang.org/x/tools/cmd/goyacc and modernc.org/golex
//
//go:generate goyacc -o datemath.y.go datemath.y
//go:generate golex -o datemath.l.go datemath.l

/*
Package datemath provides an expression language for relative dates based on Elasticsearch's date math.

This package is useful for letting end-users describe dates in a simple format similar to Grafana and Kibana and for
persisting them as relative dates.

The expression starts with an anchor date, which can either be "now", or an ISO8601 date string ending with ||. This
anchor date can optionally be followed by one or more date math expressions, for example:

	now+1h	Add one hour
	now-1d	Subtract one day
	now/d	Round down to the nearest day

The supported time units are:
	y Years
	M Months
	w Weeks
	d Days
	b Business Days (excludes Saturday and Sunday by default, use WithBusinessDayFunc to override)
	h Hours
	H Hours
	m Minutes
	s Seconds

Compatibility with Elasticsearch datemath

This package aims to be a superset of Elasticsearch's expressions. That is, any datemath expression that is valid for
Elasticsearch should evaluate in the same way here.

Currently the package does not support expressions outside of those also considered valid by Elasticsearch, but this may
change in the future to include additional functionality.
*/
package datemath

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func init() {
	// have goyacc parser return more verbose syntax error messages
	yyErrorVerbose = true
}

var missingTimeZone = time.FixedZone("MISSING", 0)

type timeUnit rune

const (
	timeUnitYear        = timeUnit('y')
	timeUnitMonth       = timeUnit('M')
	timeUnitWeek        = timeUnit('w')
	timeUnitDay         = timeUnit('d')
	timeUnitBusinessDay = timeUnit('b')
	timeUnitHour        = timeUnit('h')
	timeUnitMinute      = timeUnit('m')
	timeUnitSecond      = timeUnit('s')
)

func (u timeUnit) String() string {
	return string(u)
}

// Expression represents a parsed datemath expression
type Expression struct {
	input string

	mathExpression
}

type mathExpression struct {
	anchorDateExpression anchorDateExpression
	adjustments          []timeAdjuster
}

func newMathExpression(anchorDateExpression anchorDateExpression, adjustments []timeAdjuster) mathExpression {
	return mathExpression{
		anchorDateExpression: anchorDateExpression,
		adjustments:          adjustments,
	}
}

// MarshalJSON implements the json.Marshaler interface
//
// It serializes as the string expression the Expression was created with
func (e Expression) MarshalJSON() ([]byte, error) {
	return []byte(strconv.Quote(e.String())), nil
}

// UnmarshalJSON implements the json.Unmarshaler interface
//
// Parses the datemath expression from a JSON string
func (e *Expression) UnmarshalJSON(data []byte) error {
	s, err := strconv.Unquote(string(data))
	if err != nil {
		return err
	}

	expression, err := Parse(s)
	if err != nil {
		return nil
	}

	*e = expression
	return nil
}

// String returns a the string used to create the expression
func (e Expression) String() string {
	return e.input
}

// Options represesent configurable behavior for interpreting the datemath expression
type Options struct {
	// Use this this time as "now"
	// Default is `time.Now()`
	Now time.Time

	// Use this location if there is no timezone in the expression
	// Defaults to time.UTC
	Location *time.Location

	// Use this weekday as the start of the week
	// Defaults to time.Monday
	StartOfWeek time.Weekday

	// Rounding to period should be done to the end of the period
	// Defaults to false
	RoundUp bool

	BusinessDayFunc func(time.Time) bool
}

// WithNow use the given time as "now"
func WithNow(now time.Time) func(*Options) {
	return func(o *Options) {
		o.Now = now
	}
}

// WithStartOfWeek uses the given weekday as the start of the week
func WithStartOfWeek(day time.Weekday) func(*Options) {
	return func(o *Options) {
		o.StartOfWeek = day
	}
}

// WithLocation uses the given location as the timezone of the date if unspecified
func WithLocation(l *time.Location) func(*Options) {
	return func(o *Options) {
		o.Location = l
	}
}

// WithRoundUp sets the rounding of time to the end of the period instead of the beginning
func WithRoundUp(b bool) func(*Options) {
	return func(o *Options) {
		o.RoundUp = b
	}
}

// WithBusinessDayFunc use the given fn to check if a day is a business day
func WithBusinessDayFunc(fn func(time.Time) bool) func(*Options) {
	return func(o *Options) {
		o.BusinessDayFunc = fn
	}
}

func isNotWeekend(t time.Time) bool {
	return t.Weekday() != time.Saturday && t.Weekday() != time.Sunday
}

// Time evaluate the expression with the given options to get the time it represents
func (e Expression) Time(opts ...func(*Options)) time.Time {
	options := Options{
		Now:         time.Now(),
		Location:    time.UTC,
		StartOfWeek: time.Monday,
	}
	for _, opt := range opts {
		opt(&options)
	}

	t := e.anchorDateExpression(options)
	for _, adjustment := range e.adjustments {
		t = adjustment(t, options)
	}
	return t
}

// Parse parses the datemath expression which can later be evaluated
func Parse(s string) (Expression, error) {
	lex := newLexer([]byte(s))
	lexWrapper := newLexerWrapper(lex)

	yyParse(lexWrapper)

	if len(lex.errors) > 0 {
		return Expression{}, fmt.Errorf(strings.Join(lex.errors, "\n"))
	}

	return Expression{input: s, mathExpression: lexWrapper.expression}, nil
}

// MustParse is the same as Parse() but panic's on error
func MustParse(s string) Expression {
	e, err := Parse(s)
	if err != nil {
		panic(err)
	}
	return e
}

// ParseAndEvaluate is a convience wrapper to parse and return the time that the expression represents
func ParseAndEvaluate(s string, opts ...func(*Options)) (time.Time, error) {
	expression, err := Parse(s)
	if err != nil {
		return time.Time{}, err
	}

	return expression.Time(opts...), nil
}

type anchorDateExpression func(opts Options) time.Time

func anchorDateNow(opts Options) time.Time {
	return opts.Now.In(opts.Location)
}

func anchorDate(t time.Time) func(opts Options) time.Time {
	return func(opts Options) time.Time {
		location := t.Location()
		if location == missingTimeZone {
			location = opts.Location
		}

		return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), location)
	}
}

type timeAdjuster func(time.Time, Options) time.Time

func addUnits(factor int, u timeUnit) func(time.Time, Options) time.Time {
	return func(t time.Time, options Options) time.Time {
		switch u {
		case timeUnitYear:
			return t.AddDate(factor, 0, 0)
		case timeUnitMonth:
			return t.AddDate(0, factor, 0)
		case timeUnitWeek:
			return t.AddDate(0, 0, 7*factor)
		case timeUnitDay:
			return t.AddDate(0, 0, factor)
		case timeUnitBusinessDay:

			fn := options.BusinessDayFunc
			if fn == nil {
				fn = isNotWeekend
			}

			increment := 1
			if factor < 0 {
				increment = -1
			}

			for i := factor; i != 0; i -= increment {
				t = t.AddDate(0, 0, increment)
				for !fn(t) {
					t = t.AddDate(0, 0, increment)
				}
			}

			return t

		case timeUnitHour:
			return t.Add(time.Duration(factor) * time.Hour)
		case timeUnitMinute:
			return t.Add(time.Duration(factor) * time.Minute)
		case timeUnitSecond:
			return t.Add(time.Duration(factor) * time.Second)
		default:
			panic(fmt.Sprintf("unknown time unit: %s", u))
		}
	}
}

func truncateUnits(u timeUnit) func(time.Time, Options) time.Time {
	var roundDown = func(t time.Time, options Options) time.Time {
		switch u {
		case timeUnitYear:
			return time.Date(t.Year(), 1, 1, 0, 0, 0, 0, t.Location())
		case timeUnitMonth:
			return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
		case timeUnitWeek:
			diff := int(t.Weekday() - options.StartOfWeek)
			if diff < 0 {
				return time.Date(t.Year(), t.Month(), t.Day()+diff-1, 0, 0, 0, 0, t.Location())
			}
			return time.Date(t.Year(), t.Month(), t.Day()-diff, 0, 0, 0, 0, t.Location())
		case timeUnitDay:
			return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
		case timeUnitHour:
			return t.Truncate(time.Hour)
		case timeUnitMinute:
			return t.Truncate(time.Minute)
		case timeUnitSecond:
			return t.Truncate(time.Second)
		default:
			panic(fmt.Sprintf("unknown time unit: %s", u))
		}
	}

	return func(t time.Time, options Options) time.Time {
		if options.RoundUp {
			return addUnits(1, u)(roundDown(t, options), options).Add(-time.Millisecond)
		}
		return roundDown(t, options)
	}
}

func daysIn(m time.Month, year int) int {
	return time.Date(year, m+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// lexerWrapper wraps the golex generated wrapper to store the parsed expression for later and provide needed data to
// the parser
type lexerWrapper struct {
	lex yyLexer

	expression mathExpression
}

func newLexerWrapper(lex yyLexer) *lexerWrapper {
	return &lexerWrapper{
		lex: lex,
	}
}

func (l *lexerWrapper) Lex(lval *yySymType) int {
	return l.lex.Lex(lval)
}

func (l *lexerWrapper) Error(s string) {
	l.lex.Error(s)
}
