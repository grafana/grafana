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
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
)

// EditableTable is a table that implements InsertableTable, UpdatableTable, and DeletableTable.
type EditableTable interface {
	sql.InsertableTable
	sql.UpdatableTable
	sql.DeletableTable
	sql.IndexAddressableTable
}

// TableSet contains the multiple tables that comprise a single FULLTEXT index. The config table is supplied separately,
// as it is shared among all of the tables.
type TableSet struct {
	// Index contains information regarding the FULLTEXT index.
	Index Index
	// Position refers to the table that maps each word to an ID and position.
	Position EditableTable
	// DocCount refers to the table that contains the word count per document.
	DocCount EditableTable
	// GlobalCount refers to the table that contains the word count across all documents.
	GlobalCount EditableTable
	// RowCount refers to the table that contains the count of all row hashes for the index.
	RowCount EditableTable
}

// TableEditor handles editors for FULLTEXT indexes. These indexes are implemented as standard tables, and therefore
// require the use of this editor to handle the transformation of rows.
type TableEditor struct {
	Config  IndexSingleEditor
	Indexes []IndexEditors
}

// IndexEditors represents an individual index's editors, along with the columns (and order) to source the text from.
type IndexEditors struct {
	Position    IndexSingleEditor
	DocCount    IndexSingleEditor
	GlobalCount IndexSingleEditor
	RowCount    IndexSingleEditor
	SourceCols  []int
	KeyCols     KeyColumns
	Collation   sql.CollationID
}

// IndexSingleEditor is an editor for a single table, which represents a portion of a single index.
type IndexSingleEditor struct {
	Editor sql.TableEditor
	Index  sql.Index
	Schema sql.Schema
}

var _ sql.TableEditor = TableEditor{}

