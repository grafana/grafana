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

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

var ErrDeleteFromNotSupported = errors.NewKind("table doesn't support DELETE FROM")

// DeleteFrom is a node describing a deletion from some table.
type DeleteFrom struct {
	UnaryNode
	// targets contains the table nodes from which rows should be deleted. For simple DELETEs, this contains the single
	// inferred table. For DELETE FROM JOIN, this contains the explicitly specified tables.
	targets []sql.Node
	// hasExplicitTargets indicates whether the targets were explicitly specified in SQL (e.g., "DELETE t1, t2 FROM ...
	// ") vs inferred (e.g., "DELETE FROM table WHERE ...").
	hasExplicitTargets bool
	// Returning is a list of expressions to return after the delete operation. This feature is not
	// supported in MySQL's syntax, but is exposed through PostgreSQL's syntax.
	Returning     []sql.Expression
	RefsSingleRel bool
	IsProcNested  bool
}

var _ sql.Databaseable = (*DeleteFrom)(nil)
var _ sql.Node = (*DeleteFrom)(nil)
var _ sql.CollationCoercible = (*DeleteFrom)(nil)

// NewDeleteFrom creates a DeleteFrom node.
func NewDeleteFrom(n sql.Node, targets []sql.Node, hasExplicitTargets bool) *DeleteFrom {
	return &DeleteFrom{
		UnaryNode:          UnaryNode{n},
		targets:            targets,
		hasExplicitTargets: hasExplicitTargets,
	}
}

// HasExplicitTargets returns true if the target delete tables were explicitly specified in SQL. This can only happen
// with DELETE FROM JOIN statements. For DELETE FROM statements using a single source table, the target is NOT
// explicitly specified and is assumed to be the single source table.
func (p *DeleteFrom) HasExplicitTargets() bool {
	return p.hasExplicitTargets
}

// WithExplicitTargets returns a new DeleteFrom node instance with the specified |targets| set as the explicitly
// specified targets of the delete operation.
func (p *DeleteFrom) WithExplicitTargets(targets []sql.Node) *DeleteFrom {
	copy := *p
	copy.targets = targets
	copy.hasExplicitTargets = true
	return &copy
}

// WithTargets returns a new DeleteFrom node instance with the specified |targets| set, preserving the
// hasExplicitTargets flag. This is used for simple DELETEs where targets need to be updated (e.g., with
// foreign key handlers) without changing whether they were explicitly specified.
func (p *DeleteFrom) WithTargets(targets []sql.Node) *DeleteFrom {
	copy := *p
	copy.targets = targets
	return &copy
}

// GetDeleteTargets returns the sql.Nodes representing the tables from which rows should be deleted.
func (p *DeleteFrom) GetDeleteTargets() []sql.Node {
	return p.targets
}

// Schema implements the sql.Node interface.
func (p *DeleteFrom) Schema() sql.Schema {
	// Postgres allows the returned values of the delete statement to be controlled, so if returning
	// expressions were specified, then we return a different schema.
	if p.Returning != nil {
		// We know that returning exprs are resolved here, because you can't call Schema()
		// safely until Resolved() is true.
		returningSchema := sql.Schema{}
		for _, expr := range p.Returning {
			returningSchema = append(returningSchema, transform.ExpressionToColumn(expr, ""))
		}

		return returningSchema
	}

	return p.Child.Schema()
}

// Resolved implements the sql.Resolvable interface.
func (p *DeleteFrom) Resolved() bool {
	if p.Child.Resolved() == false {
		return false
	}

	for _, target := range p.targets {
		if target.Resolved() == false {
			return false
		}
	}

	for _, expr := range p.Returning {
		if expr.Resolved() == false {
			return false
		}
	}

	return true
}

// Expressions implements the sql.Expressioner interface.
func (p *DeleteFrom) Expressions() []sql.Expression {
	return p.Returning
}

// WithExpressions implements the sql.Expressioner interface.
func (p *DeleteFrom) WithExpressions(newExprs ...sql.Expression) (sql.Node, error) {
	if len(newExprs) != len(p.Returning) {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(newExprs), len(p.Returning))
	}

	copy := *p
	copy.Returning = newExprs
	return &copy, nil
}

func (p *DeleteFrom) IsReadOnly() bool {
	return false
}

// DB returns the database being deleted from. |Database| is used by another interface we implement.
func (p *DeleteFrom) DB() sql.Database {
	return GetDatabase(p.Child)
}

func (p *DeleteFrom) Database() string {
	database := GetDatabase(p.Child)
	if database == nil {
		return ""
	}
	return database.Name()
}

// WithChildren implements the Node interface.
func (p *DeleteFrom) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 1)
	}

	deleteFrom := NewDeleteFrom(children[0], p.targets, p.hasExplicitTargets)
	deleteFrom.Returning = p.Returning
	return deleteFrom, nil
}

func GetDeletable(node sql.Node) (sql.DeletableTable, error) {
	switch node := node.(type) {
	case sql.DeletableTable:
		return node, nil
	case *IndexedTableAccess:
		return GetDeletable(node.TableNode)
	case *ResolvedTable:
		return getDeletableTable(node.Table)
	case *TableAlias:
		return GetDeletable(node.Child)
	case *SubqueryAlias:
		return nil, ErrDeleteFromNotSupported.New()
	case *TriggerExecutor:
		return GetDeletable(node.Left())
	case sql.TableWrapper:
		return getDeletableTable(node.Underlying())
	case *JSONTable:
		return nil, fmt.Errorf("target table %s of the DELETE is not updatable", node.Name())
	}
	if len(node.Children()) > 1 {
		return nil, ErrDeleteFromNotSupported.New()
	}
	for _, child := range node.Children() {
		deleter, _ := GetDeletable(child)
		if deleter != nil {
			return deleter, nil
		}
	}
	return nil, ErrDeleteFromNotSupported.New()
}

func getDeletableTable(t sql.Table) (sql.DeletableTable, error) {
	switch t := t.(type) {
	case sql.DeletableTable:
		return t, nil
	case sql.TableWrapper:
		return getDeletableTable(t.Underlying())
	default:
		return nil, ErrDeleteFromNotSupported.New()
	}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DeleteFrom) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (p *DeleteFrom) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Delete")
	_ = pr.WriteChildren(p.Child.String())
	return pr.String()
}

func (p *DeleteFrom) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Delete")
	_ = pr.WriteChildren(sql.DebugString(p.Child))
	return pr.String()
}
