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
	"strings"

	"github.com/dolthub/go-mysql-server/memory"
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// eraseProjection removes redundant Project nodes from the plan. A project
// is redundant if it doesn't alter the schema of its child. Special
// considerations: (1) target projections casing needs
// to be preserved in the output schema even if the projection is redundant;
// (2) column ids are not reliable enough to maximally prune projections,
// we still need to check column/table/database names.
// todo: analyzer should separate target schema from plan schema
// todo: projection columns should all have ids so that pruning is more reliable
func eraseProjection(ctx *sql.Context, a *Analyzer, node sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("erase_projection")
	defer span.End()

	if !node.Resolved() {
		return node, transform.SameTree, nil
	}

	return transform.Node(node, func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
		project, ok := node.(*plan.Project)
		if ok {
			projSch := project.Schema()
			childSch := project.Child.Schema()
			if projSch.CaseSensitiveEquals(childSch) && !childSch.CaseSensitiveEquals(memory.DualTableSchema.Schema) {
				a.Log("project erased")
				return project.Child, transform.NewTree, nil
			}

		}

		return node, transform.SameTree, nil
	})
}

func flattenDistinct(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		if d, ok := n.(*plan.Distinct); ok {
			if d2, ok := d.Child.(*plan.Distinct); ok {
				return d2, transform.NewTree, nil
			}
			if d2, ok := d.Child.(*plan.OrderedDistinct); ok {
				return d2, transform.NewTree, nil
			}
		}
		if d, ok := n.(*plan.OrderedDistinct); ok {
			if d2, ok := d.Child.(*plan.Distinct); ok {
				return plan.NewOrderedDistinct(d2.Child), transform.NewTree, nil
			}
			if d2, ok := d.Child.(*plan.OrderedDistinct); ok {
				return d2, transform.NewTree, nil
			}
		}
		return n, transform.SameTree, nil
	})
}

// moveJoinConditionsToFilter looks for expressions in a join condition that reference only tables in the left or right
// side of the join, and move those conditions to a new Filter node instead. If the join condition is empty after these
// moves, the join is converted to a CrossJoin.
func moveJoinConditionsToFilter(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !n.Resolved() {
		return n, transform.SameTree, nil
	}

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		var rightOnlyFilters []sql.Expression
		var leftOnlyFilters []sql.Expression

		join, ok := n.(*plan.JoinNode)
		if !ok {
			// no join
			return n, transform.SameTree, nil
		}

		// no filter or left join: nothing to do to the tree
		if join.JoinType().IsDegenerate() {
			return n, transform.SameTree, nil
		}
		if !(join.JoinType().IsInner() || join.JoinType().IsSemi()) {
			return n, transform.SameTree, nil
		}
		leftSources := nodeSources(join.Left())
		rightSources := nodeSources(join.Right())
		filtersMoved := 0
		var condFilters []sql.Expression
		for _, e := range expression.SplitConjunction(join.JoinCond()) {
			sources, nullRej := expressionSources(e)
			if !nullRej {
				condFilters = append(condFilters, e)
				continue
			}

			if sources.SubsetOf(leftSources) {
				leftOnlyFilters = append(leftOnlyFilters, e)
				filtersMoved++
			} else if sources.SubsetOf(rightSources) {
				rightOnlyFilters = append(rightOnlyFilters, e)
				filtersMoved++
			} else {
				condFilters = append(condFilters, e)
			}
		}

		if filtersMoved == 0 {
			return n, transform.SameTree, nil
		}

		newLeft := join.Left()
		if len(leftOnlyFilters) > 0 {
			newLeft = plan.NewFilter(expression.JoinAnd(leftOnlyFilters...), newLeft)
		}

		newRight := join.Right()
		if len(rightOnlyFilters) > 0 {
			newRight = plan.NewFilter(expression.JoinAnd(rightOnlyFilters...), newRight)
		}

		// TODO: This might not be necessary. JoinAnd returns nil for arrays of length 0 and nil join conditions are
		//  evaluated as true anyways
		if len(condFilters) == 0 {
			condFilters = append(condFilters, expression.NewTrue())
		}

		return plan.NewJoin(newLeft, newRight, join.Op, expression.JoinAnd(condFilters...)).WithComment(join.CommentStr), transform.NewTree, nil
	})
}

// nodeSources returns the set of column sources from the schema of the node given.
func nodeSources(n sql.Node) sql.FastIntSet {
	var tables sql.FastIntSet
	transform.InspectUp(n, func(n sql.Node) bool {
		tin, _ := n.(plan.TableIdNode)
		if tin != nil {
			tables.Add(int(tin.Id()))
		}
		return false
	})
	return tables
}

