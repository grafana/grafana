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

// CreateRole represents the statement CREATE ROLE.
type CreateRole struct {
	MySQLDb     sql.Database
	Roles       []UserName
	IfNotExists bool
}

// NewCreateRole returns a new CreateRole node.
func NewCreateRole(ifNotExists bool, roles []UserName) *CreateRole {
	return &CreateRole{
		IfNotExists: ifNotExists,
		Roles:       roles,
		MySQLDb:     sql.UnresolvedDatabase("mysql"),
	}
}

var _ sql.Node = (*CreateRole)(nil)
var _ sql.CollationCoercible = (*CreateRole)(nil)

// Schema implements the interface sql.Node.
func (n *CreateRole) Schema() sql.Schema {
	return types.OkResultSchema
}

// String implements the interface sql.Node.
func (n *CreateRole) String() string {
	roles := make([]string, len(n.Roles))
	for i, role := range n.Roles {
		roles[i] = role.String("")
	}
	ifNotExists := ""
	if n.IfNotExists {
		ifNotExists = "IfNotExists: "
	}
	return fmt.Sprintf("CreateRole(%s%s)", ifNotExists, strings.Join(roles, ", "))
}

// Database implements the interface sql.Databaser.
func (n *CreateRole) Database() sql.Database {
	return n.MySQLDb
}

// WithDatabase implements the interface sql.Databaser.
func (n *CreateRole) WithDatabase(db sql.Database) (sql.Node, error) {
	nn := *n
	nn.MySQLDb = db
	return &nn, nil
}

// Resolved implements the interface sql.Node.
func (n *CreateRole) Resolved() bool {
	_, ok := n.MySQLDb.(sql.UnresolvedDatabase)
	return !ok
}

func (n *CreateRole) IsReadOnly() bool {
	return false
}

// Children implements the interface sql.Node.
func (n *CreateRole) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (n *CreateRole) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}
	return n, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*CreateRole) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
