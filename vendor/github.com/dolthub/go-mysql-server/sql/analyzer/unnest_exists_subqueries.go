// Copyright 2022 Dolthub, Inc.
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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type aliasDisambiguator struct {
	n                   sql.Node
	scope               *plan.Scope
	aliases             *TableAliases
	disambiguationIndex int
}

func (ad *aliasDisambiguator) GetAliases() (TableAliases, error) {
	if ad.aliases == nil {
		aliases, err := getTableAliases(ad.n, ad.scope)
		if err != nil {
			return TableAliases{}, err
		}
		ad.aliases = &aliases
	}
	return *ad.aliases, nil
}

func (ad *aliasDisambiguator) Disambiguate(alias string) (string, error) {
	nodeAliases, err := ad.GetAliases()
	if err != nil {
		return "", err
	}

	// all renamed aliases will be of the form <alias>_<disambiguationIndex++>
	for {
		ad.disambiguationIndex++
		aliasName := fmt.Sprintf("%s_%d", alias, ad.disambiguationIndex)
		if _, ok, err := nodeAliases.resolveName(aliasName); !ok {
			if err != nil {
				return "", err
			}
			return aliasName, nil
		}
	}
}

func newAliasDisambiguator(n sql.Node, scope *plan.Scope) *aliasDisambiguator {
	return &aliasDisambiguator{n: n, scope: scope}
}

// unnestExistsSubqueries merges a WHERE EXISTS subquery scope with its outer
// scope when the subquery filters on columns from the outer scope.
//
// For example:
// select * from a where exists (select 1 from b where a.x = b.x)
// =>
// select * from a semi join b on a.x = b.x
func unnestExistsSubqueries(
	ctx *sql.Context,
	a *Analyzer,
	n sql.Node,
	scope *plan.Scope,
	_ RuleSelector,
	qFlags *sql.QueryFlags,
) (sql.Node, transform.TreeIdentity, error) {
	if !qFlags.SubqueryIsSet() {
		return n, transform.SameTree, nil
	}
	aliasDisambig := newAliasDisambiguator(n, scope)
	return unnestSelectExistsHelper(ctx, scope, a, n, aliasDisambig, qFlags)
}

func unnestSelectExistsHelper(ctx *sql.Context, scope *plan.Scope, a *Analyzer, n sql.Node, aliasDisambig *aliasDisambiguator, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		f, ok := n.(*plan.Filter)
		if !ok {
			return n, transform.SameTree, nil
		}
		return unnestExistSubqueries(ctx, scope, a, f, aliasDisambig, qFlags)
	})
}

// simplifyPartialJoinParents discards nodes that will not affect an existence check.
func simplifyPartialJoinParents(n sql.Node) (sql.Node, bool) {
	ret := n
	// TODO: This should probably be a transform since we could have multiple layers of these types of nodes wrapped
	//  together.
	for {
		switch n := ret.(type) {
		case *plan.Having:
			return nil, false
		case *plan.Project, *plan.GroupBy, *plan.Sort, *plan.Distinct, *plan.TopN, *plan.Limit:
			// TODO: In most cases, it's necessary to remove *plan.Limit because child Filter nodes will have been
			//  hoisted out. But what if Limit.Limit evals to 0? https://github.com/dolthub/dolt/issues/10493
			ret = n.Children()[0]
		default:
			return ret, true
		}
	}
}

