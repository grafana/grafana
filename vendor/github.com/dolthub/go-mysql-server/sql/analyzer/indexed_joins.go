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
	"errors"
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/memo"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// optimizeJoins finds an optimal table ordering and access plan
// for the tables in the query.
func optimizeJoins(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("construct_join_plan")
	defer span.End()

	if !n.Resolved() {
		return n, transform.SameTree, nil
	}

	if plan.IsNoRowNode(n) {
		return n, transform.SameTree, nil
	}

	_, isUpdate := n.(*plan.Update)

	ret, same, err := inOrderReplanJoin(ctx, a, scope, nil, n, isUpdate, qFlags)
	if err != nil {
		return n, transform.SameTree, err
	}
	if same {
		// try index plans only
		return costedIndexScans(ctx, a, n, qFlags)
	}
	return ret, transform.NewTree, nil
}

// inOrderReplanJoin replans the first join node found
func inOrderReplanJoin(ctx *sql.Context, a *Analyzer, scope *plan.Scope, sch sql.Schema, n sql.Node, isUpdate bool, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if _, ok := n.(sql.OpaqueNode); ok {
		return n, transform.SameTree, nil
	}
	children := n.Children()
	var newChildren []sql.Node
	allSame := transform.SameTree
	j, ok := n.(*plan.JoinNode)
	if !ok {
		for i := range children {
			newChild, same, err := inOrderReplanJoin(ctx, a, scope, sch, children[i], isUpdate, qFlags)
			if err != nil {
				return n, transform.SameTree, err
			}
			if !same {
				if len(newChildren) == 0 {
					newChildren = make([]sql.Node, len(children))
					copy(newChildren, children)
				}
				newChildren[i] = newChild
				allSame = transform.NewTree
			}
		}
		if allSame {
			return n, transform.SameTree, nil
		}
		ret, err := n.WithChildren(newChildren...)
		if err != nil {
			return nil, transform.SameTree, nil
		}
		return ret, transform.NewTree, err
	}

	scope.SetJoin(true)
	scope.SetLateralJoin(j.Op.IsLateral())
	ret, err := replanJoin(ctx, j, a, scope, qFlags)
	if err != nil {
		return nil, transform.SameTree, fmt.Errorf("failed to replan join: %w", err)
	}
	if isUpdate {
		// we pass schema separately because individual nodes do not capture
		// left join nullability
		ret = plan.NewProject(recSchemaToGetFields(n, n.Schema()), ret)
	}
	return ret, transform.NewTree, nil

}

// recSchemaToGetFields creates a set of projection get fields for a node
// considering column ids and left join nullability.
func recSchemaToGetFields(n sql.Node, sch sql.Schema) []sql.Expression {
	if len(n.Schema()) != len(sch) {
		// Projector nodes can return more or fewer columns than child.
		// In this case we will return the subset of get fields with column
		// ids from the child. This does not matter currently for the context
		// this function is used.
		// todo: all projector node columns should have column ids
		sch = n.Schema()
	}
	switch n := n.(type) {
	case *plan.JoinNode:
		switch {
		case n.Op.IsPartial():
			return recSchemaToGetFields(n.Left(), sch[:len(n.Schema())])
		default:
			l := recSchemaToGetFields(n.Left(), sch[:len(n.Left().Schema())])
			r := recSchemaToGetFields(n.Right(), sch[len(n.Left().Schema()):])
			return append(l, r...)
		}
	case plan.TableIdNode:
		return expression.SchemaToGetFields(sch, n.Columns())
	default:
		if plan.IsUnary(n) {
			return recSchemaToGetFields(n.Children()[0], sch)
		}
		return nil
	}
}

func replanJoin(ctx *sql.Context, n *plan.JoinNode, a *Analyzer, scope *plan.Scope, qFlags *sql.QueryFlags) (ret sql.Node, err error) {
	m := memo.NewMemo(ctx, a.Catalog, scope, len(scope.Schema()), a.Coster, qFlags)
	m.Debug = a.Debug

	defer func() {
		if r := recover(); r != nil {
			switch r := r.(type) {
			case memo.MemoErr:
				err = r.Err
				if errors.Is(err, memo.ErrUnsupportedReorderNode) {
					err = nil
					ret = n
				}
			default:
				panic(r)
			}
		}
	}()

	j := memo.NewJoinOrderBuilder(m)
	j.ReorderJoin(n)

	qFlags.Set(sql.QFlagInnerJoin)

	hints := m.SessionHints()
	hints = append(hints, memo.ExtractJoinHint(n)...)

	err = addIndexScans(ctx, m)
	if err != nil {
		return nil, err
	}
	err = convertSemiToInnerJoin(m)
	if err != nil {
		return nil, err
	}
	err = convertAntiToLeftJoin(m)
	if err != nil {
		return nil, err
	}
	err = addRightSemiJoins(ctx, m)
	if err != nil {
		return nil, err
	}

	err = addLookupJoins(ctx, m)
	if err != nil {
		return nil, err
	}

	if !mergeJoinsDisabled(hints) {
		err = addMergeJoins(ctx, m)
		if err != nil {
			return nil, err
		}
	}

	memo.CardMemoGroups(ctx, m.Root())

	err = addCrossHashJoins(m)
	if err != nil {
		return nil, err
	}
	err = addHashJoins(m)
	if err != nil {
		return nil, err
	}
	err = addRangeHeapJoin(m)
	if err != nil {
		return nil, err
	}

	// Once we've enumerated all expression groups, we can apply hints. This must be done after expression
	// groups have been identified, so that the applied hints use the correct metadata.
	for _, h := range hints {
		m.ApplyHint(h)
	}

	err = m.OptimizeRoot()
	if err != nil {
		return nil, err
	}

	if a.Verbose && a.Debug {
		a.Log("%s", m.String())
	}
	if scope != nil {
		scope.JoinTrees = append(scope.JoinTrees, m.String())
	}

	return m.BestRootPlan(ctx)
}

