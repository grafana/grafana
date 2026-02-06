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
	"context"
	"fmt"
	"io"

	"github.com/dolthub/vitess/go/vt/proto/query"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type insertIter struct {
	ctx *sql.Context

	tableNode sql.Node
	inserter  sql.RowInserter
	replacer  sql.RowReplacer
	updater   sql.RowUpdater
	rowSource sql.RowIter

	deferredDefaults sql.FastIntSet
	unlocker         func()

	insertExprs                 []sql.Expression
	updateExprs                 []sql.Expression
	returnExprs                 []sql.Expression
	checks                      sql.CheckConstraints
	schema                      sql.Schema
	returnSchema                sql.Schema
	firstGeneratedAutoIncRowIdx int
	rowNumber                   int64
	closed                      bool
	ignore                      bool
	hasAfterTrigger             bool
}

func getInsertExpressions(values sql.Node) []sql.Expression {
	var exprs []sql.Expression
	transform.Inspect(values, func(node sql.Node) bool {
		switch node := node.(type) {
		case *plan.Project:
			exprs = node.Projections
			return false
		}
		return true
	})
	return exprs
}

func (i *insertIter) Next(ctx *sql.Context) (returnRow sql.Row, returnErr error) {
	row, err := i.rowSource.Next(ctx)
	if err == io.EOF {
		return nil, err
	}

	if err != nil {
		return nil, i.ignoreOrClose(ctx, row, err)
	}

	// Increment row number for error reporting (MySQL starts at 1)
	i.rowNumber++

	// Prune the row down to the size of the schema. It can be larger in the case of running with an outer scope, in which
	// case the additional scope variables are prepended to the row.
	if len(row) > len(i.schema) {
		row = row[len(row)-len(i.schema):]
	}

	// This is a special case in MySQL.
	// When there's an enum column with a NOT NULL constraint, the DEFAULT value is the first entry.
	for idx, col := range i.schema {
		if idx >= len(i.insertExprs) {
			break
		}
		_, isColDefVal := i.insertExprs[idx].(*sql.ColumnDefaultValue)
		if row[idx] == nil && !col.Nullable && types.IsEnum(col.Type) && isColDefVal {
			row[idx] = 1
		}
	}

	err = i.validateNullability(ctx, i.schema, row)
	if err != nil {
		return nil, i.ignoreOrClose(ctx, row, err)
	}

	err = i.evaluateChecks(ctx, row)
	if err != nil {
		return nil, i.ignoreOrClose(ctx, row, err)
	}

	origRow := make(sql.Row, len(row))
	copy(origRow, row)

	// Do any necessary type conversions to the target schema
	for idx, col := range i.schema {
		if row[idx] != nil {
			// Add column/row context for charset error messages
			// Unlike other errors that get recreated here with column/row info,
			// charset validation happens deep in ConvertToBytes and needs context during error creation
			ctxWithValues := context.WithValue(ctx.Context, types.ColumnNameKey, col.Name)
			ctxWithValues = context.WithValue(ctxWithValues, types.RowNumberKey, i.rowNumber)
			ctxWithColumnInfo := ctx.WithContext(ctxWithValues)
			val := row[idx]
			// TODO: check mysql strict sql_mode
			var converted any
			var inRange sql.ConvertInRange
			var cErr error
			if typ, ok := col.Type.(sql.RoundingNumberType); ok {
				converted, inRange, cErr = typ.ConvertRound(ctx, val)
			} else {
				converted, inRange, cErr = col.Type.Convert(ctxWithColumnInfo, val)
			}
			if cErr == nil && !inRange {
				cErr = sql.ErrValueOutOfRange.New(val, col.Type)
			}
			if sql.ErrTruncatedIncorrect.Is(cErr) {
				cErr = sql.ErrInvalidValue.New(val, col.Type)
			}
			if cErr != nil {
				// Ignore individual column errors when INSERT IGNORE, UPDATE IGNORE, etc. is specified.
				// For JSON column types, always throw an error. MySQL throws the following error even when
				// IGNORE is specified:
				// ERROR 3140 (22032): Invalid JSON text: "Invalid value." at position 0 in value for column
				// 'table.column'.
				if i.ignore && col.Type.Type() != query.Type_JSON {
					if _, ok := col.Type.(sql.NumberType); ok {
						if converted == nil {
							converted = i.schema[idx].Type.Zero()
						}
						row[idx] = converted
						// Add a warning instead
						ctx.Session.Warn(&sql.Warning{
							Level:   "Note",
							Code:    sql.CastSQLError(cErr).Num,
							Message: cErr.Error(),
						})
					} else {
						row = convertDataAndWarn(ctx, i.schema, row, idx, cErr)
					}
					continue
				} else {
					// Fill in error with information
					switch {
					case types.ErrLengthBeyondLimit.Is(cErr):
						cErr = types.ErrLengthBeyondLimit.New(row[idx], col.Name)
					case sql.ErrNotMatchingSRID.Is(cErr):
						cErr = sql.ErrNotMatchingSRIDWithColName.New(col.Name, cErr)
					case types.ErrConvertingToEnum.Is(cErr), sql.ErrInvalidSetValue.Is(cErr), sql.ErrConvertingToSet.Is(cErr):
						cErr = types.ErrDataTruncatedForColumnAtRow.New(col.Name, i.rowNumber)
					}
					return nil, sql.NewWrappedInsertError(origRow, cErr)
				}
			}
			row[idx] = converted
		}
	}

	if i.replacer != nil {
		toReturn := make(sql.Row, len(row)*2)
		for i := 0; i < len(row); i++ {
			toReturn[i+len(row)] = row[i]
		}
		// May have multiple duplicate pk & unique errors due to multiple indexes
		//TODO: how does this interact with triggers?
		for {
			if err := i.replacer.Insert(ctx, row); err != nil {
				if !sql.ErrPrimaryKeyViolation.Is(err) && !sql.ErrUniqueKeyViolation.Is(err) {
					i.rowSource.Close(ctx)
					i.rowSource = nil
					return nil, sql.NewWrappedInsertError(row, err)
				}

				ue := err.(*errors.Error).Cause().(sql.UniqueKeyError)
				if err = i.replacer.Delete(ctx, ue.Existing); err != nil {
					i.rowSource.Close(ctx)
					i.rowSource = nil
					return nil, sql.NewWrappedInsertError(row, err)
				}
				// the row had to be deleted, write the values into the toReturn row
				copy(toReturn, ue.Existing)
			} else {
				break
			}
		}
		return toReturn, nil
	} else {
		if err := i.inserter.Insert(ctx, row); err != nil {
			if (!sql.ErrPrimaryKeyViolation.Is(err) && !sql.ErrUniqueKeyViolation.Is(err) && !sql.ErrDuplicateEntry.Is(err)) || len(i.updateExprs) == 0 {
				return nil, i.ignoreOrClose(ctx, row, err)
			}

			ue := err.(*errors.Error).Cause().(sql.UniqueKeyError)
			return i.handleOnDuplicateKeyUpdate(ctx, ue.Existing, row)
		}
	}

	i.updateLastInsertId(ctx, row)

	if len(i.returnExprs) > 0 && !i.hasAfterTrigger {
		return i.getReturningRow(ctx, row)
	}

	return row, nil
}

