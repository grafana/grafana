package syntax

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/loki/v3/pkg/util"

	"github.com/pkg/errors"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/promql"

	"github.com/grafana/regexp/syntax"

	"github.com/grafana/loki/v3/pkg/logql/log"
	"github.com/grafana/loki/v3/pkg/logqlmodel"
)

// Expr is the root expression which can be a SampleExpr or LogSelectorExpr
//
//sumtype:decl
type Expr interface {
	logQLExpr()                   // ensure it's not implemented accidentally
	Shardable(topLevel bool) bool // A recursive check on the AST to see if it's shardable.
	Walkable
	fmt.Stringer
	AcceptVisitor

	// Pretty prettyfies any LogQL expression at given `level` of the whole LogQL query.
	Pretty(level int) string
}

func Clone[T Expr](e T) (T, error) {
	var empty T
	v := &cloneVisitor{}
	e.Accept(v)
	cast, ok := v.cloned.(T)
	if !ok {
		return empty, fmt.Errorf("unexpected type of cloned expression: want %T, got %T", empty, v.cloned)
	}
	return cast, nil
}

func MustClone[T Expr](e T) T {
	copied, err := Clone[T](e)
	if err != nil {
		panic(err)
	}
	return copied
}

func ExtractLineFilters(e Expr) []LineFilterExpr {
	if e == nil {
		return nil
	}
	var filters []LineFilterExpr
	visitor := &DepthFirstTraversal{
		VisitLineFilterFn: func(v RootVisitor, e *LineFilterExpr) {
			if e != nil {
				filters = append(filters, *e)
			}
		},
	}
	e.Accept(visitor)
	return filters
}

// implicit holds default implementations
type implicit struct{}

func (implicit) logQLExpr() {}

// LogSelectorExpr is a LogQL expression filtering and returning logs.
//
//sumtype:decl
type LogSelectorExpr interface {
	Matchers() []*labels.Matcher
	Pipeline() (Pipeline, error)
	HasFilter() bool
	Expr

	isLogSelectorExpr()
}

// Type alias for backward compatibility
type (
	Pipeline        = log.Pipeline
	SampleExtractor = log.SampleExtractor
)

// StageExpr is an expression defining a single step into a log pipeline
//
//sumtype:decl
type StageExpr interface {
	Stage() (log.Stage, error)
	Expr

	isStageExpr()
}

// MultiStageExpr is multiple stages which implements a LogSelectorExpr.
type MultiStageExpr []StageExpr

func (m MultiStageExpr) Pipeline() (log.Pipeline, error) {
	stages, err := m.stages()
	if err != nil {
		return nil, err
	}
	return log.NewPipeline(stages), nil
}

func (m MultiStageExpr) stages() ([]log.Stage, error) {
	c := make([]log.Stage, 0, len(m))
	for _, e := range m.reorderStages() {
		p, err := e.Stage()
		if err != nil {
			return nil, logqlmodel.NewStageError(e.String(), err)
		}
		if p == log.NoopStage {
			continue
		}
		c = append(c, p)
	}
	return c, nil
}

// reorderStages reorders m such that LineFilters
// are as close to the front of the filter as possible.
func (m MultiStageExpr) reorderStages() []StageExpr {
	var (
		result         = make([]StageExpr, 0, len(m))
		lineFilters    = make([]*LineFilterExpr, 0, len(m))
		notLineFilters = make([]StageExpr, 0, len(m))
	)

	combineFilters := func() {
		if len(lineFilters) > 0 {
			result = append(result, combineFilters(lineFilters))
		}

		result = append(result, notLineFilters...)

		lineFilters = lineFilters[:0]
		notLineFilters = notLineFilters[:0]
	}

	for _, s := range m {
		switch f := s.(type) {
		case *LabelFilterExpr:
			combineFilters()
			result = append(result, f)
		case *LineFilterExpr:
			lineFilters = append(lineFilters, f)
		case *LineFmtExpr:
			// line_format modifies the contents of the line so any line filter
			// originally after a line_format must still be after the same
			// line_format.

			notLineFilters = append(notLineFilters, f)

			combineFilters()
		case *LabelParserExpr:
			notLineFilters = append(notLineFilters, f)

			// unpack modifies the contents of the line so any line filter
			// originally after an unpack must still be after the same
			// unpack.
			if f.Op == OpParserTypeUnpack {
				combineFilters()
			}
		default:
			notLineFilters = append(notLineFilters, f)
		}
	}

	combineFilters()

	return result
}

func combineFilters(in []*LineFilterExpr) StageExpr {
	result := in[len(in)-1]
	for i := len(in) - 2; i >= 0; i-- {
		leaf := leafNode(result, in[i])
		if leaf != nil {
			leaf.Left = in[i]
		}
	}

	return result
}

func leafNode(in *LineFilterExpr, child *LineFilterExpr) *LineFilterExpr {
	current := in
	//nolint:revive
	for ; current.Left != nil; current = current.Left {
		if current == child || current.Left == child {
			return nil
		}
	}
	return current
}

func (m MultiStageExpr) String() string {
	var sb strings.Builder
	for i, e := range m {
		sb.WriteString(e.String())
		if i+1 != len(m) {
			sb.WriteString(" ")
		}
	}
	return sb.String()
}

func (MultiStageExpr) logQLExpr() {} // nolint:unused

type MatchersExpr struct {
	Mts []*labels.Matcher
	implicit
}

func newMatcherExpr(matchers []*labels.Matcher) *MatchersExpr {
	return &MatchersExpr{Mts: matchers}
}

func (e *MatchersExpr) isLogSelectorExpr() {}

func (e *MatchersExpr) Matchers() []*labels.Matcher {
	return e.Mts
}

func (e *MatchersExpr) AppendMatchers(m []*labels.Matcher) {
	e.Mts = append(e.Mts, m...)
}

func (e *MatchersExpr) Shardable(_ bool) bool { return true }

func (e *MatchersExpr) Walk(f WalkFn) { f(e) }

func (e *MatchersExpr) Accept(v RootVisitor) { v.VisitMatchers(e) }

func (e *MatchersExpr) String() string {
	var sb strings.Builder
	sb.WriteString("{")
	for i, m := range e.Mts {
		sb.WriteString(m.String())
		if i+1 != len(e.Mts) {
			sb.WriteString(", ")
		}
	}
	sb.WriteString("}")
	return sb.String()
}

func (e *MatchersExpr) Pipeline() (log.Pipeline, error) {
	return log.NewNoopPipeline(), nil
}

func (e *MatchersExpr) HasFilter() bool {
	return false
}

type PipelineExpr struct {
	MultiStages MultiStageExpr
	Left        *MatchersExpr
	implicit
}

func newPipelineExpr(left *MatchersExpr, pipeline MultiStageExpr) LogSelectorExpr {
	return &PipelineExpr{
		Left:        left,
		MultiStages: pipeline,
	}
}

func (e *PipelineExpr) isLogSelectorExpr() {}

func (e *PipelineExpr) Shardable(topLevel bool) bool {
	for _, p := range e.MultiStages {
		if !p.Shardable(topLevel) {
			return false
		}
	}
	return true
}

func (e *PipelineExpr) Walk(f WalkFn) {
	f(e)

	if e.Left == nil {
		return
	}

	xs := make([]Walkable, 0, len(e.MultiStages)+1)
	xs = append(xs, e.Left)
	for _, p := range e.MultiStages {
		xs = append(xs, p)
	}
	walkAll(f, xs...)
}

func (e *PipelineExpr) Accept(v RootVisitor) { v.VisitPipeline(e) }

func (e *PipelineExpr) Matchers() []*labels.Matcher {
	return e.Left.Matchers()
}

func (e *PipelineExpr) String() string {
	var sb strings.Builder
	sb.WriteString(e.Left.String())
	sb.WriteString(" ")
	sb.WriteString(e.MultiStages.String())
	return sb.String()
}

func (e *PipelineExpr) Pipeline() (log.Pipeline, error) {
	return e.MultiStages.Pipeline()
}

// HasFilter returns true if the pipeline contains stage that can filter out lines.
func (e *PipelineExpr) HasFilter() bool {
	for _, p := range e.MultiStages {
		switch v := p.(type) {
		case *LabelFilterExpr:
			return true
		case *LineFilterExpr:
			// ignore empty matchers as they match everything
			if !((v.Ty == log.LineMatchEqual || v.Ty == log.LineMatchRegexp) && v.Match == "") {
				return true
			}
		default:
			continue
		}
	}
	return false
}

type LineFilter struct {
	Ty    log.LineMatchType
	Match string
	Op    string
}