// unnestExistSubqueries scans a filter for [NOT] WHERE EXISTS, and then attempts to
// extract the subquery, correlated filters, a modified outer scope (net subquery and filters),
// and the new target joinType
func unnestExistSubqueries(ctx *sql.Context, scope *plan.Scope, a *Analyzer, filter *plan.Filter, aliasDisambig *aliasDisambiguator, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	ret := filter.Child
	var retFilters []sql.Expression
	same := transform.SameTree
	for _, f := range expression.SplitConjunction(filter.Expression) {
		var s *hoistSubquery
		var err error

		// match subquery expression
		joinType := plan.JoinTypeSemi
		var sq *plan.Subquery
		switch e := f.(type) {
		case *plan.ExistsSubquery:
			sq = e.Query
		case *expression.Not:
			if esq, ok := e.Child.(*plan.ExistsSubquery); ok {
				sq = esq.Query
				joinType = plan.JoinTypeAntiIncludeNulls
			}
		default:
		}
		if sq == nil {
			retFilters = append(retFilters, f)
			continue
		}

		// try to decorrelate
		// TODO: We're currently not able to decorrelate outer columns because we are pushing outerscope/correlated
		//  filters below SubqueryAliases. We likely need to rearrange the ordering of our rules.
		//  https://github.com/dolthub/dolt/issues/10490
		s, err = decorrelateOuterCols(sq.Query, aliasDisambig, sq.Correlated())
		if err != nil {
			return nil, transform.SameTree, err
		}

		if s == nil {
			retFilters = append(retFilters, f)
			continue
		}

		// recurse
		if s.inner != nil {
			s.inner, _, err = unnestSelectExistsHelper(ctx, scope.NewScopeFromSubqueryExpression(filter, sq.Correlated()), a, s.inner, aliasDisambig, qFlags)
			if err != nil {
				return nil, transform.SameTree, err
			}
		}

		// TODO: This should be done by walking the entire node instead of just checking the top node. What if we have
		//  a join where one side is a cacheable SQA and the other side is an uncacheable SQA? We should be able to
		//  detect that.
		if sqa, ok := s.inner.(*plan.SubqueryAlias); ok {
			if !sqa.CanCacheResults() {
				return filter, transform.SameTree, nil
			}
		}

		// if we reached here, |s| contains the state we need to
		// decorrelate the subquery expression into a new node
		same = transform.NewTree
		var comment string
		if c, ok := ret.(sql.CommentedNode); ok {
			comment = c.Comment()
		}

		if s.emptyScope {
			switch joinType {
			case plan.JoinTypeAntiIncludeNulls:
				// ret will be all rows
			case plan.JoinTypeSemi:
				ret = plan.NewEmptyTableWithSchema(ret.Schema())
			default:
				return filter, transform.SameTree, fmt.Errorf("hoistSelectExists failed on unexpected join type")
			}
			continue
		}

		if len(s.joinFilters) == 0 {
			// TODO: this is unsafe to do if query was originally wrapped in a Limit that evaluates to zero
			//   https://github.com/dolthub/dolt/issues/10493
			limited := plan.NewLimit(expression.NewLiteral(1, types.Int64), s.inner)
			switch joinType {
			case plan.JoinTypeAntiIncludeNulls:
				ret = plan.NewAntiJoinIncludingNulls(ret, limited, nil).WithComment(comment)
				qFlags.Set(sql.QFlagInnerJoin)
			case plan.JoinTypeSemi:
				if sq.Correlated().Empty() {
					ret = plan.NewCrossJoin(ret, limited).WithComment(comment)
				} else {
					// TODO: when does this actually happen? Should we account for this in an AntiJoin? What about when
					//  there are join filters?
					ret = plan.NewLateralCrossJoin(ret, limited).WithComment(comment)
				}
				qFlags.Set(sql.QFlagCrossJoin)
			default:
				return filter, transform.SameTree, fmt.Errorf("hoistSelectExists failed on unexpected join type")
			}
			continue
		}

		outerFilters := s.joinFilters
		if referencesOuterScope(outerFilters, scope) {
			retFilters = append(retFilters, f)
			continue
		}

		switch joinType {
		case plan.JoinTypeAntiIncludeNulls, plan.JoinTypeSemi:
			ret = plan.NewJoin(ret, s.inner, joinType, expression.JoinAnd(outerFilters...)).WithComment(comment)
			qFlags.Set(sql.QFlagInnerJoin)
		default:
			return filter, transform.SameTree, fmt.Errorf("hoistSelectExists failed on unexpected join type")
		}
	}

	if same {
		return filter, transform.SameTree, nil
	}
	if len(retFilters) > 0 {
		ret = plan.NewFilter(expression.JoinAnd(retFilters...), ret)
	}
	return ret, transform.NewTree, nil
}

// referencesOuterScope returns true if a filter in the set is from an outer scope
func referencesOuterScope(filters []sql.Expression, scope *plan.Scope) bool {
	if scope == nil {
		return false
	}
	for _, e := range filters {
		if transform.InspectExpr(e, func(e sql.Expression) bool {
			gf, ok := e.(*expression.GetField)
			return ok && scope.Correlated().Contains(gf.Id())
		}) {
			return true
		}
	}
	return false
}

type hoistSubquery struct {
	inner       sql.Node
	joinFilters []sql.Expression
	emptyScope  bool
}

