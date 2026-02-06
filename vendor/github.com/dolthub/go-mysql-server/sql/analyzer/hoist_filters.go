package analyzer

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// hoistOutOfScopeFilters pulls filters upwards into the parent scope
// to decorrelate subqueries for further optimizations.
//
// select * from xy where exists (select * from uv where x = 1)
// =>
// select * from xy where x = 1 and exists (select * from uv)
func hoistOutOfScopeFilters(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !qFlags.SubqueryIsSet() {
		return n, transform.SameTree, nil
	}

	switch n.(type) {
	case *plan.TriggerBeginEndBlock:
		return n, transform.SameTree, nil
	default:
	}

	inCorr := sql.ColSet{}
	if sq, ok := n.(*plan.SubqueryAlias); ok {
		inCorr = sq.Correlated
	}

	// todo: seems like inCorr/outCorr should match
	ret, same, filters, outCorr, err := recurseSubqueryForOuterFilters(n, a, inCorr)
	if len(filters) != 0 {
		return n, transform.SameTree, fmt.Errorf("rule 'hoistOutOfScopeFilters' tried to hoist filters above root node")
	}

	if sq, ok := ret.(*plan.SubqueryAlias); ok {
		ret = sq.WithCorrelated(outCorr)
	}
	return ret, same, err
}

// recurseSubqueryForOuterFilters recursively hoists filters that belong
// to an outer scope (maybe higher than the parent). We do a DFS for hoisting
// subquery filters. We do a BFS to extract hoistable filters from subquery
// expressions before checking the normalized subquery and its hoisted
// filters for further hoisting.
func recurseSubqueryForOuterFilters(n sql.Node, a *Analyzer, corr sql.ColSet) (sql.Node, transform.TreeIdentity, []sql.Expression, sql.ColSet, error) {
	var hoistFilters []sql.Expression
	var newCorr sql.ColSet
	ret, same, err := transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		sq, _ := n.(*plan.SubqueryAlias)
		if sq != nil {
			corrIn := corr.Union(sq.Correlated)
			newQ, same, hoisted, subCorr, err := recurseSubqueryForOuterFilters(sq.Child, a, corrIn)
			if err != nil {
				return n, transform.SameTree, err
			}
			if same {
				return n, transform.SameTree, nil
			}
			if len(hoisted) > 0 {
				hoistFilters = append(hoistFilters, hoisted...)
			}
			newCorr = newCorr.Union(subCorr)
			return sq.WithChild(newQ).WithCorrelated(subCorr), transform.NewTree, nil
		}
		f, _ := n.(*plan.Filter)
		if f == nil {
			return n, transform.SameTree, nil
		}

		var keepFilters []sql.Expression
		allSame := transform.SameTree
		queue := expression.SplitConjunction(f.Expression)
		for len(queue) > 0 {
			e := queue[0]
			queue = queue[1:]

			var not bool
			if n, ok := e.(*expression.Not); ok {
				not = true
				e = n.Child
			}

			var sq *plan.Subquery
			switch e := e.(type) {
			case *plan.InSubquery:
				sq, _ = e.RightChild.(*plan.Subquery)
			case *plan.ExistsSubquery:
				sq = e.Query
			default:
			}

			// only try to pull filters from correlated subqueries
			if sq != nil && !sq.Correlated().Empty() {
				children := e.Children()
				corrIn := corr.Union(sq.Correlated())
				newQ, same, hoisted, subCorr, err := recurseSubqueryForOuterFilters(sq.Query, a, corrIn)
				if err != nil {
					return n, transform.SameTree, err
				}
				newCorr = newCorr.Union(subCorr)
				allSame = allSame && same
				newSq := sq.WithQuery(newQ)
				newSq = newSq.WithCorrelated(subCorr)
				children[len(children)-1] = newSq
				e, _ = e.WithChildren(children...)

				if len(hoisted) > 0 {
					if not {
						// hoisted are tied to parent NOT, more elegant simplification
						// required to expose individual expressions for further hoisting
						e = expression.JoinAnd(e, expression.JoinAnd(hoisted...))
					} else {
						queue = append(queue, hoisted...)
					}
				}
			}

			if not {
				e = expression.NewNot(e)
			}

			inScope, outOfScope := partitionFilterByScope(e, corr)
			if !inScope.Empty() {
				// maintain reference to correlations that aren't hoisted
				newCorr = newCorr.Union(outOfScope)
				keepFilters = append(keepFilters, e)
			} else {
				// nothing tethers the subquery to this scope
				hoistFilters = append(hoistFilters, e)
			}
		}

		if len(hoistFilters) > 0 {
			allSame = transform.NewTree
		}
		if allSame {
			return n, transform.SameTree, nil
		}

		if corr.Empty() {
			// rootscope or equivalent, there is no benefit from hoisting
			// we should materialize filters
			newFilters := append(keepFilters, hoistFilters...)
			hoistFilters = hoistFilters[:0]
			return plan.NewFilter(expression.JoinAnd(newFilters...), f.Child), transform.NewTree, nil
		}

		if len(keepFilters) == 0 {
			return f.Child, transform.NewTree, nil
		}
		ret := plan.NewFilter(expression.JoinAnd(keepFilters...), f.Child)
		return ret, transform.NewTree, nil
	})
	return ret, same, hoistFilters, newCorr, err
}

// partitionFilterByScope returns two colsets that include the in and
// out-of-scope columns referenced in this expression.
func partitionFilterByScope(e sql.Expression, corr sql.ColSet) (inScope, outOfScope sql.ColSet) {
	transform.InspectExpr(e, func(e sql.Expression) bool {
		switch e := e.(type) {
		case *expression.GetField:
			// we're searching for anything in-scope
			// return true if not correlated from outerscope
			id := e.Id()
			if corr.Contains(id) {
				outOfScope.Add(id)
			} else {
				inScope.Add(id)
			}
		case *plan.Subquery:
			// TODO cache in-scope on subqueries?
			transform.Inspect(e.Query, func(n sql.Node) bool {
				if ne, ok := n.(sql.Expressioner); ok {
					for _, e := range ne.Expressions() {
						in, out := partitionFilterByScope(e, corr)
						inScope = inScope.Union(in)
						outOfScope = outOfScope.Union(out)
					}
				}
				return true
			})
		default:
		}
		return false
	})
	return
}