// mergeJoinsDisabled returns true if merge joins have been disabled in the specified |hints|.
func mergeJoinsDisabled(hints []memo.Hint) bool {
	for _, hint := range hints {
		if hint.Typ == memo.HintTypeNoMergeJoin {
			return true
		}
	}
	return false
}

// addLookupJoins prefixes memo join group expressions with indexed join
// alternatives to join plans added by joinOrderBuilder. We can assume that a
// join with a non-nil join filter is not degenerate, and we can apply indexed
// joins for any join plan where the right child is i) an indexable relation,
// ii) with an index that matches a prefix of the indexable relation's free
// attributes in the join filter. Costing is responsible for choosing the most
// appropriate execution plan among options added to an expression group.
func addLookupJoins(ctx *sql.Context, m *memo.Memo) error {
	return memo.DfsRel(m.Root(), func(e memo.RelExpr) error {
		var right *memo.ExprGroup
		var join *memo.JoinBase

		// ANTI_JOIN is not a valid lookup acceptor. We need to tell the
		// difference between when the RHS relation is non-empty (return no
		// rows), vs there are no lookup matches (return rows).
		switch e := e.(type) {
		case *memo.InnerJoin:
			right = e.Right
			join = e.JoinBase
		case *memo.LeftJoin:
			right = e.Right
			join = e.JoinBase
		//TODO fullouterjoin
		case *memo.SemiJoin:
			right = e.Right
			join = e.JoinBase
		default:
			return nil
		}

		if len(join.Filter) == 0 {
			return nil
		}

		tableId, indexes, extraFilters := lookupCandidates(right.First, false)

		var rt sql.TableNode
		var aliasName string
		switch n := right.RelProps.TableIdNodes()[0].(type) {
		case sql.TableNode:
			rt = n
		case *plan.TableAlias:
			var ok bool
			rt, ok = n.Child.(sql.TableNode)
			if !ok {
				return nil
			}
			aliasName = n.Name()
		default:
			return nil
		}

		if or, ok := join.Filter[0].(*expression.Or); ok && len(join.Filter) == 1 {
			// Special case disjoint filter. The execution plan will perform an index
			// lookup for each predicate leaf in the OR tree.
			// TODO: memoize equality expressions, index lookup, concat so that we
			// can consider multiple index options. Otherwise the search space blows
			// up.
			conds := expression.SplitDisjunction(or)
			var concat []*memo.IndexScan
			for _, on := range conds {
				filters := expression.SplitConjunction(on)
				for _, idx := range indexes {
					keyExprs, _, nullmask := keyExprsForIndex(tableId, idx.Cols(), append(filters, extraFilters...))
					if keyExprs != nil {
						ita, err := plan.NewIndexedAccessForTableNode(ctx, rt, plan.NewLookupBuilder(idx.SqlIdx(), keyExprs, nullmask))
						if err != nil {
							return err
						}
						lookup := &memo.IndexScan{
							Table: ita,
							Index: idx,
							Alias: aliasName,
						}
						concat = append(concat, lookup)
						break
					}
				}
			}
			if len(concat) != len(conds) {
				return nil
			}
			m.MemoizeConcatLookupJoin(e.Group(), join.Left, join.Right, join.Op, join.Filter, concat)
			return nil
		}

		for _, idx := range indexes {
			keyExprs, matchedFilters, nullmask := keyExprsForIndex(tableId, idx.Cols(), append(join.Filter, extraFilters...))
			if keyExprs == nil {
				continue
			}
			ita, err := plan.NewIndexedAccessForTableNode(ctx, rt, plan.NewLookupBuilder(idx.SqlIdx(), keyExprs, nullmask))
			if err != nil {
				return err
			}
			lookup := &memo.IndexScan{
				Table: ita,
				Alias: aliasName,
				Index: idx,
			}

			var filters []sql.Expression
			for _, filter := range join.Filter {
				found := false
				for _, matchedFilter := range matchedFilters {
					if filter == matchedFilter {
						found = true
					}
				}
				if !found {
					filters = append(filters, filter)
				}
			}

			m.MemoizeLookupJoin(e.Group(), join.Left, join.Right, join.Op, filters, lookup)
		}
		return nil
	})
}

// keyExprsForIndex returns a list of expression groups that compute a lookup
// key into the given index. The key fields will either be equality filters
// (from ON conditions) or constants.
func keyExprsForIndex(tableId sql.TableId, idxExprs []sql.ColumnId, filters []sql.Expression) (keyExprs, matchedFilters []sql.Expression, nullmask []bool) {
	for _, col := range idxExprs {
		key, filter, nullable := keyForExpr(col, tableId, filters)
		if key == nil {
			break
		}
		keyExprs = append(keyExprs, key)
		matchedFilters = append(matchedFilters, filter)
		nullmask = append(nullmask, nullable)
	}
	if len(keyExprs) == 0 {
		return nil, nil, nil
	}
	return keyExprs, matchedFilters, nullmask
}

// keyForExpr returns an equivalence or constant value to satisfy the
// lookup index expression.
func keyForExpr(targetCol sql.ColumnId, tableId sql.TableId, filters []sql.Expression) (key sql.Expression, filter sql.Expression, nullable bool) {
	for _, f := range filters {
		var left sql.Expression
		var right sql.Expression
		switch e := f.(type) {
		case *expression.Equals:
			left = e.Left()
			right = e.Right()
		case *expression.NullSafeEquals:
			nullable = true
			left = e.Left()
			right = e.Right()
		default:
			if e, ok := e.(expression.Equality); ok && e.RepresentsEquality() {
				left = e.Left()
				right = e.Right()
			}
		}
		if ref, ok := left.(*expression.GetField); ok && ref.Id() == targetCol {
			key = right
		} else if ref, ok := right.(*expression.GetField); ok && ref.Id() == targetCol {
			key = left
		} else {
			continue
		}

		if sq, ok := key.(*plan.Subquery); ok && !sq.Correlated().Empty() {
			continue
		}

		// expression key can be arbitrarily complex (or simple), but cannot
		// reference the lookup table
		if !exprRefsTable(key, tableId) {
			return key, f, nullable
		}
	}
	return nil, nil, false
}

