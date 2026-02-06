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
	"regexp"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

//go:generate stringer -type=HintType -linecomment

type HintType uint8

// TODO implement NO_ICP and JOIN_FIXED_ORDER
const (
	HintTypeUnknown                  HintType = iota //
	HintTypeJoinOrder                                // JOIN_ORDER
	HintTypeJoinFixedOrder                           // JOIN_FIXED_ORDER
	HintTypeNoMergeJoin                              // NO_MERGE_JOIN
	HintTypeMergeJoin                                // MERGE_JOIN
	HintTypeLookupJoin                               // LOOKUP_JOIN
	HintTypeHashJoin                                 // HASH_JOIN
	HintTypeSemiJoin                                 // SEMI_JOIN
	HintTypeAntiJoin                                 // ANTI_JOIN
	HintTypeInnerJoin                                // INNER_JOIN
	HintTypeLeftOuterLookupJoin                      // LEFT_OUTER_LOOKUP_JOIN
	HintTypeNoIndexConditionPushDown                 // NO_ICP
	HintTypeLeftDeep                                 // LEFT_DEEP
)

type Hint struct {
	Args []string
	Typ  HintType
}

func (h Hint) String() string {
	if len(h.Args) > 0 {
		return fmt.Sprintf("%s(%s)", h.Typ, strings.Join(h.Args, ","))
	} else {
		return h.Typ.String()
	}
}

func newHint(joinTyp string, args []string) Hint {
	var typ HintType
	switch joinTyp {
	case "join_order":
		typ = HintTypeJoinOrder
	case "join_fixed_order":
		typ = HintTypeJoinFixedOrder
	case "merge_join":
		typ = HintTypeMergeJoin
	case "lookup_join":
		typ = HintTypeLookupJoin
	case "hash_join":
		typ = HintTypeHashJoin
	case "inner_join":
		typ = HintTypeInnerJoin
	case "semi_join":
		typ = HintTypeSemiJoin
	case "anti_join":
		typ = HintTypeAntiJoin
	case "left_outer_lookup_join":
		typ = HintTypeLeftOuterLookupJoin
	case "no_icp":
		typ = HintTypeNoIndexConditionPushDown
	case "left_deep":
		typ = HintTypeLeftDeep
	case "no_merge_join":
		typ = HintTypeNoMergeJoin
	default:
		typ = HintTypeUnknown
	}
	return Hint{Typ: typ, Args: args}
}

func (h Hint) valid() bool {
	switch h.Typ {
	case HintTypeJoinOrder:
		return len(h.Args) > 0
	case HintTypeJoinFixedOrder:
		return len(h.Args) == 0
	case HintTypeMergeJoin:
		return len(h.Args) == 2
	case HintTypeLookupJoin:
		return len(h.Args) == 2
	case HintTypeHashJoin:
		return len(h.Args) == 2
	case HintTypeInnerJoin:
		return len(h.Args) == 2
	case HintTypeSemiJoin:
		return len(h.Args) == 2
	case HintTypeAntiJoin:
		return len(h.Args) == 2
	case HintTypeLeftOuterLookupJoin:
		return len(h.Args) == 2
	case HintTypeNoIndexConditionPushDown:
		return len(h.Args) == 0
	case HintTypeLeftDeep:
		return len(h.Args) == 0
	case HintTypeNoMergeJoin:
		return true
	case HintTypeUnknown:
		return false
	default:
	}
	return true
}

var hintRegex = regexp.MustCompile("([a-z_]+)(\\(([^\\(]+)\\))?")
var argsRegex = regexp.MustCompile("\\s*([^\\(,\\s]+)\\s*[,\\s*]?")

func ExtractJoinHint(n *plan.JoinNode) []Hint {
	if n.Comment() != "" {
		return parseJoinHints(n.Comment())
	}
	return nil
}

// TODO: this is pretty nasty. Should be done in the parser instead.
func parseJoinHints(comment string) []Hint {
	if !strings.HasPrefix(comment, "/*+") {
		return nil
	}
	var hints []Hint
	comments := hintRegex.FindAllStringSubmatch(strings.ToLower(comment), -1)
	for _, c := range comments {
		var args []string
		if c[3] != "" {
			argsParsed := argsRegex.FindAllStringSubmatch(c[3], -1)
			for _, arg := range argsParsed {
				args = append(args, arg[1])
			}
		}
		hint := newHint(c[1], args)
		if hint.valid() {
			hints = append(hints, hint)
		}
	}
	return hints
}

