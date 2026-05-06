// Copyright 2023 Dolthub, Inc.
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
	"sort"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// ExprGroup is a linked list of plans that return the same result set
// defined by row count and schema.
type ExprGroup struct {
	m        *Memo
	RelProps *relProps
	First    RelExpr
	Best     RelExpr
	Cost     float64

	Id     GroupId
	Done   bool
	HintOk bool
}

// Format implements the fmt.Formatter interface.
func (e *ExprGroup) Format(f fmt.State, verb rune) {
	expr := e.Best
	if expr == nil {
		expr = e.First
	}
	switch ex := expr.(type) {
	case sql.Nameable:
		io.WriteString(f, fmt.Sprintf("%d", expr.Group().Id))
		io.WriteString(f, "[")
		io.WriteString(f, ex.Name())
		io.WriteString(f, "]")
	default:
		if verb == 'v' && f.Flag('+') {
			io.WriteString(f, fmt.Sprintf("%d{%+v}", ex.Group().Id, ex))
		} else {
			io.WriteString(f, fmt.Sprintf("%d", ex.Group().Id))
		}
	}
}

var _ fmt.Formatter = (*ExprGroup)(nil)

func newExprGroup(m *Memo, id GroupId, expr exprType) *ExprGroup {
	// bit of circularity: |grp| references |rel|, |rel| references |grp|,
	// and |relProps| references |rel| and |grp| info.
	grp := &ExprGroup{
		m:  m,
		Id: id,
	}
	expr.SetGroup(grp)
	switch e := expr.(type) {
	case RelExpr:
		grp.First = e
		grp.RelProps = newRelProps(e)
	}
	return grp
}

// Prepend adds a new plan to an expression group at the beginning of
// the list, to avoid recursive exploration steps (like adding indexed joins).
func (e *ExprGroup) Prepend(rel RelExpr) {
	first := e.First
	e.First = rel
	rel.SetNext(first)
}

// Iter returns an iterator over the RelExprs in this ExprGroup.
func (e *ExprGroup) Iter() iter.Seq[RelExpr] {
	return IterRelExprs(e.First)
}

// children returns a unioned list of child ExprGroup for
// every logical plan in this group.
func (e *ExprGroup) children(yield func(group *ExprGroup) bool) {
	children := make(map[GroupId]*ExprGroup)
	for n := range e.Iter() {
		for _, n := range n.Children() {
			if _, exists := children[n.Id]; !exists {
				children[n.Id] = n
				if !yield(n) {
					return
				}
			}
		}
	}
}

// updateBest updates a group's Best to the given expression if the cost is lower than the current best.
// Returns whether the best plan was updated.
func (e *ExprGroup) updateBest(n RelExpr, grpCost float64) bool {
	if e.Best == nil || grpCost < e.Cost {
		e.Best = n
		e.Cost = grpCost
		return true
	}
	return false
}

func (e *ExprGroup) finalize(node sql.Node) (sql.Node, error) {
	props := e.RelProps
	var result = node
	if props.sort != nil {
		result = plan.NewSort(props.sort, result)
	}
	if props.Limit != nil {
		result = plan.NewLimit(props.Limit, result)
	}
	return result, nil
}

// fixConflicts edits the children of a new best plan to account
// for implementation correctness, like conflicting table lookups
// and sorting. For example, a merge join with a filter child that
// could alternatively be implemented as an indexScan should reject
// the static indexScan to maintain the merge join's correctness.
func (e *ExprGroup) fixConflicts() {
	switch n := e.Best.(type) {
	case *MergeJoin:
		// todo: we should permit conflicting static indexScans with same index IDs
		n.Left.findIndexScanConflict()
		n.Right.findIndexScanConflict()
	case *LookupJoin:
		// LOOKUP_JOIN is more performant than INNER_JOIN with static indexScan
		n.Right.findIndexScanConflict()
	}

	for _, g := range e.Best.Children() {
		g.fixConflicts()
	}
}

// findIndexScanConflict prevents indexScans from replacing filter nodes
// for certain query plans that require different indexes or use indexes
// in a special way.
func (e *ExprGroup) findIndexScanConflict() {
	e.fixTableScanPath()
}

// fixTableScanPath updates the intermediate group's |best| plan to
// the path leading to a tableScan leaf.
func (e *ExprGroup) fixTableScanPath() bool {
	n := e.First
	for n != nil {
		src, ok := n.(SourceRel)
		if !ok {
			// not a source, try to find path through children
			for _, c := range n.Children() {
				if c.fixTableScanPath() {
					// found path, update best
					e.Best = n
					n.SetDistinct(NoDistinctOp)
					e.Done = true
					return true
				}
			}
			n = n.Next()
			continue
		}
		_, ok = src.(*IndexScan)
		if ok {
			n = n.Next()
			continue
		}
		// is a source, not an indexScan
		n.SetDistinct(NoDistinctOp)
		e.Best = n
		e.HintOk = true
		e.Done = true
		return true
	}
	return false
}

func (e *ExprGroup) String() string {
	b := strings.Builder{}
	sep := ""
	for n := range e.Iter() {
		b.WriteString(sep)
		b.WriteString(fmt.Sprintf("(%s", n))
		if e.Best != nil {
			cost := n.Cost()
			if cost == 0 {
				// if source relation we want the cardinality
				cost = float64(n.Group().RelProps.GetStats().RowCount())
			}
			b.WriteString(fmt.Sprintf(" %.1f", cost))

			childCost := 0.0
			for _, c := range n.Children() {
				childCost += c.Cost
			}
			if e.Cost == n.Cost()+childCost {
				b.WriteString(")*")
			} else {
				b.WriteString(")")
			}
		} else {
			b.WriteString(")")
		}
		sep = " "
	}
	return b.String()
}

// CostTreeString returns a string representation of the expression group for use in cost debug printing
func (e *ExprGroup) CostTreeString(prefix string) string {
	b := strings.Builder{}
	costSortedGroups := slices.Collect(e.Iter())
	sort.Slice(costSortedGroups, func(i, j int) bool {
		return costSortedGroups[i].Cost() < costSortedGroups[j].Cost()
	})

	for i, n := range costSortedGroups {
		b.WriteString("\n")

		beg := prefix + "├── "
		if i == len(costSortedGroups)-1 {
			beg = prefix + "└── "
		}
		b.WriteString(fmt.Sprintf("%s(%s", beg, n))
		if e.Best != nil {
			cost := n.Cost()
			if cost == 0 {
				// if source relation we want the cardinality
				cost = float64(n.Group().RelProps.GetStats().RowCount())
			}
			b.WriteString(fmt.Sprintf(" %.1f", cost))
		}
		b.WriteString(")")
	}

	return b.String()
}

// BestPlanDebugString returns a string representation of the physical best plan for use in cost debug printing
func (e *ExprGroup) BestPlanDebugString() string {
	tp := sql.NewTreePrinter()
	tp.WriteNode("G%d [%s] Cost: %.1f", e.Id, e.Best, e.Best.Cost())
	children := e.Best.Children()
	childrenStrings := make([]string, len(children))
	for i, c := range children {
		childrenStrings[i] = c.BestPlanDebugString()
	}

	tp.WriteChildren(childrenStrings...)
	return tp.String()
}
