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
	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// validateDropTables ensures that each TableNode in DropTable is droppable, any UnresolvedTables are
// skipped due to `IF EXISTS` clause, and there aren't any non-table nodes.
func validateDropTables(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	dt, ok := n.(*plan.DropTable)
	if !ok {
		return n, transform.SameTree, nil
	}

	for _, table := range dt.Tables {
		switch t := table.(type) {
		case *plan.ResolvedTable:
			if _, ok := t.SqlDatabase.(sql.TableDropper); !ok {
				return nil, transform.SameTree, sql.ErrDropTableNotSupported.New(t.Database().Name())
			}
		case *plan.UnresolvedTable:
			if dt.IfExists() && ctx != nil && ctx.Session != nil {
				ctx.Session.Warn(&sql.Warning{
					Level:   "Note",
					Code:    mysql.ERBadTable,
					Message: sql.ErrUnknownTable.New(t.Name()).Error(),
				})
				continue
			}
			return nil, transform.SameTree, sql.ErrUnknownTable.New(t.Name())
		default:
			return nil, transform.SameTree, sql.ErrUnknownTable.New(getTableName(table))
		}
	}

	return n, transform.SameTree, nil
}
