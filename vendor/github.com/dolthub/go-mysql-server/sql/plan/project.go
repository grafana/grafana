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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// Project is a projection of certain expression from the children node.
type Project struct {
	UnaryNode
	// AliasDeps maps string representations of projected GetField expressions to whether it is projected alias
	// dependency
	AliasDeps map[string]bool
	deps      sql.ColSet
	sch       sql.Schema
	// Projections are the expressions to be projected on the row returned by the child node
	Projections []sql.Expression
	// CanDefer is true when the projection evaluation can be deferred to row spooling, which allows us to avoid a
	// separate iterator for the project node.
	CanDefer bool
	// IncludesNestedIters is true when the projection includes nested iterators because of expressions that return
	// a RowIter.
	IncludesNestedIters bool
}

var _ sql.Expressioner = (*Project)(nil)
var _ sql.Node = (*Project)(nil)
var _ sql.Projector = (*Project)(nil)
var _ sql.CollationCoercible = (*Project)(nil)

// NewProject creates a new projection.
func NewProject(expressions []sql.Expression, child sql.Node) *Project {
	return &Project{
		UnaryNode:   UnaryNode{child},
		Projections: expressions,
	}
}

// findDefault finds the matching GetField in the node's Schema and fills the default value in the column.
func findDefault(node sql.Node, gf *expression.GetField) *sql.ColumnDefaultValue {
	colSet := sql.NewColSet()
	switch n := node.(type) {
	case TableIdNode:
		colSet = n.Columns()
	case *GroupBy:
		return findDefault(n.Child, gf)
	case *HashLookup:
		return findDefault(n.Child, gf)
	case *Filter:
		return findDefault(n.Child, gf)
	case *JoinNode:
		if defVal := findDefault(n.Left(), gf); defVal != nil {
			return defVal
		}
		if defVal := findDefault(n.Right(), gf); defVal != nil {
			return defVal
		}
		return nil
	default:
		return nil
	}

	if !colSet.Contains(gf.Id()) {
		return nil
	}
	firstColId, ok := colSet.Next(1)
	if !ok {
		return nil
	}

	sch := node.Schema()
	idx := gf.Id() - firstColId
	if idx < 0 || int(idx) >= len(sch) {
		return nil
	}
	return sch[idx].Default
}

func unwrapGetField(expr sql.Expression) *expression.GetField {
	switch e := expr.(type) {
	case *expression.GetField:
		return e
	case *expression.Alias:
		return unwrapGetField(e.Child)
	default:
		return nil
	}
}

// ExprDeps returns a column set of the ids referenced
// in this list of expressions.
func ExprDeps(exprs ...sql.Expression) sql.ColSet {
	var deps sql.ColSet
	for _, e := range exprs {
		sql.Inspect(e, func(e sql.Expression) bool {
			switch e := e.(type) {
			case sql.IdExpression:
				deps.Add(e.Id())
			case *Subquery:
				deps.Union(e.Correlated())
			default:
			}
			return true
		})
	}
	return deps
}

// Schema implements the Node interface.
func (p *Project) Schema() sql.Schema {
	if p.sch == nil {
		p.sch = make(sql.Schema, len(p.Projections))
		for i, expr := range p.Projections {
			p.sch[i] = transform.ExpressionToColumn(expr, AliasSubqueryString(expr))
			if gf := unwrapGetField(expr); gf != nil {
				p.sch[i].Default = findDefault(p.Child, gf)
			}
		}
	}
	return p.sch
}

// Resolved implements the Resolvable interface.
func (p *Project) Resolved() bool {
	return p.UnaryNode.Child.Resolved() &&
		expression.ExpressionsResolved(p.Projections...)
}

func (p *Project) IsReadOnly() bool {
	return p.Child.IsReadOnly()
}

// Describe implements the sql.Describable interface.
func (p *Project) Describe(options sql.DescribeOptions) string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Project")
	var exprs = make([]string, len(p.Projections))
	for i, expr := range p.Projections {
		exprs[i] = sql.Describe(expr, options)
	}
	columns := fmt.Sprintf("columns: [%s]", strings.Join(exprs, ", "))
	_ = pr.WriteChildren(columns, sql.Describe(p.Child, options))
	return pr.String()
}

// String implements the fmt.Stringer interface.
func (p *Project) String() string {
	return p.Describe(sql.DescribeOptions{
		Analyze:   false,
		Estimates: false,
		Debug:     false,
	})
}

// DebugString implements the sql.DebugStringer interface.
func (p *Project) DebugString() string {
	return p.Describe(sql.DescribeOptions{
		Analyze:   false,
		Estimates: false,
		Debug:     true,
	})
}

// Expressions implements the Expressioner interface.
func (p *Project) Expressions() []sql.Expression {
	return p.Projections
}

// ProjectedExprs implements sql.Projector
func (p *Project) ProjectedExprs() []sql.Expression {
	return p.Projections
}

// WithChildren implements the Node interface.
func (p *Project) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 1)
	}
	np := *p
	np.Child = children[0]
	np.sch = nil
	return &np, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (p *Project) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, p.Child)
}

// WithExpressions implements the Expressioner interface.
func (p *Project) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(p.Projections) {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(exprs), len(p.Projections))
	}
	np := *p
	np.Projections = exprs
	np.sch = nil
	return &np, nil
}

// WithCanDefer returns a new Project with the CanDefer field set to the given value.
func (p *Project) WithCanDefer(canDefer bool) *Project {
	np := *p
	np.CanDefer = canDefer
	return &np
}

// WithIncludesNestedIters returns a new Project with the IncludesNestedIters field set to the given value.
func (p *Project) WithIncludesNestedIters(includesNestedIters bool) *Project {
	np := *p
	np.IncludesNestedIters = includesNestedIters
	np.CanDefer = false
	return &np
}

// WithAliasDeps returns a new Project with the AliasDeps field set to the given map.AliasDeps maps string
// representations of projected GetField expressions to whether it is projected alias dependency
func (p *Project) WithAliasDeps(aliasDeps map[string]bool) *Project {
	np := *p
	np.AliasDeps = aliasDeps
	return &np
}
