// Copyright 2021 CUE Authors
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

// Package eval contains the high level CUE evaluation strategy.
//
// CUE allows for a significant amount of freedom in order of evaluation due to
// the commutativity of the unification operation. This package implements one
// of the possible strategies.
package adt

// TODO:
//   - result should be nodeContext: this allows optionals info to be extracted
//     and computed.
//

import (
	"fmt"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/stats"
	"cuelang.org/go/cue/token"
)

// TODO TODO TODO TODO TODO TODO  TODO TODO TODO  TODO TODO TODO  TODO TODO TODO
//
// - Reuse work from previous cycles. For instance, if we can guarantee that a
//   value is always correct for partial results, we can just process the arcs
//   going from Partial to Finalized, without having to reevaluate the value.
//
// - Test closedness far more thoroughly.
//

func (c *OpContext) Stats() *stats.Counts {
	return &c.stats
}

// TODO: Note: NewContext takes essentially a cue.Value. By making this
// type more central, we can perhaps avoid context creation.

// func NewContext(r Runtime, v *Vertex) *OpContext {
// 	e := NewUnifier(r)
// 	return e.NewContext(v)
// }

var structSentinel = &StructMarker{}

var incompleteSentinel = &Bottom{
	Code: IncompleteError,
	Err:  errors.Newf(token.NoPos, "incomplete"),
}

// evaluate returns the evaluated value associated with v. It may return a
// partial result. That is, if v was not yet unified, it may return a
// concrete value that must be the result assuming the configuration has no
// errors.
//
// This semantics allows CUE to break reference cycles in a straightforward
// manner.
//
// Vertex v must still be evaluated at some point to catch the underlying
// error.
//
// TODO: return *Vertex
func (c *OpContext) evaluate(v *Vertex, r Resolver, state VertexStatus) Value {
	if v.isUndefined() {
		// Use node itself to allow for cycle detection.
		c.Unify(v, state)

		if !v.isDefined() {
			if v.status == Evaluating {
				for ; v.Parent != nil && !v.isDefined(); v = v.Parent {
				}
				err := c.Newf("cycle with field %v", r)
				b := &Bottom{Code: CycleError, Err: err}
				v.SetValue(c, v.status, b)
				return b
				// TODO: use this instead, as is usual for incomplete errors,
				// and also move this block one scope up to also apply to
				// defined arcs. In both cases, though, doing so results in
				// some errors to be misclassified as evaluation error.
				// c.AddBottom(b)
				// return nil
			}
			c.undefinedFieldError(v, IncompleteError)
			return nil
		}
	}

	if n := v.state; n != nil {
		if n.errs != nil && !n.errs.IsIncomplete() {
			return n.errs
		}
		if n.scalar != nil && isCyclePlaceholder(v.BaseValue) {
			return n.scalar
		}
	}

	switch x := v.BaseValue.(type) {
	case *Bottom:
		if x.IsIncomplete() {
			c.AddBottom(x)
			return nil
		}
		return x

	case nil:
		if v.state != nil {
			switch x := v.state.getValidators(Finalized).(type) {
			case Value:
				return x
			default:
				w := *v
				w.BaseValue = x
				return &w
			}
		}
		// This may happen if the evaluator is invoked outside of regular
		// evaluation, such as in dependency analysis.
		return nil
	}

	if v.status < Finalized && v.state != nil {
		// TODO: errors are slightly better if we always add addNotify, but
		// in this case it is less likely to cause a performance penalty.
		// See https://cuelang.org/issue/661. It may be possible to
		// relax this again once we have proper tests to prevent regressions of
		// that issue.
		if !v.state.done() || v.state.errs != nil {
			v.state.addNotify(c.vertex)
		}
	}

	return v
}

// Unify fully unifies all values of a Vertex to completion and stores
// the result in the Vertex. If unify was called on v before it returns
// the cached results.
func (c *OpContext) Unify(v *Vertex, state VertexStatus) {
	// defer c.PopVertex(c.PushVertex(v))
	if Debug {
		c.nest++
		c.Logf(v, "Unify")
		defer func() {
			c.Logf(v, "END Unify")
			c.nest--
		}()
	}

	// Ensure a node will always have a nodeContext after calling Unify if it is
	// not yet Finalized.
	n := v.getNodeContext(c, 1)
	defer v.freeNode(n)

	// TODO(cycle): verify this happens in all cases when we need it.
	if n != nil && v.Parent != nil && v.Parent.state != nil {
		n.depth = v.Parent.state.depth + 1
	}

	if state <= v.Status() &&
		state == Partial &&
		v.isDefined() &&
		n != nil && n.scalar != nil {
		return
	}

	switch v.Status() {
	case Evaluating:
		n.insertConjuncts(state)
		return

	case EvaluatingArcs:
		Assertf(v.status > 0, "unexpected status %d", v.status)
		return

	case 0:
		if v.Label.IsDef() {
			v.Closed = true
		}

		if v.Parent != nil {
			if v.Parent.Closed {
				v.Closed = true
			}
		}

		defer c.PopArc(c.PushArc(v))

		v.UpdateStatus(Evaluating)

		if p := v.Parent; p != nil && p.state != nil && v.Label.IsString() {
			for _, s := range p.state.node.Structs {
				if s.Disable {
					continue
				}
				s.MatchAndInsert(n.ctx, v)
			}
		}

		c.stats.Unifications++

		// Set the cache to a cycle error to ensure a cyclic reference will result
		// in an error if applicable. A cyclic error may be ignored for
		// non-expression references. The cycle error may also be removed as soon
		// as there is evidence what a correct value must be, but before all
		// validation has taken place.
		//
		// TODO(cycle): having a more recursive algorithm would make this
		// special cycle handling unnecessary.
		v.BaseValue = cycle

		if c.HasErr() {
			n.addBottom(c.errs)
		}

		n.conjuncts = v.Conjuncts
		if n.insertConjuncts(state) {
			n.maybeSetCache()
			v.UpdateStatus(Partial)
			return
		}

		fallthrough

	case Partial, Conjuncts:
		// TODO: remove this optimization or make it correct.
		// No need to do further processing when we have errors and all values
		// have been considered.
		// TODO: is checkClosed really still necessary here?
		if v.status == Conjuncts && (n.hasErr() || !n.checkClosed(state)) {
			break
		}

		defer c.PopArc(c.PushArc(v))

		n.insertConjuncts(state)

		v.status = Evaluating

		// Use maybeSetCache for cycle breaking
		for n.maybeSetCache(); n.expandOne(Partial); n.maybeSetCache() {
		}

		n.doNotify()

		if !n.done() {
			switch {
			case state < Conjuncts:
				n.node.UpdateStatus(Partial)
				return

			case state == Conjuncts:
				if err := n.incompleteErrors(true); err != nil && err.Code < CycleError {
					n.node.AddErr(c, err)
				} else {
					n.node.UpdateStatus(Partial)
				}
				return
			}
		}

		// Disjunctions should always be finalized. If there are nested
		// disjunctions the last one should be finalized.
		disState := state
		if len(n.disjunctions) > 0 && disState != Finalized {
			disState = Finalized
		}
		n.expandDisjuncts(disState, n, maybeDefault, false, true)

		n.finalizeDisjuncts()

		switch len(n.disjuncts) {
		case 0:
		case 1:
			x := n.disjuncts[0].result
			x.state = nil
			x.cyclicReferences = n.node.cyclicReferences
			*v = x

		default:
			d := n.createDisjunct()
			v.BaseValue = d
			// The conjuncts will have too much information. Better have no
			// information than incorrect information.
			for _, d := range d.Values {
				// We clear the conjuncts for now. As these disjuncts are for API
				// use only, we will fill them out when necessary (using Defaults).
				d.Conjuncts = nil

				// TODO: use a more principled form of dereferencing. For instance,
				// disjuncts could already be assumed to be the given Vertex, and
				// the the main vertex could be dereferenced during evaluation.
				for _, a := range d.Arcs {
					for _, x := range a.Conjuncts {
						// All the environments for embedded structs need to be
						// dereferenced.
						for env := x.Env; env != nil && env.Vertex == v; env = env.Up {
							env.Vertex = d
						}
					}
				}
			}
			v.Arcs = nil
			v.ChildErrors = nil
			// v.Structs = nil // TODO: should we keep or discard the Structs?
			// TODO: how to represent closedness information? Do we need it?
		}

		// If the state has changed, it is because a disjunct has been run, or
		// because a single disjunct has replaced it. Restore the old state as
		// to not confuse memory management.
		v.state = n

		// We don't do this in postDisjuncts, as it should only be done after
		// completing all disjunctions.
		if !n.done() {
			if err := n.incompleteErrors(true); err != nil {
				b, _ := n.node.BaseValue.(*Bottom)
				if b != err {
					err = CombineErrors(n.ctx.src, b, err)
				}
				n.node.BaseValue = err
			}
		}

		assertStructuralCycle(n)

		if state != Finalized {
			return
		}

		if v.BaseValue == nil {
			v.BaseValue = n.getValidators(Finalized)
		}

		// Free memory here?
		v.UpdateStatus(Finalized)

	case Finalized:
	}
}

