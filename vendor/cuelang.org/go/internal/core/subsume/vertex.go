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

package subsume

import (
	"fmt"

	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/export"
)

// Notes:
//   - Can optional fields of y can always be ignored here? Maybe not in the
//     schema case.
//   - Definitions of y can be ignored in data mode.
//
// TODO(perf): use merge sort where possible.
func (s *subsumer) vertices(x, y *adt.Vertex) bool {
	if x == y {
		return true
	}

	if s.Defaults {
		y = y.Default()
	}

	if b, _ := y.BaseValue.(*adt.Bottom); b != nil {
		// If the value is incomplete, the error is not final. So either check
		// structural equivalence or return an error.
		return !b.IsIncomplete()
	}

	ctx := s.ctx

	final := y.IsData() || s.Final

	switch v := x.BaseValue.(type) {
	case *adt.Bottom:
		return false

	case *adt.ListMarker:
		if !y.IsList() {
			s.errf("list does not subsume %s (type %s)", y, y.Kind())
			return false
		}
		if !s.listVertices(x, y) {
			return false
		}
		// TODO: allow other arcs alongside list arc.
		return true

	case *adt.StructMarker:
		_, ok := y.BaseValue.(*adt.StructMarker)
		if !ok {
			return false
		}

	case adt.Value:
		if !s.values(v, y.Value()) {
			return false
		}

		// Embedded scalars could still have arcs.
		if final {
			return true
		}

	default:
		panic(fmt.Sprintf("unexpected type %T", v))
	}

	xClosed := x.IsClosedStruct() && !s.IgnoreClosedness
	// TODO: this should not close for taking defaults. Do a more principled
	// makeover of this package before making it public, though.
	yClosed := s.Final || s.Defaults ||
		(y.IsClosedStruct() && !s.IgnoreClosedness)

	if xClosed && !yClosed && !final {
		return false
	}

	types := x.OptionalTypes()
	if !final && !s.IgnoreOptional && types&(adt.HasPattern|adt.HasAdditional) != 0 {
		// TODO: there are many cases where pattern constraints can be checked.
		s.inexact = true
		return false
	}

	// All arcs in x must exist in y and its values must subsume.
	xFeatures := export.VertexFeatures(s.ctx, x)
	for _, f := range xFeatures {
		if s.Final && !f.IsRegular() {
			continue
		}

		a := x.Lookup(f)
		aOpt := false
		if a == nil {
			// x.f is optional
			if s.IgnoreOptional {
				continue
			}

			a = &adt.Vertex{Label: f}
			x.MatchAndInsert(ctx, a)
			a.Finalize(ctx)

			// If field a is optional and has value top, neither the
			// omission of the field nor the field defined with any value
			// may cause unification to fail.
			if a.Kind() == adt.TopKind {
				continue
			}

			aOpt = true
		}

		b := y.Lookup(f)
		if b == nil {
			// y.f is optional
			if !aOpt {
				s.errf("required field is optional in subsumed value: %s", f)
				return false
			}

			// If f is undefined for y and if y is closed, the field is
			// implicitly defined as _|_ and thus subsumed. Technically, this is
			// even true if a is not optional, but in that case it means that y
			// is invalid, so return false regardless
			if !y.Accept(ctx, f) || y.IsData() || s.Final {
				continue
			}

			b = &adt.Vertex{Label: f}
			y.MatchAndInsert(ctx, b)
			b.Finalize(ctx)
		}

		if s.values(a, b) {
			continue
		}

		s.missing = f
		s.gt = a
		s.lt = y

		s.errf("field %s not present in %s", f, y)
		return false
	}

	if xClosed && !yClosed && !s.Final {
		s.errf("closed struct does not subsume open struct")
		return false
	}

	yFeatures := export.VertexFeatures(s.ctx, y)
outer:
	for _, f := range yFeatures {
		if s.Final && !f.IsRegular() {
			continue
		}

		for _, g := range xFeatures {
			if g == f {
				// already validated
				continue outer
			}
		}

		b := y.Lookup(f)
		if b == nil {
			if s.IgnoreOptional || s.Final {
				continue
			}

			b = &adt.Vertex{Label: f}
			y.MatchAndInsert(ctx, b)
		}

		if !x.Accept(ctx, f) {
			if s.Profile.IgnoreClosedness {
				continue
			}
			s.errf("field not allowed in closed struct: %s", f)
			return false
		}

		a := &adt.Vertex{Label: f}
		x.MatchAndInsert(ctx, a)
		if len(a.Conjuncts) == 0 {
			// It is accepted and has no further constraints, so all good.
			continue
		}

		a.Finalize(ctx)
		b.Finalize(ctx)

		if !s.vertices(a, b) {
			return false
		}
	}

	return true
}

func (s *subsumer) listVertices(x, y *adt.Vertex) bool {
	ctx := s.ctx

	if !y.IsData() && x.IsClosedList() && !y.IsClosedList() {
		return false
	}

	xElems := x.Elems()
	yElems := y.Elems()

	switch {
	case len(xElems) == len(yElems):
	case len(xElems) > len(yElems):
		return false
	case x.IsClosedList():
		return false
	default:
		a := &adt.Vertex{Label: adt.AnyIndex}
		x.MatchAndInsert(ctx, a)
		a.Finalize(ctx)

		// x must be open
		for _, b := range yElems[len(xElems):] {
			if !s.vertices(a, b) {
				return false
			}
		}

		if !y.IsClosedList() {
			b := &adt.Vertex{Label: adt.AnyIndex}
			y.MatchAndInsert(ctx, b)
			b.Finalize(ctx)
		}
	}

	for i, a := range xElems {
		if !s.vertices(a, yElems[i]) {
			return false
		}
	}

	return true
}
