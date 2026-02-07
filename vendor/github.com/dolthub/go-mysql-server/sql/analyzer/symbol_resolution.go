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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// pruneTables removes unneeded columns from *plan.ResolvedTable nodes
//
// A preOrder walk constructs a new tree top-down. For every non-base
// case node encountered:
//  1. Collect outer tableCol dependencies for the node
//  2. Apply the node's dependencies to |parentCols|, |parentStars|,
//     and |unqualifiedStar|.
//  3. Process the node's children with the new dependencies.
//  4. Rewind the dependencies, resetting |parentCols|, |parentStars|,
//     and |unqualifiedStar| to values when we entered this node.
//  5. Return the node with its children to the parent.
//
// The base case prunes a *plan.ResolvedTable of parent dependencies.
//
// The dependencies considered are:
//   - outerCols: columns used by filters or other expressions
//     sourced from outside the node
//   - aliasCols: a bridge between outside columns and an aliased
//     data source.
//   - subqueryCols: correlated subqueries have outside cols not
//     satisfied by tablescans in the subquery
//   - stars: a tablescan with a qualified star or cannot be pruned. An
//     unqualified star prevents pruning every child tablescan.
func pruneTables(ctx *sql.Context, a *Analyzer, n sql.Node, s *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	// MATCH ... AGAINST ... prevents pruning due to its internal reliance on an expected and consistent schema in all situations
	if hasMatchAgainstExpr(n) {
		return n, transform.SameTree, nil
	}

	switch n := n.(type) {
	case *plan.TableAlias, *plan.ResolvedTable:
		return n, transform.SameTree, nil
	}

	// the same table can appear in multiple table scans,
	// so we use a counter to pin references
	parentCols := make(map[tableCol]int)
	parentStars := make(map[string]struct{})
	var unqualifiedStar bool

	push := func(cols []tableCol, nodeStars []string, nodeUnq bool) {
		for _, c := range cols {
			parentCols[c]++
		}
		for _, c := range nodeStars {
			parentStars[c] = struct{}{}
		}
		unqualifiedStar = unqualifiedStar || nodeUnq
	}

	pop := func(cols []tableCol, nodeStars []string, beforeUnq bool) {
		for _, c := range cols {
			parentCols[c]--
		}
		for _, c := range nodeStars {
			delete(parentStars, c)
		}
		unqualifiedStar = beforeUnq
	}

	var pruneWalk func(n sql.Node) (sql.Node, transform.TreeIdentity, error)
	pruneWalk = func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch n := n.(type) {
		case *plan.ResolvedTable:
			return pruneTableCols(n, parentCols, parentStars, unqualifiedStar)
		case *plan.JoinNode:
			if n.JoinType().IsPhysical() || n.JoinType().IsUsing() || n.JoinType().IsSemi() {
				return n, transform.SameTree, nil
			}
			// we cannot push projections past lateral joins as columns not in the projection,
			// but are in the left subtree can be referenced by the right subtree or parent nodes
			if sqa, ok := n.Right().(*plan.SubqueryAlias); ok && sqa.IsLateral {
				return n, transform.SameTree, nil
			}
			if _, ok := n.Right().(*plan.JSONTable); ok {
				outerCols, outerStars, outerUnq := gatherOuterCols(n.Right())
				aliasCols, aliasStars := gatherTableAlias(n.Right(), parentCols, parentStars, unqualifiedStar)
				push(outerCols, outerStars, outerUnq)
				push(aliasCols, aliasStars, false)
			}
		case *plan.Filter, *plan.Distinct, *plan.GroupBy, *plan.Project, *plan.TableAlias,
			*plan.Window, *plan.Sort, *plan.Limit, *plan.RecursiveCte,
			*plan.RecursiveTable, *plan.TopN, *plan.Offset, *plan.StripRowNode:
		default:
			return n, transform.SameTree, nil
		}
		if sq := findSubqueryExpr(n); sq != nil {
			return n, transform.SameTree, nil
		}

		beforeUnq := unqualifiedStar

		//todo(max): outer and alias cols can have duplicates, as long as the pop
		// is equal and opposite we are usually fine. In the cases we aren't, we
		// already do not handle nested aliasing well.
		outerCols, outerStars, outerUnq := gatherOuterCols(n)
		aliasCols, aliasStars := gatherTableAlias(n, parentCols, parentStars, unqualifiedStar)
		push(outerCols, outerStars, outerUnq)
		push(aliasCols, aliasStars, false)

		children := n.Children()
		var newChildren []sql.Node
		for i := len(children) - 1; i >= 0; i-- {
			// TODO don't push filters too low in join?
			// join tables scoped left -> right, prune right -> left
			c := children[i]
			child, same, _ := pruneWalk(c)
			if !same {
				if newChildren == nil {
					newChildren = make([]sql.Node, len(children))
					copy(newChildren, children)
				}
				newChildren[i] = child
			}
		}

		pop(outerCols, outerStars, beforeUnq)
		pop(aliasCols, aliasStars, beforeUnq)

		if len(newChildren) == 0 {
			return n, transform.SameTree, nil
		}
		ret, _ := n.WithChildren(newChildren...)
		return ret, transform.NewTree, nil
	}

	return pruneWalk(n)
}

