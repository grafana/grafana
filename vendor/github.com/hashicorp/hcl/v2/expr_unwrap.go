// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

type unwrapExpression interface {
	UnwrapExpression() Expression
}

// UnwrapExpression removes any "wrapper" expressions from the given expression,
// to recover the representation of the physical expression given in source
// code.
//
// Sometimes wrapping expressions are used to modify expression behavior, e.g.
// in extensions that need to make some local variables available to certain
// sub-trees of the configuration. This can make it difficult to reliably
// type-assert on the physical AST types used by the underlying syntax.
//
// Unwrapping an expression may modify its behavior by stripping away any
// additional constraints or capabilities being applied to the Value and
// Variables methods, so this function should generally only be used prior
// to operations that concern themselves with the static syntax of the input
// configuration, and not with the effective value of the expression.
//
// Wrapper expression types must support unwrapping by implementing a method
// called UnwrapExpression that takes no arguments and returns the embedded
// Expression. Implementations of this method should peel away only one level
// of wrapping, if multiple are present. This method may return nil to
// indicate _dynamically_ that no wrapped expression is available, for
// expression types that might only behave as wrappers in certain cases.
func UnwrapExpression(expr Expression) Expression {
	for {
		unwrap, wrapped := expr.(unwrapExpression)
		if !wrapped {
			return expr
		}
		innerExpr := unwrap.UnwrapExpression()
		if innerExpr == nil {
			return expr
		}
		expr = innerExpr
	}
}

// UnwrapExpressionUntil is similar to UnwrapExpression except it gives the
// caller an opportunity to test each level of unwrapping to see each a
// particular expression is accepted.
//
// This could be used, for example, to unwrap until a particular other
// interface is satisfied, regardless of wrap wrapping level it is satisfied
// at.
//
// The given callback function must return false to continue wrapping, or
// true to accept and return the proposed expression given. If the callback
// function rejects even the final, physical expression then the result of
// this function is nil.
func UnwrapExpressionUntil(expr Expression, until func(Expression) bool) Expression {
	for {
		if until(expr) {
			return expr
		}
		unwrap, wrapped := expr.(unwrapExpression)
		if !wrapped {
			return nil
		}
		expr = unwrap.UnwrapExpression()
		if expr == nil {
			return nil
		}
	}
}
