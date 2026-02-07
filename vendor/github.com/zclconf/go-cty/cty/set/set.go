package set

import (
	"fmt"
)

// Set is an implementation of the concept of a set: a collection where all
// values are conceptually either in or out of the set, but the members are
// not ordered.
//
// This type primarily exists to be the internal type of sets in cty, but
// it is considered to be at the same level of abstraction as Go's built in
// slice and map collection types, and so should make no cty-specific
// assumptions.
//
// Set operations are not thread safe. It is the caller's responsibility to
// provide mutex guarantees where necessary.
//
// Set operations are not optimized to minimize memory pressure. Mutating
// a set will generally create garbage and so should perhaps be avoided in
// tight loops where memory pressure is a concern.
type Set[T any] struct {
	vals  map[int][]T
	rules Rules[T]
}

// NewSet returns an empty set with the membership rules given.
func NewSet[T any](rules Rules[T]) Set[T] {
	return Set[T]{
		vals:  map[int][]T{},
		rules: rules,
	}
}

func NewSetFromSlice[T any](rules Rules[T], vals []T) Set[T] {
	s := NewSet(rules)
	for _, v := range vals {
		s.Add(v)
	}
	return s
}

func sameRules[T any](s1 Set[T], s2 Set[T]) bool {
	return s1.rules.SameRules(s2.rules)
}

func mustHaveSameRules[T any](s1 Set[T], s2 Set[T]) {
	if !sameRules(s1, s2) {
		panic(fmt.Errorf("incompatible set rules: %#v, %#v", s1.rules, s2.rules))
	}
}

// HasRules returns true if and only if the receiving set has the given rules
// instance as its rules.
func (s Set[T]) HasRules(rules Rules[T]) bool {
	return s.rules.SameRules(rules)
}

// Rules returns the receiving set's rules instance.
func (s Set[T]) Rules() Rules[T] {
	return s.rules
}
