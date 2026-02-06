// Copyright 2021 Dolthub, Inc.
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

package plan

import (
	"errors"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

var ErrAggregationMissingWindow = errors.New("aggregation missing window expression")

type Window struct {
	UnaryNode
	SelectExprs []sql.Expression
}

var _ sql.Expressioner = (*Window)(nil)
var _ sql.Node = (*Window)(nil)
var _ sql.Projector = (*Window)(nil)
var _ sql.CollationCoercible = (*Window)(nil)

func NewWindow(selectExprs []sql.Expression, node sql.Node) *Window {
	return &Window{
		SelectExprs: selectExprs,
		UnaryNode:   UnaryNode{node},
	}
}

// Resolved implements sql.Node
func (w *Window) Resolved() bool {
	return w.UnaryNode.Child.Resolved() &&
		expression.ExpressionsResolved(w.SelectExprs...)
}

func (w *Window) IsReadOnly() bool {
	return w.Child.IsReadOnly()
}

func (w *Window) String() string {
	pr := sql.NewTreePrinter()
	var exprs = make([]string, len(w.SelectExprs))
	for i, expr := range w.SelectExprs {
		exprs[i] = expr.String()
	}
	_ = pr.WriteNode("Window(%s)", strings.Join(exprs, ", "))
	_ = pr.WriteChildren(w.Child.String())
	return pr.String()
}

func (w *Window) DebugString() string {
	pr := sql.NewTreePrinter()
	var exprs = make([]string, len(w.SelectExprs))
	for i, expr := range w.SelectExprs {
		exprs[i] = sql.DebugString(expr)
	}
	_ = pr.WriteNode("Window")
	exprs = append(exprs, sql.DebugString(w.Child))
	_ = pr.WriteChildren(exprs...)
	return pr.String()
}

// Schema implements sql.Node
func (w *Window) Schema() sql.Schema {
	var s = make(sql.Schema, len(w.SelectExprs))
	for i, e := range w.SelectExprs {
		s[i] = transform.ExpressionToColumn(e, AliasSubqueryString(e))
	}
	return s
}

// WithChildren implements sql.Node
func (w *Window) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(w, len(children), 1)
	}

	return NewWindow(w.SelectExprs, children[0]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (w *Window) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, w.Child)
}

// Expressions implements sql.Expressioner
func (w *Window) Expressions() []sql.Expression {
	return w.SelectExprs
}

// ProjectedExprs implements sql.Projector
func (w *Window) ProjectedExprs() []sql.Expression {
	return w.SelectExprs
}

// WithExpressions implements sql.Expressioner
func (w *Window) WithExpressions(e ...sql.Expression) (sql.Node, error) {
	if len(e) != len(w.SelectExprs) {
		return nil, sql.ErrInvalidChildrenNumber.New(w, len(e), len(w.SelectExprs))
	}

	return NewWindow(e, w.Child), nil
}
