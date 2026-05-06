// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pcommon // import "go.opentelemetry.io/collector/pdata/pcommon"

import (
	"iter"

	"go.uber.org/multierr"

	"go.opentelemetry.io/collector/pdata/internal"
	otlpcommon "go.opentelemetry.io/collector/pdata/internal/data/protogen/common/v1"
)

// Slice logically represents a slice of Value.
//
// This is a reference type. If passed by value and callee modifies it, the
// caller will see the modification.
//
// Must use NewSlice function to create new instances.
// Important: zero-initialized instance is not valid for use.
type Slice internal.Slice

func newSlice(orig *[]otlpcommon.AnyValue, state *internal.State) Slice {
	return Slice(internal.NewSlice(orig, state))
}

func (es Slice) getOrig() *[]otlpcommon.AnyValue {
	return internal.GetOrigSlice(internal.Slice(es))
}

func (es Slice) getState() *internal.State {
	return internal.GetSliceState(internal.Slice(es))
}

// NewSlice creates a Slice with 0 elements.
// Can use "EnsureCapacity" to initialize with a given capacity.
func NewSlice() Slice {
	orig := []otlpcommon.AnyValue(nil)
	state := internal.StateMutable
	return Slice(internal.NewSlice(&orig, &state))
}

// Len returns the number of elements in the slice.
//
// Returns "0" for a newly instance created with "NewSlice()".
func (es Slice) Len() int {
	return len(*es.getOrig())
}

// At returns the element at the given index.
//
// This function is used mostly for iterating over all the values in the slice:
//
//	for i := 0; i < es.Len(); i++ {
//	    e := es.At(i)
//	    ... // Do something with the element
//	}
func (es Slice) At(ix int) Value {
	return newValue(&(*es.getOrig())[ix], es.getState())
}

// All returns an iterator over index-value pairs in the slice.
//
//	for i, v := range es.All() {
//	    ... // Do something with index-value pair
//	}
func (es Slice) All() iter.Seq2[int, Value] {
	return func(yield func(int, Value) bool) {
		for i := 0; i < es.Len(); i++ {
			if !yield(i, es.At(i)) {
				return
			}
		}
	}
}

// CopyTo copies all elements from the current slice overriding the destination.
func (es Slice) CopyTo(dest Slice) {
	dest.getState().AssertMutable()
	srcLen := es.Len()
	destCap := cap(*dest.getOrig())
	if srcLen <= destCap {
		(*dest.getOrig()) = (*dest.getOrig())[:srcLen:destCap]
	} else {
		(*dest.getOrig()) = make([]otlpcommon.AnyValue, srcLen)
	}

	for i := range *es.getOrig() {
		newValue(&(*es.getOrig())[i], es.getState()).CopyTo(newValue(&(*dest.getOrig())[i], dest.getState()))
	}
}

// EnsureCapacity is an operation that ensures the slice has at least the specified capacity.
// 1. If the newCap <= cap then no change in capacity.
// 2. If the newCap > cap then the slice capacity will be expanded to equal newCap.
//
// Here is how a new Slice can be initialized:
//
//	es := NewSlice()
//	es.EnsureCapacity(4)
//	for i := 0; i < 4; i++ {
//	    e := es.AppendEmpty()
//	    // Here should set all the values for e.
//	}
func (es Slice) EnsureCapacity(newCap int) {
	es.getState().AssertMutable()
	oldCap := cap(*es.getOrig())
	if newCap <= oldCap {
		return
	}

	newOrig := make([]otlpcommon.AnyValue, len(*es.getOrig()), newCap)
	copy(newOrig, *es.getOrig())
	*es.getOrig() = newOrig
}

// AppendEmpty will append to the end of the slice an empty Value.
// It returns the newly added Value.
func (es Slice) AppendEmpty() Value {
	es.getState().AssertMutable()
	*es.getOrig() = append(*es.getOrig(), otlpcommon.AnyValue{})
	return es.At(es.Len() - 1)
}

// MoveAndAppendTo moves all elements from the current slice and appends them to the dest.
// The current slice will be cleared.
func (es Slice) MoveAndAppendTo(dest Slice) {
	es.getState().AssertMutable()
	dest.getState().AssertMutable()
	if *dest.getOrig() == nil {
		// We can simply move the entire vector and avoid any allocations.
		*dest.getOrig() = *es.getOrig()
	} else {
		*dest.getOrig() = append(*dest.getOrig(), *es.getOrig()...)
	}
	*es.getOrig() = nil
}

// RemoveIf calls f sequentially for each element present in the slice.
// If f returns true, the element is removed from the slice.
func (es Slice) RemoveIf(f func(Value) bool) {
	es.getState().AssertMutable()
	newLen := 0
	for i := 0; i < len(*es.getOrig()); i++ {
		if f(es.At(i)) {
			continue
		}
		if newLen == i {
			// Nothing to move, element is at the right place.
			newLen++
			continue
		}
		(*es.getOrig())[newLen] = (*es.getOrig())[i]
		newLen++
	}
	*es.getOrig() = (*es.getOrig())[:newLen]
}

// AsRaw return []any copy of the Slice.
func (es Slice) AsRaw() []any {
	rawSlice := make([]any, 0, es.Len())
	for i := 0; i < es.Len(); i++ {
		rawSlice = append(rawSlice, es.At(i).AsRaw())
	}
	return rawSlice
}

// FromRaw copies []any into the Slice.
func (es Slice) FromRaw(rawSlice []any) error {
	es.getState().AssertMutable()
	if len(rawSlice) == 0 {
		*es.getOrig() = nil
		return nil
	}
	var errs error
	origs := make([]otlpcommon.AnyValue, len(rawSlice))
	for ix, iv := range rawSlice {
		errs = multierr.Append(errs, newValue(&origs[ix], es.getState()).FromRaw(iv))
	}
	*es.getOrig() = origs
	return errs
}

// Equal checks equality with another Slice
func (es Slice) Equal(val Slice) bool {
	if es.Len() != val.Len() {
		return false
	}

	for i := 0; i < es.Len(); i++ {
		if !es.At(i).Equal(val.At(i)) {
			return false
		}
	}
	return true
}
