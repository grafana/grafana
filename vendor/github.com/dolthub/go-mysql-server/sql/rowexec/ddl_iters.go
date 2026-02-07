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

package rowexec

import (
	"bufio"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/dolthub/vitess/go/mysql"
	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/fulltext"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type loadDataIter struct {
	reader  io.ReadCloser
	scanner *bufio.Scanner

	fieldsTerminatedBy string
	linesTerminatedBy  string
	linesStartingBy    string
	fieldsEscapedBy    string
	fieldsEnclosedBy   string

	userVars            []sql.Expression
	setExprs            []sql.Expression
	fieldToColMap       []int
	destSch             sql.Schema
	ignoreNum           int64
	colCount            int
	fieldsEnclosedByOpt bool
}

var _ sql.RowIter = (*loadDataIter)(nil)
var _ sql.Closer = (*loadDataIter)(nil)

func (l *loadDataIter) Next(ctx *sql.Context) (returnRow sql.Row, returnErr error) {
	// skip first ignoreNum lines
	var err error
	for ; l.ignoreNum > 0 && l.scanner.Scan(); l.ignoreNum-- {
		if err = l.scanner.Err(); err != nil {
			l.reader.Close()
			return nil, err
		}
	}

	// If exprs is nil then this is a skipped line (see test cases). Keep skipping
	// until exprs != nil
	var exprs []sql.Expression
	for exprs == nil {
		if keepGoing := l.scanner.Scan(); !keepGoing {
			if err = l.scanner.Err(); err != nil {
				return nil, err
			}
			return nil, io.EOF
		}
		exprs, err = l.parseFields(ctx, l.scanner.Text())
		if err != nil {
			return nil, err
		}
	}

	row := make(sql.Row, len(exprs))
	var secondPass []int
	for i, expr := range exprs {
		if expr != nil {
			// Non-literal default values may reference other columns, so we need to evaluate them in a second pass.
			if defaultVal, isDef := expr.(*sql.ColumnDefaultValue); isDef && !defaultVal.IsLiteral() {
				secondPass = append(secondPass, i)
				continue
			}
			row[i], err = expr.Eval(ctx, row)
			if err != nil {
				return nil, err
			}
		}
	}
	for _, idx := range secondPass {
		row[idx], err = exprs[idx].Eval(ctx, row)
		if err != nil {
			return nil, err
		}
	}

	return row, nil
}

func (l *loadDataIter) Close(ctx *sql.Context) error {
	return l.reader.Close()
}

// parseLinePrefix searches for the delim defined by linesStartingByDelim.
func (l *loadDataIter) parseLinePrefix(line string) string {
	if l.linesStartingBy == "" {
		return line
	}

	prefixIndex := strings.Index(line, l.linesStartingBy)

	// The prefix wasn't found so we need to skip this line.
	if prefixIndex < 0 {
		return ""
	} else {
		return line[prefixIndex+len(l.linesStartingBy):]
	}
}

func (l *loadDataIter) parseFields(ctx *sql.Context, line string) (exprs []sql.Expression, err error) {
	// Step 1. Start by Searching for prefix if there is one
	line = l.parseLinePrefix(line)
	if line == "" {
		return nil, nil
	}

	// Step 2: Split the lines into fields given the delim, respecting ENCLOSED BY.
	// Fields enclosed by the enclosure character can contain the field terminator.
	// TODO: Support the OPTIONALLY parameter.

	// Check if line has terminator (if not, it ended at EOF)
	hasTerminator := strings.HasSuffix(line, l.linesTerminatedBy)
	if hasTerminator {
		line = line[:len(line)-len(l.linesTerminatedBy)]
	}

	var fields []string
	var currentField strings.Builder
	inEnclosure := false
	termLen := len(l.fieldsTerminatedBy)
	hasEnc := l.fieldsEnclosedBy != ""
	hasEsc := l.fieldsEscapedBy != ""
	encEqualsEsc := hasEnc && hasEsc && l.fieldsEnclosedBy == l.fieldsEscapedBy
	// False only at EOF with enc==esc: ambiguous whether final char closes field or is literal data
	normalLineTerm := hasTerminator || !encEqualsEsc

	for i := 0; i < len(line); i++ {
		ch := line[i]
		isEncChar := hasEnc && ch == l.fieldsEnclosedBy[0]
		// When enc==esc, doubling handles escaping (e.g., $$ -> $), not escape sequences
		isEscChar := hasEsc && !encEqualsEsc && ch == l.fieldsEscapedBy[0]

		// Start enclosure at beginning of field
		if isEncChar && !inEnclosure && currentField.Len() == 0 {
			inEnclosure = true
			continue
		}

		// Special case: escaped enclosure character does not end enclosure and is written literally
		if isEncChar && inEnclosure && encEqualsEsc && i+1 < len(line) && line[i+1] == l.fieldsEnclosedBy[0] {
			currentField.WriteByte(l.fieldsEnclosedBy[0])
			i++
			continue
		}

		// Close enclosure if followed by field terminator or at end of line
		if isEncChar && inEnclosure {
			followedByTerm := i+1+termLen <= len(line) && line[i+1:i+1+termLen] == l.fieldsTerminatedBy
			atLineEnd := i+1 >= len(line)
			if followedByTerm || (atLineEnd && normalLineTerm) {
				inEnclosure = false
				continue
			}
			// Enclosure char in middle of field, treat as literal
			currentField.WriteByte(ch)
			continue
		}

		if isEscChar && i+1 < len(line) {
			i++
			switch line[i] {
			case 'N':
				currentField.WriteString("NULL")
			case 'Z':
				currentField.WriteByte(26)
			case '0':
				currentField.WriteByte(0)
			case 'n':
				currentField.WriteByte('\n')
			case 't':
				currentField.WriteByte('\t')
			case 'r':
				currentField.WriteByte('\r')
			case 'b':
				currentField.WriteByte('\b')
			default:
				currentField.WriteByte(line[i])
			}
			continue
		}

		// Handle field terminator (only outside enclosures)
		if !inEnclosure && i+termLen <= len(line) && line[i:i+termLen] == l.fieldsTerminatedBy {
			fields = append(fields, currentField.String())
			currentField.Reset()
			i += termLen - 1
			continue
		}

		currentField.WriteByte(ch)
	}

	lastField := currentField.String()
	// If still in enclosure at EOF when enc==esc, prepend the opening enclosure that was stripped
	if inEnclosure && !normalLineTerm {
		lastField = string(l.fieldsEnclosedBy[0]) + lastField
	}
	fields = append(fields, lastField)

	if inEnclosure && normalLineTerm {
		return nil, fmt.Errorf("error: unterminated enclosed field")
	}

	fieldRow := make(sql.Row, len(fields))
	for i, field := range fields {
		fieldRow[i] = field
	}

	exprs = make([]sql.Expression, len(l.destSch))
	for fieldIdx, exprIdx := 0, 0; fieldIdx < len(fields) && fieldIdx < len(l.userVars); fieldIdx++ {
		if l.userVars[fieldIdx] != nil {
			setField := l.userVars[fieldIdx].(*expression.SetField)
			userVar := setField.LeftChild.(*expression.UserVar)
			err := setUserVar(ctx, userVar, setField.RightChild, fieldRow)
			if err != nil {
				return nil, err
			}
			continue
		}

		// don't check for `exprIdx < len(exprs)` in for loop
		// because we still need to assign trailing user variables
		if exprIdx >= len(exprs) {
			continue
		}

		field := fields[fieldIdx]
		switch field {
		case "":
			// Replace the empty string with defaults if exists, otherwise NULL
			destCol := l.destSch[l.fieldToColMap[fieldIdx]]
			if _, ok := destCol.Type.(sql.StringType); ok {
				exprs[exprIdx] = expression.NewLiteral(field, types.LongText)
			} else {
				if destCol.Default != nil {
					exprs[exprIdx] = destCol.Default
				} else {
					exprs[exprIdx] = expression.NewLiteral(nil, types.Null)
				}
			}
		case "NULL":
			exprs[exprIdx] = expression.NewLiteral(nil, types.Null)
		default:
			exprs[exprIdx] = expression.NewLiteral(field, types.LongText)
		}
		exprIdx++
	}

	// Apply Set Expressions by replacing the corresponding field expression with the set expression
	for fieldIdx, exprIdx := 0, 0; len(l.setExprs) > 0 && fieldIdx < len(l.fieldToColMap) && exprIdx < len(exprs); fieldIdx++ {
		setIdx := l.fieldToColMap[fieldIdx]
		if setIdx == -1 {
			continue
		}
		setExpr := l.setExprs[setIdx]
		if setExpr != nil {
			res, err := setExpr.Eval(ctx, fieldRow)
			if err != nil {
				return nil, err
			}
			exprs[exprIdx] = expression.NewLiteral(res, setExpr.Type())
		}
		exprIdx++
	}

	// Due to how projections work, if no columns are provided (each row may have a variable number of values), the
	// projection will not insert default values, so we must do it here.
	if l.colCount == 0 {
		for exprIdx, expr := range exprs {
			if expr != nil {
				continue
			}
			col := l.destSch[exprIdx]
			if !col.Nullable && col.Default == nil && !col.AutoIncrement {
				return nil, sql.ErrInsertIntoNonNullableDefaultNullColumn.New(col.Name)
			}
			exprs[exprIdx] = col.Default
		}
	}

	return exprs, nil
}