func exprRefsTable(e sql.Expression, tableId sql.TableId) bool {
	return transform.InspectExpr(e, func(e sql.Expression) bool {
		gf, _ := e.(*expression.GetField)
		if gf != nil {
			return gf.TableId() == tableId
		}
		return false
	})
}

// convertSemiToInnerJoin adds inner join alternatives for semi joins.
// The inner join plans can be explored (optimized) further.
// Example: semiJoin(xy ab) => project(xy) -> innerJoin(xy, distinct(ab))
// Ref section 2.1.1 of:
// https://www.researchgate.net/publication/221311318_Cost-Based_Query_Transformation_in_Oracle
// TODO: need more elegant way to extend the number of groups, interner
func convertSemiToInnerJoin(m *memo.Memo) error {
	return memo.DfsRel(m.Root(), func(e memo.RelExpr) error {
		semi, ok := e.(*memo.SemiJoin)
		if !ok {
			return nil
		}

		rightOutTables := semi.Right.RelProps.OutputTables()
		var projectExpressions []sql.Expression
		var err error
		for _, f := range semi.Filter {
			if transform.InspectExpr(f, func(e sql.Expression) bool {
				switch e := e.(type) {
				case *expression.GetField:
					if rightOutTables.Contains(int(e.TableId())) {
						projectExpressions = append(projectExpressions, e)
					}
				case *expression.Literal, *expression.And, *expression.Or, *expression.Equals, *expression.Arithmetic, *expression.BindVar, expression.Tuple:
				default:
					if _, ok := e.(expression.Equality); !ok {
						return true
					}
				}
				return false
			}) {
				return err
			}
		}
		if len(projectExpressions) == 0 {
			p := expression.NewLiteral(1, types.Int64)
			projectExpressions = append(projectExpressions, p)
		}

		var rightGrp *memo.ExprGroup
		if _, ok := semi.Right.First.(*memo.Distinct); ok {
			rightGrp = m.MemoizeProject(nil, semi.Right, projectExpressions)
		} else {
			rightGrp = m.MemoizeDistinctProject(nil, semi.Right, projectExpressions)
		}

		// join and its commute are a new group
		joinGrp := m.MemoizeInnerJoin(nil, semi.Left, rightGrp, plan.JoinTypeInner, semi.Filter)
		// TODO: can't commute if right SubqueryAlias references outside scope (OuterScopeVisibility/IsLateral)
		m.MemoizeInnerJoin(joinGrp, rightGrp, semi.Left, plan.JoinTypeInner, semi.Filter)

		// project belongs to the original group
		leftCols := semi.Left.RelProps.OutputCols()
		var projections []sql.Expression
		for colId, hasNext := leftCols.Next(1); hasNext; colId, hasNext = leftCols.Next(colId + 1) {
			var srcNode plan.TableIdNode
			for _, n := range semi.Left.RelProps.TableIdNodes() {
				if n.Columns().Contains(colId) {
					srcNode = n
					break
				}
			}
			if srcNode == nil {
				break
			}

			sch := srcNode.Schema()
			var table sql.Table
			if tw, ok := srcNode.(sql.TableNode); ok {
				table = tw.UnderlyingTable()
			}
			if pkt, ok := table.(sql.PrimaryKeyTable); ok {
				sch = pkt.PrimaryKeySchema().Schema
			}

			firstCol, _ := srcNode.Columns().Next(1)
			idx := int(colId - firstCol)
			col := sch[idx]

			projections = append(projections, expression.NewGetFieldWithTable(int(colId), int(srcNode.Id()), col.Type, col.DatabaseSource, col.Source, col.Name, col.Nullable))

		}

		if len(projections) == 0 {
			p := expression.NewLiteral(1, types.Int64)
			projections = []sql.Expression{p}
		}

		m.MemoizeProject(e.Group(), joinGrp, projections)

		return nil
	})
}