type LineFilterExpr struct {
	LineFilter
	Left *LineFilterExpr
	// Or in LineFilterExpr works as follows.
	//
	// Case 1: With MatchEqual operators(|= or |~, etc)
	// example: `{app="loki"} |= "test" |= "foo" or "bar"`
	// expectation: match "test" AND (either "foo" OR "bar")
	//
	// Case 2: With NotMatchEqual operators (!= or !~, etc)
	// example: `{app="loki"} != "test" != "foo" or "bar"`
	// expectation: match !"test" AND !"foo" AND !"bar", Basically exactly as if `{app="loki"} != "test" != "foo" != "bar".

	// See LineFilterExpr tests for more examples.
	Or        *LineFilterExpr
	IsOrChild bool
	implicit
}

func newLineFilterExpr(ty log.LineMatchType, op, match string) *LineFilterExpr {
	return &LineFilterExpr{
		LineFilter: LineFilter{
			Ty:    ty,
			Match: match,
			Op:    op,
		},
	}
}

func newOrLineFilter(left, right *LineFilterExpr) *LineFilterExpr {
	right.Ty = left.Ty

	// NOTE: Consider, we have chain of "or", != "foo" or "bar" or "baz"
	// we parse from right to left, so first time left="bar", right="baz", and we don't know the actual `Ty` (equal: |=, notequal: !=, regex: |~, etc). So
	// it will have default (0, LineMatchEqual).
	// we only know real `Ty` in next stage, where left="foo", right="bar or baz", at this time, `Ty` is LineMatchNotEqual(!=).
	// Now we need to update not just `right.Ty = left.Ty`, we also have to update all the `right.Or`  until `right.Or` is nil.
	tmp := right
	for tmp.Or != nil {
		tmp.Or.Ty = left.Ty
		tmp = tmp.Or
	}

	if left.Ty == log.LineMatchEqual || left.Ty == log.LineMatchRegexp || left.Ty == log.LineMatchPattern {
		left.Or = right
		right.IsOrChild = true
		return left
	}

	// !(left or right) == (!left and !right).
	return newNestedLineFilterExpr(left, right)
}

func newNestedLineFilterExpr(left *LineFilterExpr, right *LineFilterExpr) *LineFilterExpr {
	// NOTE: When parsing "or" chains in linefilter, particularly variations of NOT filters (!= or !~), we need to transform
	// say (!= "foo" or "bar "baz") => (!="foo" != "bar" != "baz")
	if right.Or != nil && !(right.Ty == log.LineMatchEqual || right.Ty == log.LineMatchRegexp || right.Ty == log.LineMatchPattern) {
		right.Or.IsOrChild = false
		tmp := right.Or
		right.Or = nil
		right = newNestedLineFilterExpr(right, tmp)
	}

	// NOTE: Before supporting `or` in linefilter, `right` will always be a leaf node (right.next == nil)
	// After supporting `or` in linefilter, `right` may not be a leaf node (e.g: |= "a" or "b). Here "b".Left = "a")
	// We traverse the tree recursively untile we make `right` leaf node.
	// Consider the following expression. {app="loki"} != "test" != "foo" or "bar or "car""
	// It first creates following tree on the left and transformed into the one on the right.
	//                                                                              ┌────────────┐
	//               ┌────────────┐                                                 │   root     │
	//               │   root     │                                                 └──────┬─────┘
	//               └──────┬─────┘                                                        │
	//                      │                                                              │
	//                      │                                                              │
	//                      │                       ─────────►            ┌────────────────┴─────────────┐
	//     ┌────────────────┴─────────────┐                               │                              │
	//     │                              │                           ┌───┴────┐                         │
	//     │                              │                           │ foo    │                      ┌──┴────┐
	//     │                            ┌─┴────┐                      └───┬────┘                      │  bar  │
	// ┌───┴────┐                       │ bar  │                          │                           └───────┘
	// │  test  │                       └──┬───┘                          │
	// └────────┘                          │                              │
	//                                     │                     ┌────────┘
	//                                     │                     │
	//                           ┌─────────┘                     │
	//                           │                               │
	//                           │                           ┌───┴───┐
	//                           │                           │  test │
	//                         ┌─┴────┐                      └───────┘
	//                         │ foo  │
	//                         └──────┘
	if right.Left != nil {
		left = newNestedLineFilterExpr(left, right.Left)
	}
	return &LineFilterExpr{
		Left:       left,
		LineFilter: right.LineFilter,
		Or:         right.Or,
		IsOrChild:  right.IsOrChild,
	}
}

func (*LineFilterExpr) isStageExpr() {}

func (e *LineFilterExpr) Walk(f WalkFn) {
	f(e)
	if e.Left == nil {
		return
	}
	e.Left.Walk(f)
}

func (e *LineFilterExpr) Accept(v RootVisitor) {
	v.VisitLineFilter(e)
}

// AddFilterExpr adds a filter expression to a logselector expression.
func AddFilterExpr(expr LogSelectorExpr, ty log.LineMatchType, op, match string) (LogSelectorExpr, error) {
	filter := newLineFilterExpr(ty, op, match)
	switch e := expr.(type) {
	case *MatchersExpr:
		return newPipelineExpr(e, MultiStageExpr{filter}), nil
	case *PipelineExpr:
		e.MultiStages = append(e.MultiStages, filter)
		return e, nil
	default:
		return nil, fmt.Errorf("unknown LogSelector: %v+", expr)
	}
}

func (e *LineFilterExpr) Shardable(_ bool) bool { return true }

func (e *LineFilterExpr) String() string {
	var sb strings.Builder
	if e.Left != nil {
		sb.WriteString(e.Left.String())
		sb.WriteString(" ")
	}

	if !e.IsOrChild { // Only write the type when we're not chaining "or" filters
		sb.WriteString(e.Ty.String())
		sb.WriteString(" ")
	}

	if e.Op == "" {
		sb.WriteString(strconv.Quote(e.Match))
	} else {
		sb.WriteString(e.Op)
		sb.WriteString("(")
		sb.WriteString(strconv.Quote(e.Match))
		sb.WriteString(")")
	}

	if e.Or != nil {
		sb.WriteString(" or ")
		// This is dirty but removes the leading MatchType from the or expression.
		sb.WriteString(e.Or.String())
	}

	return sb.String()
}

func (e *LineFilterExpr) Filter() (log.Filterer, error) {
	acc := make([]log.Filterer, 0)
	for curr := e; curr != nil; curr = curr.Left {
		var next log.Filterer
		var err error
		if curr.Or != nil {
			next, err = newOrFilter(curr)
			if err != nil {
				return nil, err
			}
			acc = append(acc, next)
		} else {
			switch curr.Op {
			case OpFilterIP:
				next, err := log.NewIPLineFilter(curr.Match, curr.Ty)
				if err != nil {
					return nil, err
				}
				acc = append(acc, next)
			default:
				next, err = log.NewFilter(curr.Match, curr.Ty)
				if err != nil {
					return nil, err
				}

				acc = append(acc, next)
			}
		}
	}

	if len(acc) == 1 {
		return acc[0], nil
	}

	// The accumulation is right to left so it needs to be reversed.
	for i := len(acc)/2 - 1; i >= 0; i-- {
		opp := len(acc) - 1 - i
		acc[i], acc[opp] = acc[opp], acc[i]
	}

	return log.NewAndFilters(acc), nil
}

func newOrFilter(f *LineFilterExpr) (log.Filterer, error) {
	orFilter, err := log.NewFilter(f.Match, f.Ty)
	if err != nil {
		return nil, err
	}

	for or := f.Or; or != nil; or = or.Or {
		filter, err := log.NewFilter(or.Match, or.Ty)
		if err != nil {
			return nil, err
		}
		orFilter = log.ChainOrFilter(orFilter, filter)
	}

	return orFilter, nil
}

func (e *LineFilterExpr) Stage() (log.Stage, error) {
	f, err := e.Filter()
	if err != nil {
		return nil, err
	}
	return f.ToStage(), nil
}

type LogfmtParserExpr struct {
	Strict    bool
	KeepEmpty bool

	implicit
}

func newLogfmtParserExpr(flags []string) *LogfmtParserExpr {
	e := LogfmtParserExpr{}
	for _, f := range flags {
		switch f {
		case OpStrict:
			e.Strict = true
		case OpKeepEmpty:
			e.KeepEmpty = true
		}
	}

	return &e
}

func (*LogfmtParserExpr) isStageExpr() {}

func (e *LogfmtParserExpr) Shardable(_ bool) bool { return true }

func (e *LogfmtParserExpr) Walk(f WalkFn) { f(e) }

func (e *LogfmtParserExpr) Accept(v RootVisitor) { v.VisitLogfmtParser(e) }

func (e *LogfmtParserExpr) Stage() (log.Stage, error) {
	return log.NewLogfmtParser(e.Strict, e.KeepEmpty), nil
}

