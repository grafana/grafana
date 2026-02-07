// Copyright 2021 Dolthub, Inc.
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
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

type applyJoin struct {
	l        sql.Expression
	filter   sql.Expression
	original sql.Expression
	r        *plan.Subquery
	op       plan.JoinType
	max1     bool
}

// unnestInSubqueries converts expression.Comparer with an *plan.InSubquery
// RHS into joins. The match conditions include: 1) subquery is cacheable,
// 2) the top-level subquery projection is a get field with a sql.ColumnId
// and sql.TableId (to support join reordering).
// TODO decorrelate lhs too
// TODO non-null-rejecting with dual table
func unnestInSubqueries(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !qFlags.SubqueryIsSet() {
		return n, transform.SameTree, nil
	}

	switch n.(type) {
	case *plan.DeleteFrom, *plan.InsertInto:
		return n, transform.SameTree, nil
	}

	var unnested bool
	var aliases map[string]int

	ret := n
	var err error
	same := transform.NewTree
	for !same {
		// simplifySubqExpr can merge two scopes, requiring us to either
		// recurse on the merged scope or perform a fixed-point iteration.
		ret, same, err = transform.Node(ret, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
			var filters []sql.Expression
			var child sql.Node
			switch n := n.(type) {
			case *plan.Filter:
				child = n.Child
				filters = expression.SplitConjunction(n.Expression)
			default:
			}

			if sel == nil {
				return n, transform.SameTree, nil
			}

			var matches []applyJoin
			var newFilters []sql.Expression

			// separate decorrelation candidates
			for _, e := range filters {
				if !plan.IsNullRejecting(e) {
					// TODO: rewrite dual table to permit in-scope joins,
					// which aren't possible when values are projected
					// above join filter
					rt := getResolvedTable(n)
					if rt == nil || plan.IsDualTable(rt.Table) {
						newFilters = append(newFilters, e)
						continue
					}
				}

				candE := e
				op := plan.JoinTypeSemi
				if n, ok := e.(*expression.Not); ok {
					candE = n.Child
					op = plan.JoinTypeAnti
				}

				var sq *plan.Subquery
				var l sql.Expression
				var joinF sql.Expression
				var max1 bool
				switch e := candE.(type) {
				case *plan.InSubquery:
					sq, _ = e.RightChild.(*plan.Subquery)
					l = e.LeftChild

					joinF = expression.NewEquals(nil, nil)
				case expression.Comparer:
					sq, _ = e.Right().(*plan.Subquery)
					l = e.Left()
					joinF = e
					max1 = true
				default:
				}
				if sq != nil && sq.CanCacheResults() {
					matches = append(matches, applyJoin{l: l, r: sq, op: op, filter: joinF, max1: max1, original: candE})
				} else {
					newFilters = append(newFilters, e)
				}
			}
			if len(matches) == 0 {
				return n, transform.SameTree, nil
			}

			ret := child
			for _, m := range matches {
				// A successful candidate is built with:
				// (1) Semi or anti join between the outer scope and (2) conditioned on (3).
				// (2) Simplified or unnested subquery (table alias).
				// (3) Join condition synthesized from the original correlated expression
				//     normalized to match changes to (2).
				subq := m.r

				if aliases == nil {
					aliases = make(map[string]int)
					ta, err := getTableAliases(n, scope)
					if err != nil {
						return n, transform.SameTree, err
					}
					for k, _ := range ta.aliases {
						aliases[k] = 0
					}
				}

				var newSubq sql.Node
				newSubq, aliases, err = disambiguateTables(aliases, subq.Query)
				if err != nil {
					return ret, transform.SameTree, nil
				}

				rightF, ok, err := getHighestProjection(newSubq)
				if err != nil {
					return n, transform.SameTree, err
				}
				if !ok {
					newFilters = append(newFilters, m.original)
					continue
				}

				filter, err := m.filter.WithChildren(m.l, rightF)
				if err != nil {
					return n, transform.SameTree, err
				}
				var comment string
				if c, ok := ret.(sql.CommentedNode); ok {
					comment = c.Comment()
				}
				unnested = true
				newJoin := plan.NewJoin(ret, newSubq, m.op, filter)
				ret = newJoin.WithComment(comment)
			}

			if len(newFilters) == 0 {
				return ret, transform.NewTree, nil
			}
			if len(newFilters) == len(filters) {
				return n, transform.SameTree, nil
			}
			return plan.NewFilter(expression.JoinAnd(newFilters...), ret), transform.NewTree, nil
		})
		if err != nil {
			return n, transform.SameTree, err
		}
	}
	return ret, transform.TreeIdentity(!unnested), nil
}