// convertAntiToLeftJoin adds left join alternatives for anti join
// ANTI_JOIN(left, right) => PROJECT(left sch) -> FILTER(right attr IS NULL) -> LEFT_JOIN(left, right)
func convertAntiToLeftJoin(m *memo.Memo) error {
	return memo.DfsRel(m.Root(), func(e memo.RelExpr) error {
		anti, ok := e.(*memo.AntiJoin)
		if !ok {
			return nil
		}

		rightOutTables := anti.Right.RelProps.OutputTables()
		var projectExpressions []sql.Expression
		var nullify []sql.Expression
		var err error
		for _, f := range anti.Filter {
			if transform.InspectExpr(f, func(e sql.Expression) bool {
				switch e := e.(type) {
				case *expression.GetField:
					if rightOutTables.Contains(int(e.TableId())) {
						projectExpressions = append(projectExpressions, e)
						nullify = append(nullify, e)
					}
				case *expression.Literal, *expression.And, *expression.Or, *expression.Equals, *expression.Arithmetic, *expression.BindVar, expression.Tuple:
				default:
					if _, ok := e.(expression.Equality); !ok {
						return true
					}
				}
				return false
			}) {
				return err
			}
		}
		if len(projectExpressions) == 0 {
			p := expression.NewLiteral(1, types.Int64)
			projectExpressions = append(projectExpressions, p)
			gf := expression.NewGetField(0, types.Int64, "1", true)
			nullify = append(nullify, gf)
		}
		// project is a new group
		rightGrp := m.MemoizeProject(nil, anti.Right, projectExpressions)

		// join is a new group
		joinType := plan.JoinTypeLeftOuter
		if anti.Op.IsExcludeNulls() {
			joinType = plan.JoinTypeLeftOuterExcludeNulls
		}
		joinGrp := m.MemoizeLeftJoin(nil, anti.Left, rightGrp, joinType, anti.Filter)

		// drop null projected columns on right table
		nullFilters := make([]sql.Expression, len(nullify))
		for i, e := range nullify {
			nullFilters[i] = expression.DefaultExpressionFactory.NewIsNull(e)
		}

		filterGrp := m.MemoizeFilter(nil, joinGrp, nullFilters)

		// project belongs to the original group
		leftCols := anti.Left.RelProps.OutputCols()
		var projections []sql.Expression
		for colId, hasNext := leftCols.Next(1); hasNext; colId, hasNext = leftCols.Next(colId + 1) {
			// we have ids and need to get the table back?
			// search in tables
			var srcNode plan.TableIdNode
			for _, n := range anti.Left.RelProps.TableIdNodes() {
				if n.Columns().Contains(colId) {
					srcNode = n
					break
				}
			}
			if srcNode == nil {
				break
			}

			sch := srcNode.Schema()
			var table sql.Table
			var node sql.Node = srcNode
			if ta, ok := node.(*plan.TableAlias); ok {
				node = ta.Child
			}
			if tw, ok := node.(sql.TableNode); ok {
				table = tw.UnderlyingTable()
			}
			if pkt, ok := table.(sql.PrimaryKeyTable); ok {
				sch = pkt.PrimaryKeySchema().Schema
			}

			firstCol, _ := srcNode.Columns().Next(1)
			idx := int(colId - firstCol)
			col := sch[idx]

			projections = append(projections, expression.NewGetFieldWithTable(int(colId), int(srcNode.Id()), col.Type, col.DatabaseSource, col.Source, col.Name, col.Nullable))
		}

		if len(projections) == 0 {
			p := expression.NewLiteral(1, types.Int64)
			projections = []sql.Expression{p}
		}

		m.MemoizeProject(e.Group(), filterGrp, projections)

		return nil
	})
}

// addRightSemiJoins allows for a reversed semiJoin operator when
// the join attributes of the left side are provably unique.
func addRightSemiJoins(ctx *sql.Context, m *memo.Memo) error {
	return memo.DfsRel(m.Root(), func(e memo.RelExpr) error {
		semi, ok := e.(*memo.SemiJoin)
		if !ok {
			return nil
		}

		if len(semi.Filter) == 0 {
			return nil
		}
		tableId, indexes, filters := lookupCandidates(semi.Left.First, false)
		leftTab := semi.Left.RelProps.TableIdNodes()[0]
		var aliasName string
		var leftRt sql.TableNode
		switch n := leftTab.(type) {
		case *plan.TableAlias:
			aliasName = n.Name()
			leftRt = n.Child.(sql.TableNode)
		case sql.TableNode:
			leftRt = n
		}

		rightOutTables := semi.Right.RelProps.OutputTables()

		var projectExpressions []sql.Expression
		var err error
		for _, f := range semi.Filter {
			if transform.InspectExpr(f, func(e sql.Expression) bool {
				switch e := e.(type) {
				case *expression.GetField:
					if rightOutTables.Contains(int(e.TableId())) {
						projectExpressions = append(projectExpressions, e)
					}
				case *expression.Literal, *expression.And, *expression.Or, *expression.Equals, *expression.Arithmetic, *expression.BindVar:
				default:
					if _, ok := e.(expression.Equality); !ok {
						return true
					}
				}
				return false
			}) {
				return err
			}
		}

		for _, idx := range indexes {
			if !semi.Group().RelProps.FuncDeps().ColsAreStrictKey(idx.ColSet()) {
				continue
			}

			keyExprs, _, nullmask := keyExprsForIndex(tableId, idx.Cols(), append(semi.Filter, filters...))
			if keyExprs == nil {
				continue
			}

			rGroup := m.MemoizeProject(nil, semi.Right, projectExpressions)
			if _, ok := semi.Right.First.(*memo.Distinct); !ok {
				rGroup.RelProps.Distinct = memo.HashDistinctOp
			}

			ita, err := plan.NewIndexedAccessForTableNode(ctx, leftRt, plan.NewLookupBuilder(idx.SqlIdx(), keyExprs, nullmask))
			if err != nil {
				return err
			}

			lookup := &memo.IndexScan{
				Table: ita,
				Alias: aliasName,
				Index: idx,
			}
			m.MemoizeLookupJoin(e.Group(), rGroup, semi.Left, plan.JoinTypeLookup, semi.Filter, lookup)
		}
		return nil
	})
}

// lookupCandidates extracts source relation information required to check for
// index lookups, including the source relation TableId, the list of Indexes,
// and the list of table filters.
func lookupCandidates(rel memo.RelExpr, limitOk bool) (sql.TableId, []*memo.Index, []sql.Expression) {
	id, indexes, filters, _ := dfsLookupCandidates(rel, limitOk)
	return id, indexes, filters
}

func dfsLookupCandidates(rel memo.RelExpr, limitOk bool) (sql.TableId, []*memo.Index, []sql.Expression, bool) {
	if rel == nil {
		return 0, nil, nil, false
	}
	if !limitOk && rel.Group().RelProps.Limit != nil {
		// LOOKUP through a LIMIT is invalid
		return 0, nil, nil, false
	}
	for n := rel; n != nil; n = n.Next() {
		switch n := n.(type) {
		case *memo.TableAlias:
			tabId, _ := n.Group().RelProps.OutputTables().Next(1)
			return sql.TableId(tabId), n.Indexes(), nil, true
		case *memo.TableScan:
			tabId, _ := n.Group().RelProps.OutputTables().Next(1)
			return sql.TableId(tabId), n.Indexes(), nil, true
		case *memo.IndexScan:
			// The presence of an indexScan suggests that there is a valid
			// table lookup, but returning here would fail to return filters
			// that have been pushed into the indexScan. Continue until we
			// find the full Filter->Tablescan path.
			continue
		case *memo.Filter:
			id, indexes, filters, ok := dfsLookupCandidates(n.Child.First, limitOk)
			if ok {
				return id, indexes, append(filters, n.Filters...), ok
			}
		case *memo.Distinct:
			return dfsLookupCandidates(n.Child.First, limitOk)
		case *memo.Project:
			return dfsLookupCandidates(n.Child.First, limitOk)
		default:
		}
	}
	return 0, nil, nil, false
}

