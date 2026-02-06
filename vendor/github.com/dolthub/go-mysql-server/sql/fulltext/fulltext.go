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

package fulltext

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"hash"
	"io"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// IndexTableNames holds all of the names for each pseudo-index table used by a Full-Text index.
type IndexTableNames struct {
	Config      string
	Position    string
	DocCount    string
	GlobalCount string
	RowCount    string
}

// KeyType refers to the type of key that the columns belong to.
type KeyType byte

const (
	KeyType_Primary KeyType = iota
	KeyType_Unique
	KeyType_None
)

// KeyColumns contains all the information needed to create key columns for each Full-Text table.
type KeyColumns struct {
	// Name is the name of the key. Only unique keys will have a name.
	Name string
	// Positions represents the schema index positions for primary keys and unique keys.
	Positions []int
	// Type refers to the type of key that the columns belong to.
	Type KeyType
}

// Database allows a database to return a set of unique names that will be used for the pseudo-index tables with
// Full-Text indexes.
type Database interface {
	sql.Database
	sql.TableCreator
	CreateFulltextTableNames(ctx *sql.Context, parentTable string, parentIndexName string) (IndexTableNames, error)
}

// IndexAlterableTable represents a table that supports the creation of FULLTEXT indexes. Renaming and deleting
// the FULLTEXT index are both handled by RenameIndex and DropIndex respectively.
type IndexAlterableTable interface {
	sql.IndexAlterableTable
	// CreateFulltextIndex creates a FULLTEXT index for this table. The index should not create a backing store, as the
	// names of the tables given have already been created and will be managed by GMS as pseudo-indexes.
	CreateFulltextIndex(ctx *sql.Context, indexDef sql.IndexDef, keyCols KeyColumns, tableNames IndexTableNames) error
}

// Index contains additional information regarding the FULLTEXT index.
type Index interface {
	sql.Index
	// FullTextTableNames returns the names of the tables that represent the FULLTEXT index.
	FullTextTableNames(ctx *sql.Context) (IndexTableNames, error)
	// FullTextKeyColumns returns the key columns of its parent table that are used with this Full-Text index.
	FullTextKeyColumns(ctx *sql.Context) (KeyColumns, error)
}

// SearchModifier represents the search modifier when using MATCH ... AGAINST ...
type SearchModifier byte

const (
	SearchModifier_NaturalLanguage SearchModifier = iota
	SearchModifier_NaturalLangaugeQueryExpansion
	SearchModifier_Boolean
	SearchModifier_QueryExpansion
)

// HashRow returns a 64 character lowercase hexadecimal hash of the given row. This is intended for use with keyless tables.
func HashRow(ctx context.Context, row sql.Row) (string, error) {
	h := sha256.New()
	// Since we can't represent a NULL value in binary, we instead append the NULL results to the end, which will
	// give us a unique representation for representing NULL values.
	valIsNull := make([]bool, len(row))
	for i, val := range row {
		var err error
		valIsNull[i], err = writeHashedValue(ctx, h, val)
		if err != nil {
			return "", err
		}
	}

	if err := binary.Write(h, binary.LittleEndian, valIsNull); err != nil {
		return "", err
	}
	// Go's current implementation will always return lowercase hashes, but we'll convert for safety since it's not
	// explicitly stated in the API that it's a lowercase string, therefore it might change in the future (even if highly unlikely).
	return strings.ToLower(hex.EncodeToString(h.Sum(nil))), nil
}

