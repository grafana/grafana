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
	"reflect"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/analyzer/analyzererrors"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function"
	"github.com/dolthub/go-mysql-server/sql/expression/function/aggregation"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// validateOffsetAndLimit ensures that only integer literals are used for limit and offset values
func validateOffsetAndLimit(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	var err error
	var i, i64 interface{}
	transform.Inspect(n, func(n sql.Node) bool {
		switch n := n.(type) {
		case *plan.Limit:
			switch e := n.Limit.(type) {
			case *expression.Literal:
				if !types.IsInteger(e.Type()) {
					err = sql.ErrInvalidType.New(e.Type().String())
					return false
				}
				i, err = e.Eval(ctx, nil)
				if err != nil {
					return false
				}

				i64, _, err = types.Int64.Convert(ctx, i)
				if err != nil {
					return false
				}
				if i64.(int64) < 0 {
					err = sql.ErrInvalidSyntax.New("negative limit")
					return false
				}
			case *expression.BindVar, *expression.ProcedureParam:
				return true
			default:
				err = sql.ErrInvalidType.New(e.Type().String())
				return false
			}
		case *plan.Offset:
			switch e := n.Offset.(type) {
			case *expression.Literal:
				if !types.IsInteger(e.Type()) {
					err = sql.ErrInvalidType.New(e.Type().String())
					return false
				}
				i, err = e.Eval(ctx, nil)
				if err != nil {
					return false
				}

				i64, _, err = types.Int64.Convert(ctx, i)
				if err != nil {
					return false
				}
				if i64.(int64) < 0 {
					err = sql.ErrInvalidSyntax.New("negative offset")
					return false
				}
			case *expression.BindVar, *expression.ProcedureParam:
				return true
			default:
				err = sql.ErrInvalidType.New(e.Type().String())
				return false
			}
		default:
			return true
		}
		return true
	})
	return n, transform.SameTree, err
}

func validateResolved(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("validate_is_resolved")
	defer span.End()

	if !n.Resolved() {
		return nil, transform.SameTree, unresolvedError(n)
	}

	return n, transform.SameTree, nil
}

// unresolvedError returns an appropriate error message for the unresolved node given
func unresolvedError(n sql.Node) error {
	var err error
	var walkFn func(sql.Expression) bool
	walkFn = func(e sql.Expression) bool {
		switch e := e.(type) {
		case *plan.Subquery:
			transform.InspectExpressions(e.Query, walkFn)
			if err != nil {
				return false
			}
		}
		return true
	}
	transform.InspectExpressions(n, walkFn)

	if err != nil {
		return err
	}
	return analyzererrors.ErrValidationResolved.New(n)
}

func validateOrderBy(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("validate_order_by")
	defer span.End()

	switch n := n.(type) {
	case *plan.Sort:
		for _, field := range n.SortFields {
			switch field.Column.(type) {
			case sql.Aggregation:
				return nil, transform.SameTree, analyzererrors.ErrValidationOrderBy.New()
			}
		}
	}

	return n, transform.SameTree, nil
}

