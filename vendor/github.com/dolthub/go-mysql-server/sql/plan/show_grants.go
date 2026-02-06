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

	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

// ShowGrants represents the statement SHOW GRANTS.
type ShowGrants struct {
	MySQLDb     sql.Database
	For         *UserName
	Using       []UserName
	CurrentUser bool
}

var _ sql.Node = (*ShowGrants)(nil)
var _ sql.Databaser = (*ShowGrants)(nil)
var _ sql.CollationCoercible = (*ShowGrants)(nil)

// Schema implements the interface sql.Node.
func (n *ShowGrants) Schema() sql.Schema {
	user := n.For
	if user == nil {
		user = &UserName{
			Name:    "root",
			Host:    "localhost",
			AnyHost: true,
		}
	}
	return sql.Schema{{
		Name: fmt.Sprintf("Grants for %s", user.String("")),
		Type: types.LongText,
	}}
}

func (n *ShowGrants) IsReadOnly() bool {
	return true
}

// String implements the interface sql.Node.
func (n *ShowGrants) String() string {
	user := n.For
	if user == nil {
		user = &UserName{
			Name:    "root",
			Host:    "localhost",
			AnyHost: true,
		}
	}
	return fmt.Sprintf("ShowGrants(%s)", user.String(""))
}

// Database implements the interface sql.Databaser.
func (n *ShowGrants) Database() sql.Database {
	return n.MySQLDb
}

// WithDatabase implements the interface sql.Databaser.
func (n *ShowGrants) WithDatabase(db sql.Database) (sql.Node, error) {
	nn := *n
	nn.MySQLDb = db
	return &nn, nil
}

// Resolved implements the interface sql.Node.
func (n *ShowGrants) Resolved() bool {
	_, ok := n.MySQLDb.(sql.UnresolvedDatabase)
	return !ok
}

// Children implements the interface sql.Node.
func (n *ShowGrants) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (n *ShowGrants) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}
	return n, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowGrants) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
