// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

//go:generate stringer -type=Kind -trimprefix=Kind

package log // import "go.opentelemetry.io/otel/log"

import (
	"bytes"
	"cmp"
	"errors"
	"fmt"
	"math"
	"slices"
	"strconv"
	"unsafe"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/internal/global"
)

// errKind is logged when a Value is decoded to an incompatible type.
var errKind = errors.New("invalid Kind")

// Kind is the kind of a [Value].
type Kind int

// Kind values.
const (
	KindEmpty Kind = iota
	KindBool
	KindFloat64
	KindInt64
	KindString
	KindBytes
	KindSlice
	KindMap
)

// A Value represents a structured log value.
// A zero value is valid and represents an empty value.
type Value struct {
	// Ensure forward compatibility by explicitly making this not comparable.
	noCmp [0]func() //nolint: unused  // This is indeed used.

	// num holds the value for Int64, Float64, and Bool. It holds the length
	// for String, Bytes, Slice, Map.
	num uint64
	// any holds either the KindBool, KindInt64, KindFloat64, stringptr,
	// bytesptr, sliceptr, or mapptr. If KindBool, KindInt64, or KindFloat64
	// then the value of Value is in num as described above. Otherwise, it
	// contains the value wrapped in the appropriate type.
	any any
}

type (
	// sliceptr represents a value in Value.any for KindString Values.
	stringptr *byte
	// bytesptr represents a value in Value.any for KindBytes Values.
	bytesptr *byte
	// sliceptr represents a value in Value.any for KindSlice Values.
	sliceptr *Value
	// mapptr represents a value in Value.any for KindMap Values.
	mapptr *KeyValue
)

// StringValue returns a new [Value] for a string.
func StringValue(v string) Value {
	return Value{
		num: uint64(len(v)),
		any: stringptr(unsafe.StringData(v)),
	}
}

// IntValue returns a [Value] for an int.
func IntValue(v int) Value { return Int64Value(int64(v)) }

// Int64Value returns a [Value] for an int64.
func Int64Value(v int64) Value {
	// This can be later converted back to int64 (overflow not checked).
	return Value{num: uint64(v), any: KindInt64} // nolint:gosec
}

// Float64Value returns a [Value] for a float64.
func Float64Value(v float64) Value {
	return Value{num: math.Float64bits(v), any: KindFloat64}
}

// BoolValue returns a [Value] for a bool.
func BoolValue(v bool) Value { //nolint:revive // Not a control flag.
	var n uint64
	if v {
		n = 1
	}
	return Value{num: n, any: KindBool}
}

// BytesValue returns a [Value] for a byte slice. The passed slice must not be
// changed after it is passed.
func BytesValue(v []byte) Value {
	return Value{
		num: uint64(len(v)),
		any: bytesptr(unsafe.SliceData(v)),
	}
}

// SliceValue returns a [Value] for a slice of [Value]. The passed slice must
// not be changed after it is passed.
func SliceValue(vs ...Value) Value {
	return Value{
		num: uint64(len(vs)),
		any: sliceptr(unsafe.SliceData(vs)),
	}
}

// MapValue returns a new [Value] for a slice of key-value pairs. The passed
// slice must not be changed after it is passed.
func MapValue(kvs ...KeyValue) Value {
	return Value{
		num: uint64(len(kvs)),
		any: mapptr(unsafe.SliceData(kvs)),
	}
}

// AsString returns the value held by v as a string.
func (v Value) AsString() string {
	if sp, ok := v.any.(stringptr); ok {
		return unsafe.String(sp, v.num)
	}
	global.Error(errKind, "AsString", "Kind", v.Kind())
	return ""
}

// asString returns the value held by v as a string. It will panic if the Value
// is not KindString.
func (v Value) asString() string {
	return unsafe.String(v.any.(stringptr), v.num)
}

// AsInt64 returns the value held by v as an int64.
func (v Value) AsInt64() int64 {
	if v.Kind() != KindInt64 {
		global.Error(errKind, "AsInt64", "Kind", v.Kind())
		return 0
	}
	return v.asInt64()
}

// asInt64 returns the value held by v as an int64. If v is not of KindInt64,
// this will return garbage.
func (v Value) asInt64() int64 {
	// Assumes v.num was a valid int64 (overflow not checked).
	return int64(v.num) // nolint: gosec
}

// AsBool returns the value held by v as a bool.
func (v Value) AsBool() bool {
	if v.Kind() != KindBool {
		global.Error(errKind, "AsBool", "Kind", v.Kind())
		return false
	}
	return v.asBool()
}