// insertConjuncts inserts conjuncts previously not inserted.
func (n *nodeContext) insertConjuncts(state VertexStatus) bool {
	// Exit early if we have a concrete value and only need partial results.
	if state == Partial {
		for n.conjunctsPos < len(n.conjuncts) {
			c := n.conjuncts[n.conjunctsPos]
			n.conjunctsPos++
			if v, ok := c.Elem().(Value); ok && IsConcrete(v) {
				n.addValueConjunct(c.Env, v, c.CloseInfo)
			}
		}
		if n.scalar != nil && n.node.isDefined() {
			return true
		}
	}
	for len(n.conjuncts) > 0 {
		nInfos := len(n.node.Structs)
		p := &n.conjuncts[0]
		n.conjuncts = n.conjuncts[1:]
		// Intially request a Partial state to allow cyclic references to
		// resolve more naturally first. This results in better error messages
		// and less operations.
		n.addExprConjunct(*p, Partial)

		// Record the OptionalTypes for all structs that were inferred by this
		// Conjunct. This information can be used by algorithms such as trim.
		for i := nInfos; i < len(n.node.Structs); i++ {
			p.CloseInfo.FieldTypes |= n.node.Structs[i].types
		}
	}
	return false
}

// finalizeDisjuncts: incomplete errors are kept around and not removed early.
// This call filters the incomplete errors and removes them
//
// This also collects all errors of empty disjunctions. These cannot be
// collected during the finalization state of individual disjuncts. Care should
// be taken to only call this after all disjuncts have been finalized.
func (n *nodeContext) finalizeDisjuncts() {
	a := n.disjuncts
	if len(a) == 0 {
		return
	}
	k := 0
	for i, d := range a {
		switch d.finalDone() {
		case true:
			a[k], a[i] = d, a[k]
			k++
		default:
			if err := d.incompleteErrors(true); err != nil {
				n.disjunctErrs = append(n.disjunctErrs, err)
			}
		}
		d.free()
	}
	if k == 0 {
		n.makeError()
	}
	n.disjuncts = a[:k]
}

func (n *nodeContext) doNotify() {
	if n.errs == nil || len(n.notify) == 0 {
		return
	}
	for _, v := range n.notify {
		if v.state == nil {
			if b, ok := v.BaseValue.(*Bottom); ok {
				v.BaseValue = CombineErrors(nil, b, n.errs)
			} else {
				v.BaseValue = n.errs
			}
		} else {
			v.state.addBottom(n.errs)
		}
	}
	n.notify = n.notify[:0]
}

func (n *nodeContext) postDisjunct(state VertexStatus) {
	ctx := n.ctx

	for {
		// Use maybeSetCache for cycle breaking
		for n.maybeSetCache(); n.expandOne(state); n.maybeSetCache() {
		}

		if aList, id := n.addLists(); aList != nil {
			n.updateNodeType(ListKind, aList, id)
		} else {
			break
		}
	}

	if n.aStruct != nil {
		n.updateNodeType(StructKind, n.aStruct, n.aStructID)
	}

	if len(n.selfComprehensions) > 0 {
		// Up to here all comprehensions with sources other than this node will
		// have had a chance to run. We can now run self-referencing
		// comprehensions with the restriction that they cannot add new arcs.
		//
		// Note: we should only set this in case of self-referential
		// comprehensions. A comprehension in a parent node may still add
		// arcs to this node, even if it has reached AllConjunctsDone status,
		// as long as any evaluation did not rely on its specific set of arcs.
		// Example:
		//
		//	a: {
		//		b: _env: c: 1
		//
		//		// Using dynamic field ("b") prevents the evaluation of the
		//		// comprehension to be pushed down to env: and instead evaluates
		//		// it before b is completed. Even though b needs to reach state
		//		// AllConjunctsDone before evaluating b._env, it is still okay
		//		// to add arcs to b after this evaluation: only the set of arcs
		//		// in b._env needs to be frozen after that.
		//		for for k2, v2 in b._env {
		//			("b"): env: (k2): v2
		//		}
		//	}
		n.node.LockArcs = true

		n.injectComprehensions(&(n.selfComprehensions), false, state)
	}

	for n.expandOne(state) {
	}

	switch err := n.getErr(); {
	case err != nil:
		if err.Code < IncompleteError && n.node.arcType == arcVoid {
			n.node.arcType = arcMember
		}
		n.node.BaseValue = err
		n.errs = nil

	default:
		if isCyclePlaceholder(n.node.BaseValue) {
			if !n.done() {
				n.node.BaseValue = n.incompleteErrors(true)
			} else {
				n.node.BaseValue = nil
			}
		}
		// TODO: this ideally should be done here. However, doing so causes
		// a somewhat more aggressive cutoff in disjunction cycles, which cause
		// some incompatibilities. Fix in another CL.
		//
		// else if !n.done() {
		// 	n.expandOne()
		// 	if err := n.incompleteErrors(); err != nil {
		// 		n.node.BaseValue = err
		// 	}
		// }

		// We are no longer evaluating.

		// Either set to Conjunction or error.
		// TODO: verify and simplify the below code to determine whether
		// something is a struct.
		markStruct := false
		if n.aStruct != nil {
			markStruct = true
		} else if len(n.node.Structs) > 0 {
			markStruct = n.kind&StructKind != 0 && !n.hasTop
		}
		v := n.node.Value()
		if n.node.BaseValue == nil && markStruct {
			n.node.BaseValue = &StructMarker{}
			v = n.node
		}
		if v != nil && IsConcrete(v) {
			// Also check when we already have errors as we may find more
			// serious errors and would like to know about all errors anyway.

			if n.lowerBound != nil {
				if b := ctx.Validate(n.lowerBound, v); b != nil {
					// TODO(errors): make Validate return boolean and generate
					// optimized conflict message. Also track and inject IDs
					// to determine origin location.s
					if e, _ := b.Err.(*ValueError); e != nil {
						e.AddPosition(n.lowerBound)
						e.AddPosition(v)
					}
					n.addBottom(b)
				}
			}
			if n.upperBound != nil {
				if b := ctx.Validate(n.upperBound, v); b != nil {
					// TODO(errors): make Validate return boolean and generate
					// optimized conflict message. Also track and inject IDs
					// to determine origin location.s
					if e, _ := b.Err.(*ValueError); e != nil {
						e.AddPosition(n.upperBound)
						e.AddPosition(v)
					}
					n.addBottom(b)
				}
			}
			// MOVE BELOW
			// TODO(perf): only delay processing of actual non-monotonic checks.
			skip := n.skipNonMonotonicChecks()
			if v := n.node.Value(); v != nil && IsConcrete(v) && !skip {
				for _, v := range n.checks {
					// TODO(errors): make Validate return bottom and generate
					// optimized conflict message. Also track and inject IDs
					// to determine origin location.s
					if b := ctx.Validate(v, n.node); b != nil {
						n.addBottom(b)
					}
				}
			}
		} else if state == Finalized {
			n.node.BaseValue = n.getValidators(Finalized)
		}

		if v == nil {
			break
		}

		switch {
		case v.Kind() == ListKind:
			for _, a := range n.node.Arcs {
				if a.Label.Typ() == StringLabel && a.IsDefined(ctx) {
					n.addErr(ctx.Newf("list may not have regular fields"))
					// TODO(errors): add positions for list and arc definitions.

				}
			}

			// case !isStruct(n.node) && v.Kind() != BottomKind:
			// 	for _, a := range n.node.Arcs {
			// 		if a.Label.IsRegular() {
			// 			n.addErr(errors.Newf(token.NoPos,
			// 				// TODO(errors): add positions of non-struct values and arcs.
			// 				"cannot combine scalar values with arcs"))
			// 		}
			// 	}
		}
	}

	n.completeArcs(state)
}