// writeHashedValue writes the given value into the hash.
func writeHashedValue(ctx context.Context, h hash.Hash, val interface{}) (valIsNull bool, err error) {
	val, err = sql.UnwrapAny(ctx, val)
	if err != nil {
		return false, err
	}
	switch val := val.(type) {
	case int:
		if err := binary.Write(h, binary.LittleEndian, int64(val)); err != nil {
			return false, err
		}
	case uint:
		if err := binary.Write(h, binary.LittleEndian, uint64(val)); err != nil {
			return false, err
		}
	case string:
		if _, err := h.Write([]byte(val)); err != nil {
			return false, err
		}
	case []byte:
		if _, err := h.Write(val); err != nil {
			return false, err
		}
	case decimal.Decimal:
		bytes, err := val.GobEncode()
		if err != nil {
			return false, err
		}
		if _, err := h.Write(bytes); err != nil {
			return false, err
		}
	case decimal.NullDecimal:
		if !val.Valid {
			return true, nil
		} else {
			bytes, err := val.Decimal.GobEncode()
			if err != nil {
				return false, err
			}
			if _, err := h.Write(bytes); err != nil {
				return false, err
			}
		}
	case time.Time:
		bytes, err := val.MarshalBinary()
		if err != nil {
			return false, err
		}
		if _, err := h.Write(bytes); err != nil {
			return false, err
		}
	case types.GeometryValue:
		if _, err := h.Write(val.Serialize()); err != nil {
			return false, err
		}
	case sql.JSONWrapper:
		str, err := types.JsonToMySqlString(ctx, val)
		if err != nil {
			return false, err
		}
		if _, err := h.Write([]byte(str)); err != nil {
			return false, err
		}
	case nil:
		return true, nil
	default:
		if err := binary.Write(h, binary.LittleEndian, val); err != nil {
			return false, err
		}
	}
	return false, nil
}

// GetKeyColumns returns the key columns from the parent table that will be used to uniquely reference any given row on
// the parent table. For many tables, this will be the primary key. For tables that do not have a valid key, the columns
// will be much more important.
func GetKeyColumns(ctx *sql.Context, parent sql.Table) (KeyColumns, []*sql.Column, error) {
	var columns []*sql.Column
	var positions []int
	// Check for a primary key. We'll only check on tables that implement sql.PrimaryKeyTable as we need to replicate
	// the declaration order, and there's no guarantee that the order is sequential with a standard sql.Schema.
	if pkTable, ok := parent.(sql.PrimaryKeyTable); ok {
		sch := pkTable.PrimaryKeySchema()
		if len(sch.PkOrdinals) > 0 {
			positions = make([]int, len(sch.PkOrdinals))
			copy(positions, sch.PkOrdinals)
			nameIdx := 0
			for _, ordinal := range sch.PkOrdinals {
				newCol := sch.Schema[ordinal].Copy()
				newCol.Name = fmt.Sprintf("C%d", nameIdx)
				columns = append(columns, newCol)
				nameIdx++
			}
			return KeyColumns{
				Type:      KeyType_Primary,
				Name:      "",
				Positions: positions,
			}, columns, nil
		}
	}
	// Check for a unique key (we'll just use the first one we find)
	if idxTable, ok := parent.(sql.IndexAddressableTable); ok {
		indexes, err := idxTable.GetIndexes(ctx)
		if err != nil {
			return KeyColumns{}, nil, err
		}
		for _, index := range indexes {
			if !index.IsUnique() {
				continue
			}

			// Create a map from schema column expression to position
			parentSch := parent.Schema()
			parentColMap := GetParentColumnMap(parentSch)

			// Map from expression to position
			hasNullableCol := false
			for i, expr := range index.Expressions() {
				parentColPosition, ok := parentColMap[strings.ToLower(expr)]
				if !ok {
					return KeyColumns{}, nil, fmt.Errorf("table `%s` UNIQUE index `%s` references the column `%s` but it could not be found",
						parent.Name(), index.ID(), expr)
				}
				newCol := parentSch[parentColPosition].Copy()
				newCol.Name = fmt.Sprintf("C%d", i)
				newCol.PrimaryKey = true
				columns = append(columns, newCol)
				positions = append(positions, parentColPosition)
				hasNullableCol = hasNullableCol || newCol.Nullable
			}
			// We don't want to consider unique keys that have nullable columns, since they can have duplicate keys
			if hasNullableCol {
				continue
			}

			return KeyColumns{
				Type:      KeyType_Unique,
				Name:      index.ID(),
				Positions: positions,
			}, columns, nil
		}
	}
	// No applicable keys were found, so we'll hash the row in exchange for a lack of indexing support
	return KeyColumns{
		Type:      KeyType_None,
		Name:      "",
		Positions: nil,
	}, []*sql.Column{SchemaRowCount[0].Copy()}, nil
}

// GetCollationFromSchema returns the WORD's collation. This assumes that it is only used with schemas from the position,
// doc count, and global count tables.
func GetCollationFromSchema(ctx *sql.Context, sch sql.Schema) sql.CollationID {
	collation, _ := sch[0].Type.CollationCoercibility(ctx)
	return collation
}

