// Copyright 2022 Dolthub, Inc.
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
	"github.com/dolthub/go-mysql-server/sql/procedures"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// interpreter hands the engine to any interpreter expressions.
func interpreter(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	newNode, sameNode, err := transform.Node(n, func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
		if interp, ok := node.(procedures.InterpreterNode); ok {
			return interp.SetStatementRunner(ctx, a.Runner), transform.NewTree, nil
		}
		return node, transform.SameTree, nil
	})
	if err != nil {
		return nil, transform.SameTree, err
	}

	newNode, sameExpr, err := transform.NodeExprs(newNode, func(expr sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		if interp, ok := expr.(procedures.InterpreterExpr); ok {
			return interp.SetStatementRunner(ctx, a.Runner), transform.NewTree, nil
		}
		return expr, transform.SameTree, nil
	})
	if err != nil {
		return nil, transform.SameTree, err
	}

	return newNode, sameNode && sameExpr, err
}
