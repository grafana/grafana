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

	"github.com/dolthub/go-mysql-server/sql"
)

var (
	// ErrIndexNotFound is returned when the index cannot be found.
	ErrIndexNotFound = errors.NewKind("unable to find index %q on table %q of database %q")
	// ErrTableNotValid is returned when the table is not valid
	ErrTableNotValid = errors.NewKind("table is not valid")
	// ErrTableNotNameable is returned when the table is not nameable.
	ErrTableNotNameable = errors.NewKind("can't get name from table")
	// ErrIndexNotAvailable is returned when trying to delete an index that is
	// still not ready for usage.
	ErrIndexNotAvailable = errors.NewKind("index %q is still not ready for usage and can't be deleted")
)

// DropIndex is a node to drop an index.
type DropIndex struct {
	Name            string
	Table           sql.Node
	Catalog         sql.Catalog
	CurrentDatabase string
}

// NewDropIndex creates a new DropIndex node.
func NewDropIndex(name string, table sql.Node) *DropIndex {
	return &DropIndex{name, table, nil, ""}
}

var _ sql.Node = (*DropIndex)(nil)
var _ sql.Databaseable = (*DropIndex)(nil)
var _ sql.CollationCoercible = (*DropIndex)(nil)

func (d *DropIndex) Database() string { return d.CurrentDatabase }

// Resolved implements the Node interface.
func (d *DropIndex) Resolved() bool { return d.Table.Resolved() }

func (d *DropIndex) IsReadOnly() bool { return false }

// Schema implements the Node interface.
func (d *DropIndex) Schema() sql.Schema { return nil }

// Children implements the Node interface.
func (d *DropIndex) Children() []sql.Node { return []sql.Node{d.Table} }

func (d *DropIndex) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("DropIndex(%s)", d.Name)
	_ = pr.WriteChildren(d.Table.String())
	return pr.String()
}

// WithChildren implements the Node interface.
func (d *DropIndex) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}

	nd := *d
	nd.Table = children[0]
	return &nd, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DropIndex) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