type modifyColumnIter struct {
	m         *plan.ModifyColumn
	alterable sql.AlterableTable
	runOnce   bool
}

func (i *modifyColumnIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.runOnce {
		return nil, io.EOF
	}
	i.runOnce = true

	idx := i.m.TargetSchema().IndexOf(i.m.Column(), i.alterable.Name())
	if idx < 0 {
		return nil, sql.ErrTableColumnNotFound.New(i.alterable.Name(), i.m.Column())
	}

	if i.m.Order() != nil && !i.m.Order().First {
		idx = i.m.TargetSchema().IndexOf(i.m.Order().AfterColumn, i.alterable.Name())
		if idx < 0 {
			return nil, sql.ErrTableColumnNotFound.New(i.alterable.Name(), i.m.Order().AfterColumn)
		}
	}

	lowerColName := strings.ToLower(i.m.Column())

	// Update the foreign key columns as well
	if fkTable, ok := i.alterable.(sql.ForeignKeyTable); ok {
		// We only care if the column is used in a foreign key
		usedInFk := false
		fks, err := fkTable.GetDeclaredForeignKeys(ctx)
		if err != nil {
			return nil, err
		}
		parentFks, err := fkTable.GetReferencedForeignKeys(ctx)
		if err != nil {
			return nil, err
		}
	OuterChildFk:
		for _, foreignKey := range fks {
			for _, colName := range foreignKey.Columns {
				if strings.ToLower(colName) == lowerColName {
					usedInFk = true
					break OuterChildFk
				}
			}
		}
		if !usedInFk {
		OuterParentFk:
			for _, foreignKey := range parentFks {
				for _, colName := range foreignKey.ParentColumns {
					if strings.ToLower(colName) == lowerColName {
						usedInFk = true
						break OuterParentFk
					}
				}
			}
		}

		tblSch := i.m.TargetSchema()
		if usedInFk {
			if !i.m.TargetSchema()[idx].Type.Equals(i.m.NewColumn().Type) {
				// There seems to be a special case where you can lengthen a CHAR/VARCHAR/BINARY/VARBINARY.
				// Have not tested every type nor combination, but this seems specific to those 4 types.
				if tblSch[idx].Type.Type() == i.m.NewColumn().Type.Type() {
					switch i.m.NewColumn().Type.Type() {
					case sqltypes.Char, sqltypes.VarChar, sqltypes.Binary, sqltypes.VarBinary:
						oldType := tblSch[idx].Type.(sql.StringType)
						newType := i.m.NewColumn().Type.(sql.StringType)
						if oldType.Collation() != newType.Collation() || oldType.MaxCharacterLength() > newType.MaxCharacterLength() {
							return nil, sql.ErrForeignKeyTypeChange.New(i.m.Column())
						}
					default:
						return nil, sql.ErrForeignKeyTypeChange.New(i.m.Column())
					}
				} else {
					return nil, sql.ErrForeignKeyTypeChange.New(i.m.Column())
				}
			}
			if !i.m.NewColumn().Nullable {
				lowerColName := strings.ToLower(i.m.Column())
				for _, fk := range fks {
					if fk.OnUpdate == sql.ForeignKeyReferentialAction_SetNull || fk.OnDelete == sql.ForeignKeyReferentialAction_SetNull {
						for _, col := range fk.Columns {
							if lowerColName == strings.ToLower(col) {
								return nil, sql.ErrForeignKeyTypeChangeSetNull.New(i.m.Column(), fk.Name)
							}
						}
					}
				}
			}
			err = handleFkColumnRename(ctx, fkTable, i.m.Db, i.m.Column(), i.m.NewColumn().Name)
			if err != nil {
				return nil, err
			}
		}
	}

	// Full-Text indexes will need to be rebuilt
	hasFullText := hasFullText(ctx, i.alterable)

	// TODO: replace with different node in analyzer
	if rwt, ok := i.alterable.(sql.RewritableTable); ok {
		rewritten, err := i.rewriteTable(ctx, rwt)
		if err != nil {
			return nil, err
		}
		if rewritten {
			return sql.NewRow(types.NewOkResult(0)), nil
		}
	}

	// TODO: fix me
	if err := updateDefaultsOnColumnRename(ctx, i.alterable, i.m.TargetSchema(), i.m.Column(), i.m.NewColumn().Name); err != nil {
		return nil, err
	}

	err := i.alterable.ModifyColumn(ctx, i.m.Column(), i.m.NewColumn(), i.m.Order())
	if err != nil {
		return nil, err
	}

	if hasFullText {
		if err = rebuildFullText(ctx, i.alterable.Name(), i.m.Db); err != nil {
			return nil, err
		}
	}
	return sql.NewRow(types.NewOkResult(0)), nil
}

func handleFkColumnRename(ctx *sql.Context, fkTable sql.ForeignKeyTable, db sql.Database, oldName string, newName string) error {
	lowerOldName := strings.ToLower(oldName)
	if lowerOldName == strings.ToLower(newName) {
		return nil
	}

	parentFks, err := fkTable.GetReferencedForeignKeys(ctx)
	if err != nil {
		return err
	}
	if len(parentFks) > 0 {
		dbName := strings.ToLower(db.Name())
		for _, parentFk := range parentFks {
			//TODO: add support for multi db foreign keys
			if dbName != strings.ToLower(parentFk.ParentDatabase) {
				return fmt.Errorf("renaming columns involved in foreign keys referencing a different database" +
					" is not yet supported")
			}
			shouldUpdate := false
			for i, col := range parentFk.ParentColumns {
				if strings.ToLower(col) == lowerOldName {
					parentFk.ParentColumns[i] = newName
					shouldUpdate = true
				}
			}
			if shouldUpdate {
				childTable, ok, err := db.GetTableInsensitive(ctx, parentFk.Table)
				if err != nil {
					return err
				}
				if !ok {
					return sql.ErrTableNotFound.New(parentFk.Table)
				}
				err = childTable.(sql.ForeignKeyTable).UpdateForeignKey(ctx, parentFk.Name, parentFk)
				if err != nil {
					return err
				}
			}
		}
	}

	fks, err := fkTable.GetDeclaredForeignKeys(ctx)
	if err != nil {
		return err
	}
	for _, fk := range fks {
		shouldUpdate := false
		for i, col := range fk.Columns {
			if strings.ToLower(col) == lowerOldName {
				fk.Columns[i] = newName
				shouldUpdate = true
			}
		}
		if shouldUpdate {
			err = fkTable.UpdateForeignKey(ctx, fk.Name, fk)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// updateDefaultsOnColumnRename updates each column that references the old column name within its default value.
func updateDefaultsOnColumnRename(ctx *sql.Context, tbl sql.AlterableTable, schema sql.Schema, oldName, newName string) error {
	if oldName == newName {
		return nil
	}
	var err error
	colsToModify := make(map[*sql.Column]struct{})
	for _, col := range schema {
		if col.Default == nil {
			continue
		}
		newCol := *col
		newCol.Default.Expr, _, err = transform.Expr(col.Default.Expr, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
			if expr, ok := e.(*expression.GetField); ok {
				if strings.ToLower(expr.Name()) == oldName {
					colsToModify[&newCol] = struct{}{}
					return expr.WithName(newName), transform.NewTree, nil
				}
			}
			return e, transform.SameTree, nil
		})
		if err != nil {
			return err
		}
	}
	for col := range colsToModify {
		err := tbl.ModifyColumn(ctx, col.Name, col, nil)
		if err != nil {
			return err
		}
	}
	return nil
}

func (i *modifyColumnIter) Close(context *sql.Context) error {
	return nil
}

// rewriteTable rewrites the table given if required or requested, and returns whether it was rewritten
func (i *modifyColumnIter) rewriteTable(ctx *sql.Context, rwt sql.RewritableTable) (bool, error) {
	targetSchema := i.m.TargetSchema()
	oldColName := i.m.Column()
	oldColIdx := targetSchema.IndexOfColName(oldColName)
	if oldColIdx == -1 {
		// Should be impossible, checked in analyzer
		return false, sql.ErrTableColumnNotFound.New(rwt.Name(), oldColName)
	}

	oldCol := i.m.TargetSchema()[oldColIdx]
	newCol := i.m.NewColumn()
	newSch, projections, err := modifyColumnInSchema(targetSchema, oldColName, newCol, i.m.Order())
	if err != nil {
		return false, err
	}

	// Wrap any auto increment columns in auto increment expressions. This mirrors what happens to row sources for normal
	// INSERT statements during analysis.
	for i, col := range newSch {
		if col.AutoIncrement {
			projections[i], err = expression.NewAutoIncrementForColumn(ctx, rwt, col, projections[i])
			if err != nil {
				return false, err
			}
		}
	}

	var renames []sql.ColumnRename
	if oldColName != newCol.Name {
		renames = []sql.ColumnRename{{
			Before: oldColName, After: newCol.Name,
		}}
	}

	oldPkSchema := sql.SchemaToPrimaryKeySchema(rwt, rwt.Schema())
	newPkSchema := sql.SchemaToPrimaryKeySchema(rwt, newSch, renames...)

	rewriteRequired := false
	if oldCol.Nullable && !newCol.Nullable {
		rewriteRequired = true
	}

	oldEnum, isOldEnum := oldCol.Type.(sql.EnumType)
	newEnum, isNewEnum := newCol.Type.(sql.EnumType)
	if isOldEnum && isNewEnum && !oldEnum.IsSubsetOf(newEnum) {
		rewriteRequired = true
	}

	// TODO: codify rewrite requirements
	rewriteRequested := rwt.ShouldRewriteTable(ctx, oldPkSchema, newPkSchema, oldCol, newCol)
	if !rewriteRequired && !rewriteRequested {
		return false, nil
	}

	inserter, err := rwt.RewriteInserter(ctx, oldPkSchema, newPkSchema, oldCol, newCol, nil)
	if err != nil {
		return false, err
	}

	partitions, err := rwt.Partitions(ctx)
	if err != nil {
		return false, err
	}

	var rowIter sql.RowIter = sql.NewTableRowIter(ctx, rwt, partitions)
	rowIter = withSafepointPeriodicallyIter(rowIter)
	for {
		r, err := rowIter.Next(ctx)
		if err == io.EOF {
			break
		} else if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return false, err
		}

		// remap old enum values to new enum values
		if isOldEnum && isNewEnum && r[oldColIdx] != nil {
			oldIdx := int(r[oldColIdx].(uint16))
			// 0 values in enums are error values. They are preserved during remapping.
			if oldIdx != 0 {
				oldStr, _ := oldEnum.At(oldIdx)
				newIdx := newEnum.IndexOf(oldStr)
				if newIdx == -1 {
					return false, types.ErrDataTruncatedForColumn.New(newCol.Name)
				}
				r[oldColIdx] = uint16(newIdx)
			}
		}

		newRow, err := projectRowWithTypes(ctx, targetSchema, newSch, projections, r)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return false, err
		}

		err = i.validateNullability(ctx, newSch, newRow)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return false, err
		}

		err = inserter.Insert(ctx, newRow)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return false, err
		}
	}

	// TODO: move this into iter.close, probably
	err = inserter.Close(ctx)
	if err != nil {
		return false, err
	}

	return true, nil
}

