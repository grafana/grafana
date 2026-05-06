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
	"io"
	"iter"
	"slices"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

type GroupId uint16
type TableId uint16

type TableAndColumn struct {
	tableName  string
	columnName string
}

// Memo collects a forest of query plans structured by logical and
// physical equivalency. Logically equivalent plans, represented by
// an exprGroup, produce the same rows (possibly unordered) and schema.
// Physical plans are stored in a linked list within an expression group.
type Memo struct {
	c          Coster
	statsProv  sql.StatsProvider
	root       *ExprGroup
	hints      *joinHints
	Ctx        *sql.Context
	scope      *plan.Scope
	TableProps *tableProps
	QFlags     *sql.QueryFlags
	cnt        uint16
	Debug      bool
	Tracer     *TraceLogger
}

func NewMemo(ctx *sql.Context, stats sql.StatsProvider, s *plan.Scope, cost Coster, qFlags *sql.QueryFlags) *Memo {
	return &Memo{
		Ctx:        ctx,
		c:          cost,
		statsProv:  stats,
		scope:      s,
		TableProps: newTableProps(),
		hints:      &joinHints{},
		QFlags:     qFlags,
		Tracer:     &TraceLogger{},
	}
}

type MemoErr struct {
	Err error
}

func (m *Memo) HandleErr(err error) {
	panic(MemoErr{Err: err})
}

func (m *Memo) EnableTrace(enable bool) {
	m.Tracer.TraceEnabled = enable
}

func (m *Memo) Root() *ExprGroup {
	return m.root
}

func (m *Memo) StatsProvider() sql.StatsProvider {
	return m.statsProv
}

// SessionHints returns any hints that have been enabled in the session for join planning,
// such as the @@disable_merge_join SQL system variable.
func (m *Memo) SessionHints() (hints []Hint) {
	if val, _ := m.Ctx.GetSessionVariable(m.Ctx, sql.DisableMergeJoin); val.(int8) != 0 {
		hints = append(hints, Hint{Typ: HintTypeNoMergeJoin})
	}
	return hints
}

// newExprGroup creates a new logical expression group to encapsulate the
// action of a SQL clause.
// TODO: this is supposed to deduplicate logically equivalent table scans
// and scalar expressions, replacing references with a pointer. Currently
// a hacky format to quickly support memoizing join trees.
func (m *Memo) NewExprGroup(rel exprType) *ExprGroup {
	m.cnt++
	id := GroupId(m.cnt)
	grp := newExprGroup(m, id, rel)

	if s, ok := rel.(SourceRel); ok {
		m.TableProps.addTable(s.Name(), id)
	}
	return grp
}

func (m *Memo) memoizeSourceRel(rel SourceRel) *ExprGroup {
	grp := m.NewExprGroup(rel)
	return grp
}

func (m *Memo) getTableId(table string) (GroupId, bool) {
	return m.TableProps.GetId(table)
}

func (m *Memo) MemoizeLeftJoin(grp, left, right *ExprGroup, op plan.JoinType, filter []sql.Expression) *ExprGroup {
	newJoin := &LeftJoin{
		JoinBase: &JoinBase{
			relBase: &relBase{},
			Left:    left,
			Right:   right,
			Op:      op,
			Filter:  filter,
		},
	}
	// todo intern relExprs? add to appropriate group?
	if grp == nil {
		return m.NewExprGroup(newJoin)
	}
	newJoin.g = grp
	grp.Prepend(newJoin)
	return grp
}

func (m *Memo) MemoizeInnerJoin(grp, left, right *ExprGroup, op plan.JoinType, filter []sql.Expression) *ExprGroup {
	newJoin := &InnerJoin{
		JoinBase: &JoinBase{
			relBase: &relBase{},
			Left:    left,
			Right:   right,
			Op:      op,
			Filter:  filter,
		},
	}
	// todo intern relExprs? add to appropriate group?
	if grp == nil {
		return m.NewExprGroup(newJoin)
	}
	newJoin.g = grp
	grp.Prepend(newJoin)
	return grp
}

