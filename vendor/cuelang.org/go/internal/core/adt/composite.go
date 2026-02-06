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
	"fmt"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

// TODO: unanswered questions about structural cycles:
//
// 1. When detecting a structural cycle, should we consider this as:
//    a) an unevaluated value,
//    b) an incomplete error (which does not affect parent validity), or
//    c) a special value.
//
// Making it an error is the simplest way to ensure reentrancy is disallowed:
// without an error it would require an additional mechanism to stop reentrancy
// from continuing to process. Even worse, in some cases it may only partially
// evaluate, resulting in unexpected results. For this reason, we are taking
// approach `b` for now.
//
// This has some consequences of how disjunctions are treated though. Consider
//
//     list: {
//        head: _
//        tail: list | null
//     }
//
// When making it an error, evaluating the above will result in
//
//     list: {
//        head: _
//        tail: null
//     }
//
// because list will result in a structural cycle, and thus an error, it will be
// stripped from the disjunction. This may or may not be a desirable property. A
// nice thing is that it is not required to write `list | *null`. A disadvantage
// is that this is perhaps somewhat inexplicit.
//
// When not making it an error (and simply cease evaluating child arcs upon
// cycle detection), the result would be:
//
//     list: {
//        head: _
//        tail: list | null
//     }
//
// In other words, an evaluation would result in a cycle and thus an error.
// Implementations can recognize such cases by having unevaluated arcs. An
// explicit structure cycle marker would probably be less error prone.
//
// Note that in both cases, a reference to list will still use the original
// conjuncts, so the result will be the same for either method in this case.
//
//
// 2. Structural cycle allowance.
//
// Structural cycle detection disallows reentrancy as well. This means one
// cannot use structs for recursive computation. This will probably preclude
// evaluation of some configuration. Given that there is no real alternative
// yet, we could allow structural cycle detection to be optionally disabled.

// An Environment links the parent scopes for identifier lookup to a composite
// node. Each conjunct that make up node in the tree can be associated with
// a different environment (although some conjuncts may share an Environment).
type Environment struct {
	Up     *Environment
	Vertex *Vertex

	// DynamicLabel is only set when instantiating a field from a pattern
	// constraint. It is used to resolve label references.
	DynamicLabel Feature

	// TODO(perf): make the following public fields a shareable struct as it
	// mostly is going to be the same for child nodes.

	// TODO: This can probably move into the nodeContext, making it a map from
	// conjunct to Value.
	cache map[cacheKey]Value
}

type cacheKey struct {
	Expr Expr
	Arc  *Vertex
}

func (e *Environment) up(count int32) *Environment {
	for ; count > 0; count-- {
		e = e.Up
	}
	return e
}

type ID int32

// evalCached is used to look up dynamic field pattern constraint expressions.
func (e *Environment) evalCached(c *OpContext, x Expr) Value {
	if v, ok := x.(Value); ok {
		return v
	}
	key := cacheKey{x, nil}
	v, ok := e.cache[key]
	if !ok {
		if e.cache == nil {
			e.cache = map[cacheKey]Value{}
		}
		env, src := c.e, c.src
		c.e, c.src = e, x.Source()
		// Save and restore errors to ensure that only relevant errors are
		// associated with the cash.
		err := c.errs
		v = c.evalState(x, Partial) // TODO: should this be Finalized?
		c.e, c.src = env, src
		c.errs = err
		if b, ok := v.(*Bottom); !ok || !b.IsIncomplete() {
			e.cache[key] = v
		}
	}
	return v
}