// incompleteErrors reports all errors from uncompleted conjuncts.
// If final is true, errors are permanent and reported to parents.
func (n *nodeContext) incompleteErrors(final bool) *Bottom {
	// collect incomplete errors.
	var err *Bottom // n.incomplete
	for _, d := range n.dynamicFields {
		err = CombineErrors(nil, err, d.err)
	}
	for _, c := range n.comprehensions {
		if c.err == nil {
			continue
		}
		err = CombineErrors(nil, err, c.err)

		// TODO: use this code once possible.
		//
		// Add comprehension to ensure incomplete error is inserted. This
		// ensures that the error is reported in the Vertex where the
		// comprehension was defined, and not just in the node below. This, in
		// turn, is necessary to support certain logic, like export, that
		// expects to be able to detect an "incomplete" error at the first level
		// where it is necessary.
		// if c.node.status != Finalized {
		// 	n := c.node.getNodeContext(n.ctx)
		// 	n.comprehensions = append(n.comprehensions, c)
		// } else {
		// 	n.node.AddErr(n.ctx, err)
		// }
		// n := d.node.getNodeContext(ctx)
		// n.addBottom(err)
		if final && c.node != nil && c.node.status != Finalized {
			n := c.node.getNodeContext(n.ctx, 0)
			n.addBottom(err)
			c.node = nil
		}
	}
	for _, c := range n.selfComprehensions {
		if c.err == nil {
			continue
		}

		err = CombineErrors(nil, err, c.err)

		// TODO: use this code once possible.
		//
		// Add comprehension to ensure incomplete error is inserted. This
		// ensures that the error is reported in the Vertex where the
		// comprehension was defined, and not just in the node below. This, in
		// turn, is necessary to support certain logic, like export, that
		// expects to be able to detect an "incomplete" error at the first level
		// where it is necessary.
		// if c.node.status != Finalized {
		// 	n := c.node.getNodeContext(n.ctx)
		// 	n.comprehensions = append(n.comprehensions, c)
		// } else {
		// 	n.node.AddErr(n.ctx, err)
		// }
		// n := d.node.getNodeContext(ctx)
		// n.addBottom(err)
		if c.node != nil && c.node.status != Finalized {
			n := c.node.getNodeContext(n.ctx, 0)
			n.addBottom(err)
			c.node = nil
		}
	}
	for _, x := range n.exprs {
		err = CombineErrors(nil, err, x.err)
	}
	if err == nil {
		// safeguard.
		err = incompleteSentinel
	}
	if err.Code < IncompleteError {
		n.node.arcType = arcMember
	}
	return err
}

// TODO(perf): ideally we should always perform a closedness check if
// state is Finalized. This is currently not possible when computing a
// partial disjunction as the closedness information is not yet
// complete, possibly leading to a disjunct to be rejected prematurely.
// It is probably possible to fix this if we could add StructInfo
// structures demarked per conjunct.
//
// In practice this should not be a problem: when disjuncts originate
// from the same disjunct, they will have the same StructInfos, and thus
// Equal is able to equate them even in the presence of optional field.
// In general, combining any limited set of disjuncts will soon reach
// a fixed point where duplicate elements can be eliminated this way.
//
// Note that not checking closedness is irrelevant for disjunctions of
// scalars. This means it also doesn't hurt performance where structs
// have a discriminator field (e.g. Kubernetes). We should take care,
// though, that any potential performance issues are eliminated for
// Protobuf-like oneOf fields.
func (n *nodeContext) checkClosed(state VertexStatus) bool {
	ignore := state != Finalized || n.skipNonMonotonicChecks()

	v := n.node
	if !v.Label.IsInt() && v.Parent != nil && !ignore && v.isDefined() {
		ctx := n.ctx
		// Visit arcs recursively to validate and compute error.
		if _, err := verifyArc2(ctx, v.Label, v, v.Closed); err != nil {
			// Record error in child node to allow recording multiple
			// conflicts at the appropriate place, to allow valid fields to
			// be represented normally and, most importantly, to avoid
			// recursive processing of a disallowed field.
			v.SetValue(ctx, Finalized, err)
			return false
		}
	}
	return true
}

func (n *nodeContext) completeArcs(state VertexStatus) {
	if DebugSort > 0 {
		DebugSortArcs(n.ctx, n.node)
	}

	if n.node.hasAllConjuncts || n.node.Parent == nil {
		n.node.setParentDone()
	}

	// At this point, if this arc is of type arcVoid, it means that the value
	// may still be modified by child arcs. So in this case we must now process
	// all arcs to be sure we get the correct result.
	// For other cases we terminate early as this results in considerably
	// better error messages.
	if state <= Conjuncts &&
		// Is allowed to go one step back. See Vertex.UpdateStatus.
		n.node.status <= state+1 &&
		n.node.arcType != arcVoid {

		n.node.UpdateStatus(Conjuncts)
		return
	}

	n.node.UpdateStatus(EvaluatingArcs)

	ctx := n.ctx

	if !assertStructuralCycle(n) {
		k := 0
		// Visit arcs recursively to validate and compute error.
		for _, a := range n.node.Arcs {
			// Call UpdateStatus here to be absolutely sure the status is set
			// correctly and that we are not regressing.
			n.node.UpdateStatus(EvaluatingArcs)

			wasVoid := !a.isDefined()

			ctx.Unify(a, state)

			if !a.isDefined() {
				continue
			}

			// Errors are allowed in let fields. Handle errors and failure to
			// complete accordingly.
			if !a.Label.IsLet() {
				// Don't set the state to Finalized if the child arcs are not done.
				if state == Finalized && a.status < Finalized {
					state = Conjuncts
				}

				if err, _ := a.BaseValue.(*Bottom); err != nil {
					n.node.AddChildError(err)
				}
			}

			n.node.Arcs[k] = a
			k++

			switch {
			case !wasVoid, !a.Label.IsString():
			case n.kind&StructKind == 0:
				n.reportFieldMismatch(pos(a.Value()), nil, a.Label, n.node.Value())

			case n.kind == TopKind:
				// Theoretically it may be possible that a "void" arc references
				// this top value where it really should have been a struct. One
				// way to solve this is to have two passes over the arcs, where
				// the first pass additionally analyzes whether comprehensions
				// will yield values and "un-voids" an arc ahead of the rest.
				//
				// At this moment, though, I fail to see a possibility to create
				// faulty CUE using this mechanism, though. At most error
				// messages are a bit unintuitive. This may change once we have
				// functionality to reflect on types.
				if _, ok := n.node.BaseValue.(*Bottom); !ok {
					n.node.BaseValue = &StructMarker{}
					n.kind = StructKind
				}
			}
		}
		n.node.Arcs = n.node.Arcs[:k]

		for _, c := range n.postChecks {
			f := ctx.PushState(c.env, c.expr.Source())

			// TODO(errors): make Validate return bottom and generate
			// optimized conflict message. Also track and inject IDs
			// to determine origin location.s
			v := ctx.evalState(c.expr, Finalized)
			v, _ = ctx.getDefault(v)
			v = Unwrap(v)

			switch _, isError := v.(*Bottom); {
			case isError == c.expectError:
			default:
				n.node.AddErr(ctx, &Bottom{
					Src:  c.expr.Source(),
					Code: CycleError,
					Err: ctx.NewPosf(pos(c.expr),
						"circular dependency in evaluation of conditionals: %v changed after evaluation",
						ctx.Str(c.expr)),
				})
			}

			ctx.PopState(f)
		}
	}

	if err := n.getErr(); err != nil {
		n.errs = nil
		if b, _ := n.node.BaseValue.(*Bottom); b != nil {
			err = CombineErrors(nil, b, err)
		}
		n.node.BaseValue = err
	}

	b, hasErr := n.node.BaseValue.(*Bottom)
	if !hasErr && b != cycle {
		n.checkClosed(state)
	}

	// Strip struct literals that were not initialized and are not part
	// of the output.
	//
	// TODO(perf): we could keep track if any such structs exist and only
	// do this removal if there is a change of shrinking the list.
	k := 0
	for _, s := range n.node.Structs {
		if s.initialized {
			n.node.Structs[k] = s
			k++
		}
	}
	n.node.Structs = n.node.Structs[:k]

	n.node.UpdateStatus(Finalized)
}

