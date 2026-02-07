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

package memo

import (
	"fmt"
	"math"

	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/transform"

	"github.com/dolthub/go-mysql-server/sql"
)

const (
	// reference https://github.com/postgres/postgres/blob/master/src/include/optimizer/cost.h
	cpuCostFactor             = 0.01
	seqIOCostFactor           = 1
	randIOCostFactor          = 1.3
	memCostFactor             = 2
	concatCostFactor          = 0.75
	degeneratePenalty         = 2.0
	optimisticJoinSel         = .10
	biasFactor                = 1e5
	defaultFilterSelectivity  = .85
	perKeyCostReductionFactor = 0.5
	defaultTableSize          = 100
)

func NewDefaultCoster() Coster {
	return &coster{}
}

type coster struct{}

var _ Coster = (*coster)(nil)

func (c *coster) EstimateCost(ctx *sql.Context, n RelExpr, s sql.StatsProvider) (float64, error) {
	return c.costRel(ctx, n, s)
}

// costRel returns the estimated compute cost for a given physical
// operator. Two physical operators in the same expression group will have
// the same input and output cardinalities, but different evaluation costs.
func (c *coster) costRel(ctx *sql.Context, n RelExpr, s sql.StatsProvider) (float64, error) {
	switch n := n.(type) {
	case *Project:
		return float64(n.Child.RelProps.GetStats().RowCount()) * cpuCostFactor, nil
	case *Distinct:
		return float64(n.Child.RelProps.GetStats().RowCount()) * (cpuCostFactor + .75*memCostFactor), nil
	case *Filter:
		return float64(n.Child.RelProps.GetStats().RowCount()) * cpuCostFactor * float64(len(n.Filters)), nil
	case JoinRel:
		jp := n.JoinPrivate()
		lBest := math.Max(1, float64(jp.Left.RelProps.GetStats().RowCount()))
		rBest := math.Max(1, float64(jp.Right.RelProps.GetStats().RowCount()))

		// if a child is an index scan, the table scan will be more expensive
		var err error
		lTableScan := uint64(lBest)
		rTableScan := uint64(rBest)

		if iScan, ok := jp.Left.Best.(*IndexScan); ok {
			lTableScan, err = s.RowCount(ctx, iScan.Table.Database().Name(), iScan.Table)
			if err != nil {
				lTableScan = defaultTableSize
			}
		}
		if iScan, ok := jp.Right.Best.(*IndexScan); ok {
			rTableScan, err = s.RowCount(ctx, iScan.Table.Database().Name(), iScan.Table)
			if err != nil {
				rTableScan = defaultTableSize
			}
		}

		selfJoinCard := math.Max(1, float64(n.Group().RelProps.GetStats().RowCount()))

		switch {
		case jp.Op.IsInner():
			// arbitrary +1 penalty, prefer lookup
			return (lBest*rBest+1)*seqIOCostFactor + (lBest*rBest)*cpuCostFactor, nil
		case jp.Op.IsDegenerate():
			return ((lBest*rBest)*seqIOCostFactor + (lBest*rBest)*cpuCostFactor) * degeneratePenalty, nil
		case jp.Op.IsHash():
			if jp.Op.IsPartial() {
				cost := lBest * (rBest / 2.0) * (seqIOCostFactor + cpuCostFactor)
				return cost * .5, nil
			}
			return lBest*(seqIOCostFactor+cpuCostFactor) + float64(rBest)*(seqIOCostFactor+memCostFactor) + selfJoinCard*cpuCostFactor, nil

		case jp.Op.IsLateral():
			return (lBest*rBest-1)*seqIOCostFactor + (lBest*rBest)*cpuCostFactor, nil

		case jp.Op.IsMerge():
			// TODO memory overhead when not injective
			// TODO lose index scan benefits, need to read whole table

			if !n.(*MergeJoin).Injective {
				// Injective is guarenteed to never iterate over multiple rows in memory.
				// Otherwise O(k) where k is the key with the highest number of matches.
				// Each comparison reduces the expected number of collisions on the comparator.
				// TODO: better cost estimate for memory overhead
				mergeCmtAdjustment := math.Max(0, 4-float64(n.(*MergeJoin).CmpCnt))
				selfJoinCard += mergeCmtAdjustment
			}

			// cost is full left scan + full rightScan plus compute/memory overhead
			// for this merge filter's cardinality
			// TODO: estimate memory overhead
			return float64(lTableScan+rTableScan)*(seqIOCostFactor+cpuCostFactor) + cpuCostFactor*selfJoinCard, nil
		case jp.Op.IsLookup():
			// TODO added overhead for right lookups
			switch n := n.(type) {
			case *LookupJoin:
				if !n.Injective {
					// partial index completion is undesirable
					// TODO don't do this whe we have stats
					selfJoinCard = math.Max(0, selfJoinCard+float64(indexCoverageAdjustment(n.Lookup)))
				}

				// read the whole left table and randIO into table equivalent to
				// this join's output cardinality estimate
				return lBest*seqIOCostFactor + selfJoinCard*(randIOCostFactor+seqIOCostFactor), nil
			case *ConcatJoin:
				return c.costConcatJoin(ctx, n, s)
			}
		case jp.Op.IsRange():
			expectedNumberOfOverlappingJoins := rBest * perKeyCostReductionFactor
			return lBest * expectedNumberOfOverlappingJoins * (seqIOCostFactor), nil
		case jp.Op.IsPartial():
			return lBest*seqIOCostFactor + lBest*(rBest/2.0)*(seqIOCostFactor+cpuCostFactor), nil
		case jp.Op.IsFullOuter():
			return ((lBest*rBest-1)*seqIOCostFactor + (lBest*rBest)*cpuCostFactor) * degeneratePenalty, nil
		case jp.Op.IsLeftOuter():
			return (lBest*rBest-1)*seqIOCostFactor + (lBest*rBest)*cpuCostFactor, nil
		default:
		}
		return 0, fmt.Errorf("unhandled join type: %T (%s)", n, jp.Op)
	default:
		panic(fmt.Sprintf("coster does not support type: %T", n))
	}
}