// A Vertex is a node in the value tree. It may be a leaf or internal node.
// It may have arcs to represent elements of a fully evaluated struct or list.
//
// For structs, it only contains definitions and concrete fields.
// optional fields are dropped.
//
// It maintains source information such as a list of conjuncts that contributed
// to the value.
type Vertex struct {
	// Parent links to a parent Vertex. This parent should only be used to
	// access the parent's Label field to find the relative location within a
	// tree.
	Parent *Vertex

	// State:
	//   eval: nil, BaseValue: nil -- unevaluated
	//   eval: *,   BaseValue: nil -- evaluating
	//   eval: *,   BaseValue: *   -- finalized
	//
	state *nodeContext
	// TODO: move the following status fields to nodeContext.

	// Label is the feature leading to this vertex.
	Label Feature

	// TODO: move the following status fields to nodeContext.

	// status indicates the evaluation progress of this vertex.
	status VertexStatus

	// hasAllConjuncts indicates that the set of conjuncts is complete.
	// This is the case if the conjuncts of all its ancestors have been
	// processed.
	hasAllConjuncts bool

	// isData indicates that this Vertex is to be interepreted as data: pattern
	// and additional constraints, as well as optional fields, should be
	// ignored.
	isData bool

	// Closed indicates whether this Vertex is recursively closed. This is the
	// case, for instance, if it is a node in a definition or if one of the
	// conjuncts, or ancestor conjuncts, is a definition.
	Closed bool

	// MultiLet indicates whether multiple let fields were added from
	// different sources. If true, a LetReference must be resolved using
	// the per-Environment value cache.
	MultiLet bool

	// After this is set, no more arcs may be added during evaluation. This is
	// set, for instance, after a Vertex is used as a source for comprehensions,
	// or any other operation that relies on the set of arcs being constant.
	LockArcs bool

	// IsDynamic signifies whether this struct is computed as part of an
	// expression and not part of the static evaluation tree.
	// Used for cycle detection.
	IsDynamic bool

	// arcType indicates the level of optionality of this arc.
	arcType arcType

	// cyclicReferences is a linked list of internal references pointing to this
	// Vertex. This is used to shorten the path of some structural cycles.
	cyclicReferences *RefNode

	// BaseValue is the value associated with this vertex. For lists and structs
	// this is a sentinel value indicating its kind.
	BaseValue BaseValue

	// ChildErrors is the collection of all errors of children.
	ChildErrors *Bottom

	// The parent of nodes can be followed to determine the path within the
	// configuration of this node.
	// Value  Value
	Arcs []*Vertex // arcs are sorted in display order.

	// Conjuncts lists the structs that ultimately formed this Composite value.
	// This includes all selected disjuncts.
	//
	// This value may be nil, in which case the Arcs are considered to define
	// the final value of this Vertex.
	Conjuncts []Conjunct

	// Structs is a slice of struct literals that contributed to this value.
	// This information is used to compute the topological sort of arcs.
	Structs []*StructInfo
}

// isDefined indicates whether this arc is a "value" field, and not a constraint
// or void arc.
func (v *Vertex) isDefined() bool {
	return v.arcType == arcMember
}

// IsDefined indicates whether this arc is defined meaning it is not a
// required or optional constraint and not a "void" arc.
// It will evaluate the arc, and thus evaluate any comprehension, to make this
// determination.
func (v *Vertex) IsDefined(c *OpContext) bool {
	if v.isDefined() {
		return true
	}
	c.Unify(v, Finalized)
	return v.isDefined()
}

type arcType uint8

const (
	// arcMember means that this arc is a normal non-optional field
	// (including regular, hidden, and definition fields).
	arcMember arcType = iota

	// TODO: define a type for optional arcs. This will be needed for pulling
	// in optional fields into the Vertex, which, in turn, is needed for
	// structure sharing, among other things.
	// We could also define types for required fields and potentially lets.

	// arcVoid means that an arc does not exist. This happens when an arc
	// is provisionally added as part of a comprehension, but when this
	// comprehension has not yet yielded any results.
	arcVoid
)

func (v *Vertex) Clone() *Vertex {
	c := *v
	c.state = nil
	return &c
}

type StructInfo struct {
	*StructLit

	Env *Environment

	CloseInfo

	// Embed indicates the struct in which this struct is embedded (originally),
	// or nil if this is a root structure.
	// Embed   *StructInfo
	// Context *RefInfo // the location from which this struct originates.
	Disable bool

	Embedding bool
}

