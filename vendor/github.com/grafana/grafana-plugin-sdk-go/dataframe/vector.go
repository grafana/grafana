package dataframe

import (
	"fmt"
	"time"
)

// Vector represents a collection of Elements.
type Vector interface {
	Set(idx int, i interface{})
	Append(i interface{})
	At(i int) interface{}
	Len() int
	PrimitiveType() VectorPType
}

func newVector(t interface{}, n int) (v Vector) {
	switch t.(type) {
	case []int64:
		v = newIntVector(n)
	case []*int64:
		v = newNullableIntVector(n)
	case []uint64:
		v = newUintVector(n)
	case []*uint64:
		v = newNullableUintVector(n)
	case []float64:
		v = newFloatVector(n)
	case []*float64:
		v = newNullableFloatVector(n)
	case []string:
		v = newStringVector(n)
	case []*string:
		v = newNullableStringVector(n)
	case []bool:
		v = newBoolVector(n)
	case []*bool:
		v = newNullableBoolVector(n)
	case []time.Time:
		v = newTimeVector(n)
	case []*time.Time:
		v = newNullableTimeVector(n)
	default:
		panic(fmt.Sprintf("unsupported vector type of %T", t))
	}
	return
}

// VectorPType indicates the go type underlying the Vector.
type VectorPType int

const (
	// VectorPTypeInt64 indicates the underlying primitive is a []int64.
	VectorPTypeInt64 VectorPType = iota
	// VectorPTypeNullableInt64 indicates the underlying primitive is a []*int64.
	VectorPTypeNullableInt64

	// VectorPTypeUint64 indicates the underlying primitive is a []uint64.
	VectorPTypeUint64
	// VectorPTypeNullableUInt64 indicates the underlying primitive is a []*uint64.
	VectorPTypeNullableUInt64

	// VectorPTypeFloat64 indicates the underlying primitive is a []float64.
	VectorPTypeFloat64
	// VectorPTypeNullableFloat64 indicates the underlying primitive is a []*float64.
	VectorPTypeNullableFloat64

	// VectorPTypeString indicates the underlying primitive is a []string.
	VectorPTypeString
	// VectorPTypeNullableString indicates the underlying primitive is a []*string.
	VectorPTypeNullableString

	// VectorPTypeBool indicates the underlying primitive is a []bool.
	VectorPTypeBool
	// VectorPTypeNullableBool indicates the underlying primitive is a []*bool.
	VectorPTypeNullableBool

	// VectorPTypeTime indicates the underlying primitive is a []time.Time.
	VectorPTypeTime
	// VectorPTypeNullableTime indicates the underlying primitive is a []*time.Time.
	VectorPTypeNullableTime
)