func (m *Memo) MemoizeLookupJoin(grp, left, right *ExprGroup, op plan.JoinType, filter []sql.Expression, lookup *IndexScan) *ExprGroup {
	if right.RelProps.reqIdxCols.Difference(lookup.Index.set).Len() > 0 {
		// the index lookup does not cover the requested RHS indexScan columns,
		// so this physical plan is invalid.
		return grp
	}
	newJoin := &LookupJoin{
		JoinBase: &JoinBase{
			relBase: &relBase{},
			Left:    left,
			Right:   right,
			Op:      op.AsLookup(),
			Filter:  filter,
		},
		Lookup: lookup,
	}

	if grp == nil {
		return m.NewExprGroup(newJoin)
	}
	newJoin.g = grp
	grp.Prepend(newJoin)

	if isInjectiveLookup(lookup.Index, newJoin.JoinBase, lookup.Table.Expressions(), lookup.Table.NullMask()) {
		newJoin.Injective = true
	}

	return grp
}

func (m *Memo) MemoizeHashJoin(grp *ExprGroup, join *JoinBase, toExpr, fromExpr []sql.Expression) *ExprGroup {
	if join.Right.RelProps.reqIdxCols.Len() > 0 {
		// HASH_JOIN's RHS will be a table scan, so this physical
		// plan will not provide the requested indexScan
		return grp
	}
	newJoin := &HashJoin{
		JoinBase:   join.Copy(),
		LeftAttrs:  toExpr,
		RightAttrs: fromExpr,
	}
	newJoin.Op = newJoin.Op.AsHash()

	if grp == nil {
		return m.NewExprGroup(newJoin)
	}
	newJoin.g = grp
	grp.Prepend(newJoin)

	return grp
}

// MemoizeConcatLookupJoin creates a lookup join over a set of disjunctions.
// If a LOOKUP_JOIN simulates x = v1, a concat lookup performs x in (v1, v2, v3, ...)
func (m *Memo) MemoizeConcatLookupJoin(grp, left, right *ExprGroup, op plan.JoinType, filter []sql.Expression, lookups []*IndexScan) *ExprGroup {
	newJoin := &ConcatJoin{
		JoinBase: &JoinBase{
			relBase: &relBase{},
			Left:    left,
			Right:   right,
			Op:      op.AsLookup(),
			Filter:  filter,
		},
		Concat: lookups,
	}

	if grp == nil {
		return m.NewExprGroup(newJoin)
	}
	newJoin.g = grp
	grp.Prepend(newJoin)
	return grp
}

func (m *Memo) MemoizeRangeHeapJoin(grp, left, right *ExprGroup, op plan.JoinType, filter []sql.Expression, rangeHeap *RangeHeap) *ExprGroup {
	newJoin := &RangeHeapJoin{
		JoinBase: &JoinBase{
			relBase: &relBase{},
			Left:    left,
			Right:   right,
			Op:      op,
			Filter:  filter,
		},
		RangeHeap: rangeHeap,
	}
	newJoin.RangeHeap.Parent = newJoin.JoinBase

	if grp == nil {
		return m.NewExprGroup(newJoin)
	}
	newJoin.g = grp
	grp.Prepend(newJoin)
	return grp
}

func (m *Memo) MemoizeMergeJoin(grp, left, right *ExprGroup, lIdx, rIdx *IndexScan, op plan.JoinType, filter []sql.Expression, swapCmp bool) *ExprGroup {
	rel := &MergeJoin{
		JoinBase: &JoinBase{
			relBase: &relBase{},
			Op:      op,
			Filter:  filter,
			Left:    left,
			Right:   right,
		},
		InnerScan: lIdx,
		OuterScan: rIdx,
		SwapCmp:   swapCmp,
	}

	eq, ok := filter[0].(expression.Equality)
	if !ok || !eq.RepresentsEquality() {
		err := sql.ErrMergeJoinExpectsComparerFilters.New(filter[0])
		m.HandleErr(err)
	}

	var leftCompareExprs []sql.Expression
	var rightCompareExprs []sql.Expression

	leftTuple, isTuple := eq.Left().(expression.Tuple)
	if isTuple {
		rightTuple, _ := eq.Right().(expression.Tuple)
		leftCompareExprs = leftTuple.Children()
		rightCompareExprs = rightTuple.Children()
	} else {
		leftCompareExprs = []sql.Expression{eq.Left()}
		rightCompareExprs = []sql.Expression{eq.Right()}
	}

	if grp == nil {
		grp = m.NewExprGroup(rel)
		rel.Injective = isInjectiveMerge(rel, leftCompareExprs, rightCompareExprs)
		return grp
	}
	rel.g = grp
	rel.Injective = isInjectiveMerge(rel, leftCompareExprs, rightCompareExprs)
	rel.CmpCnt = len(leftCompareExprs)
	grp.Prepend(rel)
	return grp
}

