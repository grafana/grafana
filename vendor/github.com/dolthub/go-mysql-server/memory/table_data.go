// Copyright 2023 Dolthub, Inc.
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
	"sort"
	"strconv"
	"strings"

	"github.com/cespare/xxhash/v2"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/hash"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// TableData encapsulates all schema and data for a table's schema and rows. Other aspects of a table can change
// freely as needed for different views on a table (column projections, index lookups, filters, etc.) but the
// storage of underlying data lives here.
type TableData struct {
	indexes                 map[string]sql.Index
	fkColl                  *ForeignKeyCollection
	secondaryIndexStorage   map[indexName][]sql.Row
	partitions              map[string][]sql.Row
	fullTextConfigTableName string
	tableName               string
	comment                 string
	dbName                  string
	schema                  sql.PrimaryKeySchema
	checks                  []sql.CheckDefinition
	partitionKeys           [][]byte
	autoColIdx              int
	autoIncVal              uint64
	collation               sql.CollationID
	primaryKeyIndexes       bool
}

type indexName string

// primaryRowLocation is a special marker element in index storage rows containing the partition and index of the row
// in the primary storage.
type primaryRowLocation struct {
	partition string
	idx       int
}

// Table returns a table with this data
func (td TableData) Table(database *BaseDatabase) *Table {
	return &Table{
		db:               database,
		name:             td.tableName,
		data:             &td,
		pkIndexesEnabled: td.primaryKeyIndexes,
	}
}

func (td TableData) copy() *TableData {
	sch := td.schema.Schema.Copy()
	pkSch := sql.NewPrimaryKeySchema(sch, td.schema.PkOrdinals...)
	td.schema = pkSch

	parts := make(map[string][]sql.Row, len(td.partitions))
	for k, v := range td.partitions {
		data := make([]sql.Row, len(v))
		copy(data, v)
		parts[k] = data
	}

	keys := make([][]byte, len(td.partitionKeys))
	for i := range td.partitionKeys {
		keys[i] = make([]byte, len(td.partitionKeys[i]))
		copy(keys[i], td.partitionKeys[i])
	}

	idxStorage := make(map[indexName][]sql.Row, len(td.secondaryIndexStorage))
	for k, v := range td.secondaryIndexStorage {
		data := make([]sql.Row, len(v))
		copy(data, v)
		idxStorage[k] = data
	}
	td.secondaryIndexStorage = idxStorage

	td.partitionKeys, td.partitions = keys, parts

	if td.checks != nil {
		checks := make([]sql.CheckDefinition, len(td.checks))
		copy(checks, td.checks)
		td.checks = checks
	}

	return &td
}

// partition returns the partition for the row given. Uses the primary key columns if they exist, or all columns
// otherwise
func (td TableData) partition(ctx *sql.Context, row sql.Row) (int, error) {
	var keyColumns []int
	if len(td.schema.PkOrdinals) > 0 {
		keyColumns = td.schema.PkOrdinals
	} else {
		keyColumns = make([]int, len(td.schema.Schema))
		for i := range keyColumns {
			keyColumns[i] = i
		}
	}

	hash := xxhash.New()
	var err error
	for i := range keyColumns {
		v := row[keyColumns[i]]
		if i > 0 {
			// separate each column with a null byte
			if _, err = hash.Write([]byte{0}); err != nil {
				return 0, err
			}
		}

		t, isStringType := td.schema.Schema[keyColumns[i]].Type.(sql.StringType)
		if isStringType && v != nil {
			v, err = types.ConvertToString(ctx, v, t, nil)
			if err == nil {
				err = t.Collation().WriteWeightString(hash, v.(string))
			}
		} else {
			_, err = fmt.Fprintf(hash, "%v", v)
		}
		if err != nil {
			return 0, err
		}
	}

	sum64 := hash.Sum64()
	return int(sum64 % uint64(len(td.partitionKeys))), nil
}

