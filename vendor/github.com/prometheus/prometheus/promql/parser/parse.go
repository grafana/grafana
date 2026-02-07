// Copyright 2015 The Prometheus Authors
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

package parser

import (
	"errors"
	"fmt"
	"math"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/common/model"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/timestamp"
	"github.com/prometheus/prometheus/promql/parser/posrange"
	"github.com/prometheus/prometheus/util/strutil"
)

var parserPool = sync.Pool{
	New: func() interface{} {
		return &parser{}
	},
}

type Parser interface {
	ParseExpr() (Expr, error)
	Close()
}

type parser struct {
	lex Lexer

	inject    ItemType
	injecting bool

	// functions contains all functions supported by the parser instance.
	functions map[string]*Function

	// Everytime an Item is lexed that could be the end
	// of certain expressions its end position is stored here.
	lastClosing posrange.Pos

	yyParser yyParserImpl

	generatedParserResult interface{}
	parseErrors           ParseErrors
}

type Opt func(p *parser)

func WithFunctions(functions map[string]*Function) Opt {
	return func(p *parser) {
		p.functions = functions
	}
}

// NewParser returns a new parser.
func NewParser(input string, opts ...Opt) *parser { //nolint:revive // unexported-return
	p := parserPool.Get().(*parser)

	p.functions = Functions
	p.injecting = false
	p.parseErrors = nil
	p.generatedParserResult = nil

	// Clear lexer struct before reusing.
	p.lex = Lexer{
		input: input,
		state: lexStatements,
	}

	// Apply user define options.
	for _, opt := range opts {
		opt(p)
	}

	return p
}

func (p *parser) ParseExpr() (expr Expr, err error) {
	defer p.recover(&err)

	parseResult := p.parseGenerated(START_EXPRESSION)

	if parseResult != nil {
		expr = parseResult.(Expr)
	}

	// Only typecheck when there are no syntax errors.
	if len(p.parseErrors) == 0 {
		p.checkAST(expr)
	}

	if len(p.parseErrors) != 0 {
		err = p.parseErrors
	}

	return expr, err
}

func (p *parser) Close() {
	defer parserPool.Put(p)
}

// ParseErr wraps a parsing error with line and position context.
type ParseErr struct {
	PositionRange posrange.PositionRange
	Err           error
	Query         string

	// LineOffset is an additional line offset to be added. Only used inside unit tests.
	LineOffset int
}

func (e *ParseErr) Error() string {
	return fmt.Sprintf("%s: parse error: %s", e.PositionRange.StartPosInput(e.Query, e.LineOffset), e.Err)
}

type ParseErrors []ParseErr

// Since producing multiple error messages might look weird when combined with error wrapping,
// only the first error produced by the parser is included in the error string.
// If getting the full error list is desired, it is recommended to typecast the error returned
// by the parser to ParseErrors and work with the underlying slice.
func (errs ParseErrors) Error() string {
	if len(errs) != 0 {
		return errs[0].Error()
	}
	// Should never happen
	// Panicking while printing an error seems like a bad idea, so the
	// situation is explained in the error message instead.
	return "error contains no error message"
}

// EnrichParseError enriches a single or list of parse errors (used for unit tests and promtool).
func EnrichParseError(err error, enrich func(parseErr *ParseErr)) {
	var parseErr *ParseErr
	if errors.As(err, &parseErr) {
		enrich(parseErr)
	}
	var parseErrors ParseErrors
	if errors.As(err, &parseErrors) {
		for i, e := range parseErrors {
			enrich(&e)
			parseErrors[i] = e
		}
	}
}

// ParseExpr returns the expression parsed from the input.
func ParseExpr(input string) (expr Expr, err error) {
	p := NewParser(input)
	defer p.Close()
	return p.ParseExpr()
}

// ParseMetric parses the input into a metric.
func ParseMetric(input string) (m labels.Labels, err error) {
	p := NewParser(input)
	defer p.Close()
	defer p.recover(&err)

	parseResult := p.parseGenerated(START_METRIC)
	if parseResult != nil {
		m = parseResult.(labels.Labels)
	}

	if len(p.parseErrors) != 0 {
		err = p.parseErrors
	}

	return m, err
}