func (e *LogfmtParserExpr) String() string {
	var sb strings.Builder
	sb.WriteString(OpPipe)
	sb.WriteString(" ")
	sb.WriteString(OpParserTypeLogfmt)

	if e.Strict {
		sb.WriteString(" ")
		sb.WriteString(OpStrict)
	}

	if e.KeepEmpty {
		sb.WriteString(" ")
		sb.WriteString(OpKeepEmpty)
	}

	return sb.String()
}

type LabelParserExpr struct {
	Op    string
	Param string
	implicit
}

func newLabelParserExpr(op, param string) *LabelParserExpr {
	if op == OpParserTypeRegexp {
		_, err := log.NewRegexpParser(param)
		if err != nil {
			panic(logqlmodel.NewParseError(fmt.Sprintf("invalid regexp parser: %s", err.Error()), 0, 0))
		}
	}
	if op == OpParserTypePattern {
		_, err := log.NewPatternParser(param)
		if err != nil {
			panic(logqlmodel.NewParseError(fmt.Sprintf("invalid pattern parser: %s", err.Error()), 0, 0))
		}
	}

	return &LabelParserExpr{
		Op:    op,
		Param: param,
	}
}

func (*LabelParserExpr) isStageExpr() {}

func (e *LabelParserExpr) Shardable(_ bool) bool { return true }

func (e *LabelParserExpr) Walk(f WalkFn) { f(e) }

func (e *LabelParserExpr) Accept(v RootVisitor) { v.VisitLabelParser(e) }

func (e *LabelParserExpr) Stage() (log.Stage, error) {
	switch e.Op {
	case OpParserTypeJSON:
		return log.NewJSONParser(), nil
	case OpParserTypeRegexp:
		return log.NewRegexpParser(e.Param)
	case OpParserTypeUnpack:
		return log.NewUnpackParser(), nil
	case OpParserTypePattern:
		return log.NewPatternParser(e.Param)
	default:
		return nil, fmt.Errorf("unknown parser operator: %s", e.Op)
	}
}

func (e *LabelParserExpr) String() string {
	var sb strings.Builder
	sb.WriteString(OpPipe)
	sb.WriteString(" ")
	sb.WriteString(e.Op)
	if e.Param != "" {
		sb.WriteString(" ")
		sb.WriteString(strconv.Quote(e.Param))
	}
	if (e.Op == OpParserTypeRegexp || e.Op == OpParserTypePattern) && e.Param == "" {
		sb.WriteString(" \"\"")
	}
	return sb.String()
}

type LabelFilterExpr struct {
	log.LabelFilterer
	implicit
}

func newLabelFilterExpr(filterer log.LabelFilterer) *LabelFilterExpr {
	return &LabelFilterExpr{
		LabelFilterer: filterer,
	}
}

func (*LabelFilterExpr) isStageExpr() {}

func (e *LabelFilterExpr) Shardable(_ bool) bool { return true }

func (e *LabelFilterExpr) Walk(f WalkFn) { f(e) }

func (e *LabelFilterExpr) Accept(v RootVisitor) { v.VisitLabelFilter(e) }

func (e *LabelFilterExpr) Stage() (log.Stage, error) {
	switch ip := e.LabelFilterer.(type) {
	case *log.IPLabelFilter:
		return ip, ip.PatternError()
	case *log.NoopLabelFilter:
		return log.NoopStage, nil
	}
	return e.LabelFilterer, nil
}

func (e *LabelFilterExpr) String() string {
	return fmt.Sprintf("%s %s", OpPipe, e.LabelFilterer.String())
}

type LineFmtExpr struct {
	Value string
	implicit
}

func newLineFmtExpr(value string) *LineFmtExpr {
	return &LineFmtExpr{
		Value: value,
	}
}

type DecolorizeExpr struct {
	implicit
}

func newDecolorizeExpr() *DecolorizeExpr {
	return &DecolorizeExpr{}
}

func (*DecolorizeExpr) isStageExpr() {}

func (e *DecolorizeExpr) Shardable(_ bool) bool { return true }

func (e *DecolorizeExpr) Stage() (log.Stage, error) {
	return log.NewDecolorizer()
}
func (e *DecolorizeExpr) String() string {
	return fmt.Sprintf("%s %s", OpPipe, OpDecolorize)
}
func (e *DecolorizeExpr) Walk(f WalkFn) { f(e) }

func (e *DecolorizeExpr) Accept(v RootVisitor) { v.VisitDecolorize(e) }

type DropLabelsExpr struct {
	dropLabels []log.DropLabel
	implicit
}

func newDropLabelsExpr(dropLabels []log.DropLabel) *DropLabelsExpr {
	return &DropLabelsExpr{dropLabels: dropLabels}
}

func (*DropLabelsExpr) isStageExpr() {}

func (e *DropLabelsExpr) Shardable(_ bool) bool { return true }

func (e *DropLabelsExpr) Stage() (log.Stage, error) {
	return log.NewDropLabels(e.dropLabels), nil
}
func (e *DropLabelsExpr) String() string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("%s %s ", OpPipe, OpDrop))

	for i, dropLabel := range e.dropLabels {
		if dropLabel.Matcher != nil {
			sb.WriteString(dropLabel.Matcher.String())
			if i+1 != len(e.dropLabels) {
				sb.WriteString(",")
			}
		}
		if dropLabel.Name != "" {
			sb.WriteString(dropLabel.Name)
			if i+1 != len(e.dropLabels) {
				sb.WriteString(",")
			}
		}
	}
	str := sb.String()
	return str
}
func (e *DropLabelsExpr) Walk(f WalkFn) { f(e) }

func (e *DropLabelsExpr) Accept(v RootVisitor) { v.VisitDropLabels(e) }

type KeepLabelsExpr struct {
	keepLabels []log.KeepLabel
	implicit
}

func newKeepLabelsExpr(keepLabels []log.KeepLabel) *KeepLabelsExpr {
	return &KeepLabelsExpr{keepLabels: keepLabels}
}

func (*KeepLabelsExpr) isStageExpr() {}

func (e *KeepLabelsExpr) Shardable(_ bool) bool { return true }

func (e *KeepLabelsExpr) Stage() (log.Stage, error) {
	return log.NewKeepLabels(e.keepLabels), nil
}

func (e *KeepLabelsExpr) String() string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("%s %s ", OpPipe, OpKeep))

	for i, keepLabel := range e.keepLabels {
		if keepLabel.Matcher != nil {
			sb.WriteString(keepLabel.Matcher.String())
			if i+1 != len(e.keepLabels) {
				sb.WriteString(",")
			}
		}
		if keepLabel.Name != "" {
			sb.WriteString(keepLabel.Name)
			if i+1 != len(e.keepLabels) {
				sb.WriteString(",")
			}
		}
	}
	str := sb.String()
	return str
}

func (e *KeepLabelsExpr) Walk(f WalkFn) { f(e) }

func (e *KeepLabelsExpr) Accept(v RootVisitor) { v.VisitKeepLabel(e) }

func (*LineFmtExpr) isStageExpr() {}

func (e *LineFmtExpr) Shardable(_ bool) bool { return true }

func (e *LineFmtExpr) Walk(f WalkFn) { f(e) }

func (e *LineFmtExpr) Accept(v RootVisitor) { v.VisitLineFmt(e) }

func (e *LineFmtExpr) Stage() (log.Stage, error) {
	return log.NewFormatter(e.Value)
}

func (e *LineFmtExpr) String() string {
	return fmt.Sprintf("%s %s %s", OpPipe, OpFmtLine, strconv.Quote(e.Value))
}

type LabelFmtExpr struct {
	Formats []log.LabelFmt
	implicit
}

func newLabelFmtExpr(fmts []log.LabelFmt) *LabelFmtExpr {
	return &LabelFmtExpr{
		Formats: fmts,
	}
}

func (*LabelFmtExpr) isStageExpr() {}

func (e *LabelFmtExpr) Shardable(_ bool) bool {
	// While LabelFmt is shardable in certain cases, it is not always,
	// but this is left to the shardmapper to determine
	return true
}

func (e *LabelFmtExpr) Walk(f WalkFn) { f(e) }

func (e *LabelFmtExpr) Accept(v RootVisitor) { v.VisitLabelFmt(e) }

func (e *LabelFmtExpr) Stage() (log.Stage, error) {
	return log.NewLabelsFormatter(e.Formats)
}

func (e *LabelFmtExpr) String() string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("%s %s ", OpPipe, OpFmtLabel))

	for i, f := range e.Formats {
		sb.WriteString(f.Name)
		sb.WriteString("=")
		if f.Rename {
			sb.WriteString(f.Value)
		} else {
			sb.WriteString(strconv.Quote(f.Value))
		}
		if i+1 != len(e.Formats) {
			sb.WriteString(",")
		}
	}
	return sb.String()
}

