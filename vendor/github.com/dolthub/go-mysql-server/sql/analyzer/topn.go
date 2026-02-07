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
	var updateCalcFoundRows bool
	return transform.NodeWithCtx(n, nil, func(tc transform.Context) (sql.Node, transform.TreeIdentity, error) {
		if o, ok := tc.Node.(*plan.Offset); ok {
			parentLimit, ok := tc.Parent.(*plan.Limit)
			if !ok {
				return tc.Node, transform.SameTree, nil
			}
			childSort, ok := o.UnaryNode.Child.(*plan.Sort)
			if !ok {
				return tc.Node, transform.SameTree, nil
			}
			topn := plan.NewTopN(childSort.SortFields, expression.NewPlus(parentLimit.Limit, o.Offset), childSort.UnaryNode.Child)
			topn = topn.WithCalcFoundRows(parentLimit.CalcFoundRows)
			updateCalcFoundRows = true
			node, err := o.WithChildren(topn)
			return node, transform.NewTree, err
		} else if l, ok := tc.Node.(*plan.Limit); ok {
			childSort, ok := l.UnaryNode.Child.(*plan.Sort)
			if !ok {
				if updateCalcFoundRows {
					updateCalcFoundRows = false
					return l.WithCalcFoundRows(false), transform.NewTree, nil
				}
				return tc.Node, transform.SameTree, nil
			}
			topn := plan.NewTopN(childSort.SortFields, l.Limit, childSort.UnaryNode.Child)
			topn = topn.WithCalcFoundRows(l.CalcFoundRows)
			node, err := l.WithCalcFoundRows(false).WithChildren(topn)
			return node, transform.NewTree, err
		}
		return tc.Node, transform.SameTree, nil
	})
}