// ParseMetricSelector parses the provided textual metric selector into a list of
// label matchers.
func ParseMetricSelector(input string) (m []*labels.Matcher, err error) {
	p := NewParser(input)
	defer p.Close()
	defer p.recover(&err)

	parseResult := p.parseGenerated(START_METRIC_SELECTOR)
	if parseResult != nil {
		m = parseResult.(*VectorSelector).LabelMatchers
	}

	if len(p.parseErrors) != 0 {
		err = p.parseErrors
	}

	return m, err
}

// ParseMetricSelectors parses a list of provided textual metric selectors into lists of
// label matchers.
func ParseMetricSelectors(matchers []string) (m [][]*labels.Matcher, err error) {
	var matcherSets [][]*labels.Matcher
	for _, s := range matchers {
		matchers, err := ParseMetricSelector(s)
		if err != nil {
			return nil, err
		}
		matcherSets = append(matcherSets, matchers)
	}
	return matcherSets, nil
}

// SequenceValue is an omittable value in a sequence of time series values.
type SequenceValue struct {
	Value     float64
	Omitted   bool
	Histogram *histogram.FloatHistogram
}

func (v SequenceValue) String() string {
	if v.Omitted {
		return "_"
	}
	if v.Histogram != nil {
		return v.Histogram.String()
	}
	return fmt.Sprintf("%f", v.Value)
}

type seriesDescription struct {
	labels labels.Labels
	values []SequenceValue
}

// ParseSeriesDesc parses the description of a time series. It is only used in
// the PromQL testing framework code.
func ParseSeriesDesc(input string) (labels labels.Labels, values []SequenceValue, err error) {
	p := NewParser(input)
	p.lex.seriesDesc = true

	defer p.Close()
	defer p.recover(&err)

	parseResult := p.parseGenerated(START_SERIES_DESCRIPTION)
	if parseResult != nil {
		result := parseResult.(*seriesDescription)

		labels = result.labels
		values = result.values
	}

	if len(p.parseErrors) != 0 {
		err = p.parseErrors
	}

	return labels, values, err
}

// addParseErrf formats the error and appends it to the list of parsing errors.
func (p *parser) addParseErrf(positionRange posrange.PositionRange, format string, args ...interface{}) {
	p.addParseErr(positionRange, fmt.Errorf(format, args...))
}

// addParseErr appends the provided error to the list of parsing errors.
func (p *parser) addParseErr(positionRange posrange.PositionRange, err error) {
	perr := ParseErr{
		PositionRange: positionRange,
		Err:           err,
		Query:         p.lex.input,
	}

	p.parseErrors = append(p.parseErrors, perr)
}

func (p *parser) addSemanticError(err error) {
	p.addParseErr(p.yyParser.lval.item.PositionRange(), err)
}

// unexpected creates a parser error complaining about an unexpected lexer item.
// The item that is presented as unexpected is always the last item produced
// by the lexer.
func (p *parser) unexpected(context, expected string) {
	var errMsg strings.Builder

	// Do not report lexer errors twice
	if p.yyParser.lval.item.Typ == ERROR {
		return
	}

	errMsg.WriteString("unexpected ")
	errMsg.WriteString(p.yyParser.lval.item.desc())

	if context != "" {
		errMsg.WriteString(" in ")
		errMsg.WriteString(context)
	}

	if expected != "" {
		errMsg.WriteString(", expected ")
		errMsg.WriteString(expected)
	}

	p.addParseErr(p.yyParser.lval.item.PositionRange(), errors.New(errMsg.String()))
}

var errUnexpected = errors.New("unexpected error")

// recover is the handler that turns panics into returns from the top level of Parse.
func (p *parser) recover(errp *error) {
	e := recover()
	switch _, ok := e.(runtime.Error); {
	case ok:
		// Print the stack trace but do not inhibit the running application.
		buf := make([]byte, 64<<10)
		buf = buf[:runtime.Stack(buf, false)]

		fmt.Fprintf(os.Stderr, "parser panic: %v\n%s", e, buf)
		*errp = errUnexpected
	case e != nil:
		*errp = e.(error)
	}
}

