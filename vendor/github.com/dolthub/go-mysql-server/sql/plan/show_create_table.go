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
	"github.com/dolthub/go-mysql-server/sql/types"
)

var ErrNotView = errors.NewKind("'%' is not VIEW")

// ShowCreateTable is a node that shows the CREATE TABLE statement for a table.
type ShowCreateTable struct {
	asOf sql.Expression
	*UnaryNode
	PrimaryKeySchema sql.PrimaryKeySchema
	Indexes          []sql.Index
	checks           sql.CheckConstraints
	targetSchema     sql.Schema
	IsView           bool
}

var _ sql.Node = (*ShowCreateTable)(nil)
var _ sql.Expressioner = (*ShowCreateTable)(nil)
var _ sql.SchemaTarget = (*ShowCreateTable)(nil)
var _ sql.CheckConstraintNode = (*ShowCreateTable)(nil)
var _ sql.CollationCoercible = (*ShowCreateTable)(nil)
var _ Versionable = (*ShowCreateTable)(nil)

// NewShowCreateTable creates a new ShowCreateTable node.
func NewShowCreateTable(table sql.Node, isView bool) *ShowCreateTable {
	return NewShowCreateTableWithAsOf(table, isView, nil)
}

// NewShowCreateTableWithAsOf creates a new ShowCreateTable node for a specific version of a table.
func NewShowCreateTableWithAsOf(table sql.Node, isView bool, asOf sql.Expression) *ShowCreateTable {
	return &ShowCreateTable{
		UnaryNode: &UnaryNode{table},
		IsView:    isView,
		asOf:      asOf,
	}
}

func (sc *ShowCreateTable) Checks() sql.CheckConstraints {
	return sc.checks
}

func (sc *ShowCreateTable) WithChecks(checks sql.CheckConstraints) sql.Node {
	ret := *sc
	ret.checks = checks
	return &ret
}

// Resolved implements the Resolvable interface.
func (sc *ShowCreateTable) Resolved() bool {
	return sc.Child.Resolved() && sc.targetSchema.Resolved()
}

func (sc *ShowCreateTable) IsReadOnly() bool {
	return true
}

func (sc ShowCreateTable) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(1, len(children))
	}
	child := children[0]

	switch child.(type) {
	case *SubqueryAlias, *ResolvedTable, sql.UnresolvedTable:
	default:
		return nil, sql.ErrInvalidChildType.New(sc, child, (*SubqueryAlias)(nil))
	}

	sc.Child = child
	return &sc, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowCreateTable) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (sc ShowCreateTable) WithTargetSchema(schema sql.Schema) (sql.Node, error) {
	sc.targetSchema = schema
	return &sc, nil
}

func (sc *ShowCreateTable) TargetSchema() sql.Schema {
	return sc.targetSchema
}

func (sc ShowCreateTable) WithPrimaryKeySchema(schema sql.PrimaryKeySchema) (sql.Node, error) {
	sc.PrimaryKeySchema = schema
	return &sc, nil
}

func (sc *ShowCreateTable) Expressions() []sql.Expression {
	return transform.WrappedColumnDefaults(sc.targetSchema)
}

func (sc ShowCreateTable) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(sc.targetSchema) {
		return nil, sql.ErrInvalidChildrenNumber.New(sc, len(exprs), len(sc.targetSchema))
	}

	sch, err := transform.SchemaWithDefaults(sc.targetSchema, exprs)
	if err != nil {
		return nil, err
	}

	sc.targetSchema = sch
	return &sc, nil
}

// Schema implements the Node interface.
func (sc *ShowCreateTable) Schema() sql.Schema {
	switch sc.Child.(type) {
	case *SubqueryAlias:
		return sql.Schema{
			&sql.Column{Name: "View", Type: types.LongText, Nullable: false},
			&sql.Column{Name: "Create View", Type: types.LongText, Nullable: false},
			&sql.Column{Name: "character_set_client", Type: types.LongText, Nullable: false},
			&sql.Column{Name: "collation_connection", Type: types.LongText, Nullable: false},
		}
	case *ResolvedTable, sql.UnresolvedTable:
		return sql.Schema{
			&sql.Column{Name: "Table", Type: types.LongText, Nullable: false},
			&sql.Column{Name: "Create Table", Type: types.LongText, Nullable: false},
		}
	default:
		panic(fmt.Sprintf("unexpected type %T", sc.Child))
	}
}

// GetTargetSchema returns the final resolved target schema of show create table.
func (sc *ShowCreateTable) GetTargetSchema() sql.Schema {
	return sc.targetSchema
}

// WithAsOf implements the Versionable interface.
func (sc *ShowCreateTable) WithAsOf(asOf sql.Expression) (sql.Node, error) {
	nsc := *sc
	nsc.asOf = asOf
	return &nsc, nil
}

// AsOf implements the Versionable interface.
func (sc *ShowCreateTable) AsOf() sql.Expression {
	return sc.asOf
}

// String implements the fmt.Stringer interface.
func (sc *ShowCreateTable) String() string {
	t := "TABLE"
	if sc.IsView {
		t = "VIEW"
	}

	name := ""
	if nameable, ok := sc.Child.(sql.Nameable); ok {
		name = nameable.Name()
	}

	asOfClause := ""
	if sc.asOf != nil {
		asOfClause = fmt.Sprintf("as of %v", sc.asOf)
	}

	return fmt.Sprintf("SHOW CREATE %s %s %s", t, name, asOfClause)
}
