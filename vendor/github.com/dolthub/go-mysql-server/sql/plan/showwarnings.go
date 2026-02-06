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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ShowWarnings is a node that shows the session warnings
type ShowWarnings []*sql.Warning

var _ sql.Node = (*ShowWarnings)(nil)
var _ sql.CollationCoercible = (*ShowWarnings)(nil)

// Resolved implements sql.Node interface. The function always returns true.
func (ShowWarnings) Resolved() bool {
	return true
}

// WithChildren implements the Node interface.
func (sw ShowWarnings) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(sw, len(children), 0)
	}

	return sw, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (ShowWarnings) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// String implements the fmt.Stringer interface.
func (ShowWarnings) String() string {
	return "SHOW WARNINGS"
}

func (ShowWarnings) IsReadOnly() bool {
	return true
}

// Schema returns a new Schema reference for "SHOW VARIABLES" query.
func (ShowWarnings) Schema() sql.Schema {
	return sql.Schema{
		&sql.Column{Name: "Level", Type: types.LongText, Nullable: false},
		&sql.Column{Name: "Code", Type: types.Int32, Nullable: true},
		&sql.Column{Name: "Message", Type: types.LongText, Nullable: false},
	}
}

// Children implements sql.Node interface. The function always returns nil.
func (ShowWarnings) Children() []sql.Node { return nil }
