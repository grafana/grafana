// Copyright 2022 Dolthub, Inc.
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
	"io"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ChildParentMapping is a mapping from the foreign key columns of a child schema to the parent schema. The position
// in the slice corresponds to the position in the child schema, while the value at a given position refers to the
// position in the parent schema. For all columns that are not in the foreign key definition, a value of -1 is returned.
//
// Here's an example:
// parent Schema: x1, x2, x3, x4, x5
// child Schema:  y1, y2, y3, y4
// FOREIGN KEY (y2) REFERENCES parent (x4)
//
// The slice for the above would be [-1, 3, -1, -1]. The foreign key uses the column "y2" on the child, which is the
// second position in the schema (and therefore the second position in the mapping). The equivalent parent column is
// "x4", which is in the fourth position (so 3 with zero-based indexed).
type ChildParentMapping []int

// ForeignKeyRefActionData contains the mapper, editor, and child to parent mapping for processing referential actions.
type ForeignKeyRefActionData struct {
	RowMapper          *ForeignKeyRowMapper
	Editor             *ForeignKeyEditor
	ChildParentMapping ChildParentMapping
	ForeignKey         sql.ForeignKeyConstraint
}

// ForeignKeyEditor handles update and delete operations, as they may have referential actions on other tables (such as
// cascading). If this editor is Cyclical, then that means that following the referential actions will eventually lead
// back to this same editor. Self-referential foreign keys are inherently cyclical.
type ForeignKeyEditor struct {
	Schema     sql.Schema
	Editor     sql.ForeignKeyEditor
	References []*ForeignKeyReferenceHandler
	RefActions []ForeignKeyRefActionData
	Cyclical   bool
}

// IsInitialized returns whether this editor has been initialized. The given map is used to prevent cycles, as editors
// will reference themselves if a cycle is formed between foreign keys.
func (fkEditor *ForeignKeyEditor) IsInitialized(editors map[*ForeignKeyEditor]struct{}) bool {
	if fkEditor == nil || fkEditor.Editor == nil {
		return false
	}
	if _, ok := editors[fkEditor]; ok {
		return true
	}
	editors[fkEditor] = struct{}{}
	for _, reference := range fkEditor.References {
		if !reference.IsInitialized() {
			return false
		}
	}
	for _, refAction := range fkEditor.RefActions {
		if !refAction.Editor.IsInitialized(editors) {
			return false
		}
	}
	return true
}

// Update handles both the standard UPDATE statement and propagated referential actions from a parent table's ON UPDATE.
func (fkEditor *ForeignKeyEditor) Update(ctx *sql.Context, old sql.Row, new sql.Row, depth int) error {
	for _, reference := range fkEditor.References {
		// Only check the reference for the columns that are updated
		hasChange := false
		for _, idx := range reference.RowMapper.IndexPositions {
			cmp, err := fkEditor.Schema[idx].Type.Compare(ctx, old[idx], new[idx])
			if err != nil {
				return err
			}
			if cmp != 0 {
				hasChange = true
				break
			}
		}
		if !hasChange {
			continue
		}
		if err := reference.CheckReference(ctx, new); err != nil {
			return err
		}
	}
	for _, refActionData := range fkEditor.RefActions {
		switch refActionData.ForeignKey.OnUpdate {
		default: // RESTRICT and friends
			if err := fkEditor.OnUpdateRestrict(ctx, refActionData, old, new); err != nil {
				return err
			}
		case sql.ForeignKeyReferentialAction_Cascade:
		case sql.ForeignKeyReferentialAction_SetNull:
		case sql.ForeignKeyReferentialAction_SetDefault:
		}
	}
	if err := fkEditor.Editor.Update(ctx, old, new); err != nil {
		return err
	}
	for _, refActionData := range fkEditor.RefActions {
		switch refActionData.ForeignKey.OnUpdate {
		case sql.ForeignKeyReferentialAction_Cascade:
			if err := fkEditor.OnUpdateCascade(ctx, refActionData, old, new, depth+1); err != nil {
				return err
			}
		case sql.ForeignKeyReferentialAction_SetNull:
			if err := fkEditor.OnUpdateSetNull(ctx, refActionData, old, new, depth+1); err != nil {
				return err
			}
		case sql.ForeignKeyReferentialAction_SetDefault:
			if err := fkEditor.OnUpdateSetDefault(ctx, refActionData, old, new, depth+1); err != nil {
				return err
			}
		}
	}
	return nil
}

