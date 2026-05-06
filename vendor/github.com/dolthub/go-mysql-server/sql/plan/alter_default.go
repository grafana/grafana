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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// AlterDefaultSet represents the ALTER COLUMN SET DEFAULT statement.
type AlterDefaultSet struct {
	ddlNode
	Table        sql.Node
	ColumnName   string
	Default      *sql.ColumnDefaultValue
	targetSchema sql.Schema
}

var _ sql.Node = (*AlterDefaultSet)(nil)
var _ sql.Expressioner = (*AlterDefaultSet)(nil)
var _ sql.SchemaTarget = (*AlterDefaultSet)(nil)
var _ sql.CollationCoercible = (*AlterDefaultSet)(nil)

// AlterDefaultDrop represents the ALTER COLUMN DROP DEFAULT statement.
type AlterDefaultDrop struct {
	ddlNode
	Table        sql.Node
	ColumnName   string
	targetSchema sql.Schema
}

var _ sql.Node = (*AlterDefaultDrop)(nil)
var _ sql.SchemaTarget = (*AlterDefaultDrop)(nil)
var _ sql.CollationCoercible = (*AlterDefaultDrop)(nil)

// NewAlterDefaultSet returns a *AlterDefaultSet node.
func NewAlterDefaultSet(database sql.Database, table sql.Node, columnName string, defVal *sql.ColumnDefaultValue) *AlterDefaultSet {
	return &AlterDefaultSet{
		ddlNode:    ddlNode{Db: database},
		Table:      table,
		ColumnName: columnName,
		Default:    defVal,
	}
}

// String implements the sql.Node interface.
func (d *AlterDefaultSet) String() string {
	return fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s SET DEFAULT %s", d.Table.String(), d.ColumnName, d.Default.String())
}

func (d *AlterDefaultSet) IsReadOnly() bool {
	return false
}

// Resolved implements the sql.Node interface.
func (d *AlterDefaultDrop) Resolved() bool {
	return d.ddlNode.Resolved() && d.Table.Resolved() && d.targetSchema.Resolved()
}

func (d *AlterDefaultDrop) IsReadOnly() bool {
	return false
}

// WithChildren implements the sql.Node interface.
func (d *AlterDefaultSet) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}
	ret := *d
	ret.Table = children[0]
	return &ret, nil
}

// Children implements the sql.Node interface.
func (d *AlterDefaultSet) Children() []sql.Node {
	return []sql.Node{d.Table}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (d *AlterDefaultSet) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Resolved implements the sql.Node interface.
func (d *AlterDefaultSet) Resolved() bool {
	return d.ddlNode.Resolved() && d.Table.Resolved() && d.Default.Resolved() && d.targetSchema.Resolved()
}

func (d *AlterDefaultSet) Expressions() []sql.Expression {
	return append(transform.WrappedColumnDefaults(d.targetSchema), expression.WrapExpressions(d.Default)...)
}

func (d *AlterDefaultSet) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1+len(d.targetSchema) {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(exprs), 1+len(d.targetSchema))
	}

	nd := *d
	sch, err := transform.SchemaWithDefaults(nd.targetSchema, exprs[:len(nd.targetSchema)])
	if err != nil {
		return nil, err
	}
	nd.targetSchema = sch
	unwrappedColDefVal, ok := exprs[len(exprs)-1].(*expression.Wrapper).Unwrap().(*sql.ColumnDefaultValue)
	if ok {
		nd.Default = unwrappedColDefVal
	} else { // nil fails type check
		nd.Default = nil
	}
	return &nd, nil
}

func (d *AlterDefaultSet) WithTargetSchema(schema sql.Schema) (sql.Node, error) {
	nd := *d
	nd.targetSchema = schema
	return &nd, nil
}

func (d *AlterDefaultSet) TargetSchema() sql.Schema {
	return d.targetSchema
}

func (d *AlterDefaultSet) WithDatabase(database sql.Database) (sql.Node, error) {
	na := *d
	na.Db = database
	return &na, nil
}

func (d *AlterDefaultSet) WithDefault(expr sql.Expression) (sql.Node, error) {
	nd := *d
	var newDefault *sql.ColumnDefaultValue
	if wrap, ok := expr.(*expression.Wrapper); ok {
		newDefault = wrap.Unwrap().(*sql.ColumnDefaultValue)
	} else {
		newDefault = expr.(*sql.ColumnDefaultValue)
	}
	nd.Default = newDefault
	return &nd, nil
}

// NewAlterDefaultDrop returns a *AlterDefaultDrop node.
func NewAlterDefaultDrop(database sql.Database, table sql.Node, columnName string) *AlterDefaultDrop {
	return &AlterDefaultDrop{
		ddlNode:    ddlNode{Db: database},
		Table:      table,
		ColumnName: columnName,
	}
}

// String implements the sql.Node interface.
func (d *AlterDefaultDrop) String() string {
	return fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s DROP DEFAULT", getTableName(d.Table), d.ColumnName)
}

// WithChildren implements the sql.Node interface.
func (d *AlterDefaultDrop) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}
	ret := *d
	ret.Table = children[0]
	return &ret, nil
}

// Children implements the sql.Node interface.
func (d *AlterDefaultDrop) Children() []sql.Node {
	return []sql.Node{d.Table}
}

func (d *AlterDefaultDrop) WithTargetSchema(schema sql.Schema) (sql.Node, error) {
	nd := *d
	nd.targetSchema = schema
	return &nd, nil
}

func (d *AlterDefaultDrop) TargetSchema() sql.Schema {
	return d.targetSchema
}

func (d *AlterDefaultDrop) Expressions() []sql.Expression {
	return transform.WrappedColumnDefaults(d.targetSchema)
}

func (d *AlterDefaultDrop) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(d.targetSchema) {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(exprs), len(d.targetSchema))
	}
	nd := *d
	sch, err := transform.SchemaWithDefaults(nd.targetSchema, exprs[:len(nd.targetSchema)])
	if err != nil {
		return nil, err
	}
	nd.targetSchema = sch
	return &nd, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (d *AlterDefaultDrop) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// WithDatabase implements the sql.Databaser interface.
func (d *AlterDefaultDrop) WithDatabase(db sql.Database) (sql.Node, error) {
	nd := *d
	nd.Db = db
	return &nd, nil
}

// getTableFromDatabase returns the related sql.Table from a database in the case of a sql.Databasw
func getTableFromDatabase(ctx *sql.Context, db sql.Database, tableNode sql.Node) (sql.Table, error) {
	// Grab the table fresh from the database.
	tableName := getTableName(tableNode)

	table, ok, err := db.GetTableInsensitive(ctx, tableName)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, sql.ErrTableNotFound.New(tableName)
	}

	return table, nil
}