// modifyColumnInSchema modifies the given column in given schema and returns the new schema, along with a set of
// projections to adapt the old schema to the new one.
func modifyColumnInSchema(schema sql.Schema, name string, column *sql.Column, order *sql.ColumnOrder) (sql.Schema, []sql.Expression, error) {
	schema = schema.Copy()
	currIdx := schema.IndexOf(name, column.Source)
	if currIdx < 0 {
		// Should be checked in the analyzer already
		return nil, nil, sql.ErrTableColumnNotFound.New(column.Source, name)
	}

	// Primary key-ness isn't included in the column description as part of the ALTER statement, preserve it
	if schema[currIdx].PrimaryKey {
		column.PrimaryKey = true
	}

	newIdx := currIdx
	if order != nil && len(order.AfterColumn) > 0 {
		newIdx = schema.IndexOf(order.AfterColumn, column.Source)
		if newIdx == -1 {
			// Should be checked in the analyzer already
			return nil, nil, sql.ErrTableColumnNotFound.New(column.Source, order.AfterColumn)
		}
		// if we're moving left in the schema, shift everything over one
		if newIdx < currIdx {
			newIdx++
		}
	} else if order != nil && order.First {
		newIdx = 0
	}

	// establish a map from old column index to new column index
	oldToNewIdxMapping := make(map[int]int)
	var i, j int
	for j < len(schema) || i < len(schema) {
		if i == currIdx {
			oldToNewIdxMapping[i] = newIdx
			i++
		} else if j == newIdx {
			j++
		} else {
			oldToNewIdxMapping[i] = j
			i, j = i+1, j+1
		}
	}

	// Now build the new schema, keeping track of:
	// 1) The new result schema
	// 2) A set of projections to translate rows in the old schema to rows in the new schema
	newSch := make(sql.Schema, len(schema))
	projections := make([]sql.Expression, len(schema))

	for i := range schema {
		j := oldToNewIdxMapping[i]
		oldCol := schema[i]
		c := oldCol
		if j == newIdx {
			c = column
		}
		newSch[j] = c
		projections[j] = expression.NewGetField(i, oldCol.Type, oldCol.Name, oldCol.Nullable)
	}

	// If a column was renamed or moved, we need to update any column defaults that refer to it
	for i := range newSch {
		newCol := newSch[oldToNewIdxMapping[i]]

		if newCol.Default != nil {
			newDefault, _, err := transform.Expr(newCol.Default.Expr, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
				gf, ok := e.(*expression.GetField)
				if !ok {
					return e, transform.SameTree, nil
				}

				colName := gf.Name()
				// handle column renames
				if strings.ToLower(colName) == strings.ToLower(name) {
					colName = column.Name
				}

				newSchemaIdx := newSch.IndexOfColName(colName)
				if newSchemaIdx == -1 {
					return nil, transform.SameTree, sql.ErrColumnNotFound.New(colName)
				}
				return expression.NewGetFieldWithTable(newSchemaIdx, int(gf.TableId()), gf.Type(), gf.Database(), gf.Table(), colName, gf.IsNullable()), transform.NewTree, nil
			})
			if err != nil {
				return nil, nil, err
			}

			newDefault, err = newCol.Default.WithChildren(newDefault)
			if err != nil {
				return nil, nil, err
			}

			newCol.Default = newDefault.(*sql.ColumnDefaultValue)
		}
	}

	// TODO: do we need col defaults here? probably when changing a column to be non-null?
	return newSch, projections, nil
}

// TODO: this shares logic with insert
func (i *modifyColumnIter) validateNullability(ctx *sql.Context, dstSchema sql.Schema, row sql.Row) error {
	for count, col := range dstSchema {
		if !col.Nullable && row[count] == nil {
			return sql.ErrInsertIntoNonNullableProvidedNull.New(col.Name)
		}
	}
	return nil
}

func createIndex(
	ctx *sql.Context,
	log *logrus.Entry,
	driver sql.IndexDriver,
	index sql.DriverIndex,
	iter sql.PartitionIndexKeyValueIter,
	done chan<- struct{},
	ready <-chan struct{},
) {
	span, ctx := ctx.Span("plan.createIndex",
		trace.WithAttributes(
			attribute.String("index", index.ID()),
			attribute.String("table", index.Table()),
			attribute.String("driver", index.Driver()),
		),
	)
	defer span.End()

	l := log.WithField("id", index.ID())

	err := driver.Save(ctx, index, newLoggingPartitionKeyValueIter(l, iter))
	close(done)

	if err != nil {
		span.RecordError(err)

		ctx.Error(0, "unable to save the index: %s", err)
		logrus.WithField("err", err).Error("unable to save the index")

		deleted, err := ctx.GetIndexRegistry().DeleteIndex(index.Database(), index.ID(), true)
		if err != nil {
			ctx.Error(0, "unable to delete index: %s", err)
			logrus.WithField("err", err).Error("unable to delete the index")
		} else {
			<-deleted
		}
	} else {
		<-ready
		log.Info("index successfully created")
	}
}

type EvalPartitionKeyValueIter struct {
	iter    sql.PartitionIndexKeyValueIter
	columns []string
	exprs   []sql.Expression
}

func NewEvalPartitionKeyValueIter(iter sql.PartitionIndexKeyValueIter, columns []string, exprs []sql.Expression) *EvalPartitionKeyValueIter {
	return &EvalPartitionKeyValueIter{
		iter:    iter,
		columns: columns,
		exprs:   exprs,
	}
}

func (i *EvalPartitionKeyValueIter) Next(ctx *sql.Context) (sql.Partition, sql.IndexKeyValueIter, error) {
	p, iter, err := i.iter.Next(ctx)
	if err != nil {
		return nil, nil, err
	}

	return p, &evalKeyValueIter{
		columns: i.columns,
		exprs:   i.exprs,
		iter:    iter,
	}, nil
}

func (i *EvalPartitionKeyValueIter) Close(ctx *sql.Context) error {
	return i.iter.Close(ctx)
}

type evalKeyValueIter struct {
	iter    sql.IndexKeyValueIter
	columns []string
	exprs   []sql.Expression
}

func (i *evalKeyValueIter) Next(ctx *sql.Context) ([]interface{}, []byte, error) {
	vals, loc, err := i.iter.Next(ctx)
	if err != nil {
		return nil, nil, err
	}

	row := sql.NewRow(vals...)
	evals := make([]interface{}, len(i.exprs))
	for j, ex := range i.exprs {
		eval, err := ex.Eval(ctx, row)
		if err != nil {
			return nil, nil, err
		}

		evals[j] = eval
	}

	return evals, loc, nil
}

func (i *evalKeyValueIter) Close(ctx *sql.Context) error {
	return i.iter.Close(ctx)
}

type loggingPartitionKeyValueIter struct {
	log  *logrus.Entry
	iter sql.PartitionIndexKeyValueIter
	rows uint64
}

func newLoggingPartitionKeyValueIter(
	log *logrus.Entry,
	iter sql.PartitionIndexKeyValueIter,
) *loggingPartitionKeyValueIter {
	return &loggingPartitionKeyValueIter{
		log:  log,
		iter: iter,
	}
}

func (i *loggingPartitionKeyValueIter) Next(ctx *sql.Context) (sql.Partition, sql.IndexKeyValueIter, error) {
	p, iter, err := i.iter.Next(ctx)
	if err != nil {
		return nil, nil, err
	}

	return p, newLoggingKeyValueIter(i.log, iter, &i.rows), nil
}

func (i *loggingPartitionKeyValueIter) Close(ctx *sql.Context) error {
	return i.iter.Close(ctx)
}