// OnUpdateRestrict handles the ON UPDATE RESTRICT referential action.
func (fkEditor *ForeignKeyEditor) OnUpdateRestrict(ctx *sql.Context, refActionData ForeignKeyRefActionData, old sql.Row, new sql.Row) error {
	if ok, err := fkEditor.ColumnsUpdated(ctx, refActionData, old, new); err != nil {
		return err
	} else if !ok {
		return nil
	}

	rowIter, err := refActionData.RowMapper.GetIter(ctx, old, false)
	if err != nil {
		return err
	}
	defer rowIter.Close(ctx)
	if _, err = rowIter.Next(ctx); err == nil {
		return sql.ErrForeignKeyParentViolation.New(refActionData.ForeignKey.Name,
			refActionData.ForeignKey.Table, refActionData.ForeignKey.ParentTable, refActionData.RowMapper.GetKeyString(old))
	}
	if err != io.EOF {
		return err
	}
	return nil
}

// OnUpdateCascade handles the ON UPDATE CASCADE referential action.
func (fkEditor *ForeignKeyEditor) OnUpdateCascade(ctx *sql.Context, refActionData ForeignKeyRefActionData, old sql.Row, new sql.Row, depth int) error {
	if ok, err := fkEditor.ColumnsUpdated(ctx, refActionData, old, new); err != nil {
		return err
	} else if !ok {
		return nil
	}

	rowIter, err := refActionData.RowMapper.GetIter(ctx, old, false)
	if err != nil {
		return err
	}
	defer rowIter.Close(ctx)
	var rowToUpdate sql.Row
	for rowToUpdate, err = rowIter.Next(ctx); err == nil; rowToUpdate, err = rowIter.Next(ctx) {
		if depth > 15 {
			return sql.ErrForeignKeyDepthLimit.New()
		}
		updatedRow := make(sql.Row, len(rowToUpdate))
		for i := range rowToUpdate {
			mappedVal := refActionData.ChildParentMapping[i]
			if mappedVal == -1 {
				updatedRow[i] = rowToUpdate[i]
			} else {
				updatedRow[i] = new[mappedVal]
			}
		}
		err = refActionData.Editor.Update(ctx, rowToUpdate, updatedRow, depth)
		if err != nil {
			return err
		}
	}
	if err == io.EOF {
		return nil
	}
	return err
}

// OnUpdateSetDefault handles the ON UPDATE SET DEFAULT referential action.
func (fkEditor *ForeignKeyEditor) OnUpdateSetDefault(ctx *sql.Context, refActionData ForeignKeyRefActionData, old sql.Row, new sql.Row, depth int) error {
	if ok, err := fkEditor.ColumnsUpdated(ctx, refActionData, old, new); err != nil {
		return err
	} else if !ok {
		return nil
	}

	rowIter, err := refActionData.RowMapper.GetIter(ctx, old, false)
	if err != nil {
		return err
	}
	defer rowIter.Close(ctx)
	var rowToDefault sql.Row
	for rowToDefault, err = rowIter.Next(ctx); err == nil; rowToDefault, err = rowIter.Next(ctx) {
		// MySQL seems to have a bug where cyclical foreign keys return an error at a depth of 15 instead of 16.
		// This replicates the observed behavior, regardless of whether we're replicating a bug or intentional behavior.
		if depth >= 15 {
			if fkEditor.Cyclical {
				return sql.ErrForeignKeyDepthLimit.New()
			} else if depth > 15 {
				return sql.ErrForeignKeyDepthLimit.New()
			}
		}

		modifiedRow := make(sql.Row, len(rowToDefault))
		for i := range rowToDefault {
			// Row contents are nil by default, so we only need to assign the non-affected values
			if refActionData.ChildParentMapping[i] == -1 {
				modifiedRow[i] = rowToDefault[i]
			} else {
				col := refActionData.Editor.Schema[i]
				if col.Default != nil {
					newVal, err := col.Default.Eval(ctx, rowToDefault)
					if err != nil {
						return err
					}
					modifiedRow[i] = newVal
				}
			}
		}
		err = refActionData.Editor.Update(ctx, rowToDefault, modifiedRow, depth)
		if err != nil {
			return err
		}
	}
	if err == io.EOF {
		return nil
	}
	return err
}

