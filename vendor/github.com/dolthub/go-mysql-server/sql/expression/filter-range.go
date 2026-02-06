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

package expression

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// NewRangeFilterExpr builds an expression that filters with the list of sql ranges and exprs.
//
// Exprs is the list of expressions to filter by.
// Ranges is the list of ranges to check against each expr.
//
// The length of each range must match the length of the exprs slice.
func NewRangeFilterExpr(exprs []sql.Expression, ranges []sql.MySQLRange) (sql.Expression, error) {
	if len(ranges) == 0 {
		return nil, nil
	}

	var rangeCollectionExpr sql.Expression
	for rangIdx, rang := range ranges {
		if len(exprs) < len(rang) {
			return nil, fmt.Errorf("expected different key count: exprs(%d) < (ranges[%d])(%d)", len(exprs), rangIdx, len(rang))
		}
		var rangeExpr sql.Expression
		for i, rce := range rang {
			var rangeColumnExpr sql.Expression
			switch rce.Type() {
			// Both Empty and All may seem like strange inclusions, but if only one range is given we need some
			// expression to evaluate, otherwise our expression would be a nil expression which would panic.
			case sql.RangeType_Empty:
				rangeColumnExpr = NewEquals(NewLiteral(1, types.Int8), NewLiteral(2, types.Int8))
			case sql.RangeType_All:
				rangeColumnExpr = NewEquals(NewLiteral(1, types.Int8), NewLiteral(1, types.Int8))
			case sql.RangeType_EqualNull:
				rangeColumnExpr = DefaultExpressionFactory.NewIsNull(exprs[i])
			case sql.RangeType_GreaterThan:
				if sql.MySQLRangeCutIsBinding(rce.LowerBound) {
					rangeColumnExpr = NewGreaterThan(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.LowerBound), rce.Typ.Promote()))
				} else {
					rangeColumnExpr = DefaultExpressionFactory.NewIsNotNull(exprs[i])
				}
			case sql.RangeType_GreaterOrEqual:
				rangeColumnExpr = NewGreaterThanOrEqual(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.LowerBound), rce.Typ.Promote()))
			case sql.RangeType_LessThanOrNull:
				rangeColumnExpr = JoinOr(
					NewLessThan(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.UpperBound), rce.Typ.Promote())),
					DefaultExpressionFactory.NewIsNull(exprs[i]),
				)
			case sql.RangeType_LessOrEqualOrNull:
				rangeColumnExpr = JoinOr(
					NewLessThanOrEqual(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.UpperBound), rce.Typ.Promote())),
					DefaultExpressionFactory.NewIsNull(exprs[i]),
				)
			case sql.RangeType_ClosedClosed:
				rangeColumnExpr = JoinAnd(
					NewGreaterThanOrEqual(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.LowerBound), rce.Typ.Promote())),
					NewLessThanOrEqual(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.UpperBound), rce.Typ.Promote())),
				)
			case sql.RangeType_OpenOpen:
				if sql.MySQLRangeCutIsBinding(rce.LowerBound) {
					rangeColumnExpr = JoinAnd(
						NewGreaterThan(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.LowerBound), rce.Typ.Promote())),
						NewLessThan(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.UpperBound), rce.Typ.Promote())),
					)
				} else {
					// Lower bound is (NULL, ...)
					rangeColumnExpr = NewLessThan(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.UpperBound), rce.Typ.Promote()))
				}
			case sql.RangeType_OpenClosed:
				if sql.MySQLRangeCutIsBinding(rce.LowerBound) {
					rangeColumnExpr = JoinAnd(
						NewGreaterThan(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.LowerBound), rce.Typ.Promote())),
						NewLessThanOrEqual(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.UpperBound), rce.Typ.Promote())),
					)
				} else {
					// Lower bound is (NULL, ...]
					rangeColumnExpr = NewLessThanOrEqual(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.UpperBound), rce.Typ.Promote()))
				}
			case sql.RangeType_ClosedOpen:
				rangeColumnExpr = JoinAnd(
					NewGreaterThanOrEqual(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.LowerBound), rce.Typ.Promote())),
					NewLessThan(exprs[i], NewLiteral(sql.GetMySQLRangeCutKey(rce.UpperBound), rce.Typ.Promote())),
				)
			}
			rangeExpr = JoinAnd(rangeExpr, rangeColumnExpr)
		}
		rangeCollectionExpr = JoinOr(rangeCollectionExpr, rangeExpr)
	}
	return rangeCollectionExpr, nil
}