// TODO: this is now a sentinel. Use a user-facing error that traces where
// the cycle originates.
var cycle = &Bottom{
	Err:  errors.Newf(token.NoPos, "cycle error"),
	Code: CycleError,
}

func isCyclePlaceholder(v BaseValue) bool {
	return v == cycle
}

func (n *nodeContext) createDisjunct() *Disjunction {
	a := make([]*Vertex, len(n.disjuncts))
	p := 0
	hasDefaults := false
	for i, x := range n.disjuncts {
		v := new(Vertex)
		*v = x.result
		v.state = nil
		switch x.defaultMode {
		case isDefault:
			a[i] = a[p]
			a[p] = v
			p++
			hasDefaults = true

		case notDefault:
			hasDefaults = true
			fallthrough
		case maybeDefault:
			a[i] = v
		}
	}
	// TODO: disambiguate based on concrete values.
	// TODO: consider not storing defaults.
	// if p > 0 {
	// 	a = a[:p]
	// }
	return &Disjunction{
		Values:      a,
		NumDefaults: p,
		HasDefaults: hasDefaults,
	}
}

type arcKey struct {
	arc *Vertex
	id  CloseInfo
}

// A nodeContext is used to collate all conjuncts of a value to facilitate
// unification. Conceptually order of unification does not matter. However,
// order has relevance when performing checks of non-monotic properities. Such
// checks should only be performed once the full value is known.
type nodeContext struct {
	nextFree *nodeContext
	refCount int

	ctx  *OpContext
	node *Vertex

	// TODO: (this is CL is first step)
	// filter *Vertex a subset of composite with concrete fields for
	// bloom-like filtering of disjuncts. We should first verify, however,
	// whether some breath-first search gives sufficient performance, as this
	// should already ensure a quick-fail for struct disjunctions with
	// discriminators.

	arcMap []arcKey

	// snapshot holds the last value of the vertex before calling postDisjunct.
	snapshot Vertex

	// Result holds the last evaluated value of the vertex after calling
	// postDisjunct.
	result Vertex

	// Current value (may be under construction)
	scalar   Value // TODO: use Value in node.
	scalarID CloseInfo

	// Concrete conjuncts
	kind       Kind
	kindExpr   Expr        // expr that adjust last value (for error reporting)
	kindID     CloseInfo   // for error tracing
	lowerBound *BoundValue // > or >=
	upperBound *BoundValue // < or <=
	checks     []Validator // BuiltinValidator, other bound values.
	postChecks []envCheck  // Check non-monotic constraints, among other things.
	errs       *Bottom

	// Conjuncts holds a reference to the Vertex Arcs that still need
	// processing. It does NOT need to be copied.
	conjuncts       []Conjunct
	cyclicConjuncts []cyclicConjunct

	// conjunctsPos is an index into conjuncts indicating the next conjunct
	// to process. This is used to avoids processing a conjunct twice in some
	// cases where there is an evaluation cycle.
	conjunctsPos int

	// notify is used to communicate errors in cyclic dependencies.
	// TODO: also use this to communicate increasingly more concrete values.
	notify []*Vertex

	// Struct information
	dynamicFields      []envDynamic
	comprehensions     []envYield
	selfComprehensions []envYield // comprehensions iterating over own struct.
	aStruct            Expr
	aStructID          CloseInfo

	// Expression conjuncts
	lists  []envList
	vLists []*Vertex
	exprs  []envExpr

	hasTop      bool
	hasCycle    bool // has conjunct with structural cycle
	hasNonCycle bool // has conjunct without structural cycle
	depth       int32

	// Disjunction handling
	disjunctions []envDisjunct

	// usedDefault indicates the for each of possibly multiple parent
	// disjunctions whether it is unified with a default disjunct or not.
	// This is then later used to determine whether a disjunction should
	// be treated as a marked disjunction.
	usedDefault []defaultInfo

	defaultMode  defaultMode
	disjuncts    []*nodeContext
	buffer       []*nodeContext
	disjunctErrs []*Bottom
}

// Logf substitutes args in format. Arguments of type Feature, Value, and Expr
// are printed in human-friendly formats. The printed string is prefixed and
// indented with the path associated with the current nodeContext.
func (n *nodeContext) Logf(format string, args ...interface{}) {
	n.ctx.Logf(n.node, format, args...)
}

type defaultInfo struct {
	// parentMode indicates whether this values was used as a default value,
	// based on the parent mode.
	parentMode defaultMode

	// The result of default evaluation for a nested disjunction.
	nestedMode defaultMode

	origMode defaultMode
}

func (n *nodeContext) addNotify(v *Vertex) {
	if v != nil && !n.node.hasAllConjuncts {
		n.notify = append(n.notify, v)
	}
}

func (n *nodeContext) clone() *nodeContext {
	d := n.ctx.newNodeContext(n.node)

	d.refCount++

	d.ctx = n.ctx
	d.node = n.node

	d.scalar = n.scalar
	d.scalarID = n.scalarID
	d.kind = n.kind
	d.kindExpr = n.kindExpr
	d.kindID = n.kindID
	d.aStruct = n.aStruct
	d.aStructID = n.aStructID
	d.hasTop = n.hasTop

	d.lowerBound = n.lowerBound
	d.upperBound = n.upperBound
	d.errs = n.errs
	d.hasTop = n.hasTop
	d.hasCycle = n.hasCycle
	d.hasNonCycle = n.hasNonCycle
	d.depth = n.depth

	// d.arcMap = append(d.arcMap, n.arcMap...) // XXX add?
	d.cyclicConjuncts = append(d.cyclicConjuncts, n.cyclicConjuncts...)
	d.notify = append(d.notify, n.notify...)
	d.checks = append(d.checks, n.checks...)
	d.postChecks = append(d.postChecks, n.postChecks...)
	d.dynamicFields = append(d.dynamicFields, n.dynamicFields...)
	d.comprehensions = append(d.comprehensions, n.comprehensions...)
	d.selfComprehensions = append(d.selfComprehensions, n.selfComprehensions...)
	d.lists = append(d.lists, n.lists...)
	d.vLists = append(d.vLists, n.vLists...)
	d.exprs = append(d.exprs, n.exprs...)
	d.usedDefault = append(d.usedDefault, n.usedDefault...)

	// No need to clone d.disjunctions

	return d
}

func (c *OpContext) newNodeContext(node *Vertex) *nodeContext {
	if n := c.freeListNode; n != nil {
		c.stats.Reused++
		c.freeListNode = n.nextFree

		*n = nodeContext{
			ctx:                c,
			node:               node,
			kind:               TopKind,
			arcMap:             n.arcMap[:0],
			cyclicConjuncts:    n.cyclicConjuncts[:0],
			notify:             n.notify[:0],
			checks:             n.checks[:0],
			postChecks:         n.postChecks[:0],
			dynamicFields:      n.dynamicFields[:0],
			comprehensions:     n.comprehensions[:0],
			selfComprehensions: n.selfComprehensions[:0],
			lists:              n.lists[:0],
			vLists:             n.vLists[:0],
			exprs:              n.exprs[:0],
			disjunctions:       n.disjunctions[:0],
			usedDefault:        n.usedDefault[:0],
			disjunctErrs:       n.disjunctErrs[:0],
			disjuncts:          n.disjuncts[:0],
			buffer:             n.buffer[:0],
		}

		return n
	}
	c.stats.Allocs++

	return &nodeContext{
		ctx:  c,
		node: node,
		kind: TopKind,
	}
}

func (v *Vertex) getNodeContext(c *OpContext, ref int) *nodeContext {
	if v.state == nil {
		if v.status == Finalized {
			return nil
		}
		v.state = c.newNodeContext(v)
	} else if v.state.node != v {
		panic("getNodeContext: nodeContext out of sync")
	}
	v.state.refCount += ref
	return v.state
}

func (v *Vertex) freeNode(n *nodeContext) {
	if n == nil {
		return
	}
	if n.node != v {
		panic("freeNode: unpaired free")
	}
	if v.state != nil && v.state != n {
		panic("freeNode: nodeContext out of sync")
	}
	if n.refCount--; n.refCount == 0 {
		if v.status == Finalized {
			v.freeNodeState()
		} else {
			n.ctx.stats.Retained++
		}
	}
}