type JSONExpressionParser struct {
	Expressions []log.LabelExtractionExpr

	implicit
}

func newJSONExpressionParser(expressions []log.LabelExtractionExpr) *JSONExpressionParser {
	return &JSONExpressionParser{
		Expressions: expressions,
	}
}

func (*JSONExpressionParser) isStageExpr() {}

func (j *JSONExpressionParser) Shardable(_ bool) bool { return true }

func (j *JSONExpressionParser) Walk(f WalkFn) { f(j) }

func (j *JSONExpressionParser) Accept(v RootVisitor) { v.VisitJSONExpressionParser(j) }

func (j *JSONExpressionParser) Stage() (log.Stage, error) {
	return log.NewJSONExpressionParser(j.Expressions)
}

func (j *JSONExpressionParser) String() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%s %s ", OpPipe, OpParserTypeJSON))
	for i, exp := range j.Expressions {
		sb.WriteString(exp.Identifier)
		sb.WriteString("=")
		sb.WriteString(strconv.Quote(exp.Expression))

		if i+1 != len(j.Expressions) {
			sb.WriteString(",")
		}
	}
	return sb.String()
}

type internedStringSet map[string]struct {
	s  string
	ok bool
}

type LogfmtExpressionParser struct {
	Expressions       []log.LabelExtractionExpr
	Strict, KeepEmpty bool

	implicit
}

func newLogfmtExpressionParser(expressions []log.LabelExtractionExpr, flags []string) *LogfmtExpressionParser {
	e := LogfmtExpressionParser{
		Expressions: expressions,
	}

	for _, flag := range flags {
		switch flag {
		case OpStrict:
			e.Strict = true
		case OpKeepEmpty:
			e.KeepEmpty = true
		}
	}

	return &e
}

func (*LogfmtExpressionParser) isStageExpr() {}

func (l *LogfmtExpressionParser) Shardable(_ bool) bool { return true }

func (l *LogfmtExpressionParser) Walk(f WalkFn) { f(l) }

func (l *LogfmtExpressionParser) Accept(v RootVisitor) { v.VisitLogfmtExpressionParser(l) }

func (l *LogfmtExpressionParser) Stage() (log.Stage, error) {
	return log.NewLogfmtExpressionParser(l.Expressions, l.Strict)
}

func (l *LogfmtExpressionParser) String() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%s %s ", OpPipe, OpParserTypeLogfmt))
	if l.Strict {
		sb.WriteString(OpStrict)
		sb.WriteString(" ")
	}

	if l.KeepEmpty {
		sb.WriteString(OpKeepEmpty)
		sb.WriteString(" ")
	}

	for i, exp := range l.Expressions {
		sb.WriteString(exp.Identifier)
		sb.WriteString("=")
		sb.WriteString(strconv.Quote(exp.Expression))

		if i+1 != len(l.Expressions) {
			sb.WriteString(",")
		}
	}
	return sb.String()
}

func mustNewMatcher(t labels.MatchType, n, v string) *labels.Matcher {
	m, err := labels.NewMatcher(t, n, v)
	if err != nil {
		panic(logqlmodel.NewParseError(err.Error(), 0, 0))
	}
	return m
}

// simplify will return an equals matcher if there is a regex matching a literal
func simplify(typ labels.MatchType, name string, reg *syntax.Regexp) (*labels.Matcher, bool) {
	switch reg.Op {
	case syntax.OpLiteral:
		if !util.IsCaseInsensitive(reg) {
			t := labels.MatchEqual
			if typ == labels.MatchNotRegexp {
				t = labels.MatchNotEqual
			}
			return labels.MustNewMatcher(t, name, string(reg.Rune)), true
		}
		return nil, false
	}
	return nil, false
}

func mustNewFloat(s string) float64 {
	n, err := strconv.ParseFloat(s, 64)
	if err != nil {
		panic(logqlmodel.NewParseError(fmt.Sprintf("unable to parse float: %s", err.Error()), 0, 0))
	}
	return n
}

type UnwrapExpr struct {
	Identifier string
	Operation  string

	PostFilters []log.LabelFilterer
}

func (u UnwrapExpr) String() string {
	var sb strings.Builder
	if u.Operation != "" {
		sb.WriteString(fmt.Sprintf(" %s %s %s(%s)", OpPipe, OpUnwrap, u.Operation, u.Identifier))
	} else {
		sb.WriteString(fmt.Sprintf(" %s %s %s", OpPipe, OpUnwrap, u.Identifier))
	}
	for _, f := range u.PostFilters {
		sb.WriteString(fmt.Sprintf(" %s %s", OpPipe, f))
	}
	return sb.String()
}

func (u *UnwrapExpr) addPostFilter(f log.LabelFilterer) *UnwrapExpr {
	u.PostFilters = append(u.PostFilters, f)
	return u
}

func newUnwrapExpr(id string, operation string) *UnwrapExpr {
	return &UnwrapExpr{Identifier: id, Operation: operation}
}

type LogRange struct {
	Left     LogSelectorExpr
	Interval time.Duration
	Offset   time.Duration

	Unwrap *UnwrapExpr

	implicit
}

// impls Stringer
func (r LogRange) String() string {
	var sb strings.Builder
	sb.WriteString(r.Left.String())
	if r.Unwrap != nil {
		sb.WriteString(r.Unwrap.String())
	}
	sb.WriteString(fmt.Sprintf("[%v]", model.Duration(r.Interval)))
	if r.Offset != 0 {
		offsetExpr := OffsetExpr{Offset: r.Offset}
		sb.WriteString(offsetExpr.String())
	}
	return sb.String()
}

func (r *LogRange) Shardable(topLevel bool) bool { return r.Left.Shardable(topLevel) }

func (r *LogRange) Walk(f WalkFn) {
	f(r)
	if r.Left == nil {
		return
	}
	r.Left.Walk(f)
}

func (r *LogRange) Accept(v RootVisitor) {
	v.VisitLogRange(r)
}

// WithoutUnwrap returns a copy of the log range without the unwrap statement.
func (r *LogRange) WithoutUnwrap() (*LogRange, error) {
	left, err := Clone(r.Left)
	if err != nil {
		return nil, err
	}
	return &LogRange{
		Left:     left,
		Interval: r.Interval,
		Offset:   r.Offset,
	}, nil
}

func newLogRange(left LogSelectorExpr, interval time.Duration, u *UnwrapExpr, o *OffsetExpr) *LogRange {
	var offset time.Duration
	if o != nil {
		offset = o.Offset
	}
	return &LogRange{
		Left:     left,
		Interval: interval,
		Unwrap:   u,
		Offset:   offset,
	}
}

type OffsetExpr struct {
	Offset time.Duration
}

func (o *OffsetExpr) String() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(" %s %s", OpOffset, o.Offset.String()))
	return sb.String()
}

func newOffsetExpr(offset time.Duration) *OffsetExpr {
	return &OffsetExpr{
		Offset: offset,
	}
}

