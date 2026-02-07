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

package memory

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/internal/cmap"
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// tableEditor manages the edits that a targetTable receives.
type tableEditor struct {
	ea             tableEditAccumulator
	editedTable    *Table
	initialTable   *Table
	fkTable        *Table
	uniqueIdxCols  [][]int
	prefixLengths  [][]uint16
	discardChanges bool
}

var _ sql.Table = (*tableEditor)(nil)
var _ sql.CommentedTable = (*tableEditor)(nil)
var _ sql.RowReplacer = (*tableEditor)(nil)
var _ sql.RowUpdater = (*tableEditor)(nil)
var _ sql.RowInserter = (*tableEditor)(nil)
var _ sql.RowDeleter = (*tableEditor)(nil)
var _ sql.AutoIncrementSetter = (*tableEditor)(nil)
var _ sql.ForeignKeyEditor = (*tableEditor)(nil)

func (t *tableEditor) Name() string {
	return t.editedTable.name
}

func (t *tableEditor) String() string {
	return t.editedTable.String()
}

func (t *tableEditor) Schema() sql.Schema {
	return t.editedTable.Schema()
}

func (t *tableEditor) Collation() sql.CollationID {
	return t.editedTable.Collation()
}

func (t *tableEditor) Comment() string {
	return t.editedTable.Comment()
}

func (t *tableEditor) Partitions(ctx *sql.Context) (sql.PartitionIter, error) {
	return t.editedTable.Partitions(ctx)
}

func (t *tableEditor) PartitionRows(ctx *sql.Context, part sql.Partition) (sql.RowIter, error) {
	if t.fkTable != nil {
		return t.fkTable.PartitionRows(ctx, part)
	}
	return t.editedTable.PartitionRows(ctx, part)
}

func (t *tableEditor) GetIndexes(ctx *sql.Context) ([]sql.Index, error) {
	return t.editedTable.GetIndexes(ctx)
}

func (t *tableEditor) Close(ctx *sql.Context) error {
	var sess *Session
	if !t.editedTable.IgnoreSessionData() {
		sess = SessionFromContext(ctx)

		if t.discardChanges {
			sess.putTable(t.initialTable.data)
			return nil
		}
	} else {
		if t.discardChanges {
			t.editedTable.replaceData(t.initialTable.data)
			return nil
		}
	}

	// On the normal INSERT / UPDATE / DELETE path this happens at StatementComplete time, but for table rewrites it
	// only happens at Close
	err := t.ea.ApplyEdits(ctx, t.editedTable)
	if err != nil {
		return err
	}
	t.ea.Clear()

	if !t.editedTable.IgnoreSessionData() {
		sess.putTable(t.editedTable.data)
	}

	return nil
}

func (t *tableEditor) StatementBegin(ctx *sql.Context) {
	t.initialTable = t.editedTable.copy()
}

func (t *tableEditor) DiscardChanges(ctx *sql.Context, errorEncountered error) error {
	t.ea.Clear()
	if _, ignore := errorEncountered.(sql.IgnorableError); !ignore {
		t.editedTable.replaceData(t.initialTable.data)
		t.discardChanges = true
	}
	return nil
}

func (t *tableEditor) StatementComplete(ctx *sql.Context) error {
	err := t.ea.ApplyEdits(ctx, t.editedTable)
	if err != nil {
		return nil
	}
	t.ea.Clear()

	if !t.editedTable.IgnoreSessionData() {
		sess := SessionFromContext(ctx)
		sess.putTable(t.editedTable.data)
	}

	return nil
}

