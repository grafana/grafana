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
	"fmt"
	"strings"

	"github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// processTruncate is a combination of resolving fields in *plan.DeleteFrom and *plan.Truncate, validating the fields,
// and in some cases converting *plan.DeleteFrom -> *plan.Truncate
func processTruncate(ctx *sql.Context, a *Analyzer, node sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("processTruncate")
	defer span.End()

	switch n := node.(type) {
	case *plan.DeleteFrom:
		// If there are any returning expressions, then we can't convert to a Truncate operation,
		// since we need to process all rows and return results.
		if !n.Resolved() || len(n.Returning) > 0 {
			return n, transform.SameTree, nil
		}
		return deleteToTruncate(ctx, a, n)
	case *plan.Truncate:
		if !n.Resolved() {
			return nil, transform.SameTree, fmt.Errorf("cannot process TRUNCATE as node is expected to be resolved")
		}
		var db sql.Database
		var err error
		if n.DatabaseName() == "" {
			db, err = a.Catalog.Database(ctx, ctx.GetCurrentDatabase())
			if err != nil {
				return nil, transform.SameTree, err
			}
		} else {
			db, err = a.Catalog.Database(ctx, n.DatabaseName())
			if err != nil {
				return nil, transform.SameTree, err
			}
		}
		_, err = validateTruncate(ctx, db, n.Child)
		if err != nil {
			return nil, transform.SameTree, err
		}
		return n, transform.SameTree, nil
	default:
		return n, transform.SameTree, nil
	}
}

func deleteToTruncate(ctx *sql.Context, a *Analyzer, deletePlan *plan.DeleteFrom) (sql.Node, transform.TreeIdentity, error) {
	tbl, ok := deletePlan.Child.(*plan.ResolvedTable)
	if !ok {
		return deletePlan, transform.SameTree, nil
	}
	tblName := strings.ToLower(tbl.Name())

	// auto_increment behaves differently for TRUNCATE and DELETE
	for _, col := range tbl.Schema() {
		if col.AutoIncrement {
			return deletePlan, transform.SameTree, nil
		}
	}

	currentDb, err := a.Catalog.Database(ctx, ctx.GetCurrentDatabase())
	if err != nil {
		return nil, transform.SameTree, err
	}
	dbTblNames, err := currentDb.GetTableNames(ctx)
	if err != nil {
		return nil, transform.SameTree, err
	}
	tblFound := false
	for _, dbTblName := range dbTblNames {
		if strings.ToLower(dbTblName) == tblName {
			if tblFound == false {
				tblFound = true
			} else {
				return deletePlan, transform.SameTree, nil
			}
		}
	}
	if !tblFound {
		return deletePlan, transform.SameTree, nil
	}

	triggers, err := loadTriggersFromDb(ctx, a, currentDb, false)
	if err != nil {
		return nil, transform.SameTree, err
	}
	for _, trigger := range triggers {
		if trigger.TriggerEvent != sqlparser.DeleteStr {
			continue
		}
		var triggerTblName string
		switch trigger.Table.(type) {
		case *plan.UnresolvedTable, *plan.ResolvedTable:
			triggerTblName = trigger.Table.(sql.NameableNode).Name()
		default:
			// If we can't determine the name of the table that the trigger is on, we just abort to be safe
			// TODO error?
			return deletePlan, transform.SameTree, nil
		}
		if strings.ToLower(triggerTblName) == tblName {
			// An ON DELETE trigger is present so we can't use TRUNCATE
			return deletePlan, transform.SameTree, nil
		}
	}

	if ok, err := validateTruncate(ctx, currentDb, tbl); ok {
		// We only check err if ok is true, as some errors won't apply to us attempting to convert from a DELETE
		if err != nil {
			return nil, transform.SameTree, err
		}
		return plan.NewTruncate(ctx.GetCurrentDatabase(), tbl), transform.NewTree, nil
	}
	return deletePlan, transform.SameTree, nil
}

// validateTruncate returns whether the truncate operation adheres to the limitations as specified in
// https://dev.mysql.com/doc/refman/8.0/en/truncate-table.html. In the case of checking if a DELETE may be converted
// to a TRUNCATE operation, check the bool first. If false, then the error should be ignored (such as if the table does
// not support TRUNCATE). If true is returned along with an error, then the error is not expected to happen under
// normal circumstances and should be dealt with.
func validateTruncate(ctx *sql.Context, db sql.Database, tbl sql.Node) (bool, error) {
	truncatable, err := plan.GetTruncatable(tbl)
	if err != nil {
		return false, err // false as any caller besides Truncate would not care for this error
	}
	tableName := strings.ToLower(truncatable.Name())

	tableNames, err := db.GetTableNames(ctx)
	if err != nil {
		return true, err // true as this should not error under normal circumstances
	}
	for _, tableNameToCheck := range tableNames {
		if strings.ToLower(tableNameToCheck) == tableName {
			continue
		}
		tableToCheck, ok, err := db.GetTableInsensitive(ctx, tableNameToCheck)
		if err != nil {
			return true, err // should not error under normal circumstances
		}
		if !ok {
			return true, sql.ErrTableNotFound.New(tableNameToCheck)
		}
		fkTable, ok := tableToCheck.(sql.ForeignKeyTable)
		if ok {
			fks, err := fkTable.GetDeclaredForeignKeys(ctx)
			if err != nil {
				return true, err
			}

			fkChecks, err := ctx.GetSessionVariable(ctx, "foreign_key_checks")
			if err != nil {
				return true, err
			}

			if fkChecks.(int8) == 1 {
				for _, fk := range fks {
					if strings.ToLower(fk.ParentTable) == tableName {
						return false, sql.ErrTruncateReferencedFromForeignKey.New(tableName, fk.Name, tableNameToCheck)
					}
				}
			}
		}
	}
	//TODO: check for an active table lock and error if one is found for the target table
	return true, nil
}
