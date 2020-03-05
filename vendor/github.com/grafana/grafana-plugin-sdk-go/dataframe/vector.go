package dataframe

import (
	"fmt"
	"time"
)

// Vector represents a collection of Elements.
type Vector interface {
	Set(idx int, i interface{})
	Append(i interface{})
	Extend(i int)
	At(i int) interface{}
	Len() int
	PrimitiveType() VectorPType
	PointerAt(i int) interface{}
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


// ValidVectorType returns if a primitive slice is a valid / supported Vector type
func ValidVectorType(t interface{}) bool {
	switch t.(type) {
	// ints
	case []int8:
		return true
	case []*int8:
		return true
	case []int16:
		return true
	case []*int16:
		return true
	case []int32:
		return true
	case []*int32:
		return true
	case []int64:
		return true
	case []*int64:
		return true

	// uints
	case []uint8:
		return true
	case []*uint8:
		return true
	case []uint16:
		return true
	case []*uint16:
		return true
	case []uint32:
		return true
	case []*uint32:
		return true
	case []uint64:
		return true
	case []*uint64:
		return true

	// floats
	case []float32:
		return true
	case []*float32:
		return true
	case []float64:
		return true
	case []*float64:
		return true

	case []string:
		return true
	case []*string:
		return true
	case []bool:
		return true
	case []*bool:
		return true
	case []time.Time:
		return true
	case []*time.Time:
		return true
	default:
		return false
	}
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

func pTypeFromVal(v interface{}) VectorPType {
	switch v.(type) {
	case int8:
		return VectorPTypeInt8
	case *int8:
		return VectorPTypeNullableInt8

	case int16:
		return VectorPTypeInt16
	case *int16:
		return VectorPTypeNullableInt16

	case int32:
		return VectorPTypeInt32
	case *int32:
		return VectorPTypeNullableInt32

	case int64:
		return VectorPTypeInt64
	case *int64:
		return VectorPTypeNullableInt64

	case uint8:
		return VectorPTypeUint8
	case *uint8:
		return VectorPTypeNullableUint8

	case uint16:
		return VectorPTypeUint16
	case *uint16:
		return VectorPTypeNullableUint16

	case uint32:
		return VectorPTypeUint32
	case *uint32:
		return VectorPTypeNullableUint32

	case uint64:
		return VectorPTypeUint64
	case *uint64:
		return VectorPTypeNullableUint64

	case float32:
		return VectorPTypeFloat32
	case *float32:
		return VectorPTypeNullableFloat32

	case float64:
		return VectorPTypeFloat64
	case *float64:
		return VectorPTypeNullableFloat64

	case string:
		return VectorPTypeString
	case *string:
		return VectorPTypeNullableString

	case bool:
		return VectorPTypeBool
	case *bool:
		return VectorPTypeNullableBool

	case time.Time:
		return VectorPTypeTime
	case *time.Time:
		return VectorPTypeNullableTime
	}
	return VectorPType(-1)
}

func (p VectorPType) String() string {
	if p < 0 {
		return "invalid/unsupported"
	}
	return fmt.Sprintf("[]%v", p.ItemTypeString())

}

// ItemTypeString returns the string representation of the type of element within in the vector
func (p VectorPType) ItemTypeString() string {
	switch p {
	case VectorPTypeInt8:
		return "int8"
	case VectorPTypeNullableInt8:
		return "*int8"

	case VectorPTypeInt16:
		return "int16"
	case VectorPTypeNullableInt16:
		return "*int16"

	case VectorPTypeInt32:
		return "int32"
	case VectorPTypeNullableInt32:
		return "*int32"

	case VectorPTypeInt64:
		return "int64"
	case VectorPTypeNullableInt64:
		return "*int64"

	case VectorPTypeUint8:
		return "unit8"
	case VectorPTypeNullableUint8:
		return "*uint8"

	case VectorPTypeUint16:
		return "uint16"
	case VectorPTypeNullableUint16:
		return "*uint16"

	case VectorPTypeUint32:
		return "uint32"
	case VectorPTypeNullableUint32:
		return "*uint32"

	case VectorPTypeUint64:
		return "uint64"
	case VectorPTypeNullableUint64:
		return "*uint64"

	case VectorPTypeFloat32:
		return "float32"
	case VectorPTypeNullableFloat32:
		return "*float32"

	case VectorPTypeFloat64:
		return "float64"
	case VectorPTypeNullableFloat64:
		return "*float64"

	case VectorPTypeString:
		return "string"
	case VectorPTypeNullableString:
		return "*string"

	case VectorPTypeBool:
		return "bool"
	case VectorPTypeNullableBool:
		return "*bool"

	case VectorPTypeTime:
		return "time.Time"
	case VectorPTypeNullableTime:
		return "*time.Time"
	}
	return "invalid/unsupported type"
}

// Nullable returns if type is a nullable type
func (p VectorPType) Nullable() bool {
	switch p {
	case VectorPTypeNullableInt8, VectorPTypeNullableInt16, VectorPTypeNullableInt32, VectorPTypeNullableInt64:
		return true

	case VectorPTypeNullableUint8, VectorPTypeNullableUint16, VectorPTypeNullableUint32, VectorPTypeNullableUint64:
		return true

	case VectorPTypeNullableFloat32, VectorPTypeNullableFloat64:
		return true

	case VectorPTypeNullableString:
		return true

	case VectorPTypeNullableBool:
		return true

	case VectorPTypeNullableTime:
		return true
	}
	return false
}
