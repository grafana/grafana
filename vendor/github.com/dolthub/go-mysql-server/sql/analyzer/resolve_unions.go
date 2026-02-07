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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// resolveUnions resolves the left and right side of a union node in isolation.
func resolveUnions(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if n.Resolved() {
		return n, transform.SameTree, nil
	}
	// Procedures explicitly handle unions
	if _, ok := n.(*plan.CreateProcedure); ok {
		return n, transform.SameTree, nil
	}

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		var u *plan.SetOp
		switch n := n.(type) {
		case *plan.SetOp:
			u = n
		default:
			return n, transform.SameTree, nil
		}
		subqueryCtx, cancelFunc := ctx.NewSubContext()
		defer cancelFunc()

		left, _, err := a.analyzeThroughBatch(subqueryCtx, u.Left(), scope, "default-rules", sel, qFlags)
		if err != nil {
			return nil, transform.SameTree, err
		}

		right, _, err := a.analyzeThroughBatch(subqueryCtx, u.Right(), scope, "default-rules", sel, qFlags)
		if err != nil {
			return nil, transform.SameTree, err
		}

		ret, err := n.WithChildren(left, right)
		if err != nil {
			return nil, transform.SameTree, err
		}
		return ret, transform.NewTree, nil
	})
}

func finalizeUnions(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	// Procedures explicitly handle unions
	if _, ok := n.(*plan.CreateProcedure); ok {
		return n, transform.SameTree, nil
	}

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		var u *plan.SetOp
		switch n := n.(type) {
		case *plan.SetOp:
			u = n
		case *plan.RecursiveCte:
			// rCTEs behave like unions after default rules
			u = n.Union()
		default:
			return n, transform.SameTree, nil
		}
		subqueryCtx, cancelFunc := ctx.NewSubContext()
		defer cancelFunc()

		scope.SetJoin(false)
		// TODO we could detect tree modifications here, skip rebuilding
		left, _, err := a.analyzeStartingAtBatch(subqueryCtx, u.Left(), scope, "default-rules", NewFinalizeUnionSel(sel), qFlags)
		if err != nil {
			return nil, transform.SameTree, err
		}

		scope.SetJoin(false)

		right, _, err := a.analyzeStartingAtBatch(subqueryCtx, u.Right(), scope, "default-rules", NewFinalizeUnionSel(sel), qFlags)
		if err != nil {
			return nil, transform.SameTree, err
		}

		scope.SetJoin(false)

		newN, err := n.WithChildren(left, right)
		if err != nil {
			return nil, transform.SameTree, err
		}

		// UNION can return multiple rows even when child queries use LIMIT 1, so disable Max1Row optimization
		qFlags.Unset(sql.QFlagMax1Row)

		return newN, transform.NewTree, nil
	})
}