const (
	// vector ops
	OpTypeSum      = "sum"
	OpTypeAvg      = "avg"
	OpTypeMax      = "max"
	OpTypeMin      = "min"
	OpTypeCount    = "count"
	OpTypeStddev   = "stddev"
	OpTypeStdvar   = "stdvar"
	OpTypeBottomK  = "bottomk"
	OpTypeTopK     = "topk"
	OpTypeSort     = "sort"
	OpTypeSortDesc = "sort_desc"

	// range vector ops
	OpRangeTypeCount       = "count_over_time"
	OpRangeTypeRate        = "rate"
	OpRangeTypeRateCounter = "rate_counter"
	OpRangeTypeBytes       = "bytes_over_time"
	OpRangeTypeBytesRate   = "bytes_rate"
	OpRangeTypeAvg         = "avg_over_time"
	OpRangeTypeSum         = "sum_over_time"
	OpRangeTypeMin         = "min_over_time"
	OpRangeTypeMax         = "max_over_time"
	OpRangeTypeStdvar      = "stdvar_over_time"
	OpRangeTypeStddev      = "stddev_over_time"
	OpRangeTypeQuantile    = "quantile_over_time"
	OpRangeTypeFirst       = "first_over_time"
	OpRangeTypeLast        = "last_over_time"
	OpRangeTypeAbsent      = "absent_over_time"

	//vector
	OpTypeVector = "vector"

	// binops - logical/set
	OpTypeOr     = "or"
	OpTypeAnd    = "and"
	OpTypeUnless = "unless"

	// binops - arithmetic
	OpTypeAdd = "+"
	OpTypeSub = "-"
	OpTypeMul = "*"
	OpTypeDiv = "/"
	OpTypeMod = "%"
	OpTypePow = "^"

	// binops - comparison
	OpTypeCmpEQ = "=="
	OpTypeNEQ   = "!="
	OpTypeGT    = ">"
	OpTypeGTE   = ">="
	OpTypeLT    = "<"
	OpTypeLTE   = "<="

	// parsers
	OpParserTypeJSON    = "json"
	OpParserTypeLogfmt  = "logfmt"
	OpParserTypeRegexp  = "regexp"
	OpParserTypeUnpack  = "unpack"
	OpParserTypePattern = "pattern"

	OpFmtLine    = "line_format"
	OpFmtLabel   = "label_format"
	OpDecolorize = "decolorize"

	OpPipe   = "|"
	OpUnwrap = "unwrap"
	OpOffset = "offset"

	OpOn       = "on"
	OpIgnoring = "ignoring"

	OpGroupLeft  = "group_left"
	OpGroupRight = "group_right"

	// conversion Op
	OpConvBytes           = "bytes"
	OpConvDuration        = "duration"
	OpConvDurationSeconds = "duration_seconds"

	OpLabelReplace = "label_replace"

	// function filters
	OpFilterIP = "ip"

	// drop labels
	OpDrop = "drop"

	// keep labels
	OpKeep = "keep"

	// parser flags
	OpStrict    = "--strict"
	OpKeepEmpty = "--keep-empty"

	// internal expressions not represented in LogQL. These are used to
	// evaluate expressions differently resulting in intermediate formats
	// that are not consumable by LogQL clients but are used for sharding.
	OpRangeTypeQuantileSketch     = "__quantile_sketch_over_time__"
	OpRangeTypeFirstWithTimestamp = "__first_over_time_ts__"
	OpRangeTypeLastWithTimestamp  = "__last_over_time_ts__"
)

func IsComparisonOperator(op string) bool {
	switch op {
	case OpTypeCmpEQ, OpTypeNEQ, OpTypeGT, OpTypeGTE, OpTypeLT, OpTypeLTE:
		return true
	default:
		return false
	}
}

// IsLogicalBinOp tests whether an operation is a logical/set binary operation
func IsLogicalBinOp(op string) bool {
	switch op {
	case OpTypeOr, OpTypeAnd, OpTypeUnless:
		return true
	default:
		return false
	}
}

// SampleExpr is a LogQL expression filtering logs and returning metric samples.
//
//sumtype:decl
type SampleExpr interface {
	// Selector is the LogQL selector to apply when retrieving logs.
	Selector() (LogSelectorExpr, error)
	Extractor() (SampleExtractor, error)
	MatcherGroups() ([]MatcherRange, error)
	Expr
	isSampleExpr()
}

// RangeAggregationExpr not all range vector aggregation expressions support grouping by/without label(s),
// therefore the Grouping struct can be nil.
type RangeAggregationExpr struct {
	Left      *LogRange
	Operation string

	Params   *float64
	Grouping *Grouping
	err      error
	implicit
}

func newRangeAggregationExpr(left *LogRange, operation string, gr *Grouping, stringParams *string) SampleExpr {
	var params *float64
	if stringParams != nil {
		if operation != OpRangeTypeQuantile && operation != OpRangeTypeQuantileSketch {
			return &RangeAggregationExpr{err: logqlmodel.NewParseError(fmt.Sprintf("parameter %s not supported for operation %s", *stringParams, operation), 0, 0)}
		}
		var err error
		params = new(float64)
		*params, err = strconv.ParseFloat(*stringParams, 64)
		if err != nil {
			return &RangeAggregationExpr{err: logqlmodel.NewParseError(fmt.Sprintf("invalid parameter for operation %s: %s", operation, err), 0, 0)}
		}

	} else {
		if operation == OpRangeTypeQuantile {
			return &RangeAggregationExpr{err: logqlmodel.NewParseError(fmt.Sprintf("parameter required for operation %s", operation), 0, 0)}
		}
	}
	e := &RangeAggregationExpr{
		Left:      left,
		Operation: operation,
		Grouping:  gr,
		Params:    params,
	}
	if err := e.validate(); err != nil {
		return &RangeAggregationExpr{err: logqlmodel.NewParseError(err.Error(), 0, 0)}
	}
	return e
}
func (e *RangeAggregationExpr) isSampleExpr() {}

func (e *RangeAggregationExpr) Selector() (LogSelectorExpr, error) {
	if e.err != nil {
		return nil, e.err
	}
	return e.Left.Left, nil
}

func (e *RangeAggregationExpr) MatcherGroups() ([]MatcherRange, error) {
	if e.err != nil {
		return nil, e.err
	}
	xs := e.Left.Left.Matchers()
	if len(xs) > 0 {
		return []MatcherRange{
			{
				Matchers: xs,
				Interval: e.Left.Interval,
				Offset:   e.Left.Offset,
			},
		}, nil
	}
	return nil, nil
}

func (e RangeAggregationExpr) validate() error {
	if e.Grouping != nil {
		switch e.Operation {
		case OpRangeTypeAvg, OpRangeTypeStddev, OpRangeTypeStdvar, OpRangeTypeQuantile,
			OpRangeTypeQuantileSketch, OpRangeTypeMax, OpRangeTypeMin, OpRangeTypeFirst,
			OpRangeTypeLast, OpRangeTypeFirstWithTimestamp, OpRangeTypeLastWithTimestamp:
		default:
			return fmt.Errorf("grouping not allowed for %s aggregation", e.Operation)
		}
	}
	if e.Left.Unwrap != nil {
		switch e.Operation {
		case OpRangeTypeAvg, OpRangeTypeSum, OpRangeTypeMax, OpRangeTypeMin, OpRangeTypeStddev,
			OpRangeTypeStdvar, OpRangeTypeQuantile, OpRangeTypeRate, OpRangeTypeRateCounter,
			OpRangeTypeAbsent, OpRangeTypeFirst, OpRangeTypeLast, OpRangeTypeQuantileSketch,
			OpRangeTypeFirstWithTimestamp, OpRangeTypeLastWithTimestamp:
			return nil
		default:
			return fmt.Errorf("invalid aggregation %s with unwrap", e.Operation)
		}
	}
	switch e.Operation {
	case OpRangeTypeBytes, OpRangeTypeBytesRate, OpRangeTypeCount, OpRangeTypeRate, OpRangeTypeAbsent:
		return nil
	default:
		return fmt.Errorf("invalid aggregation %s without unwrap", e.Operation)
	}
}

func (e RangeAggregationExpr) Validate() error {
	return e.validate()
}

// impls Stringer
func (e *RangeAggregationExpr) String() string {
	var sb strings.Builder
	sb.WriteString(e.Operation)
	sb.WriteString("(")
	if e.Params != nil {
		sb.WriteString(strconv.FormatFloat(*e.Params, 'f', -1, 64))
		sb.WriteString(",")
	}
	sb.WriteString(e.Left.String())
	sb.WriteString(")")
	if e.Grouping != nil {
		sb.WriteString(e.Grouping.String())
	}
	return sb.String()
}

// impl SampleExpr
func (e *RangeAggregationExpr) Shardable(topLevel bool) bool {
	// Here we are blocking sharding of quantile operations if they are not
	// the top level aggregation in a query, such as max(quantile_over_time(...)).
	// The sharding here will be blocked even if the feature flag in the shardmapper
	// to enable sharding of quantile queries is enabled.
	if e.Operation == OpRangeTypeQuantile && !topLevel {
		return false
	}
	return shardableOps[e.Operation] && e.Left.Shardable(topLevel)
}

func (e *RangeAggregationExpr) Walk(f WalkFn) {
	f(e)
	if e.Left == nil {
		return
	}
	e.Left.Walk(f)
}

func (e *RangeAggregationExpr) Accept(v RootVisitor) { v.VisitRangeAggregation(e) }

// Grouping struct represents the grouping by/without label(s) for vector aggregators and range vector aggregators.
// The representation is as follows:
//   - No Grouping (labels dismissed): <operation> (<expr>) => Grouping{Without: false, Groups: nil}
//   - Grouping by empty label set: <operation> by () (<expr>) => Grouping{Without: false, Groups: []}
//   - Grouping by label set: <operation> by (<labels...>) (<expr>) => Grouping{Without: false, Groups: [<labels...>]}
//   - Grouping without empty label set: <operation> without () (<expr>) => Grouping{Without: true, Groups: []}
//   - Grouping without label set: <operation> without (<labels...>) (<expr>) => Grouping{Without: true, Groups: [<labels...>]}
type Grouping struct {
	Groups  []string
	Without bool
}

