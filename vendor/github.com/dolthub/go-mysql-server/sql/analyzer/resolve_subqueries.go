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
	"github.com/dolthub/go-mysql-server/sql/analyzer/analyzererrors"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// resolveSubqueries runs analysis on each subquery expression and subquery alias in the specified node tree.
// Subqueries are processed from the top down and a new scope level is created for each subquery when it is sent
// to be analyzed.
func resolveSubqueries(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !qFlags.SubqueryIsSet() {
		return n, transform.SameTree, nil
	}

	span, ctx := ctx.Span("resolve_subqueries")
	defer span.End()

	return resolveSubqueriesHelper(ctx, a, n, scope, sel, false, qFlags)
}

func addLeftTablesToScope(outerScope *plan.Scope, leftNode sql.Node) *plan.Scope {
	resTbls := getTablesByName(leftNode)
	subScope := outerScope
	for _, tbl := range resTbls {
		subScope = subScope.NewScopeInJoin(tbl)
	}
	subScope.SetJoin(true)
	return subScope
}

// finalizeSubqueryLateral ensures that all SubqueryAliases with IsLateral set to true have their children also set to true.
func finalizeSubqueryLateral(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	return transform.NodeWithOpaque(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		if parentSQA, ok := n.(*plan.SubqueryAlias); ok && parentSQA.IsLateral {
			newSqaChild, sqaSame, sqaErr := transform.NodeWithOpaque(parentSQA.Child, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
				if sqa, ok := n.(*plan.SubqueryAlias); ok {
					sqa.IsLateral = true
					return sqa, transform.NewTree, nil
				}
				return n, transform.SameTree, nil
			})
			if sqaErr != nil {
				return n, transform.SameTree, sqaErr
			}
			if sqaSame {
				return n, transform.SameTree, nil
			}
			newSqa, err := parentSQA.WithChildren(newSqaChild)
			if err != nil {
				return n, transform.SameTree, err
			}
			return newSqa, transform.NewTree, nil
		}
		return n, transform.SameTree, nil
	})
}

// finalizeSubqueries runs the final analysis pass on subquery expressions and subquery aliases in the node tree to ensure
// they are fully resolved and that the plan is ready to be executed. The logic is similar to when subqueries are initially
// resolved with resolveSubqueries, but with a few important differences:
//   - finalizeSubqueries processes each subquery once, finalizing parent before child scopes, and should only be included
//     when analyzing a root node at the top of the plan.
//   - resolveSubqueries skips pruneColumns and optimizeJoins for subquery expressions and only runs the OnceBeforeDefault
//     rule set on subquery aliases.
//   - finalizeSubqueries runs a full analysis pass on subquery expressions and runs all rule batches except for OnceBeforeDefault.
func finalizeSubqueries(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !qFlags.SubqueryIsSet() {
		return n, transform.SameTree, nil
	}

	span, ctx := ctx.Span("finalize_subqueries")
	defer span.End()

	node, same1, err := finalizeSubqueriesHelper(ctx, a, n, scope, sel, qFlags)
	if err != nil {
		return nil, transform.SameTree, err
	}

	newNode, same2, err := finalizeSubqueryLateral(ctx, a, node, scope, sel, qFlags)
	if err != nil {
		return nil, transform.SameTree, err
	}

	return newNode, same1 && same2, nil
}