type loggingKeyValueIter struct {
	span  trace.Span
	log   *logrus.Entry
	iter  sql.IndexKeyValueIter
	rows  *uint64
	start time.Time
}

func newLoggingKeyValueIter(
	log *logrus.Entry,
	iter sql.IndexKeyValueIter,
	rows *uint64,
) *loggingKeyValueIter {
	return &loggingKeyValueIter{
		log:   log,
		iter:  iter,
		start: time.Now(),
		rows:  rows,
	}
}

func (i *loggingKeyValueIter) Next(ctx *sql.Context) ([]interface{}, []byte, error) {
	if i.span == nil {
		i.span, ctx = ctx.Span("plan.createIndex.iterator", trace.WithAttributes(attribute.Int64("start", int64(*i.rows))))
	}

	(*i.rows)++
	if *i.rows%sql.IndexBatchSize == 0 {
		duration := time.Since(i.start)

		i.log.WithFields(logrus.Fields{
			"duration": duration,
			"rows":     *i.rows,
		}).Debugf("still creating index")

		if i.span != nil {
			i.span.SetAttributes(attribute.Stringer("duration", duration))
			i.span.End()
			i.span = nil
		}

		i.start = time.Now()
	}

	val, loc, err := i.iter.Next(ctx)
	if err != nil {
		i.span.RecordError(err)
		i.span.End()
		i.span = nil
	}

	return val, loc, err
}

func (i *loggingKeyValueIter) Close(ctx *sql.Context) error {
	return i.iter.Close(ctx)
}

// projectRowWithTypes projects the row given with the projections given and additionally converts them to the
// corresponding types found in the schema given, using the standard type conversion logic.
func projectRowWithTypes(ctx *sql.Context, oldSchema, newSchema sql.Schema, projections []sql.Expression, r sql.Row) (sql.Row, error) {
	newRow, err := ProjectRow(ctx, projections, r)
	if err != nil {
		return nil, err
	}

	for i := range newRow {
		converted, inRange, err := types.TypeAwareConversion(ctx, newRow[i], oldSchema[i].Type, newSchema[i].Type)
		if err != nil {
			if sql.ErrNotMatchingSRID.Is(err) {
				err = sql.ErrNotMatchingSRIDWithColName.New(newSchema[i].Name, err)
			}
			if sql.ErrTruncatedIncorrect.Is(err) {
				err = sql.ErrInvalidValue.New(newSchema[i].Type, newRow[i])
			}
			return nil, err
		} else if !inRange {
			return nil, sql.ErrValueOutOfRange.New(newRow[i], newSchema[i].Type)
		}
		newRow[i] = converted
	}

	return newRow, nil
}

// getTableFromDatabase returns table named from the database provided
func getTableFromDatabase(ctx *sql.Context, db sql.Database, tableNode sql.Node) (sql.Table, error) {
	// Grab the table fresh from the database.
	tableName := getTableName(tableNode)

	table, ok, err := db.GetTableInsensitive(ctx, tableName)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, sql.ErrTableNotFound.New(tableName)
	}

	return table, nil
}

// getTableName attempts to fetch the table name from the node. If not found directly on the node, searches the
// children. Returns the first table name found, regardless of whether there are more, therefore this is only intended
// to be used in situations where only a single table is expected to be found.
func getTableName(nodeToSearch sql.Node) string {
	nodeStack := []sql.Node{nodeToSearch}
	for len(nodeStack) > 0 {
		node := nodeStack[len(nodeStack)-1]
		nodeStack = nodeStack[:len(nodeStack)-1]
		switch n := node.(type) {
		case *plan.TableAlias:
			if n.UnaryNode != nil {
				nodeStack = append(nodeStack, n.UnaryNode.Child)
				continue
			}
		case *plan.ResolvedTable:
			return n.Table.Name()
		case *plan.UnresolvedTable:
			return n.Name()
		case *plan.IndexedTableAccess:
			return n.Name()
		case sql.TableWrapper:
			return n.Underlying().Name()
		}
		nodeStack = append(nodeStack, node.Children()...)
	}
	return ""
}

func getIndexableTable(t sql.Table) (sql.DriverIndexableTable, error) {
	switch t := t.(type) {
	case sql.DriverIndexableTable:
		return t, nil
	case sql.TableWrapper:
		return getIndexableTable(t.Underlying())
	default:
		return nil, plan.ErrNotIndexable.New()
	}
}

func getChecksumable(t sql.Table) sql.Checksumable {
	switch t := t.(type) {
	case sql.Checksumable:
		return t
	case sql.TableWrapper:
		return getChecksumable(t.Underlying())
	default:
		return nil
	}
}

// GetColumnsAndPrepareExpressions extracts the unique columns required by all
// those expressions and fixes the indexes of the GetFields in the expressions
// to match a row with only the returned columns in that same order.
func GetColumnsAndPrepareExpressions(
	exprs []sql.Expression,
) ([]string, []sql.Expression, error) {
	var columns []string
	var seen = make(map[string]int)
	var expressions = make([]sql.Expression, len(exprs))

	for i, e := range exprs {
		ex, _, err := transform.Expr(e, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
			gf, ok := e.(*expression.GetField)
			if !ok {
				return e, transform.SameTree, nil
			}

			var idx int
			if j, ok := seen[gf.Name()]; ok {
				idx = j
			} else {
				idx = len(columns)
				columns = append(columns, gf.Name())
				seen[gf.Name()] = idx
			}

			return expression.NewGetFieldWithTable(idx, int(gf.TableId()), gf.Type(), gf.Database(), gf.Table(), gf.Name(), gf.IsNullable()), transform.NewTree, nil
		})

		if err != nil {
			return nil, nil, err
		}

		expressions[i] = ex
	}

	return columns, expressions, nil
}

type createPkIter struct {
	db           sql.Database
	pkAlterable  sql.PrimaryKeyAlterableTable
	targetSchema sql.Schema
	columns      []sql.IndexColumn
	runOnce      bool
}

func (c *createPkIter) Next(ctx *sql.Context) (sql.Row, error) {
	if c.runOnce {
		return nil, io.EOF
	}
	c.runOnce = true

	// Full-Text indexes will need to be rebuilt
	hasFullText := hasFullText(ctx, c.pkAlterable)

	if rwt, ok := c.pkAlterable.(sql.RewritableTable); ok {
		err := c.rewriteTable(ctx, rwt)
		if err != nil {
			return nil, err
		}
		return sql.NewRow(types.NewOkResult(0)), nil
	}

	err := c.pkAlterable.CreatePrimaryKey(ctx, c.columns)
	if err != nil {
		return nil, err
	}

	if hasFullText {
		if err = rebuildFullText(ctx, c.pkAlterable.Name(), c.db); err != nil {
			return nil, err
		}
	}
	return sql.NewRow(types.NewOkResult(0)), nil
}

func (c createPkIter) Close(context *sql.Context) error {
	return nil
}

func (c *createPkIter) rewriteTable(ctx *sql.Context, rwt sql.RewritableTable) error {
	newSchema := addKeyToSchema(rwt.Name(), c.targetSchema, c.columns)

	oldPkSchema, newPkSchema := sql.SchemaToPrimaryKeySchema(rwt, rwt.Schema()), newSchema

	inserter, err := rwt.RewriteInserter(ctx, oldPkSchema, newPkSchema, nil, nil, c.columns)
	if err != nil {
		return err
	}

	partitions, err := rwt.Partitions(ctx)
	if err != nil {
		return err
	}

	var rowIter sql.RowIter = sql.NewTableRowIter(ctx, rwt, partitions)
	rowIter = withSafepointPeriodicallyIter(rowIter)

	for {
		r, err := rowIter.Next(ctx)
		if err == io.EOF {
			break
		} else if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return err
		}

		// check for null values in the primary key insert
		for _, i := range newSchema.PkOrdinals {
			if r[i] == nil {
				return sql.ErrInsertIntoNonNullableProvidedNull.New(newSchema.Schema[i].Name)
			}
		}

		err = inserter.Insert(ctx, r)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return err
		}
	}

	// TODO: move this into iter.close, probably
	err = inserter.Close(ctx)
	if err != nil {
		return err
	}

	return nil
}

func addKeyToSchema(tableName string, schema sql.Schema, columns []sql.IndexColumn) sql.PrimaryKeySchema {
	newSch := schema.Copy()
	ordinals := make([]int, len(columns))
	for i := range columns {
		idx := schema.IndexOf(columns[i].Name, tableName)
		ordinals[i] = idx
		newSch[idx].PrimaryKey = true
		newSch[idx].Nullable = false
	}
	return sql.NewPrimaryKeySchema(newSch, ordinals...)
}

type dropPkIter struct {
	db           sql.Database
	pkAlterable  sql.PrimaryKeyAlterableTable
	targetSchema sql.Schema
	runOnce      bool
}

func (d *dropPkIter) Next(ctx *sql.Context) (sql.Row, error) {
	if d.runOnce {
		return nil, io.EOF
	}
	d.runOnce = true

	// Full-Text indexes will need to be rebuilt
	hasFullText := hasFullText(ctx, d.pkAlterable)

	if rwt, ok := d.pkAlterable.(sql.RewritableTable); ok {
		err := d.rewriteTable(ctx, rwt)
		if err != nil {
			return nil, err
		}
		return sql.NewRow(types.NewOkResult(0)), nil
	}

	err := d.pkAlterable.DropPrimaryKey(ctx)
	if err != nil {
		return nil, err
	}

	if hasFullText {
		if err = rebuildFullText(ctx, d.pkAlterable.Name(), d.db); err != nil {
			return nil, err
		}
	}
	return sql.NewRow(types.NewOkResult(0)), nil
}

