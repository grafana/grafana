package cli

import (
	"flag"
	"reflect"
)

type (
	// SliceFlag extends implementations like StringSliceFlag and IntSliceFlag with support for using slices directly,
	// as Value and/or Destination.
	// See also SliceFlagTarget, MultiStringFlag, MultiFloat64Flag, MultiInt64Flag, MultiIntFlag.
	SliceFlag[T SliceFlagTarget[E], S ~[]E, E any] struct {
		Target      T
		Value       S
		Destination *S
	}

	// SliceFlagTarget models a target implementation for use with SliceFlag.
	// The three methods, SetValue, SetDestination, and GetDestination, are necessary to propagate Value and
	// Destination, where Value is propagated inwards (initially), and Destination is propagated outwards (on every
	// update).
	SliceFlagTarget[E any] interface {
		Flag
		RequiredFlag
		DocGenerationFlag
		VisibleFlag
		CategorizableFlag

		// SetValue should propagate the given slice to the target, ideally as a new value.
		// Note that a nil slice should nil/clear any existing value (modelled as ~[]E).
		SetValue(slice []E)
		// SetDestination should propagate the given slice to the target, ideally as a new value.
		// Note that a nil slice should nil/clear any existing value (modelled as ~*[]E).
		SetDestination(slice []E)
		// GetDestination should return the current value referenced by any destination, or nil if nil/unset.
		GetDestination() []E
	}

	// MultiStringFlag extends StringSliceFlag with support for using slices directly, as Value and/or Destination.
	// See also SliceFlag.
	MultiStringFlag = SliceFlag[*StringSliceFlag, []string, string]

	// MultiFloat64Flag extends Float64SliceFlag with support for using slices directly, as Value and/or Destination.
	// See also SliceFlag.
	MultiFloat64Flag = SliceFlag[*Float64SliceFlag, []float64, float64]

	// MultiInt64Flag extends Int64SliceFlag with support for using slices directly, as Value and/or Destination.
	// See also SliceFlag.
	MultiInt64Flag = SliceFlag[*Int64SliceFlag, []int64, int64]

	// MultiIntFlag extends IntSliceFlag with support for using slices directly, as Value and/or Destination.
	// See also SliceFlag.
	MultiIntFlag = SliceFlag[*IntSliceFlag, []int, int]

	flagValueHook struct {
		value Generic
		hook  func()
	}
)

var (
	// compile time assertions

	_ SliceFlagTarget[string]  = (*StringSliceFlag)(nil)
	_ SliceFlagTarget[string]  = (*SliceFlag[*StringSliceFlag, []string, string])(nil)
	_ SliceFlagTarget[string]  = (*MultiStringFlag)(nil)
	_ SliceFlagTarget[float64] = (*MultiFloat64Flag)(nil)
	_ SliceFlagTarget[int64]   = (*MultiInt64Flag)(nil)
	_ SliceFlagTarget[int]     = (*MultiIntFlag)(nil)

	_ Generic    = (*flagValueHook)(nil)
	_ Serializer = (*flagValueHook)(nil)
)

func (x *SliceFlag[T, S, E]) Apply(set *flag.FlagSet) error {
	x.Target.SetValue(x.convertSlice(x.Value))

	destination := x.Destination
	if destination == nil {
		x.Target.SetDestination(nil)

		return x.Target.Apply(set)
	}

	x.Target.SetDestination(x.convertSlice(*destination))

	return applyFlagValueHook(set, x.Target.Apply, func() {
		*destination = x.Target.GetDestination()
	})
}

func (x *SliceFlag[T, S, E]) convertSlice(slice S) []E {
	result := make([]E, len(slice))
	copy(result, slice)
	return result
}

func (x *SliceFlag[T, S, E]) SetValue(slice S) {
	x.Value = slice
}

func (x *SliceFlag[T, S, E]) SetDestination(slice S) {
	if slice != nil {
		x.Destination = &slice
	} else {
		x.Destination = nil
	}
}

func (x *SliceFlag[T, S, E]) GetDestination() S {
	if destination := x.Destination; destination != nil {
		return *destination
	}
	return nil
}

func (x *SliceFlag[T, S, E]) String() string         { return x.Target.String() }
func (x *SliceFlag[T, S, E]) Names() []string        { return x.Target.Names() }
func (x *SliceFlag[T, S, E]) IsSet() bool            { return x.Target.IsSet() }
func (x *SliceFlag[T, S, E]) IsRequired() bool       { return x.Target.IsRequired() }
func (x *SliceFlag[T, S, E]) TakesValue() bool       { return x.Target.TakesValue() }
func (x *SliceFlag[T, S, E]) GetUsage() string       { return x.Target.GetUsage() }
func (x *SliceFlag[T, S, E]) GetValue() string       { return x.Target.GetValue() }
func (x *SliceFlag[T, S, E]) GetDefaultText() string { return x.Target.GetDefaultText() }
func (x *SliceFlag[T, S, E]) GetEnvVars() []string   { return x.Target.GetEnvVars() }
func (x *SliceFlag[T, S, E]) IsVisible() bool        { return x.Target.IsVisible() }
func (x *SliceFlag[T, S, E]) GetCategory() string    { return x.Target.GetCategory() }