// validateDeleteFrom checks for invalid settings, such as deleting from multiple databases, specifying a delete target
// table multiple times, or using a DELETE FROM JOIN without specifying any explicit delete target tables, and returns
// an error if any validation issues were detected.
func validateDeleteFrom(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("validate_order_by")
	defer span.End()

	var validationError error
	transform.InspectUp(n, func(n sql.Node) bool {
		df, ok := n.(*plan.DeleteFrom)
		if !ok {
			return false
		}

		// Check that delete from join only targets tables that exist in the join
		if df.HasExplicitTargets() {
			sourceTables := make(map[string]struct{})
			transform.Inspect(df.Child, func(node sql.Node) bool {
				if t, ok := node.(sql.Table); ok {
					sourceTables[t.Name()] = struct{}{}
				}
				return true
			})

			for _, target := range df.GetDeleteTargets() {
				deletable, err := plan.GetDeletable(target)
				if err != nil {
					validationError = err
					return true
				}
				tableName := deletable.Name()
				if _, ok := sourceTables[tableName]; !ok {
					validationError = fmt.Errorf("table %q not found in DELETE FROM sources", tableName)
					return true
				}
			}
		}

		// Duplicate explicit target tables or from explicit target tables from multiple databases
		databases := make(map[string]struct{})
		tables := make(map[string]struct{})
		if df.HasExplicitTargets() {
			for _, target := range df.GetDeleteTargets() {
				// Check for multiple databases
				databases[plan.GetDatabaseName(target)] = struct{}{}
				if len(databases) > 1 {
					validationError = fmt.Errorf("multiple databases specified as delete from targets")
					return true
				}

				// Check for duplicate targets
				nameable, ok := target.(sql.Nameable)
				if !ok {
					validationError = fmt.Errorf("target node does not implement sql.Nameable: %T", target)
					return true
				}

				if _, ok := tables[nameable.Name()]; ok {
					validationError = fmt.Errorf("duplicate tables specified as delete from targets")
					return true
				}
				tables[nameable.Name()] = struct{}{}
			}
		}

		// DELETE FROM JOIN with no target tables specified
		deleteFromJoin := false
		transform.Inspect(df.Child, func(node sql.Node) bool {
			if _, ok := node.(*plan.JoinNode); ok {
				deleteFromJoin = true
				return false
			}
			return true
		})
		if deleteFromJoin {
			if df.HasExplicitTargets() == false {
				validationError = fmt.Errorf("delete from statement with join requires specifying explicit delete target tables")
				return true
			}
		}
		return false
	})

	if validationError != nil {
		return nil, transform.SameTree, validationError
	} else {
		return n, transform.SameTree, nil
	}
}

// validateGroupBy makes sure that all selected expressions are functionally dependent on group by expressions when
// ONLY_FULL_GROUP_BY mode is on https://dev.mysql.com/doc/refman/8.4/en/group-by-functional-dependence.html
func validateGroupBy(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !FlagIsSet(qFlags, sql.QFlagAggregation) {
		return n, transform.SameTree, nil
	}

	span, ctx := ctx.Span("validate_group_by")
	defer span.End()

	// only enforce strict group by when this variable is set
	if !sql.LoadSqlMode(ctx).OnlyFullGroupBy() {
		return n, transform.SameTree, nil
	}

	var err error
	var parent sql.Node
	var project *plan.Project
	var orderBy *plan.Sort
	transform.Inspect(n, func(n sql.Node) bool {
		defer func() {
			parent = n
		}()
		switch n := n.(type) {
		case *plan.GroupBy:
			var noGroupBy bool
			// Allow the parser use the GroupBy node to eval the aggregation functions for sql statements that don't
			// make use of the GROUP BY expression.
			if len(n.GroupByExprs) == 0 {
				noGroupBy = true
			}

			primaryKeys := make(map[string]bool)
			for _, col := range n.Child.Schema() {
				if col.PrimaryKey {
					primaryKeys[strings.ToLower(col.String())] = true
				}
			}

			groupBys := make(map[string]bool)
			groupByPrimaryKeys := 0
			isJoin := false
			exprs := make([]sql.Expression, 0)
			exprs = append(exprs, n.GroupByExprs...)
			possibleJoin := n.Child
			if filter, ok := n.Child.(*plan.Filter); ok {
				possibleJoin = filter.Child
				exprs = append(exprs, getEqualsDependencies(filter.Expression)...)
			}
			if join, ok := possibleJoin.(*plan.JoinNode); ok {
				isJoin = true
				exprs = append(exprs, getEqualsDependencies(join.Filter)...)
			}
			for _, expr := range exprs {
				sql.Inspect(expr, func(expr sql.Expression) bool {
					exprStr := strings.ToLower(expr.String())
					if primaryKeys[exprStr] && !groupBys[exprStr] {
						groupByPrimaryKeys++
					}
					groupBys[exprStr] = true

					if nameable, ok := expr.(sql.Nameable); ok {
						groupBys[strings.ToLower(nameable.Name())] = true
					}
					_, isAlias := expr.(*expression.Alias)
					return isAlias
				})
			}

			// TODO: also allow grouping by unique non-nullable columns https://github.com/dolthub/dolt/issues/9700
			// TODO: There's currently no way to tell whether or not a primary key column is part of a multi-column
			//  primary key. When there is a join, we only check if one primary key column is referenced, meaning we
			//  sometimes incorrectly validate group bys when a joined table has a multi-column primary key.
			if len(primaryKeys) != 0 && (groupByPrimaryKeys == len(primaryKeys) || (isJoin && groupByPrimaryKeys > 0)) {
				return true
			}

			selectExprs, orderByExprs := getSelectAndOrderByExprs(project, orderBy, n.SelectDeps, groupBys)

			for i, expr := range selectExprs {
				if valid, col := expressionReferencesOnlyGroupBys(groupBys, expr, noGroupBy); !valid {
					if noGroupBy {
						err = sql.ErrNonAggregatedColumnWithoutGroupBy.New(i+1, col)
					} else {
						err = analyzererrors.ErrValidationGroupBy.New(i+1, col)
					}
					return false
				}
			}
			// According to MySQL documentation, we should still be validating ORDER BY expressions when there's not an
			// explicit GROUP BY in the query ("If a query has aggregate functions and no GROUP BY clause, it cannot
			// have nonaggregated columns in the select list, HAVING  condition, or ORDER BY list with
			// ONLY_FULL_GROUP_BY enabled"). But when testing queries in MySQL, it doesn't seem like they actually
			// validate ORDER BY expressions in aggregate queries without an explicit GROUP BY
			if !noGroupBy {
				for i, expr := range orderByExprs {
					if valid, col := expressionReferencesOnlyGroupBys(groupBys, expr, noGroupBy); !valid {
						err = analyzererrors.ErrValidationGroupByOrderBy.New(i+1, col)
						return false
					}
				}
			}
		case *plan.Project:
			// Project nodes that are direct children of Having nodes include aliases for columns that are part of an
			// aggregate function that aren't necessarily selected expressions and therefore shouldn't be validated
			if _, isHaving := parent.(*plan.Having); !isHaving {
				project = n
				orderBy = nil
			}
		case *plan.Sort:
			orderBy = n
		}
		return true
	})

	return n, transform.SameTree, err
}