// expressionSources returns the set of sources from any GetField expressions
// in the expression given, and a boolean indicating whether the expression
// is null rejecting from those sources.
func expressionSources(expr sql.Expression) (sql.FastIntSet, bool) {
	var tables sql.FastIntSet
	var nullRejecting bool = true

	sql.Inspect(expr, func(e sql.Expression) bool {
		switch e := e.(type) {
		case *expression.GetField:
			tables.Add(int(e.TableId()))
		case sql.IsNullExpression, sql.IsNotNullExpression:
			nullRejecting = false
		case *expression.NullSafeEquals:
			nullRejecting = false
		case *expression.Equals:
			if lit, ok := e.Left().(*expression.Literal); ok && lit.Value() == nil {
				nullRejecting = false
			}
			if lit, ok := e.Right().(*expression.Literal); ok && lit.Value() == nil {
				nullRejecting = false
			}
		case *plan.Subquery:
			transform.InspectExpressions(e.Query, func(innerExpr sql.Expression) bool {
				switch e := innerExpr.(type) {
				case *expression.GetField:
					tables.Add(int(e.TableId()))
				case sql.IsNullExpression, sql.IsNotNullExpression:
					nullRejecting = false
				case *expression.NullSafeEquals:
					nullRejecting = false
				case *expression.Equals:
					if lit, ok := e.Left().(*expression.Literal); ok && lit.Value() == nil {
						nullRejecting = false
					}
					if lit, ok := e.Right().(*expression.Literal); ok && lit.Value() == nil {
						nullRejecting = false
					}
				}
				return true
			})
		}
		return true
	})

	return tables, nullRejecting
}

// simplifyFilters simplifies filter expressions in nodes where possible. Nodes with filter expressions that can be
// statically evaluated to true or false are transformed so that the expression no longer needs to be evaluated.
func simplifyFilters(ctx *sql.Context, a *Analyzer, node sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !node.Resolved() {
		return node, transform.SameTree, nil
	}

	return transform.NodeWithOpaque(node, func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch n := node.(type) {
		case *plan.JoinNode:
			if n.Filter != nil {
				e, same, err := simplifyExpression(ctx, a, scope, sel, qFlags, n.Filter)
				if err != nil {
					return nil, transform.SameTree, err
				}

				isTrue, isFalse := getDefiniteBoolValues(ctx, e)
				joinType := n.JoinType()
				if isTrue {
					// If the filter always evaluates to true, convert to cross join if possible
					switch joinType {
					case plan.JoinTypeInner:
						return plan.NewCrossJoin(n.Left(), n.Right()), transform.NewTree, nil
					case plan.JoinTypeLateralInner:
						return plan.NewLateralCrossJoin(n.Left(), n.Right()), transform.NewTree, nil
					default:
						// Remove filter. Filter does not need to be evaluated if always true
						return n.WithFilter(nil), transform.NewTree, nil
					}
				} else if isFalse {
					switch joinType {
					case plan.JoinTypeFullOuter:
						// Do nothing here. For a full outer join, we still want to return every row of both.
					case plan.JoinTypeLeftOuter, plan.JoinTypeLateralLeft:
						// In a left join, we still want all rows on the left side. But because the filter is always
						// false, it will never match rows on the right side so we can treat it like it's empty
						return plan.NewJoin(n.Left(), plan.NewEmptyTableWithSchema(n.Right().Schema()), joinType, nil), transform.NewTree, nil
					default:
						// For non-outer joins, a join condition that always evaluates to false would return an empty set
						return plan.NewEmptyTableWithSchema(n.Schema()), transform.NewTree, nil
					}
				}

				if !same {
					return n.WithFilter(e), transform.NewTree, nil
				}

			}
		case *plan.Filter:
			e, same, err := simplifyExpression(ctx, a, scope, sel, qFlags, n.Expression)
			if err != nil {
				return nil, transform.SameTree, err
			}

			isTrue, isFalse := getDefiniteBoolValues(ctx, e)
			// if the filter always evaluates to true, it can be removed
			if isTrue {
				return n.Child, transform.NewTree, nil
			}
			// if the filter always evaluates to false, the result is an empty table
			if isFalse {
				return plan.NewEmptyTableWithSchema(n.Schema()), transform.NewTree, nil
			}

			if !same {
				return plan.NewFilter(e, n.Child), transform.NewTree, nil
			}
		}
		return node, transform.SameTree, nil
	})
}