// NewSchema returns a new schema based on the given schema with all collated fields replaced with the given collation,
// the given key columns inserted after the first column, and all columns set to the source given.
func NewSchema(sch sql.Schema, insertCols []*sql.Column, source string, collation sql.CollationID) (newSch sql.Schema, err error) {
	// Create the new schema with the given key columns.
	// Key columns are always applied after the first column (key columns are not always provided).
	newSch = make(sql.Schema, 1, len(sch)+len(insertCols))
	newSch[0] = sch[0].Copy()
	for _, refCol := range insertCols {
		newSch = append(newSch, refCol.Copy())
	}
	for _, col := range sch[1:] {
		newSch = append(newSch, col.Copy())
	}
	// Assign the collation (if applicable) and source
	for _, col := range newSch {
		if collatedType, ok := col.Type.(sql.TypeWithCollation); ok {
			if col.Type, err = collatedType.WithNewCollation(collation); err != nil {
				return nil, err
			}
		}
		col.Source = source
	}
	return newSch, nil
}

// GetParentColumnMap is used to map index expressions to their source columns. All strings have been lowercased.
func GetParentColumnMap(parentSch sql.Schema) map[string]int {
	parentColMap := make(map[string]int)
	for i, col := range parentSch {
		parentColMap[strings.ToLower(col.Name)] = i
		parentColMap[strings.ToLower(col.Source)+"."+strings.ToLower(col.Name)] = i
	}
	return parentColMap
}

// DropAllIndexes drops all Full-Text pseudo-index tables and indexes that are declared on the given table.
func DropAllIndexes(ctx *sql.Context, tbl sql.IndexAddressableTable, db Database) error {
	// Check the interfaces on the parameters
	dropper, ok := db.(sql.TableDropper)
	if !ok {
		return sql.ErrIncompleteFullTextIntegration.New()
	}
	idxAlterable, ok := tbl.(sql.IndexAlterableTable)
	if !ok {
		return sql.ErrIncompleteFullTextIntegration.New()
	}

	// Load the indexes to search for Full-Text indexes
	indexes, err := tbl.GetIndexes(ctx)
	if err != nil {
		return err
	}
	droppedConfig := false
	for _, index := range indexes {
		// We don't have anything to drop on a non-Full-Text index
		if !index.IsFullText() {
			continue
		}
		ftIndex := index.(Index)
		tableNames, err := ftIndex.FullTextTableNames(ctx)
		if err != nil {
			return err
		}
		// We drop the config table only once, since it's shared by all index tables
		if !droppedConfig {
			droppedConfig = true
			if err = dropper.DropTable(ctx, tableNames.Config); err != nil {
				return err
			}
		}
		// We delete all other tables
		if err = dropper.DropTable(ctx, tableNames.Position); err != nil {
			return err
		}
		if err = dropper.DropTable(ctx, tableNames.DocCount); err != nil {
			return err
		}
		if err = dropper.DropTable(ctx, tableNames.GlobalCount); err != nil {
			return err
		}
		if err = dropper.DropTable(ctx, tableNames.RowCount); err != nil {
			return err
		}
		// Finally we'll drop the index
		if err = idxAlterable.DropIndex(ctx, ftIndex.ID()); err != nil {
			return err
		}
	}
	return nil
}