// CreateEditor returns a TableEditor that will handle the transformation of rows destined for the parent table to the
// FULLTEXT tables.
func CreateEditor(ctx *sql.Context, parent sql.Table, config EditableTable, indexes ...TableSet) (editor TableEditor, err error) {
	parentSch := parent.Schema()
	// Verify that the schema for the config table is correct
	if err = validateSchema(config.Name(), parentSch, config.Schema(), SchemaConfig, KeyColumns{}); err != nil {
		return TableEditor{}, err
	}

	// This will be used to map index expressions to their source columns
	parentColMap := GetParentColumnMap(parentSch)

	// Check each index and create their editors
	editorIndexes := make([]IndexEditors, len(indexes))
	for i, index := range indexes {
		if !index.Index.IsFullText() {
			return TableEditor{}, fmt.Errorf("index `%s` is not a FULLTEXT index", index.Index.ID())
		}
		keyCols, err := index.Index.FullTextKeyColumns(ctx)
		if err != nil {
			return TableEditor{}, err
		}
		// Verify that the schema for the word tables are correct
		if err = validateSchema(index.Position.Name(), parentSch, index.Position.Schema(), SchemaPosition, keyCols); err != nil {
			return TableEditor{}, err
		}
		if err = validateSchema(index.DocCount.Name(), parentSch, index.DocCount.Schema(), SchemaDocCount, keyCols); err != nil {
			return TableEditor{}, err
		}
		if err = validateSchema(index.GlobalCount.Name(), parentSch, index.GlobalCount.Schema(), SchemaGlobalCount, KeyColumns{}); err != nil {
			return TableEditor{}, err
		}
		if err = validateSchema(index.RowCount.Name(), parentSch, index.RowCount.Schema(), SchemaRowCount, KeyColumns{}); err != nil {
			return TableEditor{}, err
		}
		// Map each indexes' columns to their respective table columns
		exprs := index.Index.Expressions()
		sourceCols := make([]int, len(exprs))
		for i, expr := range exprs {
			var ok bool
			sourceCols[i], ok = parentColMap[strings.ToLower(expr)]
			if !ok {
				return TableEditor{}, fmt.Errorf("table `%s` FULLTEXT index `%s` references the column `%s` but it could not be found",
					parent.Name(), index.Index.ID(), expr)
			}
		}
		// Create the index editors
		editorIndexes[i] = IndexEditors{
			Position: IndexSingleEditor{
				Editor: index.Position.Inserter(ctx).(sql.TableEditor),
				Index:  nil,
				Schema: index.Position.Schema(),
			},
			DocCount: IndexSingleEditor{
				Editor: index.DocCount.Inserter(ctx).(sql.TableEditor),
				Index:  nil,
				Schema: index.DocCount.Schema(),
			},
			GlobalCount: IndexSingleEditor{
				Editor: index.GlobalCount.Inserter(ctx).(sql.TableEditor),
				Index:  nil,
				Schema: index.GlobalCount.Schema(),
			},
			RowCount: IndexSingleEditor{
				Editor: index.RowCount.Inserter(ctx).(sql.TableEditor),
				Index:  nil,
				Schema: index.RowCount.Schema(),
			},
			SourceCols: sourceCols,
			KeyCols:    keyCols,
			Collation:  GetCollationFromSchema(ctx, index.DocCount.Schema()),
		}

		// Separately check that the editor is compatible with foreign keys, since we take advantage of the same functions
		_, ok1 := editorIndexes[i].Position.Editor.(sql.ForeignKeyEditor)
		_, ok2 := editorIndexes[i].DocCount.Editor.(sql.ForeignKeyEditor)
		_, ok3 := editorIndexes[i].GlobalCount.Editor.(sql.ForeignKeyEditor)
		_, ok4 := editorIndexes[i].RowCount.Editor.(sql.ForeignKeyEditor)
		if !ok1 || !ok2 || !ok3 || !ok4 {
			return TableEditor{}, fmt.Errorf("table `%s` FULLTEXT index `%s` references tables which do not implement the ForeignKeyEditor interface",
				parent.Name(), index.Index.ID())
		}

		// We make the assumption that all tables will have a single index which represents the primary key.
		indexes, err := index.Position.GetIndexes(ctx)
		if err != nil {
			return TableEditor{}, err
		}
		if len(indexes) != 1 || indexes[0].ID() != "PRIMARY" {
			return TableEditor{}, fmt.Errorf("table `%s` FULLTEXT index `%s` references the table `%s` which does not have a single index represented by the PRIMARY KEY",
				parent.Name(), index.Index.ID(), index.Position.Name())
		}
		editorIndexes[i].Position.Index = indexes[0]
		indexes, err = index.DocCount.GetIndexes(ctx)
		if err != nil {
			return TableEditor{}, err
		}
		if len(indexes) != 1 || indexes[0].ID() != "PRIMARY" {
			return TableEditor{}, fmt.Errorf("table `%s` FULLTEXT index `%s` references the table `%s` which does not have a single index represented by the PRIMARY KEY",
				parent.Name(), index.Index.ID(), index.DocCount.Name())
		}
		editorIndexes[i].DocCount.Index = indexes[0]
		indexes, err = index.GlobalCount.GetIndexes(ctx)
		if err != nil {
			return TableEditor{}, err
		}
		if len(indexes) != 1 || indexes[0].ID() != "PRIMARY" {
			return TableEditor{}, fmt.Errorf("table `%s` FULLTEXT index `%s` references the table `%s` which does not have a single index represented by the PRIMARY KEY",
				parent.Name(), index.Index.ID(), index.GlobalCount.Name())
		}
		editorIndexes[i].GlobalCount.Index = indexes[0]
		indexes, err = index.RowCount.GetIndexes(ctx)
		if err != nil {
			return TableEditor{}, err
		}
		if len(indexes) != 1 || indexes[0].ID() != "PRIMARY" {
			return TableEditor{}, fmt.Errorf("table `%s` FULLTEXT index `%s` references the table `%s` which does not have a single index represented by the PRIMARY KEY",
				parent.Name(), index.Index.ID(), index.RowCount.Name())
		}
		editorIndexes[i].RowCount.Index = indexes[0]
	}

	return TableEditor{
		Config: IndexSingleEditor{
			Editor: config.Inserter(ctx).(sql.TableEditor),
			Index:  nil,
			Schema: config.Schema(),
		},
		Indexes: editorIndexes,
	}, nil
}

// StatementBegin implements the interface sql.TableEditor.
func (editor TableEditor) StatementBegin(ctx *sql.Context) {
	editor.Config.Editor.StatementBegin(ctx)
	for _, editorIndex := range editor.Indexes {
		editorIndex.Position.Editor.StatementBegin(ctx)
		editorIndex.DocCount.Editor.StatementBegin(ctx)
		editorIndex.GlobalCount.Editor.StatementBegin(ctx)
		editorIndex.RowCount.Editor.StatementBegin(ctx)
	}
}