// TODO(perf): this could be much more aggressive for eliminating structs that
// are immaterial for closing.
func (s *StructInfo) useForAccept() bool {
	if c := s.closeInfo; c != nil {
		return !c.noCheck
	}
	return true
}

// VertexStatus indicates the evaluation progress of a Vertex.
type VertexStatus int8

const (
	// Unprocessed indicates a Vertex has not been processed before.
	// Value must be nil.
	Unprocessed VertexStatus = iota

	// Evaluating means that the current Vertex is being evaluated. If this is
	// encountered it indicates a reference cycle. Value must be nil.
	Evaluating

	// Partial indicates that the result was only partially evaluated. It will
	// need to be fully evaluated to get a complete results.
	//
	// TODO: this currently requires a renewed computation. Cache the
	// nodeContext to allow reusing the computations done so far.
	Partial

	// Conjuncts is the state reached when all conjuncts have been evaluated,
	// but without recursively processing arcs.
	Conjuncts

	// EvaluatingArcs indicates that the arcs of the Vertex are currently being
	// evaluated. If this is encountered it indicates a structural cycle.
	// Value does not have to be nil
	EvaluatingArcs

	// Finalized means that this node is fully evaluated and that the results
	// are save to use without further consideration.
	Finalized
)

func (s VertexStatus) String() string {
	switch s {
	case Unprocessed:
		return "unprocessed"
	case Evaluating:
		return "evaluating"
	case Partial:
		return "partial"
	case Conjuncts:
		return "conjuncts"
	case EvaluatingArcs:
		return "evaluatingArcs"
	case Finalized:
		return "finalized"
	default:
		return "unknown"
	}
}

func (v *Vertex) Status() VertexStatus {
	return v.status
}

func (v *Vertex) UpdateStatus(s VertexStatus) {
	Assertf(v.status <= s+1, "attempt to regress status from %d to %d", v.Status(), s)

	if s == Finalized && v.BaseValue == nil {
		// panic("not finalized")
	}
	v.status = s
}

// setParentDone signals v that the conjuncts of all ancestors have been
// processed.
// If all conjuncts of this node have been set, all arcs will be notified
// of this parent being done.
//
// Note: once a vertex has started evaluation (state != nil), insertField will
// cause all conjuncts to be immediately processed. This means that if all
// ancestors of this node processed their conjuncts, and if this node has
// processed all its conjuncts as well, all nodes that it embedded will have
// received all their conjuncts as well, after which this node will have been
// notified of these conjuncts.
func (v *Vertex) setParentDone() {
	v.hasAllConjuncts = true
	// Could set "Conjuncts" flag of arc at this point.
	if n := v.state; n != nil && len(n.conjuncts) == 0 {
		for _, a := range v.Arcs {
			a.setParentDone()
		}
	}
}

// Value returns the Value of v without definitions if it is a scalar
// or itself otherwise.
func (v *Vertex) Value() Value {
	switch x := v.BaseValue.(type) {
	case nil:
		return nil
	case *StructMarker, *ListMarker:
		return v
	case Value:
		// TODO: recursively descend into Vertex?
		return x
	default:
		panic(fmt.Sprintf("unexpected type %T", v.BaseValue))
	}
}

// isUndefined reports whether a vertex does not have a useable BaseValue yet.
func (v *Vertex) isUndefined() bool {
	if !v.isDefined() {
		return true
	}
	switch v.BaseValue {
	case nil, cycle:
		return true
	}
	return false
}

func (x *Vertex) IsConcrete() bool {
	return x.Concreteness() <= Concrete
}

// IsData reports whether v should be interpreted in data mode. In other words,
// it tells whether optional field matching and non-regular fields, like
// definitions and hidden fields, should be ignored.
func (v *Vertex) IsData() bool {
	return v.isData || len(v.Conjuncts) == 0
}

