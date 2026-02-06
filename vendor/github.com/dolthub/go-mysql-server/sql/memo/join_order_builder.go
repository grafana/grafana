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
	"errors"
	"fmt"
	"math"
	"math/bits"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// joinOrderBuilder enumerates valid plans for a join tree.  We build the join
// tree bottom up, first joining single nodes with join condition "edges", then
// single nodes to hypernodes (1+n), and finally hyper nodes to
// other hypernodes (n+m).
//
// Every valid combination of subtrees is considered with two exceptions.
//
// 1) Cross joins and other joins with degenerate predicates are never pushed
// lower in the tree.
//
// 2) Transformations that are valid but create degenerate filters (new
// cross joins) are not considered.
//
// The logic for this module is sourced from
// https://www.researchgate.net/publication/262216932_On_the_correct_and_complete_enumeration_of_the_core_search_space
// with help from
// https://github.com/cockroachdb/cockroach/blob/master/pkg/sql/opt/xform/join_order_builder.go.
//
// Two theoretical observations underpin the enumeration:
//
// 1) Either associativity or l-asscom can be applied to left nesting, but not
// both. Either associativity or r-asscom can be applied to right nesting, but
// not both.
//
// 2) Every transformation in the core search space (of two operators) can be
// reached by one commutative transformation on each operator and one assoc,
// l-asscom, or r-asscom.
//
// We use these assumptions to implement the dbSube enumeration search, using a
// CD-C conflict detection rules to encode reordering applicability:
//
// 1) Use bitsets to iterate all combinations of join plan subtrees, starting
// with two tables and building upwards. For example, a join A x B x C would
// start with 10 x 01 (A x B) and build up to sets 100 x 011 (A x (BC)) and 101
// x 010 ((AC) x B).
//
// 2) Attempt to make a new plan with every combination of subtrees
// (hypernodes) for every join operator. This takes the form (op s1 s2), where
// s1 is the right subtree, s2 is the left subtree, and op is the edge
// corresponding to a specific join type and filter. Most of the time one
// operator => one edge, except when join conjunctions are split to make
// multiple edges for one join operator. We differentiate innerEdges and
// nonInnerEdges to avoid innerJoins plans overwriting the often slower
// nonInner join plans. A successful edge between two sets adds a join plan to
// the memo.
//
// 3) Save the best plan for every memo group (unordered group of table joins)
// moving upwards through the tree, finishing with the optimal memo group for
// the join including every table.
//
// Applicability rules:
//
// We build applicability rules before exhaustive enumeration to filter valid
// plans. We consider a reordering valid by checking:
//
// 1) Transform compatibility: a Lookup table between two join operator types
//
// 2) Eligibility sets: left and right subtree dependencies required for a
// valid reordering. The syntactic eligibility set (SES) is the table
// dependencies of the edge's filter. For example, the SES for a filter a.x =
// b.y is (a,b).  The total eligibility set (TES) is an expansion of the SES
// that conceptually behaves similarly to an SES; i.e. only hypernodes that
// completely intersect an edge's TES are valid. The difference is that TES is
// expanded based on the original edge's join operator subdependencies.  The
// paper referenced encodes an algorithms for building a TES to fully encode
// associativity, left-asscom, and right-asscom (commutativity is a unary
// operator property).
//
// For example, the INNER JOIN in the query below is subject to assoc(left
// join, inner join) = false:
//
//	SELECT *
//	FROM (SELECT * FROM ab LEFT JOIN uv ON a = u)
//	INNER JOIN xy
//	ON x = v
//
// As a result, the inner join's TES, initialized as the SES(xy, uv), is
// expanded to include ab. The final TES(xy, uv, ab) invalidates
// LEFT JOIN association during exhaustive enumeration:
//
//	SELECT *
//	FROM (SELECT * FROM ab LEFT JOIN xy ON x = v)
//	INNER JOIN uv
//	ON a = u
//
// Note the disconnect between the global nature of the TES, which is built
// fully before enumeration, and local nature of testing every enumeration
// against the pre-computed TES.
//
// In special cases, the TES is not expressive enough to represent certain
// table dependencies. Conflict rules of the form R1 -> R2 are an escape hatch
// to require the dependency table set R2 when any subset of R1 is present in a
// candidate plan.
//
// TODO: null rejecting tables
type joinOrderBuilder struct {
	// plans maps from a set of base relations to the memo group for the join tree
	// that contains those relations (and only those relations). As an example,
	// the group for [xy, ab, uv] might contain the join trees (xy, (ab, uv)),
	// ((xy, ab), uv), (ab, (xy, uv)), etc.
	//
	// The group for a single base relation is the base relation itself.
	m                         *Memo
	innerEdges                edgeSet
	nonInnerEdges             edgeSet
	plans                     map[vertexSet]*ExprGroup
	newPlanCb                 func(j *joinOrderBuilder, rel RelExpr)
	edges                     []edge
	vertices                  []RelExpr
	vertexGroups              []GroupId
	vertexTableIds            []sql.TableId
	forceFastDFSLookupForTest bool
	hasCrossJoin              bool
}

func NewJoinOrderBuilder(memo *Memo) *joinOrderBuilder {
	return &joinOrderBuilder{
		plans:        make(map[vertexSet]*ExprGroup),
		m:            memo,
		vertices:     make([]RelExpr, 0),
		vertexGroups: make([]GroupId, 0),
	}
}

var ErrUnsupportedReorderNode = errors.New("unsupported join reorder node")

// useFastReorder determines whether to skip the current brute force join planning and use an alternate
// planning algorithm that analyzes the join tree to find a sequence that can be implemented purely as lookup joins.
// Currently, we only use it for large joins (15+ tables) with no join hints.
func (j *joinOrderBuilder) useFastReorder() bool {
	if j.forceFastDFSLookupForTest {
		return true
	}
	if j.m.hints.order != nil {
		return false
	}
	return len(j.vertices) > 15
}

func (j *joinOrderBuilder) ReorderJoin(n sql.Node) {
	j.populateSubgraph(n)
	if j.useFastReorder() {
		j.buildSingleLookupPlan()
		return
	} else if j.hasCrossJoin {
		// Rely on FastReorder to avoid plans that drop filters with cross joins
		if j.buildSingleLookupPlan() {
			return
		}
	}
	// TODO: consider if buildSingleLookupPlan can/should run after ensureClosure. This could allow us to use analysis
	// from ensureClosure in buildSingleLookupPlan, but the equivalence sets could create multiple possible join orders
	// for the single-lookup plan, which would complicate things.
	j.ensureClosure(j.m.root)
	j.dpEnumerateSubsets()
	return
}

