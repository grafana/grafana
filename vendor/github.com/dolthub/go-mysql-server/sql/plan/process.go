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

	"github.com/dolthub/go-mysql-server/sql/transform"

	"github.com/dolthub/go-mysql-server/sql"
)

// NotifyFunc is a function to notify about some event.
type NotifyFunc func()

// ProcessIndexableTable is a wrapper for sql.Tables inside a query process
// that support indexing.
// It notifies the process manager about the status of a query when a
// partition is processed.
type ProcessIndexableTable struct {
	sql.DriverIndexableTable
	OnPartitionDone  NamedNotifyFunc
	OnPartitionStart NamedNotifyFunc
	OnRowNext        NamedNotifyFunc
}

func (t *ProcessIndexableTable) DebugString() string {
	tp := sql.NewTreePrinter()
	// This is a bit of a misnomer -- some db implementations get this node, rather than ProcessTable, but the two
	// nodes are functionally equivalent for testing which is where this output is used. We could fix this by making a
	// version of the memory package that doesn't implement sql.DriverIndexableTable
	_ = tp.WriteNode("ProcessTable")
	_ = tp.WriteChildren(TableDebugString(t.Underlying()))
	return tp.String()
}

// NewProcessIndexableTable returns a new ProcessIndexableTable.
func NewProcessIndexableTable(t sql.DriverIndexableTable, onPartitionDone, onPartitionStart, OnRowNext NamedNotifyFunc) *ProcessIndexableTable {
	return &ProcessIndexableTable{t, onPartitionDone, onPartitionStart, OnRowNext}
}

// Underlying implements sql.TableWrapper interface.
func (t *ProcessIndexableTable) Underlying() sql.Table {
	return t.DriverIndexableTable
}

// IndexKeyValues implements the sql.IndexableTable interface.
func (t *ProcessIndexableTable) IndexKeyValues(
	ctx *sql.Context,
	columns []string,
) (sql.PartitionIndexKeyValueIter, error) {
	iter, err := t.DriverIndexableTable.IndexKeyValues(ctx, columns)
	if err != nil {
		return nil, err
	}

	return &trackedPartitionIndexKeyValueIter{iter, t.OnPartitionDone, t.OnPartitionStart, t.OnRowNext}, nil
}

// PartitionRows implements the sql.Table interface.
func (t *ProcessIndexableTable) PartitionRows(ctx *sql.Context, p sql.Partition) (sql.RowIter, error) {
	iter, err := t.DriverIndexableTable.PartitionRows(ctx, p)
	if err != nil {
		return nil, err
	}

	return t.newPartIter(p, iter)
}

func (t *ProcessIndexableTable) newPartIter(p sql.Partition, iter sql.RowIter) (sql.RowIter, error) {
	partitionName := partitionName(p)
	if t.OnPartitionStart != nil {
		t.OnPartitionStart(partitionName)
	}

	var onDone NotifyFunc
	if t.OnPartitionDone != nil {
		onDone = func() {
			t.OnPartitionDone(partitionName)
		}
	}

	var onNext NotifyFunc
	if t.OnRowNext != nil {
		onNext = func() {
			t.OnRowNext(partitionName)
		}
	}

	return NewTrackedRowIter(nil, iter, onNext, onDone), nil
}

var _ sql.DriverIndexableTable = (*ProcessIndexableTable)(nil)

// NamedNotifyFunc is a function to notify about some event with a string argument.
type NamedNotifyFunc func(name string)

// ProcessTable is a wrapper for sql.Tables inside a query process. It
// notifies the process manager about the status of a query when a partition
// is processed.
type ProcessTable struct {
	sql.Table
	OnPartitionDone  NamedNotifyFunc
	OnPartitionStart NamedNotifyFunc
	OnRowNext        NamedNotifyFunc
}

var _ sql.CommentedTable = (*ProcessTable)(nil)

// NewProcessTable returns a new ProcessTable.
func NewProcessTable(t sql.Table, onPartitionDone, onPartitionStart, OnRowNext NamedNotifyFunc) *ProcessTable {
	return &ProcessTable{t, onPartitionDone, onPartitionStart, OnRowNext}
}

// Underlying implements sql.TableWrapper interface.
func (t *ProcessTable) Underlying() sql.Table {
	return t.Table
}

// Comment implements sql.CommentedTable interface.
func (t *ProcessTable) Comment() string {
	if ct, ok := t.Table.(sql.CommentedTable); ok {
		return ct.Comment()
	}
	return ""
}

// PartitionRows implements the sql.Table interface.
func (t *ProcessTable) PartitionRows(ctx *sql.Context, p sql.Partition) (sql.RowIter, error) {
	iter, err := t.Table.PartitionRows(ctx, p)
	if err != nil {
		return nil, err
	}

	onDone, onNext := t.notifyFuncsForPartition(p)

	return NewTrackedRowIter(nil, iter, onNext, onDone), nil
}

