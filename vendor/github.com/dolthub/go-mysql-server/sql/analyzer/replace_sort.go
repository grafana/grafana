package analyzer

import (
	"strings"

	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function/aggregation"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// replaceIdxSort applies an IndexAccess when there is an `OrderBy` over a prefix of any columns with Indexes
func replaceIdxSort(ctx *sql.Context, a *Analyzer, n sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	return replaceIdxSortHelper(ctx, scope, n, nil)
}

func replaceIdxSortHelper(ctx *sql.Context, scope *plan.Scope, node sql.Node, sortNode *plan.Sort) (sql.Node, transform.TreeIdentity, error) {
	switch n := node.(type) {
	case *plan.Sort:
		if isValidSortFieldOrder(n.SortFields) {
			sortNode = n // lowest parent sort node
		}
	case *plan.IndexedTableAccess:
		if sortNode == nil {
			return n, transform.SameTree, nil
		}
		if !n.IsStatic() {
			return n, transform.SameTree, nil
		}
		lookup, err := n.GetLookup(ctx, nil)
		if err != nil {
			return nil, transform.SameTree, err
		}
		tableAliases, err := getTableAliases(sortNode, scope)
		if err != nil {
			return n, transform.SameTree, nil
		}
		sfExprs := normalizeExpressions(tableAliases, sortNode.SortFields.ToExpressions()...)
		sfAliases := aliasedExpressionsInNode(sortNode)
		if !isSortFieldsValidPrefix(sfExprs, sfAliases, lookup.Index.Expressions()) {
			return n, transform.SameTree, nil
		}
		mysqlRanges, ok := lookup.Ranges.(sql.MySQLRangeCollection)
		if !ok {
			return n, transform.SameTree, nil
		}
		// if the resulting ranges are overlapping, we cannot drop the sort node
		// it is possible we end up with blocks of rows that intersect
		if hasOverlapping(sfExprs, mysqlRanges) {
			return n, transform.SameTree, nil
		}
		// if the lookup does not need any reversing, do nothing
		if sortNode.SortFields[0].Order != sql.Descending {
			return n, transform.NewTree, nil
		}

		// if the index is not reversible, do nothing
		if ordIdx, isOrdIdx := lookup.Index.(sql.OrderedIndex); !isOrdIdx || !ordIdx.Reversible() || ordIdx.Order() == sql.IndexOrderNone {
			return n, transform.SameTree, nil
		}
		lookup = sql.NewIndexLookup(
			lookup.Index,
			mysqlRanges,
			lookup.IsPointLookup,
			lookup.IsEmptyRange,
			lookup.IsSpatialLookup,
			true,
		)
		newIdxTbl, err := plan.NewStaticIndexedAccessForTableNode(ctx, n.TableNode, lookup)
		if err != nil {
			return nil, transform.SameTree, err
		}
		return newIdxTbl, transform.NewTree, err
	case *plan.ResolvedTable:
		if sortNode == nil {
			return n, transform.SameTree, nil
		}
		table := n.UnderlyingTable()
		idxTbl, ok := table.(sql.IndexAddressableTable)
		if !ok {
			return n, transform.SameTree, nil
		}
		if indexSearchable, ok := table.(sql.IndexSearchableTable); ok && indexSearchable.SkipIndexCosting() {
			return n, transform.SameTree, nil
		}
		tableAliases, err := getTableAliases(sortNode, scope)
		if err != nil {
			return n, transform.SameTree, nil
		}

		var idx sql.Index
		idxs, err := idxTbl.GetIndexes(ctx)
		if err != nil {
			return nil, transform.SameTree, err
		}
		sfExprs := normalizeExpressions(tableAliases, sortNode.SortFields.ToExpressions()...)
		sfAliases := aliasedExpressionsInNode(sortNode)
		for _, idxCandidate := range idxs {
			if idxCandidate.IsSpatial() {
				continue
			}
			if idxCandidate.IsVector() {
				// TODO: It's possible that we may be able to use vector indexes for point lookups, but not range lookups
				continue
			}
			if isSortFieldsValidPrefix(sfExprs, sfAliases, idxCandidate.Expressions()) {
				idx = idxCandidate
				break
			}
		}
		if idx == nil {
			return n, transform.SameTree, nil
		}
		// Create lookup based off of index
		indexBuilder := sql.NewMySQLIndexBuilder(idx)
		lookup, err := indexBuilder.Build(ctx)
		if err != nil {
			return nil, transform.SameTree, err
		}
		if sortNode.SortFields[0].Order == sql.Descending {
			lookup = sql.NewIndexLookup(
				lookup.Index,
				lookup.Ranges.(sql.MySQLRangeCollection),
				lookup.IsPointLookup,
				lookup.IsEmptyRange,
				lookup.IsSpatialLookup,
				true,
			)
		}
		// Some Primary Keys (like doltHistoryTable) are not in order
		if oi, isOrdIdx := idx.(sql.OrderedIndex); !isOrdIdx || (lookup.IsReverse && !oi.Reversible()) || oi.Order() == sql.IndexOrderNone {
			return n, transform.SameTree, nil
		}
		if !idx.CanSupport(ctx, lookup.Ranges.(sql.MySQLRangeCollection).ToRanges()...) {
			return n, transform.SameTree, nil
		}
		nn, err := plan.NewStaticIndexedAccessForTableNode(ctx, n, lookup)
		if err != nil {
			return nil, transform.SameTree, err
		}
		return nn, transform.NewTree, err
	}

	allSame := transform.SameTree
	children := node.Children()
	newChildren := node.Children()
	for i, child := range children {
		var err error
		same := transform.SameTree
		switch c := child.(type) {
		case *plan.Sort, *plan.IndexedTableAccess, *plan.ResolvedTable,
			*plan.Project, *plan.Filter, *plan.Limit, *plan.Offset, *plan.Distinct, *plan.TableAlias:
			newChildren[i], same, err = replaceIdxSortHelper(ctx, scope, child, sortNode)
		case *plan.JoinNode:
			// It's (probably) not possible to have Sort as child of Join without Subquery/SubqueryAlias,
			//  and in the case where there is a Subq/SQA it's taken care of through finalizeSubqueries
			if sortNode == nil {
				continue
			}
			// Merge Joins assume that left and right are sorted
			// Cross Joins and Inner Joins are valid for sort removal if left child is sorted
			if !c.JoinType().IsMerge() && !c.JoinType().IsCross() && !c.JoinType().IsInner() {
				continue
			}
			newLeft, sameLeft, errLeft := replaceIdxSortHelper(ctx, scope, c.Left(), sortNode)
			if errLeft != nil {
				return nil, transform.SameTree, errLeft
			}
			newRight, sameRight, errRight := replaceIdxSortHelper(ctx, scope, c.Right(), sortNode)
			if errRight != nil {
				return nil, transform.SameTree, errRight
			}
			// Neither child was converted to an IndexedTableAccess, so we can't remove the sort node
			leftIsSorted, rightIsSorted := !sameLeft, !sameRight
			if !leftIsSorted && !rightIsSorted {
				continue
			}
			// No need to check all SortField orders because of isValidSortFieldOrder
			isReversed := sortNode.SortFields[0].Order == sql.Descending
			// If both left and right have been replaced, no need to manually reverse any indexes as they both should be
			// replaced already
			if leftIsSorted && rightIsSorted {
				c.IsReversed = isReversed
				continue
			}
			if c.JoinType().IsCross() || c.JoinType().IsInner() {
				// For cross joins and inner joins, if the right child is sorted, we need to swap
				if !sameRight {
					// Swapping may mess up projections, but
					// eraseProjection will drop any Projections that are now unnecessary and
					// fixExecIndexes will fix any existing Projection GetField indexes.
					newLeft, newRight = newRight, newLeft
				}
			} else {
				// If only one side has been replaced, we need to check if the other side can be reversed
				if (leftIsSorted != rightIsSorted) && isReversed {
					// If descending, then both Indexes must be reversed
					if rightIsSorted {
						newLeft, same, err = buildReverseIndexedTable(ctx, newLeft)
					} else if leftIsSorted {
						newRight, same, err = buildReverseIndexedTable(ctx, newRight)
					}
					if err != nil {
						return nil, transform.SameTree, err
					}
					// If we could not replace the IndexedTableAccess with a reversed one (due to lack of reversible index)
					// same = true, so just continue
					if same {
						continue
					}
					c.IsReversed = true
				}
			}
			newChildren[i], err = c.WithChildren(newLeft, newRight)
			if err != nil {
				return nil, transform.SameTree, err
			}
			allSame = false
		}
		if err != nil {
			return nil, transform.SameTree, err
		}
		allSame = allSame && same
	}
	if allSame {
		return node, transform.SameTree, nil
	}
	// if sort node was replaced with indexed access, drop sort node
	if node == sortNode {
		return newChildren[0], transform.NewTree, nil
	}
	newNode, err := node.WithChildren(newChildren...)
	if err != nil {
		return nil, transform.SameTree, err
	}
	return newNode, transform.NewTree, nil
}

// buildReverseIndexedTable will attempt to take the lookup from an IndexedTableAccess, and return a new
// IndexedTableAccess with the lookup reversed.
func buildReverseIndexedTable(ctx *sql.Context, node sql.Node) (sql.Node, transform.TreeIdentity, error) {
	return transform.Node(node, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch idxTbl := n.(type) {
		case *plan.IndexedTableAccess:
			lookup, err := idxTbl.GetLookup(ctx, nil)
			if err != nil {
				return nil, transform.SameTree, err
			}
			// if the index is not reversible, do nothing
			if ordIdx, isOrdIdx := lookup.Index.(sql.OrderedIndex); !isOrdIdx || !ordIdx.Reversible() || ordIdx.Order() == sql.IndexOrderNone {
				return n, transform.SameTree, nil
			}
			lookup = sql.NewIndexLookup(
				lookup.Index,
				lookup.Ranges.(sql.MySQLRangeCollection),
				lookup.IsPointLookup,
				lookup.IsEmptyRange,
				lookup.IsSpatialLookup,
				true,
			)
			newIdxTbl, err := plan.NewStaticIndexedAccessForTableNode(ctx, idxTbl.TableNode, lookup)
			if err != nil {
				return nil, transform.SameTree, err
			}
			return newIdxTbl, transform.NewTree, nil
		default:
			return n, transform.SameTree, nil
		}
	})
}