// populateSubgraph recursively tracks new join nodes as edges and new
// leaf nodes as vertices to the joinOrderBuilder graph, returning
// the subgraph's newly tracked vertices and edges.
func (j *joinOrderBuilder) populateSubgraph(n sql.Node) (vertexSet, edgeSet, *ExprGroup) {
	var group *ExprGroup
	startV := j.allVertices()
	startE := j.allEdges()
	// build operator
	switch n := n.(type) {
	case *plan.Filter:
		return j.buildFilter(n.Child, n.Expression)
	case *plan.Having:
		return j.buildFilter(n.Child, n.Cond)
	case *plan.Limit:
		_, _, group = j.populateSubgraph(n.Child)
		group.RelProps.Limit = n.Limit
	case *plan.Project:
		return j.buildProject(n)
	case *plan.Sort:
		_, _, group = j.populateSubgraph(n.Child)
		group.RelProps.sort = n.SortFields
	case *plan.Distinct:
		_, _, group = j.populateSubgraph(n.Child)
		group.RelProps.Distinct = HashDistinctOp
	case *plan.Max1Row:
		return j.buildMax1Row(n)
	case *plan.JoinNode:
		group = j.buildJoinOp(n)
		if n.Op == plan.JoinTypeCross {
			j.hasCrossJoin = true
		}
	case *plan.SetOp:
		group = j.buildJoinLeaf(n)
	case sql.NameableNode:
		group = j.buildJoinLeaf(n.(plan.TableIdNode))
	case *plan.StripRowNode:
		return j.populateSubgraph(n.Child)
	case *plan.CachedResults:
		return j.populateSubgraph(n.Child)
	default:
		err := fmt.Errorf("%w: %T", ErrUnsupportedReorderNode, n)
		j.m.HandleErr(err)
	}
	return j.allVertices().difference(startV), j.allEdges().Difference(startE), group
}

// buildSingleLookupPlan attempts to build a plan consisting only of lookup joins.
func (j *joinOrderBuilder) buildSingleLookupPlan() bool {
	fds := j.m.root.RelProps.FuncDeps()
	fdKey, hasKey := fds.StrictKey()
	// fdKey is a set of columns which constrain all other columns in the join.
	// If a chain of lookups exist, then the columns in fdKey must be in the innermost join.
	if !hasKey {
		return false
	}
	// We need to include all of the fdKey columns in the innermost join.
	// For now, we just handle the case where the key is exactly one column.
	if fdKey.Len() != 1 {
		return false
	}
	for _, edge := range j.edges {
		if !edge.op.joinType.IsInner() {
			// This optimization currently only supports inner joins.
			return false
		}
	}
	keyColumn, _ := fdKey.Next(1)
	var currentlyJoinedTables sql.FastIntSet
	var currentlyJoinedVertexes vertexSet
	for i, n := range j.m.Root().RelProps.TableIdNodes() {
		if n.Columns().Contains(keyColumn) {
			currentlyJoinedTables.Add(int(n.Id()))
			currentlyJoinedVertexes = currentlyJoinedVertexes.add(uint64(i))
			break
		}
	}

	// removedEdges contains the edges that have already been incorporated into the new plan, so we don't repeat them.
	var succ bool
	removedEdges := edgeSet{}
	for removedEdges.Len() < len(j.vertices)-1 {
		type joinCandidate struct {
			nextEdgeIdx int
			nextTableId sql.TableId
		}
		var joinCandidates []joinCandidate

		// Find all possible filters that could be used for the next join in the sequence.
		// Store their corresponding edge and table ids in `joinCandidates`.
		for i, edge := range j.edges {
			if removedEdges.Contains(i) {
				continue
			}
			if len(edge.filters) == 0 {
				continue
			}
			if len(edge.filters) != 1 {
				panic("Found an edge with multiple filters (that was previously validated as an inner join.) This shouldn't be possible.")
			}
			filter := edge.filters[0]
			_, tables, _ := getExprScalarProps(filter)
			if tables.Len() != 2 || !isSimpleEquality(filter) {
				// We have encountered a filter condition more complicated than a simple equality check.
				// We probably can't optimize this, so bail out.
				return false
			}
			firstTab, _ := tables.Next(1)
			secondTab, _ := tables.Next(firstTab + 1)
			if currentlyJoinedTables.Contains(firstTab) {
				joinCandidates = append(joinCandidates, joinCandidate{
					nextEdgeIdx: i,
					nextTableId: sql.TableId(secondTab),
				})
			} else if currentlyJoinedTables.Contains(secondTab) {
				joinCandidates = append(joinCandidates, joinCandidate{
					nextEdgeIdx: i,
					nextTableId: sql.TableId(firstTab),
				})
			}
		}

		if len(joinCandidates) > 1 {
			// We end up here if there are multiple possible choices for the next join.
			// This could happen if there are redundant rules. For now, we bail out if this happens.
			return false
		}

		if len(joinCandidates) == 0 {
			// There are still tables left to join, but no more filters that match the already joined tables.
			// This can happen, for instance, if the remaining table is a single-row table that was cross-joined.
			// It's probably safe to just join the remaining tables here.
			remainingVertexes := j.allVertices().difference(currentlyJoinedVertexes)
			for idx, ok := remainingVertexes.next(0); ok; idx, ok = remainingVertexes.next(idx + 1) {
				nextVertex := newBitSet(idx)
				j.addJoin(plan.JoinTypeCross, currentlyJoinedVertexes, nextVertex, nil, nil, false)
				currentlyJoinedVertexes = currentlyJoinedVertexes.union(nextVertex)
			}
			return false
		}

		nextEdgeIdx := joinCandidates[0].nextEdgeIdx
		nextTableId := joinCandidates[0].nextTableId

		var nextVertex vertexSet
		for i, id := range j.vertexTableIds {
			if id == nextTableId {
				nextVertex = nextVertex.add(uint64(i))
				break
			}
		}

		edge := j.edges[nextEdgeIdx]

		isRedundant := edge.joinIsRedundant(currentlyJoinedVertexes, nextVertex)
		j.addJoin(plan.JoinTypeInner, currentlyJoinedVertexes, nextVertex, j.edges[nextEdgeIdx].filters, nil, isRedundant)

		currentlyJoinedVertexes = currentlyJoinedVertexes.union(nextVertex)
		currentlyJoinedTables.Add(int(nextTableId))
		removedEdges.Add(nextEdgeIdx)
		succ = true
	}
	return succ
}

// ensureClosure adds the closure of all transitive equivalency groups
// to the join tree. Each transitive edge will add an inner edge, filter,
// and join group that inherit join type and tree depth from the original
// join tree.
func (j *joinOrderBuilder) ensureClosure(grp *ExprGroup) {
	fds := grp.RelProps.FuncDeps()
	for _, set := range fds.Equiv().Sets() {
		for col1, hasNext1 := set.Next(1); hasNext1; col1, hasNext1 = set.Next(col1 + 1) {
			for col2, hasNext2 := set.Next(col1 + 1); hasNext2; col2, hasNext2 = set.Next(col2 + 1) {
				if !j.hasEqEdge(col1, col2) {
					j.makeTransitiveEdge(col1, col2)
				}
			}
		}
	}
}

// hasEqEdge returns true if the inner edges include a direct equality between
// the two given columns (e.g. x = a).
func (j *joinOrderBuilder) hasEqEdge(leftCol, rightCol sql.ColumnId) bool {
	for idx, ok := j.innerEdges.Next(0); ok; idx, ok = j.innerEdges.Next(idx + 1) {
		for _, f := range j.edges[idx].filters {
			var l *expression.GetField
			var r *expression.GetField
			switch f := f.(type) {
			case *expression.Equals:
				l, _ = f.Left().(*expression.GetField)
				r, _ = f.Right().(*expression.GetField)
			case *expression.NullSafeEquals:
				l, _ = f.Left().(*expression.GetField)
				r, _ = f.Right().(*expression.GetField)
			case expression.Equality:
				l, _ = f.Left().(*expression.GetField)
				r, _ = f.Right().(*expression.GetField)
			}
			if l == nil || r == nil {
				continue
			}
			if (r.Id() == leftCol && l.Id() == rightCol) ||
				(r.Id() == rightCol && l.Id() == leftCol) {
				return true
			}
		}
	}
	return false
}