func addCrossHashJoins(m *memo.Memo) error {
	return memo.DfsRel(m.Root(), func(e memo.RelExpr) error {
		switch e.(type) {
		case *memo.CrossJoin:
		default:
			return nil
		}

		join := e.(memo.JoinRel).JoinPrivate()
		if len(join.Filter) > 0 {
			return nil
		}

		// Only apply cross hash join if there is a subquery alias in the group.
		hasSqa := false
		for _, tbl := range e.Group().RelProps.TableIdNodes() {
			if _, ok := tbl.(*plan.SubqueryAlias); ok {
				hasSqa = true
				break
			}
		}
		if !hasSqa {
			return nil
		}

		rel := &memo.HashJoin{
			JoinBase:   join.Copy(),
			LeftAttrs:  nil,
			RightAttrs: nil,
		}
		rel.Op = rel.Op.AsHash()
		e.Group().Prepend(rel)
		return nil
	})
}

func addHashJoins(m *memo.Memo) error {
	return memo.DfsRel(m.Root(), func(e memo.RelExpr) error {
		switch e.(type) {
		case *memo.InnerJoin, *memo.LeftJoin:
		default:
			return nil
		}

		join := e.(memo.JoinRel).JoinPrivate()
		if len(join.Filter) == 0 {
			return nil
		}

		var fromExpr, toExpr []sql.Expression
		for _, f := range join.Filter {
			switch f := f.(type) {
			case *expression.Equals:
				if satisfiesScalarRefs(f.Left(), join.Left.RelProps.OutputTables()) &&
					satisfiesScalarRefs(f.Right(), join.Right.RelProps.OutputTables()) {
					fromExpr = append(fromExpr, f.Right())
					toExpr = append(toExpr, f.Left())
				} else if satisfiesScalarRefs(f.Right(), join.Left.RelProps.OutputTables()) &&
					satisfiesScalarRefs(f.Left(), join.Right.RelProps.OutputTables()) {
					fromExpr = append(fromExpr, f.Left())
					toExpr = append(toExpr, f.Right())
				} else {
					return nil
				}
			default:
				return nil
			}
		}
		switch join.Right.First.(type) {
		case *memo.RecursiveTable:
			return nil
		}

		m.MemoizeHashJoin(e.Group(), join, toExpr, fromExpr)
		return nil
	})
}

type rangeFilter struct {
	value, min, max                        sql.Expression
	closedOnLowerBound, closedOnUpperBound bool
}

// getRangeFilters takes the filter expressions on a join and identifies "ranges" where a given expression
// is constrained between two other expressions. (For instance, detecting "x > 5" and "x <= 10" and creating a range
// object representing "5 < x <= 10". See range_filter_test.go for examples.
func getRangeFilters(filters []sql.Expression) (ranges []rangeFilter) {
	type candidateMap struct {
		group    sql.Expression
		isClosed bool
	}
	lowerToUpper := make(map[string][]candidateMap)
	upperToLower := make(map[string][]candidateMap)

	findUpperBounds := func(value, min sql.Expression, closedOnLowerBound bool) {
		for _, max := range lowerToUpper[value.String()] {
			ranges = append(ranges, rangeFilter{
				value:              value,
				min:                min,
				max:                max.group,
				closedOnLowerBound: closedOnLowerBound,
				closedOnUpperBound: max.isClosed})
		}
	}

	findLowerBounds := func(value, max sql.Expression, closedOnUpperBound bool) {
		for _, min := range upperToLower[value.String()] {
			ranges = append(ranges, rangeFilter{
				value:              value,
				min:                min.group,
				max:                max,
				closedOnLowerBound: min.isClosed,
				closedOnUpperBound: closedOnUpperBound})
		}
	}

	addBounds := func(lower, upper sql.Expression, isClosed bool) {
		lowerStr := lower.String()
		lowerToUpper[lowerStr] = append(lowerToUpper[lowerStr], candidateMap{
			group:    upper,
			isClosed: isClosed,
		})
		upperStr := upper.String()
		upperToLower[upperStr] = append(upperToLower[upperStr], candidateMap{
			group:    lower,
			isClosed: isClosed,
		})
	}

	for _, filter := range filters {
		switch f := filter.(type) {
		case *expression.Between:
			ranges = append(ranges, rangeFilter{f.Val, f.Lower, f.Upper, true, true})
		case *expression.GreaterThan:
			findUpperBounds(f.Left(), f.Right(), false)
			findLowerBounds(f.Right(), f.Left(), false)
			addBounds(f.Right(), f.Left(), false)
		case *expression.GreaterThanOrEqual:
			findUpperBounds(f.Left(), f.Right(), true)
			findLowerBounds(f.Right(), f.Left(), true)
			addBounds(f.Right(), f.Left(), true)
		case *expression.LessThan:
			findLowerBounds(f.Left(), f.Right(), false)
			findUpperBounds(f.Right(), f.Left(), false)
			addBounds(f.Left(), f.Right(), false)
		case *expression.LessThanOrEqual:
			findLowerBounds(f.Left(), f.Right(), true)
			findUpperBounds(f.Right(), f.Left(), true)
			addBounds(f.Left(), f.Right(), true)
		}
	}
	return ranges
}

