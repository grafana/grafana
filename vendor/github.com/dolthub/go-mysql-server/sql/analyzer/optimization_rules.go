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

		if len(condFilters) == 0 {
			condFilters = append(condFilters, expression.NewLiteral(true, types.Boolean))
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

// simplifyFilters simplifies the expressions in Filter nodes where possible. This involves removing redundant parts of AND
// and OR expressions, as well as replacing evaluable expressions with their literal result. Filters that can
// statically be determined to be true or false are replaced with the child node or an empty result, respectively.
func simplifyFilters(ctx *sql.Context, a *Analyzer, node sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !node.Resolved() {
		return node, transform.SameTree, nil
	}

	return transform.NodeWithOpaque(node, func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
		filter, ok := node.(*plan.Filter)
		if !ok {
			return node, transform.SameTree, nil
		}

		e, same, err := transform.Expr(filter.Expression, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
			switch e := e.(type) {
			case *plan.Subquery:
				newQ, same, err := simplifyFilters(ctx, a, e.Query, scope, sel, qFlags)
				if same || err != nil {
					return e, transform.SameTree, err
				}
				return e.WithQuery(newQ), transform.NewTree, nil
			case *expression.Between:
				return expression.NewAnd(
					expression.NewGreaterThanOrEqual(e.Val, e.Lower),
					expression.NewLessThanOrEqual(e.Val, e.Upper),
				), transform.NewTree, nil
			case *expression.Or:
				if isTrue(ctx, e.LeftChild) {
					return e.LeftChild, transform.NewTree, nil
				}

				if isTrue(ctx, e.RightChild) {
					return e.RightChild, transform.NewTree, nil
				}

				if isFalse(ctx, e.LeftChild) && types.IsBoolean(e.RightChild.Type()) {
					return e.RightChild, transform.NewTree, nil
				}

				if isFalse(ctx, e.RightChild) && types.IsBoolean(e.LeftChild.Type()) {
					return e.LeftChild, transform.NewTree, nil
				}

				return e, transform.SameTree, nil
			case *expression.And:
				if isFalse(ctx, e.LeftChild) {
					return e.LeftChild, transform.NewTree, nil
				}

				if isFalse(ctx, e.RightChild) {
					return e.RightChild, transform.NewTree, nil
				}

				if isTrue(ctx, e.LeftChild) && types.IsBoolean(e.RightChild.Type()) {
					return e.RightChild, transform.NewTree, nil
				}

				if isTrue(ctx, e.RightChild) && types.IsBoolean(e.LeftChild.Type()) {
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
					return expression.NewLiteral(!val, e.Type()), transform.NewTree, nil
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
		if err != nil {
			return nil, transform.SameTree, err
		}

		if isFalse(ctx, e) {
			emptyTable := plan.NewEmptyTableWithSchema(filter.Schema())
			return emptyTable, transform.NewTree, nil
		}

		if isTrue(ctx, e) {
			return filter.Child, transform.NewTree, nil
		}

		if same {
			return filter, transform.SameTree, nil
		}
		return plan.NewFilter(e, filter.Child), transform.NewTree, nil
	})
}

func isFalse(ctx *sql.Context, e sql.Expression) bool {
	lit, ok := e.(*expression.Literal)
	if !ok || lit == nil || lit.Value() == nil {
		return false
	}
	val, err := sql.ConvertToBool(ctx, lit.Value())
	if err != nil {
		return false
	}
	return !val
}

func isTrue(ctx *sql.Context, e sql.Expression) bool {
	lit, ok := e.(*expression.Literal)
	if !ok || lit == nil || lit.Value() == nil {
		return false
	}
	val, err := sql.ConvertToBool(ctx, lit.Value())
	if err != nil {
		return false
	}
	return val
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