func (j *joinOrderBuilder) findVertexFromCol(col sql.ColumnId) (vertexIndex, GroupId, bool) {
	for i, v := range j.vertices {
		if t, ok := v.(SourceRel); ok {
			if t.Group().RelProps.FuncDeps().All().Contains(col) {
				return vertexIndex(i), t.Group().Id, true
			}
		}
	}
	return 0, 0, false
}

func (j *joinOrderBuilder) findVertexFromGroup(grp GroupId) vertexIndex {
	for i, v := range j.vertices {
		if t, ok := v.(SourceRel); ok {
			if t.Group().Id == grp {
				return vertexIndex(i)
			}
		}
	}
	panic("vertex not found")
}

// makeTransitiveEdge constructs a new join tree edge and memo group
// on an equality filter between two columns.
func (j *joinOrderBuilder) makeTransitiveEdge(col1, col2 sql.ColumnId) {
	var vert vertexSet
	v1, _, v1found := j.findVertexFromCol(col1)
	v2, _, v2found := j.findVertexFromCol(col2)
	if !v1found || !v2found {
		return
	}
	vert = vert.add(v1).add(v2)

	// find edge where the vertices are provided but partitioned
	var op *operator
	for _, e := range j.edges {
		if vert.isSubsetOf(e.op.leftVertices.union(e.op.rightVertices)) &&
			!vert.isSubsetOf(e.op.leftVertices) &&
			!vert.isSubsetOf(e.op.rightVertices) {
			op = e.op
			break
		}
	}
	if op == nil || op.joinType.IsPartial() {
		// columns are common to one table, not a join edge
		// or, we are trying to semi join after columns have maybe been projected away
		return
	}

	var gf1, gf2 *expression.GetField
	for _, e := range j.edges {
		if gf1 != nil && gf2 != nil {
			break
		}
		for _, f := range e.filters {
			if cmp, ok := f.(expression.Comparer); ok {
				if gf, ok := cmp.Left().(*expression.GetField); ok && gf.Id() == col1 {
					gf1 = gf
				} else if ok && gf.Id() == col2 {
					gf2 = gf
				}
				if gf, ok := cmp.Right().(*expression.GetField); ok && gf.Id() == col1 {
					gf1 = gf
				} else if ok && gf.Id() == col2 {
					gf2 = gf
				}
			}
		}
	}
	if gf1 == nil || gf2 == nil {
		return
	}

	j.edges = append(j.edges, *j.makeEdge(op, expression.NewEquals(gf1, gf2)))
	j.innerEdges.Add(len(j.edges) - 1)

}

func (j *joinOrderBuilder) buildJoinOp(n *plan.JoinNode) *ExprGroup {
	leftV, leftE, _ := j.populateSubgraph(n.Left())
	rightV, rightE, _ := j.populateSubgraph(n.Right())
	typ := n.JoinType()
	if typ.IsPhysical() {
		typ = plan.JoinTypeInner
	}
	isInner := typ.IsInner()
	op := &operator{
		joinType:      typ,
		leftVertices:  leftV,
		rightVertices: rightV,
		leftEdges:     leftE,
		rightEdges:    rightE,
	}

	filters := expression.SplitConjunction(n.JoinCond())
	union := leftV.union(rightV)
	group, ok := j.plans[union]
	if !ok {
		// TODO: memo and root should be initialized prior to join planning
		left := j.plans[leftV]
		right := j.plans[rightV]
		group = j.memoize(op.joinType, left, right, filters, nil)
		j.plans[union] = group
		j.m.root = group
	}

	if !isInner {
		j.buildNonInnerEdge(op, filters...)
	} else {
		j.buildInnerEdge(op, filters...)
	}
	return group
}

func (j *joinOrderBuilder) buildFilter(child sql.Node, e sql.Expression) (vertexSet, edgeSet, *ExprGroup) {
	// memoize child
	childV, childE, childGrp := j.populateSubgraph(child)

	filterGrp := j.m.MemoizeFilter(nil, childGrp, expression.SplitConjunction(e))

	// filter will absorb child relation for join reordering
	j.plans[childV] = filterGrp

	return childV, childE, filterGrp
}

func (j *joinOrderBuilder) buildProject(n *plan.Project) (vertexSet, edgeSet, *ExprGroup) {
	// memoize child
	childV, childE, childGrp := j.populateSubgraph(n.Child)

	projGrp := j.m.MemoizeProject(nil, childGrp, n.Projections)

	// filter will absorb child relation for join reordering
	j.plans[childV] = projGrp
	return childV, childE, projGrp
}

func (j *joinOrderBuilder) buildMax1Row(n *plan.Max1Row) (vertexSet, edgeSet, *ExprGroup) {
	// memoize child
	childV, childE, childGrp := j.populateSubgraph(n.Child)

	max1Grp := j.m.MemoizeMax1Row(nil, childGrp)

	j.plans[childV] = max1Grp
	return childV, childE, max1Grp
}

func (j *joinOrderBuilder) buildJoinLeaf(n plan.TableIdNode) *ExprGroup {
	j.checkSize()

	var rel SourceRel
	b := &sourceBase{relBase: &relBase{}}
	switch n := n.(type) {
	case *plan.ResolvedTable:
		rel = &TableScan{sourceBase: b, Table: n}
	case *plan.TableAlias:
		rel = &TableAlias{sourceBase: b, Table: n}
	case *plan.RecursiveTable:
		rel = &RecursiveTable{sourceBase: b, Table: n}
	case *plan.SubqueryAlias:
		rel = &SubqueryAlias{sourceBase: b, Table: n}
	case *plan.RecursiveCte:
		rel = &RecursiveCte{sourceBase: b, Table: n}
	case *plan.IndexedTableAccess:
		rel = &TableScan{sourceBase: b, Table: n.TableNode.(plan.TableIdNode)}
	case *plan.ValueDerivedTable:
		rel = &Values{sourceBase: b, Table: n}
	case *plan.JSONTable:
		rel = &JSONTable{sourceBase: b, Table: n}
	case sql.TableFunction:
		rel = &TableFunc{sourceBase: b, Table: n}
	case *plan.EmptyTable:
		rel = &EmptyTable{sourceBase: b, Table: n}
	case *plan.SetOp:
		rel = &SetOp{sourceBase: b, Table: n}
	default:
		err := fmt.Errorf("%w: %T", ErrUnsupportedReorderNode, n)
		j.m.HandleErr(err)
	}

	j.vertices = append(j.vertices, rel)

	// Initialize the plan for this vertex.
	idx := vertexIndex(len(j.vertices) - 1)
	relSet := vertexSet(0).add(idx)
	grp := j.m.memoizeSourceRel(rel)
	j.plans[relSet] = grp
	j.vertexGroups = append(j.vertexGroups, grp.Id)
	j.vertexTableIds = append(j.vertexTableIds, n.Id())
	return grp
}

