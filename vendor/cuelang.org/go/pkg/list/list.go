// Copyright 2019 CUE Authors
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

// Package list contains functions for manipulating and examining lists.
package list

import (
	"fmt"
	"sort"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/pkg/internal"
)

// Drop reports the suffix of list x after the first n elements,
// or [] if n > len(x).
//
// For instance:
//
//	Drop([1, 2, 3, 4], 2)
//
// results in
//
//	[3, 4]
func Drop(x []cue.Value, n int) ([]cue.Value, error) {
	if n < 0 {
		return nil, fmt.Errorf("negative index")
	}

	if n > len(x) {
		return []cue.Value{}, nil
	}

	return x[n:], nil
}

// TODO: disable Flatten until we know the right default for depth.
//       The right time to determine is at least some point after the query
//       extensions are introduced, which may provide flatten functionality
//       natively.
//
// // Flatten reports a flattened sequence of the list xs by expanding any elements
// // that are lists.
// //
// // For instance:
// //
// //    Flatten([1, [[2, 3], []], [4]])
// //
// // results in
// //
// //    [1, 2, 3, 4]
// //
// func Flatten(xs cue.Value) ([]cue.Value, error) {
// 	var flatten func(cue.Value) ([]cue.Value, error)
// 	flatten = func(xs cue.Value) ([]cue.Value, error) {
// 		var res []cue.Value
// 		iter, err := xs.List()
// 		if err != nil {
// 			return nil, err
// 		}
// 		for iter.Next() {
// 			val := iter.Value()
// 			if val.Kind() == cue.ListKind {
// 				vals, err := flatten(val)
// 				if err != nil {
// 					return nil, err
// 				}
// 				res = append(res, vals...)
// 			} else {
// 				res = append(res, val)
// 			}
// 		}
// 		return res, nil
// 	}
// 	return flatten(xs)
// }

// FlattenN reports a flattened sequence of the list xs by expanding any elements
// depth levels deep. If depth is negative all elements are expanded.
//
// For instance:
//
//	FlattenN([1, [[2, 3], []], [4]], 1)
//
// results in
//
//	[1, [2, 3], [], 4]
func FlattenN(xs cue.Value, depth int) ([]cue.Value, error) {
	var flattenN func(cue.Value, int) ([]cue.Value, error)
	flattenN = func(xs cue.Value, depth int) ([]cue.Value, error) {
		var res []cue.Value
		iter, err := xs.List()
		if err != nil {
			return nil, err
		}
		for iter.Next() {
			val, _ := iter.Value().Default()
			if val.Kind() == cue.ListKind && depth != 0 {
				d := depth - 1
				values, err := flattenN(val, d)
				if err != nil {
					return nil, err
				}
				res = append(res, values...)
			} else {
				res = append(res, val)
			}
		}
		return res, nil
	}
	return flattenN(xs, depth)
}

// Repeat returns a new list consisting of count copies of list x.
//
// For instance:
//
//	Repeat([1, 2], 2)
//
// results in
//
//	[1, 2, 1, 2]
func Repeat(x []cue.Value, count int) ([]cue.Value, error) {
	if count < 0 {
		return nil, fmt.Errorf("negative count")
	}
	var a []cue.Value
	for i := 0; i < count; i++ {
		a = append(a, x...)
	}
	return a, nil
}

// Concat takes a list of lists and concatenates them.
//
// Concat([a, b, c]) is equivalent to
//
//	[ for x in a {x}, for x in b {x}, for x in c {x} ]
func Concat(a []cue.Value) ([]cue.Value, error) {
	var res []cue.Value
	for _, e := range a {
		iter, err := e.List()
		if err != nil {
			return nil, err
		}
		for iter.Next() {
			res = append(res, iter.Value())
		}
	}
	return res, nil
}

// Take reports the prefix of length n of list x, or x itself if n > len(x).
//
// For instance:
//
//	Take([1, 2, 3, 4], 2)
//
// results in
//
//	[1, 2]
func Take(x []cue.Value, n int) ([]cue.Value, error) {
	if n < 0 {
		return nil, fmt.Errorf("negative index")
	}

	if n > len(x) {
		return x, nil
	}

	return x[:n], nil
}

// Slice extracts the consecutive elements from list x starting from position i
// up till, but not including, position j, where 0 <= i < j <= len(x).
//
// For instance:
//
//	Slice([1, 2, 3, 4], 1, 3)
//
// results in
//
//	[2, 3]
func Slice(x []cue.Value, i, j int) ([]cue.Value, error) {
	if i < 0 {
		return nil, fmt.Errorf("negative index")
	}

	if i > j {
		return nil, fmt.Errorf("invalid index: %v > %v", i, j)
	}

	if i > len(x) {
		return nil, fmt.Errorf("slice bounds out of range")
	}

	if j > len(x) {
		return nil, fmt.Errorf("slice bounds out of range")
	}

	return x[i:j], nil
}

// MinItems reports whether a has at least n items.
func MinItems(list internal.List, n int) (bool, error) {
	count := len(list.Elems())
	if count >= n {
		return true, nil
	}
	code := adt.EvalError
	if list.IsOpen() {
		code = adt.IncompleteError
	}
	return false, internal.ValidationError{B: &adt.Bottom{
		Code: code,
		Err:  errors.Newf(token.NoPos, "len(list) < MinItems(%[2]d) (%[1]d < %[2]d)", count, n),
	}}
}

// MaxItems reports whether a has at most n items.
func MaxItems(list internal.List, n int) (bool, error) {
	count := len(list.Elems())
	if count > n {
		return false, internal.ValidationError{B: &adt.Bottom{
			Code: adt.EvalError,
			Err:  errors.Newf(token.NoPos, "len(list) > MaxItems(%[2]d) (%[1]d > %[2]d)", count, n),
		}}
	}

	return true, nil
}

// UniqueItems reports whether all elements in the list are unique.
func UniqueItems(a []cue.Value) bool {
	b := []string{}
	for _, v := range a {
		b = append(b, fmt.Sprintf("%+v", v))
	}
	sort.Strings(b)
	for i := 1; i < len(b); i++ {
		if b[i-1] == b[i] {
			return false
		}
	}
	return true
}

// Contains reports whether v is contained in a. The value must be a
// comparable value.
func Contains(a []cue.Value, v cue.Value) bool {
	for _, w := range a {
		if v.Equals(w) {
			return true
		}
	}
	return false
}
