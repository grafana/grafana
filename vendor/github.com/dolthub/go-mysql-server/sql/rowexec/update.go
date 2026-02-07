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
	"errors"
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/hash"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

type updateIter struct {
	childIter    sql.RowIter
	updater      sql.RowUpdater
	checks       sql.CheckConstraints
	returnExprs  []sql.Expression
	schema       sql.Schema
	returnSchema sql.Schema
	closed       bool
	ignore       bool
}

func (u *updateIter) Next(ctx *sql.Context) (sql.Row, error) {
	oldAndNewRow, err := u.childIter.Next(ctx)
	if err != nil {
		return nil, err
	}

	oldRow, newRow := oldAndNewRow[:len(oldAndNewRow)/2], oldAndNewRow[len(oldAndNewRow)/2:]
	if equals, err := oldRow.Equals(ctx, newRow, u.schema); err == nil {
		if !equals {
			// apply check constraints
			for _, check := range u.checks {
				if !check.Enforced {
					continue
				}

				res, err := sql.EvaluateCondition(ctx, check.Expr, newRow)
				if err != nil {
					return nil, err
				}

				if sql.IsFalse(res) {
					return nil, u.ignoreOrError(ctx, newRow, sql.ErrCheckConstraintViolated.New(check.Name))
				}
			}

			err := u.validateNullability(ctx, newRow, u.schema)
			if err != nil {
				return nil, u.ignoreOrError(ctx, newRow, err)
			}

			err = u.updater.Update(ctx, oldRow, newRow)
			if err != nil {
				return nil, u.ignoreOrError(ctx, newRow, err)
			}
		}

		if len(u.returnExprs) > 0 {
			var retExprRow sql.Row
			for _, returnExpr := range u.returnExprs {
				result, err := returnExpr.Eval(ctx, newRow)
				if err != nil {
					return nil, err
				}
				retExprRow = append(retExprRow, result)
			}
			return retExprRow, nil
		}
	} else {
		return nil, err
	}

	return oldAndNewRow, nil
}

// Applies the update expressions given to the row given, returning the new resultant row. In the case that ignore is
// provided and there is a type conversion error, this function sets the value to the zero value as per the MySQL standard.
func applyUpdateExpressionsWithIgnore(ctx *sql.Context, updateExprs []sql.Expression, tableSchema sql.Schema, row sql.Row, ignore bool) (sql.Row, error) {
	var secondPass []int

	for i, updateExpr := range updateExprs {
		defaultVal, isDefaultVal := defaultValFromSetExpression(updateExpr)
		// Any generated columns must be projected into place so that the caller gets their newest values as well. We
		// do this in a second pass as necessary.
		if isDefaultVal && !defaultVal.IsLiteral() {
			secondPass = append(secondPass, i)
			continue
		}

		val, err := updateExpr.Eval(ctx, row)
		if err != nil {
			var wtce sql.WrappedTypeConversionError
			isTypeConversionError := errors.As(err, &wtce)
			if !isTypeConversionError || !ignore {
				return nil, err
			}

			cpy := row.Copy()
			cpy[wtce.OffendingIdx] = wtce.OffendingVal // Needed for strings
			val = convertDataAndWarn(ctx, tableSchema, cpy, wtce.OffendingIdx, wtce.Err)
		}
		var ok bool
		row, ok = val.(sql.Row)
		if !ok {
			return nil, plan.ErrUpdateUnexpectedSetResult.New(val)
		}
	}

	for _, index := range secondPass {
		val, err := updateExprs[index].Eval(ctx, row)
		if err != nil {
			return nil, err
		}

		var ok bool
		row, ok = val.(sql.Row)
		if !ok {
			return nil, plan.ErrUpdateUnexpectedSetResult.New(val)
		}
	}

	return row, nil
}