// RebuildTables rebuilds all Full-Text pseudo-index tables that are declared on the given table.
func RebuildTables(ctx *sql.Context, tbl sql.IndexAddressableTable, db Database) error {
	// Check the interfaces on the parameters
	dropper, ok := db.(sql.TableDropper)
	if !ok {
		return sql.ErrIncompleteFullTextIntegration.New()
	}
	idxAlterable, ok := tbl.(sql.IndexAlterableTable)
	if !ok {
		return sql.ErrIncompleteFullTextIntegration.New()
	}

	predeterminedNames := make(map[string]IndexTableNames)

	// Load the indexes to search for Full-Text indexes
	indexes, err := tbl.GetIndexes(ctx)
	if err != nil {
		return err
	}
	fulltextIndexes := make(sql.IndexDefs, 0, len(indexes))
	for _, index := range indexes {
		// Skip all non-Full-Text indexes
		if !index.IsFullText() {
			continue
		}
		// Store the index definition so that we may recreate it below
		ftIndex := index.(Index)
		exprs := ftIndex.Expressions()
		indexCols := make([]sql.IndexColumn, len(exprs))
		for i, expr := range exprs {
			indexCols[i] = sql.IndexColumn{
				Name: strings.TrimPrefix(expr, ftIndex.Table()+"."),
			}
		}
		fulltextIndexes = append(fulltextIndexes, &sql.IndexDef{
			Name:       ftIndex.ID(),
			Columns:    indexCols,
			Constraint: sql.IndexConstraint_Fulltext,
			Storage:    sql.IndexUsing_Default,
			Comment:    ftIndex.Comment(),
		})
		tableNames, err := ftIndex.FullTextTableNames(ctx)
		if err != nil {
			return err
		}
		predeterminedNames[ftIndex.ID()] = tableNames
		// We delete all tables besides the config table
		if err = dropper.DropTable(ctx, tableNames.Position); err != nil {
			return err
		}
		if err = dropper.DropTable(ctx, tableNames.DocCount); err != nil {
			return err
		}
		if err = dropper.DropTable(ctx, tableNames.GlobalCount); err != nil {
			return err
		}
		if err = dropper.DropTable(ctx, tableNames.RowCount); err != nil {
			return err
		}
		// Finally we'll drop the index
		if err = idxAlterable.DropIndex(ctx, ftIndex.ID()); err != nil {
			return err
		}
	}
	return CreateFulltextIndexes(ctx, db, tbl, predeterminedNames, fulltextIndexes)
}

// DropColumnFromTables removes the given column from all of the Full-Text indexes, which will trigger a rebuild if the
// index spans multiple columns, but will trigger a deletion if the index spans that single column. The column name is
// case-insensitive.
func DropColumnFromTables(ctx *sql.Context, tbl sql.IndexAddressableTable, db Database, colName string) error {
	// Check the interfaces on the parameters
	dropper, ok := db.(sql.TableDropper)
	if !ok {
		return sql.ErrIncompleteFullTextIntegration.New()
	}
	idxAlterable, ok := tbl.(sql.IndexAlterableTable)
	if !ok {
		return sql.ErrIncompleteFullTextIntegration.New()
	}

	lowercaseColName := strings.ToLower(colName)
	configTableReuse := make(map[string]bool)
	predeterminedNames := make(map[string]IndexTableNames)

	// Load the indexes to search for Full-Text indexes
	indexes, err := tbl.GetIndexes(ctx)
	if err != nil {
		return err
	}

	var fulltextIndexes sql.IndexDefs
	for _, index := range indexes {
		// Skip all non-Full-Text indexes
		if !index.IsFullText() {
			continue
		}
		// Store the index definition so that we may recreate it below
		ftIndex := index.(Index)
		tableNames, err := ftIndex.FullTextTableNames(ctx)
		if err != nil {
			return err
		}
		predeterminedNames[ftIndex.ID()] = tableNames
		// Iterate over the columns to search for the given column
		exprs := ftIndex.Expressions()
		var indexCols []sql.IndexColumn
		for _, expr := range exprs {
			exprColName := strings.TrimPrefix(expr, ftIndex.Table()+".")
			// Skip this column if it matches our given column
			if strings.ToLower(exprColName) == lowercaseColName {
				continue
			}
			indexCols = append(indexCols, sql.IndexColumn{
				Name:   exprColName,
				Length: 0,
			})
		}
		if len(indexCols) > 0 {
			// This index will continue to exist, so we want to preserve the config table
			fulltextIndexes = append(fulltextIndexes, &sql.IndexDef{
				Name:       ftIndex.ID(),
				Columns:    indexCols,
				Constraint: sql.IndexConstraint_Fulltext,
				Storage:    sql.IndexUsing_Default,
				Comment:    ftIndex.Comment(),
			})
			configTableReuse[tableNames.Config] = true
		} else {
			// This index will be deleted, so we should delete the config table if no other indexes will reuse the table
			if _, ok := configTableReuse[tableNames.Config]; !ok {
				configTableReuse[tableNames.Config] = false
			}
		}
		// We delete all tables besides the config table
		if err = dropper.DropTable(ctx, tableNames.Position); err != nil {
			return err
		}
		if err = dropper.DropTable(ctx, tableNames.DocCount); err != nil {
			return err
		}
		if err = dropper.DropTable(ctx, tableNames.GlobalCount); err != nil {
			return err
		}
		if err = dropper.DropTable(ctx, tableNames.RowCount); err != nil {
			return err
		}
		// Finally we'll drop the index
		if err = idxAlterable.DropIndex(ctx, ftIndex.ID()); err != nil {
			return err
		}
	}
	// Delete all orphaned config tables
	for configTableName, reused := range configTableReuse {
		if !reused {
			if err = dropper.DropTable(ctx, configTableName); err != nil {
				return err
			}
		}
	}
	return CreateFulltextIndexes(ctx, db, tbl, predeterminedNames, fulltextIndexes)
}

