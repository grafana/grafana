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

// validateDatabaseSet returns an error if any database node that requires a database doesn't have one
func validateDatabaseSet(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	var err error
	transform.Inspect(n, func(node sql.Node) bool {
		switch n.(type) {
		// TODO: there are probably other kinds of nodes that need this too
		case *plan.ShowTables, *plan.ShowTriggers, *plan.CreateTable:
			n := n.(sql.Databaser)
			if _, ok := n.Database().(sql.UnresolvedDatabase); ok {
				err = sql.ErrNoDatabaseSelected.New()
				return false
			}
		}
		return true
	})
	if err != nil {
		return nil, transform.SameTree, err
	}

	return n, transform.SameTree, nil
}