func (u *updateIter) validateNullability(ctx *sql.Context, row sql.Row, schema sql.Schema) error {
	for idx := 0; idx < len(row); idx++ {
		col := schema[idx]
		if !col.Nullable && row[idx] == nil {
			// In the case of an IGNORE we set the nil value to a default and add a warning
			if u.ignore {
				row[idx] = col.Type.Zero()
				_ = warnOnIgnorableError(ctx, row, sql.ErrInsertIntoNonNullableProvidedNull.New(col.Name)) // will always return nil
			} else {
				return sql.ErrInsertIntoNonNullableProvidedNull.New(col.Name)
			}

		}
	}
	return nil
}

func (u *updateIter) Close(ctx *sql.Context) error {
	if !u.closed {
		u.closed = true
		if err := u.updater.Close(ctx); err != nil {
			return err
		}
		return u.childIter.Close(ctx)
	}
	return nil
}

func (u *updateIter) ignoreOrError(ctx *sql.Context, row sql.Row, err error) error {
	if !u.ignore {
		return err
	}

	return warnOnIgnorableError(ctx, row, err)
}

func newUpdateIter(
	childIter sql.RowIter,
	schema sql.Schema,
	updater sql.RowUpdater,
	checks sql.CheckConstraints,
	ignore bool,
	returnExprs []sql.Expression,
	returnSchema sql.Schema,
) sql.RowIter {
	if ignore {
		return plan.NewCheckpointingTableEditorIter(&updateIter{
			childIter:    childIter,
			updater:      updater,
			schema:       schema,
			checks:       checks,
			ignore:       true,
			returnExprs:  returnExprs,
			returnSchema: returnSchema,
		}, updater)
	} else {
		return plan.NewTableEditorIter(&updateIter{
			childIter:    childIter,
			updater:      updater,
			schema:       schema,
			checks:       checks,
			returnExprs:  returnExprs,
			returnSchema: returnSchema,
		}, updater)
	}
}

// updateJoinIter wraps the child UpdateSource ProjectIter and returns join row in such a way that updates per table row are
// done once.
type updateJoinIter struct {
	updateSourceIter sql.RowIter
	joinNode         sql.Node
	updaters         map[string]sql.RowUpdater
	caches           map[string]sql.KeyValueCache
	disposals        map[string]sql.DisposeFunc
	accumulator      *updateJoinRowHandler
	joinSchema       sql.Schema
}

var _ sql.RowIter = (*updateJoinIter)(nil)

func (u *updateJoinIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		oldAndNewRow, err := u.updateSourceIter.Next(ctx)
		if err != nil {
			return nil, err
		}

		oldJoinRow, newJoinRow := oldAndNewRow[:len(oldAndNewRow)/2], oldAndNewRow[len(oldAndNewRow)/2:]

		tableToOldRowMap := plan.SplitRowIntoTableRowMap(oldJoinRow, u.joinSchema)
		tableToNewRowMap := plan.SplitRowIntoTableRowMap(newJoinRow, u.joinSchema)

		for tableName, _ := range u.updaters {
			oldTableRow := tableToOldRowMap[strings.ToLower(tableName)]

			// Handle the case of row being ignored due to it not being valid in the join row.
			if isRightOrLeftJoin(u.joinNode) {
				works, err := u.shouldUpdateDirectionalJoin(ctx, oldJoinRow, oldTableRow)
				if err != nil {
					return nil, err
				}

				if !works {
					// rewrite the newJoinRow to ensure an update does not happen
					tableToNewRowMap[tableName] = oldTableRow
					continue
				}
			}

			// Determine whether this row in the table has already been updated
			cache := u.getOrCreateCache(ctx, tableName)
			hash, err := hash.HashOf(ctx, nil, oldTableRow)
			if err != nil {
				return nil, err
			}

			_, err = cache.Get(hash)
			if errors.Is(err, sql.ErrKeyNotFound) {
				cache.Put(hash, struct{}{})

				// updateJoin counts matched rows from join output, unless a RETURNING clause
				// is in use, in which case there will not be an accumulator assigned, since we
				// don't need to return the count of updated rows, just the RETURNING expressions.
				if u.accumulator != nil {
					u.accumulator.handleRowMatched()
				}

				continue
			} else if err != nil {
				return nil, err
			}

			// If this row for the table has already been updated we rewrite the newJoinRow counterpart to ensure that this
			// returned row is not incorrectly counted by the update accumulator.
			tableToNewRowMap[tableName] = oldTableRow
		}

		newJoinRow = recreateRowFromMap(tableToNewRowMap, u.joinSchema)
		equals, err := oldJoinRow.Equals(ctx, newJoinRow, u.joinSchema)
		if err != nil {
			return nil, err
		}
		if !equals {
			return append(oldJoinRow, newJoinRow...), nil
		}
	}
}

