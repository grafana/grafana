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
	"strings"

	"github.com/dolthub/go-mysql-server/sql/transform"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// resolveDropConstraint replaces DropConstraint nodes with a concrete type of alter table node as appropriate, or
// throws a constraint not found error if the named constraint isn't found on the table given.
func resolveDropConstraint(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		dropConstraint, ok := n.(*plan.DropConstraint)
		if !ok {
			return n, transform.SameTree, nil
		}

		rt, ok := dropConstraint.Child.(*plan.ResolvedTable)
		if !ok {
			return nil, transform.SameTree, ErrInAnalysis.New("Expected a TableNode for ALTER TABLE DROP CONSTRAINT statement")
		}

		//TODO: handle if a foreign key and check constraint have the same name, it should error saying to use the specific drop
		table := rt.Table
		fkt, ok := table.(sql.ForeignKeyTable)
		if ok {
			decFks, err := fkt.GetDeclaredForeignKeys(ctx)
			if err != nil {
				return nil, transform.SameTree, err
			}
			refFks, err := fkt.GetReferencedForeignKeys(ctx)
			if err != nil {
				return nil, transform.SameTree, err
			}
			for _, fk := range append(decFks, refFks...) {
				if strings.ToLower(fk.Name) == strings.ToLower(dropConstraint.Name) {
					n, err = plan.NewAlterDropForeignKey(rt.SqlDatabase.Name(), rt.Table.Name(), dropConstraint.Name).
						WithDatabaseProvider(a.Catalog.DbProvider)
					return n, transform.NewTree, err
				}
			}
		}

		ct, ok := table.(sql.CheckTable)
		if !ok {
			return nil, transform.SameTree, plan.ErrNoCheckConstraintSupport.New(table.Name())
		}

		checks, err := ct.GetChecks(ctx)
		if err != nil {
			return nil, transform.SameTree, err
		}

		for _, check := range checks {
			if strings.ToLower(check.Name) == strings.ToLower(dropConstraint.Name) {
				return plan.NewAlterDropCheck(rt, check.Name), transform.NewTree, nil
			}
		}

		if dropConstraint.IfExists {
			newAlterDropCheck := plan.NewAlterDropCheck(rt, dropConstraint.Name)
			newAlterDropCheck.IfExists = true
			return newAlterDropCheck, transform.NewTree, nil
		}

		return nil, transform.SameTree, sql.ErrUnknownConstraint.New(dropConstraint.Name)
	})
}

// validateDropConstraint returns an error if the constraint named to be dropped doesn't exist
func validateDropConstraint(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	switch n := n.(type) {
	case *plan.DropCheck:
		// Don't bother validating that the constraint exists if the IfExists flag is set
		if n.IfExists {
			return n, transform.SameTree, nil
		}

		rt := n.Table

		ct, ok := rt.Table.(sql.CheckTable)
		if ok {
			checks, err := ct.GetChecks(ctx)
			if err != nil {
				return nil, transform.SameTree, err
			}

			for _, check := range checks {
				if strings.ToLower(check.Name) == strings.ToLower(n.Name) {
					return n, transform.SameTree, nil
				}
			}

			return nil, transform.SameTree, sql.ErrUnknownConstraint.New(n.Name)
		}

		return nil, transform.SameTree, plan.ErrNoCheckConstraintSupport.New(rt.Table.Name())
	default:
		return n, transform.SameTree, nil
	}
}
