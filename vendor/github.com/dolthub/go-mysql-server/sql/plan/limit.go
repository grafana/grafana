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

// Limit is a node that only allows up to N rows to be retrieved.
type Limit struct {
	UnaryNode
	Limit         sql.Expression
	CalcFoundRows bool
}

var _ sql.Node = (*Limit)(nil)
var _ sql.CollationCoercible = (*Limit)(nil)

// NewLimit creates a new Limit node with the given size.
func NewLimit(size sql.Expression, child sql.Node) *Limit {
	return &Limit{
		UnaryNode: UnaryNode{Child: child},
		Limit:     size,
	}
}

// Expressions implements sql.Expressioner
func (l *Limit) Expressions() []sql.Expression {
	return []sql.Expression{l.Limit}
}

// WithExpressions implements sql.Expressioner
func (l Limit) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(l, len(exprs), 1)
	}
	nl := &l
	nl.Limit = exprs[0]
	return nl, nil
}

// Resolved implements the Resolvable interface.
func (l *Limit) Resolved() bool {
	return l.UnaryNode.Child.Resolved() && l.Limit.Resolved()
}

func (l Limit) WithCalcFoundRows(v bool) *Limit {
	l.CalcFoundRows = v
	return &l
}

func (l Limit) IsReadOnly() bool {
	return l.Child.IsReadOnly()
}

// WithChildren implements the Node interface.
func (l *Limit) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(l, len(children), 1)
	}

	nl := *l
	nl.Child = children[0]
	return &nl, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (l *Limit) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, l.Child)
}

func (l Limit) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Limit(%s)", l.Limit)
	_ = pr.WriteChildren(l.Child.String())
	return pr.String()
}

func (l Limit) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Limit(%s)", l.Limit)
	_ = pr.WriteChildren(sql.DebugString(l.Child))
	return pr.String()
}