func (v *Vertex) freeNodeState() {
	if v.state == nil {
		return
	}
	state := v.state
	v.state = nil

	state.ctx.freeNodeContext(state)
}

func (n *nodeContext) free() {
	if n.refCount--; n.refCount == 0 {
		n.ctx.freeNodeContext(n)
	}
}

func (c *OpContext) freeNodeContext(n *nodeContext) {
	c.stats.Freed++
	n.nextFree = c.freeListNode
	c.freeListNode = n
	n.node = nil
	n.refCount = 0
}

// TODO(perf): return a dedicated ConflictError that can track original
// positions on demand.
func (n *nodeContext) reportConflict(
	v1, v2 Node,
	k1, k2 Kind,
	ids ...CloseInfo) {

	ctx := n.ctx

	var err *ValueError
	if k1 == k2 {
		err = ctx.NewPosf(token.NoPos, "conflicting values %s and %s", v1, v2)
	} else {
		err = ctx.NewPosf(token.NoPos,
			"conflicting values %s and %s (mismatched types %s and %s)",
			v1, v2, k1, k2)
	}

	err.AddPosition(v1)
	err.AddPosition(v2)
	for _, id := range ids {
		err.AddClosedPositions(id)
	}

	n.addErr(err)
}

// reportFieldMismatch reports the mixture of regular fields with non-struct
// values. Either s or f needs to be given.
func (n *nodeContext) reportFieldMismatch(
	p token.Pos,
	s *StructLit,
	f Feature,
	scalar Expr,
	id ...CloseInfo) {

	ctx := n.ctx

	if f == InvalidLabel {
		for _, a := range s.Decls {
			if x, ok := a.(*Field); ok && x.Label.IsRegular() {
				f = x.Label
				p = pos(x)
				break
			}
		}
		if f == InvalidLabel {
			n.reportConflict(scalar, s, n.kind, StructKind, id...)
			return
		}
	}

	err := ctx.NewPosf(p, "cannot combine regular field %q with %v", f, scalar)

	if s != nil {
		err.AddPosition(s)
	}

	for _, ci := range id {
		err.AddClosedPositions(ci)
	}

	n.addErr(err)
}

func (n *nodeContext) updateNodeType(k Kind, v Expr, id CloseInfo) bool {
	ctx := n.ctx
	kind := n.kind & k

	switch {
	case n.kind == BottomKind,
		k == BottomKind:
		return false

	case kind != BottomKind:

	// TODO: we could consider changing the reporting for structs, but this
	// makes only sense in case they are for embeddings. Otherwise the type
	// of a struct is more relevant for the failure.
	// case k == StructKind:
	// 	s, _ := v.(*StructLit)
	// 	n.reportFieldMismatch(token.NoPos, s, 0, n.kindExpr, id, n.kindID)

	case n.kindExpr != nil:
		n.reportConflict(n.kindExpr, v, n.kind, k, n.kindID, id)

	default:
		n.addErr(ctx.Newf(
			"conflicting value %s (mismatched types %s and %s)",
			v, n.kind, k))
	}

	if n.kind != kind || n.kindExpr == nil {
		n.kindExpr = v
	}
	n.kind = kind
	return kind != BottomKind
}

func (n *nodeContext) done() bool {
	return len(n.dynamicFields) == 0 &&
		len(n.comprehensions) == 0 &&
		len(n.exprs) == 0
}

// finalDone is like done, but allows for cycle errors, which can be ignored
// as they essentially indicate a = a & _.
func (n *nodeContext) finalDone() bool {
	for _, x := range n.exprs {
		if x.err.Code != CycleError {
			return false
		}
	}
	return len(n.dynamicFields) == 0 &&
		len(n.comprehensions) == 0 &&
		len(n.selfComprehensions) == 0
}

// hasErr is used to determine if an evaluation path, for instance a single
// path after expanding all disjunctions, has an error.
func (n *nodeContext) hasErr() bool {
	if n.node.ChildErrors != nil {
		return true
	}
	if n.node.Status() > Evaluating && n.node.IsErr() {
		return true
	}
	return n.ctx.HasErr() || n.errs != nil
}

func (n *nodeContext) getErr() *Bottom {
	n.errs = CombineErrors(nil, n.errs, n.ctx.Err())
	return n.errs
}

// getValidators sets the vertex' Value in case there was no concrete value.
func (n *nodeContext) getValidators(state VertexStatus) BaseValue {
	ctx := n.ctx

	a := []Value{}
	// if n.node.Value != nil {
	// 	a = append(a, n.node.Value)
	// }
	kind := TopKind
	if n.lowerBound != nil {
		a = append(a, n.lowerBound)
		kind &= n.lowerBound.Kind()
	}
	if n.upperBound != nil {
		a = append(a, n.upperBound)
		kind &= n.upperBound.Kind()
	}
	for _, c := range n.checks {
		// Drop !=x if x is out of bounds with another bound.
		if b, _ := c.(*BoundValue); b != nil && b.Op == NotEqualOp {
			if n.upperBound != nil &&
				SimplifyBounds(ctx, n.kind, n.upperBound, b) != nil {
				continue
			}
			if n.lowerBound != nil &&
				SimplifyBounds(ctx, n.kind, n.lowerBound, b) != nil {
				continue
			}
		}
		a = append(a, c)
		kind &= c.Kind()
	}

	if kind&^n.kind != 0 {
		a = append(a, &BasicType{
			Src: n.kindExpr.Source(), // TODO:Is this always a BasicType?
			K:   n.kind,
		})
	}

	var v BaseValue
	switch len(a) {
	case 0:
		// Src is the combined input.
		if state >= Conjuncts || n.kind&^CompositKind == 0 {
			v = &BasicType{K: n.kind}
		}

	case 1:
		v = a[0]

	default:
		v = &Conjunction{Values: a}
	}

	return v
}

// TODO: this function can probably go as this is now handled in the nodeContext.
func (n *nodeContext) maybeSetCache() {
	// Set BaseValue to scalar, but only if it was not set before. Most notably,
	// errors should not be discarded.
	_, isErr := n.node.BaseValue.(*Bottom)
	if n.scalar != nil && (!isErr || isCyclePlaceholder(n.node.BaseValue)) {
		n.node.BaseValue = n.scalar
	}
	// NOTE: this is now handled by associating the nodeContext
	// if n.errs != nil {
	// 	n.node.SetValue(n.ctx, Partial, n.errs)
	// }
}

type envExpr struct {
	c   Conjunct
	err *Bottom
}

type envDynamic struct {
	env   *Environment
	field *DynamicField
	id    CloseInfo
	err   *Bottom
}

type envList struct {
	env     *Environment
	list    *ListLit
	n       int64 // recorded length after evaluator
	elipsis *Ellipsis
	id      CloseInfo
	ignore  bool // has a self-referencing comprehension and is postponed
	self    bool // was added as a postponed self-referencing comprehension
	index   int
}

type envCheck struct {
	env         *Environment
	expr        Expr
	expectError bool
}

func (n *nodeContext) addBottom(b *Bottom) {
	n.errs = CombineErrors(nil, n.errs, b)
	// TODO(errors): consider doing this
	// n.kindExpr = n.errs
	// n.kind = 0
}

func (n *nodeContext) addErr(err errors.Error) {
	if err != nil {
		n.addBottom(&Bottom{Err: err})
	}
}

// addExprConjuncts will attempt to evaluate an Expr and insert the value
// into the nodeContext if successful or queue it for later evaluation if it is
// incomplete or is not value.
func (n *nodeContext) addExprConjunct(v Conjunct, state VertexStatus) {
	env := v.Env
	id := v.CloseInfo

	switch x := v.Elem().(type) {
	case *Vertex:
		if x.IsData() {
			n.addValueConjunct(env, x, id)
		} else {
			n.addVertexConjuncts(v, x, true)
		}

	case Value:
		n.addValueConjunct(env, x, id)

	case *BinaryExpr:
		if x.Op == AndOp {
			n.addExprConjunct(MakeConjunct(env, x.X, id), state)
			n.addExprConjunct(MakeConjunct(env, x.Y, id), state)
			return
		} else {
			n.evalExpr(v, state)
		}

	case *StructLit:
		n.addStruct(env, x, id)

	case *ListLit:
		childEnv := &Environment{
			Up:     env,
			Vertex: n.node,
		}
		n.lists = append(n.lists, envList{env: childEnv, list: x, id: id})

	case *DisjunctionExpr:
		n.addDisjunction(env, x, id)

	case *Comprehension:
		// always a partial comprehension.
		n.insertComprehension(env, x, id)
		return

	default:
		// Must be Resolver or Evaluator.
		n.evalExpr(v, state)
	}
	n.ctx.stats.Conjuncts++
}