func (j *joinOrderBuilder) buildInnerEdge(op *operator, filters ...sql.Expression) {
	if len(filters) == 0 {
		// cross join
		j.edges = append(j.edges, *j.makeEdge(op))
		j.innerEdges.Add(len(j.edges) - 1)
		return
	}
	for _, f := range filters {
		j.edges = append(j.edges, *j.makeEdge(op, f))
		j.innerEdges.Add(len(j.edges) - 1)
	}
}

func (j *joinOrderBuilder) buildNonInnerEdge(op *operator, filters ...sql.Expression) {
	// only single edge for non-inner
	j.edges = append(j.edges, *j.makeEdge(op, filters...))
	j.nonInnerEdges.Add(len(j.edges) - 1)
}

func (j *joinOrderBuilder) makeEdge(op *operator, filters ...sql.Expression) *edge {
	// edge is an instance of operator with a unique set of transform rules depending
	// on the subset of filters used
	e := &edge{
		op:      op,
		filters: filters,
	}
	// we build the graph upwards. so when me make this edge, all
	// of the dependency operators and edges have already been constructed
	// TODO: validate malformed join clauses like `ab join xy on a = u`
	// prior to join planning, execBuilder currently throws getField errors
	// for these
	e.populateEdgeProps(j.vertexTableIds, j.edges)
	return e
}

// checkSize prevents more than 64 tables
func (j *joinOrderBuilder) checkSize() {
	if len(j.vertices) > 1<<7 {
		panic("tried joining > 64 tables")
	}
}

// dpEnumerateSubsets iterates all disjoint combinations of table sets,
// adding plans to the tree when we find two sets that can
// be joined
func (j *joinOrderBuilder) dpEnumerateSubsets() {
	all := j.allVertices()
	for subset := vertexSet(1); subset <= all; subset++ {
		if subset.isSingleton() {
			continue
		}
		for s1 := vertexSet(1); s1 <= subset/2; s1++ {
			if !s1.isSubsetOf(subset) {
				continue
			}
			s2 := subset.difference(s1)
			j.addPlans(s1, s2)
		}
	}
}

func setPrinter(all, s1, s2 vertexSet) {
	s1Arr := make([]string, all.len())
	for i := range s1Arr {
		s1Arr[i] = "0"
	}
	s2Arr := make([]string, all.len())
	for i := range s2Arr {
		s2Arr[i] = "0"
	}
	for idx, ok := s1.next(0); ok; idx, ok = s1.next(idx + 1) {
		s1Arr[idx] = "1"
	}
	for idx, ok := s2.next(0); ok; idx, ok = s2.next(idx + 1) {
		s2Arr[idx] = "1"
	}
	fmt.Printf("s1: %s, s2: %s\n", strings.Join(s1Arr, ""), strings.Join(s2Arr, ""))
}

// addPlans finds operators that let us join (s1 op s2) and (s2 op s1).
func (j *joinOrderBuilder) addPlans(s1, s2 vertexSet) {
	// all inner filters could be applied
	if j.plans[s1] == nil || j.plans[s2] == nil {
		// Both inputs must have plans.
		// need this to prevent cross-joins higher in tree
		return
	}

	//TODO collect all inner join filters that can be used as select filters
	//TODO collect functional dependencies to avoid redundant filters
	//TODO relational nodes track functional dependencies

	var innerJoinFilters []sql.Expression
	var addInnerJoin bool
	var isRedundant bool
	for i, ok := j.innerEdges.Next(0); ok; i, ok = j.innerEdges.Next(i + 1) {
		e := &j.edges[i]
		// Ensure that this edge forms a valid connection between the two sets.
		if e.applicable(s1, s2) {
			if e.filters != nil {
				innerJoinFilters = append(innerJoinFilters, e.filters...)
			}
			isRedundant = isRedundant || e.joinIsRedundant(s1, s2)
			addInnerJoin = true
		}
	}

	// Because transitive closure can accidentally replace nonInner op with inner op,
	// avoid building inner plans when an op has a valid nonInner plan.
	for i, ok := j.nonInnerEdges.Next(0); ok; i, ok = j.nonInnerEdges.Next(i + 1) {
		e := &j.edges[i]
		if e.applicable(s1, s2) {
			j.addJoin(e.op.joinType, s1, s2, e.filters, innerJoinFilters, e.joinIsRedundant(s1, s2))
			return
		}
		if e.applicable(s2, s1) {
			// This is necessary because we only iterate s1 up to subset / 2
			// in DPSube()
			j.addJoin(e.op.joinType, s2, s1, e.filters, innerJoinFilters, e.joinIsRedundant(s2, s1))
			return
		}
	}

	if addInnerJoin {
		// Construct an inner join. Don't add in the case when a non-inner join has
		// already been constructed, because doing so can lead to a case where an
		// inner join replaces a non-inner join.
		if innerJoinFilters == nil {
			j.addJoin(plan.JoinTypeCross, s1, s2, nil, nil, isRedundant)
		} else {
			j.addJoin(plan.JoinTypeInner, s1, s2, innerJoinFilters, nil, isRedundant)
		}
	}
}

func (j *joinOrderBuilder) addJoin(op plan.JoinType, s1, s2 vertexSet, joinFilter, selFilters []sql.Expression, isRedundant bool) {
	if s1.intersects(s2) {
		panic("sets are not disjoint")
	}
	union := s1.union(s2)
	left := j.plans[s1]
	right := j.plans[s2]

	group, ok := j.plans[union]
	if !isRedundant {
		if !ok {
			group = j.memoize(op, left, right, joinFilter, selFilters)
			j.plans[union] = group
		} else {
			j.addJoinToGroup(op, left, right, joinFilter, selFilters, group)
		}
	}

	if commute(op) {
		j.addJoinToGroup(op, right, left, joinFilter, selFilters, group)
	}
}

// addJoinToGroup adds a new plan to existing groups
func (j *joinOrderBuilder) addJoinToGroup(
	op plan.JoinType,
	left *ExprGroup,
	right *ExprGroup,
	joinFilter []sql.Expression,
	selFilter []sql.Expression,
	group *ExprGroup,
) {
	for _, ok := group.First.(JoinRel); !ok; _, ok = group.First.(JoinRel) {
		// A top-level intermediate group is used to represent a logical
		// join set. The intermediate group lets us track dependencies for
		// specialized join operators, but reorder should add to the nearest
		// join group rather than the intermediate group.
		switch e := group.First.(type) {
		case *Filter:
			group = e.Child
		case *Project:
			group = e.Child
		case *Distinct:
			group = e.Child
		default:
			j.m.HandleErr(fmt.Errorf("failed to reorder join, unexpected intermediate expression: %T", e))
		}
	}
	rel := j.constructJoin(op, left, right, joinFilter, group)
	group.Prepend(rel)
	return
}

// memoize
func (j *joinOrderBuilder) memoize(
	op plan.JoinType,
	left *ExprGroup,
	right *ExprGroup,
	joinFilter []sql.Expression,
	selFilter []sql.Expression,
) *ExprGroup {
	rel := j.constructJoin(op, left, right, joinFilter, nil)
	return j.m.NewExprGroup(rel)
}

