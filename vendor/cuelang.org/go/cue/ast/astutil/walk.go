// Copyright 2018 The CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package astutil

import (
	"fmt"

	"cuelang.org/go/cue/ast"
)

// TODO: use ast.Walk or adopt that version to allow visitors.

// A visitor's before method is invoked for each node encountered by Walk.
// If the result visitor w is not nil, Walk visits each of the children
// of node with the visitor w, followed by a call of w.After.
type visitor interface {
	Before(node ast.Node) (w visitor)
	After(node ast.Node)
}

// Helper functions for common node lists. They may be empty.

func walkExprList(v visitor, list []ast.Expr) {
	for _, x := range list {
		walk(v, x)
	}
}

func walkDeclList(v visitor, list []ast.Decl) {
	for _, x := range list {
		walk(v, x)
	}
}

// walk traverses an AST in depth-first order: It starts by calling
// v.Visit(node); node must not be nil. If the visitor w returned by
// v.Visit(node) is not nil, walk is invoked recursively with visitor
// w for each of the non-nil children of node, followed by a call of
// w.Visit(nil).
func walk(v visitor, node ast.Node) {
	if v = v.Before(node); v == nil {
		return
	}

	// TODO: record the comment groups and interleave with the values like for
	// parsing and printing?
	for _, c := range node.Comments() {
		walk(v, c)
	}

	// walk children
	// (the order of the cases matches the order
	// of the corresponding node types in go)
	switch n := node.(type) {
	// Comments and fields
	case *ast.Comment:
		// nothing to do

	case *ast.CommentGroup:
		for _, c := range n.List {
			walk(v, c)
		}

	case *ast.Attribute:
		// nothing to do

	case *ast.Field:
		walk(v, n.Label)
		if n.Value != nil {
			walk(v, n.Value)
		}
		for _, a := range n.Attrs {
			walk(v, a)
		}

	case *ast.Func:
		walkExprList(v, n.Args)
		walk(v, n.Ret)

	case *ast.StructLit:
		for _, f := range n.Elts {
			walk(v, f)
		}

	// Expressions
	case *ast.BottomLit, *ast.BadExpr, *ast.Ident, *ast.BasicLit:
		// nothing to do

	case *ast.Interpolation:
		for _, e := range n.Elts {
			walk(v, e)
		}

	case *ast.ListLit:
		walkExprList(v, n.Elts)

	case *ast.Ellipsis:
		if n.Type != nil {
			walk(v, n.Type)
		}

	case *ast.ParenExpr:
		walk(v, n.X)

	case *ast.SelectorExpr:
		walk(v, n.X)
		walk(v, n.Sel)

	case *ast.IndexExpr:
		walk(v, n.X)
		walk(v, n.Index)

	case *ast.SliceExpr:
		walk(v, n.X)
		if n.Low != nil {
			walk(v, n.Low)
		}
		if n.High != nil {
			walk(v, n.High)
		}

	case *ast.CallExpr:
		walk(v, n.Fun)
		walkExprList(v, n.Args)

	case *ast.UnaryExpr:
		walk(v, n.X)

	case *ast.BinaryExpr:
		walk(v, n.X)
		walk(v, n.Y)

	// Declarations
	case *ast.ImportSpec:
		if n.Name != nil {
			walk(v, n.Name)
		}
		walk(v, n.Path)

	case *ast.BadDecl:
		// nothing to do

	case *ast.ImportDecl:
		for _, s := range n.Specs {
			walk(v, s)
		}

	case *ast.EmbedDecl:
		walk(v, n.Expr)

	case *ast.Alias:
		walk(v, n.Ident)
		walk(v, n.Expr)

	case *ast.Comprehension:
		for _, c := range n.Clauses {
			walk(v, c)
		}
		walk(v, n.Value)

	// Files and packages
	case *ast.File:
		walkDeclList(v, n.Decls)

	case *ast.Package:
		// The package identifier isn't really an identifier. Skip it.

	case *ast.LetClause:
		walk(v, n.Ident)
		walk(v, n.Expr)

	case *ast.ForClause:
		if n.Key != nil {
			walk(v, n.Key)
		}
		walk(v, n.Value)
		walk(v, n.Source)

	case *ast.IfClause:
		walk(v, n.Condition)

	default:
		panic(fmt.Sprintf("Walk: unexpected node type %T", n))
	}

	v.After(node)
}