// OnUpdateSetNull handles the ON UPDATE SET NULL referential action.
func (fkEditor *ForeignKeyEditor) OnUpdateSetNull(ctx *sql.Context, refActionData ForeignKeyRefActionData, old sql.Row, new sql.Row, depth int) error {
	if ok, err := fkEditor.ColumnsUpdated(ctx, refActionData, old, new); err != nil {
		return err
	} else if !ok {
		return nil
	}

	rowIter, err := refActionData.RowMapper.GetIter(ctx, old, false)
	if err != nil {
		return err
	}
	defer rowIter.Close(ctx)
	var rowToUpdate sql.Row
	for rowToUpdate, err = rowIter.Next(ctx); err == nil; rowToUpdate, err = rowIter.Next(ctx) {
		if depth > 15 {
			return sql.ErrForeignKeyDepthLimit.New()
		}
		updatedRow := make(sql.Row, len(rowToUpdate))
		for i := range rowToUpdate {
			// Row contents are nil by default, so we only need to assign the non-affected values
			if refActionData.ChildParentMapping[i] == -1 {
				updatedRow[i] = rowToUpdate[i]
			}
		}
		err = refActionData.Editor.Update(ctx, rowToUpdate, updatedRow, depth)
		if err != nil {
			return err
		}
	}
	if err == io.EOF {
		return nil
	}
	return err
}

// Delete handles both the standard DELETE statement and propagated referential actions from a parent table's ON DELETE.
func (fkEditor *ForeignKeyEditor) Delete(ctx *sql.Context, row sql.Row, depth int) error {
	// TODO: may need to process some cascades after the update to avoid recursive violations, write some tests on this
	for _, refActionData := range fkEditor.RefActions {
		switch refActionData.ForeignKey.OnDelete {
		default: // RESTRICT and friends
			if err := fkEditor.OnDeleteRestrict(ctx, refActionData, row); err != nil {
				return err
			}
		case sql.ForeignKeyReferentialAction_Cascade:
		case sql.ForeignKeyReferentialAction_SetNull:
		case sql.ForeignKeyReferentialAction_SetDefault:
		}
	}
	if err := fkEditor.Editor.Delete(ctx, row); err != nil {
		return err
	}
	for _, refActionData := range fkEditor.RefActions {
		switch refActionData.ForeignKey.OnDelete {
		case sql.ForeignKeyReferentialAction_Cascade:
			if err := fkEditor.OnDeleteCascade(ctx, refActionData, row, depth+1); err != nil {
				return err
			}
		case sql.ForeignKeyReferentialAction_SetNull:
			if err := fkEditor.OnDeleteSetNull(ctx, refActionData, row, depth+1); err != nil {
				return err
			}
		case sql.ForeignKeyReferentialAction_SetDefault:
			if err := fkEditor.OnDeleteSetDefault(ctx, refActionData, row, depth+1); err != nil {
				return err
			}
		}
	}
	return nil
}

