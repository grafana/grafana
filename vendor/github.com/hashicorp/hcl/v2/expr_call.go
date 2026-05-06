// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

// ExprCall tests if the given expression is a function call and,
// if so, extracts the function name and the expressions that represent
// the arguments. If the given expression is not statically a function call,
// error diagnostics are returned.
//
// A particular Expression implementation can support this function by
// offering a method called ExprCall that takes no arguments and returns
// *StaticCall. This method should return nil if a static call cannot
// be extracted.  Alternatively, an implementation can support
// UnwrapExpression to delegate handling of this function to a wrapped
// Expression object.
func ExprCall(expr Expression) (*StaticCall, Diagnostics) {
	type exprCall interface {
		ExprCall() *StaticCall
	}

	physExpr := UnwrapExpressionUntil(expr, func(expr Expression) bool {
		_, supported := expr.(exprCall)
		return supported
	})

	if exC, supported := physExpr.(exprCall); supported {
		if call := exC.ExprCall(); call != nil {
			return call, nil
		}
	}
	return nil, Diagnostics{
		&Diagnostic{
			Severity: DiagError,
			Summary:  "Invalid expression",
			Detail:   "A static function call is required.",
			Subject:  expr.StartRange().Ptr(),
		},
	}
}

// StaticCall represents a function call that was extracted statically from
// an expression using ExprCall.
type StaticCall struct {
	Name      string
	NameRange Range
	Arguments []Expression
	ArgsRange Range
}