func (j *joinOrderBuilder) constructJoin(
	op plan.JoinType,
	left *ExprGroup,
	right *ExprGroup,
	joinFilter []sql.Expression,
	group *ExprGroup,
) RelExpr {
	var rel RelExpr
	b := &JoinBase{
		Op:      op,
		relBase: &relBase{g: group},
		Left:    left,
		Right:   right,
		Filter:  joinFilter,
	}
	switch op {
	case plan.JoinTypeCross:
		rel = &CrossJoin{b}
	case plan.JoinTypeInner:
		rel = &InnerJoin{b}
	case plan.JoinTypeFullOuter:
		rel = &FullOuterJoin{b}
	case plan.JoinTypeLeftOuter:
		rel = &LeftJoin{b}
	case plan.JoinTypeSemi:
		rel = &SemiJoin{b}
	case plan.JoinTypeAnti, plan.JoinTypeAntiIncludeNulls:
		rel = &AntiJoin{b}
	case plan.JoinTypeLateralInner, plan.JoinTypeLateralCross,
		plan.JoinTypeLateralRight, plan.JoinTypeLateralLeft:
		rel = &LateralJoin{b}
		b.Op = op
	default:
		panic(fmt.Sprintf("unexpected join type: %s", op))
	}

	if j.newPlanCb != nil {
		j.newPlanCb(j, rel)
	}

	return rel
}

func (j *joinOrderBuilder) allVertices() vertexSet {
	// all bits set to one
	return vertexSet((1 << len(j.vertices)) - 1)
}

func (j *joinOrderBuilder) allEdges() edgeSet {
	all := edgeSet{}
	for i := range j.edges {
		all.Add(i)
	}
	return all
}

// operator contains the properties of a join operator from the original join
// tree. It is used in calculating the total eligibility sets for edges from any
// 'parent' joins which were originally above this one in the tree.
type operator struct {
	// leftEdges is the set of edges that were constructed from join operators
	// that were in the left input of the original join operator.
	leftEdges edgeSet
	// rightEdgers is the set of edges that were constructed from join operators
	// that were in the right input of the original join operator.
	rightEdges edgeSet
	// leftVertices is the set of vertexes (base relations) that were in the left
	// input of the original join operator.
	leftVertices vertexSet
	// rightVertices is the set of vertexes (base relations) that were in the
	// right input of the original join operator.
	rightVertices vertexSet
	// joinType is the operator type of the original join operator.
	joinType plan.JoinType
}

// edge is a generalization of a join edge that embeds rules for
// determining the applicability of arbitrary subtrees. An edge is added to the
// join graph when a new plan can be constructed between two vertexSet.
type edge struct {
	freeVars sql.ColSet
	// op is the original join node source for the edge. there are multiple edges
	// per op for inner joins with conjunct-predicate join conditions. Different predicates
	// will have different conflict rules.
	op *operator
	// filters is the set of join filters that will be used to construct new join
	// ON conditions.
	filters []sql.Expression
	// rules is a set of conflict rules which must evaluate to true in order for
	// a join between two sets of vertexes to be valid.
	rules []conflictRule
	// nullRejectedRels is the set of vertexes on which nulls are rejected by the
	// filters. We do not set any nullRejectedRels currently, which is not accurate
	// but prevents potentially invalid transformations.
	nullRejectedRels vertexSet
	// ses is the syntactic eligibility set of the edge; in other words, it is the
	// set of base relations (tables) referenced by the filters field.
	ses vertexSet
	// tes is the total eligibility set of the edge. The TES gives the set of base
	// relations (vertexes) that must be in the input of any join that uses the
	// filters from this edge in its ON condition. The TES is initialized with the
	// SES, and then expanded by the conflict detection algorithm.
	tes vertexSet
}

func (e *edge) populateEdgeProps(tableIds []sql.TableId, edges []edge) {
	var tables sql.FastIntSet
	var cols sql.ColSet
	if len(e.filters) > 0 {
		for _, e := range e.filters {
			eCols, eTabs, _ := getExprScalarProps(e)
			cols = cols.Union(eCols)
			tables = tables.Union(eTabs)
		}
	}

	// TODO vertexes and tableIds?

	e.freeVars = cols

	// TODO implement, we currently limit transforms assuming no strong null safety
	//e.nullRejectedRels = e.nullRejectingTables(nullAccepting, allNames, allV)

	//SES is vertexSet of all tables referenced in cols
	e.calcSES(tables, tableIds)
	// use CD-C to expand dependency sets for operators
	// front load preventing applicable operators that would push crossjoins
	e.calcTES(edges)
}

func (e *edge) String() string {
	b := strings.Builder{}
	b.WriteString("edge\n")
	b.WriteString(fmt.Sprintf("  - joinType: %s\n", e.op.joinType.String()))
	if e.filters != nil {
		b.WriteString(" - on: ")
		sep := ""
		for _, e := range e.filters {
			b.WriteString(fmt.Sprintf("%s%s", sep, e.String()))
		}
		b.WriteString("\n")
	}
	b.WriteString(fmt.Sprintf("  - free vars: %s\n", e.freeVars.String()))
	b.WriteString(fmt.Sprintf("  - ses: %s\n", e.ses.String()))
	b.WriteString(fmt.Sprintf("  - tes: %s\n", e.tes.String()))
	b.WriteString(fmt.Sprintf("  - nullRej: %s\n", e.nullRejectedRels.String()))
	return b.String()
}

// nullRejectingTables is a subset of the SES such that for every
// null rejecting table, if all attributes of the table are null,
// we can make a strong guarantee that the edge filters will not
// evaluate to TRUE (FALSE or NULL are OK).
//
// For example, the filters (a.x = b.x OR a.x IS NOT NULL) is null
// rejecting on (b), but not (a).
//
// A second more complicated example is null rejecting both on (a,b):
//
//	CASE
//	  WHEN a.x IS NOT NULL THEN a.x = b.x
//	  WHEN a.x <=> 2 THEN TRUE
//	  ELSE NULL
//	END
//
// Refer to https://dl.acm.org/doi/10.1145/244810.244812 for more examples.
// TODO implement this
func (e *edge) nullRejectingTables(nullAccepting []sql.Expression, allNames []string, allV vertexSet) vertexSet {
	panic("not implemented")
}

// calcSES updates the syntactic eligibility set for an edge. An SES
// represents all tables this edge's filters requires as input.
func (e *edge) calcSES(tables sql.FastIntSet, tableIds []sql.TableId) {
	ses := vertexSet(0)
	for i, ok := tables.Next(0); ok; i, ok = tables.Next(i + 1) {
		for j, tabId := range tableIds {
			// table ids, group ids, and vertex ids are all distinct
			if sql.TableId(i) == tabId {
				ses = ses.add(vertexIndex(j))
				break
			}
		}
	}
	e.ses = ses
}