func (m *Memo) MemoizeProject(grp, child *ExprGroup, projections []sql.Expression) *ExprGroup {
	rel := &Project{
		relBase:     &relBase{},
		Child:       child,
		Projections: projections,
	}
	if grp == nil {
		return m.NewExprGroup(rel)
	}
	rel.g = grp
	grp.Prepend(rel)
	return grp
}

func (m *Memo) MemoizeDistinctProject(grp, child *ExprGroup, projections []sql.Expression) *ExprGroup {
	proj := &Project{
		relBase:     &relBase{},
		Child:       child,
		Projections: projections,
	}
	projGrp := m.NewExprGroup(proj)
	distinct := &Distinct{
		relBase: &relBase{},
		Child:   projGrp,
	}
	if grp == nil {
		return m.NewExprGroup(distinct)
	}
	distinct.g = grp
	grp.Prepend(distinct)
	return grp
}

// memoizeIndexScan creates a source node that uses a specific index to
// access data
func (m *Memo) memoizeIndexScan(grp *ExprGroup, ita *plan.IndexedTableAccess, alias string, index *Index, stat sql.Statistic) *ExprGroup {
	rel := &IndexScan{
		sourceBase: &sourceBase{relBase: &relBase{}},
		Table:      ita,
		Alias:      alias,
		Index:      index,
		Stats:      stat,
	}
	if grp == nil {
		return m.NewExprGroup(rel)
	}
	rel.g = grp
	grp.Prepend(rel)
	return grp
}

// MemoizeStaticIndexAccess creates or adds a static index scan to an expression
// group. This is distinct from memoizeIndexScan so that we can mark ITA groups
// as done early.
func (m *Memo) MemoizeStaticIndexAccess(grp *ExprGroup, aliasName string, idx *Index, ita *plan.IndexedTableAccess, filters []sql.Expression, stat sql.Statistic) {
	if m.Debug {
		m.Ctx.GetLogger().Debugf("new indexed table: %s/%s/%s", ita.Index().Database(), ita.Index().Table(), ita.Index().ID())
		m.Ctx.GetLogger().Debugf("index stats cnt: %d: ", stat.RowCount())
		m.Ctx.GetLogger().Debugf("index stats histogram: %s", stat.Histogram().DebugString())
	}
	if len(filters) > 0 {
		// set the indexed path as best. correct for cases where
		// indexScan is incompatible with best join operator
		itaGrp := m.memoizeIndexScan(nil, ita, aliasName, idx, stat)
		itaGrp.Best = itaGrp.First
		itaGrp.Done = true
		itaGrp.HintOk = true
		itaGrp.Best.SetDistinct(NoDistinctOp)
		fGrp := m.MemoizeFilter(grp, itaGrp, filters)
		fGrp.Best = fGrp.First
		fGrp.Done = true
		fGrp.HintOk = true
		fGrp.Best.SetDistinct(NoDistinctOp)
	} else {
		m.memoizeIndexScan(grp, ita, aliasName, idx, stat)
	}
}

func (m *Memo) MemoizeFilter(grp, child *ExprGroup, filters []sql.Expression) *ExprGroup {
	rel := &Filter{
		relBase: &relBase{},
		Child:   child,
		Filters: filters,
	}
	if grp == nil {
		return m.NewExprGroup(rel)
	}
	rel.g = grp
	grp.Prepend(rel)
	return grp
}

func (m *Memo) MemoizeMax1Row(grp, child *ExprGroup) *ExprGroup {
	rel := &Max1Row{
		relBase: &relBase{},
		Child:   child,
	}
	if grp == nil {
		return m.NewExprGroup(rel)
	}
	rel.g = grp
	grp.Prepend(rel)
	return grp
}

// OptimizeRoot finds the implementation for the root expression
// that has the lowest cost.
func (m *Memo) OptimizeRoot() error {
	m.Tracer.PushDebugContext("OptimizeRoot")
	defer m.Tracer.PopDebugContext()

	err := m.optimizeMemoGroup(m.root)
	if err != nil {
		return err
	}

	// Certain "best" groups are incompatible.
	m.root.fixConflicts()
	return nil
}