// OnDeleteRestrict handles the ON DELETE RESTRICT referential action.
func (fkEditor *ForeignKeyEditor) OnDeleteRestrict(ctx *sql.Context, refActionData ForeignKeyRefActionData, row sql.Row) error {
	rowIter, err := refActionData.RowMapper.GetIter(ctx, row, false)
	if err != nil {
		return err
	}
	defer rowIter.Close(ctx)
	if _, err = rowIter.Next(ctx); err == nil {
		return sql.ErrForeignKeyParentViolation.New(refActionData.ForeignKey.Name,
			refActionData.ForeignKey.Table, refActionData.ForeignKey.ParentTable, refActionData.RowMapper.GetKeyString(row))
	}
	if err != io.EOF {
		return err
	}
	return nil
}

// OnDeleteCascade handles the ON DELETE CASCADE referential action.
func (fkEditor *ForeignKeyEditor) OnDeleteCascade(ctx *sql.Context, refActionData ForeignKeyRefActionData, row sql.Row, depth int) error {
	rowIter, err := refActionData.RowMapper.GetIter(ctx, row, false)
	if err != nil {
		return err
	}
	defer rowIter.Close(ctx)
	var rowToDelete sql.Row
	for rowToDelete, err = rowIter.Next(ctx); err == nil; rowToDelete, err = rowIter.Next(ctx) {
		// MySQL seems to have a bug where cyclical foreign keys return an error at a depth of 15 instead of 16.
		// This replicates the observed behavior, regardless of whether we're replicating a bug or intentional behavior.
		if depth >= 15 {
			if fkEditor.Cyclical {
				return sql.ErrForeignKeyDepthLimit.New()
			} else if depth > 15 {
				return sql.ErrForeignKeyDepthLimit.New()
			}
		}
		err = refActionData.Editor.Delete(ctx, rowToDelete, depth)
		if err != nil {
			return err
		}
	}
	if err == io.EOF {
		return nil
	}
	return err
}

// OnDeleteSetDefault handles the ON DELETE SET DEFAULT referential action.
func (fkEditor *ForeignKeyEditor) OnDeleteSetDefault(ctx *sql.Context, refActionData ForeignKeyRefActionData, row sql.Row, depth int) error {
	rowIter, err := refActionData.RowMapper.GetIter(ctx, row, false)
	if err != nil {
		return err
	}
	defer rowIter.Close(ctx)
	var rowToDefault sql.Row
	for rowToDefault, err = rowIter.Next(ctx); err == nil; rowToDefault, err = rowIter.Next(ctx) {
		// MySQL seems to have a bug where cyclical foreign keys return an error at a depth of 15 instead of 16.
		// This replicates the observed behavior, regardless of whether we're replicating a bug or intentional behavior.
		if depth >= 15 {
			if fkEditor.Cyclical {
				return sql.ErrForeignKeyDepthLimit.New()
			} else if depth > 15 {
				return sql.ErrForeignKeyDepthLimit.New()
			}
		}

		modifiedRow := make(sql.Row, len(rowToDefault))
		for i := range rowToDefault {
			// Row contents are nil by default, so we only need to assign the non-affected values
			if refActionData.ChildParentMapping[i] == -1 {
				modifiedRow[i] = rowToDefault[i]
			} else {
				col := refActionData.Editor.Schema[i]
				if col.Default != nil {
					newVal, err := col.Default.Eval(ctx, rowToDefault)
					if err != nil {
						return err
					}
					modifiedRow[i] = newVal
				}
			}
		}
		err = refActionData.Editor.Update(ctx, rowToDefault, modifiedRow, depth)
		if err != nil {
			return err
		}
	}
	if err == io.EOF {
		return nil
	}
	return err
}

