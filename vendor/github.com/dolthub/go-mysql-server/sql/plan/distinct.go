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

// Distinct is a node that ensures all rows that come from it are unique.
type Distinct struct {
	UnaryNode
}

var _ sql.Node = (*Distinct)(nil)
var _ sql.CollationCoercible = (*Distinct)(nil)

// NewDistinct creates a new Distinct node.
func NewDistinct(child sql.Node) *Distinct {
	return &Distinct{
		UnaryNode: UnaryNode{Child: child},
	}
}

// Resolved implements the Resolvable interface.
func (d *Distinct) Resolved() bool {
	return d.UnaryNode.Child.Resolved()
}

// WithChildren implements the Node interface.
func (d *Distinct) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}

	return NewDistinct(children[0]), nil
}

func (d *Distinct) IsReadOnly() bool {
	return d.Child.IsReadOnly()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (d *Distinct) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, d.Child)
}

// Describe implements sql.Describable
func (d Distinct) Describe(options sql.DescribeOptions) string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("Distinct")
	_ = p.WriteChildren(sql.Describe(d.Child, options))
	return p.String()
}

// String implements fmt.Stringer
func (d Distinct) String() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("Distinct")
	_ = p.WriteChildren(d.Child.String())
	return p.String()
}

// DebugString implements sql.DebugStringer
func (d Distinct) DebugString() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("Distinct")
	_ = p.WriteChildren(sql.DebugString(d.Child))
	return p.String()
}

// OrderedDistinct is a Distinct node optimized for sorted row sets.
// It's 2 orders of magnitude faster and uses 2 orders of magnitude less memory.
type OrderedDistinct struct {
	UnaryNode
}

var _ sql.Node = (*OrderedDistinct)(nil)
var _ sql.CollationCoercible = (*OrderedDistinct)(nil)

// NewOrderedDistinct creates a new OrderedDistinct node.
func NewOrderedDistinct(child sql.Node) *OrderedDistinct {
	if d, ok := child.(*OrderedDistinct); ok {
		child = d.Child
	}
	return &OrderedDistinct{
		UnaryNode: UnaryNode{Child: child},
	}
}

// Resolved implements the Resolvable interface.
func (d *OrderedDistinct) Resolved() bool {
	return d.UnaryNode.Child.Resolved()
}

// WithChildren implements the Node interface.
func (d *OrderedDistinct) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}

	return NewOrderedDistinct(children[0]), nil
}

func (d *OrderedDistinct) IsReadOnly() bool {
	return d.Child.IsReadOnly()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (d *OrderedDistinct) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, d.Child)
}

func (d OrderedDistinct) String() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("OrderedDistinct")
	_ = p.WriteChildren(d.Child.String())
	return p.String()
}

func (d OrderedDistinct) DebugString() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("OrderedDistinct")
	_ = p.WriteChildren(sql.DebugString(d.Child))
	return p.String()
}