// DiscardChanges implements the interface sql.TableEditor.
func (editor TableEditor) DiscardChanges(ctx *sql.Context, errorEncountered error) error {
	err := editor.Config.Editor.DiscardChanges(ctx, errorEncountered)
	for _, editorIndex := range editor.Indexes {
		if nErr := editorIndex.Position.Editor.DiscardChanges(ctx, errorEncountered); err == nil {
			err = nErr
		}
		if nErr := editorIndex.DocCount.Editor.DiscardChanges(ctx, errorEncountered); err == nil {
			err = nErr
		}
		if nErr := editorIndex.GlobalCount.Editor.DiscardChanges(ctx, errorEncountered); err == nil {
			err = nErr
		}
		if nErr := editorIndex.RowCount.Editor.DiscardChanges(ctx, errorEncountered); err == nil {
			err = nErr
		}
	}
	return err
}

// StatementComplete implements the interface sql.TableEditor.
func (editor TableEditor) StatementComplete(ctx *sql.Context) error {
	err := editor.Config.Editor.StatementComplete(ctx)
	for _, editorIndex := range editor.Indexes {
		if nErr := editorIndex.Position.Editor.StatementComplete(ctx); err == nil {
			err = nErr
		}
		if nErr := editorIndex.DocCount.Editor.StatementComplete(ctx); err == nil {
			err = nErr
		}
		if nErr := editorIndex.GlobalCount.Editor.StatementComplete(ctx); err == nil {
			err = nErr
		}
		if nErr := editorIndex.RowCount.Editor.StatementComplete(ctx); err == nil {
			err = nErr
		}
	}
	return err
}

