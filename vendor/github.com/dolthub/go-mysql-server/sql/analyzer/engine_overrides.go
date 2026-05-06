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
	"github.com/dolthub/go-mysql-server/sql/transform"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// engineOverrides handles adding the engine overrides to any nodes or expressions that implement the corresponding
// interface.
func engineOverrides(_ *sql.Context, a *Analyzer, n sql.Node, _ *plan.Scope, _ RuleSelector, _ *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	newNode, sameNode, err := transform.NodeWithOpaque(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		overriding, ok := n.(sql.NodeOverriding)
		if !ok {
			return n, transform.SameTree, nil
		}
		return overriding.WithOverrides(a.Overrides), transform.NewTree, nil
	})
	if err != nil {
		return nil, transform.SameTree, err
	}
	newNode, sameExpr, err := transform.NodeExprsWithOpaque(newNode, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		overriding, ok := e.(sql.ExpressionOverriding)
		if !ok {
			return e, transform.SameTree, nil
		}
		return overriding.WithOverrides(a.Overrides), transform.NewTree, nil
	})
	if err != nil {
		return nil, transform.SameTree, err
	}
	return newNode, sameNode && sameExpr, nil
}
