// LogQL formatter is inspired from PromQL formatter
// https://github.com/prometheus/prometheus/blob/release-2.40/promql/parser/prettier.go
// https://youtu.be/pjkWzDVxWk4?t=24469

package syntax

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/prometheus/common/model"
)

// How LogQL formatter works?
// =========================
// General idea is to parse the LogQL query(string) and converts it into AST(expressions) first, then format each expression from bottom up (from leaf expressions to the root expression). Every expression in AST has a level/depth (distance from the root), that is passed by it's parent.
//
// While prettifying an expression, we consider two things:
// 1. Did the current expression's parent add a new line?
// 2. Does the current expression exceeds `maxCharsPerLine` limit?
//
// The level of a expression determines if it should be indented or not.
// The answer to the 1 is NO if the level passed is 0. This means, the
// parent expression did not apply a new line, so the current Node must not
// apply any indentation as prefix.
// If level > 1, a new line is applied by the parent. So, the current expression
// should prefix an indentation before writing any of its content. This indentation
// will be ([level/depth of current expression] * "  ").
//
// The answer to 2 is YES if the normalized length of the current expression exceeds
// the `maxCharsPerLine` limit. Hence, it applies the indentation equal to
// its depth and increments the level by 1 before passing down the child.
// If the answer is NO, the current expression returns the normalized string value of itself.
//

var (
	// MaxCharsPerLine is used to qualify whether some LogQL expressions are worth `splitting` into new lines.
	MaxCharsPerLine = 100
)

func Prettify(e Expr) string {
	return e.Pretty(0)
}

// e.g: `{foo="bar"}`
func (e *MatchersExpr) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

// e.g: `{foo="bar"} | logfmt | level="error"`
// Here, left = `{foo="bar"}` and multistages would collection of each stage in pipeline, here `logfmt` and `level="error"`
func (e *PipelineExpr) Pretty(level int) string {
	if !NeedSplit(e) {
		return Indent(level) + e.String()
	}

	s := fmt.Sprintf("%s\n", e.Left.Pretty(level))
	for i, ms := range e.MultiStages {
		s += ms.Pretty(level + 1)
		//NOTE: Needed because, we tend to format multiple stage in pipeline as each stage in single line
		// e.g:
		// | logfmt
		// | level = "error"
		// But all the stages will have same indent level. So here we don't increase level.
		if i < len(e.MultiStages)-1 {
			s += "\n"
		}
	}
	return s
}

// e.g: `|= "error" != "memcache" |= ip("192.168.0.1")`
// NOTE: here `ip` is Op in this expression.
func (e *LineFilterExpr) Pretty(level int) string {
	if !NeedSplit(e) {
		return Indent(level) + e.String()
	}

	var s string

	if e.Left != nil {
		// s += indent(level)
		s += e.Left.Pretty(level)
		// NOTE: Similar to PiplelinExpr, we also have to format every LineFilterExpr in new line. But with same indendation level.
		// e.g:
		// |= "error"
		// != "memcached"
		// |= ip("192.168.0.1")
		s += "\n"
	}

	s += Indent(level)

	// We re-use LineFilterExpr's String() implementation to avoid duplication.
	// We create new LineFilterExpr without `Left`.
	ne := newLineFilterExpr(e.Ty, e.Op, e.Match)
	s += ne.String()

	return s
}

func (e *LogfmtParserExpr) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

// e.g:
// `| json`
// `| regexp`
// `| pattern`
// `| unpack`
func (e *LabelParserExpr) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

func (e *DropLabelsExpr) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

func (e *KeepLabelsExpr) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

// e.g: | level!="error"
func (e *LabelFilterExpr) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

// e.g: | line_format "{{ .label }}"
func (e *LineFmtExpr) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

// e.g: | decolorize
func (e *DecolorizeExpr) Pretty(_ int) string {
	return e.String()
}

// e.g: | label_format dst="{{ .src }}"
func (e *LabelFmtExpr) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

// e.g: | json label="expression", another="expression"
func (e *JSONExpressionParser) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

// e.g: | logfmt label="expression", another="expression"
func (e *LogfmtExpressionParser) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

