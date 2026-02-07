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
	"io"

	"github.com/dolthub/go-mysql-server/sql"
)

func IsEmptyTable(n sql.Node) bool {
	_, ok := n.(*EmptyTable)
	return ok
}
func NewEmptyTableWithSchema(schema sql.Schema) sql.Node {
	return &EmptyTable{schema: schema}
}

var _ sql.Node = (*EmptyTable)(nil)
var _ sql.CollationCoercible = (*EmptyTable)(nil)
var _ sql.UpdatableTable = (*EmptyTable)(nil)
var _ sql.DeletableTable = (*EmptyTable)(nil)
var _ sql.RenameableNode = (*EmptyTable)(nil)

type EmptyTable struct {
	cols   sql.ColSet
	schema sql.Schema
	id     sql.TableId
}

// WithId implements sql.TableIdNode
func (e *EmptyTable) WithId(id sql.TableId) TableIdNode {
	ret := *e
	ret.id = id
	return &ret
}

// Id implements sql.TableIdNode
func (e *EmptyTable) Id() sql.TableId {
	return e.id
}

// WithColumns implements sql.TableIdNode
func (e *EmptyTable) WithColumns(set sql.ColSet) TableIdNode {
	ret := *e
	ret.cols = set
	return &ret
}

// Columns implements sql.TableIdNode
func (e *EmptyTable) Columns() sql.ColSet {
	return e.cols
}

func (e *EmptyTable) WithName(s string) sql.Node {
	ret := *e
	newSch := make(sql.Schema, len(ret.schema))
	for i, c := range ret.schema {
		newC := c.Copy()
		newC.Source = s
		newSch[i] = newC
	}
	ret.schema = newSch
	return &ret
}

func (e *EmptyTable) Name() string {
	if len(e.schema) == 0 {
		return "__emptytable"
	}
	return e.schema[0].Source
}

func (e *EmptyTable) Schema() sql.Schema { return e.schema }
func (*EmptyTable) Children() []sql.Node { return nil }
func (*EmptyTable) Resolved() bool       { return true }
func (*EmptyTable) IsReadOnly() bool     { return true }
func (e *EmptyTable) String() string     { return "EmptyTable" }

// RowIter implements the sql.Node interface.
func (*EmptyTable) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(), nil
}

// WithChildren implements the sql.Node interface.
func (e *EmptyTable) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(e, len(children), 0)
	}

	return e, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*EmptyTable) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Updater implements the sql.UpdatableTable interface.
func (e *EmptyTable) Updater(ctx *sql.Context) sql.RowUpdater {
	return &emptyTableUpdater{}
}

// Collation implements the sql.UpdatableTable interface.
func (e *EmptyTable) Collation() sql.CollationID {
	return sql.Collation_Default
}

// Partitions implements the sql.UpdatableTable interface.
func (e *EmptyTable) Partitions(_ *sql.Context) (sql.PartitionIter, error) {
	return &emptyTablePartitionIter{}, nil
}

// PartitionRows implements the sql.UpdatableTable interface.
func (e *EmptyTable) PartitionRows(_ *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	return &emptyTableIter{}, nil
}

// Deleter implements the sql.DeletableTable interface.
func (e *EmptyTable) Deleter(context *sql.Context) sql.RowDeleter {
	return &emptyTableDeleter{}
}

type emptyTableUpdater struct{}

var _ sql.RowUpdater = (*emptyTableUpdater)(nil)

// StatementBegin implements the sql.EditOpenerCloser interface
func (e *emptyTableUpdater) StatementBegin(_ *sql.Context) {}

// DiscardChanges implements the sql.EditOpenerCloser interface
func (e *emptyTableUpdater) DiscardChanges(_ *sql.Context, _ error) error {
	return nil
}

// StatementComplete implements the sql.EditOpenerCloser interface
func (e *emptyTableUpdater) StatementComplete(_ *sql.Context) error {
	return nil
}

// Update implements the sql.RowUpdater interface
func (e *emptyTableUpdater) Update(_ *sql.Context, _ sql.Row, _ sql.Row) error {
	return nil
}

// Close implements the sql.Closer interface
func (e *emptyTableUpdater) Close(_ *sql.Context) error {
	return nil
}

type emptyTableIter struct{}

var _ sql.RowIter = (*emptyTableIter)(nil)

// Next implements the sql.RowIter interface.
func (e *emptyTableIter) Next(_ *sql.Context) (sql.Row, error) {
	return nil, io.EOF
}

// Close implements the sql.RowIter interface.
func (e *emptyTableIter) Close(_ *sql.Context) error {
	return nil
}

type emptyTablePartitionIter struct{}

var _ sql.PartitionIter = (*emptyTablePartitionIter)(nil)

// Close implements the sql.PartitionIter interface.
func (e *emptyTablePartitionIter) Close(_ *sql.Context) error {
	return nil
}

// Next implements the sql.PartitionIter interface.
func (e *emptyTablePartitionIter) Next(_ *sql.Context) (sql.Partition, error) {
	return nil, io.EOF
}

type emptyTableDeleter struct{}

var _ sql.RowDeleter = (*emptyTableDeleter)(nil)

func (e *emptyTableDeleter) StatementBegin(_ *sql.Context) {}

func (e *emptyTableDeleter) DiscardChanges(_ *sql.Context, _ error) error {
	return nil
}

func (e *emptyTableDeleter) StatementComplete(_ *sql.Context) error {
	return nil
}

func (e *emptyTableDeleter) Delete(_ *sql.Context, _ sql.Row) error {
	return nil
}

func (e *emptyTableDeleter) Close(_ *sql.Context) error {
	return nil
}