// getEqualsDependencies looks for Equals expressions and gets any non-literal arguments
func getEqualsDependencies(expr sql.Expression) []sql.Expression {
	exprs := make([]sql.Expression, 0)
	sql.Inspect(expr, func(expr sql.Expression) bool {
		switch expr := expr.(type) {
		case *expression.And:
			return true
		case *expression.Equals:
			for _, e := range expr.Children() {
				if and, ok := e.(*expression.And); ok {
					exprs = append(exprs, getEqualsDependencies(and)...)
				} else if _, ok := e.(*expression.Literal); !ok {
					exprs = append(exprs, e)
				}
			}
		}
		return false
	})
	return exprs
}

// getSelectExprs transforms the projection expressions from a Project node such that it uses the appropriate select
// dependency expressions.
func getSelectAndOrderByExprs(project *plan.Project, orderBy *plan.Sort, selectDeps []sql.Expression, groupBys map[string]bool) ([]sql.Expression, []sql.Expression) {
	if project == nil && orderBy == nil {
		return selectDeps, nil
	} else {
		sd := make(map[string]sql.Expression, len(selectDeps))
		for _, dep := range selectDeps {
			sd[strings.ToLower(dep.String())] = dep
		}

		selectExprs := make([]sql.Expression, 0)
		orderByExprs := make([]sql.Expression, 0)

		for _, expr := range project.Projections {
			if !project.AliasDeps[strings.ToLower(expr.String())] {
				resolvedExpr := resolveExpr(expr, sd, groupBys)
				selectExprs = append(selectExprs, resolvedExpr)
			}
		}

		if orderBy != nil {
			for _, expr := range orderBy.Expressions() {
				resolvedExpr := resolveExpr(expr, sd, groupBys)
				orderByExprs = append(orderByExprs, resolvedExpr)
			}
		}

		return selectExprs, orderByExprs
	}
}