// replaceAgg converts aggregate functions to order by + limit 1 when possible
func replaceAgg(ctx *sql.Context, a *Analyzer, node sql.Node, scope *plan.Scope, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	if !FlagIsSet(qFlags, sql.QFlagAggregation) {
		return node, transform.SameTree, nil
	}

	return transform.Node(node, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		// project with groupby child
		proj, ok := n.(*plan.Project)
		if !ok {
			return n, transform.SameTree, nil
		}
		gb, ok := proj.Child.(*plan.GroupBy)
		if !ok {
			return n, transform.SameTree, nil
		}
		// TODO: optimize when there are multiple aggregations; use LATERAL JOINS
		if len(gb.SelectDeps) != 1 || len(gb.GroupByExprs) != 0 {
			return n, transform.SameTree, nil
		}

		// TODO: support secondary indexes
		var pkIdx sql.Index
		switch t := gb.Child.(type) {
		case *plan.IndexedTableAccess:
			if _, ok := t.Table.(sql.IndexAddressableTable); ok {
				idx := t.Index()
				if idx.ID() != "PRIMARY" {
					return n, transform.SameTree, nil
				}
				pkIdx = idx
			}
		case *plan.ResolvedTable:
			if tbl, ok := t.UnderlyingTable().(sql.IndexAddressableTable); ok {
				idx, err := getPKIndex(ctx, tbl)
				if err != nil {
					return nil, transform.SameTree, err
				}
				if idx == nil {
					return n, transform.SameTree, nil
				}
				pkIdx = idx
			}
		default:
			return n, transform.SameTree, nil
		}

		if pkIdx == nil {
			return n, transform.SameTree, nil
		}

		// generate sort fields from aggregations
		var sf sql.SortField
		switch agg := gb.SelectDeps[0].(type) {
		case *aggregation.Max:
			gf, ok := agg.UnaryExpression.Child.(*expression.GetField)
			if !ok {
				return n, transform.SameTree, nil
			}
			sf = sql.SortField{
				Column: gf,
				Order:  sql.Descending,
			}
		case *aggregation.Min:
			gf, ok := agg.UnaryExpression.Child.(*expression.GetField)
			if !ok {
				return n, transform.SameTree, nil
			}
			sf = sql.SortField{
				Column: gf,
				Order:  sql.Ascending,
			}
		default:
			return n, transform.SameTree, nil
		}

		// since we're only supporting one aggregation, it must be on the first column of the primary key
		if pkCols := pkIdx.Expressions(); len(pkCols) < 1 {
			return n, transform.SameTree, nil
		} else if !strings.EqualFold(pkCols[0], sf.Column.String()) {
			return n, transform.SameTree, nil
		}

		// replace all aggs in proj.Projections with GetField
		name := gb.SelectDeps[0].String()
		newProjs, _, err := transform.Exprs(proj.Projections, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
			if strings.EqualFold(e.String(), name) {
				return sf.Column, transform.NewTree, nil
			}
			return e, transform.SameTree, nil
		})
		if err != nil {
			return nil, transform.SameTree, err
		}
		newProj := plan.NewProject(newProjs, plan.NewSort(sql.SortFields{sf}, gb.Child))
		limit := plan.NewLimit(expression.NewLiteral(1, types.Int64), newProj)
		return limit, transform.NewTree, nil
	})
}

