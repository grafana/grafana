// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

// ExprMap tests if the given expression is a static map construct and,
// if so, extracts the expressions that represent the map elements.
// If the given expression is not a static map, error diagnostics are
// returned.
//
// A particular Expression implementation can support this function by
// offering a method called ExprMap that takes no arguments and returns
// []KeyValuePair. This method should return nil if a static map cannot
// be extracted.  Alternatively, an implementation can support
// UnwrapExpression to delegate handling of this function to a wrapped
// Expression object.
func ExprMap(expr Expression) ([]KeyValuePair, Diagnostics) {
	type exprMap interface {
		ExprMap() []KeyValuePair
	}

	physExpr := UnwrapExpressionUntil(expr, func(expr Expression) bool {
		_, supported := expr.(exprMap)
		return supported
	})

	if exM, supported := physExpr.(exprMap); supported {
		if pairs := exM.ExprMap(); pairs != nil {
			return pairs, nil
		}
	}
	return nil, Diagnostics{
		&Diagnostic{
			Severity: DiagError,
			Summary:  "Invalid expression",
			Detail:   "A static map expression is required.",
			Subject:  expr.StartRange().Ptr(),
		},
	}
}

// KeyValuePair represents a pair of expressions that serve as a single item
// within a map or object definition construct.
type KeyValuePair struct {
	Key   Expression
	Value Expression
}