func (d *dropPkIter) Close(context *sql.Context) error {
	return nil
}

func (d *dropPkIter) rewriteTable(ctx *sql.Context, rwt sql.RewritableTable) error {
	newSchema := dropKeyFromSchema(d.targetSchema)

	oldPkSchema, newPkSchema := sql.SchemaToPrimaryKeySchema(rwt, rwt.Schema()), newSchema

	inserter, err := rwt.RewriteInserter(ctx, oldPkSchema, newPkSchema, nil, nil, nil)
	if err != nil {
		return err
	}

	partitions, err := rwt.Partitions(ctx)
	if err != nil {
		return err
	}

	var rowIter sql.RowIter = sql.NewTableRowIter(ctx, rwt, partitions)
	rowIter = withSafepointPeriodicallyIter(rowIter)

	for {
		r, err := rowIter.Next(ctx)
		if err == io.EOF {
			break
		} else if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return err
		}

		err = inserter.Insert(ctx, r)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return err
		}
	}

	// TODO: move this into iter.close, probably
	err = inserter.Close(ctx)
	if err != nil {
		return err
	}

	hasFullText := hasFullText(ctx, d.pkAlterable)
	if hasFullText {
		if err = rebuildFullText(ctx, d.pkAlterable.Name(), d.db); err != nil {
			return err
		}
	}

	return nil
}

func dropKeyFromSchema(schema sql.Schema) sql.PrimaryKeySchema {
	newSch := schema.Copy()
	for i := range newSch {
		newSch[i].PrimaryKey = false
	}

	return sql.NewPrimaryKeySchema(newSch)
}

type addColumnIter struct {
	alterable sql.AlterableTable
	a         *plan.AddColumn
	b         *BaseBuilder
	runOnce   bool
}

func (i *addColumnIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.runOnce {
		return nil, io.EOF
	}
	i.runOnce = true

	// Full-Text indexes will need to be rebuilt
	hasFullText := hasFullText(ctx, i.alterable)

	rwt, ok := i.alterable.(sql.RewritableTable)
	if ok {
		rewritten, err := i.rewriteTable(ctx, rwt)
		if err != nil {
			return nil, err
		}
		if rewritten {
			return sql.NewRow(types.NewOkResult(0)), nil
		}
	}

	err := i.alterable.AddColumn(ctx, i.a.Column(), i.a.Order())
	if err != nil {
		return nil, err
	}

	if hasFullText {
		if err = rebuildFullText(ctx, i.alterable.Name(), i.a.Db); err != nil {
			return nil, err
		}
	}

	// We only need to update all table rows if the new column is non-nil
	if i.a.Column().Nullable && i.a.Column().Default == nil {
		return sql.NewRow(types.NewOkResult(0)), nil
	}

	err = i.UpdateRowsWithDefaults(ctx, i.alterable)
	if err != nil {
		return nil, err
	}

	return sql.NewRow(types.NewOkResult(0)), nil
}

// UpdateRowsWithDefaults iterates through an updatable table and applies an update to each row.
func (i *addColumnIter) UpdateRowsWithDefaults(ctx *sql.Context, table sql.Table) error {
	rt := plan.NewResolvedTable(table, i.a.Db, nil)
	updatable, ok := table.(sql.UpdatableTable)
	if !ok {
		return plan.ErrUpdateNotSupported.New(rt.Name())
	}

	tableIter, err := i.b.buildNodeExec(ctx, rt, nil)
	if err != nil {
		return err
	}
	tableIter = withSafepointPeriodicallyIter(tableIter)

	schema := updatable.Schema()
	idx := -1
	for j, col := range schema {
		if col.Name == i.a.Column().Name {
			idx = j
		}
	}

	updater := updatable.Updater(ctx)

	for {
		r, err := tableIter.Next(ctx)
		if err == io.EOF {
			return updater.Close(ctx)
		}

		if err != nil {
			_ = updater.Close(ctx)
			return err
		}

		updatedRow, err := applyDefaults(ctx, schema, idx, r, i.a.Column().Default)
		if err != nil {
			return err
		}

		err = updater.Update(ctx, r, updatedRow)
		if err != nil {
			return err
		}
	}
}

// applyDefaults applies the default value of the given column index to the given row, and returns a new row with the updated values.
// This assumes that the given row has placeholder `nil` values for the default entries, and also that each column in a table is
// present and in the order as represented by the schema.
func applyDefaults(ctx *sql.Context, tblSch sql.Schema, col int, row sql.Row, cd *sql.ColumnDefaultValue) (sql.Row, error) {
	newRow := row.Copy()
	if len(tblSch) != len(row) {
		return nil, fmt.Errorf("any row given to ApplyDefaults must be of the same length as the table it represents")
	}

	if col < 0 || col > len(tblSch) {
		return nil, fmt.Errorf("column index `%d` is out of bounds, table schema has `%d` number of columns", col, len(tblSch))
	}

	columnDefaultExpr := cd
	if columnDefaultExpr == nil && !tblSch[col].Nullable {
		val := tblSch[col].Type.Zero()
		var err error
		newRow[col], _, err = tblSch[col].Type.Convert(ctx, val)
		if err != nil {
			return nil, err
		}
	} else {
		val, err := columnDefaultExpr.Eval(ctx, newRow)
		if err != nil {
			return nil, err
		}
		newRow[col], _, err = tblSch[col].Type.Convert(ctx, val)
		if err != nil {
			return nil, err
		}
	}

	return newRow, nil
}

func (i addColumnIter) Close(context *sql.Context) error {
	return nil
}

// rewriteTable rewrites the table given if required or requested, and returns the whether it was rewritten
func (i *addColumnIter) rewriteTable(ctx *sql.Context, rwt sql.RewritableTable) (bool, error) {
	newSch, projections, err := addColumnToSchema(i.a.TargetSchema(), i.a.Column(), i.a.Order())
	if err != nil {
		return false, err
	}

	oldPkSchema, newPkSchema := sql.SchemaToPrimaryKeySchema(rwt, rwt.Schema()), sql.SchemaToPrimaryKeySchema(rwt, newSch)

	rewriteRequired := false
	if i.a.Column().Default != nil || i.a.Column().Generated != nil || !i.a.Column().Nullable || i.a.Column().AutoIncrement {
		rewriteRequired = true
	}

	if !rewriteRequired && !rwt.ShouldRewriteTable(ctx, oldPkSchema, newPkSchema, nil, i.a.Column()) {
		return false, nil
	}

	inserter, err := rwt.RewriteInserter(ctx, oldPkSchema, newPkSchema, nil, i.a.Column(), nil)
	if err != nil {
		return false, err
	}

	partitions, err := rwt.Partitions(ctx)
	if err != nil {
		return false, err
	}

	var rowIter sql.RowIter = sql.NewTableRowIter(ctx, rwt, partitions)
	rowIter = withSafepointPeriodicallyIter(rowIter)

	var val uint64
	var autoTbl sql.AutoIncrementTable
	autoIncColIdx := -1
	if newSch.HasAutoIncrement() && !i.a.TargetSchema().HasAutoIncrement() {
		var ok bool
		if autoTbl, ok = rwt.(sql.AutoIncrementTable); !ok {
			return false, plan.ErrAutoIncrementNotSupported.New()
		}
		autoIncColIdx = newSch.IndexOf(i.a.Column().Name, i.a.Column().Source)
		if val, err = autoTbl.GetNextAutoIncrementValue(ctx, 1); err != nil {
			return false, err
		}
	}

	for {
		r, err := rowIter.Next(ctx)
		if err == io.EOF {
			break
		} else if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return false, err
		}

		newRow, err := ProjectRow(ctx, projections, r)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return false, err
		}

		if autoIncColIdx != -1 {
			v, _, err := i.a.Column().Type.Convert(ctx, val)
			if err != nil {
				return false, err
			}
			newRow[autoIncColIdx] = v
			val, err = autoTbl.GetNextAutoIncrementValue(ctx, val)
			if err != nil {
				return false, err
			}
			val++
		}

		err = inserter.Insert(ctx, newRow)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return false, err
		}
	}

	// TODO: move this into iter.close, probably
	err = inserter.Close(ctx)
	if err != nil {
		return false, err
	}

	return true, nil
}

