// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pcommon // import "go.opentelemetry.io/collector/pdata/pcommon"

import (
	"iter"

	"go.uber.org/multierr"

	"go.opentelemetry.io/collector/pdata/internal"
	otlpcommon "go.opentelemetry.io/collector/pdata/internal/data/protogen/common/v1"
)

// Map stores a map of string keys to elements of Value type.
//
// Must use NewMap function to create new instances.
// Important: zero-initialized instance is not valid for use.
type Map internal.Map

// NewMap creates a Map with 0 elements.
func NewMap() Map {
	orig := []otlpcommon.KeyValue(nil)
	state := internal.StateMutable
	return Map(internal.NewMap(&orig, &state))
}

func (m Map) getOrig() *[]otlpcommon.KeyValue {
	return internal.GetOrigMap(internal.Map(m))
}

func (m Map) getState() *internal.State {
	return internal.GetMapState(internal.Map(m))
}

func newMap(orig *[]otlpcommon.KeyValue, state *internal.State) Map {
	return Map(internal.NewMap(orig, state))
}

// Clear erases any existing entries in this Map instance.
func (m Map) Clear() {
	m.getState().AssertMutable()
	*m.getOrig() = nil
}

// EnsureCapacity increases the capacity of this Map instance, if necessary,
// to ensure that it can hold at least the number of elements specified by the capacity argument.
func (m Map) EnsureCapacity(capacity int) {
	m.getState().AssertMutable()
	oldOrig := *m.getOrig()
	if capacity <= cap(oldOrig) {
		return
	}
	*m.getOrig() = make([]otlpcommon.KeyValue, len(oldOrig), capacity)
	copy(*m.getOrig(), oldOrig)
}

// Get returns the Value associated with the key and true. Returned
// Value is not a copy, it is a reference to the value stored in this map.
// It is allowed to modify the returned value using Value.Set* functions.
// Such modification will be applied to the value stored in this map.
//
// If the key does not exist returns a zero-initialized KeyValue and false.
// Calling any functions on the returned invalid instance may cause a panic.
func (m Map) Get(key string) (Value, bool) {
	for i := range *m.getOrig() {
		akv := &(*m.getOrig())[i]
		if akv.Key == key {
			return newValue(&akv.Value, m.getState()), true
		}
	}
	return newValue(nil, m.getState()), false
}

// Remove removes the entry associated with the key and returns true if the key
// was present in the map, otherwise returns false.
func (m Map) Remove(key string) bool {
	m.getState().AssertMutable()
	for i := range *m.getOrig() {
		akv := &(*m.getOrig())[i]
		if akv.Key == key {
			*akv = (*m.getOrig())[len(*m.getOrig())-1]
			*m.getOrig() = (*m.getOrig())[:len(*m.getOrig())-1]
			return true
		}
	}
	return false
}

// RemoveIf removes the entries for which the function in question returns true
func (m Map) RemoveIf(f func(string, Value) bool) {
	m.getState().AssertMutable()
	newLen := 0
	for i := 0; i < len(*m.getOrig()); i++ {
		akv := &(*m.getOrig())[i]
		if f(akv.Key, newValue(&akv.Value, m.getState())) {
			continue
		}
		if newLen == i {
			// Nothing to move, element is at the right place.
			newLen++
			continue
		}
		(*m.getOrig())[newLen] = (*m.getOrig())[i]
		newLen++
	}
	*m.getOrig() = (*m.getOrig())[:newLen]
}

// PutEmpty inserts or updates an empty value to the map under given key
// and return the updated/inserted value.
func (m Map) PutEmpty(k string) Value {
	m.getState().AssertMutable()
	if av, existing := m.Get(k); existing {
		av.getOrig().Value = nil
		return newValue(av.getOrig(), m.getState())
	}
	*m.getOrig() = append(*m.getOrig(), otlpcommon.KeyValue{Key: k})
	return newValue(&(*m.getOrig())[len(*m.getOrig())-1].Value, m.getState())
}

// PutStr performs the Insert or Update action. The Value is
// inserted to the map that did not originally have the key. The key/value is
// updated to the map where the key already existed.
func (m Map) PutStr(k string, v string) {
	m.getState().AssertMutable()
	if av, existing := m.Get(k); existing {
		av.SetStr(v)
	} else {
		*m.getOrig() = append(*m.getOrig(), newKeyValueString(k, v))
	}
}

// PutInt performs the Insert or Update action. The int Value is
// inserted to the map that did not originally have the key. The key/value is
// updated to the map where the key already existed.
func (m Map) PutInt(k string, v int64) {
	m.getState().AssertMutable()
	if av, existing := m.Get(k); existing {
		av.SetInt(v)
	} else {
		*m.getOrig() = append(*m.getOrig(), newKeyValueInt(k, v))
	}
}

// PutDouble performs the Insert or Update action. The double Value is
// inserted to the map that did not originally have the key. The key/value is
// updated to the map where the key already existed.
func (m Map) PutDouble(k string, v float64) {
	m.getState().AssertMutable()
	if av, existing := m.Get(k); existing {
		av.SetDouble(v)
	} else {
		*m.getOrig() = append(*m.getOrig(), newKeyValueDouble(k, v))
	}
}

// PutBool performs the Insert or Update action. The bool Value is
// inserted to the map that did not originally have the key. The key/value is
// updated to the map where the key already existed.
func (m Map) PutBool(k string, v bool) {
	m.getState().AssertMutable()
	if av, existing := m.Get(k); existing {
		av.SetBool(v)
	} else {
		*m.getOrig() = append(*m.getOrig(), newKeyValueBool(k, v))
	}
}