// calcTES in place updates an edge's total eligibility set. TES is a way
// to expand the eligibility sets (the table dependencies) for an edge to
// prevent invalid plans. Most of this is verbatim from the paper, but we
// add additional restrictions for cross and left joins.
func (e *edge) calcTES(edges []edge) {
	e.tes = e.ses

	// Degenerate predicates include 1) cross joins and 2) inner joins
	// whose filters do not restrict that cardinality of the subtree
	// inputs. We check for both by comparing i) the filter SES to ii) the tables
	// provided by the left/right subtrees. If one or both do not overlap,
	// the degenerate edge will be frozen in reference to the original plan
	// by expanding the TES to require the left/right subtree dependencies.
	//
	//	 note: this is different from the paper, which instead adds a check
	//   to applicable:
	//     op.leftVertices.intersect(s1) || op.rightVertices.intersect(s2)
	//   An operation is only applicable if the left tree provides a subset
	//   of s1 or the right tree provides a subset of s2. This is logically
	//   equivalent to expanding the TES here, but front-loads this logic
	//   because a bigger TES earlier reduces the conflict checking work.
	if !e.tes.intersects(e.op.leftVertices) {
		e.tes = e.tes.union(e.op.leftVertices)
	}
	if !e.tes.intersects(e.op.rightVertices) {
		e.tes = e.tes.union(e.op.rightVertices)
	}

	// left join can't be moved such that we transpose left-dependencies
	if e.op.joinType.IsLeftOuter() {
		e.tes = e.tes.union(e.op.leftVertices)
	}

	// CD-C algorithm
	// Note: the ordering of the transform(eA, eB) functions are important.
	// eA is the subtree child edge targeted for rearrangement. If the ordering
	// is switched, the output is nondeterministic.

	// iterate every eA in STO(left(eB))
	eB := e
	for idx, ok := eB.op.leftEdges.Next(0); ok; idx, ok = eB.op.leftEdges.Next(idx + 1) {
		if eB.op.leftVertices.isSubsetOf(eB.tes) {
			// Fast path to break out early: the TES includes all relations from the
			// left input.
			break
		}
		eA := &edges[idx]
		if !assoc(eA, eB) {
			// The edges are not associative, so add a conflict rule mapping from the
			// right input relations of the child to its left input relations.
			rule := conflictRule{from: eA.op.rightVertices}
			if eA.op.leftVertices.intersects(eA.ses) {
				// A less restrictive conflict rule can be added in this case.
				rule.to = eA.op.leftVertices.intersection(eA.ses)
			} else {
				rule.to = eA.op.leftVertices
			}
			eB.addRule(rule)
		}
		if !leftAsscom(eA, eB) {
			// Left-asscom does not hold, so add a conflict rule mapping from the
			// left input relations of the child to its right input relations.
			rule := conflictRule{from: eA.op.leftVertices}
			if eA.op.rightVertices.intersects(eA.ses) {
				// A less restrictive conflict rule can be added in this case.
				rule.to = eA.op.rightVertices.intersection(eA.ses)
			} else {
				rule.to = eA.op.rightVertices
			}
			eB.addRule(rule)
		}
	}

	for idx, ok := e.op.rightEdges.Next(0); ok; idx, ok = e.op.rightEdges.Next(idx + 1) {
		if e.op.rightVertices.isSubsetOf(e.tes) {
			// Fast path to break out early: the TES includes all relations from the
			// right input.
			break
		}
		eA := &edges[idx]
		if !assoc(eB, eA) {
			// The edges are not associative, so add a conflict rule mapping from the
			// left input relations of the child to its right input relations.
			rule := conflictRule{from: eA.op.leftVertices}
			if eA.op.rightVertices.intersects(eA.ses) {
				// A less restrictive conflict rule can be added in this case.
				rule.to = eA.op.rightVertices.intersection(eA.ses)
			} else {
				rule.to = eA.op.rightVertices
			}
			eB.addRule(rule)
		}
		if !rightAsscom(eB, eA) {
			// Right-asscom does not hold, so add a conflict rule mapping from the
			// right input relations of the child to its left input relations.
			rule := conflictRule{from: eA.op.rightVertices}
			if eA.op.leftVertices.intersects(eA.ses) {
				// A less restrictive conflict rule can be added in this case.
				rule.to = eA.op.leftVertices.intersection(eA.ses)
			} else {
				rule.to = eA.op.leftVertices
			}
			eB.addRule(rule)
		}
	}
}

// addRule adds the given conflict rule to the edge. Before the rule is added to
// the rules set, an effort is made to eliminate the need for the rule.
func (e *edge) addRule(rule conflictRule) {
	if rule.from.intersects(e.tes) {
		// If the 'from' relation set intersects the total eligibility set, simply
		// add the 'to' set to the TES because the rule will always be triggered.
		e.tes = e.tes.union(rule.to)
		return
	}
	if rule.to.isSubsetOf(e.tes) {
		// If the 'to' relation set is a subset of the total eligibility set, the
		// rule is a do-nothing.
		return
	}
	e.rules = append(e.rules, rule)
}

func (e *edge) applicable(s1, s2 vertexSet) bool {
	if !e.checkRules(s1, s2) {
		// The conflict rules for this edge are not satisfied for a join between s1
		// and s2.
		return false
	}
	switch e.op.joinType {
	case plan.JoinTypeInner:
		// The TES must be a subset of the relations of the candidate join inputs. In
		// addition, the TES must intersect both s1 and s2 (the edge must connect the
		// two vertex sets).
		return e.tes.isSubsetOf(s1.union(s2)) && e.tes.intersects(s1) && e.tes.intersects(s2)
	default:
		// The left TES must be a subset of the s1 relations, and the right TES must
		// be a subset of the s2 relations. In addition, the TES must intersect both
		// s1 and s2 (the edge must connect the two vertex sets).
		return e.tes.intersection(e.op.leftVertices).isSubsetOf(s1) &&
			e.tes.intersection(e.op.rightVertices).isSubsetOf(s2) &&
			e.tes.intersects(s1) && e.tes.intersects(s2)
	}
}

// checkRules iterates through the edge's rules and returns false if a conflict
// is detected for the given sets of join input relations. Otherwise, returns
// true.
func (e *edge) checkRules(s1, s2 vertexSet) bool {
	s := s1.union(s2)
	for _, rule := range e.rules {
		if rule.from.intersects(s) && !rule.to.isSubsetOf(s) {
			// The join is invalid because it does not obey this conflict rule.
			return false
		}
	}
	return true
}

// joinIsRedundant returns true if a join between the two sets of base relations
// was already present in the original join tree. If so, enumerating this join
// would be redundant, so it should be skipped.
func (e *edge) joinIsRedundant(s1, s2 vertexSet) bool {
	return e.op.leftVertices == s1 && e.op.rightVertices == s2
}

type assocTransform func(eA, eB *edge) bool

// assoc checks whether the associate is applicable
// to a binary operator tree. We consider 1) generating cross joins,
// and 2) the left/right operator join types for this specific transform.
// The below is a valid association that generates no crossjoin:
//
//	(e2 op_a_12 e1) op_b_13 e3
//	=>
//	e2 op_a_12 (e1 op_b_13 e3)
//
// note: important to compare edge ordering for left deep tree.
func assoc(eA, eB *edge) bool {
	if eB.ses.intersects(eA.op.leftVertices) || eA.ses.intersects(eB.op.rightVertices) {
		// associating two operators can estrange the distant relation.
		// for example:
		//   (e2 op_a_12 e1) op_b_13 e3
		//   =>
		//   e2 op_a_12 (e1 op_b_13 e3)
		// The first operator, a, takes explicit dependencies on e1 and e2.
		// The second operator, b, takes explicit dependencies on e1 and e3.
		// Associating these two will isolate e2 from op_b for the downward
		// transform, and e3 from op_a on the upward transform, both of which
		// are valid. The same is not true for the transform below:
		//   (e2 op_a_12 e1) op_b_32 e3
		//   =>
		//   e2 op_a_12 (e1 op_b_32 e3)
		// Isolating e2 from op_b makes op_b degenerate, producing a cross join.
		return false
	}
	return checkProperty(assocTable, eA, eB)
}

