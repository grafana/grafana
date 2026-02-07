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
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
)

// Use changes the current database.
type Use struct {
	db      sql.Database
	Catalog sql.Catalog
}

// NewUse creates a new Use node.
func NewUse(db sql.Database) *Use {
	return &Use{db: db}
}

var _ sql.Node = (*Use)(nil)
var _ sql.Databaser = (*Use)(nil)
var _ sql.CollationCoercible = (*Use)(nil)

// Database implements the sql.Databaser interface.
func (u *Use) Database() sql.Database {
	return u.db
}

// WithDatabase implements the sql.Databaser interface.
func (u *Use) WithDatabase(db sql.Database) (sql.Node, error) {
	nc := *u
	nc.db = db
	return &nc, nil
}

// Children implements the sql.Node interface.
func (Use) Children() []sql.Node { return nil }

// Resolved implements the sql.Node interface.
func (u *Use) Resolved() bool {
	_, ok := u.db.(sql.UnresolvedDatabase)
	return !ok
}

func (u *Use) IsReadOnly() bool {
	return true
}

// Schema implements the sql.Node interface.
func (Use) Schema() sql.Schema { return nil }

// RowIter implements the sql.Node interface.
func (u *Use) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	// We want to return to the session interface the same database instance they gave us, unwrap it if necessary
	db := u.db
	if pdb, ok := db.(mysql_db.PrivilegedDatabase); ok {
		db = pdb.Unwrap()
	}

	err := ctx.Session.UseDatabase(ctx, db)
	if err != nil {
		return nil, err
	}

	ctx.SetCurrentDatabase(u.db.Name())
	return sql.RowsToRowIter(), nil
}

// WithChildren implements the Node interface.
func (u *Use) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(u, len(children), 1)
	}

	return u, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Use) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// String implements the sql.Node interface.
func (u *Use) String() string {
	return fmt.Sprintf("USE(%s)", u.db.Name())
}