// optimizeMemoGroup recursively builds the lowest cost plan for memo
// group expressions. We optimize expressions groups independently, walking
// the linked list of execution plans for a particular group only after
// optimizing all subgroups. All plans within a group by definition share
// the same subgroup dependencies. After finding the best implementation
// for a particular group, we fix the best plan for that group and recurse
// into its parents.
// TODO: we should not have to cost every plan, sometimes there is a provably
// best case implementation
func (m *Memo) optimizeMemoGroup(grp *ExprGroup) error {
	if grp.Done {
		return nil
	}

	m.Tracer.PushDebugContextFmt("optimizeMemoGroup/%d", grp.Id)
	defer m.Tracer.PopDebugContext()

	n := grp.First
	if _, ok := n.(SourceRel); ok {
		// We should order the search bottom-up so that physical operators
		// always have their trees materialized. Until then, we always assume
		// the indexScan child is faster than a filter option, and  correct
		//  when a chosen join operator is incompatible with the indexScan
		//  option.
		grp.Done = true
		grp.HintOk = true
		grp.Best = grp.First
		grp.Best.SetDistinct(NoDistinctOp)
		m.Tracer.Log("source relation, setting as best plan", grp)
		return nil
	}

	for n != nil {
		m.Tracer.Log("Evaluating plan (%s)", n)
		var cost float64
		for _, g := range n.Children() {
			err := m.optimizeMemoGroup(g)
			if err != nil {
				return err
			}
			cost += g.Cost
		}
		relCost, err := m.c.EstimateCost(m.Ctx, n, m.statsProv)
		if err != nil {
			return err
		}

		if grp.RelProps.Distinct.IsHash() {
			if sortedInputs(n) && len(grp.RelProps.DistinctOn) == 0 {
				n.SetDistinct(SortedDistinctOp)
				m.Tracer.Log("Plan %s: using sorted distinct", n)
			} else {
				n.SetDistinct(HashDistinctOp, grp.RelProps.DistinctOn...)
				d := &Distinct{Child: grp}
				relCost += float64(m.statsForRel(m.Ctx, d).RowCount())
				m.Tracer.Log("Plan %s: using hash distinct", n)
			}
		} else {
			n.SetDistinct(NoDistinctOp)
		}

		n.SetCost(relCost)
		cost += relCost
		m.Tracer.Log("Plan %s: relCost=%.2f, totalCost=%.2f", n, relCost, cost)
		m.updateBest(grp, n, cost)
		n = n.Next()
	}

	grp.Done = true
	return nil
}

// updateBest chooses the best hinted plan or the best overall plan if the
// hint corresponds to  no valid plan. Ordering is applied as a global
// rather than a local property.
func (m *Memo) updateBest(grp *ExprGroup, n RelExpr, cost float64) {
	if !m.hints.isEmpty() {
		if m.hints.satisfiedBy(n) {
			if !grp.HintOk {
				grp.Best = n
				grp.Cost = cost
				grp.HintOk = true
				m.Tracer.Log("Set best plan for group %d to hinted plan %s with cost %.2f", grp.Id, n, cost)
				return
			}
			if grp.updateBest(n, cost) {
				m.Tracer.Log("Updated best plan for group %d to hinted plan %s with cost %.2f", grp.Id, n, cost)
			}
		} else if grp.Best == nil || !grp.HintOk {
			if grp.updateBest(n, cost) {
				m.Tracer.Log("Updated best plan for group %d to plan %s with cost %.2f (no hints satisfied)", grp.Id, n, cost)
			}
		}
		return
	}
	if grp.updateBest(n, cost) {
		m.Tracer.Log("Updated best plan for group %d to plan %s with cost %.2f", grp.Id, n, cost)
	}
}

func (m *Memo) BestRootPlan(ctx *sql.Context) (sql.Node, error) {
	b := NewExecBuilder()
	return buildBestJoinPlan(b, m.root, nil)
}

// buildBestJoinPlan converts group's lowest cost implementation into a
// tree node with a recursive DFS.
func buildBestJoinPlan(b *ExecBuilder, grp *ExprGroup, input sql.Schema) (sql.Node, error) {
	if !grp.Done {
		return nil, fmt.Errorf("expected expression group plans to be fixed")
	}
	n := grp.Best
	var err error
	children := make([]sql.Node, len(n.Children()))
	for i, g := range n.Children() {
		children[i], err = buildBestJoinPlan(b, g, input)
		if err != nil {
			return nil, err
		}
	}
	return b.buildRel(n, children...)
}