// Insert implements the interface sql.TableEditor.
func (editor TableEditor) Insert(ctx *sql.Context, row sql.Row) error {
	hash, err := HashRow(ctx, row)
	if err != nil {
		return err
	}

	for _, index := range editor.Indexes {
		// Grab the source columns
		sourceCols := make([]interface{}, len(index.SourceCols))
		for i, sourceCol := range index.SourceCols {
			sourceCols[i] = row[sourceCol]
		}

		// Get the row count for this exact row's hash
		rowCount, uniqueWords, err := editor.getRowCount(ctx, index, hash)
		if err != nil {
			return err
		}

		// If there are duplicate rows, then we don't need to write to all of the tables
		if rowCount >= 1 {
			// We'll update the row count since we're adding a row
			if err = index.RowCount.Editor.Update(ctx, sql.Row{hash, rowCount, uniqueWords}, sql.Row{hash, rowCount + 1, uniqueWords}); err != nil {
				return err
			}
			// We then need to update the global count, since it's dependent on the number of rows as well
			parser, err := NewDefaultParser(ctx, index.Collation, sourceCols...)
			if err != nil {
				return err
			}
			word, reachedTheEnd, err := parser.NextUnique(ctx)
			for ; err == nil && !reachedTheEnd; word, reachedTheEnd, err = parser.NextUnique(ctx) {
				if len(word) > maxWordLength {
					continue
				}
				if err = editor.updateGlobalCount(ctx, index, word, true); err != nil {
					return err
				}
			}
			if err != nil {
				return err
			}
			continue
		}

		// Add a new entry to the row count table
		parser, err := NewDefaultParser(ctx, index.Collation, sourceCols...)
		if err != nil {
			return err
		}
		if err = index.RowCount.Editor.Insert(ctx, sql.Row{hash, uint64(1), parser.UniqueWordCount(ctx)}); err != nil {
			return err
		}

		// Construct the values for the key columns
		var keyCols []interface{}
		if index.KeyCols.Type != KeyType_None {
			keyCols = make([]interface{}, len(index.KeyCols.Positions))
			for i, refCol := range index.KeyCols.Positions {
				keyCols[i] = row[refCol]
			}
		} else {
			keyCols = []interface{}{hash}
		}

		// Iterate over the words to write their positions
		word, position, reachedTheEnd, err := parser.Next(ctx)
		for ; err == nil && !reachedTheEnd; word, position, reachedTheEnd, err = parser.Next(ctx) {
			if len(word) > maxWordLength {
				continue
			}
			// Write to the position table
			positionRow := make(sql.Row, 1, len(SchemaPosition)+len(keyCols))
			positionRow[0] = word
			positionRow = append(positionRow, keyCols...)
			positionRow = append(positionRow, position)
			if err = index.Position.Editor.Insert(ctx, positionRow); err != nil {
				return err
			}
		}
		if err != nil {
			return err
		}

		// Iterate over the unique words to write their counts
		word, reachedTheEnd, err = parser.NextUnique(ctx)
		for ; err == nil && !reachedTheEnd; word, reachedTheEnd, err = parser.NextUnique(ctx) {
			if len(word) > maxWordLength {
				continue
			}
			// Write to the document count table
			wordDocCount, err := parser.DocumentCount(ctx, word)
			if err != nil {
				return err
			}
			docCountRow := make(sql.Row, 1, len(SchemaDocCount)+len(keyCols))
			docCountRow[0] = word
			docCountRow = append(docCountRow, keyCols...)
			docCountRow = append(docCountRow, wordDocCount)
			//TODO: write to this table only once, rather than ignoring duplicate errors
			if err = index.DocCount.Editor.Insert(ctx, docCountRow); err != nil && !sql.ErrPrimaryKeyViolation.Is(err) && !sql.ErrUniqueKeyViolation.Is(err) && !sql.ErrDuplicateEntry.Is(err) {
				return err
			}

			// Write to or update the global count table
			if err = editor.updateGlobalCount(ctx, index, word, true); err != nil {
				return err
			}
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// Update implements the interface sql.TableEditor.
func (editor TableEditor) Update(ctx *sql.Context, old sql.Row, new sql.Row) error {
	// I'm sure a bespoke UPDATE routine would be more efficient, but this will work for now
	if err := editor.Delete(ctx, old); err != nil {
		return err
	}
	return editor.Insert(ctx, new)
}

// Delete implements the interface sql.TableEditor.
func (editor TableEditor) Delete(ctx *sql.Context, row sql.Row) error {
	hash, err := HashRow(ctx, row)
	if err != nil {
		return err
	}

	for _, index := range editor.Indexes {
		// Grab the source columns
		sourceCols := make([]interface{}, len(index.SourceCols))
		for i, sourceCol := range index.SourceCols {
			if sourceCol >= len(row) {
				panic(fmt.Sprintf("%v", row))
			}
			sourceCols[i] = row[sourceCol]
		}

		// Get the row count for this exact row's hash
		rowCount, uniqueWords, err := editor.getRowCount(ctx, index, hash)
		if err != nil {
			return err
		}

		// If there are no rows, then we do not have anything that we need to do
		if rowCount == 0 {
			continue
		}

		// If there are duplicate rows, then we can decrement their counts and update the global counts
		if rowCount > 1 {
			// We'll update the row count since we're removing a row
			if err = index.RowCount.Editor.Update(ctx, sql.Row{hash, rowCount, uniqueWords}, sql.Row{hash, rowCount - 1, uniqueWords}); err != nil {
				return err
			}
			// We then need to update the global count, since it's dependent on the number of rows as well
			parser, err := NewDefaultParser(ctx, index.Collation, sourceCols...)
			if err != nil {
				return err
			}
			word, reachedTheEnd, err := parser.NextUnique(ctx)
			for ; err == nil && !reachedTheEnd; word, reachedTheEnd, err = parser.NextUnique(ctx) {
				if err = editor.updateGlobalCount(ctx, index, word, false); err != nil {
					return err
				}
			}
			if err != nil {
				return err
			}
			continue
		}

		// Remove the only entry from the row count table
		if err = index.RowCount.Editor.Delete(ctx, sql.Row{hash, uint64(1), uniqueWords}); err != nil {
			return err
		}

		// Construct the values for the key columns
		var keyCols []interface{}
		if index.KeyCols.Type != KeyType_None {
			keyCols = make([]interface{}, len(index.KeyCols.Positions))
			for i, refCol := range index.KeyCols.Positions {
				keyCols[i] = row[refCol]
			}
		} else {
			keyCols = []interface{}{hash}
		}

		// Iterate over the words to write their positions
		parser, err := NewDefaultParser(ctx, index.Collation, sourceCols...)
		if err != nil {
			return err
		}
		word, position, reachedTheEnd, err := parser.Next(ctx)
		for ; err == nil && !reachedTheEnd; word, position, reachedTheEnd, err = parser.Next(ctx) {
			if len(word) > maxWordLength {
				continue
			}
			// Delete from the position table
			positionRow := make(sql.Row, 1, len(SchemaPosition)+len(keyCols))
			positionRow[0] = word
			positionRow = append(positionRow, keyCols...)
			positionRow = append(positionRow, position)
			if err = index.Position.Editor.Delete(ctx, positionRow); err != nil {
				return err
			}
		}
		if err != nil {
			return err
		}

		// Iterate over the unique words to write their counts
		word, reachedTheEnd, err = parser.NextUnique(ctx)
		for ; err == nil && !reachedTheEnd; word, reachedTheEnd, err = parser.NextUnique(ctx) {
			// Delete from the document count table
			docCountRow := make(sql.Row, 1, len(SchemaDocCount)+len(keyCols))
			docCountRow[0] = word
			docCountRow = append(docCountRow, keyCols...)
			docCountRow = append(docCountRow, uint64(0)) // Since count isn't in the PK, this should be safe (caught by tests if not)
			if err = index.DocCount.Editor.Delete(ctx, docCountRow); err != nil {
				return err
			}

			// Delete from or update the global count table
			if err = editor.updateGlobalCount(ctx, index, word, false); err != nil {
				return err
			}
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// Close implements the interface sql.TableEditor.
func (editor TableEditor) Close(ctx *sql.Context) error {
	err := editor.Config.Editor.Close(ctx)
	for _, editorIndex := range editor.Indexes {
		if nErr := editorIndex.Position.Editor.Close(ctx); err == nil {
			err = nErr
		}
		if nErr := editorIndex.DocCount.Editor.Close(ctx); err == nil {
			err = nErr
		}
		if nErr := editorIndex.GlobalCount.Editor.Close(ctx); err == nil {
			err = nErr
		}
		if nErr := editorIndex.RowCount.Editor.Close(ctx); err == nil {
			err = nErr
		}
	}
	return err
}

// getRowCount returns the ROW_COUNT for the matching row's hash. A ROW_COUNT of zero means that there was no row.
func (TableEditor) getRowCount(ctx *sql.Context, ie IndexEditors, hash string) (rowCount uint64, uniqueWords uint64, err error) {
	lookup := sql.IndexLookup{Ranges: sql.MySQLRangeCollection{
		{
			sql.ClosedRangeColumnExpr(hash, hash, SchemaRowCount[0].Type),
		},
	}, Index: ie.RowCount.Index}

	editorData := ie.RowCount.Editor.(sql.ForeignKeyEditor).IndexedAccess(ctx, lookup)
	if err != nil {
		return 0, 0, err
	}

	partIter, err := editorData.LookupPartitions(ctx, lookup)
	if err != nil {
		return 0, 0, err
	}
	rows, err := sql.RowIterToRows(ctx, sql.NewTableRowIter(ctx, editorData, partIter))
	if err != nil {
		return 0, 0, err
	}
	if len(rows) == 0 {
		return 0, 0, nil
	} else if len(rows) > 1 {
		return 0, 0, fmt.Errorf("somehow there are duplicate entries within the Full-Text row count table")
	}
	return rows[0][1].(uint64), rows[0][2].(uint64), nil
}

// updateGlobalCount either increments or decrements the global count of the given word for the
func (TableEditor) updateGlobalCount(ctx *sql.Context, ie IndexEditors, word string, increment bool) error {
	lookup := sql.IndexLookup{Ranges: sql.MySQLRangeCollection{{sql.ClosedRangeColumnExpr(word, word, ie.GlobalCount.Schema[0].Type)}},
		Index: ie.GlobalCount.Index}
	editorData := ie.GlobalCount.Editor.(sql.ForeignKeyEditor).IndexedAccess(ctx, lookup)

	partIter, err := editorData.LookupPartitions(ctx, lookup)
	if err != nil {
		return err
	}
	rows, err := sql.RowIterToRows(ctx, sql.NewTableRowIter(ctx, editorData, partIter))
	if err != nil {
		return err
	}

	if len(rows) == 0 {
		// If there are no rows and we're decrementing it, then we don't need to do anything
		if !increment {
			return nil
		}
		// Our new count is 1, so we need to create a new entry
		return ie.GlobalCount.Editor.Insert(ctx, sql.Row{word, uint64(1)})
	} else if len(rows) != 1 {
		return fmt.Errorf("somehow there are duplicate entries within the Full-Text global count table")
	}
	row := rows[0]
	oldCount := row[len(row)-1].(uint64)
	// First we'll delete the existing row
	if err = ie.GlobalCount.Editor.Delete(ctx, row); err != nil {
		return err
	}
	// If we're incrementing, then we can add 1 to the old count
	if increment {
		if err = ie.GlobalCount.Editor.Insert(ctx, sql.Row{word, oldCount + 1}); err != nil {
			return err
		}
	} else if oldCount > 1 {
		// We're decrementing from a number higher than 1, so we need to update the row
		if err = ie.GlobalCount.Editor.Insert(ctx, sql.Row{word, oldCount - 1}); err != nil {
			return err
		}
	}
	return nil
}