// ToDataSingle creates a new Vertex that represents just the regular fields
// of this vertex. Arcs are left untouched.
// It is used by cue.Eval to convert nodes to data on per-node basis.
func (v *Vertex) ToDataSingle() *Vertex {
	w := *v
	w.isData = true
	w.state = nil
	w.status = Finalized
	return &w
}

// ToDataAll returns a new v where v and all its descendents contain only
// the regular fields.
func (v *Vertex) ToDataAll(ctx *OpContext) *Vertex {
	arcs := make([]*Vertex, 0, len(v.Arcs))
	for _, a := range v.Arcs {
		if !a.IsDefined(ctx) {
			continue
		}
		if a.Label.IsRegular() {
			arcs = append(arcs, a.ToDataAll(ctx))
		}
	}
	w := *v
	w.state = nil
	w.status = Finalized

	w.BaseValue = toDataAll(ctx, w.BaseValue)
	w.Arcs = arcs
	w.isData = true
	w.Conjuncts = make([]Conjunct, len(v.Conjuncts))
	// TODO(perf): this is not strictly necessary for evaluation, but it can
	// hurt performance greatly. Drawback is that it may disable ordering.
	for _, s := range w.Structs {
		s.Disable = true
	}
	copy(w.Conjuncts, v.Conjuncts)
	for i, c := range w.Conjuncts {
		if v, _ := c.x.(Value); v != nil {
			w.Conjuncts[i].x = toDataAll(ctx, v).(Value)
		}
	}
	return &w
}

func toDataAll(ctx *OpContext, v BaseValue) BaseValue {
	switch x := v.(type) {
	default:
		return x

	case *Vertex:
		return x.ToDataAll(ctx)

	// The following cases are always erroneous, but we handle them anyway
	// to avoid issues with the closedness algorithm down the line.
	case *Disjunction:
		d := *x
		d.Values = make([]*Vertex, len(x.Values))
		for i, v := range x.Values {
			d.Values[i] = v.ToDataAll(ctx)
		}
		return &d

	case *Conjunction:
		c := *x
		c.Values = make([]Value, len(x.Values))
		for i, v := range x.Values {
			// This case is okay because the source is of type Value.
			c.Values[i] = toDataAll(ctx, v).(Value)
		}
		return &c
	}
}

// func (v *Vertex) IsEvaluating() bool {
// 	return v.Value == cycle
// }

func (v *Vertex) IsErr() bool {
	// if v.Status() > Evaluating {
	if _, ok := v.BaseValue.(*Bottom); ok {
		return true
	}
	// }
	return false
}

func (v *Vertex) Err(c *OpContext, state VertexStatus) *Bottom {
	c.Unify(v, state)
	if b, ok := v.BaseValue.(*Bottom); ok {
		return b
	}
	return nil
}

// func (v *Vertex) Evaluate()

func (v *Vertex) Finalize(c *OpContext) {
	// Saving and restoring the error context prevents v from panicking in
	// case the caller did not handle existing errors in the context.
	err := c.errs
	c.errs = nil
	c.Unify(v, Finalized)
	c.errs = err
}

func (v *Vertex) AddErr(ctx *OpContext, b *Bottom) {
	v.SetValue(ctx, Finalized, CombineErrors(nil, v.Value(), b))
}

func (v *Vertex) SetValue(ctx *OpContext, state VertexStatus, value BaseValue) *Bottom {
	v.BaseValue = value
	v.UpdateStatus(state)
	return nil
}

// ToVertex wraps v in a new Vertex, if necessary.
func ToVertex(v Value) *Vertex {
	switch x := v.(type) {
	case *Vertex:
		return x
	default:
		n := &Vertex{
			status:    Finalized,
			BaseValue: x,
		}
		n.AddConjunct(MakeRootConjunct(nil, v))
		return n
	}
}

