// Copyright 2018 The CUE Authors
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

// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package list

import (
	"sort"

	"cuelang.org/go/cue"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/types"
)

// valueSorter defines a sort.Interface; implemented in cue/builtinutil.go.
type valueSorter struct {
	ctx *adt.OpContext
	a   []cue.Value
	err error

	cmp  *adt.Vertex
	less *adt.Vertex
	x    *adt.Vertex
	y    *adt.Vertex
}

func (s *valueSorter) ret() ([]cue.Value, error) {
	if s.err != nil {
		return nil, s.err
	}
	// The input slice is already a copy and that we can modify it safely.
	return s.a, nil
}

func (s *valueSorter) Len() int      { return len(s.a) }
func (s *valueSorter) Swap(i, j int) { s.a[i], s.a[j] = s.a[j], s.a[i] }
func (s *valueSorter) Less(i, j int) bool {
	if s.err != nil {
		return false
	}
	var x, y types.Value
	s.a[i].Core(&x)
	s.a[j].Core(&y)

	// Save the state of all relevant arcs and restore later for the
	// next comparison.
	saveCmp := *s.cmp
	saveLess := *s.less
	saveX := *s.x
	saveY := *s.y

	for _, c := range x.V.Conjuncts {
		s.x.AddConjunct(c)
	}
	for _, c := range y.V.Conjuncts {
		s.y.AddConjunct(c)
	}

	// TODO(perf): if we can determine that the comparator values for
	// x and y are idempotent (no arcs and a basevalue being top or
	// a struct or list marker), then we do not need to reevaluate the input.
	// In that case, we can use the below code instead of the above two loops
	// setting the conjuncts. This may improve performance significantly.
	//
	// s.x.BaseValue = x.V.BaseValue
	// s.x.Arcs = x.V.Arcs
	// s.y.BaseValue = y.V.BaseValue
	// s.y.Arcs = y.V.Arcs

	s.less.Finalize(s.ctx)
	isLess := s.ctx.BoolValue(s.less)
	if b := s.less.Err(s.ctx, adt.Finalized); b != nil && s.err == nil {
		s.err = b.Err
		return true
	}

	*s.less = saveLess
	*s.cmp = saveCmp
	*s.x = saveX
	*s.y = saveY

	return isLess
}

var less = cue.ParsePath("less")

func makeValueSorter(list []cue.Value, cmp cue.Value) (s valueSorter) {
	if v := cmp.LookupPath(less); !v.Exists() {
		return valueSorter{err: v.Err()}
	}

	var v types.Value
	cmp.Core(&v)
	ctx := adt.NewContext(v.R, v.V)

	n := &adt.Vertex{
		Label:     v.V.Label,
		Parent:    v.V.Parent,
		Conjuncts: v.V.Conjuncts,
	}
	ctx.Unify(n, adt.Conjuncts)

	s = valueSorter{
		a:    list,
		ctx:  ctx,
		cmp:  n,
		less: getArc(ctx, n, "less"),
		x:    getArc(ctx, n, "x"),
		y:    getArc(ctx, n, "y"),
	}

	// TODO(perf): see comment in the Less method. If we can determine
	// the conjuncts for x and y are idempotent, we can pre finalize here and
	// ignore the values in the Less method.
	// s.x.UpdateStatus(adt.Finalized)
	// s.y.UpdateStatus(adt.Finalized)

	return s
}

// Sort sorts data while keeping the original order of equal elements.
// It does O(n*log(n)) comparisons.
//
// cmp is a struct of the form {T: _, x: T, y: T, less: bool}, where
// less should reflect x < y.
//
// Example:
//
//	Sort([2, 3, 1], list.Ascending)
//
//	Sort([{a: 2}, {a: 3}, {a: 1}], {x: {}, y: {}, less: x.a < y.a})
func Sort(list []cue.Value, cmp cue.Value) (sorted []cue.Value, err error) {
	s := makeValueSorter(list, cmp)

	// The input slice is already a copy and that we can modify it safely.
	sort.Stable(&s)
	return s.ret()
}

func getArc(ctx *adt.OpContext, v *adt.Vertex, s string) *adt.Vertex {
	f := ctx.StringLabel(s)
	arc, _ := v.GetArc(ctx, f, 0)
	return arc
}

// Deprecated: use Sort, which is always stable
func SortStable(list []cue.Value, cmp cue.Value) (sorted []cue.Value, err error) {
	s := makeValueSorter(list, cmp)
	sort.Stable(&s)
	return s.ret()
}

// Strings sorts a list of strings in increasing order.
func SortStrings(a []string) []string {
	sort.Strings(a)
	return a
}

// IsSorted tests whether a list is sorted.
//
// See Sort for an example comparator.
func IsSorted(list []cue.Value, cmp cue.Value) bool {
	s := makeValueSorter(list, cmp)
	return sort.IsSorted(&s)
}

// IsSortedStrings tests whether a list is a sorted lists of strings.
func IsSortedStrings(a []string) bool {
	return sort.StringsAreSorted(a)
}
