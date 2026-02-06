package syntax

import (
	"github.com/prometheus/prometheus/model/labels"

	"github.com/grafana/loki/v3/pkg/logql/log"
)

type cloneVisitor struct {
	cloned Expr
}

var _ RootVisitor = &cloneVisitor{}

func cloneGrouping(g *Grouping) *Grouping {
	copied := &Grouping{
		Without: g.Without,
	}
	if g.Groups != nil {
		copied.Groups = make([]string, len(g.Groups))
		copy(copied.Groups, g.Groups)
	}
	return copied
}

func cloneVectorMatching(v *VectorMatching) *VectorMatching {
	copied := *v
	copy(copied.Include, v.Include)
	copy(copied.MatchingLabels, v.MatchingLabels)

	return &copied
}

func (v *cloneVisitor) VisitBinOp(e *BinOpExpr) {
	lhs := MustClone[SampleExpr](e.SampleExpr)
	rhs := MustClone[SampleExpr](e.RHS)
	copied := &BinOpExpr{
		SampleExpr: lhs,
		RHS:        rhs,
		Op:         e.Op,
	}

	if e.Opts != nil {
		copied.Opts = &BinOpOptions{
			ReturnBool:     e.Opts.ReturnBool,
			VectorMatching: cloneVectorMatching(e.Opts.VectorMatching),
		}
	}

	v.cloned = copied
}

func (v *cloneVisitor) VisitVectorAggregation(e *VectorAggregationExpr) {
	copied := &VectorAggregationExpr{
		Left:      MustClone[SampleExpr](e.Left),
		Params:    e.Params,
		Operation: e.Operation,
	}

	if e.Grouping != nil {
		copied.Grouping = cloneGrouping(e.Grouping)
	}

	v.cloned = copied
}

func (v *cloneVisitor) VisitRangeAggregation(e *RangeAggregationExpr) {
	copied := &RangeAggregationExpr{
		Left:      MustClone[*LogRange](e.Left),
		Operation: e.Operation,
	}

	if e.Grouping != nil {
		copied.Grouping = cloneGrouping(e.Grouping)
	}

	if e.Params != nil {
		tmp := *e.Params
		copied.Params = &tmp
	}

	v.cloned = copied
}

func (v *cloneVisitor) VisitLabelReplace(e *LabelReplaceExpr) {
	left := MustClone[SampleExpr](e.Left)
	v.cloned = mustNewLabelReplaceExpr(left, e.Dst, e.Replacement, e.Src, e.Regex)
}

func (v *cloneVisitor) VisitLiteral(e *LiteralExpr) {
	v.cloned = &LiteralExpr{Val: e.Val}
}

func (v *cloneVisitor) VisitVector(e *VectorExpr) {
	v.cloned = &VectorExpr{Val: e.Val}
}

func (v *cloneVisitor) VisitLogRange(e *LogRange) {
	copied := &LogRange{
		Left:     MustClone[LogSelectorExpr](e.Left),
		Interval: e.Interval,
		Offset:   e.Offset,
	}
	if e.Unwrap != nil {
		copied.Unwrap = &UnwrapExpr{
			Identifier: e.Unwrap.Identifier,
			Operation:  e.Unwrap.Operation,
		}
		if e.Unwrap.PostFilters != nil {
			copied.Unwrap.PostFilters = make([]log.LabelFilterer, len(e.Unwrap.PostFilters))
			for i, f := range e.Unwrap.PostFilters {
				copied.Unwrap.PostFilters[i] = cloneLabelFilterer(f)
			}
		}
	}

	v.cloned = copied
}

func (v *cloneVisitor) VisitMatchers(e *MatchersExpr) {
	copied := &MatchersExpr{
		Mts: make([]*labels.Matcher, len(e.Mts)),
	}
	for i, m := range e.Mts {
		copied.Mts[i] = labels.MustNewMatcher(m.Type, m.Name, m.Value)
	}

	v.cloned = copied
}

func (v *cloneVisitor) VisitPipeline(e *PipelineExpr) {
	copied := &PipelineExpr{
		Left:        MustClone[*MatchersExpr](e.Left),
		MultiStages: make(MultiStageExpr, len(e.MultiStages)),
	}
	for i, s := range e.MultiStages {
		copied.MultiStages[i] = MustClone[StageExpr](s)
	}

	v.cloned = copied
}

func (v *cloneVisitor) VisitDecolorize(*DecolorizeExpr) {
	v.cloned = &DecolorizeExpr{}
}

func (v *cloneVisitor) VisitDropLabels(e *DropLabelsExpr) {
	copied := &DropLabelsExpr{
		dropLabels: make([]log.DropLabel, len(e.dropLabels)),
	}
	for i, l := range e.dropLabels {
		var matcher *labels.Matcher
		if l.Matcher != nil {
			matcher = labels.MustNewMatcher(l.Matcher.Type, l.Matcher.Name, l.Matcher.Value)
		}
		copied.dropLabels[i] = log.NewDropLabel(matcher, l.Name)
	}

	v.cloned = copied
}

