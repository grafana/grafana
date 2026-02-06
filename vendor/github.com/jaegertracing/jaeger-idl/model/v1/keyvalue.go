// Copyright (c) 2019 The Jaeger Authors.
// Copyright (c) 2017 Uber Technologies, Inc.
// SPDX-License-Identifier: Apache-2.0

package model

import (
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"io"
	"sort"
	"strconv"
)

// These constants are kept mostly for backwards compatibility.
const (
	// StringType indicates the value is a unicode string
	StringType = ValueType_STRING
	// BoolType indicates the value is a Boolean encoded as int64 number 0 or 1
	BoolType = ValueType_BOOL
	// Int64Type indicates the value is an int64 number
	Int64Type = ValueType_INT64
	// Float64Type indicates the value is a float64 number stored as int64
	Float64Type = ValueType_FLOAT64
	// BinaryType indicates the value is binary blob stored as a byte array
	BinaryType = ValueType_BINARY

	SpanKindKey     = "span.kind"
	SamplerTypeKey  = "sampler.type"
	SamplerParamKey = "sampler.param"
)

type SpanKind string

const (
	SpanKindClient      SpanKind = "client"
	SpanKindServer      SpanKind = "server"
	SpanKindProducer    SpanKind = "producer"
	SpanKindConsumer    SpanKind = "consumer"
	SpanKindInternal    SpanKind = "internal"
	SpanKindUnspecified SpanKind = ""
)

func SpanKindFromString(kind string) (SpanKind, error) {
	switch SpanKind(kind) {
	case SpanKindClient, SpanKindServer, SpanKindProducer, SpanKindConsumer, SpanKindInternal, SpanKindUnspecified:
		return SpanKind(kind), nil
	default:
		return SpanKindUnspecified, fmt.Errorf("unknown span kind %q", kind)
	}
}

// KeyValues is a type alias that exposes convenience functions like Sort, FindByKey.
type KeyValues []KeyValue

// String creates a String-typed KeyValue
func String(key string, value string) KeyValue {
	return KeyValue{Key: key, VType: StringType, VStr: value}
}

// Bool creates a Bool-typed KeyValue
func Bool(key string, value bool) KeyValue {
	return KeyValue{Key: key, VType: BoolType, VBool: value}
}

// Int64 creates a Int64-typed KeyValue
func Int64(key string, value int64) KeyValue {
	return KeyValue{Key: key, VType: Int64Type, VInt64: value}
}

// Float64 creates a Float64-typed KeyValue
func Float64(key string, value float64) KeyValue {
	return KeyValue{Key: key, VType: Float64Type, VFloat64: value}
}

// Binary creates a Binary-typed KeyValue
func Binary(key string, value []byte) KeyValue {
	return KeyValue{Key: key, VType: BinaryType, VBinary: value}
}

// Bool returns the Boolean value stored in this KeyValue or false if it stores a different type.
// The caller must check VType before using this method.
func (kv *KeyValue) Bool() bool {
	if kv.VType == BoolType {
		return kv.VBool
	}
	return false
}

// Int64 returns the Int64 value stored in this KeyValue or 0 if it stores a different type.
// The caller must check VType before using this method.
func (kv *KeyValue) Int64() int64 {
	if kv.VType == Int64Type {
		return kv.VInt64
	}
	return 0
}

// Float64 returns the Float64 value stored in this KeyValue or 0 if it stores a different type.
// The caller must check VType before using this method.
func (kv *KeyValue) Float64() float64 {
	if kv.VType == Float64Type {
		return kv.VFloat64
	}
	return 0
}

// Binary returns the blob ([]byte) value stored in this KeyValue or nil if it stores a different type.
// The caller must check VType before using this method.
func (kv *KeyValue) Binary() []byte {
	if kv.VType == BinaryType {
		return kv.VBinary
	}
	return nil
}

