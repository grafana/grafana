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

// This file implements the closedness algorithm.

// Outline of algorithm
//
// To compute closedness each Vertex is associated with a tree which has
// leaf nodes with sets of allowed labels, and interior nodes that describe
// how these sets may be combines: Or, for embedding, or And for definitions.
//
// Each conjunct of a Vertex is associated with such a leaf node. Each
// conjunct that evaluates to a struct is added to the list of Structs, which
// in the end forms this tree. If a conjunct is embedded, or references another
// struct or definition, it adds interior node to reflect this.
//
// To test whether a feature is allowed, it must satisfy the resulting
// expression tree.
//
// In order to avoid having to copy the tree for each node, the tree is linked
// from leaf node to root, rather than the other way around. This allows
// parent nodes to be shared as the tree grows and ensures that the growth
// of the tree is bounded by the number of conjuncts. As a consequence, this
// requires a two-pass algorithm:
//
//    - walk up to mark which nodes are required and count the number of
//      child nodes that need to be satisfied.
//    - verify fields in leaf structs and mark parent leafs as satisfied
//      when appropriate.
//
// A label is allowed if all required root nodes are marked as accepted after
// these two passes.
//

// A note on embeddings: it is important to keep track which conjuncts originate
// from an embedding, as an embedded value may eventually turn into a closed
// struct. Consider
//
//    a: {
//       b
//       d: e: int
//    }
//    b: d: {
//       #A & #B
//    }
//
// At the point of evaluating `a`, the struct is not yet closed. However,
// descending into `d` will trigger the inclusion of definitions which in turn
// causes the struct to be closed. At this point, it is important to know that
// `b` originated from an embedding, as otherwise `e` may not be allowed.

// TODO(perf):
// - less nodes
// - disable StructInfo nodes that can no longer pass a feature
// - sort StructInfos active ones first.

// TODO(errors): return a dedicated ConflictError that can track original
// positions on demand.

// IsInOneOf reports whether any of the Structs associated with v is contained
// within any of the span types in the given mask.
func (v *Vertex) IsInOneOf(mask SpanType) bool {
	for _, s := range v.Structs {
		if s.CloseInfo.IsInOneOf(mask) {
			return true
		}
	}
	return false
}

// IsRecursivelyClosed returns true if this value is either a definition or unified
// with a definition.
func (v *Vertex) IsRecursivelyClosed() bool {
	return v.Closed || v.IsInOneOf(DefinitionSpan)
}

type closeNodeType uint8

const (
	// a closeRef node is created when there is a non-definition reference.
	// These nodes are not necessary for computing results, but may be
	// relevant down the line to group closures through embedded values and
	// to track position information for failures.
	closeRef closeNodeType = iota

	// closeDef indicates this node was introduced as a result of referencing
	// a definition.
	closeDef

	// closeEmbed indicates this node was added as a result of an embedding.
	closeEmbed

	_ = closeRef // silence the linter
)

// TODO: merge with closeInfo: this is a leftover of the refactoring.
type CloseInfo struct {
	*closeInfo

	// IsClosed is true if this conjunct represents a single level of closing
	// as indicated by the closed builtin.
	IsClosed bool

	// FieldTypes indicates which kinds of fields (optional, dynamic, patterns,
	// etc.) are contained in this conjunct.
	FieldTypes OptionalType

	CycleInfo
}

func (c CloseInfo) Location() Node {
	if c.closeInfo == nil {
		return nil
	}
	return c.closeInfo.location
}

func (c CloseInfo) span() SpanType {
	if c.closeInfo == nil {
		return 0
	}
	return c.closeInfo.span
}

func (c CloseInfo) RootSpanType() SpanType {
	if c.closeInfo == nil {
		return 0
	}
	return c.root
}

// IsInOneOf reports whether c is contained within any of the span types in the
// given mask.
func (c CloseInfo) IsInOneOf(t SpanType) bool {
	return c.span()&t != 0
}

// TODO(perf): remove: error positions should always be computed on demand
// in dedicated error types.
func (c *CloseInfo) AddPositions(ctx *OpContext) {
	for s := c.closeInfo; s != nil; s = s.parent {
		if loc := s.location; loc != nil {
			ctx.AddPosition(loc)
		}
	}
}