// Lex is expected by the yyLexer interface of the yacc generated parser.
// It writes the next Item provided by the lexer to the provided pointer address.
// Comments are skipped.
//
// The yyLexer interface is currently implemented by the parser to allow
// the generated and non-generated parts to work together with regards to lookahead
// and error handling.
//
// For more information, see https://pkg.go.dev/golang.org/x/tools/cmd/goyacc.
func (p *parser) Lex(lval *yySymType) int {
	var typ ItemType

	if p.injecting {
		p.injecting = false
		return int(p.inject)
	}
	// Skip comments.
	for {
		p.lex.NextItem(&lval.item)
		typ = lval.item.Typ
		if typ != COMMENT {
			break
		}
	}

	switch typ {
	case ERROR:
		pos := posrange.PositionRange{
			Start: p.lex.start,
			End:   posrange.Pos(len(p.lex.input)),
		}
		p.addParseErr(pos, errors.New(p.yyParser.lval.item.Val))

		// Tells yacc that this is the end of input.
		return 0
	case EOF:
		lval.item.Typ = EOF
		p.InjectItem(0)
	case RIGHT_BRACE, RIGHT_PAREN, RIGHT_BRACKET, DURATION, NUMBER:
		p.lastClosing = lval.item.Pos + posrange.Pos(len(lval.item.Val))
	}

	return int(typ)
}

// Error is expected by the yyLexer interface of the yacc generated parser.
//
// It is a no-op since the parsers error routines are triggered
// by mechanisms that allow more fine-grained control
// For more information, see https://pkg.go.dev/golang.org/x/tools/cmd/goyacc.
func (p *parser) Error(string) {
}

// InjectItem allows injecting a single Item at the beginning of the token stream
// consumed by the generated parser.
// This allows having multiple start symbols as described in
// https://www.gnu.org/software/bison/manual/html_node/Multiple-start_002dsymbols.html .
// Only the Lex function used by the generated parser is affected by this injected Item.
// Trying to inject when a previously injected Item has not yet been consumed will panic.
// Only Item types that are supposed to be used as start symbols are allowed as an argument.
func (p *parser) InjectItem(typ ItemType) {
	if p.injecting {
		panic("cannot inject multiple Items into the token stream")
	}

	if typ != 0 && (typ <= startSymbolsStart || typ >= startSymbolsEnd) {
		panic("cannot inject symbol that isn't start symbol")
	}

	p.inject = typ
	p.injecting = true
}

func (p *parser) newBinaryExpression(lhs Node, op Item, modifiers, rhs Node) *BinaryExpr {
	ret := modifiers.(*BinaryExpr)

	ret.LHS = lhs.(Expr)
	ret.RHS = rhs.(Expr)
	ret.Op = op.Typ

	return ret
}

func (p *parser) assembleVectorSelector(vs *VectorSelector) {
	// If the metric name was set outside the braces, add a matcher for it.
	// If the metric name was inside the braces we don't need to do anything.
	if vs.Name != "" {
		nameMatcher, err := labels.NewMatcher(labels.MatchEqual, labels.MetricName, vs.Name)
		if err != nil {
			panic(err) // Must not happen with labels.MatchEqual
		}
		vs.LabelMatchers = append(vs.LabelMatchers, nameMatcher)
	}
}

func (p *parser) newAggregateExpr(op Item, modifier, args Node) (ret *AggregateExpr) {
	ret = modifier.(*AggregateExpr)
	arguments := args.(Expressions)

	ret.PosRange = posrange.PositionRange{
		Start: op.Pos,
		End:   p.lastClosing,
	}

	ret.Op = op.Typ

	if len(arguments) == 0 {
		p.addParseErrf(ret.PositionRange(), "no arguments for aggregate expression provided")

		// Prevents invalid array accesses.
		return
	}

	desiredArgs := 1
	if ret.Op.IsAggregatorWithParam() {
		if !EnableExperimentalFunctions && ret.Op.IsExperimentalAggregator() {
			p.addParseErrf(ret.PositionRange(), "%s() is experimental and must be enabled with --enable-feature=promql-experimental-functions", ret.Op)
			return
		}
		desiredArgs = 2

		ret.Param = arguments[0]
	}

	if len(arguments) != desiredArgs {
		p.addParseErrf(ret.PositionRange(), "wrong number of arguments for aggregate expression provided, expected %d, got %d", desiredArgs, len(arguments))
		return
	}

	ret.Expr = arguments[desiredArgs-1]

	return ret
}