// OnDeleteSetNull handles the ON DELETE SET NULL referential action.
func (fkEditor *ForeignKeyEditor) OnDeleteSetNull(ctx *sql.Context, refActionData ForeignKeyRefActionData, row sql.Row, depth int) error {
	rowIter, err := refActionData.RowMapper.GetIter(ctx, row, false)
	if err != nil {
		return err
	}
	defer rowIter.Close(ctx)
	var rowToNull sql.Row
	for rowToNull, err = rowIter.Next(ctx); err == nil; rowToNull, err = rowIter.Next(ctx) {
		// MySQL seems to have a bug where cyclical foreign keys return an error at a depth of 15 instead of 16.
		// This replicates the observed behavior, regardless of whether we're replicating a bug or intentional behavior.
		if depth >= 15 {
			if fkEditor.Cyclical {
				return sql.ErrForeignKeyDepthLimit.New()
			} else if depth > 15 {
				return sql.ErrForeignKeyDepthLimit.New()
			}
		}
		nulledRow := make(sql.Row, len(rowToNull))
		for i := range rowToNull {
			// Row contents are nil by default, so we only need to assign the non-affected values
			if refActionData.ChildParentMapping[i] == -1 {
				nulledRow[i] = rowToNull[i]
			}
		}
		err = refActionData.Editor.Update(ctx, rowToNull, nulledRow, depth)
		if err != nil {
			return err
		}
	}
	if err == io.EOF {
		return nil
	}
	return err
}

// ColumnsUpdated returns whether the columns involved in the foreign key were updated. Some updates may only update
// columns that are not involved in a foreign key, and therefore we should ignore a CASCADE or SET NULL referential
// action in such cases.
func (fkEditor *ForeignKeyEditor) ColumnsUpdated(ctx *sql.Context, refActionData ForeignKeyRefActionData, old sql.Row, new sql.Row) (bool, error) {
	for _, mappedVal := range refActionData.ChildParentMapping {
		if mappedVal == -1 {
			continue
		}
		oldVal := old[mappedVal]
		newVal := new[mappedVal]
		cmp, err := fkEditor.Schema[mappedVal].Type.Compare(ctx, oldVal, newVal)
		if err != nil {
			return false, err
		}
		if cmp != 0 {
			return true, nil
		}
	}
	return false, nil
}

// Close closes this handler along with all child handlers.
func (fkEditor *ForeignKeyEditor) Close(ctx *sql.Context) error {
	err := fkEditor.Editor.Close(ctx)
	for _, child := range fkEditor.RefActions {
		nErr := child.Editor.Close(ctx)
		if err == nil {
			err = nErr
		}
	}
	return err
}

// ForeignKeyReferenceHandler handles references to any parent rows to verify they exist.
type ForeignKeyReferenceHandler struct {
	SelfCols   map[string]int
	RowMapper  ForeignKeyRowMapper
	ForeignKey sql.ForeignKeyConstraint
}

// IsInitialized returns whether this reference handler has been initialized.
func (reference *ForeignKeyReferenceHandler) IsInitialized() bool {
	return reference.RowMapper.IsInitialized()
}