// Insert inserts a new row into the table.
func (t *tableEditor) Insert(ctx *sql.Context, row sql.Row) error {
	if err := checkRow(ctx, t.editedTable.data.schema.Schema, row); err != nil {
		return err
	}

	partitionRow, added, err := t.ea.Get(row)
	if err != nil {
		return err
	}

	if added {
		pkColIdxes := t.pkColumnIndexes()
		return sql.NewUniqueKeyErr(formatRow(row, pkColIdxes), true, partitionRow)
	}

	for i, cols := range t.uniqueIdxCols {
		if hasNullForAnyCols(row, cols) {
			continue
		}
		prefixLengths := t.prefixLengths[i]
		existing, found, err := t.ea.GetByCols(row, cols, prefixLengths)
		if err != nil {
			return err
		}

		if found {
			return sql.NewUniqueKeyErr(formatRow(row, cols), false, existing)
		}
	}

	err = t.ea.Insert(ctx, row)
	if err != nil {
		return err
	}

	// todo could peek into internals, not use editedTable t.ea.(*pkTableEditAccumulator).tableData
	idx := t.ea.TableData().autoColIdx
	if idx >= 0 {
		autoCol := t.ea.TableData().schema.Schema[idx]
		cmp, err := autoCol.Type.Compare(ctx, row[idx], t.ea.TableData().autoIncVal)
		if err != nil {
			return err
		}
		if cmp > 0 {
			insertedVal, _, err := types.Uint64.Convert(ctx, row[idx])
			if err != nil {
				return err
			}
			t.ea.TableData().autoIncVal = insertedVal.(uint64)
			updateAutoIncrementSafe(ctx, autoCol, &t.ea.TableData().autoIncVal)
		} else if cmp == 0 {
			updateAutoIncrementSafe(ctx, autoCol, &t.ea.TableData().autoIncVal)
		}
	}

	return nil
}

// Delete the given row from the table.
func (t *tableEditor) Delete(ctx *sql.Context, row sql.Row) error {
	if err := checkRow(ctx, t.editedTable.Schema(), row); err != nil {
		return err
	}

	err := t.ea.Delete(ctx, row)
	if err != nil {
		return err
	}

	return nil
}

// Update updates the given row in the table.
func (t *tableEditor) Update(ctx *sql.Context, oldRow sql.Row, newRow sql.Row) error {
	if err := checkRow(ctx, t.editedTable.Schema(), oldRow); err != nil {
		return err
	}
	if err := checkRow(ctx, t.editedTable.Schema(), newRow); err != nil {
		return err
	}

	err := t.ea.Delete(ctx, oldRow)
	if err != nil {
		return err
	}

	if t.pkColsDiffer(oldRow, newRow) {
		partitionRow, added, err := t.ea.Get(newRow)
		if err != nil {
			return err
		}

		if added {
			pkColIdxes := t.pkColumnIndexes()
			vals := make([]interface{}, len(pkColIdxes))
			for i := range pkColIdxes {
				vals[i] = newRow[pkColIdxes[i]]
			}
			return sql.NewUniqueKeyErr(fmt.Sprint(vals), true, partitionRow)
		}
	}

	// Throw a unique key error if any unique indexes are defined
	for i, cols := range t.uniqueIdxCols {
		if hasNullForAnyCols(newRow, cols) {
			continue
		}
		prefixLengths := t.prefixLengths[i]
		existing, found, err := t.ea.GetByCols(newRow, cols, prefixLengths)
		if err != nil {
			return err
		}

		if found {
			return sql.NewUniqueKeyErr(formatRow(newRow, cols), false, existing)
		}
	}

	err = t.ea.Insert(ctx, newRow)
	if err != nil {
		return err
	}

	return nil
}

// SetAutoIncrementValue sets a new AUTO_INCREMENT value
func (t *tableEditor) SetAutoIncrementValue(ctx *sql.Context, val uint64) error {
	t.editedTable.data.autoIncVal = val
	return nil
}

func (t *tableEditor) AcquireAutoIncrementLock(ctx *sql.Context) (func(), error) {
	// TODO: Add concurrency tests for AutoIncrement locking modes.
	return func() {}, nil
}

func (t *tableEditor) PreciseMatch() bool {
	return true
}