// newMap is used when building the FloatHistogram from a map.
func (p *parser) newMap() (ret map[string]interface{}) {
	return map[string]interface{}{}
}

// mergeMaps is used to combine maps as they're used to later build the Float histogram.
// This will merge the right map into the left map.
func (p *parser) mergeMaps(left, right *map[string]interface{}) (ret *map[string]interface{}) {
	for key, value := range *right {
		if _, ok := (*left)[key]; ok {
			p.addParseErrf(posrange.PositionRange{}, "duplicate key \"%s\" in histogram", key)
			continue
		}
		(*left)[key] = value
	}
	return left
}

func (p *parser) histogramsIncreaseSeries(base, inc *histogram.FloatHistogram, times uint64) ([]SequenceValue, error) {
	return p.histogramsSeries(base, inc, times, func(a, b *histogram.FloatHistogram) (*histogram.FloatHistogram, error) {
		return a.Add(b)
	})
}

func (p *parser) histogramsDecreaseSeries(base, inc *histogram.FloatHistogram, times uint64) ([]SequenceValue, error) {
	return p.histogramsSeries(base, inc, times, func(a, b *histogram.FloatHistogram) (*histogram.FloatHistogram, error) {
		return a.Sub(b)
	})
}

func (p *parser) histogramsSeries(base, inc *histogram.FloatHistogram, times uint64,
	combine func(*histogram.FloatHistogram, *histogram.FloatHistogram) (*histogram.FloatHistogram, error),
) ([]SequenceValue, error) {
	ret := make([]SequenceValue, times+1)
	// Add an additional value (the base) for time 0, which we ignore in tests.
	ret[0] = SequenceValue{Histogram: base}
	cur := base
	for i := uint64(1); i <= times; i++ {
		if cur.Schema > inc.Schema {
			return nil, fmt.Errorf("error combining histograms: cannot merge from schema %d to %d", inc.Schema, cur.Schema)
		}

		var err error
		cur, err = combine(cur.Copy(), inc)
		if err != nil {
			return ret, err
		}
		ret[i] = SequenceValue{Histogram: cur}
	}

	return ret, nil
}

// buildHistogramFromMap is used in the grammar to take then individual parts of the histogram and complete it.
func (p *parser) buildHistogramFromMap(desc *map[string]interface{}) *histogram.FloatHistogram {
	output := &histogram.FloatHistogram{}

	val, ok := (*desc)["schema"]
	if ok {
		schema, ok := val.(int64)
		if ok {
			output.Schema = int32(schema)
		} else {
			p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing schema number: %v", val)
		}
	}

	val, ok = (*desc)["sum"]
	if ok {
		sum, ok := val.(float64)
		if ok {
			output.Sum = sum
		} else {
			p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing sum number: %v", val)
		}
	}
	val, ok = (*desc)["count"]
	if ok {
		count, ok := val.(float64)
		if ok {
			output.Count = count
		} else {
			p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing count number: %v", val)
		}
	}

	val, ok = (*desc)["z_bucket"]
	if ok {
		bucket, ok := val.(float64)
		if ok {
			output.ZeroCount = bucket
		} else {
			p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing z_bucket number: %v", val)
		}
	}
	val, ok = (*desc)["z_bucket_w"]
	if ok {
		bucketWidth, ok := val.(float64)
		if ok {
			output.ZeroThreshold = bucketWidth
		} else {
			p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing z_bucket_w number: %v", val)
		}
	}
	val, ok = (*desc)["custom_values"]
	if ok {
		customValues, ok := val.([]float64)
		if ok {
			output.CustomValues = customValues
		} else {
			p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing custom_values: %v", val)
		}
	}

	val, ok = (*desc)["counter_reset_hint"]
	if ok {
		resetHint, ok := val.(Item)

		if ok {
			switch resetHint.Typ {
			case UNKNOWN_COUNTER_RESET:
				output.CounterResetHint = histogram.UnknownCounterReset
			case COUNTER_RESET:
				output.CounterResetHint = histogram.CounterReset
			case NOT_COUNTER_RESET:
				output.CounterResetHint = histogram.NotCounterReset
			case GAUGE_TYPE:
				output.CounterResetHint = histogram.GaugeType
			default:
				p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing counter_reset_hint: unknown value %v", resetHint.Typ)
			}
		} else {
			p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing counter_reset_hint: %v", val)
		}
	}

	buckets, spans := p.buildHistogramBucketsAndSpans(desc, "buckets", "offset")
	output.PositiveBuckets = buckets
	output.PositiveSpans = spans

	buckets, spans = p.buildHistogramBucketsAndSpans(desc, "n_buckets", "n_offset")
	output.NegativeBuckets = buckets
	output.NegativeSpans = spans

	return output
}

