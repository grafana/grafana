// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"fmt"

	"github.com/hashicorp/hcl/v2"
	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/convert"
	"github.com/zclconf/go-cty/cty/function"
	"github.com/zclconf/go-cty/cty/function/stdlib"
)

type Operation struct {
	Impl function.Function
	Type cty.Type

	// ShortCircuit is an optional callback for binary operations which, if set,
	// will be called with the result of evaluating the LHS and RHS expressions
	// and their individual diagnostics. The LHS and RHS values are guaranteed
	// to be unmarked and of the correct type.
	//
	// ShortCircuit may return cty.NilVal to allow evaluation to proceed as
	// normal, or it may return a non-nil value with diagnostics to return
	// before the main Impl is called. The returned diagnostics should match
	// the side of the Operation which was taken.
	ShortCircuit func(lhs, rhs cty.Value, lhsDiags, rhsDiags hcl.Diagnostics) (cty.Value, hcl.Diagnostics)
}

var (
	OpLogicalOr = &Operation{
		Impl: stdlib.OrFunc,
		Type: cty.Bool,

		ShortCircuit: func(lhs, rhs cty.Value, lhsDiags, rhsDiags hcl.Diagnostics) (cty.Value, hcl.Diagnostics) {
			switch {
			// if both are unknown, we don't short circuit anything
			case !lhs.IsKnown() && !rhs.IsKnown():
				// short-circuit left-to-right when encountering a good unknown
				// value and both are unknown.
				if !lhsDiags.HasErrors() {
					return cty.UnknownVal(cty.Bool).RefineNotNull(), lhsDiags
				}
				// If the LHS has an error, the RHS might too. Don't
				// short-circuit so both diags get collected.
				return cty.NilVal, nil

			// for ||, a single true is the controlling condition
			case lhs.IsKnown() && lhs.True():
				return cty.True, lhsDiags
			case rhs.IsKnown() && rhs.True():
				return cty.True, rhsDiags

			// if the opposing side is false we can't short-circuit based on
			// boolean logic, so an unknown becomes the controlling condition
			case !lhs.IsKnown() && rhs.False():
				return cty.UnknownVal(cty.Bool).RefineNotNull(), lhsDiags
			case !rhs.IsKnown() && lhs.False():
				return cty.UnknownVal(cty.Bool).RefineNotNull(), rhsDiags
			}

			return cty.NilVal, nil
		},
	}
	OpLogicalAnd = &Operation{
		Impl: stdlib.AndFunc,
		Type: cty.Bool,

		ShortCircuit: func(lhs, rhs cty.Value, lhsDiags, rhsDiags hcl.Diagnostics) (cty.Value, hcl.Diagnostics) {

			switch {
			case !lhs.IsKnown() && !rhs.IsKnown():
				// short-circuit left-to-right when encountering a good unknown
				// value and both are unknown.
				if !lhsDiags.HasErrors() {
					return cty.UnknownVal(cty.Bool).RefineNotNull(), lhsDiags
				}
				// If the LHS has an error, the RHS might too. Don't
				// short-circuit so both diags get collected.
				return cty.NilVal, nil

			// For &&, a single false is the controlling condition
			case lhs.IsKnown() && lhs.False():
				return cty.False, lhsDiags
			case rhs.IsKnown() && rhs.False():
				return cty.False, rhsDiags

			// if the opposing side is true we can't short-circuit based on
			// boolean logic, so an unknown becomes the controlling condition
			case !lhs.IsKnown() && rhs.True():
				return cty.UnknownVal(cty.Bool).RefineNotNull(), lhsDiags
			case !rhs.IsKnown() && lhs.True():
				return cty.UnknownVal(cty.Bool).RefineNotNull(), rhsDiags
			}
			return cty.NilVal, nil
		},
	}
	OpLogicalNot = &Operation{
		Impl: stdlib.NotFunc,
		Type: cty.Bool,
	}

	OpEqual = &Operation{
		Impl: stdlib.EqualFunc,
		Type: cty.Bool,
	}
	OpNotEqual = &Operation{
		Impl: stdlib.NotEqualFunc,
		Type: cty.Bool,
	}

	OpGreaterThan = &Operation{
		Impl: stdlib.GreaterThanFunc,
		Type: cty.Bool,
	}
	OpGreaterThanOrEqual = &Operation{
		Impl: stdlib.GreaterThanOrEqualToFunc,
		Type: cty.Bool,
	}
	OpLessThan = &Operation{
		Impl: stdlib.LessThanFunc,
		Type: cty.Bool,
	}
	OpLessThanOrEqual = &Operation{
		Impl: stdlib.LessThanOrEqualToFunc,
		Type: cty.Bool,
	}

	OpAdd = &Operation{
		Impl: stdlib.AddFunc,
		Type: cty.Number,
	}
	OpSubtract = &Operation{
		Impl: stdlib.SubtractFunc,
		Type: cty.Number,
	}
	OpMultiply = &Operation{
		Impl: stdlib.MultiplyFunc,
		Type: cty.Number,
	}
	OpDivide = &Operation{
		Impl: stdlib.DivideFunc,
		Type: cty.Number,
	}
	OpModulo = &Operation{
		Impl: stdlib.ModuloFunc,
		Type: cty.Number,
	}
	OpNegate = &Operation{
		Impl: stdlib.NegateFunc,
		Type: cty.Number,
	}
)