// Unwrap returns the possibly non-concrete scalar value of v, v itself for
// lists and structs, or nil if v is an undefined type.
func Unwrap(v Value) Value {
	x, ok := v.(*Vertex)
	if !ok {
		return v
	}
	x = x.Indirect()
	if n := x.state; n != nil && isCyclePlaceholder(x.BaseValue) {
		if n.errs != nil && !n.errs.IsIncomplete() {
			return n.errs
		}
		if n.scalar != nil {
			return n.scalar
		}
	}
	return x.Value()
}

// Indirect unrolls indirections of Vertex values. These may be introduced,
// for instance, by temporary bindings such as comprehension values.
// It returns v itself if v does not point to another Vertex.
func (v *Vertex) Indirect() *Vertex {
	for {
		arc, ok := v.BaseValue.(*Vertex)
		if !ok {
			return v
		}
		v = arc
	}
}

// OptionalType is a bit field of the type of optional constraints in use by an
// Acceptor.
type OptionalType int8

const (
	HasField          OptionalType = 1 << iota // X: T
	HasDynamic                                 // (X): T or "\(X)": T
	HasPattern                                 // [X]: T
	HasComplexPattern                          // anything but a basic type
	HasAdditional                              // ...T
	IsOpen                                     // Defined for all fields
)

func (v *Vertex) Kind() Kind {
	// This is possible when evaluating comprehensions. It is potentially
	// not known at this time what the type is.
	switch {
	// TODO: using this line would be more stable.
	// case v.status != Finalized && v.state != nil:
	case v.state != nil:
		return v.state.kind
	case v.BaseValue == nil:
		return TopKind
	default:
		return v.BaseValue.Kind()
	}
}

func (v *Vertex) OptionalTypes() OptionalType {
	var mask OptionalType
	for _, s := range v.Structs {
		mask |= s.OptionalTypes()
	}
	return mask
}

// IsOptional reports whether a field is explicitly defined as optional,
// as opposed to whether it is allowed by a pattern constraint.
func (v *Vertex) IsOptional(label Feature) bool {
	for _, s := range v.Structs {
		if s.IsOptionalField(label) {
			return true
		}
	}
	return false
}

func (v *Vertex) accepts(ok, required bool) bool {
	return ok || (!required && !v.Closed)
}

func (v *Vertex) IsClosedStruct() bool {
	switch x := v.BaseValue.(type) {
	default:
		return false

	case *StructMarker:
		if x.NeedClose {
			return true
		}

	case *Disjunction:
	}
	return isClosed(v)
}

func (v *Vertex) IsClosedList() bool {
	if x, ok := v.BaseValue.(*ListMarker); ok {
		return !x.IsOpen
	}
	return false
}

// TODO: return error instead of boolean? (or at least have version that does.)
func (v *Vertex) Accept(ctx *OpContext, f Feature) bool {
	if x, ok := v.BaseValue.(*Disjunction); ok {
		for _, v := range x.Values {
			if v.Accept(ctx, f) {
				return true
			}
		}
		return false
	}

	if f.IsInt() {
		switch v.BaseValue.(type) {
		case *ListMarker:
			// TODO(perf): use precomputed length.
			if f.Index() < len(v.Elems()) {
				return true
			}
			return !v.IsClosedList()

		default:
			return v.Kind()&ListKind != 0
		}
	}

	if k := v.Kind(); k&StructKind == 0 && f.IsString() {
		// If the value is bottom, we may not really know if this used to
		// be a struct.
		if k != BottomKind || len(v.Structs) == 0 {
			return false
		}
	}

	if f.IsHidden() || !v.IsClosedStruct() || v.Lookup(f) != nil {
		return true
	}

	// TODO(perf): collect positions in error.
	defer ctx.ReleasePositions(ctx.MarkPositions())

	return v.accepts(Accept(ctx, v, f))
}

