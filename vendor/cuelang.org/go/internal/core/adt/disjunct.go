// Copyright 2020 CUE Authors
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

package adt

import (
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

// Nodes man not reenter a disjunction.
//
// Copy one layer deep; throw away items on failure.

// DISJUNCTION ALGORITHM
//
// The basic concept of the algorithm is to use backtracking to find valid
// disjunctions. The algorithm can stop if two matching disjuncts are found
// where one does not subsume the other.
//
// At a later point, we can introduce a filter step to filter out possible
// disjuncts based on, say, discriminator fields or field exclusivity (oneOf
// fields in Protobuf).
//
// To understand the details of the algorithm, it is important to understand
// some properties of disjunction.
//
//
// EVALUATION OF A DISJUNCTION IS SELF CONTAINED
//
// In other words, fields outside of a disjunction cannot bind to values within
// a disjunction whilst evaluating that disjunction. This allows the computation
// of disjunctions to be isolated from side effects.
//
// The intuition behind this is as follows: as a disjunction is not a concrete
// value, it is not possible to lookup a field within a disjunction if it has
// not yet been evaluated. So if a reference within a disjunction that is needed
// to disambiguate that disjunction refers to a field outside the scope of the
// disjunction which, in turn, refers to a field within the disjunction, this
// results in a cycle error. We achieve this by not removing the cycle marker of
// the Vertex of the disjunction until the disjunction is resolved.
//
// Note that the following disjunct is still allowed:
//
//    a: 1
//    b: a
//
// Even though `a` refers to the root of the disjunction, it does not _select
// into_ the disjunction. Implementation-wise, it also doesn't have to, as the
// respective vertex is available within the Environment. Referencing a node
// outside the disjunction that in turn selects the disjunction root, however,
// will result in a detected cycle.
//
// As usual, cycle detection should be interpreted marked as incomplete, so that
// the referring node will not be fixed to an error prematurely.
//
//
// SUBSUMPTION OF AMBIGUOUS DISJUNCTS
//
// A disjunction can be evaluated to a concrete value if only one disjunct
// remains. Aside from disambiguating through unification failure, disjuncts
// may also be disambiguated by taking the least specific of two disjuncts.
// For instance, if a subsumes b, then the result of disjunction may be a.
//
//   NEW ALGORITHM NO LONGER VERIFIES SUBSUMPTION. SUBSUMPTION IS INHERENTLY
//   IMPRECISE (DUE TO BULK OPTIONAL FIELDS). OTHER THAN THAT, FOR SCALAR VALUES
//   IT JUST MEANS THERE IS AMBIGUITY, AND FOR STRUCTS IT CAN LEAD TO STRANGE
//   CONSEQUENCES.
//
//   USE EQUALITY INSTEAD:
//     - Undefined == error for optional fields.
//     - So only need to check exact labels for vertices.

type envDisjunct struct {
	env         *Environment
	cloneID     CloseInfo
	expr        *DisjunctionExpr
	value       *Disjunction
	hasDefaults bool

	// These are used for book keeping, tracking whether any of the
	// disjuncts marked with a default marker remains after unification.
	// If no default is used, all other elements are treated as "maybeDefault".
	// Otherwise, elements are treated as is.
	parentDefaultUsed bool
	childDefaultUsed  bool
}

func (n *nodeContext) addDisjunction(env *Environment, x *DisjunctionExpr, cloneID CloseInfo) {

	// TODO: precompute
	numDefaults := 0
	for _, v := range x.Values {
		isDef := v.Default // || n.hasDefaults(env, v.Val)
		if isDef {
			numDefaults++
		}
	}

	n.disjunctions = append(n.disjunctions,
		envDisjunct{env, cloneID, x, nil, numDefaults > 0, false, false})
}

func (n *nodeContext) addDisjunctionValue(env *Environment, x *Disjunction, cloneID CloseInfo) {
	n.disjunctions = append(n.disjunctions,
		envDisjunct{env, cloneID, nil, x, x.HasDefaults, false, false})

}

func (n *nodeContext) expandDisjuncts(
	state VertexStatus,
	parent *nodeContext,
	parentMode defaultMode, // default mode of this disjunct
	recursive, last bool) {

	n.ctx.stats.Disjuncts++

	// refNode is used to collect cyclicReferences for all disjuncts to be
	// passed up to the parent node. Note that because the node in the parent
	// context is overwritten in the course of expanding disjunction to retain
	// pointer identity, it is not possible to simply record the refNodes in the
	// parent directly.
	var refNode *RefNode

	node := n.node
	defer func() {
		n.node = node
	}()

	for n.expandOne(Partial) {
	}

	// save node to snapShot in nodeContex
	// save nodeContext.

	if recursive || len(n.disjunctions) > 0 {
		n.snapshot = clone(*n.node)
	} else {
		n.snapshot = *n.node
	}

	defaultOffset := len(n.usedDefault)

	switch {
	default: // len(n.disjunctions) == 0
		m := *n
		n.postDisjunct(state)

		switch {
		case n.hasErr():
			// TODO: consider finalizing the node thusly:
			// if recursive {
			// 	n.node.Finalize(n.ctx)
			// }
			x := n.node
			err, ok := x.BaseValue.(*Bottom)
			if !ok {
				err = n.getErr()
			}
			if err == nil {
				// TODO(disjuncts): Is this always correct? Especially for partial
				// evaluation it is okay for child errors to have incomplete errors.
				// Perhaps introduce an Err() method.
				err = x.ChildErrors
			}
			if err != nil {
				parent.disjunctErrs = append(parent.disjunctErrs, err)
			}
			if recursive {
				n.free()
			}
			return
		}

		if recursive {
			*n = m
			n.result = *n.node // XXX: n.result = snapshotVertex(n.node)?
			n.node = &n.result
			n.disjuncts = append(n.disjuncts, n)
		}
		if n.node.BaseValue == nil {
			n.node.BaseValue = n.getValidators(state)
		}

		n.usedDefault = append(n.usedDefault, defaultInfo{
			parentMode: parentMode,
			nestedMode: parentMode,
			origMode:   parentMode,
		})

	case len(n.disjunctions) > 0:
		// Process full disjuncts to ensure that erroneous disjuncts are
		// eliminated as early as possible.
		state = Finalized

		n.disjuncts = append(n.disjuncts, n)

		n.refCount++
		defer n.free()

		for i, d := range n.disjunctions {
			a := n.disjuncts
			n.disjuncts = n.buffer[:0]
			n.buffer = a[:0]

			last := i+1 == len(n.disjunctions)
			skipNonMonotonicChecks := i+1 < len(n.disjunctions)
			if skipNonMonotonicChecks {
				n.ctx.inDisjunct++
			}

			for _, dn := range a {
				switch {
				case d.expr != nil:
					for _, v := range d.expr.Values {
						cn := dn.clone()
						*cn.node = clone(dn.snapshot)
						cn.node.state = cn

						c := MakeConjunct(d.env, v.Val, d.cloneID)
						cn.addExprConjunct(c, state)

						newMode := mode(d.hasDefaults, v.Default)

						cn.expandDisjuncts(state, n, newMode, true, last)

						// Record the cyclicReferences of the conjunct in the
						// parent list.
						// TODO: avoid the copy. It should be okay to "steal"
						// this list and avoid the copy. But this change is best
						// done in a separate CL.
						for r := n.node.cyclicReferences; r != nil; r = r.Next {
							s := *r
							s.Next = refNode
							refNode = &s
						}
					}

				case d.value != nil:
					for i, v := range d.value.Values {
						cn := dn.clone()
						*cn.node = clone(dn.snapshot)
						cn.node.state = cn

						cn.addValueConjunct(d.env, v, d.cloneID)

						newMode := mode(d.hasDefaults, i < d.value.NumDefaults)

						cn.expandDisjuncts(state, n, newMode, true, last)

						// See comment above.
						for r := n.node.cyclicReferences; r != nil; r = r.Next {
							s := *r
							s.Next = refNode
							refNode = &s
						}
					}
				}
			}

			if skipNonMonotonicChecks {
				n.ctx.inDisjunct--
			}

			if len(n.disjuncts) == 0 {
				n.makeError()
			}

			if recursive || i > 0 {
				for _, x := range a {
					x.free()
				}
			}

			if len(n.disjuncts) == 0 {
				break
			}
		}

		// Annotate disjunctions with whether any of the default disjunctions
		// was used.
		for _, d := range n.disjuncts {
			for i, info := range d.usedDefault[defaultOffset:] {
				if info.parentMode == isDefault {
					n.disjunctions[i].parentDefaultUsed = true
				}
				if info.origMode == isDefault {
					n.disjunctions[i].childDefaultUsed = true
				}
			}
		}

		// Combine parent and child default markers, considering that a parent
		// "notDefault" is treated as "maybeDefault" if none of the disjuncts
		// marked as default remain.
		//
		// NOTE for a parent marked as "notDefault", a child is *never*
		// considered as default. It may either be "not" or "maybe" default.
		//
		// The result for each disjunction is conjoined into a single value.
		for _, d := range n.disjuncts {
			m := maybeDefault
			orig := maybeDefault
			for i, info := range d.usedDefault[defaultOffset:] {
				parent := info.parentMode

				used := n.disjunctions[i].parentDefaultUsed
				childUsed := n.disjunctions[i].childDefaultUsed
				hasDefaults := n.disjunctions[i].hasDefaults

				orig = combineDefault(orig, info.parentMode)
				orig = combineDefault(orig, info.nestedMode)

				switch {
				case childUsed:
					// One of the children used a default. This is "normal"
					// mode. This may also happen when we are in
					// hasDefaults/notUsed mode. Consider
					//
					//      ("a" | "b") & (*(*"a" | string) | string)
					//
					// Here the doubly nested default is called twice, once
					// for "a" and then for "b", where the second resolves to
					// not using a default. The first does, however, and on that
					// basis the "ot default marker cannot be overridden.
					m = combineDefault(m, info.parentMode)
					m = combineDefault(m, info.origMode)

				case !hasDefaults, used:
					m = combineDefault(m, info.parentMode)
					m = combineDefault(m, info.nestedMode)

				case hasDefaults && !used:
					Assertf(parent == notDefault, "unexpected default mode")
				}
			}
			d.defaultMode = m

			d.usedDefault = d.usedDefault[:defaultOffset]
			d.usedDefault = append(d.usedDefault, defaultInfo{
				parentMode: parentMode,
				nestedMode: m,
				origMode:   orig,
			})

		}

		// TODO: this is an old trick that seems no longer necessary for the new
		// implementation. Keep around until we finalize the semantics for
		// defaults, though. The recursion of nested defaults is not entirely
		// proper yet.
		//
		// A better approach, that avoids the need for recursion (semantically),
		// would be to only consider default usage for one level, but then to
		// also allow a default to be passed if only one value is remaining.
		// This means that a nested subsumption would first have to be evaluated
		// in isolation, however, to determine that it is not previous
		// disjunctions that cause the disambiguation.
		//
		// HACK alert: this replaces the hack of the previous algorithm with a
		// slightly less worse hack: instead of dropping the default info when
		// the value was scalar before, we drop this information when there is
		// only one disjunct, while not discarding hard defaults. TODO: a more
		// principled approach would be to recognize that there is only one
		// default at a point where this does not break commutativity. if
		// if len(n.disjuncts) == 1 && n.disjuncts[0].defaultMode != isDefault {
		// 	n.disjuncts[0].defaultMode = maybeDefault
		// }
	}

	// Compare to root, but add to this one.
	switch p := parent; {
	case p != n:
		p.disjunctErrs = append(p.disjunctErrs, n.disjunctErrs...)
		n.disjunctErrs = n.disjunctErrs[:0]

	outer:
		for _, d := range n.disjuncts {
			for k, v := range p.disjuncts {
				if !d.done() || !v.done() {
					break
				}
				flags := CheckStructural
				if last {
					flags |= IgnoreOptional
				}
				if Equal(n.ctx, &v.result, &d.result, flags) {
					m := maybeDefault
					for _, u := range d.usedDefault {
						m = combineDefault(m, u.nestedMode)
					}
					if m == isDefault {
						p.disjuncts[k] = d
						v.free()
					} else {
						d.free()
					}
					continue outer
				}
			}

			p.disjuncts = append(p.disjuncts, d)
		}

		n.disjuncts = n.disjuncts[:0]
	}

	// Record the refNodes in the parent.
	for r := refNode; r != nil; {
		next := r.Next
		r.Next = parent.node.cyclicReferences
		parent.node.cyclicReferences = r
		r = next
	}
}

func (n *nodeContext) makeError() {
	code := IncompleteError

	if len(n.disjunctErrs) > 0 {
		code = EvalError
		for _, c := range n.disjunctErrs {
			if c.Code > code {
				code = c.Code
			}
		}
	}

	b := &Bottom{
		Code: code,
		Err:  n.disjunctError(),
	}
	n.node.SetValue(n.ctx, Finalized, b)
}

func mode(hasDefault, marked bool) defaultMode {
	var mode defaultMode
	switch {
	case !hasDefault:
		mode = maybeDefault
	case marked:
		mode = isDefault
	default:
		mode = notDefault
	}
	return mode
}

// clone makes a shallow copy of a Vertex. The purpose is to create different
// disjuncts from the same Vertex under computation. This allows the conjuncts
// of an arc to be reset to a previous position and the reuse of earlier
// computations.
//
// Notes: only Arcs need to be copied recursively. Either the arc is finalized
// and can be used as is, or Structs is assumed to not yet be computed at the
// time that a clone is needed and must be nil. Conjuncts no longer needed and
// can become nil. All other fields can be copied shallowly.
func clone(v Vertex) Vertex {
	v.state = nil
	if a := v.Arcs; len(a) > 0 {
		v.Arcs = make([]*Vertex, len(a))
		for i, arc := range a {
			switch arc.status {
			case Finalized:
				v.Arcs[i] = arc

			case 0:
				a := *arc
				v.Arcs[i] = &a

				a.Conjuncts = make([]Conjunct, len(arc.Conjuncts))
				copy(a.Conjuncts, arc.Conjuncts)

			default:
				a := *arc
				a.state = arc.state.clone()
				a.state.node = &a
				a.state.snapshot = clone(a)
				v.Arcs[i] = &a
			}
		}
	}

	if a := v.Structs; len(a) > 0 {
		v.Structs = make([]*StructInfo, len(a))
		copy(v.Structs, a)
	}

	return v
}

// Default rules from spec:
//
// U1: (v1, d1) & v2       => (v1&v2, d1&v2)
// U2: (v1, d1) & (v2, d2) => (v1&v2, d1&d2)
//
// D1: (v1, d1) | v2       => (v1|v2, d1)
// D2: (v1, d1) | (v2, d2) => (v1|v2, d1|d2)
//
// M1: *v        => (v, v)
// M2: *(v1, d1) => (v1, d1)
//
// NOTE: M2 cannot be *(v1, d1) => (v1, v1), as this has the weird property
// of making a value less specific. This causes issues, for instance, when
// trimming.
//
// The old implementation does something similar though. It will discard
// default information after first determining if more than one conjunct
// has survived.
//
// def + maybe -> def
// not + maybe -> def
// not + def   -> def

type defaultMode int

const (
	maybeDefault defaultMode = iota
	isDefault
	notDefault
)

// combineDefaults combines default modes for unifying conjuncts.
//
// Default rules from spec:
//
// U1: (v1, d1) & v2       => (v1&v2, d1&v2)
// U2: (v1, d1) & (v2, d2) => (v1&v2, d1&d2)
func combineDefault(a, b defaultMode) defaultMode {
	if a > b {
		return a
	}
	return b
}

// disjunctError returns a compound error for a failed disjunction.
//
// TODO(perf): the set of errors is now computed during evaluation. Eventually,
// this could be done lazily.
func (n *nodeContext) disjunctError() (errs errors.Error) {
	ctx := n.ctx

	disjuncts := selectErrors(n.disjunctErrs)

	if disjuncts == nil {
		errs = ctx.Newf("empty disjunction") // XXX: add space to sort first
	} else {
		disjuncts = errors.Sanitize(disjuncts)
		k := len(errors.Errors(disjuncts))
		if k == 1 {
			return disjuncts
		}
		// prefix '-' to sort to top
		errs = ctx.Newf("%d errors in empty disjunction:", k)
		errs = errors.Append(errs, disjuncts)
	}

	return errs
}

func selectErrors(a []*Bottom) (errs errors.Error) {
	// return all errors if less than a certain number.
	if len(a) <= 2 {
		for _, b := range a {
			errs = errors.Append(errs, b.Err)

		}
		return errs
	}

	// First select only relevant errors.
	isIncomplete := false
	k := 0
	for _, b := range a {
		if !isIncomplete && b.Code >= IncompleteError {
			k = 0
			isIncomplete = true
		}
		a[k] = b
		k++
	}
	a = a[:k]

	// filter errors
	positions := map[token.Pos]bool{}

	add := func(b *Bottom, p token.Pos) bool {
		if positions[p] {
			return false
		}
		positions[p] = true
		errs = errors.Append(errs, b.Err)
		return true
	}

	for _, b := range a {
		// TODO: Should we also distinguish by message type?
		if add(b, b.Err.Position()) {
			continue
		}
		for _, p := range b.Err.InputPositions() {
			if add(b, p) {
				break
			}
		}
	}

	return errs
}