// CheckReference checks that the given row has an index entry in the referenced table.
func (reference *ForeignKeyReferenceHandler) CheckReference(ctx *sql.Context, row sql.Row) error {
	// If even one of the values are NULL then we don't check the parent
	for _, pos := range reference.RowMapper.IndexPositions {
		if row[pos] == nil {
			return nil
		}
	}

	rowIter, err := reference.RowMapper.GetIter(ctx, row, true)
	if err != nil {
		return err
	}
	defer rowIter.Close(ctx)

	parentRow, err := rowIter.Next(ctx)
	if err != nil && err != io.EOF {
		// For SET types, conversion failures during foreign key validation should be treated as foreign key violations
		if sql.ErrConvertingToSet.Is(err) || sql.ErrInvalidSetValue.Is(err) {
			return sql.ErrForeignKeyChildViolation.New(reference.ForeignKey.Name, reference.ForeignKey.Table,
				reference.ForeignKey.ParentTable, reference.RowMapper.GetKeyString(row))
		}
		return err
	}
	if err == nil {
		// We have a parent row, but check for type-specific validation
		if validationErr := reference.validateColumnTypeConstraints(ctx, row, parentRow); validationErr != nil {
			return validationErr
		}

		// We have a parent row so throw no error
		return nil
	}

	if reference.ForeignKey.IsSelfReferential() {
		allMatch := true
		for i := range reference.ForeignKey.Columns {
			colPos := reference.SelfCols[strings.ToLower(reference.ForeignKey.Columns[i])]
			refPos := reference.SelfCols[strings.ToLower(reference.ForeignKey.ParentColumns[i])]
			cmp, err := reference.RowMapper.SourceSch[colPos].Type.Compare(ctx, row[colPos], row[refPos])
			if err != nil {
				return err
			}
			if cmp != 0 {
				allMatch = false
				break
			}
		}
		if allMatch {
			return nil
		}
	}

	return sql.ErrForeignKeyChildViolation.New(reference.ForeignKey.Name, reference.ForeignKey.Table,
		reference.ForeignKey.ParentTable, reference.RowMapper.GetKeyString(row))
}

// validateColumnTypeConstraints enforces foreign key type validation between child and parent columns in a foreign key relationship.
func (reference *ForeignKeyReferenceHandler) validateColumnTypeConstraints(ctx *sql.Context, childRow sql.Row, parentRow sql.Row) error {
	mapper := reference.RowMapper
	if mapper.Index == nil {
		return nil
	}

	for parentIdx, parentCol := range mapper.Index.ColumnExpressionTypes() {
		if parentIdx >= len(mapper.IndexPositions) {
			break
		}

		parentType := parentCol.Type
		childType := mapper.SourceSch[mapper.IndexPositions[parentIdx]].Type
		hasViolation := false

		// For decimal types, scales must match exactly
		childDecimal, childOk := childType.(sql.DecimalType)
		parentDecimal, parentOk := parentType.(sql.DecimalType)
		if childOk && parentOk {
			hasViolation = childDecimal.Scale() != parentDecimal.Scale()
		}

		// For time types, require exact type matching (including precision)
		// TODO: The TIME type currently normalizes all precisions to TIME(6) internally,
		// which means TIME and TIME(n) are all treated as TIME(6). This prevents proper
		// precision validation between different TIME types in foreign keys.
		// See time.go:"TIME is implemented as TIME(6)."
		isChildTime := types.IsTime(childType) || types.IsTimespan(childType)
		isParentTime := types.IsTime(parentType) || types.IsTimespan(parentType)
		if isChildTime && isParentTime {
			hasViolation = hasViolation || !childType.Equals(parentType)
		}

		if hasViolation {
			return sql.ErrForeignKeyChildViolation.New(
				reference.ForeignKey.Name,
				reference.ForeignKey.Table,
				reference.ForeignKey.ParentTable,
				mapper.GetKeyString(childRow),
			)
		}
	}
	return nil
}

// CheckTable checks that every row in the table has an index entry in the referenced table.
func (reference *ForeignKeyReferenceHandler) CheckTable(ctx *sql.Context, tbl sql.ForeignKeyTable) error {
	partIter, err := tbl.Partitions(ctx)
	if err != nil {
		return err
	}
	rowIter := sql.NewTableRowIter(ctx, tbl, partIter)
	defer rowIter.Close(ctx)
	for row, err := rowIter.Next(ctx); err == nil; row, err = rowIter.Next(ctx) {
		err = reference.CheckReference(ctx, row)
		if err != nil {
			return err
		}
	}
	if err != io.EOF {
		return err
	}
	return nil
}

