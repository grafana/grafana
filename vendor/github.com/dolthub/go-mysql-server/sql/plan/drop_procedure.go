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
	"strings"

	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

type DropProcedure struct {
	Db            sql.Database
	ProcedureName string
	IfExists      bool
}

var _ sql.Databaser = (*DropProcedure)(nil)
var _ sql.Node = (*DropProcedure)(nil)
var _ sql.CollationCoercible = (*DropProcedure)(nil)

// NewDropProcedure creates a new *DropProcedure node.
func NewDropProcedure(db sql.Database, procedureName string, ifExists bool) *DropProcedure {
	return &DropProcedure{
		Db:            db,
		IfExists:      ifExists,
		ProcedureName: strings.ToLower(procedureName),
	}
}

// Resolved implements the sql.Node interface.
func (d *DropProcedure) Resolved() bool {
	_, ok := d.Db.(sql.UnresolvedDatabase)
	return !ok
}

func (d *DropProcedure) IsReadOnly() bool {
	return false
}

// String implements the sql.Node interface.
func (d *DropProcedure) String() string {
	ifExists := ""
	if d.IfExists {
		ifExists = "IF EXISTS "
	}
	return fmt.Sprintf("DROP PROCEDURE %s%s", ifExists, d.ProcedureName)
}

// Schema implements the sql.Node interface.
func (d *DropProcedure) Schema() sql.Schema {
	return types.OkResultSchema
}

// Children implements the sql.Node interface.
func (d *DropProcedure) Children() []sql.Node {
	return nil
}

// WithChildren implements the sql.Node interface.
func (d *DropProcedure) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(d, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DropProcedure) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Database implements the sql.Databaser interface.
func (d *DropProcedure) Database() sql.Database {
	return d.Db
}

// WithDatabase implements the sql.Databaser interface.
func (d *DropProcedure) WithDatabase(db sql.Database) (sql.Node, error) {
	nd := *d
	nd.Db = db
	return &nd, nil
}
