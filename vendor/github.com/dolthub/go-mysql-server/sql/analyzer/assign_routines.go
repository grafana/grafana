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
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// RoutineTable is a Table that depends on a procedures and functions.
type RoutineTable interface {
	sql.Table

	// AssignProcedures assigns a map of db-procedures to the routines table.
	AssignProcedures(p map[string][]*plan.Procedure) sql.Table
	// TODO: also should assign FUNCTIONS
}

// assignRoutines sets the catalog in the required nodes.
func assignRoutines(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("assign_routines")
	defer span.End()

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		if !n.Resolved() {
			return n, transform.SameTree, nil
		}

		switch node := n.(type) {
		case *plan.ResolvedTable:
			nc := *node
			ct, ok := nc.Table.(RoutineTable)

			var err error
			scope, err = loadStoredProcedures(ctx, a, n, scope, sel)
			if err != nil {
				return nil, false, err
			}

			dbs := a.Catalog.AllDatabases(ctx)
			pm := make(map[string][]*plan.Procedure)
			for _, db := range dbs {
				if scope != nil && scope.Procedures != nil {
					pm[db.Name()] = scope.Procedures.AllForDatabase(db.Name())
				}
			}

			if ok {
				nc.Table = ct.AssignProcedures(pm)
				return &nc, transform.NewTree, nil
			}
			return node, transform.SameTree, nil
		default:
			return node, transform.SameTree, nil
		}
	})
}
