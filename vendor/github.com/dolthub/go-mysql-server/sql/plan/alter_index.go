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

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var (
	// ErrIndexActionNotImplemented is returned when the action has not been implemented
	ErrIndexActionNotImplemented = errors.NewKind("alter table index action is not implemented: %v")
	// ErrCreateIndexMissingColumns is returned when a CREATE INDEX statement does not provide any columns
	ErrCreateIndexMissingColumns = errors.NewKind("cannot create an index without columns")
)

type IndexAction byte

const (
	IndexAction_Create IndexAction = iota
	IndexAction_Drop
	IndexAction_Rename
	IndexAction_DisableEnableKeys
)

type AlterIndex struct {
	// ddlNode references to the database that is being operated on
	Db sql.Database
	// Table is the table that is being referenced
	Table sql.TableNode

	// IndexName is the index name, and in the case of a RENAME it represents the new name
	IndexName string
	// PreviousIndexName states the old name when renaming an index
	PreviousIndexName string
	// Comment is the comment that was left at index creation, if any
	Comment string

	// TargetSchema Analyzer state.
	targetSchema sql.Schema
	// Columns contains the column names (and possibly lengths) when creating an index
	Columns []sql.IndexColumn
	// TODO: This should just use sql.IndexDef
	// Using states whether you're using BTREE, HASH, or non
	Using sql.IndexUsing
	// Constraint specifies whether this is UNIQUE, FULLTEXT, SPATIAL, or none
	Constraint sql.IndexConstraint

	// Action states whether it's a CREATE, DROP, or RENAME
	Action IndexAction
	// IfExists indicates if we should error when deleting an index that doesn't exist
	IfExists bool
	// IfNotExists indicates if we should error when creating a duplicate index
	IfNotExists bool
	// DisableKeys determines whether to DISABLE KEYS if true or ENABLE KEYS if false
	DisableKeys bool
}

var _ sql.SchemaTarget = (*AlterIndex)(nil)
var _ sql.Expressioner = (*AlterIndex)(nil)
var _ sql.Node = (*AlterIndex)(nil)
var _ sql.CollationCoercible = (*AlterIndex)(nil)

func NewAlterCreateIndex(db sql.Database, table sql.TableNode, ifNotExists bool, indexName string, using sql.IndexUsing, constraint sql.IndexConstraint, columns []sql.IndexColumn, comment string) *AlterIndex {
	return &AlterIndex{
		Action:      IndexAction_Create,
		Db:          db,
		Table:       table,
		IfNotExists: ifNotExists,
		IndexName:   indexName,
		Using:       using,
		Constraint:  constraint,
		Columns:     columns,
		Comment:     comment,
	}
}

func NewAlterDropIndex(db sql.Database, table sql.TableNode, ifExists bool, indexName string) *AlterIndex {
	return &AlterIndex{
		Action:    IndexAction_Drop,
		Db:        db,
		Table:     table,
		IfExists:  ifExists,
		IndexName: indexName,
	}
}

func NewAlterRenameIndex(db sql.Database, table sql.TableNode, fromIndexName, toIndexName string) *AlterIndex {
	return &AlterIndex{
		Action:            IndexAction_Rename,
		Db:                db,
		Table:             table,
		IndexName:         toIndexName,
		PreviousIndexName: fromIndexName,
	}
}

func NewAlterDisableEnableKeys(db sql.Database, table sql.TableNode, disableKeys bool) *AlterIndex {
	return &AlterIndex{
		Action:      IndexAction_DisableEnableKeys,
		Db:          db,
		Table:       table,
		DisableKeys: disableKeys,
	}
}

// Schema implements the Node interface.
func (p *AlterIndex) Schema() sql.Schema {
	return types.OkResultSchema
}

// WithChildren implements the Node interface. For AlterIndex, the only appropriate input is
// a single child - The Table.
func (p *AlterIndex) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 1)
	}

	child, ok := children[0].(sql.TableNode)
	if !ok {
		return nil, fmt.Errorf("AlterIndex.WithChildren requires a TableNode")
	}
	switch p.Action {
	case IndexAction_Create, IndexAction_Drop, IndexAction_Rename, IndexAction_DisableEnableKeys:
		np := *p
		np.Table = child
		return &np, nil
	default:
		return nil, ErrIndexActionNotImplemented.New(p.Action)
	}
}

func (p *AlterIndex) WithColumns(columns []sql.IndexColumn) (sql.Node, error) {
	np := *p
	np.Columns = columns
	return &np, nil
}

func (p *AlterIndex) WithTargetSchema(schema sql.Schema) (sql.Node, error) {
	np := *p
	np.targetSchema = schema
	return &np, nil
}

