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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// ExprGroup is a linked list of plans that return the same result set
// defined by row count and schema.
type ExprGroup struct {
	m         *Memo
	RelProps  *relProps
	First     RelExpr
	Best      RelExpr
	_children []*ExprGroup
	Cost      float64

	Id     GroupId
	Done   bool
	HintOk bool
}

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

// children returns a unioned list of child ExprGroup for
// every logical plan in this group.
func (e *ExprGroup) children() []*ExprGroup {
	relExpr, ok := e.First.(RelExpr)
	if !ok {
		return e.children()
	}
	n := relExpr
	children := make([]*ExprGroup, 0)
	for n != nil {
		children = append(children, n.Children()...)
		n = n.Next()
	}
	return children
}

// updateBest updates a group's Best to the given expression or a hinted
// operator if the hinted plan is not found. Join operator is applied as
// a local rather than global property.
func (e *ExprGroup) updateBest(n RelExpr, grpCost float64) {
	if e.Best == nil || grpCost < e.Cost {
		e.Best = n
		e.Cost = grpCost
	}
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
	n := e.First
	sep := ""
	for n != nil {
		b.WriteString(sep)
		b.WriteString(fmt.Sprintf("(%s", FormatExpr(n)))
		if e.Best != nil {
			cost := n.Cost()
			if cost == 0 {
				// if source relation we want the cardinality
				cost = float64(n.Group().RelProps.GetStats().RowCount())
			}
			b.WriteString(fmt.Sprintf(" %.1f", n.Cost()))

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
		n = n.Next()
	}
	return b.String()
}