// TODO(perf): use on StructInfo. Then if parent and expression are the same
// it is possible to use cached value.
func (c CloseInfo) SpawnEmbed(x Node) CloseInfo {
	c.closeInfo = &closeInfo{
		parent:   c.closeInfo,
		location: x,
		mode:     closeEmbed,
		root:     EmbeddingSpan,
		span:     c.span() | EmbeddingSpan,
	}
	return c
}

// SpawnGroup is used for structs that contain embeddings that may end up
// closing the struct. This is to force that `b` is not allowed in
//
//	a: {#foo} & {b: int}
func (c CloseInfo) SpawnGroup(x Expr) CloseInfo {
	c.closeInfo = &closeInfo{
		parent:   c.closeInfo,
		location: x,
		span:     c.span(),
	}
	return c
}

// SpawnSpan is used to track that a value is introduced by a comprehension
// or constraint. Definition and embedding spans are introduced with SpawnRef
// and SpawnEmbed, respectively.
func (c CloseInfo) SpawnSpan(x Node, t SpanType) CloseInfo {
	c.closeInfo = &closeInfo{
		parent:   c.closeInfo,
		location: x,
		root:     t,
		span:     c.span() | t,
	}
	return c
}

func (c CloseInfo) SpawnRef(arc *Vertex, isDef bool, x Expr) CloseInfo {
	span := c.span()
	found := false
	if !isDef {
		xnode := Node(x) // Optimization so we're comparing identical interface types.
		// TODO: make this work for non-definitions too.
		for p := c.closeInfo; p != nil; p = p.parent {
			if p.span == span && p.location == xnode {
				found = true
				break
			}
		}
	}
	if !found {
		c.closeInfo = &closeInfo{
			parent:   c.closeInfo,
			location: x,
			span:     span,
		}
	}
	if isDef {
		c.mode = closeDef
		c.closeInfo.root = DefinitionSpan
		c.closeInfo.span |= DefinitionSpan
	}
	return c
}

// isDef reports whether an expressions is a reference that references a
// definition anywhere in its selection path.
//
// TODO(performance): this should be merged with resolve(). But for now keeping
// this code isolated makes it easier to see what it is for.
func IsDef(x Expr) bool {
	switch r := x.(type) {
	case *FieldReference:
		return r.Label.IsDef()

	case *SelectorExpr:
		if r.Sel.IsDef() {
			return true
		}
		return IsDef(r.X)

	case *IndexExpr:
		return IsDef(r.X)
	}
	return false
}

// A SpanType is used to indicate whether a CUE value is within the scope of
// a certain CUE language construct, the span type.
type SpanType uint8

const (
	// EmbeddingSpan means that this value was embedded at some point and should
	// not be included as a possible root node in the todo field of OpContext.
	EmbeddingSpan SpanType = 1 << iota
	ConstraintSpan
	ComprehensionSpan
	DefinitionSpan
)

type closeInfo struct {
	// location records the expression that led to this node's introduction.
	location Node

	// The parent node in the tree.
	parent *closeInfo

	// TODO(performance): if references are chained, we could have a separate
	// parent pointer to skip the chain.

	// mode indicates whether this node was added as part of an embedding,
	// definition or non-definition reference.
	mode closeNodeType

	// noCheck means this struct is irrelevant for closedness checking. This can
	// happen when:
	//  - it is a sibling of a new definition.
	noCheck bool // don't process for inclusion info

	root SpanType
	span SpanType
}

// closeStats holds the administrative fields for a closeInfo value. Each
// closeInfo is associated with a single closeStats value per unification
// operator. This association is done through an OpContext. This allows the
// same value to be used in multiple concurrent unification operations.
// NOTE: there are other parts of the algorithm that are not thread-safe yet.
type closeStats struct {
	// the other fields of this closeStats value are only valid if generation
	// is equal to the generation in OpContext. This allows for lazy
	// initialization of closeStats.
	generation int

	// These counts keep track of how many required child nodes need to be
	// completed before this node is accepted.
	requiredCount int
	acceptedCount int

	// accepted is set if this node is accepted.
	accepted bool

	required bool

	inTodoList bool // true if added to todo list.
	next       *closeStats
}

func (c *closeInfo) isClosed() bool {
	return c.mode == closeDef
}

// isClosed reports whether v is closed at this level (so not recursively).
func isClosed(v *Vertex) bool {
	// We could have used IsRecursivelyClosed here, but (effectively)
	// implementing it again here allows us to only have to iterate over
	// Structs once.
	if v.Closed {
		return true
	}
	for _, s := range v.Structs {
		if s.IsClosed || s.IsInOneOf(DefinitionSpan) {
			return true
		}
	}
	return false
}