// asBool returns the value held by v as a bool. If v is not of KindBool, this
// will return garbage.
func (v Value) asBool() bool { return v.num == 1 }

// AsFloat64 returns the value held by v as a float64.
func (v Value) AsFloat64() float64 {
	if v.Kind() != KindFloat64 {
		global.Error(errKind, "AsFloat64", "Kind", v.Kind())
		return 0
	}
	return v.asFloat64()
}

// asFloat64 returns the value held by v as a float64. If v is not of
// KindFloat64, this will return garbage.
func (v Value) asFloat64() float64 { return math.Float64frombits(v.num) }

// AsBytes returns the value held by v as a []byte.
func (v Value) AsBytes() []byte {
	if sp, ok := v.any.(bytesptr); ok {
		return unsafe.Slice((*byte)(sp), v.num)
	}
	global.Error(errKind, "AsBytes", "Kind", v.Kind())
	return nil
}

// asBytes returns the value held by v as a []byte. It will panic if the Value
// is not KindBytes.
func (v Value) asBytes() []byte {
	return unsafe.Slice((*byte)(v.any.(bytesptr)), v.num)
}

// AsSlice returns the value held by v as a []Value.
func (v Value) AsSlice() []Value {
	if sp, ok := v.any.(sliceptr); ok {
		return unsafe.Slice((*Value)(sp), v.num)
	}
	global.Error(errKind, "AsSlice", "Kind", v.Kind())
	return nil
}

// asSlice returns the value held by v as a []Value. It will panic if the Value
// is not KindSlice.
func (v Value) asSlice() []Value {
	return unsafe.Slice((*Value)(v.any.(sliceptr)), v.num)
}

// AsMap returns the value held by v as a []KeyValue.
func (v Value) AsMap() []KeyValue {
	if sp, ok := v.any.(mapptr); ok {
		return unsafe.Slice((*KeyValue)(sp), v.num)
	}
	global.Error(errKind, "AsMap", "Kind", v.Kind())
	return nil
}

// asMap returns the value held by v as a []KeyValue. It will panic if the
// Value is not KindMap.
func (v Value) asMap() []KeyValue {
	return unsafe.Slice((*KeyValue)(v.any.(mapptr)), v.num)
}

// Kind returns the Kind of v.
func (v Value) Kind() Kind {
	switch x := v.any.(type) {
	case Kind:
		return x
	case stringptr:
		return KindString
	case bytesptr:
		return KindBytes
	case sliceptr:
		return KindSlice
	case mapptr:
		return KindMap
	default:
		return KindEmpty
	}
}

// Empty returns if v does not hold any value.
func (v Value) Empty() bool { return v.Kind() == KindEmpty }

// Equal returns if v is equal to w.
func (v Value) Equal(w Value) bool {
	k1 := v.Kind()
	k2 := w.Kind()
	if k1 != k2 {
		return false
	}
	switch k1 {
	case KindInt64, KindBool:
		return v.num == w.num
	case KindString:
		return v.asString() == w.asString()
	case KindFloat64:
		return v.asFloat64() == w.asFloat64()
	case KindSlice:
		return slices.EqualFunc(v.asSlice(), w.asSlice(), Value.Equal)
	case KindMap:
		sv := sortMap(v.asMap())
		sw := sortMap(w.asMap())
		return slices.EqualFunc(sv, sw, KeyValue.Equal)
	case KindBytes:
		return bytes.Equal(v.asBytes(), w.asBytes())
	case KindEmpty:
		return true
	default:
		global.Error(errKind, "Equal", "Kind", k1)
		return false
	}
}

func sortMap(m []KeyValue) []KeyValue {
	sm := make([]KeyValue, len(m))
	copy(sm, m)
	slices.SortFunc(sm, func(a, b KeyValue) int {
		return cmp.Compare(a.Key, b.Key)
	})

	return sm
}

// String returns Value's value as a string, formatted like [fmt.Sprint].
//
// The returned string is meant for debugging;
// the string representation is not stable.
func (v Value) String() string {
	switch v.Kind() {
	case KindString:
		return v.asString()
	case KindInt64:
		// Assumes v.num was a valid int64 (overflow not checked).
		return strconv.FormatInt(int64(v.num), 10) // nolint: gosec
	case KindFloat64:
		return strconv.FormatFloat(v.asFloat64(), 'g', -1, 64)
	case KindBool:
		return strconv.FormatBool(v.asBool())
	case KindBytes:
		return fmt.Sprint(v.asBytes()) // nolint:staticcheck  // Use fmt.Sprint to encode as slice.
	case KindMap:
		return fmt.Sprint(v.asMap())
	case KindSlice:
		return fmt.Sprint(v.asSlice())
	case KindEmpty:
		return "<nil>"
	default:
		// Try to handle this as gracefully as possible.
		//
		// Don't panic here. The goal here is to have developers find this
		// first if a slog.Kind is is not handled. It is
		// preferable to have user's open issue asking why their attributes
		// have a "unhandled: " prefix than say that their code is panicking.
		return fmt.Sprintf("<unhandled log.Kind: %s>", v.Kind())
	}
}