func (td *TableData) truncate(schema sql.PrimaryKeySchema) *TableData {
	var keys [][]byte
	var partitions = map[string][]sql.Row{}
	numParts := len(td.partitionKeys)

	for i := 0; i < numParts; i++ {
		key := strconv.Itoa(i)
		keys = append(keys, []byte(key))
		partitions[key] = []sql.Row{}
	}

	td.partitionKeys = keys
	td.partitions = partitions
	td.schema = schema

	td.indexes = rewriteIndexes(td.indexes, schema)
	td.secondaryIndexStorage = make(map[indexName][]sql.Row)

	td.autoIncVal = 0
	if schema.HasAutoIncrement() {
		td.autoIncVal = 1
	}
	for i, col := range schema.Schema {
		if col.AutoIncrement {
			td.autoColIdx = i
			break
		}
	}

	return td
}

// rewriteIndexes returns a new set of indexes appropriate for the new schema provided. Index expressions are adjusted
// as necessary, and any indexes for columns that no longer exist are removed from the set.
func rewriteIndexes(indexes map[string]sql.Index, schema sql.PrimaryKeySchema) map[string]sql.Index {
	newIdxes := make(map[string]sql.Index)
	for name, idx := range indexes {
		newIdx := rewriteIndex(idx.(*Index), schema)
		if newIdx != nil {
			newIdxes[name] = newIdx
		}
	}
	return newIdxes
}

// rewriteIndex returns a new index appropriate for the new schema provided, or nil if no columns remain to be indexed
// in the schema
func rewriteIndex(idx *Index, schema sql.PrimaryKeySchema) *Index {
	var newExprs []sql.Expression
	for _, expr := range idx.Exprs {
		newE, _, _ := transform.Expr(expr, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
			if gf, ok := e.(*expression.GetField); ok {
				newIdx := schema.IndexOfColName(gf.Name())
				if newIdx < 0 {
					return nil, transform.SameTree, nil
				}
				return gf.WithIndex(newIdx), transform.NewTree, nil
			}

			return e, transform.SameTree, nil
		})
		if newE != nil {
			newExprs = append(newExprs, newE)
		}
	}

	if len(newExprs) == 0 {
		return nil
	}

	newIdx := *idx
	newIdx.Exprs = newExprs
	return &newIdx
}

func (td *TableData) columnIndexes(colNames []string) ([]int, error) {
	columns := make([]int, 0, len(colNames))

	for _, name := range colNames {
		i := td.schema.IndexOf(name, td.tableName)
		if i == -1 {
			return nil, errColumnNotFound.New(name)
		}

		columns = append(columns, i)
	}

	return columns, nil
}

// toStorageRow returns the given row normalized for storage, omitting virtual columns
func (td *TableData) toStorageRow(row sql.Row) sql.Row {
	if !td.schema.HasVirtualColumns() {
		return row
	}

	storageRow := make(sql.Row, len(td.schema.Schema))
	storageRowIdx := 0
	for i, col := range td.schema.Schema {
		if col.Virtual {
			continue
		}
		storageRow[storageRowIdx] = row[i]
		storageRowIdx++
	}

	return storageRow[:storageRowIdx]
}

func (td *TableData) numRows(ctx *sql.Context) (uint64, error) {
	var count uint64
	for _, rows := range td.partitions {
		count += uint64(len(rows))
	}

	return count, nil
}

// throws an error if any two or more rows share the same |cols| values.
func (td *TableData) errIfDuplicateEntryExist(ctx *sql.Context, cols []string, idxName string) error {
	columnMapping, err := td.columnIndexes(cols)

	// We currently skip validating duplicates on unique virtual columns.
	// Right now trying to validate them would just trigger a panic.
	// See https://github.com/dolthub/go-mysql-server/issues/2643
	for _, i := range columnMapping {
		if td.schema.Schema[i].Virtual {
			return nil
		}
	}

	if err != nil {
		return err
	}
	unique := make(map[uint64]struct{})
	for _, partition := range td.partitions {
		for _, row := range partition {
			idxPrefixKey := projectOnRow(columnMapping, row)
			if hasNulls(idxPrefixKey) {
				continue
			}
			h, err := hash.HashOf(ctx, td.schema.Schema, idxPrefixKey)
			if err != nil {
				return err
			}
			if _, ok := unique[h]; ok {
				return sql.NewUniqueKeyErr(formatRow(row, columnMapping), false, nil)
			}
			unique[h] = struct{}{}
		}
	}
	return nil
}

func hasNulls(row sql.Row) bool {
	for _, v := range row {
		if v == nil {
			return true
		}
	}
	return false
}