func (p *parser) buildHistogramBucketsAndSpans(desc *map[string]interface{}, bucketsKey, offsetKey string,
) (buckets []float64, spans []histogram.Span) {
	bucketCount := 0
	val, ok := (*desc)[bucketsKey]
	if ok {
		val, ok := val.([]float64)
		if ok {
			buckets = val
			bucketCount = len(buckets)
		} else {
			p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing %s float array: %v", bucketsKey, val)
		}
	}
	offset := int32(0)
	val, ok = (*desc)[offsetKey]
	if ok {
		val, ok := val.(int64)
		if ok {
			offset = int32(val)
		} else {
			p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing %s number: %v", offsetKey, val)
		}
	}
	if bucketCount > 0 {
		spans = []histogram.Span{{Offset: offset, Length: uint32(bucketCount)}}
	}
	return
}

// number parses a number.
func (p *parser) number(val string) float64 {
	n, err := strconv.ParseInt(val, 0, 64)
	f := float64(n)
	if err != nil {
		f, err = strconv.ParseFloat(val, 64)
	}
	if err != nil {
		p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error parsing number: %s", err)
	}
	return f
}

// expectType checks the type of the node and raises an error if it
// is not of the expected type.
func (p *parser) expectType(node Node, want ValueType, context string) {
	t := p.checkAST(node)
	if t != want {
		p.addParseErrf(node.PositionRange(), "expected type %s in %s, got %s", DocumentedType(want), context, DocumentedType(t))
	}
}