func resolveExpr(expr sql.Expression, selectDeps map[string]sql.Expression, groupBys map[string]bool) sql.Expression {
	resolvedExpr, _, _ := transform.Expr(expr, func(expr sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		if groupBys[strings.ToLower(expr.String())] {
			return expr, transform.SameTree, nil
		}
		switch expr := expr.(type) {
		case *expression.Alias:
			if dep, ok := selectDeps[strings.ToLower(expr.Child.String())]; ok {
				selectDeps[strings.ToLower(expr.Name())] = dep
				return dep, transform.NewTree, nil
			}
		case *expression.GetField:
			if dep, ok := selectDeps[strings.ToLower(expr.String())]; ok {
				return dep, transform.NewTree, nil
			}
		}
		return expr, transform.SameTree, nil
	})
	return resolvedExpr
}

// expressionReferencesOnlyGroupBys validates that an expression is dependent on only group by expressions
func expressionReferencesOnlyGroupBys(groupBys map[string]bool, expr sql.Expression, noGroupBy bool) (bool, string) {
	var col string
	valid := true
	sql.Inspect(expr, func(expr sql.Expression) bool {
		switch expr := expr.(type) {
		case nil, sql.Aggregation, *expression.Literal:
			return false
		default:
			if groupBys[strings.ToLower(expr.String())] {
				return false
			}

			if nameable, ok := expr.(sql.Nameable); ok {
				if groupBys[strings.ToLower(nameable.Name())] {
					return false
				}
			}

			if len(expr.Children()) == 0 {
				// Allow non-matching subqueries when no explicit group by clause. If the subquery returns more than
				// one row for an aggregated query, we will error out later on.
				if _, isSubquery := expr.(*plan.Subquery); !(isSubquery && noGroupBy) {
					valid = false
					col = expr.String()
				}
				return false
			}

			return true
		}
	})

	return valid, col
}

func validateSchemaSource(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("validate_schema_source")
	defer span.End()

	switch n := n.(type) {
	case *plan.TableAlias:
		// table aliases should not be validated
		if child, ok := n.Child.(*plan.ResolvedTable); ok {
			return n, transform.SameTree, validateSchema(child)
		}
	case *plan.ResolvedTable:
		return n, transform.SameTree, validateSchema(n)
	}
	return n, transform.SameTree, nil
}

func validateIndexCreation(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("validate_index_creation")
	defer span.End()

	ci, ok := n.(*plan.CreateIndex)
	if !ok {
		return n, transform.SameTree, nil
	}

	schema := ci.Table.Schema()
	table := schema[0].Source

	var unknownColumns []string
	for _, expr := range ci.Exprs {
		sql.Inspect(expr, func(e sql.Expression) bool {
			gf, ok := e.(*expression.GetField)
			if ok {
				if gf.Table() != table || !schema.Contains(gf.Name(), gf.Table()) {
					unknownColumns = append(unknownColumns, gf.Name())
				}
			}
			return true
		})
	}

	if len(unknownColumns) > 0 {
		return nil, transform.SameTree, analyzererrors.ErrUnknownIndexColumns.New(table, strings.Join(unknownColumns, ", "))
	}

	return n, transform.SameTree, nil
}

func validateSchema(t *plan.ResolvedTable) error {
	for _, col := range t.Schema() {
		if col.Source == "" {
			return analyzererrors.ErrValidationSchemaSource.New()
		}
	}
	return nil
}

func validateUnionSchemasMatch(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("validate_union_schemas_match")
	defer span.End()

	var firstmismatch []string
	transform.Inspect(n, func(n sql.Node) bool {
		if u, ok := n.(*plan.SetOp); ok {
			ls := u.Left().Schema()
			rs := u.Right().Schema()
			if len(ls) != len(rs) {
				firstmismatch = []string{
					fmt.Sprintf("%d columns", len(ls)),
					fmt.Sprintf("%d columns", len(rs)),
				}
				return false
			}
			for i := range ls {
				if !reflect.DeepEqual(ls[i].Type, rs[i].Type) {
					firstmismatch = []string{
						ls[i].Type.String(),
						rs[i].Type.String(),
					}
					return false
				}
			}
		}
		return true
	})
	if firstmismatch != nil {
		return nil, transform.SameTree, analyzererrors.ErrUnionSchemasMatch.New(firstmismatch[0], firstmismatch[1])
	}
	return n, transform.SameTree, nil
}