// addColumnToSchema returns a new schema and a set of projection expressions that when applied to rows from the old
// schema will result in rows in the new schema.
func addColumnToSchema(schema sql.Schema, column *sql.Column, order *sql.ColumnOrder) (sql.Schema, []sql.Expression, error) {
	idx := -1
	if order != nil && len(order.AfterColumn) > 0 {
		idx = schema.IndexOf(order.AfterColumn, column.Source)
		if idx == -1 {
			// Should be checked in the analyzer already
			return nil, nil, sql.ErrTableColumnNotFound.New(column.Source, order.AfterColumn)
		}
		idx++
	} else if order != nil && order.First {
		idx = 0
	}

	// Now build the new schema, keeping track of:
	// 1) the new result schema
	// 2) A set of projections to translate rows in the old schema to rows in the new schema
	newSch := make(sql.Schema, 0, len(schema)+1)
	projections := make([]sql.Expression, len(schema)+1)

	newGetField := func(i int) sql.Expression {
		col := schema[i]
		if col.Virtual {
			return col.Generated
		} else {
			return expression.NewGetField(i, col.Type, col.Name, col.Nullable)
		}
	}

	if idx >= 0 {
		newSch = append(newSch, schema[:idx]...)
		newSch = append(newSch, column)
		newSch = append(newSch, schema[idx:]...)

		for i := 0; i < idx; i++ {
			projections[i] = newGetField(i)
		}
		projections[idx] = plan.ColDefaultExpression{column}
		for i := idx; i < len(schema); i++ {
			projections[i+1] = newGetField(i)
		}
	} else { // new column at end
		newSch = append(newSch, schema...)
		newSch = append(newSch, column)
		for i, _ := range schema {
			projections[i] = newGetField(i)
		}
		projections[len(schema)] = plan.ColDefaultExpression{column}
	}

	// Alter old default expressions if they refer to other columns. The column indexes computed during analysis refer to the
	// column indexes in the old result schema, which is not what we want here: we want the positions in the new
	// schema, since that is what we'll be evaluating when we rewrite the table.
	var updateFieldRefs transform.ExprFunc = func(s sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		switch s := s.(type) {
		case *expression.GetField:
			idx := newSch.IndexOf(s.Name(), newSch[0].Source)
			if idx < 0 {
				return nil, transform.SameTree, sql.ErrTableColumnNotFound.New(schema[0].Source, s.Name())
			}
			return s.WithIndex(idx), transform.NewTree, nil
		default:
			return s, transform.SameTree, nil
		}
		return s, transform.SameTree, nil
	}
	for i := range projections {
		switch p := projections[i].(type) {
		case *sql.ColumnDefaultValue:
			newExpr, _, err := transform.Expr(p, updateFieldRefs)
			if err != nil {
				return nil, nil, err
			}
			projections[i] = newExpr
			break
		case plan.ColDefaultExpression:
			if p.Column.Default != nil {
				newExpr, _, err := transform.Expr(p.Column.Default.Expr, updateFieldRefs)
				if err != nil {
					return nil, nil, err
				}
				p.Column.Default.Expr = newExpr
				projections[i] = p
			} else if p.Column.Generated != nil {
				newExpr, _, err := transform.Expr(p.Column.Generated.Expr, updateFieldRefs)
				if err != nil {
					return nil, nil, err
				}
				p.Column.Generated.Expr = newExpr
				projections[i] = p
			}
			break
		}
	}

	return newSch, projections, nil
}

// createProcedureIter is the row iterator for *CreateProcedure.
type createProcedureIter struct {
	db   sql.Database
	spd  sql.StoredProcedureDetails
	once sync.Once
}

// Next implements the sql.RowIter interface.
func (c *createProcedureIter) Next(ctx *sql.Context) (sql.Row, error) {
	run := false
	c.once.Do(func() {
		run = true
	})
	if !run {
		return nil, io.EOF
	}
	//TODO: if "automatic_sp_privileges" is true then the creator automatically gets EXECUTE and ALTER ROUTINE on this procedure
	pdb, ok := c.db.(sql.StoredProcedureDatabase)
	if !ok {
		return nil, sql.ErrStoredProceduresNotSupported.New(c.db.Name())
	}

	err := pdb.SaveStoredProcedure(ctx, c.spd)
	if err != nil {
		return nil, err
	}

	return sql.Row{types.NewOkResult(0)}, nil
}

// Close implements the sql.RowIter interface.
func (c *createProcedureIter) Close(ctx *sql.Context) error {
	return nil
}

type createTriggerIter struct {
	ctx        *sql.Context
	db         sql.Database
	definition sql.TriggerDefinition
	once       sync.Once
}

func (c *createTriggerIter) Next(ctx *sql.Context) (sql.Row, error) {
	run := false
	c.once.Do(func() {
		run = true
	})

	if !run {
		return nil, io.EOF
	}

	tdb, ok := c.db.(sql.TriggerDatabase)
	if !ok {
		return nil, sql.ErrTriggersNotSupported.New(c.db.Name())
	}

	err := tdb.CreateTrigger(ctx, c.definition)
	if err != nil {
		return nil, err
	}

	return sql.Row{types.NewOkResult(0)}, nil
}

func (c *createTriggerIter) Close(*sql.Context) error {
	return nil
}

type dropColumnIter struct {
	d         *plan.DropColumn
	alterable sql.AlterableTable
	runOnce   bool
}

func (i *dropColumnIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.runOnce {
		return nil, io.EOF
	}
	i.runOnce = true

	// drop constraints that reference the dropped column
	cat, ok := i.alterable.(sql.CheckAlterableTable)
	if ok {
		// note: validations done earlier ensure safety of dropping any constraint referencing the column
		err := dropConstraints(ctx, cat, i.d.Checks(), i.d.Column)
		if err != nil {
			return nil, err
		}
	}

	rwt, ok := i.alterable.(sql.RewritableTable)
	if ok {
		rewritten, err := i.rewriteTable(ctx, rwt)
		if err != nil {
			return nil, err
		}
		if rewritten {
			return sql.NewRow(types.NewOkResult(0)), nil
		}
	}

	// Full-Text indexes will need to be rebuilt
	hasFullText := hasFullText(ctx, i.alterable)
	if hasFullText {
		if err := fulltext.DropColumnFromTables(ctx, i.alterable.(sql.IndexAddressableTable), i.d.Db.(fulltext.Database), i.d.Column); err != nil {
			return nil, err
		}
	}

	err := i.alterable.DropColumn(ctx, i.d.Column)
	if err != nil {
		return nil, err
	}

	if hasFullText {
		if err = rebuildFullText(ctx, i.alterable.Name(), i.d.Db); err != nil {
			return nil, err
		}
	}
	return sql.NewRow(types.NewOkResult(0)), nil
}

// rewriteTable rewrites the table given if required or requested, and returns whether it was rewritten
func (i *dropColumnIter) rewriteTable(ctx *sql.Context, rwt sql.RewritableTable) (bool, error) {
	newSch, projections, err := dropColumnFromSchema(i.d.TargetSchema(), i.d.Column, i.alterable.Name())
	if err != nil {
		return false, err
	}

	oldPkSchema, newPkSchema := sql.SchemaToPrimaryKeySchema(rwt, rwt.Schema()), sql.SchemaToPrimaryKeySchema(rwt, newSch)
	droppedColIdx := oldPkSchema.IndexOf(i.d.Column, i.alterable.Name())

	rewriteRequested := rwt.ShouldRewriteTable(ctx, oldPkSchema, newPkSchema, oldPkSchema.Schema[droppedColIdx], nil)
	if !rewriteRequested {
		return false, nil
	}

	inserter, err := rwt.RewriteInserter(ctx, oldPkSchema, newPkSchema, oldPkSchema.Schema[droppedColIdx], nil, nil)
	if err != nil {
		return false, err
	}

	partitions, err := rwt.Partitions(ctx)
	if err != nil {
		return false, err
	}

	var rowIter sql.RowIter = sql.NewTableRowIter(ctx, rwt, partitions)
	rowIter = withSafepointPeriodicallyIter(rowIter)

	for {
		r, err := rowIter.Next(ctx)
		if err == io.EOF {
			break
		} else if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return false, err
		}

		newRow, err := ProjectRow(ctx, projections, r)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return false, err
		}

		err = inserter.Insert(ctx, newRow)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return false, err
		}
	}

	// TODO: move this into iter.close, probably
	err = inserter.Close(ctx)
	if err != nil {
		return false, err
	}

	return true, nil
}

func dropColumnFromSchema(schema sql.Schema, column string, tableName string) (sql.Schema, []sql.Expression, error) {
	idx := schema.IndexOf(column, tableName)
	if idx < 0 {
		return nil, nil, sql.ErrTableColumnNotFound.New(tableName, column)
	}

	newSch := make(sql.Schema, len(schema)-1)
	projections := make([]sql.Expression, len(schema)-1)

	i := 0
	for j := range schema[:idx] {
		newSch[i] = schema[j]
		projections[i] = expression.NewGetField(j, schema[j].Type, schema[j].Name, schema[j].Nullable)
		i++
	}

	for j := range schema[idx+1:] {
		schIdx := j + i + 1
		newSch[j+i] = schema[schIdx]
		projections[j+i] = expression.NewGetField(schIdx, schema[schIdx].Type, schema[schIdx].Name, schema[schIdx].Nullable)
	}

	return newSch, projections, nil
}

// dropConstraints drop constraints that reference the column to be dropped.
func dropConstraints(ctx *sql.Context, cat sql.CheckAlterableTable, checks sql.CheckConstraints, column string) error {
	var err error
	for _, check := range checks {
		_ = transform.InspectExpr(check.Expr, func(e sql.Expression) bool {
			var name string
			switch e := e.(type) {
			case *expression.UnresolvedColumn:
				name = e.Name()
			case *expression.GetField:
				name = e.Name()
			}
			if strings.EqualFold(column, name) {
				err = cat.DropCheck(ctx, check.Name)
				return true
			}
			return false
		})

		if err != nil {
			return err
		}
	}
	return nil
}

func (i *dropColumnIter) Close(context *sql.Context) error {
	return nil
}