// evalExpr is only called by addExprConjunct. If an error occurs, it records
// the error in n and returns nil.
func (n *nodeContext) evalExpr(v Conjunct, state VertexStatus) {
	// Require an Environment.
	ctx := n.ctx

	closeID := v.CloseInfo

	switch x := v.Expr().(type) {
	case Resolver:
		// We elevate a field evaluated to the Conjuncts state to Finalized
		// later. For now we allow partial evaluation so that we can break
		// cycles and postpone incomplete evaluations until more information is
		// available down the line.
		if state == Finalized {
			state = Conjuncts
		}
		arc, err := ctx.resolveState(v, x, state)
		if err != nil && (!err.IsIncomplete() || err.Permanent) {
			n.addBottom(err)
			break
		}
		if arc == nil {
			n.exprs = append(n.exprs, envExpr{v, err})
			break
		}

		// We complete the evaluation. Some optimizations will only work when an
		// arc is already finalized. So this ensures that such optimizations get
		// triggered more often.
		//
		// NOTE(let finalization): aside from being an optimization, this also
		// ensures that let arcs that are not contained as fields of arcs, but
		// rather are held in the cash, are finalized. This, in turn, is
		// necessary to trigger the notification mechanism, where appropriate.
		//
		// A node should not Finalize itself as it may erase the state object
		// which is still assumed to be present down the line
		// (see https://cuelang.org/issues/2171).
		if arc.status == Conjuncts && arc != n.node && arc.hasAllConjuncts {
			arc.Finalize(ctx)
		}

		ci, skip := n.markCycle(arc, v.Env, x, v.CloseInfo)
		if skip {
			return
		}
		v.CloseInfo = ci

		n.addVertexConjuncts(v, arc, false)

	case Evaluator:
		// Interpolation, UnaryExpr, BinaryExpr, CallExpr
		// Could be unify?
		val := ctx.evaluateRec(v, Partial)
		if b, ok := val.(*Bottom); ok &&
			b.IsIncomplete() {
			n.exprs = append(n.exprs, envExpr{v, b})
			break
		}

		if v, ok := val.(*Vertex); ok {
			// Handle generated disjunctions (as in the 'or' builtin).
			// These come as a Vertex, but should not be added as a value.
			b, ok := v.BaseValue.(*Bottom)
			if ok && b.IsIncomplete() && len(v.Conjuncts) > 0 {
				for _, c := range v.Conjuncts {
					c.CloseInfo = closeID
					n.addExprConjunct(c, state)
				}
				break
			}
		}

		// TODO: also to through normal Vertex handling here. At the moment
		// addValueConjunct handles StructMarker.NeedsClose, as this is always
		// only needed when evaluation an Evaluator, and not a Resolver.
		// The two code paths should ideally be merged once this separate
		// mechanism is eliminated.
		//
		// if arc, ok := val.(*Vertex); ok && !arc.IsData() {
		// 	n.addVertexConjuncts(v.Env, closeID, v.Expr(), arc)
		// 	break
		// }

		// TODO: insert in vertex as well
		n.addValueConjunct(v.Env, val, closeID)

	default:
		panic(fmt.Sprintf("unknown expression of type %T", x))
	}
}

func (n *nodeContext) addVertexConjuncts(c Conjunct, arc *Vertex, inline bool) {
	closeInfo := c.CloseInfo

	// We need to ensure that each arc is only unified once (or at least) a
	// bounded time, witch each conjunct. Comprehensions, for instance, may
	// distribute a value across many values that get unified back into the
	// same value. If such a value is a disjunction, than a disjunction of N
	// disjuncts will result in a factor N more unifications for each
	// occurrence of such value, resulting in exponential running time. This
	// is especially common values that are used as a type.
	//
	// However, unification is idempotent, so each such conjunct only needs
	// to be unified once. This cache checks for this and prevents an
	// exponential blowup in such case.
	//
	// TODO(perf): this cache ensures the conjuncts of an arc at most once
	// per ID. However, we really need to add the conjuncts of an arc only
	// once total, and then add the close information once per close ID
	// (pointer can probably be shared). Aside from being more performant,
	// this is probably the best way to guarantee that conjunctions are
	// linear in this case.

	ckey := closeInfo
	ckey.Refs = nil
	ckey.Inline = false
	key := arcKey{arc, ckey}
	for _, k := range n.arcMap {
		if key == k {
			return
		}
	}
	n.arcMap = append(n.arcMap, key)

	status := arc.Status()

	switch status {
	case Evaluating:
		// Reference cycle detected. We have reached a fixed point and
		// adding conjuncts at this point will not change the value. Also,
		// continuing to pursue this value will result in an infinite loop.

		// TODO: add a mechanism so that the computation will only have to
		// be done once?

		if arc == n.node {
			// TODO: we could use node sharing here. This may avoid an
			// exponential blowup during evaluation, like is possible with
			// YAML.
			return
		}

	case EvaluatingArcs:
		// There is a structural cycle, but values may be processed nonetheless
		// if there is a non-cyclic conjunct. See cycle.go.
	}

	// Performance: the following if check filters cases that are not strictly
	// necessary for correct functioning. Not updating the closeInfo may cause
	// some position information to be lost for top-level positions of merges
	// resulting form APIs. These tend to be fairly uninteresting.
	// At the same time, this optimization may prevent considerable slowdown
	// in case an API does many calls to Unify.
	x := c.Expr()
	if !inline || arc.IsClosedStruct() || arc.IsClosedList() {
		closeInfo = closeInfo.SpawnRef(arc, IsDef(x), x)
	}

	if arc.status == 0 && !inline {
		// This is a rare condition, but can happen in certain
		// evaluation orders. Unfortunately, adding this breaks
		// resolution of cyclic mutually referring disjunctions. But it
		// is necessary to prevent lookups in unevaluated structs.
		// TODO(cycles): this can probably most easily be fixed with a
		// having a more recursive implementation.
		n.ctx.Unify(arc, Partial)
	}

	// Don't add conjuncts if a node is referring to itself.
	if n.node == arc {
		return
	}

	if arc.state != nil {
		arc.state.addNotify(n.node)
	}

	for _, c := range arc.Conjuncts {
		// Note that we are resetting the tree here. We hereby assume that
		// closedness conflicts resulting from unifying the referenced arc were
		// already caught there and that we can ignore further errors here.
		c.CloseInfo = closeInfo
		n.addExprConjunct(c, Partial)
	}
}

// isDef reports whether an expressions is a reference that references a
// definition anywhere in its selection path.
//
// TODO(performance): this should be merged with resolve(). But for now keeping
// this code isolated makes it easier to see what it is for.
func isDef(x Expr) bool {
	switch r := x.(type) {
	case *FieldReference:
		return r.Label.IsDef()

	case *SelectorExpr:
		if r.Sel.IsDef() {
			return true
		}
		return isDef(r.X)

	case *IndexExpr:
		return isDef(r.X)
	}
	return false
}