func validateIntervalUsage(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !FlagIsSet(qFlags, sql.QFlagInterval) {
		return n, transform.SameTree, nil
	}
	var invalid bool
	transform.InspectExpressionsWithNode(n, func(node sql.Node, e sql.Expression) bool {
		// If it's already invalid just skip everything else.
		if invalid {
			return false
		}

		// Interval can be used without DATE_ADD/DATE_SUB functions in CREATE/ALTER EVENTS statements.
		switch node.(type) {
		case *plan.CreateEvent, *plan.AlterEvent:
			return false
		}

		switch e := e.(type) {
		case *function.DateAdd, *function.DateSub:
			return false
		case *expression.Arithmetic:
			if e.Op == "+" || e.Op == "-" {
				return false
			}
		case *expression.Interval:
			invalid = true
		}

		return true
	})

	if invalid {
		return nil, transform.SameTree, analyzererrors.ErrIntervalInvalidUse.New()
	}

	return n, transform.SameTree, nil
}

func validateStarExpressions(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	// Validate that all occurences of the '*' placeholder expression are in a context that makes sense.
	//
	// That is, all uses of '*' should be either:
	// - The top level of an expression.
	// - The input to a COUNT or JSONARRAY function.
	//
	// We do not use plan.InspectExpressions here because we're treating
	// the top-level expressions of sql.Node differently from subexpressions.
	if !FlagIsSet(qFlags, sql.QFlagStar) {
		return n, transform.SameTree, nil
	}

	var err error
	transform.Inspect(n, func(n sql.Node) bool {
		if er, ok := n.(sql.Expressioner); ok {
			for _, e := range er.Expressions() {
				// An expression consisting of just a * is allowed.
				if _, s := e.(*expression.Star); s {
					return false
				}
				// Otherwise, * can only be used inside acceptable aggregation functions.
				// Detect any uses of * outside such functions.
				sql.Inspect(e, func(e sql.Expression) bool {
					if err != nil {
						return false
					}
					switch e.(type) {
					case *expression.Star:
						err = sql.ErrStarUnsupported.New()
						return false
					case *aggregation.Count, *aggregation.CountDistinct, *aggregation.JsonArray:
						if _, s := e.Children()[0].(*expression.Star); s {
							return false
						}
					}
					return true
				})
			}
		}
		return err == nil
	})
	if err != nil {
		return nil, transform.SameTree, err
	}
	return n, transform.SameTree, nil
}

func validateOperands(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	// Validate that the number of columns in an operand or a top level
	// expression are as expected. The current rules are:
	// * Every top level expression of a node must have 1 column.
	// * The following expression nodes are allowed to have `n` columns as
	// long as `n` matches:
	//   * *plan.InSubquery, *expression.{Equals,NullSafeEquals,GreaterThan,LessThan,GreaterThanOrEqual,LessThanOrEqual}
	// * *expression.InTuple must have a tuple on the right side, the # of
	// columns for each element of the tuple must match the number of
	// columns of the expression on the left.
	// * Every other expression with operands must have NumColumns == 1.

	// We do not use plan.InspectExpressions here because we're treating
	// top-level expressions of sql.Node differently from subexpressions.
	var err error
	transform.Inspect(n, func(n sql.Node) bool {
		if n == nil {
			return false
		}

		if plan.IsDDLNode(n) {
			return false
		}

		if er, ok := n.(sql.Expressioner); ok {
			for _, e := range er.Expressions() {
				nc := types.NumColumns(e.Type())
				if nc != 1 {
					if _, ok := er.(*plan.HashLookup); ok {
						// hash lookup expressions are tuples with >= 1 columns
						return true
					}
					err = sql.ErrInvalidOperandColumns.New(1, nc)
					return false
				}
				sql.Inspect(e, func(e sql.Expression) bool {
					if e == nil {
						return err == nil
					}
					if err != nil {
						return false
					}
					switch e.(type) {
					case *plan.InSubquery, *expression.Equals, *expression.NullSafeEquals, *expression.GreaterThan,
						*expression.LessThan, *expression.GreaterThanOrEqual, *expression.LessThanOrEqual:
						err = types.ErrIfMismatchedColumns(e.Children()[0].Type(), e.Children()[1].Type())
					case *expression.InTuple, *expression.HashInTuple:
						t, ok := e.Children()[1].(expression.Tuple)
						if ok && len(t.Children()) == 1 {
							// A single element Tuple treats itself like the element it contains.
							err = types.ErrIfMismatchedColumns(e.Children()[0].Type(), e.Children()[1].Type())
						} else {
							err = types.ErrIfMismatchedColumnsInTuple(e.Children()[0].Type(), e.Children()[1].Type())
						}
					case *aggregation.Count, *aggregation.CountDistinct, *aggregation.JsonArray:
						if _, s := e.Children()[0].(*expression.Star); s {
							return false
						}
						for _, e := range e.Children() {
							nc := types.NumColumns(e.Type())
							if nc != 1 {
								err = sql.ErrInvalidOperandColumns.New(1, nc)
							}
						}
					case expression.Tuple:
						// Tuple expressions can contain tuples...
					case *plan.ExistsSubquery:
						// Any number of columns are allowed.
					default:
						for _, e := range e.Children() {
							nc := types.NumColumns(e.Type())
							if nc != 1 {
								err = sql.ErrInvalidOperandColumns.New(1, nc)
							}
						}
					}
					return err == nil
				})
			}
		}
		return err == nil
	})
	if err != nil {
		return nil, transform.SameTree, err
	}
	return n, transform.SameTree, nil
}