func (p *AlterIndex) TargetSchema() sql.Schema {
	return p.targetSchema
}

// Expressions on the AlterIndex object are specifically column default expresions, Nothing else.
func (p *AlterIndex) Expressions() []sql.Expression {
	newExprs := make([]sql.Expression, len(p.TargetSchema()))
	for i, col := range p.TargetSchema() {
		newExprs[i] = expression.WrapExpression(col.Default)
	}

	return newExprs
}

// WithExpressions implements the Node Interface. For AlterIndex, expressions represent  column defaults on the
// targetSchema instance - required to be the same number of columns on the target schema.
func (p *AlterIndex) WithExpressions(expressions ...sql.Expression) (sql.Node, error) {
	columns := p.TargetSchema().Copy()

	if len(columns) != len(expressions) {
		return nil, fmt.Errorf("invariant failure: column count does not match expression count")
	}

	for i, expr := range expressions {
		wrapper, ok := expr.(*expression.Wrapper)
		if !ok {
			return nil, fmt.Errorf("*expression.Wrapper cast failure unexpected: %v", expr)
		}

		wrapped := wrapper.Unwrap()
		if wrapped == nil {
			continue // No default for this column
		}

		newColDef, ok := wrapped.(*sql.ColumnDefaultValue)
		if !ok {
			return nil, fmt.Errorf("*sql.ColumnDefaultValue cast failure unexptected: %v", wrapped)
		}

		columns[i].Default = newColDef
	}

	newIdx, err := p.WithTargetSchema(columns)
	if err != nil {
		return nil, err
	}
	return newIdx, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*AlterIndex) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// WithDatabase implements the sql.Databaser interface.
func (p *AlterIndex) WithDatabase(database sql.Database) (sql.Node, error) {
	np := *p
	np.Db = database
	return &np, nil
}

func (p *AlterIndex) String() string {
	pr := sql.NewTreePrinter()
	switch p.Action {
	case IndexAction_Create:
		_ = pr.WriteNode("CreateIndex(%s)", p.IndexName)
		children := []string{fmt.Sprintf("Table(%s)", p.Table.String())}
		switch p.Constraint {
		case sql.IndexConstraint_Unique:
			children = append(children, "Constraint(UNIQUE)")
		case sql.IndexConstraint_Spatial:
			children = append(children, "Constraint(SPATIAL)")
		case sql.IndexConstraint_Fulltext:
			children = append(children, "Constraint(FULLTEXT)")
		case sql.IndexConstraint_Vector:
			children = append(children, "Constraint(VECTOR)")
		}
		switch p.Using {
		case sql.IndexUsing_BTree, sql.IndexUsing_Default:
			children = append(children, "Using(BTREE)")
		case sql.IndexUsing_Hash:
			children = append(children, "Using(HASH)")
		}
		cols := make([]string, len(p.Columns))
		for i, col := range p.Columns {
			if col.Length == 0 {
				cols[i] = col.Name
			} else {
				cols[i] = fmt.Sprintf("%s(%v)", col.Name, col.Length)
			}
		}
		children = append(children, fmt.Sprintf("Columns(%s)", strings.Join(cols, ", ")))
		children = append(children, fmt.Sprintf("Comment(%s)", p.Comment))
		_ = pr.WriteChildren(children...)
	case IndexAction_Drop:
		_ = pr.WriteNode("DropIndex(%s)", p.IndexName)
		_ = pr.WriteChildren(fmt.Sprintf("Table(%s)", p.Table.String()))
	case IndexAction_Rename:
		_ = pr.WriteNode("RenameIndex")
		_ = pr.WriteChildren(
			fmt.Sprintf("Table(%s)", p.Table.String()),
			fmt.Sprintf("FromIndex(%s)", p.PreviousIndexName),
			fmt.Sprintf("ToIndex(%s)", p.IndexName),
		)
	default:
		_ = pr.WriteNode("Unknown_Index_Action(%v)", p.Action)
	}
	return pr.String()
}

func (p *AlterIndex) Resolved() bool {
	return p.Table.Resolved() && p.targetSchema.Resolved()
}

func (p *AlterIndex) IsReadOnly() bool {
	return false
}

// Children implements the sql.Node interface.
func (p *AlterIndex) Children() []sql.Node {
	return []sql.Node{p.Table}
}

// ColumnNames returns each column's name without the length property.
func (p *AlterIndex) ColumnNames() []string {
	colNames := make([]string, len(p.Columns))
	for i, col := range p.Columns {
		colNames[i] = col.Name
	}
	return colNames
}
