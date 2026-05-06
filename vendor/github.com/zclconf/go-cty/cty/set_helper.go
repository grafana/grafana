package cty

import (
	"fmt"

	"github.com/zclconf/go-cty/cty/set"
)

// ValueSet is to cty.Set what []cty.Value is to cty.List and
// map[string]cty.Value is to cty.Map. It's provided to allow callers a
// convenient interface for manipulating sets before wrapping them in cty.Set
// values using cty.SetValFromValueSet.
//
// Unlike value slices and value maps, ValueSet instances have a single
// homogenous element type because that is a requirement of the underlying
// set implementation, which uses the element type to select a suitable
// hashing function.
//
// Set mutations are not concurrency-safe.
type ValueSet struct {
	// ValueSet is just a thin wrapper around a set.Set with our value-oriented
	// "rules" applied. We do this so that the caller can work in terms of
	// cty.Value objects even though the set internals use the raw values.
	s set.Set[interface{}]
}

// NewValueSet creates and returns a new ValueSet with the given element type.
func NewValueSet(ety Type) ValueSet {
	return newValueSet(set.NewSet(newSetRules(ety)))
}

func newValueSet(s set.Set[interface{}]) ValueSet {
	return ValueSet{
		s: s,
	}
}

// ElementType returns the element type for the receiving ValueSet.
func (s ValueSet) ElementType() Type {
	return s.s.Rules().(setRules).Type
}

// Add inserts the given value into the receiving set.
func (s ValueSet) Add(v Value) {
	s.requireElementType(v)
	s.s.Add(v.v)
}

// Remove deletes the given value from the receiving set, if indeed it was
// there in the first place. If the value is not present, this is a no-op.
func (s ValueSet) Remove(v Value) {
	s.requireElementType(v)
	s.s.Remove(v.v)
}

// Has returns true if the given value is in the receiving set, or false if
// it is not.
func (s ValueSet) Has(v Value) bool {
	s.requireElementType(v)
	return s.s.Has(v.v)
}

// Copy performs a shallow copy of the receiving set, returning a new set
// with the same rules and elements.
func (s ValueSet) Copy() ValueSet {
	return newValueSet(s.s.Copy())
}

// Length returns the number of values in the set.
func (s ValueSet) Length() int {
	return s.s.Length()
}

// Values returns a slice of all of the values in the set in no particular
// order.
func (s ValueSet) Values() []Value {
	l := s.s.Length()
	if l == 0 {
		return nil
	}
	ret := make([]Value, 0, l)
	ety := s.ElementType()
	for it := s.s.Iterator(); it.Next(); {
		ret = append(ret, Value{
			ty: ety,
			v:  it.Value(),
		})
	}
	return ret
}

// Union returns a new set that contains all of the members of both the
// receiving set and the given set. Both sets must have the same element type,
// or else this function will panic.
func (s ValueSet) Union(other ValueSet) ValueSet {
	return newValueSet(s.s.Union(other.s))
}

// Intersection returns a new set that contains the values that both the
// receiver and given sets have in common. Both sets must have the same element
// type, or else this function will panic.
func (s ValueSet) Intersection(other ValueSet) ValueSet {
	return newValueSet(s.s.Intersection(other.s))
}

// Subtract returns a new set that contains all of the values from the receiver
// that are not also in the given set. Both sets must have the same element
// type, or else this function will panic.
func (s ValueSet) Subtract(other ValueSet) ValueSet {
	return newValueSet(s.s.Subtract(other.s))
}

// SymmetricDifference returns a new set that contains all of the values from
// both the receiver and given sets, except those that both sets have in
// common. Both sets must have the same element type, or else this function
// will panic.
func (s ValueSet) SymmetricDifference(other ValueSet) ValueSet {
	return newValueSet(s.s.SymmetricDifference(other.s))
}

// requireElementType panics if the given value is not of the set's element type.
//
// It also panics if the given value is marked, because marked values cannot
// be stored in sets.
func (s ValueSet) requireElementType(v Value) {
	if v.IsMarked() {
		panic("cannot store marked value directly in a set (make the set itself unknown instead)")
	}
	if !v.Type().Equals(s.ElementType()) {
		panic(fmt.Errorf("attempt to use %#v value with set of %#v", v.Type(), s.ElementType()))
	}
}