// Value returns typed values stored in KeyValue as any.
func (kv *KeyValue) Value() any {
	switch kv.VType {
	case StringType:
		return kv.VStr
	case BoolType:
		return kv.VBool
	case Int64Type:
		return kv.VInt64
	case Float64Type:
		return kv.VFloat64
	case BinaryType:
		return kv.VBinary
	default:
		return fmt.Errorf("unknown type %d", kv.VType)
	}
}

// AsStringLossy returns a potentially lossy string representation of the value.
func (kv *KeyValue) AsStringLossy() string {
	return kv.asString(true)
}

// AsString returns a string representation of the value.
func (kv *KeyValue) AsString() string {
	return kv.asString(false)
}

func (kv *KeyValue) asString(truncate bool) string {
	switch kv.VType {
	case StringType:
		return kv.VStr
	case BoolType:
		if kv.Bool() {
			return "true"
		}
		return "false"
	case Int64Type:
		return strconv.FormatInt(kv.Int64(), 10)
	case Float64Type:
		return strconv.FormatFloat(kv.Float64(), 'g', 10, 64)
	case BinaryType:
		if truncate && len(kv.VBinary) > 256 {
			return hex.EncodeToString(kv.VBinary[0:256]) + "..."
		}
		return hex.EncodeToString(kv.VBinary)
	default:
		return fmt.Sprintf("unknown type %d", kv.VType)
	}
}

// IsLess compares KeyValue object with another KeyValue.
// The order is based first on the keys, then on type, and finally on the value.
func (kv *KeyValue) IsLess(two *KeyValue) bool {
	return kv.Compare(two) < 0
}

func (kvs KeyValues) Len() int      { return len(kvs) }
func (kvs KeyValues) Swap(i, j int) { kvs[i], kvs[j] = kvs[j], kvs[i] }
func (kvs KeyValues) Less(i, j int) bool {
	return kvs[i].IsLess(&kvs[j])
}

// Sort does in-place sorting of KeyValues, then by value type, then by value.
func (kvs KeyValues) Sort() {
	sort.Sort(kvs)
}

// FindByKey scans the list of key-values searching for the first one with the given key.
// Returns found tag and a boolean flag indicating if the search was successful.
func (kvs KeyValues) FindByKey(key string) (KeyValue, bool) {
	for _, kv := range kvs {
		if kv.Key == key {
			return kv, true
		}
	}
	return KeyValue{}, false
}

// Equal compares KeyValues with another list. Both lists must be already sorted.
func (kvs KeyValues) Equal(other KeyValues) bool {
	l1, l2 := len(kvs), len(other)
	if l1 != l2 {
		return false
	}
	for i := 0; i < l1; i++ {
		if !kvs[i].Equal(&other[i]) {
			return false
		}
	}
	return true
}

// Hash implements Hash from Hashable.
func (kvs KeyValues) Hash(w io.Writer) error {
	for i := range kvs {
		if err := kvs[i].Hash(w); err != nil {
			return err
		}
	}
	return nil
}

// Hash implements Hash from Hashable.
func (kv KeyValue) Hash(w io.Writer) error {
	if _, err := w.Write([]byte(kv.Key)); err != nil {
		return err
	}
	//nolint: gosec // G115
	if err := binary.Write(w, binary.BigEndian, uint16(kv.VType)); err != nil {
		return err
	}
	var err error
	switch kv.VType {
	case StringType:
		_, err = w.Write([]byte(kv.VStr))
	case BoolType:
		err = binary.Write(w, binary.BigEndian, kv.VBool)
	case Int64Type:
		err = binary.Write(w, binary.BigEndian, kv.VInt64)
	case Float64Type:
		err = binary.Write(w, binary.BigEndian, kv.VFloat64)
	case BinaryType:
		_, err = w.Write(kv.VBinary)
	default:
		err = fmt.Errorf("unknown type %d", kv.VType)
	}
	return err
}