// returns an updated sql.Node with aliases de-duplicated, and an
// updated alias mapping with new conflicts and tables added.
func disambiguateTables(used map[string]int, n sql.Node) (sql.Node, map[string]int, error) {
	rename := make(map[sql.TableId]string)
	n, _, err := transform.NodeWithCtx(n, nil, func(c transform.Context) (sql.Node, transform.TreeIdentity, error) {
		switch n := c.Node.(type) {
		case sql.RenameableNode:
			name := strings.ToLower(n.Name())
			if _, ok := c.Parent.(sql.RenameableNode); ok {
				// skip checking when: TableAlias(ResolvedTable)
				return n, transform.SameTree, nil
			}
			if cnt, ok := used[name]; ok {
				used[name] = cnt + 1
				newName := name
				for ok {
					cnt++
					newName = fmt.Sprintf("%s_%d", name, cnt)
					_, ok = used[newName]

				}
				used[newName] = 0

				tin, ok := n.(plan.TableIdNode)
				if !ok {
					return n, transform.SameTree, fmt.Errorf("expected sql.Renameable to implement plan.TableIdNode")
				}
				rename[tin.Id()] = newName
				return n.WithName(newName), transform.NewTree, nil
			} else {
				used[name] = 0
			}
			return n, transform.NewTree, nil
		default:
			return transform.NodeExprs(n, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
				switch e := e.(type) {
				case *expression.GetField:
					if cnt, ok := used[strings.ToLower(e.Table())]; ok && cnt > 0 {
						return e.WithTable(fmt.Sprintf("%s_%d", e.Table(), cnt)), transform.NewTree, nil
					}
				default:
				}
				return e, transform.NewTree, nil
			})
		}
	})
	if err != nil {
		return nil, nil, err
	}
	if len(rename) > 0 {
		n, _, err = renameExpressionTables(n, rename)
	}
	return n, used, err
}

// renameExpressionTables renames table references recursively. We use
// table ids to avoid improperly renaming tables in lower scopes with the
// same name.
func renameExpressionTables(n sql.Node, rename map[sql.TableId]string) (sql.Node, transform.TreeIdentity, error) {
	return transform.NodeExprs(n, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		switch e := e.(type) {
		case *expression.GetField:
			if to, ok := rename[e.TableId()]; ok {
				return e.WithTable(to), transform.NewTree, nil
			}
		case *plan.Subquery:
			newQ, same, err := renameExpressionTables(e.Query, rename)
			if !same || err != nil {
				return e, same, err
			}
			return e.WithQuery(newQ), transform.NewTree, nil
		default:
		}
		return e, transform.NewTree, nil
	})
}

// getHighestProjection returns a set of projection expressions responsible
// for the input node's schema, or false if an aggregate or set type is
// found (which we cannot generate named projections for yet).
func getHighestProjection(n sql.Node) (sql.Expression, bool, error) {
	sch := n.Schema()
	for n != nil {
		if !sch.Equals(n.Schema()) {
			break
		}
		var proj []sql.Expression
		switch nn := n.(type) {
		case *plan.Project:
			proj = nn.Projections
		case *plan.JoinNode:
			left, ok, err := getHighestProjection(nn.Left())
			if err != nil {
				return nil, false, err
			}
			if !ok {
				return nil, false, nil
			}
			right, ok, err := getHighestProjection(nn.Right())
			if err != nil {
				return nil, false, err
			}
			if !ok {
				return nil, false, nil
			}
			switch e := left.(type) {
			case expression.Tuple:
				proj = append(proj, e.Children()...)
			default:
				proj = append(proj, e)
			}
			switch e := right.(type) {
			case expression.Tuple:
				proj = append(proj, e.Children()...)
			default:
				proj = append(proj, e)
			}
		case *plan.GroupBy:
			// todo(max): could make better effort to get column ids from these,
			// but real fix is also giving synthesized projection column ids
			// in binder
			proj = nn.SelectDeps
		case *plan.Window:
			proj = nn.SelectExprs
		case *plan.SetOp:
			return nil, false, nil
		case plan.TableIdNode:
			colset := nn.Columns()
			idx := 0
			sch := n.Schema()
			for id, hasNext := colset.Next(1); hasNext; id, hasNext = colset.Next(id + 1) {
				col := sch[idx]
				proj = append(proj, expression.NewGetFieldWithTable(int(id), int(nn.Id()), col.Type, col.DatabaseSource, col.Source, col.Name, col.Nullable))
				idx++
			}
		default:
			if len(nn.Children()) == 1 {
				n = nn.Children()[0]
				continue
			}
		}
		if proj == nil {
			break
		}
		projCopy := make([]sql.Expression, len(proj))
		copy(projCopy, proj)
		for i, p := range projCopy {
			if a, ok := p.(*expression.Alias); ok {
				if a.Unreferencable() || a.Id() == 0 {
					return nil, false, nil
				}
				projCopy[i] = expression.NewGetField(int(a.Id()), a.Type(), a.Name(), a.IsNullable())
			}
		}
		if len(projCopy) == 1 {
			return projCopy[0], true, nil
		}
		return expression.NewTuple(projCopy...), true, nil
	}
	return nil, false, fmt.Errorf("failed to find decorrelation projection")
}