// checkAST checks the validity of the provided AST. This includes type checking.
func (p *parser) checkAST(node Node) (typ ValueType) {
	// For expressions the type is determined by their Type function.
	// Lists do not have a type but are not invalid either.
	switch n := node.(type) {
	case Expressions:
		typ = ValueTypeNone
	case Expr:
		typ = n.Type()
	default:
		p.addParseErrf(node.PositionRange(), "unknown node type: %T", node)
	}

	// Recursively check correct typing for child nodes and raise
	// errors in case of bad typing.
	switch n := node.(type) {
	case *EvalStmt:
		ty := p.checkAST(n.Expr)
		if ty == ValueTypeNone {
			p.addParseErrf(n.Expr.PositionRange(), "evaluation statement must have a valid expression type but got %s", DocumentedType(ty))
		}

	case Expressions:
		for _, e := range n {
			ty := p.checkAST(e)
			if ty == ValueTypeNone {
				p.addParseErrf(e.PositionRange(), "expression must have a valid expression type but got %s", DocumentedType(ty))
			}
		}
	case *AggregateExpr:
		if !n.Op.IsAggregator() {
			p.addParseErrf(n.PositionRange(), "aggregation operator expected in aggregation expression but got %q", n.Op)
		}
		p.expectType(n.Expr, ValueTypeVector, "aggregation expression")
		if n.Op == TOPK || n.Op == BOTTOMK || n.Op == QUANTILE || n.Op == LIMITK || n.Op == LIMIT_RATIO {
			p.expectType(n.Param, ValueTypeScalar, "aggregation parameter")
		}
		if n.Op == COUNT_VALUES {
			p.expectType(n.Param, ValueTypeString, "aggregation parameter")
		}

	case *BinaryExpr:
		lt := p.checkAST(n.LHS)
		rt := p.checkAST(n.RHS)

		// opRange returns the PositionRange of the operator part of the BinaryExpr.
		// This is made a function instead of a variable, so it is lazily evaluated on demand.
		opRange := func() (r posrange.PositionRange) {
			// Remove whitespace at the beginning and end of the range.
			for r.Start = n.LHS.PositionRange().End; isSpace(rune(p.lex.input[r.Start])); r.Start++ {
			}
			for r.End = n.RHS.PositionRange().Start - 1; isSpace(rune(p.lex.input[r.End])); r.End-- {
			}
			return
		}

		if n.ReturnBool && !n.Op.IsComparisonOperator() {
			p.addParseErrf(opRange(), "bool modifier can only be used on comparison operators")
		}

		if n.Op.IsComparisonOperator() && !n.ReturnBool && n.RHS.Type() == ValueTypeScalar && n.LHS.Type() == ValueTypeScalar {
			p.addParseErrf(opRange(), "comparisons between scalars must use BOOL modifier")
		}

		if n.Op.IsSetOperator() && n.VectorMatching.Card == CardOneToOne {
			n.VectorMatching.Card = CardManyToMany
		}

		for _, l1 := range n.VectorMatching.MatchingLabels {
			for _, l2 := range n.VectorMatching.Include {
				if l1 == l2 && n.VectorMatching.On {
					p.addParseErrf(opRange(), "label %q must not occur in ON and GROUP clause at once", l1)
				}
			}
		}

		if !n.Op.IsOperator() {
			p.addParseErrf(n.PositionRange(), "binary expression does not support operator %q", n.Op)
		}
		if lt != ValueTypeScalar && lt != ValueTypeVector {
			p.addParseErrf(n.LHS.PositionRange(), "binary expression must contain only scalar and instant vector types")
		}
		if rt != ValueTypeScalar && rt != ValueTypeVector {
			p.addParseErrf(n.RHS.PositionRange(), "binary expression must contain only scalar and instant vector types")
		}

		switch {
		case (lt != ValueTypeVector || rt != ValueTypeVector) && n.VectorMatching != nil:
			if len(n.VectorMatching.MatchingLabels) > 0 {
				p.addParseErrf(n.PositionRange(), "vector matching only allowed between instant vectors")
			}
			n.VectorMatching = nil
		case n.Op.IsSetOperator(): // Both operands are Vectors.
			if n.VectorMatching.Card == CardOneToMany || n.VectorMatching.Card == CardManyToOne {
				p.addParseErrf(n.PositionRange(), "no grouping allowed for %q operation", n.Op)
			}
			if n.VectorMatching.Card != CardManyToMany {
				p.addParseErrf(n.PositionRange(), "set operations must always be many-to-many")
			}
		}

		if (lt == ValueTypeScalar || rt == ValueTypeScalar) && n.Op.IsSetOperator() {
			p.addParseErrf(n.PositionRange(), "set operator %q not allowed in binary scalar expression", n.Op)
		}

	case *Call:
		nargs := len(n.Func.ArgTypes)
		if n.Func.Variadic == 0 {
			if nargs != len(n.Args) {
				p.addParseErrf(n.PositionRange(), "expected %d argument(s) in call to %q, got %d", nargs, n.Func.Name, len(n.Args))
			}
		} else {
			na := nargs - 1
			if na > len(n.Args) {
				p.addParseErrf(n.PositionRange(), "expected at least %d argument(s) in call to %q, got %d", na, n.Func.Name, len(n.Args))
			} else if nargsmax := na + n.Func.Variadic; n.Func.Variadic > 0 && nargsmax < len(n.Args) {
				p.addParseErrf(n.PositionRange(), "expected at most %d argument(s) in call to %q, got %d", nargsmax, n.Func.Name, len(n.Args))
			}
		}

		if n.Func.Name == "info" && len(n.Args) > 1 {
			// Check the type is correct first
			if n.Args[1].Type() != ValueTypeVector {
				p.addParseErrf(node.PositionRange(), "expected type %s in %s, got %s", DocumentedType(ValueTypeVector), fmt.Sprintf("call to function %q", n.Func.Name), DocumentedType(n.Args[1].Type()))
			}
			// Check the vector selector in the input doesn't contain a metric name
			if n.Args[1].(*VectorSelector).Name != "" {
				p.addParseErrf(n.Args[1].PositionRange(), "expected label selectors only, got vector selector instead")
			}
			// Set Vector Selector flag to bypass empty matcher check
			n.Args[1].(*VectorSelector).BypassEmptyMatcherCheck = true
		}

		for i, arg := range n.Args {
			if i >= len(n.Func.ArgTypes) {
				if n.Func.Variadic == 0 {
					// This is not a vararg function so we should not check the
					// type of the extra arguments.
					break
				}
				i = len(n.Func.ArgTypes) - 1
			}
			p.expectType(arg, n.Func.ArgTypes[i], fmt.Sprintf("call to function %q", n.Func.Name))
		}

	case *ParenExpr:
		p.checkAST(n.Expr)

	case *UnaryExpr:
		if n.Op != ADD && n.Op != SUB {
			p.addParseErrf(n.PositionRange(), "only + and - operators allowed for unary expressions")
		}
		if t := p.checkAST(n.Expr); t != ValueTypeScalar && t != ValueTypeVector {
			p.addParseErrf(n.PositionRange(), "unary expression only allowed on expressions of type scalar or instant vector, got %q", DocumentedType(t))
		}

	case *SubqueryExpr:
		ty := p.checkAST(n.Expr)
		if ty != ValueTypeVector {
			p.addParseErrf(n.PositionRange(), "subquery is only allowed on instant vector, got %s instead", ty)
		}
	case *MatrixSelector:
		p.checkAST(n.VectorSelector)

	case *VectorSelector:
		if n.Name != "" {
			// In this case the last LabelMatcher is checking for the metric name
			// set outside the braces. This checks if the name has already been set
			// previously.
			for _, m := range n.LabelMatchers[0 : len(n.LabelMatchers)-1] {
				if m != nil && m.Name == labels.MetricName {
					p.addParseErrf(n.PositionRange(), "metric name must not be set twice: %q or %q", n.Name, m.Value)
				}
			}

			// Skip the check for non-empty matchers because an explicit
			// metric name is a non-empty matcher.
			break
		}
		if !n.BypassEmptyMatcherCheck {
			// A Vector selector must contain at least one non-empty matcher to prevent
			// implicit selection of all metrics (e.g. by a typo).
			notEmpty := false
			for _, lm := range n.LabelMatchers {
				if lm != nil && !lm.Matches("") {
					notEmpty = true
					break
				}
			}
			if !notEmpty {
				p.addParseErrf(n.PositionRange(), "vector selector must contain at least one non-empty matcher")
			}
		}

	case *NumberLiteral, *StringLiteral:
		// Nothing to do for terminals.

	default:
		p.addParseErrf(n.PositionRange(), "unknown node type: %T", node)
	}
	return
}

