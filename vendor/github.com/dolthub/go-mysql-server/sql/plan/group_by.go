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

package plan

import (
	"fmt"
	"strings"

	errors "gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// ErrGroupBy is returned when the aggregation is not supported.
var ErrGroupBy = errors.NewKind("group by aggregation '%v' not supported")

// GroupBy groups the rows by some expressions.
type GroupBy struct {
	UnaryNode
	SelectDeps   []sql.Expression
	GroupByExprs []sql.Expression
}

var _ sql.Expressioner = (*GroupBy)(nil)
var _ sql.Node = (*GroupBy)(nil)
var _ sql.Projector = (*GroupBy)(nil)
var _ sql.CollationCoercible = (*GroupBy)(nil)

// NewGroupBy creates a new GroupBy node. Like Project, GroupBy is a top-level node, and contains all the fields that
// will appear in the output of the query. Some of these fields may be aggregate functions, some may be columns or
// other expressions. Unlike a project, the GroupBy also has a list of group-by expressions, which usually also appear
// in the list of selected expressions.
func NewGroupBy(selectDeps, groupByExprs []sql.Expression, child sql.Node) *GroupBy {
	return &GroupBy{
		UnaryNode:    UnaryNode{Child: child},
		SelectDeps:   selectDeps,
		GroupByExprs: groupByExprs,
	}
}

// Resolved implements the Resolvable interface.
func (g *GroupBy) Resolved() bool {
	return g.UnaryNode.Child.Resolved() &&
		expression.ExpressionsResolved(g.SelectDeps...) &&
		expression.ExpressionsResolved(g.GroupByExprs...)
}

func (g *GroupBy) IsReadOnly() bool {
	return g.Child.IsReadOnly()
}

// Schema implements the Node interface.
func (g *GroupBy) Schema() sql.Schema {
	var s = make(sql.Schema, len(g.SelectDeps))
	for i, e := range g.SelectDeps {
		var name string
		if n, ok := e.(sql.Nameable); ok {
			name = n.Name()
		} else {
			name = AliasSubqueryString(e)
		}

		var table string
		if t, ok := e.(sql.Tableable); ok {
			table = t.Table()
		}

		var db string
		if t, ok := e.(sql.Databaseable); ok {
			db = t.Database()
		}

		s[i] = &sql.Column{
			Name:           name,
			Type:           e.Type(),
			Nullable:       e.IsNullable(),
			Source:         table,
			DatabaseSource: db,
		}
	}

	return s
}

// WithChildren implements the Node interface.
func (g *GroupBy) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(g, len(children), 1)
	}

	return NewGroupBy(g.SelectDeps, g.GroupByExprs, children[0]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (g *GroupBy) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, g.Child)
}

// WithExpressions implements the Node interface.
func (g *GroupBy) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	expected := len(g.SelectDeps) + len(g.GroupByExprs)
	if len(exprs) != expected {
		return nil, sql.ErrInvalidChildrenNumber.New(g, len(exprs), expected)
	}

	agg := make([]sql.Expression, len(g.SelectDeps))
	copy(agg, exprs[:len(g.SelectDeps)])

	grouping := make([]sql.Expression, len(g.GroupByExprs))
	copy(grouping, exprs[len(g.SelectDeps):])

	return NewGroupBy(agg, grouping, g.Child), nil
}

func (g *GroupBy) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("GroupBy")

	var selectDeps = make([]string, len(g.SelectDeps))
	for i, e := range g.SelectDeps {
		selectDeps[i] = e.String()
	}

	var grouping = make([]string, len(g.GroupByExprs))
	for i, g := range g.GroupByExprs {
		grouping[i] = g.String()
	}

	_ = pr.WriteChildren(
		fmt.Sprintf("SelectDeps(%s)", strings.Join(selectDeps, ", ")),
		fmt.Sprintf("Grouping(%s)", strings.Join(grouping, ", ")),
		g.Child.String(),
	)
	return pr.String()
}

func (g *GroupBy) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("GroupBy")

	var selectDeps = make([]string, len(g.SelectDeps))
	for i, e := range g.SelectDeps {
		selectDeps[i] = sql.DebugString(e)
	}

	var grouping = make([]string, len(g.GroupByExprs))
	for i, g := range g.GroupByExprs {
		grouping[i] = sql.DebugString(g)
	}

	_ = pr.WriteChildren(
		fmt.Sprintf("select: %s", strings.Join(selectDeps, ", ")),
		fmt.Sprintf("group: %s", strings.Join(grouping, ", ")),
		sql.DebugString(g.Child),
	)
	return pr.String()
}

// Expressions implements the Expressioner interface.
func (g *GroupBy) Expressions() []sql.Expression {
	var exprs []sql.Expression
	exprs = append(exprs, g.SelectDeps...)
	exprs = append(exprs, g.GroupByExprs...)
	return exprs
}

// ProjectedExprs implements the sql.Projector interface
func (g *GroupBy) ProjectedExprs() []sql.Expression {
	return g.SelectDeps
}
