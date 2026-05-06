// Copyright 2021 Dolthub, Inc.
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
	"github.com/dolthub/go-mysql-server/sql/types"
)

type PKAction byte

const (
	PrimaryKeyAction_Create PKAction = iota
	PrimaryKeyAction_Drop
)

// ErrNotPrimaryKeyAlterable is return when a table cannot be determined to be primary key alterable
var ErrNotPrimaryKeyAlterable = errors.NewKind("error: table is not primary key alterable")

type AlterPK struct {
	ddlNode
	Table        sql.Node
	Catalog      sql.Catalog
	Columns      []sql.IndexColumn
	targetSchema sql.Schema
	Action       PKAction
}

var _ sql.Node = (*AlterPK)(nil)
var _ sql.Databaser = (*AlterPK)(nil)
var _ sql.SchemaTarget = (*AlterPK)(nil)
var _ sql.CollationCoercible = (*AlterPK)(nil)

func NewAlterCreatePk(db sql.Database, table sql.Node, columns []sql.IndexColumn) *AlterPK {
	return &AlterPK{
		Action:  PrimaryKeyAction_Create,
		ddlNode: ddlNode{Db: db},
		Table:   table,
		Columns: columns,
	}
}

func NewAlterDropPk(db sql.Database, table sql.Node) *AlterPK {
	return &AlterPK{
		Action:  PrimaryKeyAction_Drop,
		Table:   table,
		ddlNode: ddlNode{Db: db},
	}
}

func (a *AlterPK) Resolved() bool {
	return a.Table.Resolved() && a.ddlNode.Resolved() && a.targetSchema.Resolved()
}

func (a *AlterPK) IsReadOnly() bool {
	return false
}

func (a *AlterPK) String() string {
	action := "add"
	if a.Action == PrimaryKeyAction_Drop {
		action = "drop"
	}

	return fmt.Sprintf("alter table %s %s primary key", a.Table.String(), action)
}

func (a *AlterPK) Schema() sql.Schema {
	return types.OkResultSchema
}

func (a AlterPK) WithTargetSchema(schema sql.Schema) (sql.Node, error) {
	a.targetSchema = schema
	return &a, nil
}

func (a *AlterPK) TargetSchema() sql.Schema {
	return a.targetSchema
}

func (a *AlterPK) Expressions() []sql.Expression {
	return transform.WrappedColumnDefaults(a.targetSchema)
}

func (a AlterPK) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(a.targetSchema) {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(exprs), len(a.targetSchema))
	}

	sch, err := transform.SchemaWithDefaults(a.targetSchema, exprs[:len(a.targetSchema)])
	if err != nil {
		return nil, err
	}
	a.targetSchema = sch

	return &a, nil
}

func HasPrimaryKeys(table sql.Table) bool {
	for _, c := range table.Schema() {
		if c.PrimaryKey {
			return true
		}
	}

	return false
}

func (a AlterPK) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(children), 1)
	}

	a.Table = children[0]
	return &a, nil
}

// Children implements the sql.Node interface.
func (a *AlterPK) Children() []sql.Node {
	return []sql.Node{a.Table}
}

// WithDatabase implements the sql.Databaser interface.
func (a AlterPK) WithDatabase(database sql.Database) (sql.Node, error) {
	a.Db = database
	return &a, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*AlterPK) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
