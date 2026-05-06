// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

// AbsTraversalForExpr attempts to interpret the given expression as
// an absolute traversal, or returns error diagnostic(s) if that is
// not possible for the given expression.
//
// A particular Expression implementation can support this function by
// offering a method called AsTraversal that takes no arguments and
// returns either a valid absolute traversal or nil to indicate that
// no traversal is possible. Alternatively, an implementation can support
// UnwrapExpression to delegate handling of this function to a wrapped
// Expression object.
//
// In most cases the calling application is interested in the value
// that results from an expression, but in rarer cases the application
// needs to see the name of the variable and subsequent
// attributes/indexes itself, for example to allow users to give references
// to the variables themselves rather than to their values. An implementer
// of this function should at least support attribute and index steps.
func AbsTraversalForExpr(expr Expression) (Traversal, Diagnostics) {
	type asTraversal interface {
		AsTraversal() Traversal
	}

	physExpr := UnwrapExpressionUntil(expr, func(expr Expression) bool {
		_, supported := expr.(asTraversal)
		return supported
	})

	if asT, supported := physExpr.(asTraversal); supported {
		if traversal := asT.AsTraversal(); traversal != nil {
			return traversal, nil
		}
	}
	return nil, Diagnostics{
		&Diagnostic{
			Severity: DiagError,
			Summary:  "Invalid expression",
			Detail:   "A single static variable reference is required: only attribute access and indexing with constant keys. No calculations, function calls, template expressions, etc are allowed here.",
			Subject:  expr.Range().Ptr(),
		},
	}
}

// RelTraversalForExpr is similar to AbsTraversalForExpr but it returns
// a relative traversal instead. Due to the nature of HCL expressions, the
// first element of the returned traversal is always a TraverseAttr, and
// then it will be followed by zero or more other expressions.
//
// Any expression accepted by AbsTraversalForExpr is also accepted by
// RelTraversalForExpr.
func RelTraversalForExpr(expr Expression) (Traversal, Diagnostics) {
	traversal, diags := AbsTraversalForExpr(expr)
	if len(traversal) > 0 {
		ret := make(Traversal, len(traversal))
		copy(ret, traversal)
		root := traversal[0].(TraverseRoot)
		ret[0] = TraverseAttr{
			Name:     root.Name,
			SrcRange: root.SrcRange,
		}
		return ret, diags
	}
	return traversal, diags
}

// ExprAsKeyword attempts to interpret the given expression as a static keyword,
// returning the keyword string if possible, and the empty string if not.
//
// A static keyword, for the sake of this function, is a single identifier.
// For example, the following attribute has an expression that would produce
// the keyword "foo":
//
//     example = foo
//
// This function is a variant of AbsTraversalForExpr, which uses the same
// interface on the given expression. This helper constrains the result
// further by requiring only a single root identifier.
//
// This function is intended to be used with the following idiom, to recognize
// situations where one of a fixed set of keywords is required and arbitrary
// expressions are not allowed:
//
//     switch hcl.ExprAsKeyword(expr) {
//     case "allow":
//         // (take suitable action for keyword "allow")
//     case "deny":
//         // (take suitable action for keyword "deny")
//     default:
//         diags = append(diags, &hcl.Diagnostic{
//             // ... "invalid keyword" diagnostic message ...
//         })
//     }
//
// The above approach will generate the same message for both the use of an
// unrecognized keyword and for not using a keyword at all, which is usually
// reasonable if the message specifies that the given value must be a keyword
// from that fixed list.
//
// Note that in the native syntax the keywords "true", "false", and "null" are
// recognized as literal values during parsing and so these reserved words
// cannot not be accepted as keywords by this function.
//
// Since interpreting an expression as a keyword bypasses usual expression
// evaluation, it should be used sparingly for situations where e.g. one of
// a fixed set of keywords is used in a structural way in a special attribute
// to affect the further processing of a block.
func ExprAsKeyword(expr Expression) string {
	type asTraversal interface {
		AsTraversal() Traversal
	}

	physExpr := UnwrapExpressionUntil(expr, func(expr Expression) bool {
		_, supported := expr.(asTraversal)
		return supported
	})

	if asT, supported := physExpr.(asTraversal); supported {
		if traversal := asT.AsTraversal(); len(traversal) == 1 {
			return traversal.RootName()
		}
	}
	return ""
}