// addRangeHeapJoin checks whether the join can be implemented as a RangeHeap, and if so, prefixes a memo.RangeHeap plan
// to the memo join group. We can apply a range heap join for any join plan where a filter (or pair of filters) restricts a column the left child
// to be between two columns the right child.
//
// Some example joins that can be implemented as RangeHeap joins:
// - SELECT * FROM a JOIN b on a.value BETWEEN b.min AND b.max
// - SELECT * FROM a JOIN b on b.min <= a.value AND a.value < b.max
func addRangeHeapJoin(m *memo.Memo) error {
	return memo.DfsRel(m.Root(), func(e memo.RelExpr) error {
		switch e.(type) {
		case *memo.InnerJoin, *memo.LeftJoin:
		default:
			return nil
		}

		join := e.(memo.JoinRel).JoinPrivate()

		// TODO: allow joins over filters
		switch join.Right.First.(type) {
		case *memo.TableScan, *memo.TableAlias, *memo.SubqueryAlias:
		default:
			return nil
		}

		_, lIndexes, lFilters := lookupCandidates(join.Left.First, true)
		_, rIndexes, rFilters := lookupCandidates(join.Right.First, true)

		leftTab := join.Left.RelProps.TableIdNodes()[0]
		rightTab := join.Right.RelProps.TableIdNodes()[0]

		for _, filter := range getRangeFilters(join.Filter) {
			if !(satisfiesScalarRefs(filter.value, join.Left.RelProps.OutputTables()) &&
				satisfiesScalarRefs(filter.min, join.Right.RelProps.OutputTables()) &&
				satisfiesScalarRefs(filter.max, join.Right.RelProps.OutputTables())) {
				return nil
			}
			// For now, only match expressions that are exactly a column reference.
			// TODO: We may be able to match more complicated expressions if they meet the necessary criteria, such as:
			// - References exactly one column
			// - Is monotonically increasing
			valueColRef, ok := filter.value.(*expression.GetField)
			if !ok {
				return nil
			}
			minColRef, ok := filter.min.(*expression.GetField)
			if !ok {
				return nil
			}
			maxColRef, ok := filter.max.(*expression.GetField)
			if !ok {
				return nil
			}

			leftIndexScans, err := sortedIndexScansForTableCol(m.Ctx, m.StatsProvider(), leftTab, lIndexes, valueColRef, join.Left.RelProps.FuncDeps().Constants(), lFilters)
			if err != nil {
				return err
			}
			if leftIndexScans == nil {
				leftIndexScans = []*memo.IndexScan{nil}
			}
			for _, lIdx := range leftIndexScans {
				rightIndexScans, err := sortedIndexScansForTableCol(m.Ctx, m.StatsProvider(), rightTab, rIndexes, minColRef, join.Right.RelProps.FuncDeps().Constants(), rFilters)
				if err != nil {
					return err
				}
				if rightIndexScans == nil {
					rightIndexScans = []*memo.IndexScan{nil}
				}
				for _, rIdx := range rightIndexScans {
					rel := &memo.RangeHeapJoin{
						JoinBase: join.Copy(),
					}
					rel.RangeHeap = &memo.RangeHeap{
						ValueIndex:              lIdx,
						MinIndex:                rIdx,
						ValueExpr:               filter.value,
						MinExpr:                 filter.min,
						ValueCol:                valueColRef,
						MinColRef:               minColRef,
						MaxColRef:               maxColRef,
						Parent:                  rel.JoinBase,
						RangeClosedOnLowerBound: filter.closedOnLowerBound,
						RangeClosedOnUpperBound: filter.closedOnUpperBound,
					}
					rel.Op = rel.Op.AsRangeHeap()
					e.Group().Prepend(rel)
				}
			}
		}
		return nil
	})
}

// satisfiesScalarRefs returns true if all GetFields in the expression
// are columns provided by |tables|
func satisfiesScalarRefs(e sql.Expression, tables sql.FastIntSet) bool {
	// |grp| provides all tables referenced in |e|
	return !transform.InspectExpr(e, func(e sql.Expression) bool {
		gf, _ := e.(*expression.GetField)
		if gf != nil {
			if !tables.Contains(int(gf.TableId())) {
				return true
			}
		}
		return false
	})
}