// e.g: sum_over_time({foo="bar"} | logfmt | unwrap bytes_processed [5m])
func (e *UnwrapExpr) Pretty(level int) string {
	s := Indent(level)

	if e.Operation != "" {
		s += fmt.Sprintf("%s %s %s(%s)", OpPipe, OpUnwrap, e.Operation, e.Identifier)
	} else {
		s += fmt.Sprintf("%s %s %s", OpPipe, OpUnwrap, e.Identifier)
	}
	for _, f := range e.PostFilters {
		s += fmt.Sprintf("\n%s%s %s", Indent(level), OpPipe, f)
	}
	return s
}

// e.g: `{foo="bar"}|logfmt[5m]`
// TODO(kavi): Rename `LogRange` -> `LogRangeExpr` (to be consistent with other expressions?)
func (e *LogRange) Pretty(level int) string {
	s := e.Left.Pretty(level)

	if e.Unwrap != nil {
		// NOTE: | unwrap should go to newline
		s += "\n"
		s += e.Unwrap.Pretty(level + 1)
	}

	// TODO: this will put [1m] on the same line, not in new line as people used to now.
	s = fmt.Sprintf("%s [%s]", s, model.Duration(e.Interval))

	if e.Offset != 0 {
		oe := OffsetExpr{Offset: e.Offset}
		s += oe.Pretty(level)
	}

	return s
}

// e.g: count_over_time({foo="bar"}[5m] offset 3h)
// TODO(kavi): why does offset not work in log queries? e.g: `{foo="bar"} offset 1h`? is it bug? or anything else?
// NOTE: Also offset expression never to be indented. It always goes with its parent expression (usually RangeExpr).
func (e *OffsetExpr) Pretty(_ int) string {
	// using `model.Duration` as it can format ignoring zero units.
	// e.g: time.Duration(2 * Hour) -> "2h0m0s"
	// but model.Duration(2 * Hour) -> "2h"
	return fmt.Sprintf(" %s %s", OpOffset, model.Duration(e.Offset))
}

// e.g: count_over_time({foo="bar"}[5m])
func (e *RangeAggregationExpr) Pretty(level int) string {
	s := Indent(level)
	if !NeedSplit(e) {
		return s + e.String()
	}

	s += e.Operation // e.g: quantile_over_time

	s += "(\n"

	// print args to the function.
	if e.Params != nil {
		s = fmt.Sprintf("%s%s%s,", s, Indent(level+1), fmt.Sprint(*e.Params))
		s += "\n"
	}

	s += e.Left.Pretty(level + 1)

	s += "\n" + Indent(level) + ")"

	if e.Grouping != nil {
		s += e.Grouping.Pretty(level)
	}

	return s
}

// e.g:
// sum(count_over_time({foo="bar"}[5m])) by (container)
// topk(10, count_over_time({foo="bar"}[5m])) by (container)

// Syntax: <aggr-op>([parameter,] <vector expression>) [without|by (<label list>)]
// <aggr-op> - sum, avg, bottomk, topk, etc.
// [parameters,] - optional params, used only by bottomk and topk for now.
// <vector expression> - vector on which aggregation is done.
// [without|by (<label list)] - optional labels to aggregate either with `by` or `without` clause.
func (e *VectorAggregationExpr) Pretty(level int) string {
	s := Indent(level)

	if !NeedSplit(e) {
		return s + e.String()
	}

	var params []string

	// level + 1 because arguments to function will be in newline.
	left := e.Left.Pretty(level + 1)
	switch e.Operation {
	// e.Params default value (0) can mean a legit param for topk and bottomk
	case OpTypeBottomK, OpTypeTopK:
		params = []string{fmt.Sprintf("%s%d", Indent(level+1), e.Params), left}

	default:
		if e.Params != 0 {
			params = []string{fmt.Sprintf("%s%d", Indent(level+1), e.Params), left}
		} else {
			params = []string{left}
		}
	}

	s += e.Operation
	if e.Grouping != nil {
		s += e.Grouping.Pretty(level)
	}

	// (\n [params,\n])
	s += "(\n"
	for i, v := range params {
		s += v
		// LogQL doesn't allow `,` at the end of last argument.
		if i < len(params)-1 {
			s += ","
		}
		s += "\n"
	}
	s += Indent(level) + ")"

	return s
}