// PutEmptyBytes inserts or updates an empty byte slice under given key and returns it.
func (m Map) PutEmptyBytes(k string) ByteSlice {
	m.getState().AssertMutable()
	bv := otlpcommon.AnyValue_BytesValue{}
	if av, existing := m.Get(k); existing {
		av.getOrig().Value = &bv
	} else {
		*m.getOrig() = append(*m.getOrig(), otlpcommon.KeyValue{Key: k, Value: otlpcommon.AnyValue{Value: &bv}})
	}
	return ByteSlice(internal.NewByteSlice(&bv.BytesValue, m.getState()))
}

// PutEmptyMap inserts or updates an empty map under given key and returns it.
func (m Map) PutEmptyMap(k string) Map {
	m.getState().AssertMutable()
	kvl := otlpcommon.AnyValue_KvlistValue{KvlistValue: &otlpcommon.KeyValueList{Values: []otlpcommon.KeyValue(nil)}}
	if av, existing := m.Get(k); existing {
		av.getOrig().Value = &kvl
	} else {
		*m.getOrig() = append(*m.getOrig(), otlpcommon.KeyValue{Key: k, Value: otlpcommon.AnyValue{Value: &kvl}})
	}
	return Map(internal.NewMap(&kvl.KvlistValue.Values, m.getState()))
}

// PutEmptySlice inserts or updates an empty slice under given key and returns it.
func (m Map) PutEmptySlice(k string) Slice {
	m.getState().AssertMutable()
	vl := otlpcommon.AnyValue_ArrayValue{ArrayValue: &otlpcommon.ArrayValue{Values: []otlpcommon.AnyValue(nil)}}
	if av, existing := m.Get(k); existing {
		av.getOrig().Value = &vl
	} else {
		*m.getOrig() = append(*m.getOrig(), otlpcommon.KeyValue{Key: k, Value: otlpcommon.AnyValue{Value: &vl}})
	}
	return Slice(internal.NewSlice(&vl.ArrayValue.Values, m.getState()))
}

// Len returns the length of this map.
//
// Because the Map is represented internally by a slice of pointers, and the data are comping from the wire,
// it is possible that when iterating using "Range" to get access to fewer elements because nil elements are skipped.
func (m Map) Len() int {
	return len(*m.getOrig())
}

// Range calls f sequentially for each key and value present in the map. If f returns false, range stops the iteration.
//
// Example:
//
//	sm.Range(func(k string, v Value) bool {
//	    ...
//	})
func (m Map) Range(f func(k string, v Value) bool) {
	for i := range *m.getOrig() {
		kv := &(*m.getOrig())[i]
		if !f(kv.Key, Value(internal.NewValue(&kv.Value, m.getState()))) {
			break
		}
	}
}

// All returns an iterator over key-value pairs in the Map.
//
//	for k, v := range es.All() {
//	    ... // Do something with key-value pair
//	}
func (m Map) All() iter.Seq2[string, Value] {
	return func(yield func(string, Value) bool) {
		for i := range *m.getOrig() {
			kv := &(*m.getOrig())[i]
			if !yield(kv.Key, Value(internal.NewValue(&kv.Value, m.getState()))) {
				return
			}
		}
	}
}

// MoveTo moves all key/values from the current map overriding the destination and
// resetting the current instance to its zero value
func (m Map) MoveTo(dest Map) {
	m.getState().AssertMutable()
	dest.getState().AssertMutable()
	*dest.getOrig() = *m.getOrig()
	*m.getOrig() = nil
}

// CopyTo copies all elements from the current map overriding the destination.
func (m Map) CopyTo(dest Map) {
	dest.getState().AssertMutable()
	newLen := len(*m.getOrig())
	oldCap := cap(*dest.getOrig())
	if newLen <= oldCap {
		// New slice fits in existing slice, no need to reallocate.
		*dest.getOrig() = (*dest.getOrig())[:newLen:oldCap]
		for i := range *m.getOrig() {
			akv := &(*m.getOrig())[i]
			destAkv := &(*dest.getOrig())[i]
			destAkv.Key = akv.Key
			newValue(&akv.Value, m.getState()).CopyTo(newValue(&destAkv.Value, dest.getState()))
		}
		return
	}

	// New slice is bigger than exist slice. Allocate new space.
	origs := make([]otlpcommon.KeyValue, len(*m.getOrig()))
	for i := range *m.getOrig() {
		akv := &(*m.getOrig())[i]
		origs[i].Key = akv.Key
		newValue(&akv.Value, m.getState()).CopyTo(newValue(&origs[i].Value, dest.getState()))
	}
	*dest.getOrig() = origs
}

// AsRaw returns a standard go map representation of this Map.
func (m Map) AsRaw() map[string]any {
	rawMap := make(map[string]any, m.Len())
	m.Range(func(k string, v Value) bool {
		rawMap[k] = v.AsRaw()
		return true
	})
	return rawMap
}

// FromRaw overrides this Map instance from a standard go map.
func (m Map) FromRaw(rawMap map[string]any) error {
	m.getState().AssertMutable()
	if len(rawMap) == 0 {
		*m.getOrig() = nil
		return nil
	}

	var errs error
	origs := make([]otlpcommon.KeyValue, len(rawMap))
	ix := 0
	for k, iv := range rawMap {
		origs[ix].Key = k
		errs = multierr.Append(errs, newValue(&origs[ix].Value, m.getState()).FromRaw(iv))
		ix++
	}
	*m.getOrig() = origs
	return errs
}

// Equal checks equality with another Map
func (m Map) Equal(val Map) bool {
	if m.Len() != val.Len() {
		return false
	}

	fullEqual := true

	m.Range(func(k string, v Value) bool {
		vv, ok := val.Get(k)
		if !ok {
			fullEqual = false
			return fullEqual
		}

		if !v.Equal(vv) {
			fullEqual = false
		}
		return fullEqual
	})
	return fullEqual
}