// MatchAndInsert finds the conjuncts for optional fields, pattern
// constraints, and additional constraints that match f and inserts them in
// arc. Use f is 0 to match all additional constraints only.
func (v *Vertex) MatchAndInsert(ctx *OpContext, arc *Vertex) {
	if !v.Accept(ctx, arc.Label) {
		return
	}

	// Go backwards to simulate old implementation.
	for i := len(v.Structs) - 1; i >= 0; i-- {
		s := v.Structs[i]
		if s.Disable {
			continue
		}
		s.MatchAndInsert(ctx, arc)
	}
}

func (v *Vertex) IsList() bool {
	_, ok := v.BaseValue.(*ListMarker)
	return ok
}

// Lookup returns the Arc with label f if it exists or nil otherwise.
func (v *Vertex) Lookup(f Feature) *Vertex {
	for _, a := range v.Arcs {
		if a.Label == f {
			a = a.Indirect()
			return a
		}
	}
	return nil
}

// Elems returns the regular elements of a list.
func (v *Vertex) Elems() []*Vertex {
	// TODO: add bookkeeping for where list arcs start and end.
	a := make([]*Vertex, 0, len(v.Arcs))
	for _, x := range v.Arcs {
		if x.Label.IsInt() {
			a = append(a, x)
		}
	}
	return a
}

// GetArc returns a Vertex for the outgoing arc with label f. It creates and
// ads one if it doesn't yet exist.
func (v *Vertex) GetArc(c *OpContext, f Feature, t arcType) (arc *Vertex, isNew bool) {
	arc = v.Lookup(f)
	if arc != nil {
		return arc, false
	}

	if v.LockArcs {
		// TODO(errors): add positions.
		if f.IsInt() {
			c.addErrf(EvalError, token.NoPos,
				"element at index %s not allowed by earlier comprehension or reference cycle", f)
		} else {
			c.addErrf(EvalError, token.NoPos,
				"field %s not allowed by earlier comprehension or reference cycle", f)
		}
	}
	arc = &Vertex{Parent: v, Label: f, arcType: t}
	v.Arcs = append(v.Arcs, arc)
	return arc, true
}

func (v *Vertex) Source() ast.Node {
	if v != nil {
		if b, ok := v.BaseValue.(Value); ok {
			return b.Source()
		}
	}
	return nil
}

// AddConjunct adds the given Conjuncts to v if it doesn't already exist.
func (v *Vertex) AddConjunct(c Conjunct) *Bottom {
	if v.BaseValue != nil {
		// TODO: investigate why this happens at all. Removing it seems to
		// change the order of fields in some cases.
		//
		// This is likely a bug in the evaluator and should not happen.
		return &Bottom{Err: errors.Newf(token.NoPos, "cannot add conjunct")}
	}
	if !v.hasConjunct(c) {
		v.addConjunctUnchecked(c)
	}
	return nil
}

func (v *Vertex) hasConjunct(c Conjunct) (added bool) {
	switch c.x.(type) {
	case *OptionalField, *BulkOptionalField, *Ellipsis:
	default:
		v.arcType = arcMember
	}
	for _, x := range v.Conjuncts {
		// TODO: disregard certain fields from comparison (e.g. Refs)?
		if x.CloseInfo.closeInfo == c.CloseInfo.closeInfo &&
			x.x == c.x &&
			x.Env.Up == c.Env.Up && x.Env.Vertex == c.Env.Vertex {
			return true
		}
	}
	return false
}

func (v *Vertex) addConjunctUnchecked(c Conjunct) {
	v.Conjuncts = append(v.Conjuncts, c)
	if n := v.state; n != nil {
		n.conjuncts = append(n.conjuncts, c)
		// TODO: can we remove notifyConjunct here? This method is only
		// used if either Unprocessed is 0, in which case there will be no
		// notification recipients, or for "pushed down" comprehensions,
		// which should also have been added at an earlier point.
		n.notifyConjunct(c)
	}
}