func (t *tableEditor) IndexedAccess(ctx *sql.Context, lookup sql.IndexLookup) sql.IndexedTable {
	// Before we return an indexed access for this table, we need to apply all the edits to the table
	// TODO: optimize this, should create some struct that encloses the tableEditor and filters based on the lookup
	err := t.ea.ApplyEdits(ctx, t.editedTable)
	if err != nil {
		return nil
	}
	t.ea.Clear()

	// We mark this table as ignoring session data because the session won't have up to date data for it now
	indexedTable := t.editedTable.copy()
	indexedTable.ignoreSessionData = true
	return &IndexedTable{Table: indexedTable, Lookup: lookup}
}

func (t *tableEditor) pkColumnIndexes() []int {
	var pkColIdxes []int
	for _, column := range t.editedTable.data.schema.Schema {
		if column.PrimaryKey {
			idx, _ := t.editedTable.data.getColumnOrdinal(column.Name)
			pkColIdxes = append(pkColIdxes, idx)
		}
	}
	return pkColIdxes
}

func (t *tableEditor) pkColsDiffer(row, row2 sql.Row) bool {
	pkColIdxes := t.pkColumnIndexes()
	return !columnsMatch(pkColIdxes, nil, row, row2, t.Schema())
}

// Returns whether the values for the columns given match in the two rows provided
func columnsMatch(colIndexes []int, prefixLengths []uint16, row sql.Row, row2 sql.Row, schema sql.Schema) bool {
	for i, idx := range colIndexes {
		// Skip validating unique virtual columns.
		// Right now trying to validate them would just trigger a panic.
		// See https://github.com/dolthub/go-mysql-server/issues/2643
		if schema[idx].Virtual {
			return false
		}
		v1 := row[idx]
		v2 := row2[idx]
		if len(prefixLengths) > i && prefixLengths[i] > 0 {
			prefixLength := prefixLengths[i]
			switch v := v1.(type) {
			case string:
				if prefixLength > uint16(len(v)) {
					prefixLength = uint16(len(v))
				}
				v1 = v[:prefixLength]
			case []byte:
				if prefixLength > uint16(len(v)) {
					prefixLength = uint16(len(v))
				}
				v1 = v[:prefixLength]
			}
			prefixLength = prefixLengths[i]
			switch v := v2.(type) {
			case string:
				if prefixLength > uint16(len(v)) {
					prefixLength = uint16(len(v))
				}
				v2 = v[:prefixLength]
			case []byte:
				if prefixLength > uint16(len(v)) {
					prefixLength = uint16(len(v))
				}
				v2 = v[:prefixLength]
			}
		}

		if v1Decimal, ok := v1.(decimal.Decimal); ok {
			if v2Decimal, ok := v2.(decimal.Decimal); ok {
				if !v1Decimal.Equal(v2Decimal) {
					return false
				}
			} else {
				return false
			}
		} else {
			if v, ok := v1.([]byte); ok {
				v1 = string(v)
			}
			if v, ok := v2.([]byte); ok {
				v2 = string(v)
			}
			if v1 != v2 {
				return false
			}
		}
	}
	return true
}

// tableEditAccumulator tracks the set of inserts and deletes and applies those edits to a initialTable.
type tableEditAccumulator interface {
	// Insert adds a row to the accumulator to be inserted in the future. Updates are modeled as a Delete then an insertPartIdx.
	Insert(ctx *sql.Context, value sql.Row) error
	// Delete adds a row to the accumulator to be deleted in the future. Updates are modeled as a Delete then an insertPartIdx.
	Delete(ctx *sql.Context, value sql.Row) error
	// Get returns a row if found along with a boolean added. Added is true if a row was inserted.
	Get(value sql.Row) (sql.Row, bool, error)
	// ApplyEdits updates the table provided with the inserts and deletes that have been added to the accumulator.
	// Does not clear the accumulator.
	ApplyEdits(ctx *sql.Context, table *Table) error
	// GetByCols returns the row in the table, or the pending edits, matching the ones given
	GetByCols(value sql.Row, cols []int, prefixLengths []uint16) (sql.Row, bool, error)
	// Clear wipes all of the stored inserts and deletes that may or may not have been applied.
	Clear()
	// TableData exposes the session table data for this accumulator. Currently used for mutating
	// autoincrement in a way that will track row changes.
	TableData() *TableData
}