// findSubqueryExpr searches for a *plan.Subquery in a single node,
// returning the subquery or nil
func findSubqueryExpr(n sql.Node) *plan.Subquery {
	var sq *plan.Subquery
	ne, ok := n.(sql.Expressioner)
	if !ok {
		return nil
	}
	for _, e := range ne.Expressions() {
		found := transform.InspectExpr(e, func(e sql.Expression) bool {
			if e, ok := e.(*plan.Subquery); ok {
				sq = e
				return true
			}
			return false
		})
		if found {
			return sq
		}
	}
	return nil
}

// hasMatchAgainstExpr searches for an *expression.MatchAgainst within the node's expressions
func hasMatchAgainstExpr(node sql.Node) bool {
	var foundMatchAgainstExpr bool
	transform.InspectExpressions(node, func(expr sql.Expression) bool {
		_, isMatchAgainstExpr := expr.(*expression.MatchAgainst)
		if isMatchAgainstExpr {
			foundMatchAgainstExpr = true
		}
		return !foundMatchAgainstExpr
	})
	return foundMatchAgainstExpr
}

// pruneTableCols uses a list of parent dependencies columns and stars
// to prune and return a new table node. We prune a column if no
// parent references the column, no parent projections this table as a
// qualified star, and no parent projects an unqualified star.
func pruneTableCols(
	n *plan.ResolvedTable,
	parentCols map[tableCol]int,
	parentStars map[string]struct{},
	unqualifiedStar bool,
) (sql.Node, transform.TreeIdentity, error) {
	table := getTable(n)
	ptab, isProjTbl := table.(sql.ProjectedTable)
	if !isProjTbl || plan.IsDualTable(table) {
		return n, transform.SameTree, nil
	}
	if len(ptab.Projections()) > 0 {
		return n, transform.SameTree, nil
	}

	// columns don't need to be pruned if there's a star
	_, selectStar := parentStars[table.Name()]
	if selectStar || unqualifiedStar {
		return n, transform.SameTree, nil
	}

	// pruning VirtualColumnTable underlying tables causes indexing errors when VirtualColumnTable.Projections (which are sql.Expression)
	// are evaluated
	if _, isVCT := n.WrappedTable().(*plan.VirtualColumnTable); isVCT {
		return n, transform.SameTree, nil
	}

	cols := make([]string, 0)
	source := strings.ToLower(table.Name())
	for _, col := range table.Schema() {
		c := newTableCol(source, col.Name)
		if parentCols[c] > 0 {
			cols = append(cols, c.col)
		}
	}

	ret, err := n.WithTable(ptab.WithProjections(cols))
	if err != nil {
		return n, transform.SameTree, nil
	}

	return ret, transform.NewTree, nil
}

// gatherOuterCols searches a node's expressions for column
// references and stars.
func gatherOuterCols(n sql.Node) ([]tableCol, []string, bool) {
	ne, ok := n.(sql.Expressioner)
	if !ok {
		return nil, nil, false
	}

	var cols []tableCol
	var nodeStars []string
	var nodeUnqualifiedStar bool
	for _, e := range ne.Expressions() {
		transform.InspectExpr(e, func(e sql.Expression) bool {
			var col tableCol
			switch e := e.(type) {
			case *expression.Alias:
				switch e := e.Child.(type) {
				case *expression.GetField:
					col = newTableCol(e.Table(), e.Name())
				case *expression.UnresolvedColumn:
					col = newTableCol(e.Table(), e.Name())
				default:
				}
			case *expression.GetField:
				col = newTableCol(e.Table(), e.Name())
			case *expression.UnresolvedColumn:
				col = newTableCol(e.Table(), e.Name())
			case *expression.Star:
				if len(e.Table) > 0 {
					nodeStars = append(nodeStars, strings.ToLower(e.Table))
				} else {
					nodeUnqualifiedStar = true
				}
			default:
			}
			if col.col != "" {
				cols = append(cols, col)
			}
			return false
		})
	}

	return cols, nodeStars, nodeUnqualifiedStar
}

// gatherTableAlias bridges two scopes: the parent scope with
// its |parentCols|, and the child data source that is
// accessed through this node's alias name. We return the
// aliased columns qualified with the base table name,
// and stars if applicable.
// TODO: we don't have any tests with the unqualified condition
func gatherTableAlias(
	n sql.Node,
	parentCols map[tableCol]int,
	parentStars map[string]struct{},
	unqualifiedStar bool,
) ([]tableCol, []string) {
	var cols []tableCol
	var nodeStars []string
	switch n := n.(type) {
	case *plan.TableAlias:
		alias := strings.ToLower(n.Name())
		var base string
		if rt, ok := n.Child.(*plan.ResolvedTable); ok {
			base = rt.Name()
		}
		_, starred := parentStars[alias]
		if unqualifiedStar {
			starred = true
		}
		for _, col := range n.Schema() {
			baseCol := newTableCol(base, col.Name)
			aliasCol := newTableCol(alias, col.Name)
			if starred || parentCols[aliasCol] > 0 {
				// if the outer scope requests an aliased column
				// a table lower in the tree must provide the source
				cols = append(cols, baseCol)
			}
		}
		for t := range parentStars {
			if t == alias {
				nodeStars = append(nodeStars, base)
			}
		}
		return cols, nodeStars
	default:
	}
	return cols, nodeStars
}
