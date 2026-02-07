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

package analyzer

import (
	"strings"

	"github.com/dolthub/go-mysql-server/sql/expression/function/aggregation"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// replaceCountStar replaces count(*) expressions with count(1) expressions, which are semantically equivalent and
// lets us prune all the unused columns from the target tables.
func replaceCountStar(ctx *sql.Context, a *Analyzer, n sql.Node, _ *plan.Scope, _ RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if plan.IsDDLNode(n) {
		return n, transform.SameTree, nil
	}

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		if agg, ok := n.(*plan.GroupBy); ok {
			if len(agg.GroupByExprs) == 0 && !qFlags.JoinIsSet() && !qFlags.SubqueryIsSet() && !qFlags.IsSet(sql.QFlagAnyAgg) && !qFlags.IsSet(sql.QFlagAnalyzeProcedure) {
				// top-level aggregation with a single group and no "any_value" functions can only return one row
				qFlags.Set(sql.QFlagMax1Row)
			}

			if len(agg.SelectDeps) == 1 && len(agg.GroupByExprs) == 0 {
				child := agg.SelectDeps[0]
				var cnt *aggregation.Count
				name := ""
				if alias, ok := child.(*expression.Alias); ok {
					cnt, _ = alias.Child.(*aggregation.Count)
					name = alias.Name()
				} else {
					cnt, _ = child.(*aggregation.Count)
					name = child.String()
				}

				if cnt == nil {
					return n, transform.SameTree, nil
				}

				var rt *plan.ResolvedTable
				switch c := agg.Child.(type) {
				case *plan.ResolvedTable:
					rt = c
				case *plan.TableAlias:
					if t, ok := c.Child.(*plan.ResolvedTable); ok {
						rt = t
					}
				}
				if rt == nil || sql.IsKeyless(rt.Table.Schema()) {
					return n, transform.SameTree, nil
				}

				var doReplace bool
				switch e := cnt.Child.(type) {
				case *expression.Star, *expression.Literal:
					doReplace = true

				case *expression.GetField:
					var matched bool
					var otherPk bool
					for _, col := range rt.Schema() {
						if col.PrimaryKey {
							if strings.EqualFold(col.Name, e.Name()) {
								matched = true
							} else {
								otherPk = true
							}
						}
					}
					doReplace = matched && !otherPk

				default:
				}

				if !doReplace {
					return n, transform.SameTree, nil
				}

				if statsTable, ok := getStatisticsTable(rt.Table, nil); ok {
					rowCnt, exact, err := statsTable.RowCount(ctx)
					if err == nil && exact {
						return plan.NewProject(
							[]sql.Expression{
								expression.NewAlias(name, expression.NewGetFieldWithTable(int(cnt.Id()), 0, types.Int64, rt.Database().Name(), statsTable.Name(), name, false)).WithId(cnt.Id()),
							},
							plan.NewTableCount(name, rt.SqlDatabase, statsTable, rowCnt, cnt.Id()),
						), transform.NewTree, nil
					}
				}
			}

		}

		return transform.NodeExprs(n, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
			if count, ok := e.(*aggregation.Count); ok {
				if _, ok := count.Child.(*expression.Star); ok {
					count, err := count.WithChildren(expression.NewLiteral(int64(1), types.Int64))
					if err != nil {
						return nil, transform.SameTree, err
					}
					return count, transform.NewTree, nil
				}
			}

			return e, transform.SameTree, nil
		})
	})
}