// CreateFulltextIndexes creates and populates Full-Text indexes on the target table.
func CreateFulltextIndexes(ctx *sql.Context, database Database, parent sql.Table,
	predeterminedNames map[string]IndexTableNames, fulltextIndexes sql.IndexDefs) error {
	if len(fulltextIndexes) == 0 {
		return nil
	}

	// Ensure that the needed interfaces have been implemented
	fulltextAlterable, ok := parent.(IndexAlterableTable)
	if !ok {
		return sql.ErrFullTextNotSupported.New()
	}
	if _, ok = fulltextAlterable.(sql.IndexAddressableTable); !ok {
		return sql.ErrFullTextNotSupported.New()
	}
	if _, ok = fulltextAlterable.(sql.StatisticsTable); !ok {
		return sql.ErrFullTextNotSupported.New()
	}
	tblSch := parent.Schema()

	// Grab the key columns, which we will share among all indexes
	keyCols, insertCols, err := GetKeyColumns(ctx, fulltextAlterable)
	if err != nil {
		return err
	}

	// Create unique tables for each index
	for _, fulltextIndex := range fulltextIndexes {
		// Get the collation that will be used, while checking for duplicate columns and ensuring they have valid types
		collation := sql.Collation_Unspecified
		exists := make(map[string]struct{})
		for _, indexCol := range fulltextIndex.Columns {
			indexColNameLower := strings.ToLower(indexCol.Name)
			if _, ok = exists[indexColNameLower]; ok {
				return sql.ErrFullTextDuplicateColumn.New(fulltextIndex.Name)
			}
			found := false
			for _, tblCol := range tblSch {
				if indexColNameLower == strings.ToLower(tblCol.Name) {
					if !types.IsTextOnly(tblCol.Type) {
						return sql.ErrFullTextInvalidColumnType.New()
					}
					colCollation, _ := tblCol.Type.CollationCoercibility(ctx)
					if collation == sql.Collation_Unspecified {
						collation = colCollation
					} else if collation != colCollation {
						return sql.ErrFullTextDifferentCollations.New()
					}
					found = true
					break
				}
			}
			if !found {
				return sql.ErrFullTextMissingColumn.New(indexCol.Name)
			}
			exists[indexColNameLower] = struct{}{}
		}

		// Grab the table names that we'll use
		var tableNames IndexTableNames
		if predeterminedName, ok := predeterminedNames[fulltextIndex.Name]; ok {
			tableNames = predeterminedName
		} else {
			tableNames, err = database.CreateFulltextTableNames(ctx, fulltextAlterable.Name(), fulltextIndex.Name)
			if err != nil {
				return err
			}
		}

		// We'll only create the config table if it doesn't already exist, since it is shared between all indexes on the table
		_, ok, err = database.GetTableInsensitive(ctx, tableNames.Config)
		if err != nil {
			return err
		}
		if !ok {
			// We create the config table first since it will be shared between all Full-Text indexes for this table
			configSch, err := NewSchema(SchemaConfig, nil, tableNames.Config, sql.Collation_Default)
			if err != nil {
				return err
			}
			err = database.CreateTable(ctx, tableNames.Config, sql.NewPrimaryKeySchema(configSch), sql.Collation_Default, "")
			if err != nil {
				return err
			}
		}

		// Create the additional tables
		positionSch, err := NewSchema(SchemaPosition, insertCols, tableNames.Position, collation)
		if err != nil {
			return err
		}
		err = database.CreateTable(ctx, tableNames.Position, sql.NewPrimaryKeySchema(positionSch), sql.Collation_Default, "")
		if err != nil {
			return err
		}
		docCountSch, err := NewSchema(SchemaDocCount, insertCols, tableNames.DocCount, collation)
		if err != nil {
			return err
		}
		err = database.CreateTable(ctx, tableNames.DocCount, sql.NewPrimaryKeySchema(docCountSch), sql.Collation_Default, "")
		if err != nil {
			return err
		}
		globalCountSch, err := NewSchema(SchemaGlobalCount, nil, tableNames.GlobalCount, collation)
		if err != nil {
			return err
		}
		err = database.CreateTable(ctx, tableNames.GlobalCount, sql.NewPrimaryKeySchema(globalCountSch), sql.Collation_Default, "")
		if err != nil {
			return err
		}
		rowCountSch, err := NewSchema(SchemaRowCount, nil, tableNames.RowCount, collation)
		if err != nil {
			return err
		}
		err = database.CreateTable(ctx, tableNames.RowCount, sql.NewPrimaryKeySchema(rowCountSch), sql.Collation_Default, "")
		if err != nil {
			return err
		}

		// Create the Full-Text index
		err = fulltextAlterable.CreateFulltextIndex(ctx, *fulltextIndex, keyCols, tableNames)
		if err != nil {
			return err
		}
	}

	// We'll populate all of the new tables, so we're grabbing the row iter of the parent table
	tblPartIter, err := parent.Partitions(ctx)
	if err != nil {
		return err
	}
	rowIter := sql.NewTableRowIter(ctx, parent, tblPartIter)
	defer rowIter.Close(ctx)

	// Next we'll get the "official" indexes and create table sets
	var configTbl EditableTable
	officialIndexes, err := parent.(sql.IndexAddressableTable).GetIndexes(ctx)
	if err != nil {
		return err
	}
	tableSets := make([]TableSet, 0, len(fulltextIndexes))
	for _, idx := range officialIndexes {
		if !idx.IsFullText() {
			continue
		}
		ftIdx, ok := idx.(Index)
		if !ok { // This should never happen
			panic("index returns true for FULLTEXT, but does not implement interface")
		}
		ftTableNames, err := ftIdx.FullTextTableNames(ctx)
		if err != nil { // This should never happen
			panic(err.Error())
		}

		if configTbl == nil {
			tbl, ok, err := database.GetTableInsensitive(ctx, ftTableNames.Config)
			if err != nil {
				panic(err)
			}
			if !ok {
				return fmt.Errorf("index `%s` declares the table `%s` as a FULLTEXT config table, but it could not be found", idx.ID(), ftTableNames.Config)
			}
			// We'll only do the check once, since we can fairly safely assume that the other tables will also implement the interface
			configTbl, ok = tbl.(EditableTable)
			if !ok {
				return fmt.Errorf("index `%s` declares the table `%s` as a FULLTEXT config table, however it does not implement EditableTable", idx.ID(), ftTableNames.Config)
			}
		}
		positionTbl, ok, err := database.GetTableInsensitive(ctx, ftTableNames.Position)
		if err != nil {
			panic(err)
		}
		if !ok {
			return fmt.Errorf("index `%s` declares the table `%s` as a FULLTEXT position table, but it could not be found", idx.ID(), ftTableNames.Position)
		}
		docCountTbl, ok, err := database.GetTableInsensitive(ctx, ftTableNames.DocCount)
		if err != nil {
			panic(err)
		}
		if !ok {
			return fmt.Errorf("index `%s` declares the table `%s` as a FULLTEXT doc count table, but it could not be found", idx.ID(), ftTableNames.DocCount)
		}
		globalCountTbl, ok, err := database.GetTableInsensitive(ctx, ftTableNames.GlobalCount)
		if err != nil {
			panic(err)
		}
		if !ok {
			return fmt.Errorf("index `%s` declares the table `%s` as a FULLTEXT global count table, but it could not be found", idx.ID(), ftTableNames.GlobalCount)
		}
		rowCountTbl, ok, err := database.GetTableInsensitive(ctx, ftTableNames.RowCount)
		if err != nil {
			panic(err)
		}
		if !ok {
			return fmt.Errorf("index `%s` declares the table `%s` as a FULLTEXT row count table, but it could not be found", idx.ID(), ftTableNames.RowCount)
		}

		tableSets = append(tableSets, TableSet{
			Index:       ftIdx,
			Position:    positionTbl.(EditableTable),
			DocCount:    docCountTbl.(EditableTable),
			GlobalCount: globalCountTbl.(EditableTable),
			RowCount:    rowCountTbl.(EditableTable),
		})
	}

	// Create the editor with the sets
	editor, err := CreateEditor(ctx, parent, configTbl, tableSets...)
	if err != nil {
		return err
	}
	defer editor.Close(ctx)

	// Finally, loop over all of the rows and write them to the tables
	editor.StatementBegin(ctx)
	row, err := rowIter.Next(ctx)
	for ; err == nil; row, err = rowIter.Next(ctx) {
		if err = editor.Insert(ctx, row); err != nil {
			return err
		}
	}
	if err == io.EOF {
		return editor.StatementComplete(ctx)
	} else if err != nil {
		_ = editor.DiscardChanges(ctx, err)
		return err
	}
	return editor.StatementComplete(ctx)
}

