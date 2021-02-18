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
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pkg/errors"
	"github.com/prometheus/common/model"

	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/prometheus/prometheus/util/strutil"
)

var parserPool = sync.Pool{
	New: func() interface{} {
		return &parser{}
	},
}

type parser struct {
	lex Lexer

	inject    ItemType
	injecting bool

	// Everytime an Item is lexed that could be the end
	// of certain expressions its end position is stored here.
	lastClosing Pos

	yyParser yyParserImpl

	generatedParserResult interface{}
	parseErrors           ParseErrors
}

// ParseErr wraps a parsing error with line and position context.
type ParseErr struct {
	PositionRange PositionRange
	Err           error
	Query         string

	// LineOffset is an additional line offset to be added. Only used inside unit tests.
	LineOffset int
}

func (e *ParseErr) Error() string {
	pos := int(e.PositionRange.Start)
	lastLineBreak := -1
	line := e.LineOffset + 1

	var positionStr string

	if pos < 0 || pos > len(e.Query) {
		positionStr = "invalid position:"
	} else {

		for i, c := range e.Query[:pos] {
			if c == '\n' {
				lastLineBreak = i
				line++
			}
		}

		col := pos - lastLineBreak
		positionStr = fmt.Sprintf("%d:%d:", line, col)
	}
	return fmt.Sprintf("%s parse error: %s", positionStr, e.Err)
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

// ParseExpr returns the expression parsed from the input.
func ParseExpr(input string) (expr Expr, err error) {
	p := newParser(input)
	defer parserPool.Put(p)
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

// ParseMetric parses the input into a metric
func ParseMetric(input string) (m labels.Labels, err error) {
	p := newParser(input)
	defer parserPool.Put(p)
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
	p := newParser(input)
	defer parserPool.Put(p)
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

// newParser returns a new parser.
func newParser(input string) *parser {
	p := parserPool.Get().(*parser)

	p.injecting = false
	p.parseErrors = nil
	p.generatedParserResult = nil

	// Clear lexer struct before reusing.
	p.lex = Lexer{
		input: input,
		state: lexStatements,
	}
	return p
}

// SequenceValue is an omittable value in a sequence of time series values.
type SequenceValue struct {
	Value   float64
	Omitted bool
}

func (v SequenceValue) String() string {
	if v.Omitted {
		return "_"
	}
	return fmt.Sprintf("%f", v.Value)
}

type seriesDescription struct {
	labels labels.Labels
	values []SequenceValue
}

// ParseSeriesDesc parses the description of a time series.
func ParseSeriesDesc(input string) (labels labels.Labels, values []SequenceValue, err error) {
	p := newParser(input)
	p.lex.seriesDesc = true

	defer parserPool.Put(p)
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
func (p *parser) addParseErrf(positionRange PositionRange, format string, args ...interface{}) {
	p.addParseErr(positionRange, errors.Errorf(format, args...))
}

// addParseErr appends the provided error to the list of parsing errors.
func (p *parser) addParseErr(positionRange PositionRange, err error) {
	perr := ParseErr{
		PositionRange: positionRange,
		Err:           err,
		Query:         p.lex.input,
	}

	p.parseErrors = append(p.parseErrors, perr)
}

// unexpected creates a parser error complaining about an unexpected lexer item.
// The item that is presented as unexpected is always the last item produced
// by the lexer.
func (p *parser) unexpected(context string, expected string) {
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
	if _, ok := e.(runtime.Error); ok {
		// Print the stack trace but do not inhibit the running application.
		buf := make([]byte, 64<<10)
		buf = buf[:runtime.Stack(buf, false)]

		fmt.Fprintf(os.Stderr, "parser panic: %v\n%s", e, buf)
		*errp = errUnexpected
	} else if e != nil {
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
// For more information, see https://godoc.org/golang.org/x/tools/cmd/goyacc.
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
		pos := PositionRange{
			Start: p.lex.start,
			End:   Pos(len(p.lex.input)),
		}
		p.addParseErr(pos, errors.New(p.yyParser.lval.item.Val))

		// Tells yacc that this is the end of input.
		return 0
	case EOF:
		lval.item.Typ = EOF
		p.InjectItem(0)
	case RIGHT_BRACE, RIGHT_PAREN, RIGHT_BRACKET, DURATION:
		p.lastClosing = lval.item.Pos + Pos(len(lval.item.Val))
	}

	return int(typ)
}

// Error is expected by the yyLexer interface of the yacc generated parser.
//
// It is a no-op since the parsers error routines are triggered
// by mechanisms that allow more fine-grained control
// For more information, see https://godoc.org/golang.org/x/tools/cmd/goyacc.
func (p *parser) Error(e string) {
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
func (p *parser) newBinaryExpression(lhs Node, op Item, modifiers Node, rhs Node) *BinaryExpr {
	ret := modifiers.(*BinaryExpr)

	ret.LHS = lhs.(Expr)
	ret.RHS = rhs.(Expr)
	ret.Op = op.Typ

	return ret
}

func (p *parser) assembleVectorSelector(vs *VectorSelector) {
	if vs.Name != "" {
		nameMatcher, err := labels.NewMatcher(labels.MatchEqual, labels.MetricName, vs.Name)
		if err != nil {
			panic(err) // Must not happen with labels.MatchEqual
		}
		vs.LabelMatchers = append(vs.LabelMatchers, nameMatcher)
	}
}

func (p *parser) newAggregateExpr(op Item, modifier Node, args Node) (ret *AggregateExpr) {
	ret = modifier.(*AggregateExpr)
	arguments := args.(Expressions)

	ret.PosRange = PositionRange{
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

// checkAST checks the sanity of the provided AST. This includes type checking.
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
		if n.Op == TOPK || n.Op == BOTTOMK || n.Op == QUANTILE {
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
		opRange := func() (r PositionRange) {
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

		if (lt != ValueTypeVector || rt != ValueTypeVector) && n.VectorMatching != nil {
			if len(n.VectorMatching.MatchingLabels) > 0 {
				p.addParseErrf(n.PositionRange(), "vector matching only allowed between instant vectors")
			}
			n.VectorMatching = nil
		} else {
			// Both operands are Vectors.
			if n.Op.IsSetOperator() {
				if n.VectorMatching.Card == CardOneToMany || n.VectorMatching.Card == CardManyToOne {
					p.addParseErrf(n.PositionRange(), "no grouping allowed for %q operation", n.Op)
				}
				if n.VectorMatching.Card != CardManyToMany {
					p.addParseErrf(n.PositionRange(), "set operations must always be many-to-many")
				}
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
			p.addParseErrf(n.PositionRange(), "subquery is only allowed on instant vector, got %s in %q instead", ty, n.String())
		}
	case *MatrixSelector:
		p.checkAST(n.VectorSelector)

	case *VectorSelector:
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

		if n.Name != "" {
			// In this case the last LabelMatcher is checking for the metric name
			// set outside the braces. This checks if the name has already been set
			// previously
			for _, m := range n.LabelMatchers[0 : len(n.LabelMatchers)-1] {
				if m != nil && m.Name == labels.MetricName {
					p.addParseErrf(n.PositionRange(), "metric name must not be set twice: %q or %q", n.Name, m.Value)
				}
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

func (p *parser) newLabelMatcher(label Item, operator Item, value Item) *labels.Matcher {
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

func (p *parser) addOffset(e Node, offset time.Duration) {
	var offsetp *time.Duration
	var endPosp *Pos

	switch s := e.(type) {
	case *VectorSelector:
		offsetp = &s.Offset
		endPosp = &s.PosRange.End
	case *MatrixSelector:
		if vs, ok := s.VectorSelector.(*VectorSelector); ok {
			offsetp = &vs.Offset
		}
		endPosp = &s.EndPos
	case *SubqueryExpr:
		offsetp = &s.Offset
		endPosp = &s.EndPos
	default:
		p.addParseErrf(e.PositionRange(), "offset modifier must be preceded by an instant or range selector, but follows a %T instead", e)
		return
	}

	// it is already ensured by parseDuration func that there never will be a zero offset modifier
	if *offsetp != 0 {
		p.addParseErrf(e.PositionRange(), "offset may not be set multiple times")
	} else if offsetp != nil {
		*offsetp = offset
	}

	*endPosp = p.lastClosing

}