// ForeignKeyRowMapper takes a source row and returns all matching rows on the contained table according to the row
// mapping from the source columns to the contained index's columns.
type ForeignKeyRowMapper struct {
	Index     sql.Index
	Updater   sql.ForeignKeyEditor
	SourceSch sql.Schema
	// TargetTypeConversions are a set of functions to transform the value in the table to the corresponding value in the
	// other table. This is required when the types of the two tables are compatible but different (e.g. INT and BIGINT).
	TargetTypeConversions []ForeignKeyTypeConversionFn
	// IndexPositions hold the mapping between an index's column position and the source row's column position. Given
	// an index (x1, x2) and a source row (y1, y2, y3) and the relation (x1->y3, x2->y1), this slice would contain
	// [2, 0]. The first index column "x1" maps to the third source column "y3" (so position 2 since it's zero-based),
	// and the second index column "x2" maps to the first source column "y1" (position 0).
	IndexPositions []int
	// AppendTypes hold any types that may be needed to complete an index range's generation. Foreign keys are allowed
	// to use an index's prefix, and indexes expect ranges to reference all of their columns (not just the prefix), so
	// we grab the types of the suffix index columns to append to the range after the prefix columns that we're
	// referencing.
	AppendTypes []sql.Type
}

// IsInitialized returns whether this mapper has been initialized.
func (mapper *ForeignKeyRowMapper) IsInitialized() bool {
	return mapper.Updater != nil && mapper.Index != nil
}

// GetIter returns a row iterator for all rows that match the given source row.
func (mapper *ForeignKeyRowMapper) GetIter(ctx *sql.Context, row sql.Row, refCheck bool) (sql.RowIter, error) {
	rang := make(sql.MySQLRange, len(mapper.IndexPositions)+len(mapper.AppendTypes))
	for rangPosition, rowPos := range mapper.IndexPositions {
		rowVal := row[rowPos]
		// If any value is NULL then it is ignored by foreign keys
		if rowVal == nil {
			return sql.RowsToRowIter(), nil
		}

		targetType := mapper.SourceSch[rowPos].Type

		// Transform the type of the value in this row to the one in the other table for the index lookup, if necessary
		if mapper.TargetTypeConversions != nil && mapper.TargetTypeConversions[rowPos] != nil {
			var err error
			targetType, rowVal, err = mapper.TargetTypeConversions[rowPos](ctx, rowVal)
			// An error means the type conversion failed, which typically means there's no way to convert the value given to
			// the target value because of e.g. range constraints (trying to assign an INT to a TINYINT column). We treat
			// this as an empty result for this iterator, since this value cannot possibly be present in the other table.
			if err != nil {
				return sql.RowsToRowIter(), nil
			}
		}

		rang[rangPosition] = sql.ClosedRangeColumnExpr(rowVal, rowVal, targetType)
	}
	for i, appendType := range mapper.AppendTypes {
		rang[i+len(mapper.IndexPositions)] = sql.AllRangeColumnExpr(appendType)
	}

	if !mapper.Index.CanSupport(ctx, rang) {
		return nil, ErrInvalidLookupForIndexedTable.New(rang.DebugString())
	}
	// TODO: profile this, may need to redesign this or add a fast path
	lookup := sql.IndexLookup{Ranges: sql.MySQLRangeCollection{rang}, Index: mapper.Index}

	editorData := mapper.Updater.IndexedAccess(ctx, lookup)

	if rc, ok := editorData.(sql.ReferenceChecker); refCheck && ok {
		err := rc.SetReferenceCheck()
		if err != nil {
			return nil, err
		}
	}

	partIter, err := editorData.LookupPartitions(ctx, lookup)
	if err != nil {
		return nil, err
	}
	return sql.NewTableRowIter(ctx, editorData, partIter), nil
}

// GetKeyString returns a string representing the key used to access the index.
func (mapper *ForeignKeyRowMapper) GetKeyString(row sql.Row) string {
	keyStrParts := make([]string, len(mapper.IndexPositions))
	for i, rowPos := range mapper.IndexPositions {
		keyStrParts[i] = fmt.Sprint(row[rowPos])
	}
	return fmt.Sprintf("[%s]", strings.Join(keyStrParts, ","))
}

