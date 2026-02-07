package syntax

type AcceptVisitor interface {
	Accept(RootVisitor)
}

type RootVisitor interface {
	SampleExprVisitor
	LogSelectorExprVisitor
	StageExprVisitor

	VisitLogRange(*LogRange)
}

type SampleExprVisitor interface {
	VisitBinOp(*BinOpExpr)
	VisitVectorAggregation(*VectorAggregationExpr)
	VisitRangeAggregation(*RangeAggregationExpr)
	VisitLabelReplace(*LabelReplaceExpr)
	VisitLiteral(*LiteralExpr)
	VisitVector(*VectorExpr)
}

type LogSelectorExprVisitor interface {
	VisitMatchers(*MatchersExpr)
	VisitPipeline(*PipelineExpr)
	VisitLiteral(*LiteralExpr)
	VisitVector(*VectorExpr)
}

type StageExprVisitor interface {
	VisitDecolorize(*DecolorizeExpr)
	VisitDropLabels(*DropLabelsExpr)
	VisitJSONExpressionParser(*JSONExpressionParser)
	VisitKeepLabel(*KeepLabelsExpr)
	VisitLabelFilter(*LabelFilterExpr)
	VisitLabelFmt(*LabelFmtExpr)
	VisitLabelParser(*LabelParserExpr)
	VisitLineFilter(*LineFilterExpr)
	VisitLineFmt(*LineFmtExpr)
	VisitLogfmtExpressionParser(*LogfmtExpressionParser)
	VisitLogfmtParser(*LogfmtParserExpr)
}

var _ RootVisitor = &DepthFirstTraversal{}

type DepthFirstTraversal struct {
	VisitBinOpFn                  func(v RootVisitor, e *BinOpExpr)
	VisitDecolorizeFn             func(v RootVisitor, e *DecolorizeExpr)
	VisitDropLabelsFn             func(v RootVisitor, e *DropLabelsExpr)
	VisitJSONExpressionParserFn   func(v RootVisitor, e *JSONExpressionParser)
	VisitKeepLabelFn              func(v RootVisitor, e *KeepLabelsExpr)
	VisitLabelFilterFn            func(v RootVisitor, e *LabelFilterExpr)
	VisitLabelFmtFn               func(v RootVisitor, e *LabelFmtExpr)
	VisitLabelParserFn            func(v RootVisitor, e *LabelParserExpr)
	VisitLabelReplaceFn           func(v RootVisitor, e *LabelReplaceExpr)
	VisitLineFilterFn             func(v RootVisitor, e *LineFilterExpr)
	VisitLineFmtFn                func(v RootVisitor, e *LineFmtExpr)
	VisitLiteralFn                func(v RootVisitor, e *LiteralExpr)
	VisitLogRangeFn               func(v RootVisitor, e *LogRange)
	VisitLogfmtExpressionParserFn func(v RootVisitor, e *LogfmtExpressionParser)
	VisitLogfmtParserFn           func(v RootVisitor, e *LogfmtParserExpr)
	VisitMatchersFn               func(v RootVisitor, e *MatchersExpr)
	VisitPipelineFn               func(v RootVisitor, e *PipelineExpr)
	VisitRangeAggregationFn       func(v RootVisitor, e *RangeAggregationExpr)
	VisitVectorFn                 func(v RootVisitor, e *VectorExpr)
	VisitVectorAggregationFn      func(v RootVisitor, e *VectorAggregationExpr)
}

// VisitBinOp implements RootVisitor.
func (v *DepthFirstTraversal) VisitBinOp(e *BinOpExpr) {
	if e == nil {
		return
	}
	if v.VisitBinOpFn != nil {
		v.VisitBinOpFn(v, e)
	} else {
		e.SampleExpr.Accept(v)
		e.RHS.Accept(v)
	}
}

// VisitDecolorize implements RootVisitor.
func (v *DepthFirstTraversal) VisitDecolorize(e *DecolorizeExpr) {
	if e == nil {
		return
	}
	if v.VisitDecolorizeFn != nil {
		v.VisitDecolorizeFn(v, e)
	}
}

// VisitDropLabels implements RootVisitor.
func (v *DepthFirstTraversal) VisitDropLabels(e *DropLabelsExpr) {
	if e == nil {
		return
	}
	if v.VisitDecolorizeFn != nil {
		v.VisitDropLabelsFn(v, e)
	}
}

// VisitJSONExpressionParser implements RootVisitor.
func (v *DepthFirstTraversal) VisitJSONExpressionParser(e *JSONExpressionParser) {
	if e == nil {
		return
	}
	if v.VisitJSONExpressionParserFn != nil {
		v.VisitJSONExpressionParserFn(v, e)
	}
}

// VisitKeepLabel implements RootVisitor.
func (v *DepthFirstTraversal) VisitKeepLabel(e *KeepLabelsExpr) {
	if e == nil {
		return
	}
	if v.VisitKeepLabelFn != nil {
		v.VisitKeepLabelFn(v, e)
	}
}

