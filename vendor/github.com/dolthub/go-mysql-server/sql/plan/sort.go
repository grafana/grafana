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
)

type Sortable interface {
	sql.Node
	GetSortFields() sql.SortFields
}

// Sort is the sort node.
type Sort struct {
	UnaryNode
	SortFields sql.SortFields
}

// NewSort creates a new Sort node.
func NewSort(sortFields []sql.SortField, child sql.Node) *Sort {
	return &Sort{
		UnaryNode:  UnaryNode{child},
		SortFields: sortFields,
	}
}

var _ sql.Expressioner = (*Sort)(nil)
var _ sql.Node = (*Sort)(nil)
var _ sql.CollationCoercible = (*Sort)(nil)
var _ Sortable = (*Sort)(nil)

// Resolved implements the Resolvable interface.
func (s *Sort) Resolved() bool {
	for _, f := range s.SortFields {
		if !f.Column.Resolved() {
			return false
		}
	}
	return s.Child.Resolved()
}

func (s *Sort) IsReadOnly() bool {
	return s.Child.IsReadOnly()
}

func (s *Sort) String() string {
	pr := sql.NewTreePrinter()
	var fields = make([]string, len(s.SortFields))
	for i, f := range s.SortFields {
		fields[i] = fmt.Sprintf("%s %s", f.Column, f.Order)
	}
	_ = pr.WriteNode("Sort(%s)", strings.Join(fields, ", "))
	_ = pr.WriteChildren(s.Child.String())
	return pr.String()
}

func (s *Sort) DebugString() string {
	pr := sql.NewTreePrinter()
	var fields = make([]string, len(s.SortFields))
	for i, f := range s.SortFields {
		fields[i] = sql.DebugString(f)
	}
	_ = pr.WriteNode("Sort(%s)", strings.Join(fields, ", "))
	_ = pr.WriteChildren(sql.DebugString(s.Child))
	return pr.String()
}

// Expressions implements the Expressioner interface.
func (s *Sort) Expressions() []sql.Expression {
	// TODO: use shared method
	var exprs = make([]sql.Expression, len(s.SortFields))
	for i, f := range s.SortFields {
		exprs[i] = f.Column
	}
	return exprs
}

// WithChildren implements the Node interface.
func (s *Sort) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}

	return NewSort(s.SortFields, children[0]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (s *Sort) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, s.Child)
}

// WithExpressions implements the Expressioner interface.
func (s *Sort) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(s.SortFields) {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(exprs), len(s.SortFields))
	}

	fields := s.SortFields.FromExpressions(exprs...)
	return NewSort(fields, s.Child), nil
}

func (s *Sort) GetSortFields() sql.SortFields {
	return s.SortFields
}

// TopN was a sort node that has a limit. It doesn't need to buffer everything,
// but can calculate the top n on the fly.
type TopN struct {
	UnaryNode
	Limit         sql.Expression
	Fields        sql.SortFields
	CalcFoundRows bool
}

// NewTopN creates a new TopN node.
func NewTopN(fields sql.SortFields, limit sql.Expression, child sql.Node) *TopN {
	return &TopN{
		UnaryNode: UnaryNode{child},
		Limit:     limit,
		Fields:    fields,
	}
}

var _ sql.Node = (*TopN)(nil)
var _ sql.Expressioner = (*TopN)(nil)
var _ sql.CollationCoercible = (*TopN)(nil)

// Resolved implements the Resolvable interface.
func (n *TopN) Resolved() bool {
	for _, f := range n.Fields {
		if !f.Column.Resolved() {
			return false
		}
	}
	return n.Child.Resolved()
}

func (n TopN) WithCalcFoundRows(v bool) *TopN {
	n.CalcFoundRows = v
	return &n
}

func (n *TopN) IsReadOnly() bool {
	return n.Child.IsReadOnly()
}

func (n *TopN) String() string {
	pr := sql.NewTreePrinter()
	var fields = make([]string, len(n.Fields))
	for i, f := range n.Fields {
		fields[i] = fmt.Sprintf("%s %s", f.Column, f.Order)
	}
	_ = pr.WriteNode("TopN(Limit: [%s]; %s)", n.Limit.String(), strings.Join(fields, ", "))
	_ = pr.WriteChildren(n.Child.String())
	return pr.String()
}

func (n *TopN) DebugString() string {
	pr := sql.NewTreePrinter()
	var fields = make([]string, len(n.Fields))
	for i, f := range n.Fields {
		fields[i] = sql.DebugString(f)
	}
	_ = pr.WriteNode("TopN(Limit: [%s]; %s)", sql.DebugString(n.Limit), strings.Join(fields, ", "))
	_ = pr.WriteChildren(sql.DebugString(n.Child))
	return pr.String()
}

// Expressions implements the Expressioner interface.
func (n *TopN) Expressions() []sql.Expression {
	exprs := []sql.Expression{n.Limit}
	exprs = append(exprs, n.Fields.ToExpressions()...)
	return exprs
}

// WithChildren implements the Node interface.
func (n *TopN) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 1)
	}

	topn := NewTopN(n.Fields, n.Limit, children[0])
	topn.CalcFoundRows = n.CalcFoundRows
	return topn, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (n *TopN) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, n.Child)
}

// WithExpressions implements the Expressioner interface.
func (n *TopN) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(n.Fields)+1 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(exprs), len(n.Fields)+1)
	}

	var limit = exprs[0]
	var fields = n.Fields.FromExpressions(exprs[1:]...)

	topn := NewTopN(fields, limit, n.Child)
	topn.CalcFoundRows = n.CalcFoundRows
	return topn, nil
}

func (n *TopN) GetSortFields() sql.SortFields {
	return n.Fields
}
