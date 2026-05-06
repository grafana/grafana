// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"github.com/hashicorp/hcl/v2"
)

// Variables returns all of the variables referenced within a given experssion.
//
// This is the implementation of the "Variables" method on every native
// expression.
func Variables(expr Expression) []hcl.Traversal {
	var vars []hcl.Traversal

	walker := &variablesWalker{
		Callback: func(t hcl.Traversal) {
			vars = append(vars, t)
		},
	}

	Walk(expr, walker)

	return vars
}

// variablesWalker is a Walker implementation that calls its callback for any
// root scope traversal found while walking.
type variablesWalker struct {
	Callback    func(hcl.Traversal)
	localScopes []map[string]struct{}
}

func (w *variablesWalker) Enter(n Node) hcl.Diagnostics {
	switch tn := n.(type) {
	case *ScopeTraversalExpr:
		t := tn.Traversal

		// Check if the given root name appears in any of the active
		// local scopes. We don't want to return local variables here, since
		// the goal of walking variables is to tell the calling application
		// which names it needs to populate in the _root_ scope.
		name := t.RootName()
		for _, names := range w.localScopes {
			if _, localized := names[name]; localized {
				return nil
			}
		}

		w.Callback(t)
	case ChildScope:
		w.localScopes = append(w.localScopes, tn.LocalNames)
	}
	return nil
}

func (w *variablesWalker) Exit(n Node) hcl.Diagnostics {
	switch n.(type) {
	case ChildScope:
		// pop the latest local scope, assuming that the walker will
		// behave symmetrically as promised.
		w.localScopes = w.localScopes[:len(w.localScopes)-1]
	}
	return nil
}

// ChildScope is a synthetic AST node that is visited during a walk to
// indicate that its descendent will be evaluated in a child scope, which
// may mask certain variables from the parent scope as locals.
//
// ChildScope nodes don't really exist in the AST, but are rather synthesized
// on the fly during walk. Therefore it doesn't do any good to transform them;
// instead, transform either parent node that created a scope or the expression
// that the child scope struct wraps.
type ChildScope struct {
	LocalNames map[string]struct{}
	Expr       Expression
}

func (e ChildScope) walkChildNodes(w internalWalkFunc) {
	w(e.Expr)
}

// Range returns the range of the expression that the ChildScope is
// encapsulating. It isn't really very useful to call Range on a ChildScope.
func (e ChildScope) Range() hcl.Range {
	return e.Expr.Range()
}