// decorrelateOuterCols returns an optionally modified subquery and extracted filters referencing an outer scope.
// If the subquery has aliases that conflict with outside aliases, the internal aliases will be renamed to avoid
// name collisions.
func decorrelateOuterCols(sqChild sql.Node, aliasDisambig *aliasDisambiguator, corr sql.ColSet) (*hoistSubquery, error) {
	var joinFilters []sql.Expression
	var filtersToKeep []sql.Expression
	var emptyScope bool
	var cantDecorrelate bool
	n, _, _ := transform.Node(sqChild, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		if emptyScope {
			return n, transform.SameTree, nil
		}
		switch f := n.(type) {
		case *plan.Offset:
			cantDecorrelate = true
			return n, transform.SameTree, nil
		case *plan.EmptyTable:
			emptyScope = true
			return n, transform.SameTree, nil
		case *plan.Filter:
			filters := expression.SplitConjunction(f.Expression)
			for _, f := range filters {
				outerRef := transform.InspectExpr(f, func(e sql.Expression) bool {
					if gf, ok := e.(*expression.GetField); ok && corr.Contains(gf.Id()) {
						return true
					}
					if sq, ok := e.(*plan.Subquery); ok {
						if !sq.Correlated().Intersection(corr).Empty() {
							return true
						}
					}
					return false
				})

				// based on the GetField analysis, decide where to put the filter
				if outerRef {
					joinFilters = append(joinFilters, f)
				} else {
					filtersToKeep = append(filtersToKeep, f)
				}
			}

			// avoid updating the tree if we don't move any filters
			if len(filtersToKeep) == len(filters) {
				filtersToKeep = nil
				return f, transform.SameTree, nil
			}

			return f.Child, transform.NewTree, nil
		default:
			return n, transform.SameTree, nil
		}
	})

	if emptyScope {
		return &hoistSubquery{
			emptyScope: true,
		}, nil
	}

	if cantDecorrelate {
		return nil, nil
	}

	nodeAliases, err := getTableAliases(n, nil)
	if err != nil {
		return nil, err
	}

	outsideAliases, err := aliasDisambig.GetAliases()
	if err != nil {
		return nil, err
	}
	conflicts, nonConflicted := outsideAliases.findConflicts(nodeAliases)
	for _, goodAlias := range nonConflicted {
		target, ok, err := nodeAliases.resolveName(goodAlias)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, fmt.Errorf("node alias %s is not in nodeAliases", goodAlias)
		}
		err = outsideAliases.addUnqualified(goodAlias, target)
		if err != nil {
			return nil, err
		}
	}

	if len(conflicts) > 0 {
		for _, conflict := range conflicts {

			// conflict, need to rename
			newAlias, err := aliasDisambig.Disambiguate(conflict)
			if err != nil {
				return nil, err
			}
			same := transform.SameTree
			n, same, err = renameAliases(n, conflict, newAlias)
			if err != nil {
				return nil, err
			}

			if same {
				return nil, fmt.Errorf("tree is unchanged after attempted rename")
			}

			// rename the aliases in the expressions
			joinFilters, err = renameAliasesInExpressions(joinFilters, conflict, newAlias)
			if err != nil {
				return nil, err
			}

			filtersToKeep, err = renameAliasesInExpressions(filtersToKeep, conflict, newAlias)
			if err != nil {
				return nil, err
			}

			// alias was renamed, need to get the renamed target before adding to the outside aliases collection
			nodeAliases, err = getTableAliases(n, nil)
			if err != nil {
				return nil, err
			}

			// retrieve the new target
			target, ok, err := nodeAliases.resolveName(newAlias)
			if err != nil {
				return nil, err
			}
			if !ok {
				return nil, fmt.Errorf("node alias %s is not in nodeAliases", newAlias)
			}

			// add the new target to the outside aliases collection
			err = outsideAliases.addUnqualified(newAlias, target)
			if err != nil {
				return nil, err
			}
		}
	}

	n, ok := simplifyPartialJoinParents(n)
	if !ok {
		return nil, nil
	}
	if len(filtersToKeep) > 0 {
		n = plan.NewFilter(expression.JoinAnd(filtersToKeep...), n)
	}

	return &hoistSubquery{
		inner:       n,
		joinFilters: joinFilters,
	}, nil
}
