// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

// ExprList tests if the given expression is a static list construct and,
// if so, extracts the expressions that represent the list elements.
// If the given expression is not a static list, error diagnostics are
// returned.
//
// A particular Expression implementation can support this function by
// offering a method called ExprList that takes no arguments and returns
// []Expression. This method should return nil if a static list cannot
// be extracted.  Alternatively, an implementation can support
// UnwrapExpression to delegate handling of this function to a wrapped
// Expression object.
func ExprList(expr Expression) ([]Expression, Diagnostics) {
	type exprList interface {
		ExprList() []Expression
	}

	physExpr := UnwrapExpressionUntil(expr, func(expr Expression) bool {
		_, supported := expr.(exprList)
		return supported
	})

	if exL, supported := physExpr.(exprList); supported {
		if list := exL.ExprList(); list != nil {
			return list, nil
		}
	}
	return nil, Diagnostics{
		&Diagnostic{
			Severity: DiagError,
			Summary:  "Invalid expression",
			Detail:   "A static list expression is required.",
			Subject:  expr.StartRange().Ptr(),
		},
	}
}
