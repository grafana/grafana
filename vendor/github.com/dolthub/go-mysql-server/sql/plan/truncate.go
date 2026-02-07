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
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

var ErrTruncateNotSupported = errors.NewKind("table doesn't support TRUNCATE")

// Truncate is a node describing the deletion of all rows from some table.
type Truncate struct {
	UnaryNode
	db string
}

var _ sql.Node = (*Truncate)(nil)
var _ sql.DebugStringer = (*Truncate)(nil)
var _ sql.CollationCoercible = (*Truncate)(nil)

// NewTruncate creates a Truncate node.
func NewTruncate(db string, table sql.Node) *Truncate {
	return &Truncate{
		db:        db,
		UnaryNode: UnaryNode{table},
	}
}

func GetTruncatable(node sql.Node) (sql.TruncateableTable, error) {
	switch node := node.(type) {
	case sql.TruncateableTable:
		return node, nil
	case *IndexedTableAccess:
		return GetTruncatable(node.TableNode)
	case *ResolvedTable:
		return getTruncatableTable(node.Table)
	case sql.TableWrapper:
		return getTruncatableTable(node.Underlying())
	}
	for _, child := range node.Children() {
		truncater, _ := GetTruncatable(child)
		if truncater != nil {
			return truncater, nil
		}
	}
	return nil, ErrTruncateNotSupported.New()
}

func getTruncatableTable(t sql.Table) (sql.TruncateableTable, error) {
	switch t := t.(type) {
	case sql.TruncateableTable:
		return t, nil
	case sql.TableWrapper:
		return getTruncatableTable(t.Underlying())
	default:
		return nil, ErrTruncateNotSupported.New()
	}
}

// DatabaseName returns the name of the database that this operation is being performed in.
func (p *Truncate) DatabaseName() string {
	return p.db
}

// Schema implements the Node interface.
func (p *Truncate) Schema() sql.Schema {
	return types.OkResultSchema
}

// WithChildren implements the Node interface.
func (p *Truncate) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 1)
	}
	nt := *p
	nt.UnaryNode = UnaryNode{children[0]}
	return &nt, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Truncate) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (*Truncate) IsReadOnly() bool {
	return false
}

// String implements the Node interface.
func (p Truncate) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Truncate")
	_ = pr.WriteChildren(p.Child.String())
	return pr.String()
}

// DebugString implements the DebugStringer interface.
func (p Truncate) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Truncate")
	_ = pr.WriteChildren(sql.DebugString(p.Child))
	return pr.String()
}