func (t *ProcessTable) DebugString() string {
	tp := sql.NewTreePrinter()
	_ = tp.WriteNode("ProcessTable")

	underlying := t.Underlying()
	if _, ok := underlying.(sql.TableWrapper); ok {
		if _, ok := underlying.(sql.DebugStringer); ok {
			_ = tp.WriteChildren(sql.DebugString(underlying))
		}
	} else {
		_ = tp.WriteChildren(TableDebugString(underlying))
	}

	return tp.String()
}

// notifyFuncsForPartition returns the OnDone and OnNext NotifyFuncs for the partition given
func (t *ProcessTable) notifyFuncsForPartition(p sql.Partition) (NotifyFunc, NotifyFunc) {
	partitionName := partitionName(p)
	if t.OnPartitionStart != nil {
		t.OnPartitionStart(partitionName)
	}

	var onDone NotifyFunc
	if t.OnPartitionDone != nil {
		onDone = func() {
			t.OnPartitionDone(partitionName)
		}
	}

	var onNext NotifyFunc
	if t.OnRowNext != nil {
		onNext = func() {
			t.OnRowNext(partitionName)
		}
	}
	return onDone, onNext
}

func GetQueryType(child sql.Node) queryType {
	// TODO: behavior of CALL is not specified in the docs. Needs investigation
	var queryType queryType = QueryTypeSelect
	transform.Inspect(child, func(node sql.Node) bool {
		if IsNoRowNode(node) {
			queryType = QueryTypeDdl
			return false
		}

		switch node.(type) {
		case *Signal:
			queryType = QueryTypeDdl
			return false
		case nil:
			return false
		case *TriggerExecutor, *InsertInto, *Update, *DeleteFrom, *LoadData:
			// TODO: AlterTable belongs here too, but we don't keep track of updated rows there so we can't return an
			//  accurate ROW_COUNT() anyway.
			queryType = QueryTypeUpdate
			return false
		}
		return true
	})

	return queryType
}

type queryType byte

const (
	QueryTypeSelect = iota
	QueryTypeDdl
	QueryTypeUpdate
)

type TrackedRowIter struct {
	node               sql.Node
	iter               sql.RowIter
	onDone             NotifyFunc
	onNext             NotifyFunc
	numRows            int64
	QueryType          queryType
	ShouldSetFoundRows bool
}

func NewTrackedRowIter(
	node sql.Node,
	iter sql.RowIter,
	onNext NotifyFunc,
	onDone NotifyFunc,
) *TrackedRowIter {
	return &TrackedRowIter{node: node, iter: iter, onDone: onDone, onNext: onNext}
}

// ShouldSetFoundRows returns whether the query process should set the FOUND_ROWS query variable. It should do this for
// any select except a Limit with a SQL_CALC_FOUND_ROWS modifier, which is handled in the Limit node itself.
func shouldSetFoundRows(node sql.Node) bool {
	result := true
	transform.Inspect(node, func(n sql.Node) bool {
		switch nn := n.(type) {
		case *Limit:
			if nn.CalcFoundRows {
				result = false
			}
		case *TopN:
			if nn.CalcFoundRows {
				result = false
			}
		}
		return true
	})
	return result
}

func AddTrackedRowIter(ctx *sql.Context, node sql.Node, iter sql.RowIter) sql.RowIter {
	trackedIter := NewTrackedRowIter(node, iter, nil, func() {
		ctx.ProcessList.EndQuery(ctx)
		if span := ctx.RootSpan(); span != nil {
			span.End()
		}
	})
	trackedIter.QueryType = GetQueryType(node)
	trackedIter.ShouldSetFoundRows = trackedIter.QueryType == QueryTypeSelect && shouldSetFoundRows(node)
	return trackedIter
}

func (i *TrackedRowIter) done() {
	if i.onDone != nil {
		i.onDone()
		i.onDone = nil
	}
	if i.node != nil {
		i.Dispose()
		i.node = nil
	}
}

func disposeNode(n sql.Node) {
	transform.Inspect(n, func(node sql.Node) bool {
		sql.Dispose(node)
		return true
	})
	transform.InspectExpressions(n, func(e sql.Expression) bool {
		sql.Dispose(e)
		return true
	})
}

func (i *TrackedRowIter) Dispose() {
	if i.node != nil {
		disposeNode(i.node)
	}
}

func (i *TrackedRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	row, err := i.iter.Next(ctx)
	if err != nil {
		return nil, err
	}

	i.numRows++

	if i.onNext != nil {
		i.onNext()
	}

	return row, nil
}