// GetChildParentMapping returns a mapping from the foreign key columns of a child schema to the parent schema.
func GetChildParentMapping(parentSch sql.Schema, childSch sql.Schema, fkDef sql.ForeignKeyConstraint) (ChildParentMapping, error) {
	mapping := make(ChildParentMapping, len(childSch))
	for i := range mapping {
		mapping[i] = -1
	}
	for i := range fkDef.Columns {
		childIndex := childSch.IndexOfColName(fkDef.Columns[i])
		if childIndex < 0 {
			return nil, fmt.Errorf("foreign key `%s` refers to column `%s` on table `%s` but it could not be found",
				fkDef.Name, fkDef.Columns[i], fkDef.Table)
		}
		parentIndex := parentSch.IndexOfColName(fkDef.ParentColumns[i])
		if parentIndex < 0 {
			return nil, fmt.Errorf("foreign key `%s` refers to column `%s` on referenced table `%s` but it could not be found",
				fkDef.Name, fkDef.ParentColumns[i], fkDef.ParentTable)
		}
		mapping[childIndex] = parentIndex
	}
	return mapping, nil
}

// ForeignKeyTypeConversionDirection specifies whether a child column type is being converted to its parent type for
// constraint enforcement, or vice versa.
type ForeignKeyTypeConversionDirection byte

const (
	ChildToParent ForeignKeyTypeConversionDirection = iota
	ParentToChild
)

// ForeignKeyTypeConversionFn is a function that transforms a value from one type to another for foreign key constraint
// enforcement. The target type is returned along with the transformed value, or an error if the transformation fails.
type ForeignKeyTypeConversionFn func(ctx *sql.Context, val any) (sql.Type, any, error)

// GetForeignKeyTypeConversions returns a set of functions to convert a type in a one foreign key column table to the
// type in the corresponding table. Specify the schema of both child and parent tables, as well as whether the
// transformation is from child to parent or vice versa.
func GetForeignKeyTypeConversions(
	parentSch sql.Schema,
	childSch sql.Schema,
	fkDef sql.ForeignKeyConstraint,
	direction ForeignKeyTypeConversionDirection,
) ([]ForeignKeyTypeConversionFn, error) {
	var convFns []ForeignKeyTypeConversionFn

	for i := range fkDef.Columns {
		childIndex := childSch.IndexOfColName(fkDef.Columns[i])
		if childIndex < 0 {
			return nil, fmt.Errorf("foreign key `%s` refers to column `%s` on table `%s` but it could not be found",
				fkDef.Name, fkDef.Columns[i], fkDef.Table)
		}
		parentIndex := parentSch.IndexOfColName(fkDef.ParentColumns[i])
		if parentIndex < 0 {
			return nil, fmt.Errorf("foreign key `%s` refers to column `%s` on referenced table `%s` but it could not be found",
				fkDef.Name, fkDef.ParentColumns[i], fkDef.ParentTable)
		}

		childType := childSch[childIndex].Type
		parentType := parentSch[parentIndex].Type

		childExtendedType, ok := childType.(sql.ExtendedType)
		// if even one of the types is not an extended type, then we can't transform any values
		if !ok {
			return nil, nil
		}

		if !childType.Equals(parentType) {
			parentExtendedType, ok := parentType.(sql.ExtendedType)
			if !ok {
				// this should be impossible (child and parent should both be extended types), but just in case
				return nil, nil
			}

			fromType := childExtendedType
			toType := parentExtendedType
			if direction == ParentToChild {
				fromType = parentExtendedType
				toType = childExtendedType
			}

			if convFns == nil {
				convFns = make([]ForeignKeyTypeConversionFn, len(childSch))
			}
			convFns[childIndex] = func(ctx *sql.Context, val any) (sql.Type, any, error) {
				convertedVal, err := toType.ConvertToType(ctx, fromType, val)
				return toType, convertedVal, err
			}
		}
	}

	return convFns, nil
}