// joinOrderHint encodes a groups relational dependencies in a bitset
// by mapping group ids into join_order ordinals. Remapping source
// relations from group -> join_order ordinal makes it easy to perform
// ordering and compactness checks (see isOrdered and isCompact).
//
// Example:
//
//	G1 -> A
//	G2 -> B
//	G3 -> C
//	G4 -> [G2 G1]
//	G5 -> [G4 G3]
//	JOIN_ORDER(B,A,C) = B = 1, A = 2, C = 3
//	=>
//	{1: 010, 2: 100, 3: 001, 4: 110, 5: 111}
type joinOrderHint struct {
	groups map[GroupId]vertexSet
	order  map[sql.TableId]uint64
	// cache avoids recomputing satisfiability for a RelExpr
	cache map[uint64]bool
}

func newJoinOrderHint(order map[sql.TableId]uint64) *joinOrderHint {
	return &joinOrderHint{
		groups: make(map[GroupId]vertexSet),
		cache:  make(map[uint64]bool),
		order:  order,
	}
}

func (o joinOrderHint) build(grp *ExprGroup) {
	s := vertexSet(0)
	// convert global table order to hint order
	inputs := grp.RelProps.InputTables()
	for idx, ok := inputs.Next(0); ok; idx, ok = inputs.Next(idx + 1) {
		if i, ok := o.order[sql.TableId(idx)]; ok {
			// If group |idx+1| is a dependency of this table, record the
			// ordinal position of that group given by the hint order.
			s = s.add(i)
		}
	}
	o.groups[grp.Id] = s

	for _, g := range grp.children() {
		if _, ok := o.groups[g.Id]; !ok {
			// avoid duplicate work
			o.build(g)
		}
	}
}

// isValid returns true if the hint parsed correctly
func (o joinOrderHint) isValid() bool {
	for _, v := range o.groups {
		if v == vertexSet(0) {
			// invalid hint table name, fallback
			return false
		}
	}
	return true
}

func (o joinOrderHint) satisfiesOrder(n RelExpr) bool {
	key := relKey(n)
	if v, ok := o.cache[key]; ok {
		return v
	}
	switch n := n.(type) {
	case JoinRel:
		base := n.JoinPrivate()
		if !base.Left.HintOk || !base.Right.HintOk {
			return false
		}
		l := o.groups[base.Left.Id]
		r := o.groups[base.Right.Id]
		valid := o.isOrdered(l, r) && o.isCompact(l, r)
		o.cache[key] = valid
		return valid
	case *Project:
		return o.satisfiesOrder(n.Child.Best)
	case *Distinct:
		return o.satisfiesOrder(n.Child.Best)
	case *Filter:
		return o.satisfiesOrder(n.Child.Best)
	case SourceRel:
		return true
	default:
		panic(fmt.Sprintf("missed type: %T", n))
	}
}

// isOrdered returns true if the vertex sets obey the table
// order requested by the hint.
//
// Ex: JOIN_ORDER(a,b,c) is ordered on [b]x[c], and
// not on on [c]x[b].
func (o joinOrderHint) isOrdered(s1, s2 vertexSet) bool {
	return s1 < s2
}

// isCompact returns true if the tables in the joined result
// set are a contiguous subsection of the order hint.
//
// Ex: JOIN_ORDER(a,b,c) is compact on [b]x[c], and not
// on [a]x[c].
func (o joinOrderHint) isCompact(s1, s2 vertexSet) bool {
	if s1 == 0 || s2 == 0 {
		panic("unexpected nil vertex set")
	}
	union := s1.union(s2)
	last, _ := union.next(0)
	next, ok := union.next(last + 1)
	for ok {
		if last+1 != next {
			return false
		}
		last = next
		next, ok = union.next(next + 1)
	}

	// sets are compact, s1 higher than s2
	return true
}

