// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package arrow

import (
	"fmt"
	"hash/maphash"
	"strings"

	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

// Type is a logical type. They can be expressed as
// either a primitive physical type (bytes or bits of some fixed size), a
// nested type consisting of other data types, or another data type (e.g. a
// timestamp encoded as an int64)
type Type int

const (
	// NULL type having no physical storage
	NULL Type = iota

	// BOOL is a 1 bit, LSB bit-packed ordering
	BOOL

	// UINT8 is an Unsigned 8-bit little-endian integer
	UINT8

	// INT8 is a Signed 8-bit little-endian integer
	INT8

	// UINT16 is an Unsigned 16-bit little-endian integer
	UINT16

	// INT16 is a Signed 16-bit little-endian integer
	INT16

	// UINT32 is an Unsigned 32-bit little-endian integer
	UINT32

	// INT32 is a Signed 32-bit little-endian integer
	INT32

	// UINT64 is an Unsigned 64-bit little-endian integer
	UINT64

	// INT64 is a Signed 64-bit little-endian integer
	INT64

	// FLOAT16 is a 2-byte floating point value
	FLOAT16

	// FLOAT32 is a 4-byte floating point value
	FLOAT32

	// FLOAT64 is an 8-byte floating point value
	FLOAT64

	// STRING is a UTF8 variable-length string
	STRING

	// BINARY is a Variable-length byte type (no guarantee of UTF8-ness)
	BINARY

	// FIXED_SIZE_BINARY is a binary where each value occupies the same number of bytes
	FIXED_SIZE_BINARY

	// DATE32 is int32 days since the UNIX epoch
	DATE32

	// DATE64 is int64 milliseconds since the UNIX epoch
	DATE64

	// TIMESTAMP is an exact timestamp encoded with int64 since UNIX epoch
	// Default unit millisecond
	TIMESTAMP

	// TIME32 is a signed 32-bit integer, representing either seconds or
	// milliseconds since midnight
	TIME32

	// TIME64 is a signed 64-bit integer, representing either microseconds or
	// nanoseconds since midnight
	TIME64

	// INTERVAL_MONTHS is YEAR_MONTH interval in SQL style
	INTERVAL_MONTHS

	// INTERVAL_DAY_TIME is DAY_TIME in SQL Style
	INTERVAL_DAY_TIME

	// DECIMAL128 is a precision- and scale-based decimal type. Storage type depends on the
	// parameters.
	DECIMAL128

	// DECIMAL256 is a precision and scale based decimal type, with 256 bit max.
	DECIMAL256

	// LIST is a list of some logical data type
	LIST

	// STRUCT of logical types
	STRUCT

	// SPARSE_UNION of logical types
	SPARSE_UNION

	// DENSE_UNION of logical types
	DENSE_UNION

	// DICTIONARY aka Category type
	DICTIONARY

	// MAP is a repeated struct logical type
	MAP

	// Custom data type, implemented by user
	EXTENSION

	// Fixed size list of some logical type
	FIXED_SIZE_LIST

	// Measure of elapsed time in either seconds, milliseconds, microseconds
	// or nanoseconds.
	DURATION

	// like STRING, but 64-bit offsets
	LARGE_STRING

	// like BINARY but with 64-bit offsets
	LARGE_BINARY

	// like LIST but with 64-bit offsets
	LARGE_LIST

	// calendar interval with three fields
	INTERVAL_MONTH_DAY_NANO

	RUN_END_ENCODED

	// String (UTF8) view type with 4-byte prefix and inline
	// small string optimizations
	STRING_VIEW

	// Bytes view with 4-byte prefix and inline small byte arrays optimization
	BINARY_VIEW

	// LIST_VIEW is a list of some logical data type represented with offsets and sizes
	LIST_VIEW

	// like LIST but with 64-bit offsets
	LARGE_LIST_VIEW

	// Decimal value with 32-bit representation
	DECIMAL32

	// Decimal value with 64-bit representation
	DECIMAL64

	// Alias to ensure we do not break any consumers
	DECIMAL = DECIMAL128
)

// DataType is the representation of an Arrow type.
type DataType interface {
	fmt.Stringer
	ID() Type
	// Name is name of the data type.
	Name() string
	Fingerprint() string
	Layout() DataTypeLayout
}

// TypesToString is a convenience function to create a list of types
// which are comma delimited as a string
func TypesToString(types []DataType) string {
	var b strings.Builder
	b.WriteByte('(')
	for i, t := range types {
		if i != 0 {
			b.WriteString(", ")
		}
		b.WriteString(t.String())
	}
	b.WriteByte(')')
	return b.String()
}

// FixedWidthDataType is the representation of an Arrow type that
// requires a fixed number of bits in memory for each element.
type FixedWidthDataType interface {
	DataType
	// BitWidth returns the number of bits required to store a single element of this data type in memory.
	BitWidth() int
	// Bytes returns the number of bytes required to store a single element of this data type in memory.
	Bytes() int
}

type BinaryDataType interface {
	DataType
	IsUtf8() bool
	binary()
}

type BinaryViewDataType interface {
	BinaryDataType
	view()
}

type OffsetsDataType interface {
	DataType
	OffsetTypeTraits() OffsetTraits
}

func HashType(seed maphash.Seed, dt DataType) uint64 {
	var h maphash.Hash
	h.SetSeed(seed)
	h.WriteString(dt.Fingerprint())
	return h.Sum64()
}

func typeIDFingerprint(id Type) string {
	c := string(rune(int(id) + int('A')))
	return "@" + c
}

func typeFingerprint(typ DataType) string { return typeIDFingerprint(typ.ID()) }

func timeUnitFingerprint(unit TimeUnit) rune {
	switch unit {
	case Second:
		return 's'
	case Millisecond:
		return 'm'
	case Microsecond:
		return 'u'
	case Nanosecond:
		return 'n'
	default:
		debug.Assert(false, "unexpected time unit")
		return rune(0)
	}
}

// BufferKind describes the type of buffer expected when defining a layout specification
type BufferKind int8

// The expected types of buffers
const (
	KindFixedWidth BufferKind = iota
	KindVarWidth
	KindBitmap
	KindAlwaysNull
)

// BufferSpec provides a specification for the buffers of a particular datatype
type BufferSpec struct {
	Kind      BufferKind
	ByteWidth int // for KindFixedWidth
}

func (b BufferSpec) Equals(other BufferSpec) bool {
	return b.Kind == other.Kind && (b.Kind != KindFixedWidth || b.ByteWidth == other.ByteWidth)
}

// DataTypeLayout represents the physical layout of a datatype's buffers including
// the number of and types of those binary buffers. This will correspond
// with the buffers in the ArrayData for an array of that type.
type DataTypeLayout struct {
	Buffers []BufferSpec
	HasDict bool
	// VariadicSpec is what the buffers beyond len(Buffers) are expected to conform to.
	VariadicSpec *BufferSpec
}

func SpecFixedWidth(w int) BufferSpec { return BufferSpec{KindFixedWidth, w} }
func SpecVariableWidth() BufferSpec   { return BufferSpec{KindVarWidth, -1} }
func SpecBitmap() BufferSpec          { return BufferSpec{KindBitmap, -1} }
func SpecAlwaysNull() BufferSpec      { return BufferSpec{KindAlwaysNull, -1} }

// IsInteger is a helper to return true if the type ID provided is one of the
// integral types of uint or int with the varying sizes.
func IsInteger(t Type) bool {
	switch t {
	case UINT8, INT8, UINT16, INT16, UINT32, INT32, UINT64, INT64:
		return true
	}
	return false
}

// IsUnsignedInteger is a helper that returns true if the type ID provided is
// one of the uint integral types (uint8, uint16, uint32, uint64)
func IsUnsignedInteger(t Type) bool {
	switch t {
	case UINT8, UINT16, UINT32, UINT64:
		return true
	}
	return false
}

// IsSignedInteger is a helper that returns true if the type ID provided is
// one of the int integral types (int8, int16, int32, int64)
func IsSignedInteger(t Type) bool {
	switch t {
	case INT8, INT16, INT32, INT64:
		return true
	}
	return false
}

// IsFloating is a helper that returns true if the type ID provided is
// one of Float16, Float32, or Float64
func IsFloating(t Type) bool {
	switch t {
	case FLOAT16, FLOAT32, FLOAT64:
		return true
	}
	return false
}

// IsPrimitive returns true if the provided type ID represents a fixed width
// primitive type.
func IsPrimitive(t Type) bool {
	switch t {
	case BOOL, UINT8, INT8, UINT16, INT16, UINT32, INT32, UINT64, INT64,
		FLOAT16, FLOAT32, FLOAT64, DATE32, DATE64, TIME32, TIME64, TIMESTAMP,
		DURATION, INTERVAL_MONTHS, INTERVAL_DAY_TIME, INTERVAL_MONTH_DAY_NANO:
		return true
	}
	return false
}

// IsBaseBinary returns true for Binary/String and their LARGE variants
func IsBaseBinary(t Type) bool {
	switch t {
	case BINARY, STRING, LARGE_BINARY, LARGE_STRING:
		return true
	}
	return false
}

// IsBinaryLike returns true for only BINARY and STRING
func IsBinaryLike(t Type) bool {
	switch t {
	case BINARY, STRING:
		return true
	}
	return false
}

// IsLargeBinaryLike returns true for only LARGE_BINARY and LARGE_STRING
func IsLargeBinaryLike(t Type) bool {
	switch t {
	case LARGE_BINARY, LARGE_STRING:
		return true
	}
	return false
}

// IsFixedSizeBinary returns true for Decimal32/64/128/256 and FixedSizeBinary
func IsFixedSizeBinary(t Type) bool {
	switch t {
	case DECIMAL32, DECIMAL64, DECIMAL128, DECIMAL256, FIXED_SIZE_BINARY:
		return true
	}
	return false
}

// IsDecimal returns true for Decimal128 and Decimal256
func IsDecimal(t Type) bool {
	switch t {
	case DECIMAL32, DECIMAL64, DECIMAL128, DECIMAL256:
		return true
	}
	return false
}

// IsUnion returns true for Sparse and Dense Unions
func IsUnion(t Type) bool {
	switch t {
	case DENSE_UNION, SPARSE_UNION:
		return true
	}
	return false
}

// IsListLike returns true for List, LargeList, FixedSizeList, and Map
func IsListLike(t Type) bool {
	switch t {
	case LIST, LARGE_LIST, FIXED_SIZE_LIST, MAP:
		return true
	}
	return false
}

// IsNested returns true for List, LargeList, FixedSizeList, Map, Struct, and Unions
func IsNested(t Type) bool {
	switch t {
	case LIST, LARGE_LIST, FIXED_SIZE_LIST, MAP, LIST_VIEW, LARGE_LIST_VIEW, STRUCT, SPARSE_UNION, DENSE_UNION:
		return true
	}
	return false
}