// impls Stringer
func (g Grouping) String() string {
	var sb strings.Builder

	if g.Without {
		sb.WriteString(" without ")
	} else {
		sb.WriteString(" by ")
	}

	sb.WriteString("(")
	sb.WriteString(strings.Join(g.Groups, ","))
	sb.WriteString(")")

	return sb.String()
}

// whether grouping doesn't change the result
func (g Grouping) Noop() bool {
	return len(g.Groups) == 0 && g.Without
}

// whether grouping reduces the result to a single value
// with no labels
func (g Grouping) Singleton() bool {
	return len(g.Groups) == 0 && !g.Without
}

// VectorAggregationExpr all vector aggregation expressions support grouping by/without label(s),
// therefore the Grouping struct can never be nil.
type VectorAggregationExpr struct {
	Left SampleExpr `json:"sample_expr"`

	Grouping  *Grouping `json:"grouping,omitempty"`
	Params    int       `json:"params"`
	Operation string    `json:"operation"`
	err       error
	implicit
}

func mustNewVectorAggregationExpr(left SampleExpr, operation string, gr *Grouping, params *string) SampleExpr {
	var p int
	var err error
	switch operation {
	case OpTypeBottomK, OpTypeTopK:
		if params == nil {
			return &VectorAggregationExpr{err: logqlmodel.NewParseError(fmt.Sprintf("parameter required for operation %s", operation), 0, 0)}
		}
		p, err = strconv.Atoi(*params)
		if err != nil {
			return &VectorAggregationExpr{err: logqlmodel.NewParseError(fmt.Sprintf("invalid parameter %s(%s,", operation, *params), 0, 0)}
		}
		if p <= 0 {
			return &VectorAggregationExpr{err: logqlmodel.NewParseError(fmt.Sprintf("invalid parameter (must be greater than 0) %s(%s", operation, *params), 0, 0)}
		}

	default:
		if params != nil {
			return &VectorAggregationExpr{err: logqlmodel.NewParseError(fmt.Sprintf("unsupported parameter for operation %s(%s,", operation, *params), 0, 0)}
		}
	}
	if gr == nil {
		gr = &Grouping{}
	}
	return &VectorAggregationExpr{
		Left:      left,
		Operation: operation,
		Grouping:  gr,
		Params:    p,
	}
}

func (e *VectorAggregationExpr) isSampleExpr() {}

func (e *VectorAggregationExpr) MatcherGroups() ([]MatcherRange, error) {
	if e.err != nil {
		return nil, e.err
	}
	return e.Left.MatcherGroups()
}

func (e *VectorAggregationExpr) Selector() (LogSelectorExpr, error) {
	if e.err != nil {
		return nil, e.err
	}
	return e.Left.Selector()
}

func (e *VectorAggregationExpr) Extractor() (log.SampleExtractor, error) {
	if e.err != nil {
		return nil, e.err
	}
	// inject in the range vector extractor the outer groups to improve performance.
	// This is only possible if the operation is a sum. Anything else needs all labels.
	if r, ok := e.Left.(*RangeAggregationExpr); ok && canInjectVectorGrouping(e.Operation, r.Operation) {
		// if the range vec operation has no grouping we can push down the vec one.
		if r.Grouping == nil {
			return r.extractor(e.Grouping)
		}
	}
	return e.Left.Extractor()
}

// canInjectVectorGrouping tells if a vector operation can inject grouping into the nested range vector.
func canInjectVectorGrouping(vecOp, rangeOp string) bool {
	if vecOp != OpTypeSum {
		return false
	}
	switch rangeOp {
	case OpRangeTypeBytes, OpRangeTypeBytesRate, OpRangeTypeSum, OpRangeTypeRate, OpRangeTypeCount:
		return true
	default:
		return false
	}
}

func (e *VectorAggregationExpr) String() string {
	var params []string
	switch e.Operation {
	// bottomK and topk can have first parameter as 0
	case OpTypeBottomK, OpTypeTopK:
		params = []string{fmt.Sprintf("%d", e.Params), e.Left.String()}
	default:
		if e.Params != 0 {
			params = []string{fmt.Sprintf("%d", e.Params), e.Left.String()}
		} else {
			params = []string{e.Left.String()}
		}
	}
	return formatVectorOperation(e.Operation, e.Grouping, params...)
}

// impl SampleExpr
func (e *VectorAggregationExpr) Shardable(topLevel bool) bool {
	if !shardableOps[e.Operation] || !e.Left.Shardable(topLevel) {
		return false
	}

	switch e.Operation {

	case OpTypeCount, OpTypeAvg:
		// count is shardable if labels are not mutated
		// otherwise distinct values can be present in multiple shards and
		// counted twice.
		// avg is similar since it's remapped to sum/count.
		// TODO(owen-d): this is hard to figure out; we should refactor to
		// make these relationships clearer, safer, and more extensible.
		shardable := !ReducesLabels(e.Left)

		return shardable

	case OpTypeMax, OpTypeMin:
		// max(<range_aggr>) can be sharded by pushing down the max|min aggregation,
		// but max(<vector_aggr>) cannot. It needs to perform the
		// aggregation on the total result set, and then pick the max|min.
		// For instance, `max(max_over_time)` or `max(rate)` can turn into
		// `max( max(rate(shard1)) ++ max(rate(shard2)) ... etc)`,
		// but you can’t do
		// `max( max(sum(rate(shard1))) ++ max(sum(rate(shard2))) ... etc)`
		// because it’s only taking the maximum from each shard,
		// but we actually need to sum all the shards then put the max on top
		if _, ok := e.Left.(*RangeAggregationExpr); ok && e.Left.Shardable(false) {
			return true
		}
		return false

	case OpTypeSum:
		// sum can shard & merge vector & range aggregations, but only if
		// the resulting computation is commutative and associative.
		// This does not apply to min & max, because while `min(min(min))`
		// satisfies the above, sum( sum(min(shard1) ++ sum(min(shard2)) )
		// does not
		if child, ok := e.Left.(*VectorAggregationExpr); ok {
			switch child.Operation {
			case OpTypeMin, OpTypeMax:
				return false
			}
		}
		return true

	}

	return true
}

func (e *VectorAggregationExpr) Walk(f WalkFn) {
	f(e)
	if e.Left == nil {
		return
	}
	e.Left.Walk(f)
}

func (e *VectorAggregationExpr) Accept(v RootVisitor) { v.VisitVectorAggregation(e) }

// VectorMatchCardinality describes the cardinality relationship
// of two Vectors in a binary operation.
type VectorMatchCardinality int

const (
	CardOneToOne VectorMatchCardinality = iota
	CardManyToOne
	CardOneToMany
)

func (vmc VectorMatchCardinality) String() string {
	switch vmc {
	case CardOneToOne:
		return "one-to-one"
	case CardManyToOne:
		return "many-to-one"
	case CardOneToMany:
		return "one-to-many"
	}
	panic("promql.VectorMatchCardinality.String: unknown match cardinality")
}

// VectorMatching describes how elements from two Vectors in a binary
// operation are supposed to be matched.
type VectorMatching struct {
	// The cardinality of the two Vectors.
	Card VectorMatchCardinality
	// MatchingLabels contains the labels which define equality of a pair of
	// elements from the Vectors.
	MatchingLabels []string
	// On includes the given label names from matching,
	// rather than excluding them.
	On bool
	// Include contains additional labels that should be included in
	// the result from the side with the lower cardinality.
	Include []string
}

type BinOpOptions struct {
	ReturnBool     bool
	VectorMatching *VectorMatching
}

type BinOpExpr struct {
	SampleExpr
	RHS  SampleExpr
	Op   string
	Opts *BinOpOptions
	err  error
}

func (e *BinOpExpr) MatcherGroups() ([]MatcherRange, error) {
	if e.err != nil {
		return nil, e.err
	}
	groups, err := e.SampleExpr.MatcherGroups()
	if err != nil {
		return nil, err
	}
	RHSGroups, err := e.RHS.MatcherGroups()
	if err != nil {
		return nil, err
	}
	return append(groups, RHSGroups...), nil
}

func (e *BinOpExpr) String() string {
	op := e.Op
	if e.Opts != nil {
		if e.Opts.ReturnBool {
			op = fmt.Sprintf("%s bool", op)
		}
		if e.Opts.VectorMatching != nil {
			group := ""
			if e.Opts.VectorMatching.Card == CardManyToOne {
				group = OpGroupLeft
			} else if e.Opts.VectorMatching.Card == CardOneToMany {
				group = OpGroupRight
			}
			if e.Opts.VectorMatching.Include != nil {
				group = fmt.Sprintf("%s (%s)", group, strings.Join(e.Opts.VectorMatching.Include, ","))
			}

			if e.Opts.VectorMatching.On || e.Opts.VectorMatching.MatchingLabels != nil {
				on := OpOn
				if !e.Opts.VectorMatching.On {
					on = OpIgnoring
				}
				op = fmt.Sprintf("%s %s (%s) %s", op, on, strings.Join(e.Opts.VectorMatching.MatchingLabels, ","), group)
			}
		}
	}
	return fmt.Sprintf("(%s %s %s)", e.SampleExpr.String(), op, e.RHS.String())
}