// A KeyValue is a key-value pair used to represent a log attribute (a
// superset of [go.opentelemetry.io/otel/attribute.KeyValue]) and map item.
type KeyValue struct {
	Key   string
	Value Value
}

// Equal returns if a is equal to b.
func (a KeyValue) Equal(b KeyValue) bool {
	return a.Key == b.Key && a.Value.Equal(b.Value)
}

// String returns a KeyValue for a string value.
func String(key, value string) KeyValue {
	return KeyValue{key, StringValue(value)}
}

// Int64 returns a KeyValue for an int64 value.
func Int64(key string, value int64) KeyValue {
	return KeyValue{key, Int64Value(value)}
}

// Int returns a KeyValue for an int value.
func Int(key string, value int) KeyValue {
	return KeyValue{key, IntValue(value)}
}

// Float64 returns a KeyValue for a float64 value.
func Float64(key string, value float64) KeyValue {
	return KeyValue{key, Float64Value(value)}
}

// Bool returns a KeyValue for a bool value.
func Bool(key string, value bool) KeyValue {
	return KeyValue{key, BoolValue(value)}
}

// Bytes returns a KeyValue for a []byte value.
// The passed slice must not be changed after it is passed.
func Bytes(key string, value []byte) KeyValue {
	return KeyValue{key, BytesValue(value)}
}

// Slice returns a KeyValue for a []Value value.
// The passed slice must not be changed after it is passed.
func Slice(key string, value ...Value) KeyValue {
	return KeyValue{key, SliceValue(value...)}
}

// Map returns a KeyValue for a map value.
// The passed slice must not be changed after it is passed.
func Map(key string, value ...KeyValue) KeyValue {
	return KeyValue{key, MapValue(value...)}
}

// Empty returns a KeyValue with an empty value.
func Empty(key string) KeyValue {
	return KeyValue{key, Value{}}
}

// String returns key-value pair as a string, formatted like "key:value".
//
// The returned string is meant for debugging;
// the string representation is not stable.
func (a KeyValue) String() string {
	return fmt.Sprintf("%s:%s", a.Key, a.Value)
}

// ValueFromAttribute converts [attribute.Value] to [Value].
func ValueFromAttribute(value attribute.Value) Value {
	switch value.Type() {
	case attribute.INVALID:
		return Value{}
	case attribute.BOOL:
		return BoolValue(value.AsBool())
	case attribute.BOOLSLICE:
		val := value.AsBoolSlice()
		res := make([]Value, 0, len(val))
		for _, v := range val {
			res = append(res, BoolValue(v))
		}
		return SliceValue(res...)
	case attribute.INT64:
		return Int64Value(value.AsInt64())
	case attribute.INT64SLICE:
		val := value.AsInt64Slice()
		res := make([]Value, 0, len(val))
		for _, v := range val {
			res = append(res, Int64Value(v))
		}
		return SliceValue(res...)
	case attribute.FLOAT64:
		return Float64Value(value.AsFloat64())
	case attribute.FLOAT64SLICE:
		val := value.AsFloat64Slice()
		res := make([]Value, 0, len(val))
		for _, v := range val {
			res = append(res, Float64Value(v))
		}
		return SliceValue(res...)
	case attribute.STRING:
		return StringValue(value.AsString())
	case attribute.STRINGSLICE:
		val := value.AsStringSlice()
		res := make([]Value, 0, len(val))
		for _, v := range val {
			res = append(res, StringValue(v))
		}
		return SliceValue(res...)
	}
	// This code should never be reached
	// as log attributes are a superset of standard attributes.
	panic("unknown attribute type")
}

// KeyValueFromAttribute converts [attribute.KeyValue] to [KeyValue].
func KeyValueFromAttribute(kv attribute.KeyValue) KeyValue {
	return KeyValue{
		Key:   string(kv.Key),
		Value: ValueFromAttribute(kv.Value),
	}
}