func validateSubqueryColumns(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	// Then validate that every subquery has field indexes within the correct range
	// TODO: Why is this only for subqueries?

	// TODO: Currently disabled.
	if true {
		return n, transform.SameTree, nil
	}

	var outOfRangeIndexExpression sql.Expression
	var outOfRangeColumns int
	transform.InspectExpressionsWithNode(n, func(n sql.Node, e sql.Expression) bool {
		s, ok := e.(*plan.Subquery)
		if !ok {
			return true
		}

		outerScopeRowLen := len(scope.Schema()) + len(Schemas(n.Children()))
		transform.Inspect(s.Query, func(n sql.Node) bool {
			if n == nil {
				return true
			}
			// TODO: the schema of the rows seen by children of
			// these nodes are not reflected in the schema
			// calculations here. This needs to be rationalized
			// across the analyzer.
			switch n := n.(type) {
			case *plan.JoinNode:
				return !n.Op.IsLookup()
			default:
			}
			if es, ok := n.(sql.Expressioner); ok {
				childSchemaLen := len(Schemas(n.Children()))
				for _, e := range es.Expressions() {
					sql.Inspect(e, func(e sql.Expression) bool {
						if gf, ok := e.(*expression.GetField); ok {
							if gf.Index() >= outerScopeRowLen+childSchemaLen {
								outOfRangeIndexExpression = gf
								outOfRangeColumns = outerScopeRowLen + childSchemaLen
							}
						}
						return outOfRangeIndexExpression == nil
					})
				}
			}
			return outOfRangeIndexExpression == nil
		})
		return outOfRangeIndexExpression == nil
	})
	if outOfRangeIndexExpression != nil {
		return nil, transform.SameTree, analyzererrors.ErrSubqueryFieldIndex.New(outOfRangeIndexExpression, outOfRangeColumns)
	}

	return n, transform.SameTree, nil
}

func stringContains(strs []string, target string) bool {
	lowerTarget := strings.ToLower(target)
	for _, s := range strs {
		if lowerTarget == strings.ToLower(s) {
			return true
		}
	}
	return false
}