var binaryOps []map[TokenType]*Operation

func init() {
	// This operation table maps from the operator's token type
	// to the AST operation type. All expressions produced from
	// binary operators are BinaryOp nodes.
	//
	// Binary operator groups are listed in order of precedence, with
	// the *lowest* precedence first. Operators within the same group
	// have left-to-right associativity.
	binaryOps = []map[TokenType]*Operation{
		{
			TokenOr: OpLogicalOr,
		},
		{
			TokenAnd: OpLogicalAnd,
		},
		{
			TokenEqualOp:  OpEqual,
			TokenNotEqual: OpNotEqual,
		},
		{
			TokenGreaterThan:   OpGreaterThan,
			TokenGreaterThanEq: OpGreaterThanOrEqual,
			TokenLessThan:      OpLessThan,
			TokenLessThanEq:    OpLessThanOrEqual,
		},
		{
			TokenPlus:  OpAdd,
			TokenMinus: OpSubtract,
		},
		{
			TokenStar:    OpMultiply,
			TokenSlash:   OpDivide,
			TokenPercent: OpModulo,
		},
	}
}

type BinaryOpExpr struct {
	LHS Expression
	Op  *Operation
	RHS Expression

	SrcRange hcl.Range
}

func (e *BinaryOpExpr) walkChildNodes(w internalWalkFunc) {
	w(e.LHS)
	w(e.RHS)
}