// simplifyExpressions replaces expressions that can be evaluated statically with their Literal value and removes
// redundant parts of AND and OR expressions.
func simplifyExpression(ctx *sql.Context, a *Analyzer, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags, e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
	return transform.Expr(e, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		switch e := e.(type) {
		// TODO: if the left and right children of Equals are the same expression, simplify to NullIf(IsNotNull(left), false)
		case *plan.Subquery:
			newQ, same, err := simplifyFilters(ctx, a, e.Query, scope, sel, qFlags)
			if same || err != nil {
				return e, transform.SameTree, err
			}
			return e.WithQuery(newQ), transform.NewTree, nil
		case *expression.Between:
			// TODO: Simplify for Literal arguments
			//  If any argument is null (Literal.IsNullable returns true), simplify to null
			//  If all arguments are Literals, Between can be evaluated to true/false
			//  If e.Val and e.Lower are both Literals:
			//    If e.Val < e.Lower, simplify to false.
			//    If e.Val == e.Lower, simplify to true.
			//    If e.Val > e.Lower, simplify to e.Val <= e.Upper
			//  If e.Val and e.Upper are both Literals:
			//    If e.Val < e.Upper, simplify to e.Val >= e.Lower.
			//    If e.Val == e.Upper, simplify to true
			//    If e.Val > e.Upper, simplify to false
			//  If e.Lower and e.Upper are both Literals:
			//    If e.Lower > e.Upper, simplify to false. If e.Lower == e.Upper, simplify to Equals(e.Val, e.Lower).

			// TODO: These simplifications for GetField arguments can likely be applied to all expressions. Maybe we can
			//  check for expression equality using their String values. If all arguments refer to the same expression,
			//  Between can be simplified to NullIf(IsNotNull(left), false)
			lowerField, lowerIsField := e.Lower.(*expression.GetField)
			upperField, upperIsField := e.Upper.(*expression.GetField)
			if lowerIsField && upperIsField && lowerField.IsSameField(upperField) {
				// If e.Lower and e.Upper refer to the same field, Between can be simplified to Equals
				return expression.NewEquals(e.Val, e.Lower), transform.NewTree, nil
			}

			if valField, valIsField := e.Val.(*expression.GetField); valIsField {
				if lowerIsField && lowerField.IsSameField(valField) {
					return expression.NewLessThanOrEqual(e.Val, e.Upper), transform.NewTree, nil
				}
				if upperIsField && upperField.IsSameField(valField) {
					return expression.NewGreaterThanOrEqual(e.Val, e.Lower), transform.NewTree, nil
				}
			}

			return expression.NewAnd(
				expression.NewGreaterThanOrEqual(e.Val, e.Lower),
				expression.NewLessThanOrEqual(e.Val, e.Upper),
			), transform.NewTree, nil
		case *expression.Or:
			leftIsTrue, leftIsFalse := getDefiniteBoolValues(ctx, e.LeftChild)
			// if left side is true, the OR expression is true
			if leftIsTrue {
				return expression.NewTrue(), transform.NewTree, nil
			}

			rightIsTrue, rightIsFalse := getDefiniteBoolValues(ctx, e.RightChild)
			// if right side is true, the OR expression is true
			if rightIsTrue {
				return expression.NewTrue(), transform.NewTree, nil
			}

			if leftIsFalse {
				// if both sides are false, the OR expression is false
				if rightIsFalse {
					return expression.NewFalse(), transform.NewTree, nil
				}
				// if left side is false, the value of the OR expression is determined by the right side
				// TODO If RightChild is not a boolean type, it can be returned if converted to a boolean. Nil values
				//  must be preserved
				if types.IsBoolean(e.RightChild.Type()) {
					return e.RightChild, transform.NewTree, nil
				}
			}

			// if right side is false, the value of the OR expression is determined by the left side
			// TODO If LeftChild is not a boolean type, it can be returned if converted to a boolean. Nil values must be
			//  preserved
			if rightIsFalse && types.IsBoolean(e.LeftChild.Type()) {
				return e.LeftChild, transform.NewTree, nil
			}

			return e, transform.SameTree, nil
		case *expression.And:
			leftIsTrue, leftIsFalse := getDefiniteBoolValues(ctx, e.LeftChild)
			// if left side is false, the AND expression is false
			if leftIsFalse {
				return expression.NewFalse(), transform.NewTree, nil
			}

			rightIsTrue, rightIsFalse := getDefiniteBoolValues(ctx, e.RightChild)
			// if right side is false, the AND expression is false
			if rightIsFalse {
				return expression.NewFalse(), transform.NewTree, nil
			}

			if leftIsTrue {
				// if both sides are true, the AND expression is true
				if rightIsTrue {
					return expression.NewTrue(), transform.NewTree, nil
				}
				// if left side is true, the value of the AND expression is determined by the right side
				// TODO If RightChild is not a boolean type, it can be returned if converted to a boolean. Nil values
				//  must be preserved
				if types.IsBoolean(e.RightChild.Type()) {
					return e.RightChild, transform.NewTree, nil
				}
			}

			// if right side is true, the value of the AND expression is determined by the left side
			// TODO If LeftChild is not a boolean type, it can be returned if converted to a boolean. Nil values must be
			//  preserved
			if rightIsTrue && types.IsBoolean(e.LeftChild.Type()) {
				return e.LeftChild, transform.NewTree, nil
			}

			return e, transform.SameTree, nil
		case *expression.Like:
			// if the charset is not utf8mb4, the last character used in optimization rule does not work
			coll, _ := sql.GetCoercibility(ctx, e.LeftChild)
			charset := coll.CharacterSet()
			if charset != sql.CharacterSet_utf8mb4 {
				return e, transform.SameTree, nil
			}
			// TODO: maybe more cases to simplify
			r, ok := e.RightChild.(*expression.Literal)
			if !ok {
				return e, transform.SameTree, nil
			}
			// TODO: handle escapes
			if e.Escape != nil {
				return e, transform.SameTree, nil
			}
			val := r.Value()
			valStr, ok := val.(string)
			if !ok {
				return e, transform.SameTree, nil
			}
			if len(valStr) == 0 {
				return e, transform.SameTree, nil
			}
			// if there are single character wildcards, don't simplify
			if strings.Count(valStr, "_")-strings.Count(valStr, "\\_") > 0 {
				return e, transform.SameTree, nil
			}
			// if there are also no multiple character wildcards, this is just a plain equals
			numWild := strings.Count(valStr, "%") - strings.Count(valStr, "\\%")
			if numWild == 0 {
				return expression.NewEquals(e.LeftChild, e.RightChild), transform.NewTree, nil
			}
			// if there are many multiple character wildcards, don't simplify
			if numWild != 1 {
				return e, transform.SameTree, nil
			}
			// if the last character is an escaped multiple character wildcard, don't simplify
			if len(valStr) >= 2 && valStr[len(valStr)-2:] == "\\%" {
				return e, transform.SameTree, nil
			}
			if valStr[len(valStr)-1] != '%' {
				return e, transform.SameTree, nil
			}
			// TODO: like expression with just a wild card shouldn't even make it here; analyzer rule should just drop filter
			if len(valStr) == 1 {
				return e, transform.SameTree, nil
			}
			valStr = valStr[:len(valStr)-1]
			newRightLower := expression.NewLiteral(valStr, e.RightChild.Type())
			valStr += string(byte(255)) // append largest possible character as upper bound
			newRightUpper := expression.NewLiteral(valStr, e.RightChild.Type())
			newExpr := expression.NewAnd(expression.NewGreaterThanOrEqual(e.LeftChild, newRightLower), expression.NewLessThanOrEqual(e.LeftChild, newRightUpper))
			return newExpr, transform.NewTree, nil
		case *expression.Not:
			if lit, ok := e.Child.(*expression.Literal); ok {
				val, err := sql.ConvertToBool(ctx, lit.Value())
				if err != nil {
					// error while converting, keep as is
					return e, transform.SameTree, nil
				}
				return expression.NewLiteral(!val, types.Boolean), transform.NewTree, nil
			}
			return e, transform.SameTree, nil
		case *expression.Literal, expression.Tuple, *expression.Interval, *expression.CollatedExpression, *expression.MatchAgainst:
			return e, transform.SameTree, nil
		default:
			if !isEvaluable(e) {
				return e, transform.SameTree, nil
			}
			if conv, ok := e.(*expression.Convert); ok {
				if types.IsBinaryType(conv.Type()) {
					return e, transform.SameTree, nil
				}
			}

			// All other expressions types can be evaluated once and turned into literals for the rest of query execution
			val, err := e.Eval(ctx, nil)
			if err != nil {
				return e, transform.SameTree, err
			}
			return expression.NewLiteral(val, e.Type()), transform.NewTree, nil
		}
	})
}