// isSortFieldsValidPrefix checks if the SortFields in sortNode are a valid prefix of the index columns
func isSortFieldsValidPrefix(sfExprs []sql.Expression, sfAliases map[string]string, idxColExprs []string) bool {
	if len(sfExprs) > len(idxColExprs) {
		return false
	}
	for i, fieldExpr := range sfExprs {
		var fieldName string
		if alias, ok := fieldExpr.(*expression.Alias); ok {
			fieldName = alias.Child.String()
		} else {
			fieldName = fieldExpr.String()
		}
		if alias, ok := sfAliases[strings.ToLower(idxColExprs[i])]; ok && alias == fieldName {
			continue
		}
		if !strings.EqualFold(idxColExprs[i], fieldName) {
			return false
		}
	}
	return true
}

// isValidSortFieldOrder checks if all the sortFields are in the same order
func isValidSortFieldOrder(sfs sql.SortFields) bool {
	for _, sf := range sfs {
		// TODO: could generalize this to more monotonic expressions.
		//   For example, order by x+1 is ok, but order by mod(x) is not
		if sfs[0].Order != sf.Order {
			return false
		}
	}
	return true
}

// hasOverlapping checks if the ranges in a RangeCollection that are part of the sortfield exprs are overlapping
// This function assumes that the sort field exprs are a valid prefix of the index columns
func hasOverlapping(sfExprs []sql.Expression, ranges sql.MySQLRangeCollection) bool {
	for si := range sfExprs {
		for ri := 0; ri < len(ranges)-1; ri++ {
			for rj := ri + 1; rj < len(ranges); rj++ {
				if _, overlaps, _ := ranges[ri][si].Overlaps(ranges[rj][si]); overlaps {
					return true
				}
			}
		}
	}
	return false
}

// getPKIndex returns the primary key index of an IndexAddressableTable
func getPKIndex(ctx *sql.Context, idxTbl sql.IndexAddressableTable) (sql.Index, error) {
	idxs, err := idxTbl.GetIndexes(ctx)
	if err != nil {
		return nil, err
	}
	for _, idx := range idxs {
		if idx.ID() == "PRIMARY" {
			return idx, nil
		}
	}
	return nil, nil
}