// VisitLabelFilter implements RootVisitor.
func (v *DepthFirstTraversal) VisitLabelFilter(e *LabelFilterExpr) {
	if e == nil {
		return
	}
	if v.VisitLabelFilterFn != nil {
		v.VisitLabelFilterFn(v, e)
	}
}

// VisitLabelFmt implements RootVisitor.
func (v *DepthFirstTraversal) VisitLabelFmt(e *LabelFmtExpr) {
	if e == nil {
		return
	}
	if v.VisitLabelFmtFn != nil {
		v.VisitLabelFmtFn(v, e)
	}
}

// VisitLabelParser implements RootVisitor.
func (v *DepthFirstTraversal) VisitLabelParser(e *LabelParserExpr) {
	if e == nil {
		return
	}
	if v.VisitLabelParserFn != nil {
		v.VisitLabelParserFn(v, e)
	}
}

// VisitLabelReplace implements RootVisitor.
func (v *DepthFirstTraversal) VisitLabelReplace(e *LabelReplaceExpr) {
	if e == nil {
		return
	}
	if v.VisitLabelReplaceFn != nil {
		v.VisitLabelReplaceFn(v, e)
	}
}

// VisitLineFilter implements RootVisitor.
func (v *DepthFirstTraversal) VisitLineFilter(e *LineFilterExpr) {
	if e == nil {
		return
	}
	if v.VisitLineFilterFn != nil {
		v.VisitLineFilterFn(v, e)
	} else {
		if e.Left != nil {
			e.Left.Accept(v)
		}
		if e.Or != nil {
			e.Or.Accept(v)
		}
	}
}

// VisitLineFmt implements RootVisitor.
func (v *DepthFirstTraversal) VisitLineFmt(e *LineFmtExpr) {
	if e == nil {
		return
	}
	if v.VisitLineFmtFn != nil {
		v.VisitLineFmtFn(v, e)
	}
}

// VisitLiteral implements RootVisitor.
func (v *DepthFirstTraversal) VisitLiteral(e *LiteralExpr) {
	if e == nil {
		return
	}
	if v.VisitLiteralFn != nil {
		v.VisitLiteralFn(v, e)
	}
}

// VisitLogRange implements RootVisitor.
func (v *DepthFirstTraversal) VisitLogRange(e *LogRange) {
	if e == nil {
		return
	}
	if v.VisitLogRangeFn != nil {
		v.VisitLogRangeFn(v, e)
	} else {
		e.Left.Accept(v)
	}
}

// VisitLogfmtExpressionParser implements RootVisitor.
func (v *DepthFirstTraversal) VisitLogfmtExpressionParser(e *LogfmtExpressionParser) {
	if e == nil {
		return
	}
	if v.VisitLogfmtExpressionParserFn != nil {
		v.VisitLogfmtExpressionParserFn(v, e)
	}
}

// VisitLogfmtParser implements RootVisitor.
func (v *DepthFirstTraversal) VisitLogfmtParser(e *LogfmtParserExpr) {
	if e == nil {
		return
	}
	if v.VisitLogfmtParserFn != nil {
		v.VisitLogfmtParserFn(v, e)
	}
}

// VisitMatchers implements RootVisitor.
func (v *DepthFirstTraversal) VisitMatchers(e *MatchersExpr) {
	if e == nil {
		return
	}
	if v.VisitMatchersFn != nil {
		v.VisitMatchersFn(v, e)
	}
}

// VisitPipeline implements RootVisitor.
func (v *DepthFirstTraversal) VisitPipeline(e *PipelineExpr) {
	if e == nil {
		return
	}
	if v.VisitPipelineFn != nil {
		v.VisitPipelineFn(v, e)
	} else {
		e.Left.Accept(v)
		for i := range e.MultiStages {
			e.MultiStages[i].Accept(v)
		}
	}
}

// VisitRangeAggregation implements RootVisitor.
func (v *DepthFirstTraversal) VisitRangeAggregation(e *RangeAggregationExpr) {
	if e == nil {
		return
	}
	if v.VisitRangeAggregationFn != nil {
		v.VisitRangeAggregationFn(v, e)
	} else {
		e.Left.Accept(v)
	}
}

// VisitVector implements RootVisitor.
func (v *DepthFirstTraversal) VisitVector(e *VectorExpr) {
	if e == nil {
		return
	}
	if v.VisitVectorFn != nil {
		v.VisitVectorFn(v, e)
	}
}

// VisitVectorAggregation implements RootVisitor.
func (v *DepthFirstTraversal) VisitVectorAggregation(e *VectorAggregationExpr) {
	if e == nil {
		return
	}
	if v.VisitVectorAggregationFn != nil {
		v.VisitVectorAggregationFn(v, e)
	} else {
		e.Left.Accept(v)
	}
}
