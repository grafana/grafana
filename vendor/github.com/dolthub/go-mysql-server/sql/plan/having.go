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

import "github.com/dolthub/go-mysql-server/sql"

// Having node is a filter that supports aggregate expressions. A having node
// is identical to a filter node in behaviour. The difference is that some
// analyzer rules work specifically on having clauses and not filters. For
// that reason, Having is a completely new node instead of using just filter.
type Having struct {
	UnaryNode
	Cond sql.Expression
}

var _ sql.Node = (*Having)(nil)
var _ sql.Expressioner = (*Having)(nil)
var _ sql.CollationCoercible = (*Having)(nil)

// NewHaving creates a new having node.
func NewHaving(cond sql.Expression, child sql.Node) *Having {
	return &Having{UnaryNode{Child: child}, cond}
}

// Resolved implements the sql.Node interface.
func (h *Having) Resolved() bool { return h.Cond.Resolved() && h.Child.Resolved() }

func (h *Having) IsReadOnly() bool {
	return h.Child.IsReadOnly()
}

// Expressions implements the sql.Expressioner interface.
func (h *Having) Expressions() []sql.Expression { return []sql.Expression{h.Cond} }

// WithChildren implements the Node interface.
func (h *Having) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(h, len(children), 1)
	}

	return NewHaving(h.Cond, children[0]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (h *Having) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, h.Child)
}

// WithExpressions implements the Expressioner interface.
func (h *Having) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(h, len(exprs), 1)
	}

	return NewHaving(exprs[0], h.Child), nil
}

func (h *Having) String() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("Having(%s)", h.Cond)
	_ = p.WriteChildren(h.Child.String())
	return p.String()
}

func (h *Having) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Having")
	children := []string{sql.DebugString(h.Cond), sql.DebugString(h.Child)}
	_ = pr.WriteChildren(children...)
	return pr.String()
}