func toJoinNode(node sql.Node) *plan.JoinNode {
	switch n := node.(type) {
	case *plan.JoinNode:
		return n
	case *plan.TopN:
		return toJoinNode(n.Child)
	case *plan.Filter:
		return toJoinNode(n.Child)
	case *plan.Project:
		return toJoinNode(n.Child)
	case *plan.Limit:
		return toJoinNode(n.Child)
	case *plan.Offset:
		return toJoinNode(n.Child)
	case *plan.Sort:
		return toJoinNode(n.Child)
	case *plan.Distinct:
		return toJoinNode(n.Child)
	case *plan.Having:
		return toJoinNode(n.Child)
	case *plan.Window:
		return toJoinNode(n.Child)
	default:
		return nil
	}
}

func isIndexedAccess(node sql.Node) bool {
	switch n := node.(type) {
	case *plan.Filter:
		return isIndexedAccess(n.Child)
	case *plan.TableAlias:
		return isIndexedAccess(n.Child)
	case *plan.JoinNode:
		return isIndexedAccess(n.Left())
	case *plan.IndexedTableAccess:
		return true
	}
	return false
}

func isRightOrLeftJoin(node sql.Node) bool {
	jn := toJoinNode(node)
	if jn == nil {
		return false
	}
	return jn.JoinType().IsLeftOuter()
}

// shouldUpdateDirectionalJoin determines whether a table row should be updated in the context of a large right/left join row.
// A table row should only be updated if 1) It fits the join conditions (the intersection of the join) 2) It fits only
// the left or right side of the join (given the direction). A row of all nils that does not pass condition 1 must not
// be part of the update operation. This is follows the logic as established in the joinIter.
func (u *updateJoinIter) shouldUpdateDirectionalJoin(ctx *sql.Context, joinRow, tableRow sql.Row) (bool, error) {
	jn := toJoinNode(u.joinNode)
	if jn == nil || !jn.JoinType().IsLeftOuter() {
		return true, fmt.Errorf("expected left join")
	}

	// If the overall row fits the join condition it is fine (i.e. middle of the venn diagram).
	val, err := jn.JoinCond().Eval(ctx, joinRow)
	if err != nil {
		return true, err
	}
	if v, ok := val.(bool); ok && v && !isIndexedAccess(jn) {
		return true, nil
	}

	for _, v := range tableRow {
		if v != nil {
			return true, nil
		}
	}

	// If the row is all nils we know it should not be updated as per the function description.
	return false, nil
}

func (u *updateJoinIter) Close(context *sql.Context) error {
	for _, disposeF := range u.disposals {
		disposeF()
	}

	return u.updateSourceIter.Close(context)
}

func (u *updateJoinIter) getOrCreateCache(ctx *sql.Context, tableName string) sql.KeyValueCache {
	potential, exists := u.caches[tableName]
	if exists {
		return potential
	}

	cache, disposal := ctx.Memory.NewHistoryCache()
	u.caches[tableName] = cache
	u.disposals[tableName] = disposal

	return cache
}

// recreateRowFromMap takes a join schema and row map and recreates the original join row.
func recreateRowFromMap(rowMap map[string]sql.Row, joinSchema sql.Schema) sql.Row {
	var ret sql.Row

	if len(joinSchema) == 0 {
		return ret
	}

	currentTable := strings.ToLower(joinSchema[0].Source)
	ret = append(ret, rowMap[currentTable]...)

	for i := 1; i < len(joinSchema); i++ {
		newTable := strings.ToLower(joinSchema[i].Source)
		if !strings.EqualFold(newTable, currentTable) {
			ret = append(ret, rowMap[newTable]...)
			currentTable = newTable
		}
	}

	return ret
}