// Execute inserts the rows in the database.
func (b *BaseBuilder) executeCreateCheck(ctx *sql.Context, c *plan.CreateCheck) error {
	table, err := getTableFromDatabase(ctx, c.Database(), c.Table)
	if err != nil {
		return err
	}

	chAlterable, err := getCheckAlterableTable(table)
	if err != nil {
		return err
	}

	// check existing rows in table
	var res interface{}
	rowIter, err := b.buildNodeExec(ctx, c.Table, nil)
	if err != nil {
		return err
	}

	for {
		row, err := rowIter.Next(ctx)
		if err == io.EOF {
			break
		}

		if err != nil {
			return err
		}

		res, err = sql.EvaluateCondition(ctx, c.Check.Expr, row)
		if err != nil {
			return err
		}

		if sql.IsFalse(res) {
			return sql.ErrCheckConstraintViolated.New(c.Check.Name)
		}
	}

	check, err := plan.NewCheckDefinition(ctx, c.Check)
	if err != nil {
		return err
	}

	return chAlterable.CreateCheck(ctx, check)
}

func (b *BaseBuilder) executeDropCheck(ctx *sql.Context, n *plan.DropCheck) error {
	table, err := getTableFromDatabase(ctx, n.Database(), n.Table)
	if err != nil {
		return err
	}

	chAlterable, err := getCheckAlterableTable(table)
	if err != nil {
		return err
	}

	checkTable, ok := chAlterable.(sql.CheckTable)
	if !ok {
		return plan.ErrNoCheckConstraintSupport.New(chAlterable.Name())
	}

	checks, err := checkTable.GetChecks(ctx)
	if err != nil {
		return err
	}

	exists := false
	for _, check := range checks {
		if strings.EqualFold(check.Name, n.Name) {
			exists = true
		}
	}

	if !exists {
		if n.IfExists {
			return nil
		} else {
			return fmt.Errorf("check '%s' was not found on the table", n.Name)
		}
	}

	return chAlterable.DropCheck(ctx, n.Name)
}

func getCheckAlterableTable(t sql.Table) (sql.CheckAlterableTable, error) {
	switch t := t.(type) {
	case sql.CheckAlterableTable:
		return t, nil
	case sql.TableWrapper:
		return getCheckAlterableTable(t.Underlying())
	case *plan.ResolvedTable:
		return getCheckAlterableTable(t.Table)
	default:
		return nil, plan.ErrNoCheckConstraintSupport.New(t.Name())
	}
}

// generateIndexName generates a unique index name based on the columns in the index, and any existing indexes on the table.
func generateIndexName(ctx *sql.Context, idxAltable sql.IndexAlterableTable, idxColNames []string) (string, error) {
	indexMap := make(map[string]struct{})
	if indexedTable, ok := idxAltable.(sql.IndexAddressable); ok {
		indexes, err := indexedTable.GetIndexes(ctx)
		if err != nil {
			return "", err
		}
		for _, index := range indexes {
			indexMap[strings.ToLower(index.ID())] = struct{}{}
		}
	}
	// MySQL names the index by the first column in the definition
	indexName := idxColNames[0]
	if _, ok := indexMap[strings.ToLower(indexName)]; !ok {
		return indexName, nil
	}
	// MySQL starts at 2 for generating duplicate indexes
	for i := 2; true; i++ {
		newIndexName := fmt.Sprintf("%s_%d", indexName, i)
		if _, ok := indexMap[strings.ToLower(newIndexName)]; !ok {
			return newIndexName, nil
		}
	}
	// Should never reach here
	return indexName, nil
}

// getFulltextDatabase returns the fulltext.Database from the given sql.Database, or an error if it is not supported.
func getFulltextDatabase(db sql.Database) (fulltext.Database, error) {
	fullTextDb, isFulltextDb := db.(fulltext.Database)
	if isFulltextDb {
		return fullTextDb, nil
	}
	privDb, isPrivDb := db.(mysql_db.PrivilegedDatabase)
	if !isPrivDb {
		return nil, sql.ErrCreateTableNotSupported.New()
	}
	fullTextDb, isFulltextDb = privDb.Unwrap().(fulltext.Database)
	if isFulltextDb {
		return fullTextDb, nil
	}
	return nil, sql.ErrIncompleteFullTextIntegration.New()
}

// Execute inserts the rows in the database.
func (b *BaseBuilder) executeAlterIndex(ctx *sql.Context, n *plan.AlterIndex) error {
	// We should refresh the state of the table in case this alter was in a multi alter statement.
	table, err := getTableFromDatabase(ctx, n.Db, n.Table)
	if err != nil {
		return err
	}

	idxAltTbl, ok := table.(sql.IndexAlterableTable)
	if !ok {
		return plan.ErrNotIndexable.New()
	}

	switch n.Action {
	case plan.IndexAction_Create:
		if len(n.Columns) == 0 {
			return plan.ErrCreateIndexMissingColumns.New()
		}

		indexName := n.IndexName
		if len(indexName) == 0 {
			indexName, err = generateIndexName(ctx, idxAltTbl, n.ColumnNames())
			if err != nil {
				return err
			}
		}

		// TODO: this should really be a pointer, but there are too many interfaces that expect a value
		indexDef := sql.IndexDef{
			Name:       indexName,
			Columns:    n.Columns,
			Constraint: n.Constraint,
			Storage:    n.Using,
			Comment:    n.Comment,
		}

		if indexDef.IsFullText() {
			var database fulltext.Database
			database, err = getFulltextDatabase(n.Db)
			if err != nil {
				return err
			}
			err = fulltext.CreateFulltextIndexes(ctx, database, idxAltTbl, nil, sql.IndexDefs{&indexDef})
			if err != nil {
				return err
			}
			return nil
		}

		if indexDef.IsVector() {
			// Validate that the type is exactly one column and it's something we can make a vector index of.
			if len(indexDef.Columns) != 1 {
				return fmt.Errorf("a vector index must have exactly one column")
			}
			indexColNameLower := strings.ToLower(indexDef.Columns[0].Name)
			for _, tblCol := range idxAltTbl.Schema() {
				if indexColNameLower == strings.ToLower(tblCol.Name) {
					if !types.IsVectorConvertable(tblCol.Type) {
						return sql.ErrVectorInvalidColumnType.New()
					}
					break
				}
			}
		}

		err = idxAltTbl.CreateIndex(ctx, indexDef)
		if err != nil {
			if sql.ErrDuplicateKey.Is(err) && n.IfNotExists {
				return nil
			}
			return err
		}

		err = warnOnDuplicateSecondaryIndex(ctx, indexDef.Name, idxAltTbl)
		if err != nil {
			return err
		}

		// Two ways to build an index for an integrator, implemented by two different interfaces.
		// The first way is building just an index with a special Inserter, only if the integrator requests it
		ibt, isIndexBuilding := idxAltTbl.(sql.IndexBuildingTable)
		if isIndexBuilding {
			shouldRebuild, err := ibt.ShouldBuildIndex(ctx, indexDef)
			if err != nil {
				return err
			}

			if shouldRebuild || indexCreateRequiresBuild(n) {
				return buildIndex(ctx, n, ibt, indexDef)
			}
		}

		// The second way to rebuild an index is with a full table rewrite
		rwt, isRewritable := idxAltTbl.(sql.RewritableTable)
		if isRewritable && indexCreateRequiresBuild(n) {
			return rewriteTableForIndexCreate(ctx, n, table, rwt)
		}

		return nil
	case plan.IndexAction_Drop:
		if fkTable, ok := idxAltTbl.(sql.ForeignKeyTable); ok {
			fks, err := fkTable.GetDeclaredForeignKeys(ctx)
			if err != nil {
				return err
			}
			for _, fk := range fks {
				_, ok, err := plan.FindFKIndexWithPrefix(ctx, fkTable, fk.Columns, false, n.IndexName)
				if err != nil {
					return err
				}
				if !ok {
					return sql.ErrForeignKeyDropIndex.New(n.IndexName, fk.Name)
				}
			}

			parentFks, err := fkTable.GetReferencedForeignKeys(ctx)
			if err != nil {
				return err
			}
			for _, parentFk := range parentFks {
				_, ok, err := plan.FindFKIndexWithPrefix(ctx, fkTable, parentFk.ParentColumns, true, n.IndexName)
				if err != nil {
					return err
				}
				if !ok {
					return sql.ErrForeignKeyDropIndex.New(n.IndexName, parentFk.Name)
				}
			}
		}

		// If we're dropping a Full-Text, then we also need to delete its tables
		if addressable, ok := idxAltTbl.(sql.IndexAddressableTable); !ok {
			// If they don't support their creation, then it's safe to assume that they won't have any to delete
			if _, err = getFulltextDatabase(n.Db); err != nil {
				return err
			}
		} else {
			indexes, err := addressable.GetIndexes(ctx)
			if err != nil {
				return err
			}
			// We need to keep a count of how many Full-Text indexes there are, so that we only delete the config table
			// once the last index has been deleted.
			ftCount := 0
			var ftIndex fulltext.Index
			lowercaseIndexName := strings.ToLower(n.IndexName)
			for _, index := range indexes {
				if strings.ToLower(index.ID()) == lowercaseIndexName {
					if index.IsFullText() {
						ftIndex, ok = index.(fulltext.Index)
						if !ok {
							return sql.ErrIncompleteFullTextIntegration.New()
						}
						ftCount++
					}
					break
				} else if index.IsFullText() {
					ftCount++
				}
			}
			// We found the index and it is Full-Text, so we need to delete the other tables
			if ftIndex != nil {
				dropper, ok := n.Db.(sql.TableDropper)
				if !ok {
					return sql.ErrIncompleteFullTextIntegration.New()
				}
				tableNames, err := ftIndex.FullTextTableNames(ctx)
				if err != nil {
					return err
				}
				// We only delete the config table when there are no more Full-Text indexes on the table since its shared
				if ftCount == 1 {
					if err = dropper.DropTable(ctx, tableNames.Config); err != nil {
						return err
					}
				}
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
			}
		}
		err = idxAltTbl.DropIndex(ctx, n.IndexName)
		if err != nil {
			if sql.ErrIndexNotFound.Is(err) && n.IfExists {
				return nil
			}
			return err
		}
		return nil
	case plan.IndexAction_Rename:
		return idxAltTbl.RenameIndex(ctx, n.PreviousIndexName, n.IndexName)
	case plan.IndexAction_DisableEnableKeys:
		if ctx != nil && ctx.Session != nil {
			ctx.Session.Warn(&sql.Warning{
				Level:   "Warning",
				Code:    mysql.ERNotSupportedYet,
				Message: "'disable/enable keys' feature is not supported yet",
			})
		}
		return nil
	default:
		return plan.ErrIndexActionNotImplemented.New(n.Action)
	}
}