func getProjectColset(p *Project) sql.ColSet {
	var colset sql.ColSet
	for _, e := range p.Projections {
		transform.InspectExpr(e, func(e sql.Expression) bool {
			if gf, ok := e.(*expression.GetField); ok && gf.Id() > 0 {
				colset.Add(gf.Id())
			}
			return false
		})
	}
	return colset
}

// ApplyHint applies |hint| to this memo, converting the parsed hint into an internal representation and updating
// the internal data to match the memo metadata. Note that this function MUST be called only after memo groups have
// been fully built out, otherwise the group information set in the internal join hint structures will be incomplete.
func (m *Memo) ApplyHint(hint Hint) {
	switch hint.Typ {
	case HintTypeJoinOrder:
		m.SetJoinOrder(hint.Args)
	case HintTypeJoinFixedOrder:
	case HintTypeNoMergeJoin:
		m.hints.disableMergeJoin = true
	case HintTypeInnerJoin, HintTypeMergeJoin, HintTypeLookupJoin, HintTypeHashJoin, HintTypeSemiJoin, HintTypeAntiJoin, HintTypeLeftOuterLookupJoin:
		m.SetJoinOp(hint.Typ, hint.Args[0], hint.Args[1])
	case HintTypeLeftDeep:
		m.hints.leftDeep = true
	}
}

func (m *Memo) SetJoinOrder(tables []string) {
	// order maps groupId -> table dependencies
	order := make(map[sql.TableId]uint64)
	for i, t := range tables {
		for _, n := range m.root.RelProps.TableIdNodes() {
			if strings.EqualFold(t, n.Name()) {
				order[n.Id()] = uint64(i)
				break
			}
		}
	}
	hint := newJoinOrderHint(order)
	hint.build(m.root)
	if hint.isValid() {
		m.hints.order = hint
	}
}

func (m *Memo) SetJoinOp(op HintType, left, right string) {
	var lTab, rTab sql.TableId
	for _, n := range m.root.RelProps.TableIdNodes() {
		if strings.EqualFold(left, n.Name()) {
			lTab = n.Id()
		}
		if strings.EqualFold(right, n.Name()) {
			rTab = n.Id()
		}
	}
	if lTab == 0 || rTab == 0 {
		return
	}
	hint := newjoinOpHint(op, lTab, rTab)
	if !hint.isValid() {
		return
	}
	m.hints.ops = append(m.hints.ops, hint)
}

var _ fmt.Stringer = (*Memo)(nil)

func (m *Memo) String() string {
	exprs := make([]string, m.cnt)
	groups := make([]*ExprGroup, 0)
	if m.root != nil {
		groups = append(groups, m.root.First.Group())
	}

	// breadth-first traversal of memo groups via their children
	for len(groups) > 0 {
		newGroups := make([]*ExprGroup, 0)
		for _, g := range groups {
			if exprs[int(TableIdForSource(g.Id))] != "" {
				continue
			}
			exprs[int(TableIdForSource(g.Id))] = g.String()
			newGroups = slices.AppendSeq(newGroups, g.children)
		}
		groups = newGroups
	}
	b := strings.Builder{}
	b.WriteString("memo:\n")
	beg := "├──"
	for i, g := range exprs {
		if i == len(exprs)-1 {
			beg = "└──"
		}
		b.WriteString(fmt.Sprintf("%s G%d: %s\n", beg, i+1, g))
	}
	return b.String()
}

// LogCostDebugString logs a string representation of the memo with cost
// information for each expression, ordered by best to worst for each group,
// displayed in a tree structure.
// Only logs if tracing is enabled.
func (m *Memo) LogCostDebugString() {
	if m.root == nil || !m.Tracer.TraceEnabled {
		return
	}

	exprs := make([]string, m.cnt)
	groups := make([]*ExprGroup, 0)

	b := strings.Builder{}
	b.WriteString(fmt.Sprintf("costed memo (root group %d):\n", m.root.Id))

	if m.root != nil {
		groups = append(groups, m.root.First.Group())
	}

	// breadth-first traversal of memo groups via their children
	for len(groups) > 0 {
		newGroups := make([]*ExprGroup, 0)
		for _, g := range groups {
			if exprs[int(TableIdForSource(g.Id))] != "" {
				continue
			}

			prefix := "|   "
			if int(g.Id) == int(m.cnt) {
				prefix = "    "
			}

			exprs[int(TableIdForSource(g.Id))] = g.CostTreeString(prefix)
			newGroups = slices.AppendSeq(newGroups, g.children)
		}
		groups = newGroups
	}

	beg := "├──"
	for i, g := range exprs {
		if i == len(exprs)-1 {
			beg = "└──"
		}
		b.WriteString(fmt.Sprintf("%s G%d: %s\n", beg, i+1, g))
	}

	m.Tracer.Log("Completed cost-based optimization:\n%s", b.String())
}