func (n *nodeContext) addValueConjunct(env *Environment, v Value, id CloseInfo) {
	n.updateCyclicStatus(id)

	ctx := n.ctx

	if x, ok := v.(*Vertex); ok {
		if m, ok := x.BaseValue.(*StructMarker); ok {
			n.aStruct = x
			n.aStructID = id
			if m.NeedClose {
				id.IsClosed = true
			}
		}

		if !x.IsData() {
			// TODO: this really shouldn't happen anymore.
			if isComplexStruct(ctx, x) {
				// This really shouldn't happen, but just in case.
				n.addVertexConjuncts(MakeConjunct(env, x, id), x, true)
				return
			}

			for _, c := range x.Conjuncts {
				c.CloseInfo = id
				n.addExprConjunct(c, Partial) // TODO: Pass from eval
			}
			return
		}

		// TODO: evaluate value?
		switch v := x.BaseValue.(type) {
		default:
			panic(fmt.Sprintf("invalid type %T", x.BaseValue))

		case *ListMarker:
			n.vLists = append(n.vLists, x)
			return

		case *StructMarker:

		case Value:
			n.addValueConjunct(env, v, id)
		}

		if len(x.Arcs) == 0 {
			return
		}

		s := &StructLit{}

		// Keep ordering of Go struct for topological sort.
		n.node.AddStruct(s, env, id)
		n.node.Structs = append(n.node.Structs, x.Structs...)

		for _, a := range x.Arcs {
			if !a.IsDefined(ctx) {
				continue
			}
			// TODO(errors): report error when this is a regular field.
			c := MakeConjunct(nil, a, id)
			n.insertField(a.Label, c)
			s.MarkField(a.Label)
		}
		return
	}

	switch b := v.(type) {
	case *Bottom:
		n.addBottom(b)
		return
	case *Builtin:
		if v := b.BareValidator(); v != nil {
			n.addValueConjunct(env, v, id)
			return
		}
	}

	if !n.updateNodeType(v.Kind(), v, id) {
		return
	}

	switch x := v.(type) {
	case *Disjunction:
		n.addDisjunctionValue(env, x, id)

	case *Conjunction:
		for _, x := range x.Values {
			n.addValueConjunct(env, x, id)
		}

	case *Top:
		n.hasTop = true

	case *BasicType:
		// handled above

	case *BoundValue:
		switch x.Op {
		case LessThanOp, LessEqualOp:
			if y := n.upperBound; y != nil {
				n.upperBound = nil
				v := SimplifyBounds(ctx, n.kind, x, y)
				if err := valueError(v); err != nil {
					err.AddPosition(v)
					err.AddPosition(n.upperBound)
					err.AddClosedPositions(id)
				}
				n.addValueConjunct(env, v, id)
				return
			}
			n.upperBound = x

		case GreaterThanOp, GreaterEqualOp:
			if y := n.lowerBound; y != nil {
				n.lowerBound = nil
				v := SimplifyBounds(ctx, n.kind, x, y)
				if err := valueError(v); err != nil {
					err.AddPosition(v)
					err.AddPosition(n.lowerBound)
					err.AddClosedPositions(id)
				}
				n.addValueConjunct(env, v, id)
				return
			}
			n.lowerBound = x

		case EqualOp, NotEqualOp, MatchOp, NotMatchOp:
			// This check serves as simplifier, but also to remove duplicates.
			k := 0
			match := false
			for _, c := range n.checks {
				if y, ok := c.(*BoundValue); ok {
					switch z := SimplifyBounds(ctx, n.kind, x, y); {
					case z == y:
						match = true
					case z == x:
						continue
					}
				}
				n.checks[k] = c
				k++
			}
			n.checks = n.checks[:k]
			if !match {
				n.checks = append(n.checks, x)
			}
			return
		}

	case Validator:
		// This check serves as simplifier, but also to remove duplicates.
		for i, y := range n.checks {
			if b := SimplifyValidator(ctx, x, y); b != nil {
				n.checks[i] = b
				return
			}
		}
		n.updateNodeType(x.Kind(), x, id)
		n.checks = append(n.checks, x)

	case *Vertex:
	// handled above.

	case Value: // *NullLit, *BoolLit, *NumLit, *StringLit, *BytesLit, *Builtin
		if y := n.scalar; y != nil {
			if b, ok := BinOp(ctx, EqualOp, x, y).(*Bool); !ok || !b.B {
				n.reportConflict(x, y, x.Kind(), y.Kind(), n.scalarID, id)
			}
			// TODO: do we need to explicitly add again?
			// n.scalar = nil
			// n.addValueConjunct(c, BinOp(c, EqualOp, x, y))
			break
		}
		n.scalar = x
		n.scalarID = id

	default:
		panic(fmt.Sprintf("unknown value type %T", x))
	}

	if n.lowerBound != nil && n.upperBound != nil {
		if u := SimplifyBounds(ctx, n.kind, n.lowerBound, n.upperBound); u != nil {
			if err := valueError(u); err != nil {
				err.AddPosition(n.lowerBound)
				err.AddPosition(n.upperBound)
				err.AddClosedPositions(id)
			}
			n.lowerBound = nil
			n.upperBound = nil
			n.addValueConjunct(env, u, id)
		}
	}
}

func valueError(v Value) *ValueError {
	if v == nil {
		return nil
	}
	b, _ := v.(*Bottom)
	if b == nil {
		return nil
	}
	err, _ := b.Err.(*ValueError)
	if err == nil {
		return nil
	}
	return err
}

// addStruct collates the declarations of a struct.
//
// addStruct fulfills two additional pivotal functions:
//  1. Implement vertex unification (this happens through De Bruijn indices
//     combined with proper set up of Environments).
//  2. Implied closedness for definitions.
func (n *nodeContext) addStruct(
	env *Environment,
	s *StructLit,
	closeInfo CloseInfo) {

	n.updateCyclicStatus(closeInfo)

	// NOTE: This is a crucial point in the code:
	// Unification dereferencing happens here. The child nodes are set to
	// an Environment linked to the current node. Together with the De Bruijn
	// indices, this determines to which Vertex a reference resolves.

	childEnv := &Environment{
		Up:     env,
		Vertex: n.node,
	}

	s.Init()

	if s.HasEmbed && !s.IsFile() {
		closeInfo = closeInfo.SpawnGroup(nil)
	}

	parent := n.node.AddStruct(s, childEnv, closeInfo)
	closeInfo.IsClosed = false
	parent.Disable = true // disable until processing is done.

	for _, d := range s.Decls {
		switch x := d.(type) {
		case *Field, *LetField:
			// handle in next iteration.

		case *DynamicField:
			n.aStruct = s
			n.aStructID = closeInfo
			n.dynamicFields = append(n.dynamicFields, envDynamic{childEnv, x, closeInfo, nil})

		case *Comprehension:
			n.insertComprehension(childEnv, x, closeInfo)

		case Expr:
			// add embedding to optional

			// TODO(perf): only do this if addExprConjunct below will result in
			// a fieldSet. Otherwise the entry will just be removed next.
			id := closeInfo.SpawnEmbed(x)

			// push and opo embedding type.
			n.addExprConjunct(MakeConjunct(childEnv, x, id), Partial)

		case *OptionalField, *BulkOptionalField, *Ellipsis:
			// Nothing to do here. Note that the presence of these fields do not
			// excluded embedded scalars: only when they match actual fields
			// does it exclude those.

		default:
			panic("unreachable")
		}
	}

	if !s.HasEmbed {
		n.aStruct = s
		n.aStructID = closeInfo
	}

	parent.Disable = false

	for _, d := range s.Decls {
		switch x := d.(type) {
		case *Field:
			if x.Label.IsString() {
				n.aStruct = s
				n.aStructID = closeInfo
			}
			n.insertField(x.Label, MakeConjunct(childEnv, x, closeInfo))

		case *LetField:
			arc := n.insertField(x.Label, MakeConjunct(childEnv, x, closeInfo))
			if x.IsMulti {
				arc.MultiLet = x.IsMulti
			}
		}
	}
}

// TODO(perf): if an arc is the only arc with that label added to a Vertex, and
// if there are no conjuncts of optional fields to be added, then the arc could
// be added as is until any of these conditions change. This would allow
// structure sharing in many cases. One should be careful, however, to
// recursively track arcs of previously unified evaluated vertices ot make this
// optimization meaningful.
//
// An alternative approach to avoid evaluating optional arcs (if we take that
// route) is to not recursively evaluate those arcs, even for Finalize. This is
// possible as it is not necessary to evaluate optional arcs to evaluate
// disjunctions.
func (n *nodeContext) insertField(f Feature, x Conjunct) *Vertex {
	ctx := n.ctx
	arc, isNew := n.node.GetArc(ctx, f, arcMember)
	if f.IsLet() && !isNew {
		arc.MultiLet = true
		return arc
	}
	if arc.hasConjunct(x) {
		return arc
	}

	switch {
	case arc.state != nil:
		arc.state.addConjunctDynamic(x)

	case arc.Status() == 0:
		arc.addConjunctUnchecked(x)

	default:
		n.addBottom(&Bottom{
			Code: IncompleteError,
			Err: ctx.NewPosf(pos(x.Field()),
				"cannot add field %s: was already used",
				f.SelectorString(ctx)),
		})
	}
	return arc
}

