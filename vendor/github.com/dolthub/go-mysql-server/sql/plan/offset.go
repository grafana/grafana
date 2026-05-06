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

// Offset is a node that skips the first N rows.
type Offset struct {
	UnaryNode
	Offset sql.Expression
}

var _ sql.Node = (*Offset)(nil)
var _ sql.CollationCoercible = (*Offset)(nil)

// NewOffset creates a new Offset node.
func NewOffset(n sql.Expression, child sql.Node) *Offset {
	return &Offset{
		UnaryNode: UnaryNode{Child: child},
		Offset:    n,
	}
}

func (o *Offset) IsReadOnly() bool {
	return o.Child.IsReadOnly()
}

// Expressions implements sql.Expressioner
func (o *Offset) Expressions() []sql.Expression {
	return []sql.Expression{o.Offset}
}

// WithExpressions implements sql.Expressioner
func (o *Offset) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(o, len(exprs), 1)
	}
	return NewOffset(exprs[0], o.Child), nil
}

// Resolved implements the Resolvable interface.
func (o *Offset) Resolved() bool {
	return o.Child.Resolved() && o.Offset.Resolved()
}

// WithChildren implements the Node interface.
func (o *Offset) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(o, len(children), 1)
	}
	return NewOffset(o.Offset, children[0]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (o *Offset) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, o.Child)
}

func (o Offset) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Offset(%s)", o.Offset)
	_ = pr.WriteChildren(o.Child.String())
	return pr.String()
}
