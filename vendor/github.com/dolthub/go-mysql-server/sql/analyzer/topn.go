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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// insertTopNNodes replaces Limit(Sort(...)) and Limit(Offset(Sort(...))) with
// a TopN node.
func insertTopNNodes(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	return transform.Node(n, func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
		limit, ok := node.(*plan.Limit)
		if !ok {
			return node, transform.SameTree, nil
		}
		child := limit.Child
		offset, ok := child.(*plan.Offset)
		if ok {
			child = offset.Child
		}
		proj, ok := child.(*plan.Project)
		if ok {
			child = proj.Child
		}
		sort, ok := child.(*plan.Sort)
		if !ok {
			return node, transform.SameTree, nil
		}

		var newNode sql.Node
		var err error
		if offset != nil {
			newNode = plan.NewTopN(sort.SortFields, expression.NewPlus(limit.Limit, offset.Offset), sort.Child).WithCalcFoundRows(limit.CalcFoundRows)
			newNode, err = offset.WithChildren(newNode)
			if err != nil {
				return nil, transform.SameTree, err
			}
		} else {
			newNode = plan.NewTopN(sort.SortFields, limit.Limit, sort.Child).WithCalcFoundRows(limit.CalcFoundRows)
		}
		if proj != nil {
			newNode, err = proj.WithChildren(newNode)
			if err != nil {
				return nil, transform.SameTree, err
			}
			// For doltgres generate_series(...) to work correctly, the original limit node must remain.
			newNode, err = limit.WithCalcFoundRows(false).WithChildren(newNode)
			if err != nil {
				return nil, transform.SameTree, err
			}
		}
		return newNode, transform.NewTree, nil
	})
}