// finalizeSubqueriesHelper finalizes all subqueries and subquery expressions,
// fixing parent scopes before recursing into child nodes.
func finalizeSubqueriesHelper(ctx *sql.Context, a *Analyzer, node sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	var joinParent *plan.JoinNode
	var selFunc transform.SelectorFunc = func(c transform.Context) bool {
		if jp, ok := c.Node.(*plan.JoinNode); ok {
			joinParent = jp
		}
		return true
	}

	var conFunc transform.CtxFunc = func(c transform.Context) (sql.Node, transform.TreeIdentity, error) {
		n := c.Node
		if sqa, ok := n.(*plan.SubqueryAlias); ok {
			var newSqa sql.Node
			var same2 transform.TreeIdentity
			var err error
			// NOTE: this only really fixes one level of subquery with two joins.
			// This patch will likely not fix cases with more deeply nested joins and subqueries.
			// A real fix would be to re-examine indexes after everything.
			if sqa.OuterScopeVisibility && joinParent != nil {
				if stripChild, ok := joinParent.Right().(*plan.StripRowNode); ok && stripChild.Child == sqa {
					subScope := scope.NewScopeInJoin(joinParent.Children()[0])
					subScope.SetLateralJoin(joinParent.Op.IsLateral())
					newSqa, same2, err = analyzeSubqueryAlias(ctx, a, sqa, subScope, sel, true, qFlags)
				} else {
					// IsLateral means that the subquery should have visibility into the left scope.
					if sqa.IsLateral {
						subScope := addLeftTablesToScope(scope, joinParent.Left())
						subScope.SetLateralJoin(true)
						newSqa, same2, err = analyzeSubqueryAlias(ctx, a, sqa, subScope, sel, true, qFlags)
					} else {
						newSqa, same2, err = analyzeSubqueryAlias(ctx, a, sqa, scope, sel, true, qFlags)
					}
				}
			} else {
				// IsLateral means that the subquery should have visibility into the left scope.
				if joinParent != nil && sqa.IsLateral {
					subScope := addLeftTablesToScope(scope, joinParent.Left())
					subScope.SetLateralJoin(true)
					newSqa, same2, err = analyzeSubqueryAlias(ctx, a, sqa, subScope, sel, true, qFlags)
				} else {
					newSqa, same2, err = analyzeSubqueryAlias(ctx, a, sqa, scope, sel, true, qFlags)
				}
			}

			if err != nil {
				return n, transform.SameTree, err
			}

			newNode, same1, err := finalizeSubqueriesHelper(ctx, a, newSqa.(*plan.SubqueryAlias).Child, scope.NewScopeFromSubqueryAlias(sqa), sel, qFlags)
			if err != nil {
				return n, transform.SameTree, err
			}

			if same1 && same2 {
				return n, transform.SameTree, nil
			} else {
				newNode, err = newSqa.WithChildren(newNode)
				return newNode, transform.NewTree, err
			}
		}
		return transform.OneNodeExprsWithNode(n, func(node sql.Node, e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
			if sq, ok := e.(*plan.Subquery); ok {
				newSq, same2, err := analyzeSubqueryExpression(ctx, a, node, sq, scope, sel, true, qFlags)
				if err != nil {
					if analyzererrors.ErrValidationResolved.Is(err) {
						// if a parent is unresolved, we want to dig deeper to find the unresolved
						// child dependency
						_, _, err := finalizeSubqueriesHelper(ctx, a, sq.Query, scope.NewScopeFromSubqueryExpression(node, sq.Correlated()), sel, qFlags)
						if err != nil {
							return e, transform.SameTree, err
						}
					}
					return e, transform.SameTree, err
				}
				newExpr, same1, err := finalizeSubqueriesHelper(ctx, a, newSq.(*plan.Subquery).Query, scope.NewScopeFromSubqueryExpression(node, newSq.(*plan.Subquery).Correlated()), sel, qFlags)
				if err != nil {
					return e, transform.SameTree, err
				}

				if same1 && same2 {
					return e, transform.SameTree, nil
				} else {
					return newSq.(*plan.Subquery).WithQuery(newExpr), transform.NewTree, nil
				}
			} else {
				return e, transform.SameTree, nil
			}
		})
	}

	return transform.NodeWithCtx(node, selFunc, conFunc)
}

func resolveSubqueriesHelper(ctx *sql.Context, a *Analyzer, node sql.Node, scope *plan.Scope, sel RuleSelector, finalize bool, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	return transform.NodeWithCtx(node, nil, func(c transform.Context) (sql.Node, transform.TreeIdentity, error) {
		n := c.Node
		if sqa, ok := n.(*plan.SubqueryAlias); ok {
			// IsLateral means that the subquery should have visibility into the left scope.
			if parent, ok := c.Parent.(*plan.JoinNode); ok && sqa.IsLateral {
				subScope := addLeftTablesToScope(scope, parent.Left())
				return analyzeSubqueryAlias(ctx, a, sqa, subScope, sel, finalize, qFlags)
			}
			return analyzeSubqueryAlias(ctx, a, sqa, scope, sel, finalize, qFlags)
		} else {
			return transform.OneNodeExprsWithNode(n, func(node sql.Node, e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
				if sq, ok := e.(*plan.Subquery); ok {
					return analyzeSubqueryExpression(ctx, a, n, sq, scope, sel, finalize, qFlags)
				} else {
					return e, transform.SameTree, nil
				}
			})
		}
	})
}

