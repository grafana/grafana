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
	"github.com/dolthub/go-mysql-server/sql/expression/function"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// validateCheckConstraints validates DDL nodes that create table check constraints, such as CREATE TABLE and
// ALTER TABLE statements.
//
// TODO: validateCheckConstraints doesn't currently do any type validation on the check and will allow you to create
// checks that will never evaluate correctly.
func validateCheckConstraints(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	switch n := n.(type) {
	case *plan.CreateCheck:
		return validateCreateCheckNode(n)
	case *plan.CreateTable:
		return validateCreateTableChecks(ctx, a, n, scope)
	}

	return n, transform.SameTree, nil
}

func validateCreateTableChecks(ctx *sql.Context, a *Analyzer, n *plan.CreateTable, scope *plan.Scope) (sql.Node, transform.TreeIdentity, error) {
	columns, err := indexColumns(ctx, a, n, scope)
	if err != nil {
		return nil, transform.SameTree, err
	}

	transform.InspectExpressions(n, func(e sql.Expression) bool {
		if err != nil {
			return false
		}

		switch e := e.(type) {
		case *expression.Wrapper, nil:
			// column defaults, no need to inspect these
			return false
		default:
			// check expressions, must be validated
			// TODO: would be better to wrap these in something else to be able to identify them better
			err = checkExpressionValid(e)
			if err != nil {
				return false
			}

			switch e := e.(type) {
			case column:
				col := newTableCol(e.Table(), e.Name())
				if _, ok := columns[col]; !ok {
					if _, ok := columns[newTableCol("", e.Name())]; !ok {
						err = sql.ErrTableColumnNotFound.New(e.Table(), e.Name())
						return false
					}
				}
			}

			return true
		}
	})

	if err != nil {
		return nil, transform.SameTree, err
	}

	return n, transform.SameTree, nil
}

func validateCreateCheckNode(ct *plan.CreateCheck) (sql.Node, transform.TreeIdentity, error) {
	err := checkExpressionValid(ct.Check.Expr)
	if err != nil {
		return nil, transform.SameTree, err
	}

	return ct, transform.SameTree, nil
}

func checkExpressionValid(e sql.Expression) error {
	var err error
	sql.Inspect(e, func(e sql.Expression) bool {
		switch e := e.(type) {
		case *function.GetLock, *function.IsUsedLock, *function.IsFreeLock, function.ReleaseAllLocks, *function.ReleaseLock:
			err = sql.ErrInvalidConstraintFunctionNotSupported.New(e.String())
			return false
		case sql.FunctionExpression:
			if ndf, ok := e.(sql.NonDeterministicExpression); ok && ndf.IsNonDeterministic() {
				err = sql.ErrInvalidConstraintFunctionNotSupported.New(e.String())
			}
			return false
		case *plan.Subquery:
			err = sql.ErrInvalidConstraintSubqueryNotSupported.New(e.String())
			return false
		}
		return true
	})
	return err
}
