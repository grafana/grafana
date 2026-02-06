package cuetsy

import "cuelang.org/go/cue"

// NOTHING IN HERE IS ACTUALLY USED YET, playing with this because it's likely
// where a more proper architecture should head

// TypeMapper is a general interface to describe a mapping between cue.Value and
// typescript kinds and types. Will necessarily need to omit expressions.
type TypeMapper interface {
	Value() cue.Value
	Kind() cue.Kind
	Concreteness() Concreteness
	String() string
}

// Concreteness is a measure of the level of concreteness of a value, where
// lower values mean more concrete.
//
// Replicated from cuelang.org/internal/core/adt
type Concreteness int

const (
	BottomLevel Concreteness = iota

	// Concrete indicates a concrete scalar value, list or struct.
	Concrete

	// Constraint indicates a non-concrete scalar value that is more specific,
	// than a top-level type.
	Constraint

	// Type indicates a top-level specific type, for instance, string,
	// bytes, number, or bool.
	Type

	// Any indicates any value, or top.
	Any
)