// newTableEditAccumulator returns a tableEditAccumulator based on the schema.
func newTableEditAccumulator(t *TableData) tableEditAccumulator {
	if sql.IsKeyless(t.schema.Schema) {
		return &keylessTableEditAccumulator{
			tableData: t,
			adds:      make([]sql.Row, 0),
			deletes:   make([]sql.Row, 0),
		}
	}

	return &pkTableEditAccumulator{
		tableData: t,
		adds:      cmap.NewMap[string, sql.Row](),
		deletes:   cmap.NewMap[string, sql.Row](),
	}
}

// pkTableEditAccumulator manages the updates of keyed tables. It uses a map to efficiently toggle edits.
type pkTableEditAccumulator struct {
	tableData *TableData
	adds      *cmap.Map[string, sql.Row]
	deletes   *cmap.Map[string, sql.Row]
}

var _ tableEditAccumulator = (*pkTableEditAccumulator)(nil)

func (pke *pkTableEditAccumulator) TableData() *TableData {
	return pke.tableData
}

// Insert implements the tableEditAccumulator interface.
func (pke *pkTableEditAccumulator) Insert(ctx *sql.Context, value sql.Row) error {
	rowKey := pke.getRowKey(value)
	pke.adds.Set(rowKey, value)
	return nil
}

// Delete implements the tableEditAccumulator interface.
func (pke *pkTableEditAccumulator) Delete(ctx *sql.Context, value sql.Row) error {
	rowKey := pke.getRowKey(value)
	pke.adds.Del(rowKey)
	pke.deletes.Set(rowKey, value)

	return nil
}

// Get implements the tableEditAccumulator interface.
func (pke *pkTableEditAccumulator) Get(value sql.Row) (sql.Row, bool, error) {
	rowKey := pke.getRowKey(value)

	r, exists := pke.adds.Get(rowKey)
	if exists {
		return r, true, nil
	}

	r, exists = pke.deletes.Get(rowKey)
	if exists {
		return r, false, nil
	}

	pkColIdxes := pke.pkColumnIndexes()
	for _, partition := range pke.tableData.partitions {
		for _, partitionRow := range partition {
			if columnsMatch(pkColIdxes, nil, partitionRow, value, pke.tableData.schema.Schema) {
				return partitionRow, true, nil
			}
		}
	}

	return nil, false, nil
}

// GetByCols finds a row that has the same |cols| values as |value|.
func (pke *pkTableEditAccumulator) GetByCols(value sql.Row, cols []int, prefixLengths []uint16) (sql.Row, bool, error) {
	// If we have this row in any delete, bail.
	if _, _, exists := pke.deletes.FindForeach(func(key string, r sql.Row) bool {
		return columnsMatch(cols, prefixLengths, r, value, pke.tableData.schema.Schema)
	}); exists {
		return nil, false, nil
	}

	if _, r, exists := pke.adds.FindForeach(func(key string, r sql.Row) bool {
		return columnsMatch(cols, prefixLengths, r, value, pke.tableData.schema.Schema)
	}); exists {
		return r, true, nil
	}

	for _, partition := range pke.tableData.partitions {
		for _, partitionRow := range partition {
			if columnsMatch(cols, prefixLengths, partitionRow, value, pke.tableData.schema.Schema) {
				return partitionRow, true, nil
			}
		}
	}

	return nil, false, nil
}

// ApplyEdits implements the tableEditAccumulator interface.
func (pke *pkTableEditAccumulator) ApplyEdits(ctx *sql.Context, table *Table) error {

	if err := pke.deletes.Foreach(func(key string, val sql.Row) error {
		return pke.deleteHelper(ctx, pke.tableData, val)

	}); err != nil {
		return err
	}

	if err := pke.adds.Foreach(func(key string, val sql.Row) error {
		return pke.insertHelper(ctx, pke.tableData, val)

	}); err != nil {
		return err
	}

	pke.tableData.sortRows(ctx)
	table.replaceData(pke.tableData)

	return nil
}