// LogBestPlanDebugString logs a physical tree representation of the best plan for each group in the tree that is
// referenced by the best plan in the root. This differs from other debug strings in that it represents the groups
// as children of their parents, rather than as a flat list, and only includes groups that are part of the best plan.
// Only logs if tracing is enabled.
func (m *Memo) LogBestPlanDebugString() {
	if m.root == nil || !m.Tracer.TraceEnabled {
		return
	}

	m.Tracer.Log("Best root plan:\n%s", m.root.BestPlanDebugString())
}

type tableProps struct {
	grpToName map[GroupId]string
	nameToGrp map[string]GroupId
}

func newTableProps() *tableProps {
	return &tableProps{
		grpToName: make(map[GroupId]string),
		nameToGrp: make(map[string]GroupId),
	}
}

func (p *tableProps) addTable(n string, id GroupId) {
	p.grpToName[id] = n
	p.nameToGrp[n] = id
}

func (p *tableProps) GetTable(id GroupId) (string, bool) {
	n, ok := p.grpToName[id]
	return n, ok
}

func (p *tableProps) GetId(n string) (GroupId, bool) {
	id, ok := p.nameToGrp[strings.ToLower(n)]
	return id, ok
}

// Coster types can estimate the CPU and memory cost of physical execution
// operators.
type Coster interface {
	// EstimateCost cost returns the incremental CPU and memory cost for an
	// operator, or an error. Cost is dependent on physical operator type,
	// and the cardinality of inputs.
	EstimateCost(*sql.Context, RelExpr, sql.StatsProvider) (float64, error)
}

// RelExpr wraps a sql.Node for use as a ExprGroup linked list node.
// TODO: we need relExprs for every sql.Node and sql.Expression
type RelExpr interface {
	fmt.Stringer
	exprType
	Next() RelExpr
	SetNext(RelExpr)
	SetCost(c float64)
	Cost() float64
	Distinct() distinctOp
	DistinctOn() []sql.Expression
	SetDistinct(distinctOp, ...sql.Expression)
}

type relBase struct {
	// g is this relation's expression group
	g *ExprGroup
	// n is the next RelExpr in the ExprGroup linked list
	n RelExpr
	// c is this relation's cost while costing and plan reify are separate
	c float64
	// d indicates a RelExpr should be checked for distinctness
	d distinctOp
	// distinctOn, when not empty, indicates the expressions that should be used for distinctness (otherwise it's the projections)
	distinctOn []sql.Expression
}

// relKey is a quick identifier for avoiding duplicate work on the same
// RelExpr.
// TODO: the key should be a formalized hash of 1) the operator type, and 2)
// hashes of the RelExpr and ScalarExpr children.
func relKey(r RelExpr) uint64 {
	key := int(r.Group().Id)
	i := 1<<16 - 1
	for _, c := range r.Children() {
		key += i * int(c.Id)
		i *= 1<<16 - 1
	}
	return uint64(key)
}

// IterRelExprs returns an iterator over the linked list of RelExprs beginning at the head e
func IterRelExprs(e RelExpr) iter.Seq[RelExpr] {
	curr := e
	return func(yield func(RelExpr) bool) {
		for curr != nil {
			if !yield(curr) {
				return
			}
			curr = curr.Next()
		}
	}
}

type distinctOp uint8

const (
	unknownDistinctOp distinctOp = iota
	NoDistinctOp
	SortedDistinctOp
	HashDistinctOp
)

func (d distinctOp) IsHash() bool {
	return d == HashDistinctOp
}

func (r *relBase) Distinct() distinctOp {
	return r.d
}

func (r *relBase) DistinctOn() []sql.Expression {
	return r.distinctOn
}

func (r *relBase) SetDistinct(d distinctOp, on ...sql.Expression) {
	r.d = d
	r.distinctOn = on
}

func (r *relBase) Group() *ExprGroup {
	return r.g
}