// getDefiniteBoolValues gets the definite boolean values of an expression. isTrue will only be true if the expression
// is a non-nil Literal that evaluates to true, and isFalse will only be true if the expression is a non-nil Literal
// that evaluates to false. Both return values are necessary since nil values are neither true nor false. We also cannot
// yet evaluate the value of non-Literal expressions so they can neither be definitely true nor false.
func getDefiniteBoolValues(ctx *sql.Context, e sql.Expression) (isTrue, isFalse bool) {
	lit, ok := e.(*expression.Literal)
	if !ok || lit == nil || lit.Value() == nil {
		return false, false
	}
	val, err := sql.ConvertToBool(ctx, lit.Value())
	if err != nil {
		return false, false
	}
	return val, !val
}

// pushNotFilters applies De'Morgan's laws to push NOT expressions as low
// in expression trees as possible and inverts NOT leaf expressions.
// ref: https://en.wikipedia.org/wiki/De_Morgan%27s_laws
// note: the output tree identity is sometimes inaccurate when there is
// a NOT expression that we do not simplify
func pushNotFilters(ctx *sql.Context, _ *Analyzer, n sql.Node, _ *plan.Scope, _ RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !FlagIsSet(qFlags, sql.QFlgNotExpr) {
		return n, transform.SameTree, nil
	}
	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		var e sql.Expression
		var err error
		switch n := n.(type) {
		case *plan.Filter:
			e, err = pushNotFiltersHelper(n.Expression)
		case *plan.JoinNode:
			if n.Filter != nil {
				e, err = pushNotFiltersHelper(n.Filter)
			}
		default:
			return n, transform.SameTree, nil
		}
		if err != nil {
			return n, transform.SameTree, nil
		}
		ret, err := n.(sql.Expressioner).WithExpressions(e)
		if err != nil {
			return n, transform.SameTree, nil
		}
		return ret, transform.NewTree, nil
	})
}

