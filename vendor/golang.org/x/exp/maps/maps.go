// Copyright 2021 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package maps defines various functions useful with maps of any type.
package maps

import "maps"

// Keys returns the keys of the map m.
// The keys will be in an indeterminate order.
//
// The simplest true equivalent using the standard library  is:
//
//	slices.AppendSeq(make([]K, 0, len(m)), maps.Keys(m))
func Keys[M ~map[K]V, K comparable, V any](m M) []K {

	r := make([]K, 0, len(m))
	for k := range m {
		r = append(r, k)
	}
	return r
}

// Values returns the values of the map m.
// The values will be in an indeterminate order.
//
// The simplest true equivalent using the standard library is:
//
//	slices.AppendSeq(make([]V, 0, len(m)), maps.Values(m))
func Values[M ~map[K]V, K comparable, V any](m M) []V {

	r := make([]V, 0, len(m))
	for _, v := range m {
		r = append(r, v)
	}
	return r
}

// Equal reports whether two maps contain the same key/value pairs.
// Values are compared using ==.
//
//go:fix inline
func Equal[M1, M2 ~map[K]V, K, V comparable](m1 M1, m2 M2) bool {
	return maps.Equal(m1, m2)
}

// EqualFunc is like Equal, but compares values using eq.
// Keys are still compared with ==.
//
//go:fix inline
func EqualFunc[M1 ~map[K]V1, M2 ~map[K]V2, K comparable, V1, V2 any](m1 M1, m2 M2, eq func(V1, V2) bool) bool {
	return maps.EqualFunc(m1, m2, eq)
}

// Clear removes all entries from m, leaving it empty.
//
//go:fix inline
func Clear[M ~map[K]V, K comparable, V any](m M) {
	clear(m)
}

// Clone returns a copy of m.  This is a shallow clone:
// the new keys and values are set using ordinary assignment.
//
//go:fix inline
func Clone[M ~map[K]V, K comparable, V any](m M) M {
	return maps.Clone(m)
}

// Copy copies all key/value pairs in src adding them to dst.
// When a key in src is already present in dst,
// the value in dst will be overwritten by the value associated
// with the key in src.
//
//go:fix inline
func Copy[M1 ~map[K]V, M2 ~map[K]V, K comparable, V any](dst M1, src M2) {
	maps.Copy(dst, src)
}

// DeleteFunc deletes any key/value pairs from m for which del returns true.
//
//go:fix inline
func DeleteFunc[M ~map[K]V, K comparable, V any](m M, del func(K, V) bool) {
	maps.DeleteFunc(m, del)
}