func (i *insertIter) getReturningRow(ctx *sql.Context, row sql.Row) (sql.Row, error) {
	var retExprRow sql.Row
	for _, returnExpr := range i.returnExprs {
		result, err := returnExpr.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		retExprRow = append(retExprRow, result)
	}
	return retExprRow, nil
}

func (i *insertIter) handleOnDuplicateKeyUpdate(ctx *sql.Context, oldRow, newRow sql.Row) (returnRow sql.Row, returnErr error) {
	var err error
	updateAcc := append(oldRow, newRow...)
	var evalRow sql.Row
	for _, updateExpr := range i.updateExprs {
		// this SET <val> indexes into LHS, but the <expr> can
		// reference the new row on RHS
		val, err := updateExpr.Eval(i.ctx, updateAcc)
		if err != nil {
			if i.ignore {
				idx, ok := getFieldIndexFromUpdateExpr(updateExpr)
				if !ok {
					return nil, err
				}
				val = convertDataAndWarn(ctx, i.schema, newRow, idx, err)
			} else {
				return nil, err
			}
		}
		updateAcc = val.(sql.Row)
	}
	// project LHS only
	evalRow = updateAcc[:len(oldRow)]

	// Should revaluate the check conditions.
	err = i.evaluateChecks(ctx, evalRow)
	if err != nil {
		return nil, i.ignoreOrClose(ctx, newRow, err)
	}

	err = i.updater.Update(ctx, oldRow, evalRow)
	if err != nil {
		return nil, i.ignoreOrClose(ctx, newRow, err)
	}

	// In the case that we attempted an update, return a concatenated [old,new] row just like update.
	return oldRow.Append(evalRow), nil
}

func getFieldIndexFromUpdateExpr(updateExpr sql.Expression) (int, bool) {
	setField, ok := updateExpr.(*expression.SetField)
	if !ok {
		return 0, false
	}

	getField, ok := setField.LeftChild.(*expression.GetField)
	if !ok {
		return 0, false
	}

	return getField.Index(), true
}