// Accept determines whether f is allowed in n. It uses the OpContext for
// caching administrative fields.
func Accept(ctx *OpContext, n *Vertex, f Feature) (found, required bool) {
	ctx.generation++
	ctx.todo = nil

	var optionalTypes OptionalType

	// TODO(perf): more aggressively determine whether a struct is open or
	// closed: open structs do not have to be checked, yet they can particularly
	// be the ones with performance isssues, for instanced as a result of
	// embedded for comprehensions.
	for _, s := range n.Structs {
		if !s.useForAccept() {
			continue
		}
		markCounts(ctx, s.CloseInfo)
		optionalTypes |= s.types
	}

	var str Value
	if f.Index() == MaxIndex {
		f &= fTypeMask
	} else if optionalTypes&(HasComplexPattern|HasDynamic) != 0 && f.IsString() {
		str = f.ToValue(ctx)
	}

	for _, s := range n.Structs {
		if !s.useForAccept() {
			continue
		}
		if verifyArc(ctx, s, f, str) {
			// Beware: don't add to below expression: this relies on the
			// side effects of markUp.
			ok := markUp(ctx, s.closeInfo, 0)
			found = found || ok
		}
	}

	// Reject if any of the roots is not accepted.
	for x := ctx.todo; x != nil; x = x.next {
		if !x.accepted {
			return false, true
		}
	}

	return found, ctx.todo != nil
}

func markCounts(ctx *OpContext, info CloseInfo) {
	if info.IsClosed {
		markRequired(ctx, info.closeInfo)
		return
	}
	for s := info.closeInfo; s != nil; s = s.parent {
		if s.isClosed() {
			markRequired(ctx, s)
			return
		}
	}
}

func markRequired(ctx *OpContext, info *closeInfo) {
	count := 0
	for ; ; info = info.parent {
		var s closeInfo
		if info != nil {
			s = *info
		}

		x := getScratch(ctx, info)

		x.requiredCount += count

		if x.required {
			return
		}

		if s.span&EmbeddingSpan == 0 && !x.inTodoList {
			x.next = ctx.todo
			ctx.todo = x
			x.inTodoList = true
		}

		x.required = true

		if info == nil {
			return
		}

		count = 0
		if s.mode != closeEmbed {
			count = 1
		}
	}
}

func markUp(ctx *OpContext, info *closeInfo, count int) bool {
	for ; ; info = info.parent {
		var s closeInfo
		if info != nil {
			s = *info
		}

		x := getScratch(ctx, info)

		x.acceptedCount += count

		if x.acceptedCount < x.requiredCount {
			return false
		}

		x.accepted = true

		if info == nil {
			return true
		}

		count = 0
		if x.required && s.mode != closeEmbed {
			count = 1
		}
	}
}

// getScratch: explain generation.
func getScratch(ctx *OpContext, s *closeInfo) *closeStats {
	m := ctx.closed
	if m == nil {
		m = map[*closeInfo]*closeStats{}
		ctx.closed = m
	}

	x := m[s]
	if x == nil {
		x = &closeStats{}
		m[s] = x
	}

	if x.generation != ctx.generation {
		*x = closeStats{generation: ctx.generation}
	}

	return x
}

func verifyArc(ctx *OpContext, s *StructInfo, f Feature, label Value) bool {
	isRegular := f.IsString()

	o := s.StructLit
	env := s.Env

	if isRegular && (len(o.Additional) > 0 || o.IsOpen) {
		return true
	}

	for _, g := range o.Fields {
		if f == g.Label {
			return true
		}
	}

	if !isRegular {
		return false
	}

	// Do not record errors during this validation.
	errs := ctx.errs
	defer func() { ctx.errs = errs }()

	if len(o.Dynamic) > 0 && f.IsString() && label != nil {
		for _, b := range o.Dynamic {
			v := env.evalCached(ctx, b.Key)
			v, _ = ctx.getDefault(v)
			s, ok := Unwrap(v).(*String)
			if !ok {
				continue
			}
			if label.(*String).Str == s.Str {
				return true
			}
		}
	}

	for _, b := range o.Bulk {
		if matchBulk(ctx, env, b, f, label) {
			return true
		}
	}

	// TODO(perf): delay adding this position: create a special error type that
	// computes all necessary positions on demand.
	if ctx != nil {
		ctx.AddPosition(s.StructLit)
	}

	return false
}