// isInjectiveMerge determines whether either of a merge join's child indexes returns only unique values for the merge
// comparator.
func isInjectiveMerge(n *MergeJoin, leftCompareExprs, rightCompareExprs []sql.Expression) bool {
	{
		keyExprs, nullmask := keyExprsForIndexFromTupleComparison(n.Left.RelProps.tableNodes[0].Id(), n.InnerScan.Index.Cols(), leftCompareExprs, rightCompareExprs)
		if isInjectiveLookup(n.InnerScan.Index, n.JoinBase, keyExprs, nullmask) {
			return true
		}
	}
	{
		keyExprs, nullmask := keyExprsForIndexFromTupleComparison(n.Right.RelProps.tableNodes[0].Id(), n.OuterScan.Index.Cols(), leftCompareExprs, rightCompareExprs)
		if isInjectiveLookup(n.OuterScan.Index, n.JoinBase, keyExprs, nullmask) {
			return true
		}
	}
	return false
}

func keyExprsForIndexFromTupleComparison(tabId sql.TableId, idxExprs []sql.ColumnId, leftExprs []sql.Expression, rightExprs []sql.Expression) ([]sql.Expression, []bool) {
	var keyExprs []sql.Expression
	var nullmask []bool
	for _, col := range idxExprs {
		key, nullable := keyForExprFromTupleComparison(col, tabId, leftExprs, rightExprs)
		if key == nil {
			break
		}
		keyExprs = append(keyExprs, key)
		nullmask = append(nullmask, nullable)
	}
	if len(keyExprs) == 0 {
		return nil, nil
	}
	return keyExprs, nullmask
}

// keyForExpr returns an equivalence or constant value to satisfy the
// lookup index expression.
func keyForExprFromTupleComparison(targetCol sql.ColumnId, tabId sql.TableId, leftExprs []sql.Expression, rightExprs []sql.Expression) (sql.Expression, bool) {
	for i, leftExpr := range leftExprs {
		rightExpr := rightExprs[i]

		var key sql.Expression
		if ref, ok := leftExpr.(*expression.GetField); ok && ref.Id() == targetCol {
			key = rightExpr
		} else if ref, ok := rightExpr.(*expression.GetField); ok && ref.Id() == targetCol {
			key = leftExpr
		} else {
			continue
		}
		// expression key can be arbitrarily complex (or simple), but cannot
		// reference the lookup table
		if !exprReferencesTable(key, tabId) {
			return key, false
		}

	}
	return nil, false
}

// TODO need a way to map memo groups to table ids (or names if this doesn't work)
func exprReferencesTable(e sql.Expression, tabId sql.TableId) bool {
	return transform.InspectExpr(e, func(e sql.Expression) bool {
		gf, _ := e.(*expression.GetField)
		if gf != nil && gf.TableId() == tabId {
			return true
		}
		return false
	})
}

func (c *coster) costConcatJoin(_ *sql.Context, n *ConcatJoin, _ sql.StatsProvider) (float64, error) {
	l := float64(n.Left.RelProps.GetStats().RowCount())
	var sel float64
	for _, l := range n.Concat {
		lookup := l
		sel += lookupJoinSelectivity(lookup, n.JoinBase)
	}
	return l*sel*concatCostFactor*(randIOCostFactor+cpuCostFactor) - float64(n.Right.RelProps.GetStats().RowCount())*seqIOCostFactor, nil
}

