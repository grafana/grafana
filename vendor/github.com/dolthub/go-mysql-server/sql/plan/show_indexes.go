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
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ShowIndexes is a node that shows the indexes on a table.
type ShowIndexes struct {
	UnaryNode
	IndexesToShow []sql.Index
}

// NewShowIndexes creates a new ShowIndexes node. The node must represent a table.
func NewShowIndexes(table sql.Node) *ShowIndexes {
	return &ShowIndexes{
		UnaryNode: UnaryNode{table},
	}
}

var _ sql.Node = (*ShowIndexes)(nil)
var _ sql.CollationCoercible = (*ShowIndexes)(nil)

// WithChildren implements the Node interface.
func (n *ShowIndexes) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 1)
	}

	return &ShowIndexes{
		UnaryNode:     UnaryNode{children[0]},
		IndexesToShow: n.IndexesToShow,
	}, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowIndexes) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// String implements the fmt.Stringer interface.
func (n *ShowIndexes) String() string {
	return fmt.Sprintf("ShowIndexes(%s)", n.Child)
}

func (n *ShowIndexes) IsReadOnly() bool {
	return true
}

// Schema implements the Node interface.
func (n *ShowIndexes) Schema() sql.Schema {
	return sql.Schema{
		&sql.Column{Name: "Table", Type: types.LongText},
		&sql.Column{Name: "Non_unique", Type: types.Int32},
		&sql.Column{Name: "Key_name", Type: types.LongText},
		&sql.Column{Name: "Seq_in_index", Type: types.Uint32},
		&sql.Column{Name: "Column_name", Type: types.LongText, Nullable: true},
		&sql.Column{Name: "Collation", Type: types.LongText, Nullable: true},
		&sql.Column{Name: "Cardinality", Type: types.Int64},
		&sql.Column{Name: "Sub_part", Type: types.Int64, Nullable: true},
		&sql.Column{Name: "Packed", Type: types.LongText, Nullable: true},
		&sql.Column{Name: "Null", Type: types.LongText},
		&sql.Column{Name: "Index_type", Type: types.LongText},
		&sql.Column{Name: "Comment", Type: types.LongText},
		&sql.Column{Name: "Index_comment", Type: types.LongText},
		&sql.Column{Name: "Visible", Type: types.LongText},
		&sql.Column{Name: "Expression", Type: types.LongText, Nullable: true},
	}
}
