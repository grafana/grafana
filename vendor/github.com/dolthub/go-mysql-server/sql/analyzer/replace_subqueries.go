// Copyright 2025 Dolthub, Inc.
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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// replaceSubqueries replaces subquery nodes that resolve to a whole table. For example, the subquery 'SELECT * from
// table' with no filters can be replaced with the table itself. If the replaced subquery is aliased, then it is
// replaced with an aliased table with the same alias name.
func replaceSubqueries(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !qFlags.SubqueryIsSet() {
		return n, transform.SameTree, nil
	}

	switch n := n.(type) {
	case *plan.ShowCreateTable, *plan.ShowColumns, *plan.CreateView:
		return n, transform.SameTree, nil
	}

	return transform.NodeWithOpaque(n, func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
		if sqa, ok := node.(*plan.SubqueryAlias); ok {
			switch child := sqa.Child.(type) {
			case *plan.Project:
				if len(sqa.ColumnNames) == 0 {
					if table, ok := child.Child.(*plan.ResolvedTable); ok && child.Schema().Equals(table.Schema()) {
						return plan.NewTableAlias(sqa.Name(), table), transform.NewTree, nil

					}
				}
			case *plan.TableAlias:
				if len(sqa.ColumnNames) == 0 {
					return plan.NewTableAlias(sqa.Name(), getResolvedTable(child)), transform.NewTree, nil
				}
			case *plan.SubqueryAlias:
				if sqa.Columns().Len() == child.Columns().Len() {
					// childColIdMap maps each ColumnId from sqa to the corresponding child ColumnId
					childColIdMap := make(map[sql.ColumnId]sql.ColumnId)
					colId, colIdOk := sqa.Columns().Next(1)
					childColId, childColIdOk := child.Columns().Next(1)
					for colIdOk && childColIdOk {
						childColIdMap[colId] = childColId
						colId, colIdOk = sqa.Columns().Next(colId + 1)
						childColId, childColIdOk = child.Columns().Next(childColId + 1)
					}
					scopeMapping := make(map[sql.ColumnId]sql.Expression)
					for col, _ := range sqa.ScopeMapping {
						// remap child scope mapping to sqa scope mapping
						scopeMapping[col] = child.ScopeMapping[childColIdMap[col]]
					}
					return sqa.WithChild(child.Child).WithScopeMapping(scopeMapping), transform.NewTree, nil
				}
			}

		}
		// TODO: do this for Subqueries too. Subqueries are Expressions, not Nodes so we'll have to consider how to
		//  transform an Expression into a Node
		return node, transform.SameTree, nil
	})
}