// addMergeJoins will add merge join operators to join relations
// with native indexes providing sort enforcement on an equality
// filter.
// TODO: sort-merge joins
func addMergeJoins(ctx *sql.Context, m *memo.Memo) error {
	return memo.DfsRel(m.Root(), func(e memo.RelExpr) error {
		var join *memo.JoinBase
		switch e := e.(type) {
		case *memo.InnerJoin:
			join = e.JoinBase
		case *memo.LeftJoin:
			join = e.JoinBase
			//TODO semijoin, antijoin, fullouterjoin
		default:
			return nil
		}

		if len(join.Filter) == 0 {
			return nil
		}

		leftTabId, lIndexes, lFilters := lookupCandidates(join.Left.First, true)
		rightTabId, rIndexes, rFilters := lookupCandidates(join.Right.First, true)

		if leftTabId == 0 || rightTabId == 0 {
			return nil
		}

		leftTab := join.Left.RelProps.TableIdNodes()[0]
		rightTab := join.Right.RelProps.TableIdNodes()[0]

		eqFilters := make([]filterAndPosition, 0, len(join.Filter))
		for filterPos, filter := range join.Filter {
			switch eq := filter.(type) {
			case expression.Equality:
				if !eq.RepresentsEquality() {
					continue
				}
				l := eq.Left()
				r := eq.Right()

				if !expressionReferencesOneColumn(l) ||
					!expressionReferencesOneColumn(r) {
					continue
				}

				// check that comparer is not non-decreasing
				if !isWeaklyMonotonic(l) || !isWeaklyMonotonic(r) {
					continue
				}

				var swap bool
				if expressionReferencesTable(l, leftTabId) &&
					expressionReferencesTable(r, rightTabId) {

				} else if expressionReferencesTable(r, leftTabId) &&
					expressionReferencesTable(l, rightTabId) {
					swap = true
					l, r = r, l
				} else {
					continue
				}

				if swap {
					swappedExpr, err := eq.SwapParameters(ctx)
					if err != nil {
						return err
					}
					eqFilters = append(eqFilters, filterAndPosition{swappedExpr, filterPos})
				} else {
					eqFilters = append(eqFilters, filterAndPosition{eq, filterPos})
				}
			default:
				continue
			}
		}

		// For each lIndex:
		// Compute the max set of filter expressions that match that index
		// While matchedFilters is not empty:
		//    Check to see if any rIndexes match that set of filters
		//    Remove the last matched filter
		for _, lIndex := range lIndexes {
			if lIndex.Order() == sql.IndexOrderNone {
				// lookups can be unordered, merge indexes need to
				// be globally ordered
				continue
			}

			matchedEqFilters := matchedFiltersForLeftIndex(lIndex, join.Left.RelProps.FuncDeps().Constants(), eqFilters)
			for len(matchedEqFilters) > 0 {
				for _, rIndex := range rIndexes {
					if rIndex.Order() == sql.IndexOrderNone {
						continue
					}
					if rightIndexMatchesFilters(rIndex, join.Left.RelProps.FuncDeps().Constants(), matchedEqFilters) {
						jb := join.Copy()
						if d, ok := jb.Left.First.(*memo.Distinct); ok && lIndex.SqlIdx().IsUnique() {
							jb.Left = d.Child
						}
						if d, ok := jb.Right.First.(*memo.Distinct); ok && rIndex.SqlIdx().IsUnique() {
							jb.Right = d.Child
						}
						var compare sql.Expression
						if len(matchedEqFilters) > 1 {
							compare = combineIntoTuple(m, matchedEqFilters)
						} else {
							compare = matchedEqFilters[0].filter

						}
						newFilters := []sql.Expression{compare}
						for filterPos, filter := range join.Filter {
							found := false
							for _, filterAndPos := range matchedEqFilters {
								if filterAndPos.pos == filterPos {
									found = true
								}
							}
							if !found {
								newFilters = append(newFilters, filter)
							}
						}

						// To make the index scan, we need the first non-constant column in each index.
						leftColId := getOnlyColumnId(matchedEqFilters[0].filter.Left())
						rightColId := getOnlyColumnId(matchedEqFilters[0].filter.Right())
						lIndexScan, success, err := makeIndexScan(m.Ctx, m.StatsProvider(), leftTab, lIndex, leftColId, lFilters)
						if err != nil {
							return err
						}
						if !success {
							continue
						}
						rIndexScan, success, err := makeIndexScan(m.Ctx, m.StatsProvider(), rightTab, rIndex, rightColId, rFilters)
						if err != nil {
							return err
						}
						if !success {
							continue
						}
						m.MemoizeMergeJoin(e.Group(), join.Left, join.Right, lIndexScan, rIndexScan, jb.Op.AsMerge(), newFilters, false)
					}
				}
				matchedEqFilters = matchedEqFilters[:len(matchedEqFilters)-1]
			}
		}
		return nil
	})
}

// getOnlyColumnId returns the id of the only column referenced in an expression group. We only call this
// on expressions that are already verified to have exactly one referenced column.
func getOnlyColumnId(e sql.Expression) sql.ColumnId {
	var id sql.ColumnId
	transform.InspectExpr(e, func(e sql.Expression) bool {
		gf, ok := e.(*expression.GetField)
		if ok {
			id = gf.Id()
			return true
		}
		return false
	})
	return id
}

func expressionReferencesOneColumn(e sql.Expression) bool {
	var seen bool
	return !transform.InspectExpr(e, func(e sql.Expression) bool {
		_, ok := e.(*expression.GetField)
		if ok && seen {
			return true
		}
		seen = true
		return false
	})
}

func expressionReferencesTable(e sql.Expression, id sql.TableId) bool {
	return transform.InspectExpr(e, func(e sql.Expression) bool {
		gf, ok := e.(*expression.GetField)
		return ok && gf.TableId() == id
	})
}

func combineIntoTuple(m *memo.Memo, filters []filterAndPosition) *expression.Equals {
	var lFilters []sql.Expression
	var rFilters []sql.Expression

	for _, filter := range filters {
		lFilters = append(lFilters, filter.filter.Left())
		rFilters = append(rFilters, filter.filter.Right())
	}

	lGroup := expression.NewTuple(lFilters...)
	rGroup := expression.NewTuple(rFilters...)

	return expression.NewEquals(lGroup, rGroup)
}

// rightIndexMatchesFilters checks whether the provided rIndex is a candidate for a merge join on the provided filters.
// The index must have a prefix consisting entirely of constants and the provided filters in order.
func rightIndexMatchesFilters(rIndex *memo.Index, constants sql.ColSet, filters []filterAndPosition) bool {
	if filters == nil {
		return true
	}
	columnIds := rIndex.Cols()
	columnPos := 0
	filterPos := 0
	for {
		if columnPos >= len(columnIds) {
			// There are still unmatched filters: this filter is not a prefix on the index
			return false
		}
		matched := false
		for getOnlyColumnId(filters[filterPos].filter.Right()) == columnIds[columnPos] {
			matched = true
			filterPos++
			if filterPos >= len(filters) {
				// every filter matched: this filter is a prefix on the index
				return true
			}
		}
		if !matched {
			if constants.Contains(columnIds[columnPos]) {
				// column is constant, it can be used in the prefix.
				columnPos++
				continue
			}
			return false
		}
		columnPos++
	}
}

// filterAndPosition stores a filter on a join, along with that filter's original index.
type filterAndPosition struct {
	filter expression.Equality
	pos    int
}