// lookupJoinSelectivity estimates the selectivity of a join condition with n lhs rows and m rhs rows.
// A join with a selectivity of k will return k*(n*m) rows.
// Special case: A join with a selectivity of 0 will return n rows.
func lookupJoinSelectivity(l *IndexScan, joinBase *JoinBase) float64 {
	if isInjectiveLookup(l.Index, joinBase, l.Table.Expressions(), l.Table.NullMask()) {
		return 0
	}
	return math.Pow(perKeyCostReductionFactor, float64(len(l.Table.Expressions()))) * optimisticJoinSel
}

// isInjectiveLookup returns whether every lookup with the given key expressions is guarenteed to return
// at most one row.
func isInjectiveLookup(idx *Index, joinBase *JoinBase, keyExprs []sql.Expression, nullMask []bool) bool {
	if !idx.SqlIdx().IsUnique() {
		return false
	}

	joinFds := joinBase.Group().RelProps.FuncDeps()

	var notNull sql.ColSet
	var constCols sql.ColSet
	for i, nullable := range nullMask {
		cols, _, nullRej := getExprScalarProps(keyExprs[i])
		onCols := joinFds.EquivalenceClosure(cols)
		if !nullable {
			if nullRej {
				// columns with nulls will be filtered out
				// TODO double-checking nullRejecting might be redundant
				notNull = notNull.Union(onCols)
			}
		}
		// from the perspective of the secondary table, lookup keys
		// will be constant
		constCols = constCols.Union(onCols)
	}

	fds := sql.NewLookupFDs(joinBase.Right.RelProps.FuncDeps(), idx.ColSet(), notNull, constCols, joinFds.Equiv())
	return fds.HasMax1Row()
}

func NewInnerBiasedCoster() Coster {
	return &innerBiasedCoster{coster: &coster{}}
}

type innerBiasedCoster struct {
	*coster
}

func (c *innerBiasedCoster) EstimateCost(ctx *sql.Context, r RelExpr, s sql.StatsProvider) (float64, error) {
	switch r.(type) {
	case *InnerJoin:
		return -biasFactor, nil
	default:
		return c.costRel(ctx, r, s)
	}
}

func NewHashBiasedCoster() Coster {
	return &hashBiasedCoster{coster: &coster{}}
}

type hashBiasedCoster struct {
	*coster
}

func (c *hashBiasedCoster) EstimateCost(ctx *sql.Context, r RelExpr, s sql.StatsProvider) (float64, error) {
	switch r.(type) {
	case *HashJoin:
		return -biasFactor, nil
	default:
		return c.costRel(ctx, r, s)
	}
}

func NewLookupBiasedCoster() Coster {
	return &lookupBiasedCoster{coster: &coster{}}
}

type lookupBiasedCoster struct {
	*coster
}

func (c *lookupBiasedCoster) EstimateCost(ctx *sql.Context, r RelExpr, s sql.StatsProvider) (float64, error) {
	switch r.(type) {
	case *LookupJoin, *ConcatJoin:
		return -biasFactor, nil
	default:
		return c.costRel(ctx, r, s)
	}
}

func NewMergeBiasedCoster() Coster {
	return &mergeBiasedCoster{coster: &coster{}}
}

type mergeBiasedCoster struct {
	*coster
}

func (c *mergeBiasedCoster) EstimateCost(ctx *sql.Context, r RelExpr, s sql.StatsProvider) (float64, error) {
	switch r.(type) {
	case *MergeJoin:
		return -biasFactor, nil
	default:
		return c.costRel(ctx, r, s)
	}
}

type partialBiasedCoster struct {
	*coster
}

func NewPartialBiasedCoster() Coster {
	return &partialBiasedCoster{coster: &coster{}}
}

func (c *partialBiasedCoster) EstimateCost(ctx *sql.Context, r RelExpr, s sql.StatsProvider) (float64, error) {
	switch r.(type) {
	case *AntiJoin, *SemiJoin:
		return -biasFactor, nil
	default:
		return c.costRel(ctx, r, s)
	}
}

type rangeHeapBiasedCoster struct {
	*coster
}

func NewRangeHeapBiasedCoster() Coster {
	return &rangeHeapBiasedCoster{coster: &coster{}}
}

func (c *rangeHeapBiasedCoster) EstimateCost(ctx *sql.Context, r RelExpr, s sql.StatsProvider) (float64, error) {
	switch r.(type) {
	case *RangeHeapJoin:
		return -biasFactor, nil
	default:
		return c.costRel(ctx, r, s)
	}
}