// warnOnDuplicateSecondaryIndex emits a session warning if the newly created index |newIndexName| duplicates
// an existing index already existing on |idxAltTbl|.
func warnOnDuplicateSecondaryIndex(ctx *sql.Context, newIndexName string, idxAltTbl sql.IndexAlterableTable) error {
	idxTbl, ok := idxAltTbl.(sql.IndexAddressableTable)
	if !ok {
		return fmt.Errorf("error: %T doesn't implement IndexAddressableTable", idxAltTbl)
	}

	existingIndexes, err := idxTbl.GetIndexes(ctx)
	if err != nil {
		return err
	}

	// Find the new sql.Index by name
	var newIdx sql.Index
	for _, existingIndex := range existingIndexes {
		if existingIndex.ID() == newIndexName {
			newIdx = existingIndex
		}
	}

	// Then iterate through the existing indexes to look for a duplicate
	if newIdx != nil {
		for _, existingIndex := range existingIndexes {
			if existingIndex == newIdx || existingIndex.ID() == "PRIMARY" {
				continue
			}

			if len(newIdx.ColumnExpressionTypes()) != len(existingIndex.ColumnExpressionTypes()) {
				continue
			}

			for i, existingColumnExpressionType := range existingIndex.ColumnExpressionTypes() {
				if existingColumnExpressionType.Expression != newIdx.ColumnExpressionTypes()[i].Expression {
					continue
				}
				if !existingColumnExpressionType.Type.Equals(newIdx.ColumnExpressionTypes()[i].Type) {
					continue
				}
			}

			// Log a session warning if we find a duplicate, then break, to avoid multiple warnings
			ctx.Warn(1831, "Duplicate index '%s' defined on the table '%s.%s'. "+
				"This is deprecated and will be disallowed in a future release.",
				newIdx.ID(), newIdx.Database(), newIdx.Table())
			break
		}
	}
	return nil
}

// buildIndex builds an index on a table, as a less expensive alternative to doing a complete table rewrite.
func buildIndex(ctx *sql.Context, n *plan.AlterIndex, ibt sql.IndexBuildingTable, indexDef sql.IndexDef) error {
	inserter, err := ibt.BuildIndex(ctx, indexDef)
	if err != nil {
		return err
	}

	partitions, err := ibt.Partitions(ctx)
	if err != nil {
		return err
	}

	var rowIter sql.RowIter = sql.NewTableRowIter(ctx, ibt, partitions)
	rowIter = withSafepointPeriodicallyIter(rowIter)

	// Our table scan needs to include projections for virtual columns if there are any
	isVirtual := ibt.Schema().HasVirtualColumns()
	var projections []sql.Expression
	if isVirtual {
		projections = virtualTableProjections(n.TargetSchema(), ibt.Name())
	}

	for {
		r, err := rowIter.Next(ctx)
		if err == io.EOF {
			break
		} else if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return err
		}

		if isVirtual {
			r, err = ProjectRow(ctx, projections, r)
			if err != nil {
				return err
			}
		}

		err = inserter.Insert(ctx, r)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return err
		}
	}

	// TODO: move this into iter.close, probably
	err = inserter.Close(ctx)
	if err != nil {
		return err
	}
	return nil
}

// virtualTableProjections returns the projections for a virtual table with the schema and name provided.
// Typically virtual tables have their projections applied by the analyzer and row executor process, but this is
// equivalent when we need it at runtime.
func virtualTableProjections(schema sql.Schema, tableName string) []sql.Expression {
	projections := make([]sql.Expression, len(schema))
	for i, c := range schema {
		if !c.Virtual {
			// todo: if we really need colId/tableId we can get from scope
			projections[i] = expression.NewGetFieldWithTable(i, 1, c.Type, c.DatabaseSource, tableName, c.Name, c.Nullable)
		} else {
			projections[i] = c.Generated
		}
	}

	for i, p := range projections {
		projections[i] = assignColumnIndexes(p, schema)
	}

	return projections
}

// assignColumnIndexes fixes the column indexes in the expression to match the schema given
func assignColumnIndexes(e sql.Expression, schema sql.Schema) sql.Expression {
	e, _, _ = transform.Expr(e, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		if gf, ok := e.(*expression.GetField); ok {
			idx := schema.IndexOfColName(gf.Name())
			return gf.WithIndex(idx), transform.NewTree, nil
		}
		return e, transform.SameTree, nil
	})
	return e
}

func rewriteTableForIndexCreate(ctx *sql.Context, n *plan.AlterIndex, table sql.Table, rwt sql.RewritableTable) error {
	sch := sql.SchemaToPrimaryKeySchema(table, n.TargetSchema())
	inserter, err := rwt.RewriteInserter(ctx, sch, sch, nil, nil, n.Columns)
	if err != nil {
		return err
	}

	partitions, err := rwt.Partitions(ctx)
	if err != nil {
		return err
	}

	var rowIter sql.RowIter = sql.NewTableRowIter(ctx, rwt, partitions)
	rowIter = withSafepointPeriodicallyIter(rowIter)

	isVirtual := table.Schema().HasVirtualColumns()
	var projections []sql.Expression
	if isVirtual {
		projections = virtualTableProjections(n.TargetSchema(), table.Name())
	}

	for {
		r, err := rowIter.Next(ctx)
		if err == io.EOF {
			break
		} else if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return err
		}

		if isVirtual {
			r, err = ProjectRow(ctx, projections, r)
			if err != nil {
				return err
			}
		}

		err = inserter.Insert(ctx, r)
		if err != nil {
			_ = inserter.DiscardChanges(ctx, err)
			_ = inserter.Close(ctx)
			return err
		}
	}

	// TODO: move this into iter.close, probably
	err = inserter.Close(ctx)
	if err != nil {
		return err
	}
	return nil
}

// indexRequiresBuild returns whether the given index requires a build operation to be performed as part of its creation
func indexCreateRequiresBuild(n *plan.AlterIndex) bool {
	return n.Constraint == sql.IndexConstraint_Unique
}

func indexOnVirtualColumn(columns []sql.IndexColumn, schema sql.Schema) bool {
	for _, col := range columns {
		idx := schema.IndexOfColName(col.Name)
		if idx < 0 {
			return false // should be impossible
		}
		if schema[idx].Virtual {
			return true
		}
	}
	return false
}

// Execute inserts the rows in the database.
func (b *BaseBuilder) executeAlterAutoInc(ctx *sql.Context, n *plan.AlterAutoIncrement) error {
	// Grab the table fresh from the database.
	table, err := getTableFromDatabase(ctx, n.Database(), n.Table)
	if err != nil {
		return err
	}

	insertable, ok := table.(sql.InsertableTable)
	if !ok {
		return plan.ErrInsertIntoNotSupported.New()
	}

	autoTbl, ok := insertable.(sql.AutoIncrementTable)
	if !ok {
		return plan.ErrAutoIncrementNotSupported.New(insertable.Name())
	}

	// No-op if the table doesn't already have an auto increment column.
	if !autoTbl.Schema().HasAutoIncrement() {
		return nil
	}

	setter := autoTbl.AutoIncrementSetter(ctx)
	err = setter.SetAutoIncrementValue(ctx, n.AutoVal)
	if err != nil {
		return err
	}

	return setter.Close(ctx)
}

// hasFullText returns whether the given table has any Full-Text indexes.
func hasFullText(ctx *sql.Context, tbl sql.Table) bool {
	hasFT := false
	indexAddressable, ok := tbl.(sql.IndexAddressableTable)
	if ok {
		indexes, err := indexAddressable.GetIndexes(ctx)
		if err != nil {
			panic(err) // really, why would this ever happen
		}
		for _, index := range indexes {
			if index.IsFullText() {
				hasFT = true
				break
			}
		}
	}
	return hasFT
}

// rebuildFullText rebuilds all Full-Text indexes on the given table.
func rebuildFullText(ctx *sql.Context, tblName string, db sql.Database) error {
	updatedTable, ok, err := db.GetTableInsensitive(ctx, tblName)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("cannot find newly updated table `%s`", tblName)
	}
	return fulltext.RebuildTables(ctx, updatedTable.(sql.IndexAddressableTable), db.(fulltext.Database))
}