// TODO maybe: NOT(INTUPLE(c...)), NOT(EQ(c))=>OR(LT(c), GT(c))
func pushNotFiltersHelper(e sql.Expression) (sql.Expression, error) {
	// NOT(NOT(c))=>c
	if not, _ := e.(*expression.Not); not != nil {
		if f, _ := not.Child.(*expression.Not); f != nil {
			if types.IsBoolean(f.Child.Type()) {
				return pushNotFiltersHelper(f.Child)
			}
		}
	}

	// NOT(AND(left,right))=>OR(NOT(left), NOT(right))
	if not, _ := e.(*expression.Not); not != nil {
		if f, _ := not.Child.(*expression.And); f != nil {
			return pushNotFiltersHelper(expression.NewOr(expression.NewNot(f.LeftChild), expression.NewNot(f.RightChild)))
		}
	}

	// NOT(OR(left,right))=>AND(NOT(left), NOT(right))
	if not, _ := e.(*expression.Not); not != nil {
		if f, _ := not.Child.(*expression.Or); f != nil {
			return pushNotFiltersHelper(expression.NewAnd(expression.NewNot(f.LeftChild), expression.NewNot(f.RightChild)))
		}
	}

	// NOT(GT(c))=>LTE(c)
	if not, _ := e.(*expression.Not); not != nil {
		if f, _ := not.Child.(*expression.GreaterThan); f != nil {
			return pushNotFiltersHelper(expression.NewLessThanOrEqual(f.Left(), f.Right()))
		}
	}

	// NOT(GTE(c))=>LT(c)
	if not, _ := e.(*expression.Not); not != nil {
		if f, _ := not.Child.(*expression.GreaterThanOrEqual); f != nil {
			return pushNotFiltersHelper(expression.NewLessThan(f.Left(), f.Right()))
		}
	}

	// NOT(LT(c))=>GTE(c)
	if not, _ := e.(*expression.Not); not != nil {
		if f, _ := not.Child.(*expression.LessThan); f != nil {
			return pushNotFiltersHelper(expression.NewGreaterThanOrEqual(f.Left(), f.Right()))
		}
	}

	// NOT(LTE(c))=>GT(c)
	if not, _ := e.(*expression.Not); not != nil {
		if f, _ := not.Child.(*expression.LessThanOrEqual); f != nil {
			return pushNotFiltersHelper(expression.NewGreaterThan(f.Left(), f.Right()))
		}
	}

	//NOT(BETWEEN(left,right))=>OR(LT(left), GT(right))
	if not, _ := e.(*expression.Not); not != nil {
		if f, _ := not.Child.(*expression.Between); f != nil {
			return pushNotFiltersHelper(expression.NewOr(
				expression.NewLessThan(f.Val, f.Lower),
				expression.NewGreaterThan(f.Val, f.Upper),
			))
		}
	}

	var newChildren []sql.Expression
	for _, c := range e.Children() {
		newC, err := pushNotFiltersHelper(c)
		if err != nil {
			return nil, err
		}
		newChildren = append(newChildren, newC)
	}
	return e.WithChildren(newChildren...)
}
