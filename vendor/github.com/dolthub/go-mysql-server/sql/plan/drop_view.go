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
	errors "gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql/mysql_db"

	"github.com/dolthub/go-mysql-server/sql"
)

var ErrDropViewChild = errors.NewKind("any child of DropView must be of type SingleDropView")

type SingleDropView struct {
	database sql.Database
	ViewName string
}

var _ sql.Node = (*SingleDropView)(nil)
var _ sql.CollationCoercible = (*SingleDropView)(nil)

// NewSingleDropView creates a SingleDropView.
func NewSingleDropView(
	database sql.Database,
	viewName string,
) *SingleDropView {
	return &SingleDropView{database, viewName}
}

// Children implements the Node interface. It always returns nil.
func (dv *SingleDropView) Children() []sql.Node {
	return nil
}

// Resolved implements the Node interface. This node is resolved if and only if
// its database is resolved.
func (dv *SingleDropView) Resolved() bool {
	_, ok := dv.database.(sql.UnresolvedDatabase)
	return !ok
}

func (dv *SingleDropView) IsReadOnly() bool {
	return false
}

// RowIter implements the Node interface. It always returns an empty iterator.
func (dv *SingleDropView) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(), nil
}

// Schema implements the Node interface. It always returns nil.
func (dv *SingleDropView) Schema() sql.Schema { return nil }

// String implements the fmt.Stringer interface, using sql.TreePrinter to
// generate the string.
func (dv *SingleDropView) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("SingleDropView(%s.%s)", dv.database.Name(), dv.ViewName)

	return pr.String()
}

// WithChildren implements the Node interface. It only succeeds if the length
// of the specified children equals 0.
func (dv *SingleDropView) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(dv, len(children), 0)
	}

	return dv, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*SingleDropView) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Database implements the sql.Databaser interface. It returns the node's database.
func (dv *SingleDropView) Database() sql.Database {
	return dv.database
}

// WithDatabase implements the sql.Databaser interface, and it returns a copy of this
// node with the specified database.
func (dv *SingleDropView) WithDatabase(database sql.Database) (sql.Node, error) {
	if privilegedDatabase, ok := database.(mysql_db.PrivilegedDatabase); ok {
		database = privilegedDatabase.Unwrap()
	}
	newDrop := *dv
	newDrop.database = database
	return &newDrop, nil
}

// DropView is a node representing the removal of a list of views, defined by
// the children member. The flag ifExists represents whether the user wants the
// node to fail if any of the views in children does not exist.
type DropView struct {
	children []sql.Node
	IfExists bool
}

var _ sql.Node = (*DropView)(nil)
var _ sql.CollationCoercible = (*DropView)(nil)

// NewDropView creates a DropView node with the specified parameters,
// setting its catalog to nil.
func NewDropView(children []sql.Node, ifExists bool) *DropView {
	return &DropView{children: children, IfExists: ifExists}
}

// Children implements the Node interface. It returns the children of the
// CreateView node; i.e., all the views that will be dropped.
func (dvs *DropView) Children() []sql.Node {
	return dvs.children
}

// Resolved implements the Node interface. This node is resolved if and only if
// all of its children are resolved.
func (dvs *DropView) Resolved() bool {
	for _, child := range dvs.children {
		if !child.Resolved() {
			return false
		}
	}
	return true
}

// Schema implements the Node interface. It always returns nil.
func (dvs *DropView) Schema() sql.Schema { return nil }

// String implements the fmt.Stringer interface, using sql.TreePrinter to
// generate the string.
func (dvs *DropView) String() string {
	childrenStrings := make([]string, len(dvs.children))
	for i, child := range dvs.children {
		childrenStrings[i] = child.String()
	}

	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("DropView")
	_ = pr.WriteChildren(childrenStrings...)

	return pr.String()
}

// WithChildren implements the Node interface. It always suceeds, returning a
// copy of this node with the new array of nodes as children.
func (dvs *DropView) WithChildren(children ...sql.Node) (sql.Node, error) {
	newDrop := dvs
	newDrop.children = children
	return newDrop, nil
}

func (dvs *DropView) IsReadOnly() bool {
	return false
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DropView) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
