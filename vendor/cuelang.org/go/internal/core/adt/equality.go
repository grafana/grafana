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

type Flag uint16

const (
	// IgnoreOptional allows optional information to be ignored. This only
	// applies when CheckStructural is given.
	IgnoreOptional Flag = 1 << iota

	// CheckStructural indicates that closedness information should be
	// considered for equality. Equal may return false even when values are
	// equal.
	CheckStructural Flag = 1 << iota
)

func Equal(ctx *OpContext, v, w Value, flags Flag) bool {
	if x, ok := v.(*Vertex); ok {
		return equalVertex(ctx, x, w, flags)
	}
	if y, ok := w.(*Vertex); ok {
		return equalVertex(ctx, y, v, flags)
	}
	return equalTerminal(ctx, v, w, flags)
}

func equalVertex(ctx *OpContext, x *Vertex, v Value, flags Flag) bool {
	y, ok := v.(*Vertex)
	if !ok {
		return false
	}
	if x == y {
		return true
	}
	xk := x.Kind()
	yk := y.Kind()

	if xk != yk {
		return false
	}

	if len(x.Arcs) != len(y.Arcs) {
		return false
	}

	// TODO: this really should be subsumption.
	if flags != 0 {
		if x.IsClosedStruct() != y.IsClosedStruct() {
			return false
		}
		if !equalClosed(ctx, x, y, flags) {
			return false
		}
	}

loop1:
	for _, a := range x.Arcs {
		if !a.IsDefined(ctx) {
			continue
		}
		for _, b := range y.Arcs {
			if !b.IsDefined(ctx) {
				continue
			}
			if a.Label == b.Label {
				if !Equal(ctx, a, b, flags) {
					return false
				}
				continue loop1
			}
		}
		return false
	}

	// We do not need to do the following check, because of the pigeon-hole principle.
	// loop2:
	// 	for _, b := range y.Arcs {
	// 		for _, a := range x.Arcs {
	// 			if a.Label == b.Label {
	// 				continue loop2
	// 			}
	// 		}
	// 		return false
	// 	}

	v, ok1 := x.BaseValue.(Value)
	w, ok2 := y.BaseValue.(Value)
	if !ok1 && !ok2 {
		return true // both are struct or list.
	}

	return equalTerminal(ctx, v, w, flags)
}

// equalClosed tests if x and y have the same set of close information.
// TODO: the following refinements are possible:
//   - unify optional fields and equate the optional fields
//   - do the same for pattern constraints, where the pattern constraints
//     are collated by pattern equality.
//   - a further refinement would collate patterns by ranges.
//
// For all these refinements it would be necessary to have well-working
// structure sharing so as to not repeatedly recompute optional arcs.
func equalClosed(ctx *OpContext, x, y *Vertex, flags Flag) bool {
	return verifyStructs(x, y, flags) && verifyStructs(y, x, flags)
}

func verifyStructs(x, y *Vertex, flags Flag) bool {
outer:
	for _, s := range x.Structs {
		if (flags&IgnoreOptional != 0) && !s.StructLit.HasOptional() {
			continue
		}
		if s.span()&DefinitionSpan == 0 {
			if !s.StructLit.HasOptional() {
				continue
			}
		}
		for _, t := range y.Structs {
			if s.StructLit == t.StructLit {
				continue outer
			}
		}
		return false
	}
	return true
}

func equalTerminal(ctx *OpContext, v, w Value, flags Flag) bool {
	if v == w {
		return true
	}

	switch x := v.(type) {
	case *Bottom:
		// All errors are logically the same.
		_, ok := w.(*Bottom)
		return ok

	case *Num, *String, *Bool, *Bytes, *Null:
		if b, ok := BinOp(ctx, EqualOp, v, w).(*Bool); ok {
			return b.B
		}
		return false

	// TODO: for the remainder we are dealing with non-concrete values, so we
	// could also just not bother.

	case *BoundValue:
		if y, ok := w.(*BoundValue); ok {
			return x.Op == y.Op && Equal(ctx, x.Value, y.Value, flags)
		}

	case *BasicType:
		if y, ok := w.(*BasicType); ok {
			return x.K == y.K
		}

	case *Conjunction:
		y, ok := w.(*Conjunction)
		if !ok || len(x.Values) != len(y.Values) {
			return false
		}
		// always ordered the same
		for i, xe := range x.Values {
			if !Equal(ctx, xe, y.Values[i], flags) {
				return false
			}
		}
		return true

	case *Disjunction:
		// The best way to compute this is with subsumption, but even that won't
		// be too accurate. Assume structural equivalence for now.
		y, ok := w.(*Disjunction)
		if !ok || len(x.Values) != len(y.Values) {
			return false
		}
		for i, xe := range x.Values {
			if !Equal(ctx, xe, y.Values[i], flags) {
				return false
			}
		}
		return true

	case *BuiltinValidator:
	}

	return false
}