// expandOne adds dynamic fields to a node until a fixed point is reached.
// On each iteration, dynamic fields that cannot resolve due to incomplete
// values are skipped. They will be retried on the next iteration until no
// progress can be made. Note that a dynamic field may add more dynamic fields.
//
// forClauses are processed after all other clauses. A struct may be referenced
// before it is complete, meaning that fields added by other forms of injection
// may influence the result of a for clause _after_ it has already been
// processed. We could instead detect such insertion and feed it to the
// ForClause to generate another entry or have the for clause be recomputed.
// This seems to be too complicated and lead to iffy edge cases.
// TODO(errors): detect when a field is added to a struct that is already used
// in a for clause.
func (n *nodeContext) expandOne(state VertexStatus) (done bool) {
	// Don't expand incomplete expressions if we detected a cycle.
	if n.done() || (n.hasCycle && !n.hasNonCycle) {
		return false
	}

	var progress bool

	if progress = n.injectDynamic(); progress {
		return true
	}

	if progress = n.injectComprehensions(&(n.comprehensions), true, state); progress {
		return true
	}

	// Do expressions after comprehensions, as comprehensions can never
	// refer to embedded scalars, whereas expressions may refer to generated
	// fields if we were to allow attributes to be defined alongside
	// scalars.
	exprs := n.exprs
	n.exprs = n.exprs[:0]
	for _, x := range exprs {
		n.addExprConjunct(x.c, state)

		// collect and and or
	}
	if len(n.exprs) < len(exprs) {
		return true
	}

	// No progress, report error later if needed: unification with
	// disjuncts may resolve this later later on.
	return false
}

// injectDynamic evaluates and inserts dynamic declarations.
func (n *nodeContext) injectDynamic() (progress bool) {
	ctx := n.ctx
	k := 0

	a := n.dynamicFields
	for _, d := range n.dynamicFields {
		var f Feature
		x := d.field.Key
		// Push state to capture and remove errors.
		s := ctx.PushState(d.env, x.Source())
		v := ctx.evalState(x, Finalized)
		b := ctx.PopState(s)

		if b != nil && b.IsIncomplete() {
			d.err, _ = v.(*Bottom)
			a[k] = d
			k++
			continue
		}
		if b, _ := v.(*Bottom); b != nil {
			n.addValueConjunct(nil, b, d.id)
			continue
		}
		f = ctx.Label(d.field.Key, v)
		if f.IsInt() {
			n.addErr(ctx.NewPosf(pos(d.field.Key), "integer fields not supported"))
		}
		n.insertField(f, MakeConjunct(d.env, d.field, d.id))
	}

	progress = k < len(n.dynamicFields)

	n.dynamicFields = a[:k]

	return progress
}

// addLists
//
// TODO: association arrays:
// If an association array marker was present in a struct, create a struct node
// instead of a list node. In either case, a node may only have list fields
// or struct fields and not both.
//
// addLists should be run after the fixpoint expansion:
//   - it enforces that comprehensions may not refer to the list itself
//   - there may be no other fields within the list.
//
// TODO(embeddedScalars): for embedded scalars, there should be another pass
// of evaluation expressions after expanding lists.
func (n *nodeContext) addLists() (oneOfTheLists Expr, anID CloseInfo) {
	if len(n.lists) == 0 && len(n.vLists) == 0 {
		return nil, CloseInfo{}
	}

	isOpen := true
	max := 0
	var maxNode Expr

	if m, ok := n.node.BaseValue.(*ListMarker); ok {
		isOpen = m.IsOpen
		max = len(n.node.Arcs)
	}

	c := n.ctx

	for _, l := range n.vLists {
		// XXX: set hasNonCycle if appropriate.

		oneOfTheLists = l

		elems := l.Elems()
		isClosed := l.IsClosedList()

		switch {
		case len(elems) < max:
			if isClosed {
				n.invalidListLength(len(elems), max, l, maxNode)
				continue
			}

		case len(elems) > max:
			if !isOpen {
				n.invalidListLength(max, len(elems), maxNode, l)
				continue
			}
			isOpen = !isClosed
			max = len(elems)
			maxNode = l

		case isClosed:
			isOpen = false
			maxNode = l
		}

		for _, a := range elems {
			if a.Conjuncts == nil {
				n.insertField(a.Label, MakeRootConjunct(nil, a))
				continue
			}
			for _, c := range a.Conjuncts {
				n.insertField(a.Label, c)
			}
		}
	}

outer:
	// updateCyclicStatus may grow the list of values, so we cannot use range.
	for i := 0; i < len(n.lists); i++ {
		l := n.lists[i]

		n.updateCyclicStatus(l.id)

		if l.self {
			n.node.LockArcs = true
		}

		index := int64(0)
		hasComprehension := false
		for j, elem := range l.list.Elems {
			switch x := elem.(type) {
			case *Comprehension:
				err := c.yield(nil, l.env, x, Finalized, func(e *Environment) {
					label, err := MakeLabel(x.Source(), index, IntLabel)
					n.addErr(err)
					index++
					c := MakeConjunct(e, x.Value, l.id)
					n.insertField(label, c)
				})
				hasComprehension = true
				if err != nil {
					if err.ForCycle && !l.self {
						// The list has a comprehension that refers to the list
						// itself. This means we should postpone evalauting this
						// list until all other lists have been evaluated.
						n.lists[i].ignore = true
						l.self = true
						n.lists = append(n.lists, l)
					} else {
						n.addBottom(err)
					}
					continue outer
				}

			case *Ellipsis:
				if j != len(l.list.Elems)-1 {
					n.addErr(c.Newf("ellipsis must be last element in list"))
				}

				n.lists[i].elipsis = x

			default:
				label, err := MakeLabel(x.Source(), index, IntLabel)
				n.addErr(err)
				index++ // TODO: don't use insertField.
				n.insertField(label, MakeConjunct(l.env, x, l.id))
			}

			// Terminate early in case of runaway comprehension.
			if !isOpen && int(index) > max {
				n.invalidListLength(max, len(l.list.Elems), maxNode, l.list)
				continue outer
			}
		}

		oneOfTheLists = l.list
		anID = l.id

		switch closed := n.lists[i].elipsis == nil; {
		case int(index) < max:
			if closed {
				n.invalidListLength(int(index), max, l.list, maxNode)
				continue
			}

		case int(index) > max,
			closed && isOpen,
			(!closed == isOpen) && !hasComprehension:
			max = int(index)
			maxNode = l.list
			isOpen = !closed
		}

		n.lists[i].n = index
	}

	// add additionalItem values to list and construct optionals.
	elems := n.node.Elems()
	for _, l := range n.vLists {
		if !l.IsClosedList() {
			continue
		}

		newElems := l.Elems()
		if len(newElems) >= len(elems) {
			continue // error generated earlier, if applicable.
		}

		for _, arc := range elems[len(newElems):] {
			l.MatchAndInsert(c, arc)
		}
	}

	for _, l := range n.lists {
		if l.elipsis == nil || l.ignore {
			continue
		}

		s := l.list.info
		if s == nil {
			s = &StructLit{Decls: []Decl{l.elipsis}}
			s.Init()
			l.list.info = s
		}
		info := n.node.AddStruct(s, l.env, l.id)

		for _, arc := range elems[l.n:] {
			info.MatchAndInsert(c, arc)
		}
	}

	sources := []ast.Expr{}
	// Add conjuncts for additional items.
	for _, l := range n.lists {
		if l.elipsis == nil || l.ignore {
			continue
		}
		if src, _ := l.elipsis.Source().(ast.Expr); src != nil {
			sources = append(sources, src)
		}
	}

	if m, ok := n.node.BaseValue.(*ListMarker); !ok {
		n.node.SetValue(c, Partial, &ListMarker{
			Src:    ast.NewBinExpr(token.AND, sources...),
			IsOpen: isOpen,
		})
	} else {
		if expr, _ := m.Src.(ast.Expr); expr != nil {
			sources = append(sources, expr)
		}
		m.Src = ast.NewBinExpr(token.AND, sources...)
		m.IsOpen = m.IsOpen && isOpen
	}

	n.lists = n.lists[:0]
	n.vLists = n.vLists[:0]

	return oneOfTheLists, anID
}

func (n *nodeContext) invalidListLength(na, nb int, a, b Expr) {
	n.addErr(n.ctx.Newf("incompatible list lengths (%d and %d)", na, nb))
}
