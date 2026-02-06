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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// RenameUser represents the statement RENAME USER.
type RenameUser struct {
	OldName []UserName
	NewName []UserName
}

var _ sql.Node = (*RenameUser)(nil)
var _ sql.CollationCoercible = (*RenameUser)(nil)

// NewRenameUser returns a new RenameUser node.
func NewRenameUser(oldNames []UserName, newNames []UserName) *RenameUser {
	return &RenameUser{
		OldName: oldNames,
		NewName: newNames,
	}
}

// Schema implements the interface sql.Node.
func (n *RenameUser) Schema() sql.Schema {
	return types.OkResultSchema
}

func (n *RenameUser) IsReadOnly() bool {
	return false
}

// String implements the interface sql.Node.
func (n *RenameUser) String() string {
	strs := make([]string, len(n.OldName))
	for i := range n.OldName {
		strs[i] = fmt.Sprintf("%s->%s",
			n.OldName[i].String(""), n.NewName[i].String(""))
	}
	return fmt.Sprintf("RenameUser(%s)", strings.Join(strs, ", "))
}

// Resolved implements the interface sql.Node.
func (n *RenameUser) Resolved() bool {
	return true
}

// Children implements the interface sql.Node.
func (n *RenameUser) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (n *RenameUser) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}
	return n, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*RenameUser) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// RowIter implements the interface sql.Node.
func (n *RenameUser) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	return nil, fmt.Errorf("not yet implemented")
}
