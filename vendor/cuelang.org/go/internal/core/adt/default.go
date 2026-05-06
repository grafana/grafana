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

// Default returns the default value or itself if there is no default.
func Default(v Value) Value {
	switch x := v.(type) {
	case *Vertex:
		return x.Default()
	case *Disjunction:
		return x.Default()
	default:
		return v
	}
}

func (d *Disjunction) Default() Value {
	switch d.NumDefaults {
	case 0:
		return d
	case 1:
		return d.Values[0]
	default:
		return &Disjunction{
			Src:         d.Src,
			Values:      d.Values[:d.NumDefaults],
			NumDefaults: 0,
		}
	}
}

// Default returns the default value or itself if there is no default.
//
// It also closes a list, representing its default value.
func (v *Vertex) Default() *Vertex {
	switch d := v.BaseValue.(type) {
	default:
		return v

	case *Disjunction:
		var w *Vertex

		switch d.NumDefaults {
		case 0:
			return v
		case 1:
			w = d.Values[0].Default()
		default:
			x := *v
			x.state = nil
			x.BaseValue = &Disjunction{
				Src:         d.Src,
				Values:      d.Values[:d.NumDefaults],
				NumDefaults: 0,
			}
			w = &x
			w.Conjuncts = nil
		}

		if w.Conjuncts == nil {
			for _, c := range v.Conjuncts {
				// TODO: preserve field information.
				expr, _ := stripNonDefaults(c.Elem())
				w.Conjuncts = append(w.Conjuncts, MakeRootConjunct(c.Env, expr))
			}
		}
		return w

	case *ListMarker:
		m := *d
		m.IsOpen = false

		w := *v
		w.BaseValue = &m
		w.state = nil
		return &w
	}
}

// TODO: this should go: record preexpanded disjunctions in Vertex.
func stripNonDefaults(elem Elem) (r Elem, stripped bool) {
	expr, ok := elem.(Expr)
	if !ok {
		return elem, false
	}
	switch x := expr.(type) {
	case *DisjunctionExpr:
		if !x.HasDefaults {
			return x, false
		}
		d := *x
		d.Values = []Disjunct{}
		for _, v := range x.Values {
			if v.Default {
				d.Values = append(d.Values, v)
			}
		}
		if len(d.Values) == 1 {
			return d.Values[0].Val, true
		}
		return &d, true

	case *BinaryExpr:
		if x.Op != AndOp {
			return x, false
		}
		a, sa := stripNonDefaults(x.X)
		b, sb := stripNonDefaults(x.Y)
		if sa || sb {
			bin := *x
			bin.X = a.(Expr)
			bin.Y = b.(Expr)
			return &bin, true
		}
		return x, false

	default:
		return x, false
	}
}