// validateReadOnlyDatabase invalidates queries that attempt to write to ReadOnlyDatabases.
func validateReadOnlyDatabase(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	valid := true
	var readOnlyDB sql.ReadOnlyDatabase
	enforceReadOnly := scope.EnforcesReadOnly()

	// if a ReadOnlyDatabase is found, invalidate the query
	readOnlyDBSearch := func(node sql.Node) bool {
		if rt, ok := node.(*plan.ResolvedTable); ok {
			if ro, ok := rt.SqlDatabase.(sql.ReadOnlyDatabase); ok {
				if ro.IsReadOnly() {
					readOnlyDB = ro
					valid = false
				} else if enforceReadOnly {
					valid = false
				}
			}
		}
		return valid
	}

	transform.Inspect(n, func(node sql.Node) bool {
		switch n := n.(type) {
		case *plan.DeleteFrom, *plan.Update, *plan.LockTables, *plan.UnlockTables:
			transform.Inspect(node, readOnlyDBSearch)
			return false

		case *plan.InsertInto:
			// ReadOnlyDatabase can be an insertion Source,
			// only inspect the Destination tree
			transform.Inspect(n.Destination, readOnlyDBSearch)
			return false

		case *plan.CreateTable:
			if ro, ok := n.Database().(sql.ReadOnlyDatabase); ok {
				if ro.IsReadOnly() {
					readOnlyDB = ro
					valid = false
				} else if enforceReadOnly {
					valid = false
				}
			}
			// "CREATE TABLE ... LIKE ..." and
			// "CREATE TABLE ... AS ..."
			// can both use ReadOnlyDatabases as a source,
			// so don't descend here.
			return false

		default:
			// CreateTable is the only DDL node allowed
			// to contain a ReadOnlyDatabase
			if plan.IsDDLNode(n) {
				transform.Inspect(n, readOnlyDBSearch)
				return false
			}
		}

		return valid
	})
	if !valid {
		if enforceReadOnly {
			return nil, transform.SameTree, sql.ErrProcedureCallAsOfReadOnly.New()
		} else {
			return nil, transform.SameTree, analyzererrors.ErrReadOnlyDatabase.New(readOnlyDB.Name())
		}
	}

	return n, transform.SameTree, nil
}

// validateReadOnlyTransaction invalidates read only transactions that try to perform improper write operations.
func validateReadOnlyTransaction(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	t := ctx.GetTransaction()

	if t == nil {
		return n, transform.SameTree, nil
	}

	// If this is a normal read write transaction don't enforce read-only. Otherwise we must prevent an invalid query.
	if !t.IsReadOnly() && !scope.EnforcesReadOnly() {
		return n, transform.SameTree, nil
	}

	valid := true

	isTempTable := func(table sql.Table) bool {
		tt, isTempTable := table.(sql.TemporaryTable)
		if !isTempTable {
			valid = false
		}

		return tt.IsTemporary()
	}

	temporaryTableSearch := func(node sql.Node) bool {
		if rt, ok := node.(*plan.ResolvedTable); ok {
			valid = isTempTable(rt.Table)
		}
		return valid
	}

	transform.Inspect(n, func(node sql.Node) bool {
		switch n := n.(type) {
		case *plan.DeleteFrom, *plan.Update, *plan.UnlockTables:
			transform.Inspect(node, temporaryTableSearch)
			return false
		case *plan.InsertInto:
			transform.Inspect(n.Destination, temporaryTableSearch)
			return false
		case *plan.LockTables:
			// TODO: Technically we should allow for the locking of temporary tables but the LockTables implementation
			// needs substantial refactoring.
			valid = false
			return false
		case *plan.CreateTable:
			// MySQL explicitly blocks the creation of temporary tables in a read only transaction.
			if n.Temporary() {
				valid = false
			}

			return false
		default:
			// DDL statements have an implicit commits which makes them valid to be executed in READ ONLY transactions.
			if plan.IsDDLNode(n) {
				valid = true
				return false
			}

			return valid
		}
	})

	if !valid {
		return nil, transform.SameTree, sql.ErrReadOnlyTransaction.New()
	}

	return n, transform.SameTree, nil
}

// validateAggregations returns an error if an Aggregation expression has been used in
// an invalid way, such as appearing outside of a GroupBy or Window node, or if an aggregate
// function is used with the implicit all-rows grouping and contains projected expressions with
// window aggregation functions that reference non-aggregated columns. Only GroupBy and Window
// nodes know how to evaluate Aggregation expressions.
//
// See https://github.com/dolthub/go-mysql-server/issues/542 for some queries
// that should be supported but that currently trigger this validation because
// aggregation expressions end up in the wrong place.
func validateAggregations(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !FlagIsSet(qFlags, sql.QFlagAggregation) {
		return n, transform.SameTree, nil
	}
	var validationErr error
	transform.Inspect(n, func(n sql.Node) bool {
		switch n := n.(type) {
		case *plan.GroupBy:
			validationErr = checkForAggregationFunctions(n.GroupByExprs)
		case *plan.Window:
			validationErr = checkForNonAggregatedColumnReferences(n)
		case sql.Expressioner:
			validationErr = checkForAggregationFunctions(n.Expressions())
		default:
		}
		return validationErr == nil
	})

	return n, transform.SameTree, validationErr
}