// validateSchema compares two schemas to make sure that they're compatible. This is used to verify that the
// given Full-Text tables have the correct schemas. In practice, this shouldn't fail unless the integrator allows the
// user to modify the tables' schemas.
func validateSchema(ftTblName string, parentSch sql.Schema, sch sql.Schema, expected sql.Schema, keyCols KeyColumns) (err error) {
	var revisedExpected sql.Schema
	if keyCols.Type != KeyType_None {
		// This will still work for tables that do not have key columns
		if len(expected)+len(keyCols.Positions) != len(sch) {
			return fmt.Errorf("Full-Text table `%s` has an unexpected number of columns", ftTblName)
		}
		revisedExpected = make(sql.Schema, 1, len(expected)+len(keyCols.Positions))
		revisedExpected[0] = expected[0]
		for i, pos := range keyCols.Positions {
			newKeyCol := *parentSch[pos]
			newKeyCol.Name = fmt.Sprintf("C%d", i)
			newKeyCol.PrimaryKey = true
			revisedExpected = append(revisedExpected, &newKeyCol)
		}
		revisedExpected = append(revisedExpected, expected[1:]...)
	} else {
		if len(expected)+1 != len(sch) {
			return fmt.Errorf("Full-Text table `%s` has an unexpected number of columns", ftTblName)
		}
		revisedExpected = make(sql.Schema, 2, len(expected)+1)
		revisedExpected[0] = expected[0]
		revisedExpected[1] = SchemaRowCount[0].Copy()
		revisedExpected = append(revisedExpected, expected[1:]...)
	}
	for i := range sch {
		col := *sch[i]
		expectedCol := *revisedExpected[i]
		if col.Generated != nil || expectedCol.Generated != nil {
			// It might be fine for Full-Text to reference generated columns, but we aren't completely sure of any
			// potential implementation issues, so it's disabled for now.
			return fmt.Errorf("Full-Text does not currently support generated columns")
		}
		// The expected schemas use the default collation, so we set them to the given column's collation for comparison
		if expectedColStrType, ok := expectedCol.Type.(sql.TypeWithCollation); ok {
			colStrType, ok := col.Type.(sql.TypeWithCollation)
			if !ok {
				return fmt.Errorf("Full-Text table `%s` has an incorrect type for the column `%s`", ftTblName, col.Name)
			}
			expectedCol.Type, err = expectedColStrType.WithNewCollation(colStrType.Collation())
			if err != nil {
				return err
			}
		}
		// We can't just use the Equals() function on the columns as they care about fields that we do not.
		if col.Name != expectedCol.Name || !col.Type.Equals(expectedCol.Type) || col.PrimaryKey != expectedCol.PrimaryKey || col.Nullable != expectedCol.Nullable ||
			col.AutoIncrement != expectedCol.AutoIncrement {
			return fmt.Errorf("Full-Text table `%s` column `%s` has an incorrect definition", ftTblName, col.Name)
		}
	}
	return nil
}