func (r *relBase) SetGroup(g *ExprGroup) {
	r.g = g
}

func (r *relBase) Next() RelExpr {
	return r.n
}

func (r *relBase) SetNext(rel RelExpr) {
	r.n = rel
}

func (r *relBase) SetCost(c float64) {
	r.c = c
}

func (r *relBase) Cost() float64 {
	return r.c
}

func DescribeStats(r RelExpr) *sql.DescribeStats {
	return &sql.DescribeStats{
		EstimatedRowCount: r.Group().RelProps.GetStats().RowCount(),
		Cost:              r.Cost(),
	}
}

func TableIdForSource(id GroupId) sql.TableId {
	return sql.TableId(id - 1)
}

type exprType interface {
	Group() *ExprGroup
	Children() []*ExprGroup
	SetGroup(g *ExprGroup)
}

// SourceRel represents a data source, like a tableScan, subqueryAlias,
// or list of values.
type SourceRel interface {
	RelExpr
	// outputCols retuns the output schema of this data source.
	// TODO: this is more useful as a relExpr property, but we need
	// this to fix up expression indexes currently
	OutputCols() sql.Schema
	Name() string
	TableId() sql.TableId
	Indexes() []*Index
	SetIndexes(indexes []*Index)
	TableIdNode() plan.TableIdNode
}

type Index struct {
	set   sql.ColSet
	idx   sql.Index
	cols  []sql.ColumnId
	order sql.IndexOrder
}

func (i *Index) Cols() []sql.ColumnId {
	return i.cols
}

func (i *Index) ColSet() sql.ColSet {
	return i.set
}

func (i *Index) SqlIdx() sql.Index {
	return i.idx
}

func (i *Index) Order() sql.IndexOrder {
	return i.order
}

type sourceBase struct {
	*relBase
	indexes []*Index
}

func (s *sourceBase) Indexes() []*Index {
	return s.indexes
}

func (s *sourceBase) SetIndexes(indexes []*Index) {
	s.indexes = indexes
}

// JoinRel represents a plan.JoinNode or plan.CrossJoin. See plan.JoinType
// for the full list.
type JoinRel interface {
	RelExpr
	JoinPrivate() *JoinBase
	Group() *ExprGroup
}

var _ JoinRel = (*AntiJoin)(nil)
var _ JoinRel = (*ConcatJoin)(nil)
var _ JoinRel = (*CrossJoin)(nil)
var _ JoinRel = (*LeftJoin)(nil)
var _ JoinRel = (*FullOuterJoin)(nil)
var _ JoinRel = (*HashJoin)(nil)
var _ JoinRel = (*InnerJoin)(nil)
var _ JoinRel = (*LookupJoin)(nil)
var _ JoinRel = (*SemiJoin)(nil)

type JoinBase struct {
	*relBase
	Left   *ExprGroup
	Right  *ExprGroup
	Filter []sql.Expression
	Op     plan.JoinType
}

func (r *JoinBase) Children() []*ExprGroup {
	return []*ExprGroup{r.Left, r.Right}
}

func (r *JoinBase) JoinPrivate() *JoinBase {
	return r
}

// Copy creates a JoinBase with the same underlying join expression.
// note: it is important to Copy the base node to avoid cyclical
// relExpr references in the ExprGroup linked list.
func (r *JoinBase) Copy() *JoinBase {
	return &JoinBase{
		relBase: &relBase{
			g: r.g,
			n: r.n,
			c: r.c,
		},
		Op:     r.Op,
		Filter: r.Filter,
		Left:   r.Left,
		Right:  r.Right,
	}
}

func (r *LookupJoin) Children() []*ExprGroup {
	return []*ExprGroup{r.Left, r.Right}
}

// RangeHeap contains all the information necessary to construct a RangeHeap join.
// Because both sides of the join can be implemented either by an index or a sorted node,
// we require that exactly one of ValueIndex and ValueExpr is non-nil, and exactly one
// of MinIndex and MinExpr is non-nil. If the index is non-nil, we will use it to construct
// a plan.IndexedTableAccess. Otherwise we use the expression to construct a plan.Sort.
type RangeHeap struct {
	ValueExpr               sql.Expression
	MinExpr                 sql.Expression
	ValueIndex              *IndexScan
	MinIndex                *IndexScan
	ValueCol                *expression.GetField
	MinColRef               *expression.GetField
	MaxColRef               *expression.GetField
	Parent                  *JoinBase
	RangeClosedOnLowerBound bool
	RangeClosedOnUpperBound bool
}