func (x *flagValueHook) Set(value string) error {
	if err := x.value.Set(value); err != nil {
		return err
	}
	x.hook()
	return nil
}

func (x *flagValueHook) String() string {
	// note: this is necessary due to the way Go's flag package handles defaults
	isZeroValue := func(f flag.Value, v string) bool {
		/*
			https://cs.opensource.google/go/go/+/refs/tags/go1.18.3:src/flag/flag.go;drc=2580d0e08d5e9f979b943758d3c49877fb2324cb;l=453

			Copyright (c) 2009 The Go Authors. All rights reserved.
			Redistribution and use in source and binary forms, with or without
			modification, are permitted provided that the following conditions are
			met:
			   * Redistributions of source code must retain the above copyright
			notice, this list of conditions and the following disclaimer.
			   * Redistributions in binary form must reproduce the above
			copyright notice, this list of conditions and the following disclaimer
			in the documentation and/or other materials provided with the
			distribution.
			   * Neither the name of Google Inc. nor the names of its
			contributors may be used to endorse or promote products derived from
			this software without specific prior written permission.
			THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
			"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
			LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
			A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
			OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
			SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
			LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
			DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
			THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
			(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
			OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
		*/
		// Build a zero value of the flag's Value type, and see if the
		// result of calling its String method equals the value passed in.
		// This works unless the Value type is itself an interface type.
		typ := reflect.TypeOf(f)
		var z reflect.Value
		if typ.Kind() == reflect.Pointer {
			z = reflect.New(typ.Elem())
		} else {
			z = reflect.Zero(typ)
		}
		return v == z.Interface().(flag.Value).String()
	}
	if x.value != nil {
		// only return non-empty if not the same string as returned by the zero value
		if s := x.value.String(); !isZeroValue(x.value, s) {
			return s
		}
	}
	return ``
}

func (x *flagValueHook) Serialize() string {
	if value, ok := x.value.(Serializer); ok {
		return value.Serialize()
	}
	return x.String()
}

// applyFlagValueHook wraps calls apply then wraps flags to call a hook function on update and after initial apply.
func applyFlagValueHook(set *flag.FlagSet, apply func(set *flag.FlagSet) error, hook func()) error {
	if apply == nil || set == nil || hook == nil {
		panic(`invalid input`)
	}
	var tmp flag.FlagSet
	if err := apply(&tmp); err != nil {
		return err
	}
	tmp.VisitAll(func(f *flag.Flag) { set.Var(&flagValueHook{value: f.Value, hook: hook}, f.Name, f.Usage) })
	hook()
	return nil
}

// newSliceFlagValue is for implementing SliceFlagTarget.SetValue and SliceFlagTarget.SetDestination.
// It's e.g. as part of StringSliceFlag.SetValue, using the factory NewStringSlice.
func newSliceFlagValue[R any, S ~[]E, E any](factory func(defaults ...E) *R, defaults S) *R {
	if defaults == nil {
		return nil
	}
	return factory(defaults...)
}

// unwrapFlagValue strips any/all *flagValueHook wrappers.
func unwrapFlagValue(v flag.Value) flag.Value {
	for {
		h, ok := v.(*flagValueHook)
		if !ok {
			return v
		}
		v = h.value
	}
}

// NOTE: the methods below are in this file to make use of the build constraint

func (f *Float64SliceFlag) SetValue(slice []float64) {
	f.Value = newSliceFlagValue(NewFloat64Slice, slice)
}

func (f *Float64SliceFlag) SetDestination(slice []float64) {
	f.Destination = newSliceFlagValue(NewFloat64Slice, slice)
}

func (f *Float64SliceFlag) GetDestination() []float64 {
	if destination := f.Destination; destination != nil {
		return destination.Value()
	}
	return nil
}

func (f *Int64SliceFlag) SetValue(slice []int64) {
	f.Value = newSliceFlagValue(NewInt64Slice, slice)
}

func (f *Int64SliceFlag) SetDestination(slice []int64) {
	f.Destination = newSliceFlagValue(NewInt64Slice, slice)
}

func (f *Int64SliceFlag) GetDestination() []int64 {
	if destination := f.Destination; destination != nil {
		return destination.Value()
	}
	return nil
}

func (f *IntSliceFlag) SetValue(slice []int) {
	f.Value = newSliceFlagValue(NewIntSlice, slice)
}

func (f *IntSliceFlag) SetDestination(slice []int) {
	f.Destination = newSliceFlagValue(NewIntSlice, slice)
}

func (f *IntSliceFlag) GetDestination() []int {
	if destination := f.Destination; destination != nil {
		return destination.Value()
	}
	return nil
}

func (f *StringSliceFlag) SetValue(slice []string) {
	f.Value = newSliceFlagValue(NewStringSlice, slice)
}

func (f *StringSliceFlag) SetDestination(slice []string) {
	f.Destination = newSliceFlagValue(NewStringSlice, slice)
}

func (f *StringSliceFlag) GetDestination() []string {
	if destination := f.Destination; destination != nil {
		return destination.Value()
	}
	return nil
}