// checkForAggregationFunctions returns an ErrAggregationUnsupported error if any aggregation
// functions are found in the specified expressions.
func checkForAggregationFunctions(exprs []sql.Expression) error {
	var validationErr error
	for _, e := range exprs {
		sql.Inspect(e, func(ie sql.Expression) bool {
			if _, ok := ie.(sql.Aggregation); ok {
				validationErr = sql.ErrAggregationUnsupported.New(e.String())
			}
			return validationErr == nil
		})
	}
	return validationErr
}

// checkForNonAggregatedColumnReferences returns an ErrNonAggregatedColumnWithoutGroupBy error
// if an aggregate function with the implicit/all-rows grouping is mixed with aggregate window
// functions that reference a non-aggregated column.
// You cannot mix aggregations on the implicit/all-rows grouping with window aggregations.
func checkForNonAggregatedColumnReferences(w *plan.Window) error {
	for _, expr := range w.ProjectedExprs() {
		if agg, ok := expr.(sql.Aggregation); ok {
			if agg.Window() == nil {
				index, gf := findFirstWindowAggregationColumnReference(w)

				if index >= 0 {
					return sql.ErrNonAggregatedColumnWithoutGroupBy.New(index, gf.String())
				} else {
					// We should always have an index and GetField value to use, but just in case
					// something changes that, return a similar error message without those details.
					return fmt.Errorf("in aggregated query without GROUP BY, expression in " +
						"SELECT list contains nonaggregated column; " +
						"this is incompatible with sql_mode=only_full_group_by")
				}
			}
		}
	}
	return nil
}

// findFirstWindowAggregationColumnReference returns the index and GetField expression for the
// first column reference in the first window aggregation function in the specified node's
// projection expressions. If no window aggregation function with a column reference is found,
// (-1, nil) is returned. This information is needed to populate an
// ErrNonAggregatedColumnWithoutGroupBy error.
func findFirstWindowAggregationColumnReference(w *plan.Window) (index int, gf *expression.GetField) {
	for index, expr := range w.ProjectedExprs() {
		var firstColumnRef *expression.GetField

		transform.InspectExpr(expr, func(e sql.Expression) bool {
			if windowAgg, ok := e.(sql.WindowAggregation); ok {
				transform.InspectExpr(windowAgg, func(e sql.Expression) bool {
					if gf, ok := e.(*expression.GetField); ok {
						firstColumnRef = gf
						return true
					}
					return false
				})
				return firstColumnRef != nil
			}
			return false
		})

		if firstColumnRef != nil {
			return index, firstColumnRef
		}
	}

	return -1, nil
}

func validateExprSem(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	var err error
	transform.InspectExpressions(n, func(e sql.Expression) bool {
		err = validateSem(e)
		return err == nil
	})
	return n, transform.SameTree, err
}

// validateSem is a way to add validation logic for
// specific expression types.
// todo(max): Refactor and consolidate validation so it can
// run before the rest of analysis. Add more expression types.
// Add node equivalent.
func validateSem(e sql.Expression) error {
	switch e := e.(type) {
	case *expression.And:
		if err := logicalSem(e.BinaryExpressionStub); err != nil {
			return err
		}
	case *expression.Or:
		if err := logicalSem(e.BinaryExpressionStub); err != nil {
			return err
		}
	default:
	}
	return nil
}

func logicalSem(e expression.BinaryExpressionStub) error {
	if lc := fds(e.LeftChild); lc != 1 {
		return sql.ErrInvalidOperandColumns.New(1, lc)
	}
	if rc := fds(e.RightChild); rc != 1 {
		return sql.ErrInvalidOperandColumns.New(1, rc)
	}
	return nil
}

// fds counts the functional dependencies of an expression.
// todo(max): input/output fd's should be part of the expression
// interface.
func fds(e sql.Expression) int {
	switch e.(type) {
	case *expression.UnresolvedColumn:
		return 1
	case *expression.UnresolvedFunction:
		return 1
	default:
		return types.NumColumns(e.Type())
	}
}
