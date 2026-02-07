package traceql

import (
	"fmt"
	"regexp"
)

// unsupportedError is returned for traceql features that are not yet supported.
type unsupportedError struct {
	feature string
}

func newUnsupportedError(feature string) *unsupportedError {
	return &unsupportedError{feature: feature}
}

func (e *unsupportedError) Error() string {
	return e.feature + " not yet supported"
}

func (r RootExpr) validate() error {
	err := r.Pipeline.validate()
	if err != nil {
		return err
	}

	if r.MetricsPipeline != nil {
		err := r.MetricsPipeline.validate()
		if err != nil {
			return err
		}
	}

	if r.MetricsSecondStage != nil {
		err := r.MetricsSecondStage.validate()
		if err != nil {
			return err
		}
	}

	// extra validation to disallow compare() with second stage functions
	// for example: `{} | compare({status=error}) | topk(10)` doesn't make sense
	if r.MetricsPipeline != nil && r.MetricsSecondStage != nil {
		// cast and check if the first stage is a compare operation
		if _, ok := r.MetricsPipeline.(*MetricsCompare); ok {
			return fmt.Errorf("`compare()` cannot be used with second stage functions")
		}
	}

	return nil
}

func (p Pipeline) validate() error {
	for _, p := range p.Elements {
		err := p.validate()
		if err != nil {
			return err
		}
	}
	return nil
}

func (o GroupOperation) validate() error {
	// todo: once grouping is supported the below validation will apply
	if !o.Expression.referencesSpan() {
		return fmt.Errorf("grouping field expressions must reference the span: %s", o.String())
	}

	return o.Expression.validate()
}

func (o CoalesceOperation) validate() error {
	return nil
}

func (o SelectOperation) validate() error {
	for _, e := range o.attrs {
		if err := e.validate(); err != nil {
			return err
		}
	}

	return nil
}

func (o ScalarOperation) validate() error {
	if err := o.LHS.validate(); err != nil {
		return err
	}
	if err := o.RHS.validate(); err != nil {
		return err
	}

	lhsT := o.LHS.impliedType()
	rhsT := o.RHS.impliedType()
	if !lhsT.isMatchingOperand(rhsT) {
		return fmt.Errorf("binary operations must operate on the same type: %s", o.String())
	}

	if !o.Op.binaryTypesValid(lhsT, rhsT) {
		return fmt.Errorf("illegal operation for the given types: %s", o.String())
	}

	return nil
}

func (a Aggregate) validate() error {
	if a.e == nil {
		return nil
	}

	if err := a.e.validate(); err != nil {
		return err
	}

	// aggregate field expressions require a type of a number or attribute
	t := a.e.impliedType()
	if t != TypeAttribute && !t.isNumeric() {
		return fmt.Errorf("aggregate field expressions must resolve to a number type: %s", a.String())
	}

	if !a.e.referencesSpan() {
		return fmt.Errorf("aggregate field expressions must reference the span: %s", a.String())
	}

	switch a.op {
	case aggregateCount, aggregateAvg, aggregateMin, aggregateMax, aggregateSum:
	default:
		return newUnsupportedError(fmt.Sprintf("aggregate operation (%v)", a.op))
	}

	return nil
}

func (o SpansetOperation) validate() error {
	if err := o.LHS.validate(); err != nil {
		return err
	}

	return o.RHS.validate()
}

func (f SpansetFilter) validate() error {
	if err := f.Expression.validate(); err != nil {
		return err
	}

	t := f.Expression.impliedType()
	if t != TypeAttribute && t != TypeBoolean {
		return fmt.Errorf("span filter field expressions must resolve to a boolean: %s", f.String())
	}

	return nil
}

func (f ScalarFilter) validate() error {
	if err := f.lhs.validate(); err != nil {
		return err
	}
	if err := f.rhs.validate(); err != nil {
		return err
	}

	lhsT := f.lhs.impliedType()
	rhsT := f.rhs.impliedType()
	if !lhsT.isMatchingOperand(rhsT) {
		return fmt.Errorf("binary operations must operate on the same type: %s", f.String())
	}

	if !f.op.binaryTypesValid(lhsT, rhsT) {
		return fmt.Errorf("illegal operation for the given types: %s", f.String())
	}

	// Only supported expression types
	switch f.lhs.(type) {
	case Aggregate:
	default:
		return newUnsupportedError("scalar filter lhs of type (%v)")
	}

	switch f.rhs.(type) {
	case Static:
	default:
		return newUnsupportedError("scalar filter rhs of type (%v)")
	}

	return nil
}

func (o *BinaryOperation) validate() error {
	if err := o.LHS.validate(); err != nil {
		return err
	}
	if err := o.RHS.validate(); err != nil {
		return err
	}

	lhsT := o.LHS.impliedType()
	rhsT := o.RHS.impliedType()

	if !lhsT.isMatchingOperand(rhsT) {
		return fmt.Errorf("binary operations must operate on the same type: %s", o.String())
	}

	if rhsT == TypeNil && o.Op == OpEqual {
		return newUnsupportedError("{.a = nil}")
	}

	if !o.Op.binaryTypesValid(lhsT, rhsT) {
		return fmt.Errorf("illegal operation for the given types: %s", o.String())
	}

	// if this is a regex operator confirm the RHS is a valid regex
	if o.Op == OpRegex || o.Op == OpNotRegex {
		_, err := regexp.Compile(o.RHS.String())
		if err != nil {
			return fmt.Errorf("invalid regex: %s", o.RHS.String())
		}
	}

	// this condition may not be possible to hit since it's not parseable.
	// however, if we did somehow end up this situation, it would be good to return
	// a reasonable error
	switch o.Op {
	case OpSpansetChild,
		OpSpansetParent,
		OpSpansetDescendant,
		OpSpansetAncestor,
		OpSpansetSibling,
		OpSpansetNotChild,
		OpSpansetNotParent,
		OpSpansetNotSibling,
		OpSpansetNotAncestor,
		OpSpansetNotDescendant,
		OpSpansetUnionChild,
		OpSpansetUnionParent,
		OpSpansetUnionSibling,
		OpSpansetUnionAncestor,
		OpSpansetUnionDescendant:
		return newUnsupportedError(fmt.Sprintf("binary operation (%v)", o.Op))
	}

	return nil
}

func (o UnaryOperation) validate() error {
	if err := o.Expression.validate(); err != nil {
		return err
	}

	t := o.Expression.impliedType()
	if t == TypeAttribute {
		return nil
	}

	if !o.Op.unaryTypesValid(t) {
		return fmt.Errorf("illegal operation for the given type: %s", o.String())
	}

	return nil
}

func (s Static) validate() error {
	return nil
}

func (a Attribute) validate() error {
	if a.Parent {
		return newUnsupportedError("parent")
	}
	switch a.Intrinsic {
	case IntrinsicParent, IntrinsicChildCount:
		return newUnsupportedError(fmt.Sprintf("intrinsic (%v)", a.Intrinsic))
	}

	return nil
}

func (h *Hints) validate() error {
	return nil
}
