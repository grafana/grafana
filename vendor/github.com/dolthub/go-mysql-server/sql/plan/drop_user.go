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

	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

// DropUser represents the statement DROP USER.
type DropUser struct {
	MySQLDb  sql.Database
	Users    []UserName
	IfExists bool
}

var _ sql.Node = (*DropUser)(nil)
var _ sql.Databaser = (*DropUser)(nil)
var _ sql.CollationCoercible = (*DropUser)(nil)

// NewDropUser returns a new DropUser node.
func NewDropUser(ifExists bool, users []UserName) *DropUser {
	return &DropUser{
		IfExists: ifExists,
		Users:    users,
		MySQLDb:  sql.UnresolvedDatabase("mysql"),
	}
}

// Schema implements the interface sql.Node.
func (n *DropUser) Schema() sql.Schema {
	return types.OkResultSchema
}

// String implements the interface sql.Node.
func (n *DropUser) String() string {
	users := make([]string, len(n.Users))
	for i, user := range n.Users {
		users[i] = user.String("")
	}
	ifExists := ""
	if n.IfExists {
		ifExists = "IfExists: "
	}
	return fmt.Sprintf("DropUser(%s%s)", ifExists, strings.Join(users, ", "))
}

// Database implements the interface sql.Databaser.
func (n *DropUser) Database() sql.Database {
	return n.MySQLDb
}

// WithDatabase implements the interface sql.Databaser.
func (n *DropUser) WithDatabase(db sql.Database) (sql.Node, error) {
	nn := *n
	nn.MySQLDb = db
	return &nn, nil
}

// Resolved implements the interface sql.Node.
func (n *DropUser) Resolved() bool {
	_, ok := n.MySQLDb.(sql.UnresolvedDatabase)
	return !ok
}

func (n *DropUser) IsReadOnly() bool {
	return false
}

// Children implements the interface sql.Node.
func (n *DropUser) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (n *DropUser) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}
	return n, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DropUser) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// RowIter implements the interface sql.Node.
func (n *DropUser) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	mysqlDb, ok := n.MySQLDb.(*mysql_db.MySQLDb)
	if !ok {
		return nil, sql.ErrDatabaseNotFound.New("mysql")
	}
	editor := mysqlDb.Editor()
	defer editor.Close()
	for _, user := range n.Users {
		existingUser := mysqlDb.GetUser(editor, user.Name, user.Host, false)
		if existingUser == nil {
			if n.IfExists {
				continue
			}
			return nil, sql.ErrUserDeletionFailure.New(user.String("'"))
		}

		//TODO: if a user is mentioned in the "mandatory_roles" (users and roles are interchangeable) system variable then they cannot be dropped
		editor.RemoveUser(mysql_db.UserPrimaryKey{
			Host: existingUser.Host,
			User: existingUser.User,
		})
		editor.RemoveRoleEdgesFromKey(mysql_db.RoleEdgesFromKey{
			FromHost: existingUser.Host,
			FromUser: existingUser.User,
		})
		editor.RemoveRoleEdgesToKey(mysql_db.RoleEdgesToKey{
			ToHost: existingUser.Host,
			ToUser: existingUser.User,
		})
	}
	if err := mysqlDb.Persist(ctx, editor); err != nil {
		return nil, err
	}
	return sql.RowsToRowIter(sql.Row{types.NewOkResult(0)}), nil
}