// resolveValues resolves all VALUES functions.
func (i *insertIter) resolveValues(ctx *sql.Context, insertRow sql.Row) error {
	// if vals empty then no need to resolve
	for _, updateExpr := range i.updateExprs {
		var err error
		sql.Inspect(updateExpr, func(expr sql.Expression) bool {
			valuesExpr, ok := expr.(*function.Values)
			if !ok {
				return true
			}
			getField, ok := valuesExpr.Child.(*expression.GetField)
			if !ok {
				err = fmt.Errorf("VALUES functions may only contain column names")
				return false
			}
			valuesExpr.Value = insertRow[getField.Index()]
			return false
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (i *insertIter) Close(ctx *sql.Context) error {
	if !i.closed {
		i.closed = true
		if i.unlocker != nil {
			i.unlocker()
		}
		var rsErr, iErr, rErr, uErr error
		if i.rowSource != nil {
			rsErr = i.rowSource.Close(ctx)
		}
		if i.inserter != nil {
			iErr = i.inserter.Close(ctx)
		}
		if i.replacer != nil {
			rErr = i.replacer.Close(ctx)
		}
		if i.updater != nil {
			uErr = i.updater.Close(ctx)
		}
		if rsErr != nil {
			return rsErr
		}
		if iErr != nil {
			return iErr
		}
		if rErr != nil {
			return rErr
		}
		if uErr != nil {
			return uErr
		}
	}
	return nil
}

func (i *insertIter) updateLastInsertId(ctx *sql.Context, row sql.Row) {
	if i.firstGeneratedAutoIncRowIdx < 0 {
		return
	}
	if i.firstGeneratedAutoIncRowIdx == 0 {
		autoIncVal := i.getAutoIncVal(row)
		ctx.SetLastQueryInfoInt(sql.LastInsertId, autoIncVal)
	}
	i.firstGeneratedAutoIncRowIdx--
}

func (i *insertIter) getAutoIncVal(row sql.Row) int64 {
	for i, expr := range i.insertExprs {
		if _, ok := expr.(*expression.AutoIncrement); ok {
			return toInt64(row[i])
		}
	}
	return 0
}

func (i *insertIter) ignoreOrClose(ctx *sql.Context, row sql.Row, err error) error {
	if !i.ignore {
		return sql.NewWrappedInsertError(row, err)
	}

	return warnOnIgnorableError(ctx, row, err)
}

// convertDataAndWarn modifies a row with data conversion issues in INSERT/UPDATE IGNORE calls
// Per MySQL docs "Rows set to values that would cause data conversion errors are set to the closest valid values instead"
// cc. https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sql-mode-strict
func convertDataAndWarn(ctx *sql.Context, tableSchema sql.Schema, row sql.Row, columnIdx int, err error) sql.Row {
	if types.ErrLengthBeyondLimit.Is(err) {
		maxLength := tableSchema[columnIdx].Type.(sql.StringType).MaxCharacterLength()
		row[columnIdx] = row[columnIdx].(string)[:maxLength] // truncate string
	} else {
		row[columnIdx] = tableSchema[columnIdx].Type.Zero()
	}

	sqlerr := sql.CastSQLError(err)

	// Add a warning instead
	if ctx != nil && ctx.Session != nil {
		ctx.Session.Warn(&sql.Warning{
			Level:   "Note",
			Code:    sqlerr.Num,
			Message: err.Error(),
		})
	}

	return row
}

func warnOnIgnorableError(ctx *sql.Context, row sql.Row, err error) error {
	// Check that this error is a part of the list of Ignorable Errors and create the relevant warning
	for _, ie := range plan.IgnorableErrors {
		if ie.Is(err) {
			sqlerr := sql.CastSQLError(err)

			// Add a warning instead
			if ctx != nil && ctx.Session != nil {
				ctx.Session.Warn(&sql.Warning{
					Level:   "Note",
					Code:    sqlerr.Num,
					Message: err.Error(),
				})
			}

			// In this case the default value gets updated so return nil
			if sql.ErrInsertIntoNonNullableDefaultNullColumn.Is(err) {
				return nil
			}

			// Return the InsertIgnore err to ensure our accumulator doesn't count this row.
			return sql.NewIgnorableError(row)
		}
	}

	return err
}

func (i *insertIter) evaluateChecks(ctx *sql.Context, row sql.Row) error {
	for _, check := range i.checks {
		if !check.Enforced {
			continue
		}

		res, err := sql.EvaluateCondition(ctx, check.Expr, row)

		if err != nil {
			return err
		}

		if sql.IsFalse(res) {
			return sql.ErrCheckConstraintViolated.New(check.Name)
		}
	}

	return nil
}

func (i *insertIter) validateNullability(ctx *sql.Context, dstSchema sql.Schema, row sql.Row) error {
	for count, col := range dstSchema {
		if !col.Nullable && row[count] == nil {
			// In the case of an IGNORE we set the nil value to a default and add a warning
			if !i.ignore {
				if i.deferredDefaults.Contains(count) {
					return sql.ErrInsertIntoNonNullableDefaultNullColumn.New(col.Name)
				}
				return sql.ErrInsertIntoNonNullableProvidedNull.New(col.Name)
			}
			row[count] = col.Type.Zero()
			_ = warnOnIgnorableError(ctx, row, sql.ErrInsertIntoNonNullableProvidedNull.New(col.Name)) // will always return nil
		}
	}
	return nil
}

func toInt64(x interface{}) int64 {
	switch x := x.(type) {
	case int:
		return int64(x)
	case uint:
		return int64(x)
	case int8:
		return int64(x)
	case uint8:
		return int64(x)
	case int16:
		return int64(x)
	case uint16:
		return int64(x)
	case int32:
		return int64(x)
	case uint32:
		return int64(x)
	case int64:
		return x
	case uint64:
		return int64(x)
	case float32:
		return int64(x)
	case float64:
		return int64(x)
	default:
		panic(fmt.Sprintf("Expected a numeric auto increment value, but got %T", x))
	}
}