// e.g: Any operations involving
// "or", "and" and "unless" (logical/set)
// "+", "-", "*", "/", "%", "^" (arithmetic)
// "==", "!=", ">", ">=", "<", "<=" (comparison)
func (e *BinOpExpr) Pretty(level int) string {

	s := Indent(level)
	if !NeedSplit(e) {
		return s + e.String()
	}

	s = e.SampleExpr.Pretty(level+1) + "\n"

	op := formatBinaryOp(e.Op, e.Opts)
	s += Indent(level) + op + "\n"
	s += e.RHS.Pretty(level + 1)

	return s
}

// e.g: 4.6
func (e *LiteralExpr) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

// e.g: label_replace(rate({job="api-server",service="a:c"}[5m]), "foo", "$1", "service", "(.*):.*")
func (e *LabelReplaceExpr) Pretty(level int) string {
	s := Indent(level)

	if !NeedSplit(e) {
		return s + e.String()
	}

	s += OpLabelReplace

	s += "(\n"

	params := []string{
		e.Left.Pretty(level + 1),
		Indent(level+1) + strconv.Quote(e.Dst),
		Indent(level+1) + strconv.Quote(e.Replacement),
		Indent(level+1) + strconv.Quote(e.Src),
		Indent(level+1) + strconv.Quote(e.Regex),
	}

	for i, v := range params {
		s += v
		// LogQL doesn't allow `,` at the end of last argument.
		if i < len(params)-1 {
			s += ","
		}
		s += "\n"
	}

	s += Indent(level) + ")"

	return s
}

// e.g: vector(5)
func (e *VectorExpr) Pretty(level int) string {
	return commonPrefixIndent(level, e)
}

// Grouping is technically not expression type. But used in both range and vector aggregations (`by` and `without` clause)
// So by implenting `Pretty` for Grouping, we can re use it for both.
// NOTE: indent is ignored for `Grouping`, because grouping always stays in the same line of it's parent expression.

// e.g:
// by(container,namespace) -> by (container, namespace)
func (g *Grouping) Pretty(_ int) string {
	var s string

	if g.Without {
		s += " without"
	} else if len(g.Groups) > 0 {
		s += " by"
	}

	if len(g.Groups) > 0 {
		s += " ("
		s += strings.Join(g.Groups, ", ")
		s += ")"
	}
	return s
}

// Helpers

func commonPrefixIndent(level int, current Expr) string {
	return fmt.Sprintf("%s%s", Indent(level), current.String())
}

func NeedSplit(e Expr) bool {
	if e == nil {
		return false
	}
	return len(e.String()) > MaxCharsPerLine
}

const indentString = "  "

func Indent(level int) string {
	return strings.Repeat(indentString, level)
}

func formatBinaryOp(op string, opts *BinOpOptions) string {
	if opts == nil {
		return op
	}

	if opts.ReturnBool {
		// e.g: ">= bool 1"
		op += " bool"
	}

	if opts.VectorMatching != nil {
		group := "" // default one-to-one
		if opts.VectorMatching.Card == CardManyToOne {
			group = OpGroupLeft
		}
		if opts.VectorMatching.Card == CardOneToMany {
			group = OpGroupRight
		}

		if len(opts.VectorMatching.Include) > 0 {
			// e.g: group_left (node, name)
			group = fmt.Sprintf("%s (%s)", group, strings.Join(opts.VectorMatching.Include, ", "))
		}

		if len(opts.VectorMatching.MatchingLabels) > 0 {
			on := OpOn
			if !opts.VectorMatching.On {
				on = OpIgnoring
			}
			// e.g: * on (cluster, namespace) group_left
			op = fmt.Sprintf("%s %s (%s) %s", op, on, strings.Join(opts.VectorMatching.MatchingLabels, ", "), group)
		}
	}
	return op
}