// Clear implements the tableEditAccumulator interface.
func (pke *pkTableEditAccumulator) Clear() {
	pke.adds = cmap.NewMap[string, sql.Row]()
	pke.deletes = cmap.NewMap[string, sql.Row]()
}

// pkColumnIndexes returns the indexes of the primary partitionKeys in the initialized tableData.
func (pke *pkTableEditAccumulator) pkColumnIndexes() []int {
	return pke.tableData.schema.PkOrdinals
}

// getRowKey returns a sql.Row of the primary partitionKeys a row in relation with the initialized tableData.
func (pke *pkTableEditAccumulator) getRowKey(r sql.Row) string {
	var rowKey strings.Builder
	for _, i := range pke.tableData.schema.PkOrdinals {
		rowKey.WriteString(fmt.Sprintf("%v", r[i]))
	}
	return rowKey.String()
}

// deleteHelper deletes the given row from the tableData.
func (pke *pkTableEditAccumulator) deleteHelper(ctx *sql.Context, table *TableData, row sql.Row) error {
	if err := checkRow(ctx, table.schema.Schema, row); err != nil {
		return err
	}

	matches := false
	var partKey string
	var rowIdx int
	for partName, partition := range table.partitions {
		for partitionRowIndex, partitionRow := range partition {
			matches = true

			// For DELETE queries, we will have previously selected the row in order to delete it. For REPLACE, we will just
			// have the row to be replaced, so we need to consider primary key information.
			pkColIdxes := pke.pkColumnIndexes()
			if len(pkColIdxes) > 0 {
				if columnsMatch(pkColIdxes, nil, partitionRow, row, pke.tableData.schema.Schema) {
					table.partitions[partName] = append(partition[:partitionRowIndex], partition[partitionRowIndex+1:]...)
					partKey = partName
					rowIdx = partitionRowIndex
					break
				}
			}

			var err error
			matches, err = partitionRow.Equals(ctx, row, table.schema.PhysicalSchema())
			if err != nil {
				return err
			}

			if matches {
				table.partitions[partName] = append(partition[:partitionRowIndex], partition[partitionRowIndex+1:]...)
				partKey = partName
				rowIdx = partitionRowIndex
				break
			}
		}

		if matches {
			break
		}
	}

	deleteRowFromIndexes(table, partKey, rowIdx)

	return nil
}

// deleteRowFromIndexes removes the row at the given partition and index from all indexes
func deleteRowFromIndexes(table *TableData, partKey string, rowIdx int) {
	for _, idx := range table.indexes {
		memIdx := idx.(*Index)
		idxStorage := table.secondaryIndexStorage[indexName(memIdx.ID())]
		// Iterate backwards so we can remove the trailing N elements without triggering range errors on multiple passes
		// through the loop
		for i := len(idxStorage) - 1; i >= 0; i-- {
			idxRow := idxStorage[i]
			rowLoc := idxRow[len(idxRow)-1].(primaryRowLocation)
			if rowLoc.partition == partKey && rowLoc.idx == rowIdx {
				idxStorage = append(idxStorage[:i], idxStorage[i+1:]...)
			} else if rowLoc.partition == partKey && rowLoc.idx > rowIdx {
				// For rows after the one we deleted, offset the row index by -1
				idxRow[len(idxRow)-1] = primaryRowLocation{rowLoc.partition, rowLoc.idx - 1}
			}
		}
		table.secondaryIndexStorage[indexName(memIdx.ID())] = idxStorage
	}
}