// getColumnOrdinal returns the index in the schema and column with the name given, if it exists, or -1, nil otherwise.
func (td *TableData) getColumnOrdinal(col string) (int, *sql.Column) {
	i := td.schema.IndexOf(col, td.tableName)
	if i == -1 {
		return -1, nil
	}

	return i, td.schema.Schema[i]
}

func (td *TableData) generateCheckName() string {
	i := 1
Top:
	for {
		name := fmt.Sprintf("%s_chk_%d", td.tableName, i)
		for _, check := range td.checks {
			if check.Name == name {
				i++
				continue Top
			}
		}
		return name
	}
}

func (td *TableData) indexColsForTableEditor() ([][]int, [][]uint16) {
	var uniqIdxCols [][]int
	var prefixLengths [][]uint16
	for _, idx := range td.indexes {
		if !idx.IsUnique() {
			continue
		}
		var colNames []string
		expressions := idx.(*Index).Exprs
		for _, exp := range expressions {
			colNames = append(colNames, exp.(*expression.GetField).Name())
		}
		colIdxs, err := td.columnIndexes(colNames)
		if err != nil {
			// this means that the column names in this index aren't in the schema, which can happen in the case of a
			// table rewrite
			continue
		}
		uniqIdxCols = append(uniqIdxCols, colIdxs)
		prefixLengths = append(prefixLengths, idx.PrefixLengths())
	}
	return uniqIdxCols, prefixLengths
}

// Sorts the rows in the partitions of the table to be in primary key order.
func (td *TableData) sortRows(ctx *sql.Context) {
	var pk []pkfield
	for _, column := range td.schema.Schema {
		if column.PrimaryKey {
			idx, col := td.getColumnOrdinal(column.Name)
			pk = append(pk, pkfield{i: idx, c: col})
		}
	}

	var flattenedRows []partitionRow
	for _, k := range td.partitionKeys {
		p := td.partitions[string(k)]
		for i := 0; i < len(p); i++ {
			flattenedRows = append(flattenedRows, partitionRow{string(k), i})
		}
	}

	sort.Sort(partitionssort{
		pk:      pk,
		ps:      td.partitions,
		allRows: flattenedRows,
		indexes: td.secondaryIndexStorage,
		ctx:     ctx,
	})

	td.sortSecondaryIndexes(ctx)
}

func (td *TableData) sortSecondaryIndexes(ctx *sql.Context) {
	for idxName, idxStorage := range td.secondaryIndexStorage {
		idx := td.indexes[strings.ToLower(string(idxName))].(*Index)
		fieldIndexes := idx.columnIndexes(td.schema.Schema)
		types := make([]sql.Type, len(fieldIndexes))
		for i, idx := range fieldIndexes {
			types[i] = td.schema.Schema[idx].Type
		}
		sort.Slice(idxStorage, func(i, j int) bool {
			for t, typ := range types {
				left := idxStorage[i][t]
				right := idxStorage[j][t]

				// Compare doesn't handle nil values, so we need to handle that case. Nils sort before other values
				if left == nil {
					if right == nil {
						continue
					} else {
						return true
					}
				} else if right == nil {
					return false
				}

				compare, err := typ.Compare(ctx, left, right)
				if err != nil {
					panic(err)
				}
				if compare != 0 {
					return compare < 0
				}
			}
			return false
		})
	}
}

func (td TableData) virtualColIndexes() []int {
	var indexes []int
	for i, col := range td.schema.Schema {
		if col.Virtual {
			indexes = append(indexes, i)
		}
	}
	return indexes
}

func insertValueInRows(ctx *sql.Context, data *TableData, colIdx int, colDefault *sql.ColumnDefaultValue) error {
	for k, p := range data.partitions {
		newP := make([]sql.Row, len(p))
		for i, row := range p {
			var newRow sql.Row
			newRow = append(newRow, row[:colIdx]...)
			newRow = append(newRow, nil)
			newRow = append(newRow, row[colIdx:]...)
			var err error
			if !data.schema.Schema[colIdx].Nullable && colDefault == nil {
				newRow[colIdx] = data.schema.Schema[colIdx].Type.Zero()
			} else {
				newRow[colIdx], err = colDefault.Eval(ctx, newRow)
				if err != nil {
					return err
				}
			}
			newP[i] = newRow
		}
		data.partitions[k] = newP
	}
	return nil
}