func (e *BinaryOpExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	impl := e.Op.Impl // assumed to be a function taking exactly two arguments
	params := impl.Params()
	lhsParam := params[0]
	rhsParam := params[1]

	var diags hcl.Diagnostics

	givenLHSVal, lhsDiags := e.LHS.Value(ctx)
	lhsVal, err := convert.Convert(givenLHSVal, lhsParam.Type)
	if err != nil {
		diags = append(diags, &hcl.Diagnostic{
			Severity:    hcl.DiagError,
			Summary:     "Invalid operand",
			Detail:      fmt.Sprintf("Unsuitable value for left operand: %s.", err),
			Subject:     e.LHS.Range().Ptr(),
			Context:     &e.SrcRange,
			Expression:  e.LHS,
			EvalContext: ctx,
		})
	}

	givenRHSVal, rhsDiags := e.RHS.Value(ctx)
	rhsVal, err := convert.Convert(givenRHSVal, rhsParam.Type)
	if err != nil {
		diags = append(diags, &hcl.Diagnostic{
			Severity:    hcl.DiagError,
			Summary:     "Invalid operand",
			Detail:      fmt.Sprintf("Unsuitable value for right operand: %s.", err),
			Subject:     e.RHS.Range().Ptr(),
			Context:     &e.SrcRange,
			Expression:  e.RHS,
			EvalContext: ctx,
		})
	}

	// diags so far only contains conversion errors, which should cover
	// incorrect parameter types.
	if diags.HasErrors() {
		// Add the rest of the diagnostic in case that helps the user, but keep
		// them separate as we continue for short-circuit handling.
		diags = append(diags, lhsDiags...)
		diags = append(diags, rhsDiags...)
		return cty.UnknownVal(e.Op.Type), diags
	}

	lhsVal, lhsMarks := lhsVal.Unmark()
	rhsVal, rhsMarks := rhsVal.Unmark()

	if e.Op.ShortCircuit != nil {
		forceResult, diags := e.Op.ShortCircuit(lhsVal, rhsVal, lhsDiags, rhsDiags)
		if forceResult != cty.NilVal {
			// It would be technically more correct to insert rhs diagnostics if
			// forceResult is not known since we didn't really short-circuit. That
			// would however not match the behavior of conditional expressions which
			// do drop all diagnostics from the unevaluated expressions
			return forceResult.WithMarks(lhsMarks, rhsMarks), diags
		}
	}

	diags = append(diags, lhsDiags...)
	diags = append(diags, rhsDiags...)
	if diags.HasErrors() {
		// Don't actually try the call if we have errors, since the this will
		// probably just produce confusing duplicate diagnostics.
		return cty.UnknownVal(e.Op.Type).WithMarks(lhsMarks, rhsMarks), diags
	}

	args := []cty.Value{lhsVal, rhsVal}
	result, err := impl.Call(args)
	if err != nil {
		diags = append(diags, &hcl.Diagnostic{
			// FIXME: This diagnostic is useless.
			Severity:    hcl.DiagError,
			Summary:     "Operation failed",
			Detail:      fmt.Sprintf("Error during operation: %s.", err),
			Subject:     &e.SrcRange,
			Expression:  e,
			EvalContext: ctx,
		})
		return cty.UnknownVal(e.Op.Type), diags
	}

	return result.WithMarks(lhsMarks, rhsMarks), diags
}

func (e *BinaryOpExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *BinaryOpExpr) StartRange() hcl.Range {
	return e.LHS.StartRange()
}

type UnaryOpExpr struct {
	Op  *Operation
	Val Expression

	SrcRange    hcl.Range
	SymbolRange hcl.Range
}

func (e *UnaryOpExpr) walkChildNodes(w internalWalkFunc) {
	w(e.Val)
}

func (e *UnaryOpExpr) Value(ctx *hcl.EvalContext) (cty.Value, hcl.Diagnostics) {
	impl := e.Op.Impl // assumed to be a function taking exactly one argument
	params := impl.Params()
	param := params[0]

	givenVal, diags := e.Val.Value(ctx)

	val, err := convert.Convert(givenVal, param.Type)
	if err != nil {
		diags = append(diags, &hcl.Diagnostic{
			Severity:    hcl.DiagError,
			Summary:     "Invalid operand",
			Detail:      fmt.Sprintf("Unsuitable value for unary operand: %s.", err),
			Subject:     e.Val.Range().Ptr(),
			Context:     &e.SrcRange,
			Expression:  e.Val,
			EvalContext: ctx,
		})
	}

	if diags.HasErrors() {
		// Don't actually try the call if we have errors already, since the
		// this will probably just produce a confusing duplicative diagnostic.
		return cty.UnknownVal(e.Op.Type), diags
	}

	args := []cty.Value{val}
	result, err := impl.Call(args)
	if err != nil {
		diags = append(diags, &hcl.Diagnostic{
			// FIXME: This diagnostic is useless.
			Severity:    hcl.DiagError,
			Summary:     "Operation failed",
			Detail:      fmt.Sprintf("Error during operation: %s.", err),
			Subject:     &e.SrcRange,
			Expression:  e,
			EvalContext: ctx,
		})
		return cty.UnknownVal(e.Op.Type), diags
	}

	return result, diags
}

func (e *UnaryOpExpr) Range() hcl.Range {
	return e.SrcRange
}

func (e *UnaryOpExpr) StartRange() hcl.Range {
	return e.SymbolRange
}
