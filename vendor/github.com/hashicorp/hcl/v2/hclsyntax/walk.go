// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"github.com/hashicorp/hcl/v2"
)

// VisitFunc is the callback signature for VisitAll.
type VisitFunc func(node Node) hcl.Diagnostics

// VisitAll is a basic way to traverse the AST beginning with a particular
// node. The given function will be called once for each AST node in
// depth-first order, but no context is provided about the shape of the tree.
//
// The VisitFunc may return diagnostics, in which case they will be accumulated
// and returned as a single set.
func VisitAll(node Node, f VisitFunc) hcl.Diagnostics {
	diags := f(node)
	node.walkChildNodes(func(node Node) {
		diags = append(diags, VisitAll(node, f)...)
	})
	return diags
}

// Walker is an interface used with Walk.
type Walker interface {
	Enter(node Node) hcl.Diagnostics
	Exit(node Node) hcl.Diagnostics
}

// Walk is a more complex way to traverse the AST starting with a particular
// node, which provides information about the tree structure via separate
// Enter and Exit functions.
func Walk(node Node, w Walker) hcl.Diagnostics {
	diags := w.Enter(node)
	node.walkChildNodes(func(node Node) {
		diags = append(diags, Walk(node, w)...)
	})
	moreDiags := w.Exit(node)
	diags = append(diags, moreDiags...)
	return diags
}