// leftAsscom checks whether the left-associate+commute is applicable
// to a binary operator tree. We consider 1) generating cross joins,
// and 2) the left/right operator join types for this specific transform.
// For example:
//
//	(e1 op_a_12 e2) op_b_13 e3
//	=>
//	(e1 op_b_13 e3) op_a_12 e2
func leftAsscom(eA, eB *edge) bool {
	if eB.ses.intersects(eA.op.rightVertices) || eA.ses.intersects(eB.op.rightVertices) {
		// Associating two operators can estrange the distant relation.
		// For example:
		//	(e1 op_a_12 e2) op_b_23 e3
		//	=>
		//	(e1 op_b_23 e3) op_a_12 e2
		// Isolating e2 from op_b makes op_b degenerate, producing a cross join.
		return false
	}
	return checkProperty(leftAsscomTable, eA, eB)
}

// rAsscom checks whether the right-associate+commute is applicable
// to a binary operator tree. We consider 1) generating cross joins,
// and 2) the left/right operator join types for this specific transform.
// For example:
//
//	e1 op_b_13 (e2 op_a_23 e3)
//	=>
//	e2 op_a_23 (e1 op_b_13 e3)
func rightAsscom(eA, eB *edge) bool {
	if eB.ses.intersects(eA.op.leftVertices) || eA.ses.intersects(eB.op.leftVertices) {
		// Associating two operators can estrange the distant relation.
		// For example:
		//	e3 op_b_23 (e1 op_a_12 e3)
		//	=>
		//	e2 op_a_12 (e1 op_b_23 e3)
		// Isolating e2 from op_b makes op_b degenerate, producing a cross join.
		return false
	}
	return checkProperty(rightAsscomTable, eA, eB)
}

// commute transforms an operator tree by alternating child
// join ordering.
// For example:
//
//	e1 op e2
//	=>
//	e2 op e1
func commute(op plan.JoinType) bool {
	return op == plan.JoinTypeInner || op == plan.JoinTypeCross
}

// conflictRule is a pair of vertex sets which carry the requirement that if the
// 'from' set intersects a set of prospective join input relations, then the
// 'to' set must be a subset of the input relations (from -> to). Take the
// following query as an example:
//
//	SELECT * FROM xy
//	INNER JOIN (SELECT * FROM ab LEFT JOIN uv ON a = u)
//	ON x = a
//
// During execution of the CD-C algorithm, the following conflict rule would
// be added to inner join edge: [uv -> ab]. This means that, for any join that
// uses this edge, the presence of uv in the set of input relations implies the
// presence of ab. This prevents an inner join between relations xy and uv
// (since then ab would not be an input relation). Note that, in practice, this
// conflict rule would be absorbed into the TES because ab is a part of the
// inner join edge's SES (see the addRule func).
type conflictRule struct {
	from vertexSet
	to   vertexSet
}

// lookupTableEntry is an entry in one of the join property Lookup tables
// defined below (associative, left-asscom and right-asscom properties). A
// lookupTableEntry can be unconditionally true or false, as well as true
// conditional on the null-rejecting properties of the edge filters.
type lookupTableEntry uint8

const (
	// never indicates that the transformation represented by the table entry is
	// unconditionally incorrect.
	never lookupTableEntry = 0

	// always indicates that the transformation represented by the table entry is
	// unconditionally correct.
	always lookupTableEntry = 1 << (iota - 1)

	// filterA indicates that the filters of the "A" join edge must reject
	// nulls for the set of vertexes specified by rejectsOnLeftA, rejectsOnRightA,
	// etc.
	filterA

	// filterB indicates that the filters of the "B" join edge must reject
	// nulls for the set of vertexes specified by rejectsOnLeftA, rejectsOnRightA,
	// etc.
	filterB

	// rejectsOnLeftA indicates that the filters must reject nulls for the left
	// input relations of edge "A".
	rejectsOnLeftA

	// rejectsOnRightA indicates that the filters must reject nulls for the right
	// input relations of edge "A".
	rejectsOnRightA

	// rejectsOnRightB indicates that the filters must reject nulls for the right
	// input relations of edge "B".
	rejectsOnRightB

	// table2Note1 indicates that the filters of edge "B" must reject nulls on
	// the relations of the right input of edge "A".
	// Citations: [8] Table 2 Footnote 1.
	table2Note1 = filterB | rejectsOnRightA

	// table2Note2 indicates that the filters of operators "A" and "B" must reject
	// nulls on the relations of the right input of edge "A".
	// Citations: [8] Table 2 Footnote 2.
	table2Note2 = (filterA | filterB) | rejectsOnRightA

	// table3Note1 indicates that the filters of edge "A" must reject nulls on
	// the relations of the left input of edge "A".
	// Citations: [8] Table 3 Footnote 1.
	table3Note1 = filterA | rejectsOnLeftA

	// table3Note2 indicates that the filters of edge "B" must reject nulls on
	// the relations of the right input of edge "B".
	// Citations: [8] Table 3 Footnote 1]2.
	table3Note2 = filterB | rejectsOnRightB

	// table3Note3 indicates that the filters of operators "A" and "B" must reject
	// nulls on the relations of the left input of edge "A".
	// Citations: [8] Table 3 Footnote 3.
	table3Note3 = (filterA | filterB) | rejectsOnLeftA

	// table3Note4 indicates that the filters of operators "A" and "B" must reject
	// nulls on the relations of the right input of edge "B".
	// Citations: [8] Table 3 Footnote 4.
	table3Note4 = (filterA | filterB) | rejectsOnRightB
)

// assocTable is a Lookup table indicating whether it is correct to apply the
// associative transformation to pairs of join operators.
// citations: [8] table 2
var assocTable = [8][8]lookupTableEntry{
	//             cross-B inner-B semi-B  anti-B  left-B  full-B group-B lateral-B
	/* cross-A   */ {always, always, always, always, always, never, always, never},
	/* inner-A   */ {always, always, always, always, always, never, always, never},
	/* semi-A    */ {never, never, never, never, never, never, never, never},
	/* anti-A    */ {never, never, never, never, never, never, never, never},
	/* left-A    */ {never, never, never, never, table2Note1, never, never, never},
	/* full-A    */ {never, never, never, never, table2Note1, table2Note2, never},
	/* group-A   */ {never, never, never, never, never, never, never, never},
	/* lateral-A */ {never, never, never, never, never, never, never, never},
}