// matchedFiltersForLeftIndex computes the maximum-length prefix for an index where every column is matched by the supplied
// constants and scalar expressions.
func matchedFiltersForLeftIndex(lIndex *memo.Index, constants sql.ColSet, filters []filterAndPosition) (matchedFilters []filterAndPosition) {
	for _, idxCol := range lIndex.Cols() {
		if constants.Contains(idxCol) {
			// column is constant, it can be used in the prefix.
			continue
		}
		found := false
		for _, filter := range filters {
			if getOnlyColumnId(filter.filter.Left()) == idxCol {
				matchedFilters = append(matchedFilters, filter)
				found = true
				break
			}
		}
		if !found {
			return matchedFilters
		}
	}
	return matchedFilters
}

// sortedIndexScanForTableCol returns the first indexScan found for a relation
// that provide a prefix for the joinFilters rel free attribute. I.e. the
// indexScan will return the same rows as the rel, but sorted by |col|.
func sortedIndexScansForTableCol(ctx *sql.Context, statsProv sql.StatsProvider, tab plan.TableIdNode, indexes []*memo.Index, targetCol *expression.GetField, constants sql.ColSet, filters []sql.Expression) (ret []*memo.IndexScan, err error) {
	// valid index prefix is (constants..., targetCol)
	for _, idx := range indexes {
		found := false
		var matchedIdx sql.ColumnId
		for _, idxCol := range idx.Cols() {
			if constants.Contains(idxCol) {
				// idxCol constant OK
				continue
			}
			if idxCol == targetCol.Id() {
				found = true
				matchedIdx = idxCol
			} else {
				break
			}
		}
		if !found {
			continue
		}
		indexScan, success, err := makeIndexScan(ctx, statsProv, tab, idx, matchedIdx, filters)
		if err != nil {
			return nil, err
		}
		if success {
			ret = append(ret, indexScan)
		}
	}
	return ret, nil
}

func makeIndexScan(ctx *sql.Context, statsProv sql.StatsProvider, tab plan.TableIdNode, idx *memo.Index, matchedIdx sql.ColumnId, filters []sql.Expression) (*memo.IndexScan, bool, error) {
	rang := make(sql.MySQLRange, len(idx.Cols()))
	var j int
	for {
		found := idx.Cols()[j] == matchedIdx
		var lit *expression.Literal
		for _, f := range filters {
			if eq, ok := f.(expression.Equality); ok {
				if l, ok := eq.Left().(*expression.GetField); ok && l.Id() == idx.Cols()[j] {
					lit, _ = eq.Right().(*expression.Literal)
				}
				if r, ok := eq.Right().(*expression.GetField); ok && r.Id() == idx.Cols()[j] {
					lit, _ = eq.Left().(*expression.Literal)
				}
				if lit != nil {
					break
				}
			}
		}
		if found && lit == nil {
			break
		}
		rang[j] = sql.ClosedRangeColumnExpr(lit.Value(), lit.Value(), idx.SqlIdx().ColumnExpressionTypes()[j].Type)
		j++
		if found {
			break
		}
	}
	for j < len(idx.Cols()) {
		// all range bound Compare() is type insensitive
		rang[j] = sql.AllRangeColumnExpr(types.Null)
		j++
	}

	if !idx.SqlIdx().CanSupport(ctx, rang) {
		return nil, false, nil
	}

	for i, typ := range idx.SqlIdx().ColumnExpressionTypes() {
		if !types.Null.Equals(rang[i].Typ) && !typ.Type.Equals(rang[i].Typ) {
			return nil, false, nil
		}
	}

	l := sql.IndexLookup{Index: idx.SqlIdx(), Ranges: sql.MySQLRangeCollection{rang}}

	var tn sql.TableNode
	var alias string
	switch n := tab.(type) {
	case sql.TableNode:
		tn = n
	case *plan.TableAlias:
		child := n.Child
		alias = n.Name()
		var ok bool
		tn, ok = child.(sql.TableNode)
		if !ok {
			return nil, false, fmt.Errorf("expected child of TableAlias to be sql.TableNode, found: %T", child)
		}
	default:
		return nil, false, fmt.Errorf("expected sql.TableNode, found: %T", n)
	}

	ret, err := plan.NewStaticIndexedAccessForTableNode(ctx, tn, l)
	if err != nil {
		return nil, false, err
	}

	var cols []string
	tablePrefix := fmt.Sprintf("%s.", tn.Name())
	for _, e := range idx.SqlIdx().Expressions() {
		cols = append(cols, strings.TrimPrefix(e, tablePrefix))
	}
	var schemaName string
	if schTab, ok := tn.(sql.DatabaseSchemaTable); ok {
		schemaName = strings.ToLower(schTab.DatabaseSchema().SchemaName())
	}

	stats, _ := statsProv.GetStats(ctx, sql.NewStatQualifier(tn.Database().Name(), schemaName, tn.Name(), idx.SqlIdx().ID()), cols)
	return &memo.IndexScan{
		Table: ret,
		Index: idx,
		Alias: alias,
		Stats: stats,
	}, true, nil
}

// isWeaklyMonotonic is a weak test of whether an expression
// will be strictly increasing as the value of column attribute
// inputs increases.
//
// The simplest example is `x`, which will increase
// as `x` increases, and decrease as `x` decreases.
//
// An example of a non-monotonic expression is `mod(x, 4)`,
// which is strictly non-increasing from x=3 -> x=4.
//
// A non-obvious non-monotonic function is `x+y`. The index `(x,y)`
// will be non-increasing on (y), and so `x+y` can decrease.
// TODO: stricter monotonic check
func isWeaklyMonotonic(e sql.Expression) bool {
	return !transform.InspectExpr(e, func(e sql.Expression) bool {
		switch e := e.(type) {
		case expression.ArithmeticOp:
			if e.Operator() == "-" {
				// TODO minus can be OK if it's not on the GetField
				return true
			}
			return false
		case *expression.Equals, *expression.NullSafeEquals, *expression.Literal, *expression.GetField,
			*expression.Tuple, *expression.BindVar, sql.IsNullExpression, sql.IsNotNullExpression:
			return false
		default:
			if e, ok := e.(expression.Equality); ok && e.RepresentsEquality() {
				return false
			}
			return true
		}
	})
}