// insertHelper inserts the given row into the given tableData.
func (pke *pkTableEditAccumulator) insertHelper(ctx *sql.Context, table *TableData, row sql.Row) error {
	partIdx, err := table.partition(ctx, row)
	if err != nil {
		return err
	}
	key := string(table.partitionKeys[partIdx])

	pkColIdxes := pke.pkColumnIndexes()
	savedPartitionIndex := ""
	savedPartitionRowIndex := -1
	if len(pkColIdxes) > 0 {
		for partitionIndex, partition := range table.partitions {
			for partitionRowIndex, partitionRow := range partition {
				if columnsMatch(pkColIdxes, nil, partitionRow, row, pke.tableData.schema.Schema) {
					// Instead of throwing a unique key error, we perform an update operation to essentially represent
					// map semantics for the keyed table.
					savedPartitionIndex = partitionIndex
					savedPartitionRowIndex = partitionRowIndex
					break
				}
			}
		}
	}

	storageRow := pke.tableData.toStorageRow(row)

	var partKey string
	var rowIdx int
	if savedPartitionRowIndex > -1 {
		table.partitions[savedPartitionIndex][savedPartitionRowIndex] = storageRow
		partKey = savedPartitionIndex
		rowIdx = savedPartitionRowIndex
	} else {
		table.partitions[key] = append(table.partitions[key], storageRow)
		partKey = key
		rowIdx = len(table.partitions[key]) - 1
	}

	err = addRowToIndexes(table, row, partKey, rowIdx)
	if err != nil {
		return err
	}

	return nil
}

// addRowToIndexes adds the given row to all indexes
func addRowToIndexes(table *TableData, row sql.Row, partKey string, rowIdx int) error {
	for _, idx := range table.indexes {
		memIdx := idx.(*Index)
		idxRow, err := memIdx.rowToIndexStorage(row, partKey, rowIdx)
		if err != nil {
			return err
		}
		table.secondaryIndexStorage[indexName(memIdx.ID())] = append(table.secondaryIndexStorage[indexName(memIdx.ID())], idxRow)
	}
	return nil
}

// keylessTableEditAccumulator manages updates for a keyless tableData.
type keylessTableEditAccumulator struct {
	tableData *TableData
	adds      []sql.Row
	deletes   []sql.Row
}

var _ tableEditAccumulator = (*keylessTableEditAccumulator)(nil)

func (k *keylessTableEditAccumulator) TableData() *TableData {
	return k.tableData
}

// Insert implements the tableEditAccumulator interface.
func (k *keylessTableEditAccumulator) Insert(ctx *sql.Context, value sql.Row) error {
	for i, row := range k.deletes {
		eq, err := value.Equals(ctx, row, k.tableData.schema.Schema.PhysicalSchema())
		if err != nil {
			return err
		}

		if eq {
			k.deletes = append(k.deletes[:i], k.deletes[i+1:]...)
			return nil
		}
	}

	k.adds = append(k.adds, value)
	return nil
}

// Delete implements the tableEditAccumulator interface.
func (k *keylessTableEditAccumulator) Delete(ctx *sql.Context, value sql.Row) error {
	for i, row := range k.adds {
		eq, err := value.Equals(ctx, row, k.tableData.schema.Schema.PhysicalSchema())
		if err != nil {
			return err
		}

		if eq {
			k.adds = append(k.adds[:i], k.adds[i+1:]...)
			return nil
		}

	}

	k.deletes = append(k.deletes, value)
	return nil
}

// Get implements the tableEditAccumulator interface.
func (k *keylessTableEditAccumulator) Get(value sql.Row) (sql.Row, bool, error) {
	// Note: Keyless tables do not have to return an accurate answer here as any given row can be inserted or deleted
	// multiple times.
	return nil, false, nil
}

func (k *keylessTableEditAccumulator) GetByCols(value sql.Row, cols []int, prefixLengths []uint16) (sql.Row, bool, error) {
	deleteCount := 0
	for _, r := range k.deletes {
		if columnsMatch(cols, prefixLengths, r, value, k.tableData.schema.Schema) {
			deleteCount++
		}
	}

	for _, partition := range k.tableData.partitions {
		for _, partitionRow := range partition {
			if columnsMatch(cols, prefixLengths, partitionRow, value, k.tableData.schema.Schema) {
				if deleteCount == 0 {
					return partitionRow, true, nil
				}
				deleteCount--
			}
		}
	}

	for _, r := range k.adds {
		if columnsMatch(cols, prefixLengths, r, value, k.tableData.schema.Schema) {
			if deleteCount == 0 {
				return r, true, nil
			}
			deleteCount--
		}
	}

	return nil, false, nil
}