// analyzeSubqueryExpression runs analysis on the specified subquery expression, |sq|. The specified node |n| is the node
// that contains the subquery expression and |finalize| indicates if this is the final run of the analyzer on the query
// before execution, which means all analyzer rules are included, otherwise SubqueryExprResolveSelector is used to prevent
// running pruneColumns and optimizeJoins for all non-final analysis passes.
func analyzeSubqueryExpression(ctx *sql.Context, a *Analyzer, n sql.Node, sq *plan.Subquery, scope *plan.Scope, sel RuleSelector, finalize bool, qFlags *sql.QueryFlags) (sql.Expression, transform.TreeIdentity, error) {
	// We always analyze subquery expressions even if they are resolved, since other transformations to the surrounding
	// query might cause them to need to shift their field indexes.
	subqueryCtx, cancelFunc := ctx.NewSubContext()
	defer cancelFunc()

	var analyzed sql.Node
	var err error
	if finalize {
		analyzed, _, err = a.analyzeStartingAtBatch(subqueryCtx, sq.Query,
			scope.NewScopeFromSubqueryExpression(n, sq.Correlated()), "default-rules", NewFinalizeSubquerySel(sel), qFlags)
	} else {
		analyzed, _, err = a.analyzeThroughBatch(subqueryCtx, sq.Query,
			scope.NewScopeFromSubqueryExpression(n, sq.Correlated()), "default-rules", NewResolveSubqueryExprSelector(sel), qFlags)
	}
	if err != nil {
		// We ignore certain errors during non-final passes of the analyzer, deferring them to later analysis passes.
		// Specifically, if the subquery isn't resolved or a column can't be found in the scope node, wait until a later pass.
		if !finalize && (analyzererrors.ErrValidationResolved.Is(err) || sql.ErrTableColumnNotFound.Is(err) || sql.ErrColumnNotFound.Is(err)) {
			// keep the work we have and defer remainder of analysis of this subquery until a later pass
			return sq.WithQuery(analyzed), transform.NewTree, nil
		}
		return nil, transform.SameTree, err
	}

	//todo(max): Infinite cycles with subqueries, unions, ctes, catalog.
	// we squashed most negative errors, where a rule fails to report a plan change
	// to the expense of positive errors, where a rule reports a change when the plan
	// is the same before/after.
	// .Resolved() might be useful for fixing these bugs.
	return sq.WithQuery(analyzed).WithExecBuilder(a.ExecBuilder), transform.NewTree, nil
}

// analyzeSubqueryAlias runs analysis on the specified subquery alias, |sqa|. The |finalize| parameter indicates if this is
// the final run of the analyzer on the query before execution, which means all rules, starting from the default-rules
// batch are processed, otherwise only the once-before-default batch of rules is processed for all other non-final passes.
func analyzeSubqueryAlias(ctx *sql.Context, a *Analyzer, sqa *plan.SubqueryAlias, scope *plan.Scope, sel RuleSelector, finalize bool, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	subScope := scope.NewScopeFromSubqueryAlias(sqa)

	var child sql.Node
	var same transform.TreeIdentity
	var err error
	if finalize {
		child, same, err = a.analyzeStartingAtBatch(ctx, sqa.Child, subScope, "default-rules", NewFinalizeSubquerySel(sel), qFlags)
	} else {
		child, same, err = a.analyzeThroughBatch(ctx, sqa.Child, subScope, "default-rules", sel, qFlags)
	}
	if err != nil {
		return nil, same, err
	}

	if len(sqa.ColumnNames) > 0 {
		schemaLen := schemaLength(child)
		if schemaLen != len(sqa.ColumnNames) {
			return nil, transform.SameTree, sql.ErrColumnCountMismatch.New()
		}
	}
	if same {
		return sqa, transform.SameTree, nil
	}
	newn, err := sqa.WithChildren(child)
	return newn, transform.NewTree, err
}

// cacheSubqueryAlisesInJoins will look for joins against subquery aliases that
// will repeatedly execute the subquery, and will insert a *plan.CachedResults
// node on top of those nodes. The left-most child of a join root is an exception
// that cannot be cached.
func cacheSubqueryAliasesInJoins(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	var recurse func(n sql.Node, parentCached, inJoin, leftChild bool) (sql.Node, transform.TreeIdentity, error)
	recurse = func(n sql.Node, parentCached, inJoin, leftChild bool) (sql.Node, transform.TreeIdentity, error) {
		_, isOp := n.(sql.OpaqueNode)
		var isCacheableSq bool
		var isCachedRs bool
		var isMax1Row bool
		switch n := n.(type) {
		case *plan.JoinNode:
			if !inJoin {
				inJoin = true
				leftChild = true
			}
		case *plan.SubqueryAlias:
			isCacheableSq = n.CanCacheResults() && !leftChild
		case *plan.CachedResults:
			isCachedRs = true
		case *plan.Max1Row:
			isMax1Row = true
		default:

		}

		doCache := isCacheableSq && inJoin && !parentCached
		childInJoin := inJoin && !isOp

		children := n.Children()
		var newChildren []sql.Node
		for i, c := range children {
			child, same, _ := recurse(c, doCache || isCachedRs || isMax1Row, childInJoin, leftChild)
			if !same {
				if newChildren == nil {
					newChildren = make([]sql.Node, len(children))
					copy(newChildren, children)
				}
				newChildren[i] = child
			}
			leftChild = false
		}

		if len(newChildren) == 0 && !doCache {
			return n, transform.SameTree, nil
		}

		ret := n
		if len(newChildren) > 0 {
			ret, _ = ret.WithChildren(newChildren...)
		}
		if doCache {
			ret = plan.NewCachedResults(n)
		}
		return ret, transform.NewTree, nil
	}
	return recurse(n, false, false, false)
}
