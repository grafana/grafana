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
	"github.com/dolthub/go-mysql-server/sql"
)

// Filter skips rows that don't match a certain expression.
type Filter struct {
	UnaryNode
	Expression sql.Expression
}

var _ sql.Node = (*Filter)(nil)
var _ sql.CollationCoercible = (*Filter)(nil)

// NewFilter creates a new filter node.
func NewFilter(expression sql.Expression, child sql.Node) *Filter {
	return &Filter{
		UnaryNode:  UnaryNode{Child: child},
		Expression: expression,
	}
}

// Resolved implements the Resolvable interface.
func (f *Filter) Resolved() bool {
	return f.UnaryNode.Child.Resolved() && f.Expression.Resolved()
}

func (f *Filter) IsReadOnly() bool {
	return f.Child.IsReadOnly()
}

// WithChildren implements the Node interface.
func (f *Filter) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 1)
	}

	return NewFilter(f.Expression, children[0]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (f *Filter) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, f.UnaryNode.Child)
}

// WithExpressions implements the Expressioner interface.
func (f *Filter) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(exprs), 1)
	}

	return NewFilter(exprs[0], f.Child), nil
}

// Describe implements the sql.Describable interface
func (f *Filter) Describe(options sql.DescribeOptions) string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Filter")
	children := []string{sql.Describe(f.Expression, options), sql.Describe(f.Child, options)}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// String implements the fmt.Stringer interface
func (f *Filter) String() string {
	return f.Describe(sql.DescribeOptions{
		Analyze:   false,
		Estimates: false,
		Debug:     false,
	})
}

// DebugString implements the sql.DebugStringer interface
func (f *Filter) DebugString() string {
	return f.Describe(sql.DescribeOptions{
		Analyze:   false,
		Estimates: false,
		Debug:     true,
	})
}

// Expressions implements the Expressioner interface.
func (f *Filter) Expressions() []sql.Expression {
	return []sql.Expression{f.Expression}
}

// FilterIter is an iterator that filters another iterator and skips rows that
// don't match the given condition.
type FilterIter struct {
	cond      sql.Expression
	childIter sql.RowIter
}

// NewFilterIter creates a new FilterIter.
func NewFilterIter(
	cond sql.Expression,
	child sql.RowIter,
) *FilterIter {
	return &FilterIter{cond: cond, childIter: child}
}

// Next implements the RowIter interface.
func (i *FilterIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		row, err := i.childIter.Next(ctx)
		if err != nil {
			return nil, err
		}

		res, err := sql.EvaluateCondition(ctx, i.cond, row)
		if err != nil {
			return nil, err
		}

		if sql.IsTrue(res) {
			return row, nil
		}
	}
}

// Close implements the RowIter interface.
func (i *FilterIter) Close(ctx *sql.Context) error {
	return i.childIter.Close(ctx)
}
