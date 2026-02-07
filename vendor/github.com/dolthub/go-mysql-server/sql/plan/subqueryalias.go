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

	"github.com/dolthub/go-mysql-server/sql"
)

// SubqueryAlias is a node that gives a subquery a name.
type SubqueryAlias struct {
	UnaryNode
	Correlated   sql.ColSet
	cols         sql.ColSet
	ScopeMapping map[sql.ColumnId]sql.Expression

	name           string
	TextDefinition string
	ColumnNames    []string

	id sql.TableId

	// OuterScopeVisibility is true when a SubqueryAlias (i.e. derived table) is contained in a subquery
	// expression and is eligible to have visibility to outer scopes of the query.
	OuterScopeVisibility bool
	Volatile             bool
	CacheableCTESource   bool
	IsLateral            bool
}

var _ sql.Node = (*SubqueryAlias)(nil)
var _ sql.CollationCoercible = (*SubqueryAlias)(nil)
var _ sql.RenameableNode = (*SubqueryAlias)(nil)
var _ sql.OpaqueNode = (*SubqueryAlias)(nil)

// NewSubqueryAlias creates a new SubqueryAlias node.
func NewSubqueryAlias(name, textDefinition string, node sql.Node) *SubqueryAlias {
	return &SubqueryAlias{
		UnaryNode:            UnaryNode{Child: node},
		name:                 name,
		TextDefinition:       textDefinition,
		OuterScopeVisibility: false,
	}
}

// WithId implements sql.TableIdNode
func (sq *SubqueryAlias) WithId(id sql.TableId) TableIdNode {
	ret := *sq
	ret.id = id
	return &ret
}

// Id implements sql.TableIdNode
func (sq *SubqueryAlias) Id() sql.TableId {
	return sq.id
}

// WithColumns implements sql.TableIdNode
func (sq *SubqueryAlias) WithColumns(set sql.ColSet) TableIdNode {
	ret := *sq
	ret.cols = set
	return &ret
}

// Columns implements sql.TableIdNode
func (sq *SubqueryAlias) Columns() sql.ColSet {
	return sq.cols
}

// AsView returns the view wrapper for this subquery
func (sq *SubqueryAlias) AsView(createViewStmt string) *sql.View {
	return sql.NewView(sq.Name(), sq, sq.TextDefinition, createViewStmt)
}

// Name implements the Table interface.
func (sq *SubqueryAlias) Name() string { return sq.name }

func (sq *SubqueryAlias) WithName(n string) sql.Node {
	ret := *sq
	ret.name = n
	return &ret
}

func (sq *SubqueryAlias) IsReadOnly() bool {
	return sq.Child.IsReadOnly()
}

// Schema implements the Node interface.
func (sq *SubqueryAlias) Schema() sql.Schema {
	childSchema := sq.Child.Schema()
	schema := make(sql.Schema, len(childSchema))
	for i, col := range childSchema {
		c := *col
		c.Source = sq.name
		if len(sq.ColumnNames) > 0 {
			c.Name = sq.ColumnNames[i]
		}
		schema[i] = &c
	}
	return schema
}

// WithChildren implements the Node interface.
func (sq *SubqueryAlias) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(sq, len(children), 1)
	}

	nn := *sq
	nn.Child = children[0]
	return &nn, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (sq *SubqueryAlias) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, sq.Child)
}

func (sq *SubqueryAlias) WithChild(n sql.Node) *SubqueryAlias {
	ret := *sq
	ret.Child = n
	return &ret
}

func (sq *SubqueryAlias) CanCacheResults() bool {
	return sq.Correlated.Empty() && !sq.Volatile
}

func (sq *SubqueryAlias) WithCorrelated(cols sql.ColSet) *SubqueryAlias {
	ret := *sq
	ret.Correlated = cols
	return &ret
}

func (sq *SubqueryAlias) WithVolatile(v bool) *SubqueryAlias {
	ret := *sq
	ret.Volatile = v
	return &ret
}

func (sq *SubqueryAlias) WithScopeMapping(cols map[sql.ColumnId]sql.Expression) *SubqueryAlias {
	ret := *sq
	ret.ScopeMapping = cols
	return &ret
}

// Opaque implements the OpaqueNode interface.
func (sq *SubqueryAlias) Opaque() bool {
	return true
}

func (sq *SubqueryAlias) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("SubqueryAlias")
	children := make([]string, 5)
	children[0] = fmt.Sprintf("name: %s", sq.name)
	children[1] = fmt.Sprintf("outerVisibility: %t", sq.OuterScopeVisibility)
	children[2] = fmt.Sprintf("isLateral: %t", sq.IsLateral)
	children[3] = fmt.Sprintf("cacheable: %t", sq.CanCacheResults())
	children[4] = sq.Child.String()
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (sq *SubqueryAlias) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("SubqueryAlias")
	children := make([]string, 7)
	children[0] = fmt.Sprintf("name: %s", sq.name)
	children[1] = fmt.Sprintf("outerVisibility: %t", sq.OuterScopeVisibility)
	children[2] = fmt.Sprintf("isLateral: %t", sq.IsLateral)
	children[3] = fmt.Sprintf("cacheable: %t", sq.CanCacheResults())
	children[4] = fmt.Sprintf("colSet: %s", sq.Columns())
	children[5] = fmt.Sprintf("tableId: %d", sq.Id())
	children[6] = sql.DebugString(sq.Child)
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (sq *SubqueryAlias) WithColumnNames(columns []string) *SubqueryAlias {
	ret := *sq
	ret.ColumnNames = columns
	return &ret
}