// leftAsscomTable is a Lookup table indicating whether it is correct to apply
// the left-asscom transformation to pairs of join operators.
// citations: [8] table 3
var leftAsscomTable = [8][8]lookupTableEntry{
	//             cross-A inner-B semi-B  anti-B  left-B  full-B group-B lateral-B
	/* cross-A   */ {always, always, always, always, always, never, always, never},
	/* inner-A   */ {always, always, always, always, always, never, always, never},
	/* semi-A    */ {always, always, always, always, always, never, always, never},
	/* anti-A    */ {always, always, always, always, always, never, always, never},
	/* left-A    */ {always, always, always, always, always, table3Note1, always, never},
	/* full-A    */ {never, never, never, never, table3Note2, table3Note3, never, never},
	/* group-A   */ {always, always, always, always, always, never, always, never},
	/* lateral-A */ {never, never, never, never, never, never, never, never},
}

// rightAsscomTable is a Lookup table indicating whether it is correct to apply
// the right-asscom transformation to pairs of join operators.
// citations: [8] table 3
var rightAsscomTable = [8][8]lookupTableEntry{
	//             cross-B inner-B semi-B anti-B left-B full-B group-B lateral-B
	/* cross-A */ {always, always, never, never, never, never, never, never},
	/* inner-A */ {always, always, never, never, never, never, never, never},
	/* semi-A  */ {never, never, never, never, never, never, never, never},
	/* anti-A  */ {never, never, never, never, never, never, never, never},
	/* left-A  */ {never, never, never, never, never, never, never},
	/* full-A  */ {never, never, never, never, never, table3Note4, never, never},
	/* group-A */ {never, never, never, never, never, never, never, never},
	/* lateral-A */ {never, never, never, never, never, never, never, never},
}

// checkProperty returns true if the transformation represented by the given
// property Lookup table is allowed for the two given edges. Note that while
// most table entries are either true or false, some are conditionally true,
// depending on the null-rejecting properties of the edge filters (for example,
// association for two full joins).
func checkProperty(table [8][8]lookupTableEntry, edgeA, edgeB *edge) bool {
	entry := table[getOpIdx(edgeA)][getOpIdx(edgeB)]

	if entry == never {
		// Application of this transformation property is unconditionally incorrect.
		return false
	}
	if entry == always {
		// Application of this transformation property is unconditionally correct.
		return true
	}

	// This property is conditionally applicable. Get the relations that must be
	// null-rejected by the filters.
	var candidateNullRejectRels vertexSet
	if entry&rejectsOnLeftA != 0 {
		// Filters must null-reject on the left input vertexes of edgeA.
		candidateNullRejectRels = edgeA.op.leftVertices
	} else if entry&rejectsOnRightA != 0 {
		// Filters must null-reject on the right input vertexes of edgeA.
		candidateNullRejectRels = edgeA.op.rightVertices
	} else if entry&rejectsOnRightB != 0 {
		// Filters must null-reject on the right input vertexes of edgeB.
		candidateNullRejectRels = edgeA.op.rightVertices
	}

	// Check whether the edge filters reject nulls on nullRejectRelations.
	if entry&filterA != 0 {
		// The filters of edgeA must reject nulls on one or more of the relations in
		// nullRejectRelations.
		if !edgeA.nullRejectedRels.intersects(candidateNullRejectRels) {
			return false
		}
	}
	if entry&filterB != 0 {
		// The filters of edgeB must reject nulls on one or more of the relations in
		// nullRejectRelations.
		if !edgeB.nullRejectedRels.intersects(candidateNullRejectRels) {
			return false
		}
	}
	return true
}

// getOpIdx returns an index into the join property static Lookup tables given an edge
// with an associated edge type. I originally used int(joinType), but this is fragile
// to reordering the type definitions.
func getOpIdx(e *edge) int {
	switch e.op.joinType {
	case plan.JoinTypeCross:
		return 0
	case plan.JoinTypeInner:
		return 1
	case plan.JoinTypeSemi:
		return 2
	case plan.JoinTypeAnti, plan.JoinTypeAntiIncludeNulls:
		return 3
	case plan.JoinTypeLeftOuter:
		return 4
	case plan.JoinTypeFullOuter:
		return 5
	case plan.JoinTypeGroupBy:
		return 6
	case plan.JoinTypeLateralInner, plan.JoinTypeLateralCross,
		plan.JoinTypeLateralRight, plan.JoinTypeLateralLeft:
		return 7
	default:
		panic(fmt.Sprintf("invalid operator: %v", e.op.joinType))
	}
}

type edgeSet = sql.FastIntSet

type bitSet uint64

// vertexSet represents a set of base relations that form the vertexes of the
// join graph.
type vertexSet = bitSet

const maxSetSize = 63

// vertexIndex represents the ordinal position of a base relation in the
// JoinOrderBuilder vertexes field. vertexIndex must be less than maxSetSize.
type vertexIndex = uint64

func newBitSet(idxs ...uint64) (res bitSet) {
	for _, idx := range idxs {
		res = res.add(idx)
	}
	return res
}

// add returns a copy of the bitSet with the given element added.
func (s bitSet) add(idx uint64) bitSet {
	if idx > maxSetSize {
		panic(fmt.Sprintf("cannot insert %d into bitSet", idx))
	}
	return s | (1 << idx)
}

// remove returns a copy of the bitSet with the given element removed.
func (s bitSet) remove(idx uint64) bitSet {
	if idx > maxSetSize {
		panic(fmt.Sprintf("%d is invalid index for bitSet", idx))
	}
	return s & ^(1 << idx)
}

// contains returns whether a bitset contains a given element.
func (s bitSet) contains(idx uint64) bool {
	if idx > maxSetSize {
		panic(fmt.Sprintf("%d is invalid index for bitSet", idx))
	}
	return s&(1<<idx) != 0
}

// union returns the set union of this set with the given set.
func (s bitSet) union(o bitSet) bitSet {
	return s | o
}

// intersection returns the set intersection of this set with the given set.
func (s bitSet) intersection(o bitSet) bitSet {
	return s & o
}

// difference returns the set difference of this set with the given set.
func (s bitSet) difference(o bitSet) bitSet {
	return s & ^o
}

// intersects returns true if this set and the given set intersect.
func (s bitSet) intersects(o bitSet) bool {
	return s.intersection(o) != 0
}

// isSubsetOf returns true if this set is a subset of the given set.
func (s bitSet) isSubsetOf(o bitSet) bool {
	return s.union(o) == o
}

// isSingleton returns true if the set has exactly one element.
func (s bitSet) isSingleton() bool {
	return s > 0 && (s&(s-1)) == 0
}

// next returns the next element in the set after the given start index, and
// a bool indicating whether such an element exists.
func (s bitSet) next(startVal uint64) (elem uint64, ok bool) {
	if startVal < maxSetSize {
		if ntz := bits.TrailingZeros64(uint64(s >> startVal)); ntz < 64 {
			return startVal + uint64(ntz), true
		}
	}
	return uint64(math.MaxInt64), false
}

// len returns the number of elements in the set.
func (s bitSet) len() int {
	return bits.OnesCount64(uint64(s))
}

func (s bitSet) String() string {
	var str string
	var i vertexSet = 1
	cnt := 0
	for cnt < s.len() {
		if (i & s) != 0 {
			str += "1"
			cnt++
		} else {
			str += "0"
		}
		i = i << 1
	}
	return str
}