func (v *cloneVisitor) VisitJSONExpressionParser(e *JSONExpressionParser) {
	copied := &JSONExpressionParser{
		Expressions: make([]log.LabelExtractionExpr, len(e.Expressions)),
	}
	copy(copied.Expressions, e.Expressions)

	v.cloned = copied
}

func (v *cloneVisitor) VisitKeepLabel(e *KeepLabelsExpr) {
	copied := &KeepLabelsExpr{
		keepLabels: make([]log.KeepLabel, len(e.keepLabels)),
	}
	for i, k := range e.keepLabels {
		copied.keepLabels[i] = log.KeepLabel{
			Name: k.Name,
		}
		if k.Matcher != nil {
			copied.keepLabels[i].Matcher = labels.MustNewMatcher(k.Matcher.Type, k.Matcher.Name, k.Matcher.Value)
		}
	}

	v.cloned = copied
}

func (v *cloneVisitor) VisitLabelFilter(e *LabelFilterExpr) {
	v.cloned = &LabelFilterExpr{
		LabelFilterer: cloneLabelFilterer(e.LabelFilterer),
	}
}

func cloneLabelFilterer(filter log.LabelFilterer) log.LabelFilterer {
	switch concrete := filter.(type) {
	case *log.BinaryLabelFilter:
		return &log.BinaryLabelFilter{
			Left:  cloneLabelFilterer(concrete.Left),
			Right: cloneLabelFilterer(concrete.Right),
			And:   concrete.And,
		}
	case *log.NoopLabelFilter:
		copied := &log.NoopLabelFilter{}
		if concrete.Matcher != nil {
			copied.Matcher = mustNewMatcher(concrete.Type, concrete.Name, concrete.Value)
		}

		return copied
	case *log.BytesLabelFilter:
		return &log.BytesLabelFilter{
			Name:  concrete.Name,
			Value: concrete.Value,
			Type:  concrete.Type,
		}
	case *log.DurationLabelFilter:
		return &log.DurationLabelFilter{
			Name:  concrete.Name,
			Value: concrete.Value,
			Type:  concrete.Type,
		}
	case *log.NumericLabelFilter:
		return &log.NumericLabelFilter{
			Name:  concrete.Name,
			Value: concrete.Value,
			Type:  concrete.Type,
		}
	case *log.StringLabelFilter:
		copied := &log.StringLabelFilter{}
		if concrete.Matcher != nil {
			copied.Matcher = mustNewMatcher(concrete.Type, concrete.Name, concrete.Value)
		}
		return copied
	case *log.LineFilterLabelFilter:
		copied := &log.LineFilterLabelFilter{
			Filter: concrete.Filter,
		}
		if concrete.Matcher != nil {
			copied.Matcher = mustNewMatcher(concrete.Type, concrete.Name, concrete.Value)
		}
		return copied
	case *log.IPLabelFilter:
		return log.NewIPLabelFilter(concrete.Pattern, concrete.Label, concrete.Ty)
	}
	return nil
}

func (v *cloneVisitor) VisitLabelFmt(e *LabelFmtExpr) {
	copied := &LabelFmtExpr{
		Formats: make([]log.LabelFmt, len(e.Formats)),
	}
	copy(copied.Formats, e.Formats)
	v.cloned = copied
}

func (v *cloneVisitor) VisitLabelParser(e *LabelParserExpr) {
	v.cloned = &LabelParserExpr{
		Op:    e.Op,
		Param: e.Param,
	}
}

func (v *cloneVisitor) VisitLineFilter(e *LineFilterExpr) {
	copied := &LineFilterExpr{
		LineFilter: LineFilter{
			Ty:    e.Ty,
			Match: e.Match,
			Op:    e.Op,
		},
		IsOrChild: e.IsOrChild,
	}

	if e.Left != nil {
		copied.Left = MustClone[*LineFilterExpr](e.Left)
	}

	if e.Or != nil {
		copied.Or = MustClone[*LineFilterExpr](e.Or)
	}

	v.cloned = copied
}

func (v *cloneVisitor) VisitLineFmt(e *LineFmtExpr) {
	v.cloned = &LineFmtExpr{Value: e.Value}
}

func (v *cloneVisitor) VisitLogfmtExpressionParser(e *LogfmtExpressionParser) {
	copied := &LogfmtExpressionParser{
		Expressions: make([]log.LabelExtractionExpr, len(e.Expressions)),
		Strict:      e.Strict,
		KeepEmpty:   e.KeepEmpty,
	}
	copy(copied.Expressions, e.Expressions)

	v.cloned = copied
}

func (v *cloneVisitor) VisitLogfmtParser(e *LogfmtParserExpr) {
	v.cloned = &LogfmtParserExpr{
		Strict:    e.Strict,
		KeepEmpty: e.KeepEmpty,
	}
}
