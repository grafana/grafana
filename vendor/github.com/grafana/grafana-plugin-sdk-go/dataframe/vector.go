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
	//buildArrowColumn(pool memory.Allocator, field arrow.Field) *array.Column
}

func newVector(t interface{}, n int) (v Vector) {
	switch t.(type) {
	// ints
	case []int8:
		v = newInt8Vector(n)
	case []*int8:
		v = newNullableInt8Vector(n)
	case []int16:
		v = newInt16Vector(n)
	case []*int16:
		v = newNullableInt16Vector(n)
	case []int32:
		v = newInt32Vector(n)
	case []*int32:
		v = newNullableInt32Vector(n)
	case []int64:
		v = newInt64Vector(n)
	case []*int64:
		v = newNullableInt64Vector(n)

	// uints
	case []uint8:
		v = newUint8Vector(n)
	case []*uint8:
		v = newNullableUint8Vector(n)
	case []uint16:
		v = newUint16Vector(n)
	case []*uint16:
		v = newNullableUint16Vector(n)
	case []uint32:
		v = newUint32Vector(n)
	case []*uint32:
		v = newNullableUint32Vector(n)
	case []uint64:
		v = newUint64Vector(n)
	case []*uint64:
		v = newNullableUint64Vector(n)

	// floats
	case []float32:
		v = newFloat32Vector(n)
	case []*float32:
		v = newNullableFloat32Vector(n)
	case []float64:
		v = newFloat64Vector(n)
	case []*float64:
		v = newNullableFloat64Vector(n)

	case []string:
		v = newStringVector(n)
	case []*string:
		v = newNullableStringVector(n)
	case []bool:
		v = newBoolVector(n)
	case []*bool:
		v = newNullableBoolVector(n)
	case []time.Time:
		v = newTimeTimeVector(n)
	case []*time.Time:
		v = newNullableTimeTimeVector(n)
	default:
		panic(fmt.Sprintf("unsupported vector type of %T", t))
	}
	return
}

// VectorPType indicates the go type underlying the Vector.
type VectorPType int

const (
	// VectorPTypeInt8 indicates the underlying primitive is a []int8.
	VectorPTypeInt8 VectorPType = iota
	// VectorPTypeNullableInt8 indicates the underlying primitive is a []*int8.
	VectorPTypeNullableInt8

	// VectorPTypeInt16 indicates the underlying primitive is a []Int16.
	VectorPTypeInt16
	// VectorPTypeNullableInt16 indicates the underlying primitive is a []*Int16.
	VectorPTypeNullableInt16

	// VectorPTypeInt32 indicates the underlying primitive is a []int32.
	VectorPTypeInt32
	// VectorPTypeNullableInt32 indicates the underlying primitive is a []*int32.
	VectorPTypeNullableInt32

	// VectorPTypeInt64 indicates the underlying primitive is a []int64.
	VectorPTypeInt64
	// VectorPTypeNullableInt64 indicates the underlying primitive is a []*int64.
	VectorPTypeNullableInt64

	// VectorPTypeUint8 indicates the underlying primitive is a []int8.
	VectorPTypeUint8
	// VectorPTypeNullableUint8 indicates the underlying primitive is a []*int8.
	VectorPTypeNullableUint8

	// VectorPTypeUint16 indicates the underlying primitive is a []uint16.
	VectorPTypeUint16
	// VectorPTypeNullableUint16 indicates the underlying primitive is a []*uint16.
	VectorPTypeNullableUint16

	// VectorPTypeUint32 indicates the underlying primitive is a []uint32.
	VectorPTypeUint32
	// VectorPTypeNullableUint32 indicates the underlying primitive is a []*uint32.
	VectorPTypeNullableUint32

	// VectorPTypeUint64 indicates the underlying primitive is a []uint64.
	VectorPTypeUint64
	// VectorPTypeNullableUint64 indicates the underlying primitive is a []*uint64.
	VectorPTypeNullableUint64

	// VectorPTypeFloat32 indicates the underlying primitive is a []float32.
	VectorPTypeFloat32
	// VectorPTypeNullableFloat32 indicates the underlying primitive is a []*float32.
	VectorPTypeNullableFloat32

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

func vectorPType(v Vector) VectorPType {
	switch v.(type) {
	case *int8Vector:
		return VectorPTypeInt8
	case *nullableInt8Vector:
		return VectorPTypeNullableInt8

	case *int16Vector:
		return VectorPTypeInt16
	case *nullableInt16Vector:
		return VectorPTypeNullableInt16

	case *int32Vector:
		return VectorPTypeInt32
	case *nullableInt32Vector:
		return VectorPTypeNullableInt32

	case *int64Vector:
		return VectorPTypeInt64
	case *nullableInt64Vector:
		return VectorPTypeNullableInt64

	case *uint8Vector:
		return VectorPTypeUint8
	case *nullableUint8Vector:
		return VectorPTypeNullableUint8

	case *uint16Vector:
		return VectorPTypeUint16
	case *nullableUint16Vector:
		return VectorPTypeNullableUint16

	case *uint32Vector:
		return VectorPTypeUint32
	case *nullableUint32Vector:
		return VectorPTypeNullableUint32

	case *uint64Vector:
		return VectorPTypeUint64
	case *nullableUint64Vector:
		return VectorPTypeNullableUint64

	case *float32Vector:
		return VectorPTypeFloat32
	case *nullableFloat32Vector:
		return VectorPTypeNullableFloat32

	case *float64Vector:
		return VectorPTypeFloat64
	case *nullableFloat64Vector:
		return VectorPTypeNullableFloat64

	case *stringVector:
		return VectorPTypeString
	case *nullableStringVector:
		return VectorPTypeNullableString

	case *boolVector:
		return VectorPTypeBool
	case *nullableBoolVector:
		return VectorPTypeNullableBool

	case *timeTimeVector:
		return VectorPTypeTime
	case *nullableTimeTimeVector:
		return VectorPTypeNullableTime
	}

	return VectorPType(-1)
}