func (p *parser) unquoteString(s string) string {
	unquoted, err := strutil.Unquote(s)
	if err != nil {
		p.addParseErrf(p.yyParser.lval.item.PositionRange(), "error unquoting string %q: %s", s, err)
	}
	return unquoted
}

func parseDuration(ds string) (time.Duration, error) {
	dur, err := model.ParseDuration(ds)
	if err != nil {
		return 0, err
	}
	if dur == 0 {
		return 0, errors.New("duration must be greater than 0")
	}
	return time.Duration(dur), nil
}

// parseGenerated invokes the yacc generated parser.
// The generated parser gets the provided startSymbol injected into
// the lexer stream, based on which grammar will be used.
func (p *parser) parseGenerated(startSymbol ItemType) interface{} {
	p.InjectItem(startSymbol)

	p.yyParser.Parse(p)

	return p.generatedParserResult
}

func (p *parser) newLabelMatcher(label, operator, value Item) *labels.Matcher {
	op := operator.Typ
	val := p.unquoteString(value.Val)

	// Map the Item to the respective match type.
	var matchType labels.MatchType
	switch op {
	case EQL:
		matchType = labels.MatchEqual
	case NEQ:
		matchType = labels.MatchNotEqual
	case EQL_REGEX:
		matchType = labels.MatchRegexp
	case NEQ_REGEX:
		matchType = labels.MatchNotRegexp
	default:
		// This should never happen, since the error should have been caught
		// by the generated parser.
		panic("invalid operator")
	}

	m, err := labels.NewMatcher(matchType, label.Val, val)
	if err != nil {
		p.addParseErr(mergeRanges(&label, &value), err)
	}

	return m
}

func (p *parser) newMetricNameMatcher(value Item) *labels.Matcher {
	m, err := labels.NewMatcher(labels.MatchEqual, labels.MetricName, value.Val)
	if err != nil {
		p.addParseErr(value.PositionRange(), err)
	}

	return m
}