// joinOpHint encodes a hint for a physical operator between
// two relations.
type joinOpHint struct {
	l  sql.FastIntSet
	r  sql.FastIntSet
	op HintType
}

func newjoinOpHint(op HintType, left, right sql.TableId) joinOpHint {
	return joinOpHint{
		op: op,
		l:  sql.NewFastIntSet(int(left)),
		r:  sql.NewFastIntSet(int(right)),
	}
}

// isValid returns true if the hint parsed correctly
func (o joinOpHint) isValid() bool {
	return !o.l.Empty() && !o.r.Empty()
}

// depsMatch returns whether this RelExpr is a join with left/right inputs
// that match the join hint.
//
// Ex: LOOKUP_JOIN(a,b) will match [a] x [b], and [ac] x [b],
// but not [ab] x [c].
func (o joinOpHint) depsMatch(n RelExpr) bool {
	switch n := n.(type) {
	case *Project:
		return o.depsMatch(n.Child.Best)
	case *Filter:
		return o.depsMatch(n.Child.Best)
	case *Distinct:
		return o.depsMatch(n.Child.Best)
	case JoinRel:
		jp := n.JoinPrivate()
		if !jp.Left.Best.Group().HintOk || !jp.Right.Best.Group().HintOk {
			// equiv closures can generate child plans that bypass hints
			return false
		}

		leftTab := jp.Left.RelProps.InputTables()
		rightTab := jp.Right.RelProps.InputTables()
		deps := o.l.Union(o.r)
		if deps.SubsetOf(leftTab.Union(rightTab)) &&
			!deps.SubsetOf(leftTab) &&
			!deps.SubsetOf(rightTab) {
			// join tables satisfy but partition the hint rels
			return true
		}
	default:
		return true
	}
	return false
}

// typeMatches returns whether a RelExpr implements
// the physical join operator indicated by the hint.
//
// Ex: MERGE_JOIN(a,b) will match merge and left-merge joins.
func (o joinOpHint) typeMatches(n RelExpr) bool {
	switch n := n.(type) {
	case JoinRel:
		base := n.JoinPrivate()
		switch o.op {
		case HintTypeLookupJoin:
			return base.Op.IsLookup()
		case HintTypeMergeJoin:
			return base.Op.IsMerge()
		case HintTypeInnerJoin:
			return !base.Op.IsPhysical()
		case HintTypeHashJoin:
			return base.Op.IsHash()
		case HintTypeSemiJoin:
			return base.Op.IsSemi() && !base.Op.IsPhysical()
		case HintTypeAntiJoin:
			return base.Op.IsAnti() && !base.Op.IsPhysical()
		case HintTypeLeftOuterLookupJoin:
			return base.Op == plan.JoinTypeLeftOuterLookup
		default:
			return false
		}
	case *Project:
		return o.typeMatches(n.Child.Best)
	case *Filter:
		return o.typeMatches(n.Child.Best)
	case *Distinct:
		return o.typeMatches(n.Child.Best)
	default:
	}
	return true
}

// joinHints wraps a collection of join hints. The memo
// interfaces with this object during costing.
type joinHints struct {
	order            *joinOrderHint
	ops              []joinOpHint
	leftDeep         bool
	disableMergeJoin bool
}

// isEmpty returns true if no hints that affect join planning have been set.
func (h joinHints) isEmpty() bool {
	return len(h.ops) == 0 && h.order == nil && !h.leftDeep && !h.disableMergeJoin
}

// satisfiedBy returns whether a RelExpr satisfies every join hint. This
// is binary, an expr that satisfies most of the join hints but fails one
// returns |false| and is subject to genpop costing.
func (h joinHints) satisfiedBy(n RelExpr) bool {
	if h.order != nil && !h.order.satisfiesOrder(n) {
		return false
	}

	if h.leftDeep {
		if j, ok := n.(JoinRel); ok {
			if j.JoinPrivate().Right.RelProps.InputTables().Len() > 1 {
				return false
			}
		}
	}

	if h.ops == nil {
		return true
	}

	var foundMatch bool
	for _, op := range h.ops {
		if op.depsMatch(n) {
			foundMatch = true
			if !op.typeMatches(n) {
				return false
			}
		}
	}
	return foundMatch
}