// impl SampleExpr
func (e *BinOpExpr) Shardable(topLevel bool) bool {
	if e.Opts != nil && e.Opts.VectorMatching != nil {
		matching := e.Opts.VectorMatching
		// prohibit sharding when we're changing the label groupings,
		// such as when using `on` grouping or when using
		// `ignoring` with a non-zero set of labels to ignore.
		// `ignoring ()` is effectively the zero value
		// that doesn't mutate labels and is shardable.
		if matching.On || len(matching.MatchingLabels) > 0 {
			return false
		}
	}
	return shardableOps[e.Op] && e.SampleExpr.Shardable(topLevel) && e.RHS.Shardable(topLevel)
}

func (e *BinOpExpr) Walk(f WalkFn) {
	walkAll(f, e.SampleExpr, e.RHS)
}

func (e *BinOpExpr) Accept(v RootVisitor) { v.VisitBinOp(e) }

func mustNewBinOpExpr(op string, opts *BinOpOptions, lhs, rhs Expr) SampleExpr {
	left, ok := lhs.(SampleExpr)
	if !ok {
		return &BinOpExpr{err: logqlmodel.NewParseError(fmt.Sprintf(
			"unexpected type for left leg of binary operation (%s): %T",
			op,
			lhs,
		), 0, 0)}
	}

	right, ok := rhs.(SampleExpr)
	if !ok {
		return &BinOpExpr{err: logqlmodel.NewParseError(fmt.Sprintf(
			"unexpected type for right leg of binary operation (%s): %T",
			op,
			rhs,
		), 0, 0)}
	}

	leftLit, lOk := left.(*LiteralExpr)
	rightLit, rOk := right.(*LiteralExpr)
	var leftVal float64
	var rightVal float64
	if lOk {
		leftV, err := leftLit.Value()
		if err != nil {
			return &BinOpExpr{err: err}
		}
		leftVal = leftV
	}
	if rOk {
		rightV, err := rightLit.Value()
		if err != nil {
			return &BinOpExpr{err: err}
		}
		rightVal = rightV
	}
	if IsLogicalBinOp(op) {

		if lOk {
			return &BinOpExpr{err: logqlmodel.NewParseError(fmt.Sprintf(
				"unexpected literal for left leg of logical/set binary operation (%s): %f",
				op,
				leftVal,
			), 0, 0)}
		}

		if rOk {
			return &BinOpExpr{err: logqlmodel.NewParseError(fmt.Sprintf(
				"unexpected literal for right leg of logical/set binary operation (%s): %f",
				op,
				rightVal,
			), 0, 0)}
		}
	}

	// map expr like (1+1) -> 2
	if lOk && rOk {
		return reduceBinOp(op, leftVal, rightVal)
	}

	return &BinOpExpr{
		SampleExpr: left,
		RHS:        right,
		Op:         op,
		Opts:       opts,
		err:        nil,
	}
}

// Reduces a binary operation expression. A binop is reducible if both of its legs are literal expressions.
// This is because literals need match all labels, which is currently difficult to encode into StepEvaluators.
// Therefore, we ensure a binop can be reduced/simplified, maintaining the invariant that it does not have two literal legs.
func reduceBinOp(op string, left, right float64) *LiteralExpr {
	merged, err := MergeBinOp(
		op,
		&promql.Sample{F: left},
		&promql.Sample{F: right},
		false,
		false,
		false,
	)
	if err != nil {
		return &LiteralExpr{err: err}
	}
	return &LiteralExpr{Val: merged.F}
}

// MergeBinOp performs `op` on `left` and `right` arguments and return the `promql.Sample` value.
// In case of vector and scalar arguments, MergeBinOp assumes `left` is always vector.
// pass `swap=true` otherwise.
// This matters because, either it's (vector op scalar) or (scalar op vector), the return sample value should
// always be sample value of vector argument.
// https://github.com/grafana/loki/issues/10741
func MergeBinOp(op string, left, right *promql.Sample, swap, filter, isVectorComparison bool) (*promql.Sample, error) {
	var merger func(left, right *promql.Sample) *promql.Sample

	switch op {
	case OpTypeAdd:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}
			res := *left
			res.F += right.F
			return &res
		}

	case OpTypeSub:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}
			res := *left
			res.F -= right.F
			return &res
		}

	case OpTypeMul:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}
			res := *left
			res.F *= right.F
			return &res
		}

	case OpTypeDiv:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}
			res := *left
			// guard against divide by zero
			if right.F == 0 {
				res.F = math.NaN()
			} else {
				res.F /= right.F
			}
			return &res
		}

	case OpTypeMod:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}
			res := *left
			// guard against divide by zero
			if right.F == 0 {
				res.F = math.NaN()
			} else {
				res.F = math.Mod(res.F, right.F)
			}
			return &res
		}

	case OpTypePow:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}

			res := *left
			res.F = math.Pow(left.F, right.F)
			return &res
		}

	case OpTypeCmpEQ:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}

			res := *left

			val := 0.
			if left.F == right.F {
				val = 1.
			} else if filter {
				return nil
			}
			res.F = val
			return &res
		}

	case OpTypeNEQ:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}

			res := *left
			val := 0.
			if left.F != right.F {
				val = 1.
			} else if filter {
				return nil
			}
			res.F = val
			return &res
		}

	case OpTypeGT:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}

			res := *left
			val := 0.
			if left.F > right.F {
				val = 1.
			} else if filter {
				return nil
			}
			res.F = val
			return &res
		}

	case OpTypeGTE:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}

			res := *left
			val := 0.
			if left.F >= right.F {
				val = 1.
			} else if filter {
				return nil
			}
			res.F = val
			return &res
		}

	case OpTypeLT:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}

			res := *left
			val := 0.
			if left.F < right.F {
				val = 1.
			} else if filter {
				return nil
			}
			res.F = val
			return &res
		}

	case OpTypeLTE:
		merger = func(left, right *promql.Sample) *promql.Sample {
			if left == nil || right == nil {
				return nil
			}

			res := *left
			val := 0.
			if left.F <= right.F {
				val = 1.
			} else if filter {
				return nil
			}
			res.F = val
			return &res
		}

	default:
		return nil, errors.Errorf("should never happen: unexpected operation: (%s)", op)
	}

	res := merger(left, right)
	if !isVectorComparison {
		return res, nil
	}

	if filter {
		// if a filter is enabled vector-wise comparison has returned non-nil,
		// ensure we return the vector hand side's sample value, instead of the
		// comparison operator's result (1: the truthy answer. a.k.a bool)

		retSample := left
		if swap {
			retSample = right
		}

		if res != nil {
			return retSample, nil
		}
	}
	return res, nil
}

type LiteralExpr struct {
	Val float64 `json:"val"`
	err error
	implicit
}

func mustNewLiteralExpr(s string, invert bool) *LiteralExpr {
	n, err := strconv.ParseFloat(s, 64)
	if err != nil {
		err = logqlmodel.NewParseError(fmt.Sprintf("unable to parse literal as a float: %s", err.Error()), 0, 0)
	}

	if invert {
		n = -n
	}

	return &LiteralExpr{
		Val: n,
		err: err,
	}
}

func (e *LiteralExpr) String() string {
	return fmt.Sprint(e.Val)
}

// literlExpr impls SampleExpr & LogSelectorExpr mainly to reduce the need for more complicated typings
// to facilitate sum types. We'll be type switching when evaluating them anyways
// and they will only be present in binary operation legs.
func (e *LiteralExpr) isSampleExpr()                           {}
func (e *LiteralExpr) isLogSelectorExpr()                      {}
func (e *LiteralExpr) Selector() (LogSelectorExpr, error)      { return e, e.err }
func (e *LiteralExpr) HasFilter() bool                         { return false }
func (e *LiteralExpr) Shardable(_ bool) bool                   { return true }
func (e *LiteralExpr) Walk(f WalkFn)                           { f(e) }
func (e *LiteralExpr) Accept(v RootVisitor)                    { v.VisitLiteral(e) }
func (e *LiteralExpr) Pipeline() (log.Pipeline, error)         { return log.NewNoopPipeline(), nil }
func (e *LiteralExpr) Matchers() []*labels.Matcher             { return nil }
func (e *LiteralExpr) MatcherGroups() ([]MatcherRange, error)  { return nil, e.err }
func (e *LiteralExpr) Extractor() (log.SampleExtractor, error) { return nil, e.err }
func (e *LiteralExpr) Value() (float64, error) {
	if e.err != nil {
		return 0, e.err
	}
	return e.Val, nil
}

