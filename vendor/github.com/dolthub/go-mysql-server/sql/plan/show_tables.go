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

	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// ShowTables is a node that shows the database tables.
type ShowTables struct {
	db   sql.Database
	asOf sql.Expression
	Full bool
}

// NewShowTables creates a new show tables node given a database.
func NewShowTables(database sql.Database, full bool, asOf sql.Expression) *ShowTables {
	return &ShowTables{
		db:   database,
		Full: full,
		asOf: asOf,
	}
}

var _ sql.Databaser = (*ShowTables)(nil)
var _ sql.Expressioner = (*ShowTables)(nil)
var _ sql.CollationCoercible = (*ShowTables)(nil)
var _ Versionable = (*ShowTables)(nil)

// Database implements the sql.Databaser interface.
func (p *ShowTables) Database() sql.Database {
	return p.db
}

func (p *ShowTables) IsReadOnly() bool {
	return true
}

// WithDatabase implements the sql.Databaser interface.
func (p *ShowTables) WithDatabase(db sql.Database) (sql.Node, error) {
	nc := *p
	nc.db = db
	return &nc, nil
}

// Resolved implements the Resolvable interface.
func (p *ShowTables) Resolved() bool {
	_, ok := p.db.(sql.UnresolvedDatabase)
	return !ok && expression.ExpressionsResolved(p.Expressions()...)
}

// Children implements the Node interface.
func (*ShowTables) Children() []sql.Node {
	return nil
}

// Schema implements the Node interface.
func (p *ShowTables) Schema() sql.Schema {
	var sch sql.Schema
	colName := fmt.Sprintf("Tables_in_%s", p.Database().Name())
	sch = sql.Schema{
		{Name: colName, Type: types.LongText},
	}
	if p.Full {
		sch = append(sch, &sql.Column{Name: "Table_type", Type: types.LongText})
	}
	return sch
}

// WithAsOf implements the Versionable interface.
func (p *ShowTables) WithAsOf(asOf sql.Expression) (sql.Node, error) {
	np := *p
	np.asOf = asOf
	return &np, nil
}

// AsOf implements the Versionable interface.
func (p *ShowTables) AsOf() sql.Expression {
	return p.asOf
}

// WithChildren implements the Node interface.
func (p *ShowTables) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 0)
	}

	return p, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowTables) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (p ShowTables) String() string {
	return "ShowTables"
}

// Expressions implements sql.Expressioner
func (p *ShowTables) Expressions() []sql.Expression {
	if p.asOf == nil {
		return nil
	}
	return []sql.Expression{p.asOf}
}

// WithExpressions implements sql.Expressioner
func (p *ShowTables) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(exprs), 1)
	}

	np := *p
	np.asOf = exprs[0]
	return &np, nil
}