// addOffset is used to set the offset in the generated parser.
func (p *parser) addOffset(e Node, offset time.Duration) {
	var orgoffsetp *time.Duration
	var endPosp *posrange.Pos

	switch s := e.(type) {
	case *VectorSelector:
		orgoffsetp = &s.OriginalOffset
		endPosp = &s.PosRange.End
	case *MatrixSelector:
		vs, ok := s.VectorSelector.(*VectorSelector)
		if !ok {
			p.addParseErrf(e.PositionRange(), "ranges only allowed for vector selectors")
			return
		}
		orgoffsetp = &vs.OriginalOffset
		endPosp = &s.EndPos
	case *SubqueryExpr:
		orgoffsetp = &s.OriginalOffset
		endPosp = &s.EndPos
	default:
		p.addParseErrf(e.PositionRange(), "offset modifier must be preceded by an instant vector selector or range vector selector or a subquery")
		return
	}

	// it is already ensured by parseDuration func that there never will be a zero offset modifier
	switch {
	case *orgoffsetp != 0:
		p.addParseErrf(e.PositionRange(), "offset may not be set multiple times")
	case orgoffsetp != nil:
		*orgoffsetp = offset
	}

	*endPosp = p.lastClosing
}

// setTimestamp is used to set the timestamp from the @ modifier in the generated parser.
func (p *parser) setTimestamp(e Node, ts float64) {
	if math.IsInf(ts, -1) || math.IsInf(ts, 1) || math.IsNaN(ts) ||
		ts >= float64(math.MaxInt64) || ts <= float64(math.MinInt64) {
		p.addParseErrf(e.PositionRange(), "timestamp out of bounds for @ modifier: %f", ts)
	}
	var timestampp **int64
	var endPosp *posrange.Pos

	timestampp, _, endPosp, ok := p.getAtModifierVars(e)
	if !ok {
		return
	}

	if timestampp != nil {
		*timestampp = new(int64)
		**timestampp = timestamp.FromFloatSeconds(ts)
	}

	*endPosp = p.lastClosing
}

// setAtModifierPreprocessor is used to set the preprocessor for the @ modifier.
func (p *parser) setAtModifierPreprocessor(e Node, op Item) {
	_, preprocp, endPosp, ok := p.getAtModifierVars(e)
	if !ok {
		return
	}

	if preprocp != nil {
		*preprocp = op.Typ
	}

	*endPosp = p.lastClosing
}

func (p *parser) getAtModifierVars(e Node) (**int64, *ItemType, *posrange.Pos, bool) {
	var (
		timestampp **int64
		preprocp   *ItemType
		endPosp    *posrange.Pos
	)
	switch s := e.(type) {
	case *VectorSelector:
		timestampp = &s.Timestamp
		preprocp = &s.StartOrEnd
		endPosp = &s.PosRange.End
	case *MatrixSelector:
		vs, ok := s.VectorSelector.(*VectorSelector)
		if !ok {
			p.addParseErrf(e.PositionRange(), "ranges only allowed for vector selectors")
			return nil, nil, nil, false
		}
		preprocp = &vs.StartOrEnd
		timestampp = &vs.Timestamp
		endPosp = &s.EndPos
	case *SubqueryExpr:
		preprocp = &s.StartOrEnd
		timestampp = &s.Timestamp
		endPosp = &s.EndPos
	default:
		p.addParseErrf(e.PositionRange(), "@ modifier must be preceded by an instant vector selector or range vector selector or a subquery")
		return nil, nil, nil, false
	}

	if *timestampp != nil || (*preprocp) == START || (*preprocp) == END {
		p.addParseErrf(e.PositionRange(), "@ <timestamp> may not be set multiple times")
		return nil, nil, nil, false
	}

	return timestampp, preprocp, endPosp, true
}

func MustLabelMatcher(mt labels.MatchType, name, val string) *labels.Matcher {
	m, err := labels.NewMatcher(mt, name, val)
	if err != nil {
		panic(err)
	}
	return m
}

func MustGetFunction(name string) *Function {
	f, ok := getFunction(name, Functions)
	if !ok {
		panic(fmt.Errorf("function %q does not exist", name))
	}
	return f
}