// helper used to impl Stringer for vector and range aggregations
// nolint:interfacer
func formatVectorOperation(op string, grouping *Grouping, params ...string) string {
	nonEmptyParams := make([]string, 0, len(params))
	for _, p := range params {
		if p != "" {
			nonEmptyParams = append(nonEmptyParams, p)
		}
	}

	var sb strings.Builder
	sb.WriteString(op)
	if grouping != nil && !grouping.Singleton() {
		sb.WriteString(grouping.String())
	}
	sb.WriteString("(")
	sb.WriteString(strings.Join(nonEmptyParams, ","))
	sb.WriteString(")")
	return sb.String()
}

type LabelReplaceExpr struct {
	Left        SampleExpr
	Dst         string
	Replacement string
	Src         string
	Regex       string
	Re          *regexp.Regexp
	err         error

	implicit
}

func mustNewLabelReplaceExpr(left SampleExpr, dst, replacement, src, regex string) *LabelReplaceExpr {
	re, err := regexp.Compile("^(?:" + regex + ")$")
	if err != nil {
		return &LabelReplaceExpr{
			err: logqlmodel.NewParseError(fmt.Sprintf("invalid regex in label_replace: %s", err.Error()), 0, 0),
		}
	}
	return &LabelReplaceExpr{
		Left:        left,
		Dst:         dst,
		Replacement: replacement,
		Src:         src,
		Re:          re,
		Regex:       regex,
	}
}

func (e *LabelReplaceExpr) isSampleExpr() {}

func (e *LabelReplaceExpr) Selector() (LogSelectorExpr, error) {
	if e.err != nil {
		return nil, e.err
	}
	return e.Left.Selector()
}

func (e *LabelReplaceExpr) MatcherGroups() ([]MatcherRange, error) {
	if e.err != nil {
		return nil, e.err
	}
	return e.Left.MatcherGroups()
}

func (e *LabelReplaceExpr) Extractor() (SampleExtractor, error) {
	if e.err != nil {
		return nil, e.err
	}
	return e.Left.Extractor()
}

func (e *LabelReplaceExpr) Shardable(_ bool) bool {
	return false
}

func (e *LabelReplaceExpr) Walk(f WalkFn) {
	f(e)
	if e.Left == nil {
		return
	}
	e.Left.Walk(f)
}

func (e *LabelReplaceExpr) Accept(v RootVisitor) { v.VisitLabelReplace(e) }

func (e *LabelReplaceExpr) String() string {
	var sb strings.Builder
	sb.WriteString(OpLabelReplace)
	sb.WriteString("(")
	sb.WriteString(e.Left.String())
	sb.WriteString(",")
	sb.WriteString(strconv.Quote(e.Dst))
	sb.WriteString(",")
	sb.WriteString(strconv.Quote(e.Replacement))
	sb.WriteString(",")
	sb.WriteString(strconv.Quote(e.Src))
	sb.WriteString(",")
	sb.WriteString(strconv.Quote(e.Regex))
	sb.WriteString(")")
	return sb.String()
}

// shardableOps lists the operations which may be sharded, but are not
// guaranteed to be. See the `Shardable()` implementations
// on the respective expr types for more details.
// topk, botk, max, & min all must be concatenated and then evaluated in order to avoid
// potential data loss due to series distribution across shards.
// For example, grouping by `cluster` for a `max` operation may yield
// 2 results on the first shard and 10 results on the second. If we prematurely
// calculated `max`s on each shard, the shard/label combination with `2` may be
// discarded and some other combination with `11` may be reported falsely as the max.
//
// Explanation: this is my (owen-d) best understanding.
//
// For an operation to be shardable, first the sample-operation itself must be associative like (+, *) but not (%, /, ^).
// Secondly, if the operation is part of a vector aggregation expression or utilizes logical/set binary ops,
// the vector operation must be distributive over the sample-operation.
// This ensures that the vector merging operation can be applied repeatedly to data in different shards.
// references:
// https://en.wikipedia.org/wiki/Associative_property
// https://en.wikipedia.org/wiki/Distributive_property
var shardableOps = map[string]bool{
	// vector ops
	OpTypeSum: true,
	// avg is only marked as shardable because we remap it into sum/count.
	OpTypeAvg:   true,
	OpTypeCount: true,
	OpTypeMax:   true,
	OpTypeMin:   true,

	// range vector ops
	OpRangeTypeAvg:       true,
	OpRangeTypeCount:     true,
	OpRangeTypeFirst:     true,
	OpRangeTypeLast:      true,
	OpRangeTypeRate:      true,
	OpRangeTypeBytes:     true,
	OpRangeTypeBytesRate: true,
	OpRangeTypeSum:       true,
	OpRangeTypeMax:       true,
	OpRangeTypeMin:       true,
	OpRangeTypeQuantile:  true,

	// binops - arith
	OpTypeAdd: true,
	OpTypeMul: true,
}

type MatcherRange struct {
	Matchers         []*labels.Matcher
	Interval, Offset time.Duration
}

func MatcherGroups(expr Expr) ([]MatcherRange, error) {
	switch e := expr.(type) {
	case SampleExpr:
		return e.MatcherGroups()
	case LogSelectorExpr:
		if xs := e.Matchers(); len(xs) > 0 {
			return []MatcherRange{
				{
					Matchers: xs,
				},
			}, nil
		}
		return nil, nil
	default:
		return nil, nil
	}
}

type VectorExpr struct {
	Val float64
	err error
	implicit
}

func NewVectorExpr(scalar string) *VectorExpr {
	n, err := strconv.ParseFloat(scalar, 64)
	if err != nil {
		err = logqlmodel.NewParseError(fmt.Sprintf("unable to parse vectorExpr as a float: %s", err.Error()), 0, 0)
	}
	return &VectorExpr{
		Val: n,
		err: err,
	}
}

func (e *VectorExpr) isSampleExpr()      {}
func (e *VectorExpr) isLogSelectorExpr() {}

func (e *VectorExpr) Err() error {
	return e.err
}

func (e *VectorExpr) String() string {
	var sb strings.Builder
	sb.WriteString(OpTypeVector)
	sb.WriteString("(")
	sb.WriteString(fmt.Sprintf("%f", e.Val))
	sb.WriteString(")")
	return sb.String()
}

func (e *VectorExpr) Value() (float64, error) {
	if e.err != nil {
		return 0, e.err
	}
	return e.Val, nil
}

func (e *VectorExpr) Selector() (LogSelectorExpr, error)      { return e, e.err }
func (e *VectorExpr) HasFilter() bool                         { return false }
func (e *VectorExpr) Shardable(_ bool) bool                   { return false }
func (e *VectorExpr) Walk(f WalkFn)                           { f(e) }
func (e *VectorExpr) Accept(v RootVisitor)                    { v.VisitVector(e) }
func (e *VectorExpr) Pipeline() (log.Pipeline, error)         { return log.NewNoopPipeline(), nil }
func (e *VectorExpr) Matchers() []*labels.Matcher             { return nil }
func (e *VectorExpr) MatcherGroups() ([]MatcherRange, error)  { return nil, e.err }
func (e *VectorExpr) Extractor() (log.SampleExtractor, error) { return nil, nil }

func ReducesLabels(e Expr) (conflict bool) {
	e.Walk(func(e Expr) {
		switch expr := e.(type) {
		case *RangeAggregationExpr:
			if groupingReducesLabels(expr.Grouping) {
				conflict = true
			}
		case *VectorAggregationExpr:
			if groupingReducesLabels(expr.Grouping) {
				conflict = true
			}
		// Technically, any parser that mutates labels could cause the query
		// to be non-shardable _if_ the total (inherent+extracted) labels
		// exist on two different shards, but this is incredibly unlikely
		// for parsers which add new labels so I (owen-d) am preferring
		// to continue sharding in those cases and only prevent sharding
		// when using `drop` or `keep` which reduce labels to a smaller subset
		// more likely to collide across shards.
		case *KeepLabelsExpr, *DropLabelsExpr:
			conflict = true
		case *LabelFmtExpr:
			// TODO(owen-d): renaming is shardable in many cases, but will
			// likely require a `sum without ()` wrapper to combine the
			// same extracted labelsets executed on different shards
			for _, f := range expr.Formats {
				if f.Rename {
					conflict = true
					break
				}
			}
		default:
			return
		}
	})
	return
}

func groupingReducesLabels(grp *Grouping) bool {
	if grp == nil {
		return false
	}

	// both without(foo) and by (bar) have the potential
	// to reduce labels
	if len(grp.Groups) > 0 {
		return true
	}

	return false
}
