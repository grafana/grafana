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
	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ShowColumns shows the columns details of a table.
type ShowColumns struct {
	UnaryNode
	Indexes      []sql.Index
	targetSchema sql.Schema
	Full         bool
}

var VarChar25000 = types.MustCreateStringWithDefaults(sqltypes.VarChar, 25_000)
var (
	showColumnsSchema = sql.Schema{
		{Name: "Field", Type: VarChar25000},
		{Name: "Type", Type: VarChar25000},
		{Name: "Null", Type: VarChar25000},
		{Name: "Key", Type: VarChar25000},
		{Name: "Default", Type: VarChar25000, Nullable: true},
		{Name: "Extra", Type: VarChar25000},
	}

	showColumnsFullSchema = sql.Schema{
		{Name: "Field", Type: VarChar25000},
		{Name: "Type", Type: VarChar25000},
		{Name: "Collation", Type: VarChar25000, Nullable: true},
		{Name: "Null", Type: VarChar25000},
		{Name: "Key", Type: VarChar25000},
		{Name: "Default", Type: VarChar25000, Nullable: true},
		{Name: "Extra", Type: VarChar25000},
		{Name: "Privileges", Type: VarChar25000},
		{Name: "Comment", Type: VarChar25000},
	}
)

// NewShowColumns creates a new ShowColumns node.
func NewShowColumns(full bool, child sql.Node) *ShowColumns {
	return &ShowColumns{UnaryNode: UnaryNode{Child: child}, Full: full}
}

var _ sql.Node = (*ShowColumns)(nil)
var _ sql.Expressioner = (*ShowColumns)(nil)
var _ sql.SchemaTarget = (*ShowColumns)(nil)
var _ sql.CollationCoercible = (*ShowColumns)(nil)

// Schema implements the sql.Node interface.
func (s *ShowColumns) Schema() sql.Schema {
	if s.Full {
		return showColumnsFullSchema
	}
	return showColumnsSchema
}

// Resolved implements the sql.Node interface.
func (s *ShowColumns) Resolved() bool {
	return s.Child.Resolved() && s.targetSchema.Resolved()
}

func (s *ShowColumns) IsReadOnly() bool {
	return true
}

func (s *ShowColumns) Expressions() []sql.Expression {
	if len(s.targetSchema) == 0 {
		return nil
	}

	return transform.WrappedColumnDefaults(s.targetSchema)
}

func (s ShowColumns) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(s.targetSchema) {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(exprs), len(s.targetSchema))
	}

	sch, err := transform.SchemaWithDefaults(s.targetSchema, exprs)
	if err != nil {
		return nil, err
	}

	s.targetSchema = sch
	return &s, nil
}

func (s *ShowColumns) WithTargetSchema(schema sql.Schema) (sql.Node, error) {
	ss := *s
	ss.targetSchema = schema
	return &ss, nil
}

func (s *ShowColumns) TargetSchema() sql.Schema {
	return s.targetSchema
}

// WithChildren implements the Node interface.
func (s *ShowColumns) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}

	ss := *s
	ss.Child = children[0]
	return &ss, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowColumns) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (s *ShowColumns) String() string {
	tp := sql.NewTreePrinter()
	if s.Full {
		_ = tp.WriteNode("ShowColumns(full)")
	} else {
		_ = tp.WriteNode("ShowColumns")
	}
	_ = tp.WriteChildren(s.Child.String())
	return tp.String()
}

func (s *ShowColumns) DebugString() string {
	tp := sql.NewTreePrinter()
	if s.Full {
		_ = tp.WriteNode("ShowColumns(full)")
	} else {
		_ = tp.WriteNode("ShowColumns")
	}

	var children []string
	for _, col := range s.targetSchema {
		children = append(children, sql.DebugString(col))
	}

	children = append(children, sql.DebugString(s.Child))

	_ = tp.WriteChildren(children...)
	return tp.String()
}

// GetColumnFromIndexExpr returns column from the table given using the expression string given, in the form
// "table.column". Returns nil if the expression doesn't represent a column.
func GetColumnFromIndexExpr(expr string, table sql.Table) *sql.Column {
	for _, col := range table.Schema() {
		if col.Source+"."+col.Name == expr {
			return col
		}
	}

	return nil
}
