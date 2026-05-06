// Copyright 2020-2021 Dolthub, Inc.
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

package transform

import (
	"github.com/dolthub/go-mysql-server/sql"
)

// Visitor visits nodes in the plan.
type Visitor interface {
	// Visit method is invoked for each node encountered by Walk.
	// If the result Visitor is not nil, Walk visits each of the children
	// of the node with that visitor, followed by a call of Visit(nil)
	// to the returned visitor.
	Visit(node sql.Node) Visitor
}

// Walk traverses the plan tree in depth-first order. It starts by calling v.Visit(node); node must not be nil. If the
// visitor returned by  v.Visit(node) is not nil, Walk is invoked recursively with the returned visitor for each
// children of the node, followed by a call of v.Visit(nil) to the returned visitor. If v.Visit(node) returns non-nil,
// then all children are walked, even if one of them returns nil for v.Visit().
func Walk(v Visitor, node sql.Node) {
	if v = v.Visit(node); v == nil {
		return
	}

	for _, child := range node.Children() {
		Walk(v, child)
	}
}

type inspector func(sql.Node) bool

func (f inspector) Visit(node sql.Node) Visitor {
	if f(node) {
		return f
	}
	return nil
}

// Inspect performs a pre-order traversal of the sql.Node tree, excluding children of sql.OpaqueNodes
// First, it does f(node) and if cont = true, then InspectWithOpaque is recursively called on node's children.
// TODO: this conflicts with transform.InspectExpr which performs a post-order traversal and stops when stop = true.
func Inspect(node sql.Node, f func(sql.Node) bool) (cont bool) {
	if !f(node) {
		return false
	}

	if _, ok := node.(sql.OpaqueNode); ok {
		return false
	}

	// Avoid allocating []sql.Expression
	switch n := node.(type) {
	case sql.UnaryNode:
		Inspect(n.Child(), f)
	case sql.BinaryNode:
		Inspect(n.Left(), f)
		Inspect(n.Right(), f)
	default:
		for _, child := range n.Children() {
			Inspect(child, f)
		}
	}
	return true
}

// InspectWithOpaque performs a pre-order traversal of the sql.Node tree, including children of sql.OpaqueNodes.
// First, it does f(node) and if cont = true, then InspectWithOpaque is recursively called on node's children.
// TODO: this conflicts with transform.InspectExpr which performs a post-order traversal and stops when stop = true.
func InspectWithOpaque(node sql.Node, f func(sql.Node) bool) (cont bool) {
	if !f(node) {
		return false
	}

	// Avoid allocating []sql.Expression
	switch n := node.(type) {
	case sql.UnaryNode:
		InspectWithOpaque(n.Child(), f)
	case sql.BinaryNode:
		InspectWithOpaque(n.Left(), f)
		InspectWithOpaque(n.Right(), f)
	default:
		for _, child := range n.Children() {
			InspectWithOpaque(child, f)
		}
	}
	return true
}

// WalkExpressions traverses the plan and calls sql.Walk on any expression it finds.
func WalkExpressions(v sql.Visitor, node sql.Node) {
	InspectWithOpaque(node, func(node sql.Node) bool {
		if n, ok := node.(sql.Expressioner); ok {
			for _, e := range n.Expressions() {
				sql.Walk(v, e)
			}
		}
		return true
	})
}

// WalkExpressionsWithNode traverses the plan and calls sql.WalkWithNode on any expression it finds.
func WalkExpressionsWithNode(v sql.NodeVisitor, n sql.Node) {
	InspectWithOpaque(n, func(n sql.Node) bool {
		if expressioner, ok := n.(sql.Expressioner); ok {
			for _, e := range expressioner.Expressions() {
				sql.WalkWithNode(v, n, e)
			}
		}
		return true
	})
}

// InspectExpressions traverses every node through sql.InspectWithOpaque, and calls the `f` on expressions returned from
// sql.Expressioner.Expressions().
func InspectExpressions(node sql.Node, f func(sql.Expression) bool) {
	WalkExpressions(exprInspector(f), node)
}

type exprInspector func(sql.Expression) bool

func (f exprInspector) Visit(e sql.Expression) sql.Visitor {
	if f(e) {
		return f
	}
	return nil
}

// InspectExpressionsWithNode traverses every node through sql.InspectWithOpaque, and calls the `f` on expressions
// returned from sql.Expressioner.Expressions().
func InspectExpressionsWithNode(node sql.Node, f func(sql.Node, sql.Expression) bool) {
	WalkExpressionsWithNode(exprWithNodeInspector(f), node)
}

type exprWithNodeInspector func(sql.Node, sql.Expression) bool

func (f exprWithNodeInspector) Visit(n sql.Node, e sql.Expression) sql.NodeVisitor {
	if f(n, e) {
		return f
	}
	return nil
}