// addConjunctDynamic adds a conjunct to a vertex and immediately evaluates
// it, whilst doing the same for any vertices on the notify list, recursively.
func (n *nodeContext) addConjunctDynamic(c Conjunct) {
	n.node.Conjuncts = append(n.node.Conjuncts, c)
	n.addExprConjunct(c, Partial)
	n.notifyConjunct(c)

}

func (n *nodeContext) notifyConjunct(c Conjunct) {
	for _, arc := range n.notify {
		if !arc.hasConjunct(c) {
			if arc.state == nil {
				// TODO: continuing here is likely to result in a faulty
				// (incomplete) configuration. But this may be okay. The
				// CUE_DEBUG=0 flag disables this assertion.
				n.ctx.Assertf(n.ctx.pos(), Debug, "unexpected nil state")
				n.ctx.addErrf(0, n.ctx.pos(), "cannot add to field %v", arc.Label)
				continue
			}
			arc.state.addConjunctDynamic(c)
		}
	}
}

func (v *Vertex) AddStruct(s *StructLit, env *Environment, ci CloseInfo) *StructInfo {
	info := StructInfo{
		StructLit: s,
		Env:       env,
		CloseInfo: ci,
	}
	for _, t := range v.Structs {
		if *t == info { // TODO: check for different identity.
			return t
		}
	}
	t := &info
	v.Structs = append(v.Structs, t)
	return t
}

// Path computes the sequence of Features leading from the root to of the
// instance to this Vertex.
//
// NOTE: this is for debugging purposes only.
func (v *Vertex) Path() []Feature {
	return appendPath(nil, v)
}

func appendPath(a []Feature, v *Vertex) []Feature {
	if v.Parent == nil {
		return a
	}
	a = appendPath(a, v.Parent)
	if v.Label != 0 {
		// A Label may be 0 for programmatically inserted nodes.
		a = append(a, v.Label)
	}
	return a
}

// An Conjunct is an Environment-Expr pair. The Environment is the starting
// point for reference lookup for any reference contained in X.
type Conjunct struct {
	Env *Environment
	x   Node

	// CloseInfo is a unique number that tracks a group of conjuncts that need
	// belong to a single originating definition.
	CloseInfo CloseInfo
}

// TODO(perf): replace with composite literal if this helps performance.

// MakeRootConjunct creates a conjunct from the given environment and node.
// It panics if x cannot be used as an expression.
func MakeRootConjunct(env *Environment, x Node) Conjunct {
	return MakeConjunct(env, x, CloseInfo{})
}

func MakeConjunct(env *Environment, x Node, id CloseInfo) Conjunct {
	if env == nil {
		// TODO: better is to pass one.
		env = &Environment{}
	}
	switch x.(type) {
	case Elem, interface{ expr() Expr }:
	default:
		panic(fmt.Sprintf("invalid Node type %T", x))
	}
	return Conjunct{env, x, id}
}

func (c *Conjunct) Source() ast.Node {
	return c.x.Source()
}

func (c *Conjunct) Field() Node {
	switch x := c.x.(type) {
	case *Comprehension:
		return x.Value
	default:
		return c.x
	}
}

// Elem retrieves the Elem form of the contained conjunct.
// If it is a Field, it will return the field value.
func (c *Conjunct) Elem() Elem {
	switch x := c.x.(type) {
	case interface{ expr() Expr }:
		return x.expr()
	case Elem:
		return x
	default:
		panic("unreachable")
	}
}

// Expr retrieves the expression form of the contained conjunct.
// If it is a field or comprehension, it will return its associated value.
func (c *Conjunct) Expr() Expr {
	return ToExpr(c.x)
}

// ToExpr extracts the underlying expression for a Node. If something is already
// an Expr, it will return it as is, if it is a field, it will return its value,
// and for comprehensions it returns the yielded struct.
func ToExpr(n Node) Expr {
	switch x := n.(type) {
	case Expr:
		return x
	case interface{ expr() Expr }:
		return x.expr()
	case *Comprehension:
		return ToExpr(x.Value)
	default:
		panic("unreachable")
	}
}