func (i *TrackedRowIter) Close(ctx *sql.Context) error {
	err := i.iter.Close(ctx)

	i.updateSessionVars(ctx)

	i.done()
	return err
}

func (i *TrackedRowIter) GetNode() sql.Node {
	return i.node
}

func (i *TrackedRowIter) GetIter() sql.RowIter {
	return i.iter
}

func (i *TrackedRowIter) updateSessionVars(ctx *sql.Context) {
	switch i.QueryType {
	case QueryTypeSelect:
		ctx.SetLastQueryInfoInt(sql.RowCount, -1)
	case QueryTypeDdl:
		ctx.SetLastQueryInfoInt(sql.RowCount, 0)
	case QueryTypeUpdate:
		// This is handled by RowUpdateAccumulator
	default:
		panic(fmt.Sprintf("Unexpected query type %v", i.QueryType))
	}

	if i.ShouldSetFoundRows {
		ctx.SetLastQueryInfoInt(sql.FoundRows, i.numRows)
	}
}

func (i *TrackedRowIter) WithChildIter(childIter sql.RowIter) sql.RowIter {
	ni := *i
	ni.iter = childIter
	return &ni
}

type trackedPartitionIndexKeyValueIter struct {
	sql.PartitionIndexKeyValueIter
	OnPartitionDone  NamedNotifyFunc
	OnPartitionStart NamedNotifyFunc
	OnRowNext        NamedNotifyFunc
}

func (i *trackedPartitionIndexKeyValueIter) Next(ctx *sql.Context) (sql.Partition, sql.IndexKeyValueIter, error) {
	p, iter, err := i.PartitionIndexKeyValueIter.Next(ctx)
	if err != nil {
		return nil, nil, err
	}

	partitionName := partitionName(p)
	if i.OnPartitionStart != nil {
		i.OnPartitionStart(partitionName)
	}

	var onDone NotifyFunc
	if i.OnPartitionDone != nil {
		onDone = func() {
			i.OnPartitionDone(partitionName)
		}
	}

	var onNext NotifyFunc
	if i.OnRowNext != nil {
		onNext = func() {
			i.OnRowNext(partitionName)
		}
	}

	return p, &trackedIndexKeyValueIter{iter, onDone, onNext}, nil
}

type trackedIndexKeyValueIter struct {
	iter   sql.IndexKeyValueIter
	onDone NotifyFunc
	onNext NotifyFunc
}

func (i *trackedIndexKeyValueIter) done() {
	if i.onDone != nil {
		i.onDone()
		i.onDone = nil
	}
}

func (i *trackedIndexKeyValueIter) Close(ctx *sql.Context) (err error) {
	if i.iter != nil {
		err = i.iter.Close(ctx)
	}

	i.done()
	return err
}

func (i *trackedIndexKeyValueIter) Next(ctx *sql.Context) ([]interface{}, []byte, error) {
	v, k, err := i.iter.Next(ctx)
	if err != nil {
		return nil, nil, err
	}

	if i.onNext != nil {
		i.onNext()
	}

	return v, k, nil
}

func partitionName(p sql.Partition) string {
	if n, ok := p.(sql.Nameable); ok {
		return n.Name()
	}
	return string(p.Key())
}

func IsDDLNode(node sql.Node) bool {
	switch node.(type) {
	case *CreateTable, *DropTable, *Truncate,
		*AddColumn, *ModifyColumn, *DropColumn,
		*CreateDB, *CreateSchema, *DropDB, *AlterDB,
		*RenameTable, *RenameColumn,
		*CreateView, *DropView,
		*CreateIndex, *AlterIndex, *DropIndex,
		*CreateProcedure, *DropProcedure,
		*CreateEvent, *DropEvent,
		*CreateForeignKey, *DropForeignKey,
		*CreateCheck, *DropCheck,
		*CreateTrigger, *DropTrigger, *AlterPK,
		*Block: // Block as a top level node wraps a set of ALTER TABLE statements
		return true
	default:
		return false
	}
}

func IsShowNode(node sql.Node) bool {
	switch node.(type) {
	case *ShowTables, *ShowCreateTable,
		*ShowTriggers, *ShowCreateTrigger,
		*ShowDatabases, *ShowCreateDatabase,
		*ShowColumns, *ShowIndexes,
		*ShowProcessList, *ShowTableStatus,
		*ShowVariables, ShowWarnings,
		*ShowEvents, *ShowCreateEvent:
		return true
	default:
		return false
	}
}

// IsNoRowNode returns whether this are node interacts only with schema and the catalog, not with any table
// rows.
func IsNoRowNode(node sql.Node) bool {
	return IsDDLNode(node) || IsShowNode(node)
}

func IsReadOnly(node sql.Node) bool {
	return node.IsReadOnly()
}
