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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ShowPrivileges represents the statement SHOW PRIVILEGES.
type ShowPrivileges struct{}

var _ sql.Node = (*ShowPrivileges)(nil)
var _ sql.CollationCoercible = (*ShowPrivileges)(nil)

// NewShowPrivileges returns a new ShowPrivileges node.
func NewShowPrivileges() *ShowPrivileges {
	return &ShowPrivileges{}
}

// Schema implements the interface sql.Node.
func (n *ShowPrivileges) Schema() sql.Schema {
	return sql.Schema{
		&sql.Column{Name: "Privilege", Type: types.LongText},
		&sql.Column{Name: "Context", Type: types.LongText},
		&sql.Column{Name: "Comment", Type: types.LongText},
	}
}

// String implements the interface sql.Node.
func (n *ShowPrivileges) String() string {
	return "SHOW PRIVILEGES"
}

// Resolved implements the interface sql.Node.
func (n *ShowPrivileges) Resolved() bool {
	return true
}

func (n *ShowPrivileges) IsReadOnly() bool {
	return true
}

// Children implements the interface sql.Node.
func (n *ShowPrivileges) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (n *ShowPrivileges) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}
	return n, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowPrivileges) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