// ApplyEdits implements the tableEditAccumulator interface.
func (k *keylessTableEditAccumulator) ApplyEdits(ctx *sql.Context, table *Table) error {
	for _, val := range k.deletes {
		err := k.deleteHelper(ctx, k.tableData, val)
		if err != nil {
			return err
		}
	}

	for _, val := range k.adds {
		err := k.insertHelper(ctx, k.tableData, val)
		if err != nil {
			return err
		}
	}

	// The primary index is unsorted, but we still need to sort the secondary indexes
	k.tableData.sortSecondaryIndexes(ctx)

	table.replaceData(k.tableData)
	return nil
}

// Clear implements the tableEditAccumulator interface.
func (k *keylessTableEditAccumulator) Clear() {
	k.adds = make([]sql.Row, 0)
	k.deletes = make([]sql.Row, 0)
}

// deleteHelper deletes a row from a keyless tableData, if it exists.
func (k *keylessTableEditAccumulator) deleteHelper(ctx *sql.Context, table *TableData, row sql.Row) error {
	if err := checkRow(ctx, table.schema.Schema, row); err != nil {
		return err
	}

	storageRow := k.tableData.toStorageRow(row)

	matches := false
	var partKey string
	var rowIdx int
	for partitionIndex, partition := range table.partitions {
		for partitionRowIndex, partitionRow := range partition {
			matches = true
			var err error
			matches, err = partitionRow.Equals(ctx, storageRow, table.schema.Schema.PhysicalSchema())
			if err != nil {
				return err
			}

			if matches {
				table.partitions[partitionIndex] = append(partition[:partitionRowIndex], partition[partitionRowIndex+1:]...)
				partKey = partitionIndex
				rowIdx = partitionRowIndex
				break
			}
		}
		if matches {
			break
		}
	}

	deleteRowFromIndexes(table, partKey, rowIdx)

	return nil
}

// insertHelper inserts into a keyless tableData.
func (k *keylessTableEditAccumulator) insertHelper(ctx *sql.Context, table *TableData, row sql.Row) error {
	partIdx, err := table.partition(ctx, row)
	if err != nil {
		return err
	}
	key := string(table.partitionKeys[partIdx])

	storageRow := k.tableData.toStorageRow(row)
	table.partitions[key] = append(table.partitions[key], storageRow)

	err = addRowToIndexes(table, row, key, len(table.partitions[key])-1)
	if err != nil {
		return err
	}

	return nil
}

func formatRow(r sql.Row, idxs []int) string {
	b := &strings.Builder{}
	b.WriteString("[")
	var seenOne bool
	for _, idx := range idxs {
		if seenOne {
			_, _ = fmt.Fprintf(b, ",")
		}
		_, _ = fmt.Fprintf(b, "%v", r[idx])
	}
	b.WriteString("]")
	return b.String()
}

func checkRow(ctx *sql.Context, schema sql.Schema, row sql.Row) error {
	for i, value := range row {
		c := schema[i]
		if !c.Check(ctx, value) {
			return sql.ErrInvalidType.New(value)
		}
	}

	return verifyRowTypes(row, schema)
}

func verifyRowTypes(row sql.Row, schema sql.Schema) error {
	if len(row) == len(schema) {
		for i := range schema {
			col := schema[i]
			rowVal := row[i]
			var valType reflect.Type
			if wrapper, isWrapper := rowVal.(sql.AnyWrapper); isWrapper {
				method, _ := reflect.TypeOf(wrapper).MethodByName("Unwrap")
				valType = method.Type.Out(0)
			} else {
				valType = reflect.TypeOf(rowVal)
			}
			expectedType := col.Type.ValueType()
			if valType != expectedType && rowVal != nil && !valType.AssignableTo(expectedType) {
				return fmt.Errorf("Actual Value Type: %s, Expected Value Type: %s", valType.String(), expectedType.String())
			}
		}
	}
	return nil
}