// FormatExpr formats an exprType for debugging purposes, compatible with fmt.Formatter
func FormatExpr(r exprType, s fmt.State, verb rune) {
	verbString := fmt.Sprintf("%%%c", verb)
	if verb == 'v' && s.Flag('+') {
		verbString = "%+v"
	}
	switch r := r.(type) {
	case *CrossJoin:
		io.WriteString(s, fmt.Sprintf("crossjoin "+verbString+" "+verbString, r.Left, r.Right))
	case *InnerJoin:
		io.WriteString(s, fmt.Sprintf("innerjoin "+verbString+" "+verbString, r.Left, r.Right))
	case *LeftJoin:
		io.WriteString(s, fmt.Sprintf("leftjoin "+verbString+" "+verbString, r.Left, r.Right))
	case *SemiJoin:
		io.WriteString(s, fmt.Sprintf("semijoin "+verbString+" "+verbString, r.Left, r.Right))
	case *AntiJoin:
		io.WriteString(s, fmt.Sprintf("antijoin "+verbString+" "+verbString, r.Left, r.Right))
	case *LookupJoin:
		io.WriteString(s, fmt.Sprintf("lookupjoin "+verbString+" "+verbString+" on %s",
			r.Left, r.Right, r.Lookup.Index.idx.ID()))
	case *RangeHeapJoin:
		io.WriteString(s, fmt.Sprintf("rangeheapjoin "+verbString+" "+verbString, r.Left, r.Right))
	case *ConcatJoin:
		io.WriteString(s, fmt.Sprintf("concatjoin "+verbString+" "+verbString, r.Left, r.Right))
	case *HashJoin:
		io.WriteString(s, fmt.Sprintf("hashjoin "+verbString+" "+verbString, r.Left, r.Right))
	case *MergeJoin:
		io.WriteString(s, fmt.Sprintf("mergejoin "+verbString+" "+verbString, r.Left, r.Right))
	case *FullOuterJoin:
		io.WriteString(s, fmt.Sprintf("fullouterjoin "+verbString+" "+verbString, r.Left, r.Right))
	case *LateralJoin:
		io.WriteString(s, fmt.Sprintf("lateraljoin "+verbString+" "+verbString, r.Left, r.Right))
	case *TableScan:
		io.WriteString(s, fmt.Sprintf("tablescan: %s", r.Name()))
	case *IndexScan:
		if r.Alias != "" {
			io.WriteString(s, fmt.Sprintf("indexscan on %s: %s", r.Index.SqlIdx().ID(), r.Alias))
		}
		io.WriteString(s, fmt.Sprintf("indexscan on %s: %s", r.Index.SqlIdx().ID(), r.Name()))
	case *Values:
		io.WriteString(s, fmt.Sprintf("values: %s", r.Name()))
	case *TableAlias:
		io.WriteString(s, fmt.Sprintf("tablealias: %s", r.Name()))
	case *RecursiveTable:
		io.WriteString(s, fmt.Sprintf("recursivetable: %s", r.Name()))
	case *RecursiveCte:
		io.WriteString(s, fmt.Sprintf("recursivecte: %s", r.Name()))
	case *SubqueryAlias:
		io.WriteString(s, fmt.Sprintf("subqueryalias: %s", r.Name()))
	case *TableFunc:
		io.WriteString(s, fmt.Sprintf("tablefunc: %s", r.Name()))
	case *JSONTable:
		io.WriteString(s, fmt.Sprintf("jsontable: %s", r.Name()))
	case *EmptyTable:
		io.WriteString(s, fmt.Sprintf("emptytable: %s", r.Name()))
	case *SetOp:
		io.WriteString(s, fmt.Sprintf("setop: %s", r.Name()))
	case *Project:
		io.WriteString(s, fmt.Sprintf("project: %d", r.Child.Id))
	case *Distinct:
		io.WriteString(s, fmt.Sprintf("distinct: %d", r.Child.Id))
	case *Max1Row:
		io.WriteString(s, fmt.Sprintf("max1row: %d", r.Child.Id))
	case *Filter:
		io.WriteString(s, fmt.Sprintf("filter: %d", r.Child.Id))
	default:
		panic(fmt.Sprintf("unknown RelExpr type: %T", r))
	}
}
