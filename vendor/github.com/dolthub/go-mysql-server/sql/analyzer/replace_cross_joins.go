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
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// comparisonSatisfiesJoinCondition checks a) whether a comparison is a valid join predicate,
// and b) whether the Left/Right children of a comparison expression covers the dependency trees
// of a plan.CrossJoin's children.
func comparisonSatisfiesJoinCondition(expr expression.Comparer, j *plan.JoinNode) bool {
	lCols := j.Left().Schema()
	rCols := j.Right().Schema()

	var re, le *expression.GetField
	switch e := expr.(type) {
	case *expression.Equals, *expression.NullSafeEquals, *expression.GreaterThan,
		*expression.LessThan, *expression.LessThanOrEqual, *expression.GreaterThanOrEqual:
		ce, ok := e.(expression.Comparer)
		if !ok {
			return false
		}
		le, ok = ce.Left().(*expression.GetField)
		if !ok {
			return false
		}
		re, ok = ce.Right().(*expression.GetField)
		if !ok {
			return false
		}
	default:
		if e, ok := e.(expression.Equality); ok && e.RepresentsEquality() {
			ce, ok := e.(expression.Comparer)
			if !ok {
				return false
			}
			le, ok = ce.Left().(*expression.GetField)
			if !ok {
				return false
			}
			re, ok = ce.Right().(*expression.GetField)
			if !ok {
				return false
			}
		}
		return false
	}

	return lCols.Contains(le.Name(), le.Table()) && rCols.Contains(re.Name(), re.Table()) ||
		rCols.Contains(le.Name(), le.Table()) && lCols.Contains(re.Name(), re.Table())
}

// expressionCoversJoin checks whether a subexpressions's comparison predicate
// satisfies the join condition. The input conjunctions have already been split,
// so we do not care which predicate satisfies the expression.
func expressionCoversJoin(c sql.Expression, j *plan.JoinNode) (found bool) {
	return transform.InspectExpr(c, func(expr sql.Expression) bool {
		switch e := expr.(type) {
		case expression.Comparer:
			return comparisonSatisfiesJoinCondition(e, j)
		}
		return false
	})
}

// replaceCrossJoins recursively replaces filter nested cross joins with equivalent inner joins.
// There are 3 phases after we identify a Filter -> ... -> CrossJoin pattern.
//  1. Build a list of disjunct predicate expressions by top-down splitting conjunctions (AND).
//  2. For every CrossJoin, check whether a subset of predicates covers as join conditions,
//     and create a new InnerJoin with the matching predicates.
//  3. Remove predicates from the parent Filter that have been pushed into InnerJoins.
func replaceCrossJoins(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !n.Resolved() {
		return n, transform.SameTree, nil
	}

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		f, ok := n.(*plan.Filter)
		if !ok {
			return n, transform.SameTree, nil
		}
		predicates := expression.SplitConjunction(f.Expression)
		movedPredicates := make(map[int]struct{})
		newF, _, err := transform.Node(f, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
			cj, ok := n.(*plan.JoinNode)
			if !ok || !cj.Op.IsCross() {
				return n, transform.SameTree, nil
			}

			joinConjs := make([]int, 0, len(predicates))
			for i, c := range predicates {
				if expressionCoversJoin(c, cj) {
					joinConjs = append(joinConjs, i)
				}
			}

			if len(joinConjs) == 0 {
				return n, transform.SameTree, nil
			}

			newExprs := make([]sql.Expression, len(joinConjs))
			for i, v := range joinConjs {
				movedPredicates[v] = struct{}{}
				newExprs[i] = predicates[v]
			}
			// retain comment
			nij := plan.NewInnerJoin(cj.Left(), cj.Right(), expression.JoinAnd(newExprs...))
			return nij.WithComment(cj.Comment()), transform.NewTree, nil
		})
		if err != nil {
			return f, transform.SameTree, err
		}

		// only alter the Filter expression tree if we transferred predicates to an InnerJoin
		if len(movedPredicates) == 0 {
			return f, transform.SameTree, nil
		}

		// remove Filter if all expressions were transferred to joins
		if len(predicates) == len(movedPredicates) {
			return newF.(*plan.Filter).Child, transform.NewTree, nil
		}

		newFilterExprs := make([]sql.Expression, 0, len(predicates)-len(movedPredicates))
		for i, e := range predicates {
			if _, ok := movedPredicates[i]; ok {
				continue
			}
			newFilterExprs = append(newFilterExprs, e)
		}
		newF, err = newF.(*plan.Filter).WithExpressions(expression.JoinAnd(newFilterExprs...))
		return newF, transform.NewTree, err
	})
}
