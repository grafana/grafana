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

type AlterAutoIncrement struct {
	ddlNode
	Table   sql.Node
	AutoVal uint64
}

var _ sql.Node = (*AlterAutoIncrement)(nil)
var _ sql.CollationCoercible = (*AlterAutoIncrement)(nil)

func NewAlterAutoIncrement(database sql.Database, table sql.Node, autoVal uint64) *AlterAutoIncrement {
	return &AlterAutoIncrement{
		ddlNode: ddlNode{Db: database},
		Table:   table,
		AutoVal: autoVal,
	}
}

// WithChildren implements the Node interface.
func (p *AlterAutoIncrement) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 1)
	}
	return NewAlterAutoIncrement(p.Database(), children[0], p.AutoVal), nil
}

// Children implements the sql.Node interface.
func (p *AlterAutoIncrement) Children() []sql.Node {
	return []sql.Node{p.Table}
}

// Resolved implements the sql.Node interface.
func (p *AlterAutoIncrement) Resolved() bool {
	return p.ddlNode.Resolved() && p.Table.Resolved()
}

func (p *AlterAutoIncrement) IsReadOnly() bool {
	return false
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (p *AlterAutoIncrement) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (p *AlterAutoIncrement) Schema() sql.Schema { return nil }

func (p AlterAutoIncrement) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("AlterAutoIncrement(%d)", p.AutoVal)
	_ = pr.WriteChildren(fmt.Sprintf("Table(%s)", p.Table.String()))
	return pr.String()
}

// WithDatabase implements the sql.Databaser interface.
func (p *AlterAutoIncrement) WithDatabase(db sql.Database) (sql.Node, error) {
	nd := *p
	nd.Db = db
	return &nd, nil
}
