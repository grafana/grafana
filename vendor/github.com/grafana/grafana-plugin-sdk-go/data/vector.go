package data

import (
	"fmt"
	"time"
)

// vector represents a Field's collection of Elements.
type vector interface {
	Set(idx int, i interface{})
	Append(i interface{})
	Extend(i int)
	At(i int) interface{}
	Len() int
	Type() FieldType
	PointerAt(i int) interface{}
	CopyAt(i int) interface{}
	ConcreteAt(i int) (val interface{}, ok bool)
	SetConcrete(i int, val interface{})
	Insert(i int, val interface{})
	Delete(i int)
}

func newVector(t interface{}, n int) (v vector) {
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
	return v
}

// ValidFieldType returns if a primitive slice is a valid supported Field type.
func ValidFieldType(t interface{}) bool {
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

// FieldType indicates the Go type underlying the Field.
type FieldType int

const (
	// FieldTypeInt8 indicates the underlying primitive is a []int8.
	FieldTypeInt8 FieldType = iota
	// FieldTypeNullableInt8 indicates the underlying primitive is a []*int8.
	FieldTypeNullableInt8

	// FieldTypeInt16 indicates the underlying primitive is a []Int16.
	FieldTypeInt16
	// FieldTypeNullableInt16 indicates the underlying primitive is a []*Int16.
	FieldTypeNullableInt16

	// FieldTypeInt32 indicates the underlying primitive is a []int32.
	FieldTypeInt32
	// FieldTypeNullableInt32 indicates the underlying primitive is a []*int32.
	FieldTypeNullableInt32

	// FieldTypeInt64 indicates the underlying primitive is a []int64.
	FieldTypeInt64
	// FieldTypeNullableInt64 indicates the underlying primitive is a []*int64.
	FieldTypeNullableInt64

	// FieldTypeUint8 indicates the underlying primitive is a []int8.
	FieldTypeUint8
	// FieldTypeNullableUint8 indicates the underlying primitive is a []*int8.
	FieldTypeNullableUint8

	// FieldTypeUint16 indicates the underlying primitive is a []uint16.
	FieldTypeUint16
	// FieldTypeNullableUint16 indicates the underlying primitive is a []*uint16.
	FieldTypeNullableUint16

	// FieldTypeUint32 indicates the underlying primitive is a []uint32.
	FieldTypeUint32
	// FieldTypeNullableUint32 indicates the underlying primitive is a []*uint32.
	FieldTypeNullableUint32

	// FieldTypeUint64 indicates the underlying primitive is a []uint64.
	FieldTypeUint64
	// FieldTypeNullableUint64 indicates the underlying primitive is a []*uint64.
	FieldTypeNullableUint64

	// FieldTypeFloat32 indicates the underlying primitive is a []float32.
	FieldTypeFloat32
	// FieldTypeNullableFloat32 indicates the underlying primitive is a []*float32.
	FieldTypeNullableFloat32

	// FieldTypeFloat64 indicates the underlying primitive is a []float64.
	FieldTypeFloat64
	// FieldTypeNullableFloat64 indicates the underlying primitive is a []*float64.
	FieldTypeNullableFloat64

	// FieldTypeString indicates the underlying primitive is a []string.
	FieldTypeString
	// FieldTypeNullableString indicates the underlying primitive is a []*string.
	FieldTypeNullableString

	// FieldTypeBool indicates the underlying primitive is a []bool.
	FieldTypeBool
	// FieldTypeNullableBool indicates the underlying primitive is a []*bool.
	FieldTypeNullableBool

	// FieldTypeTime indicates the underlying primitive is a []time.Time.
	FieldTypeTime
	// FieldTypeNullableTime indicates the underlying primitive is a []*time.Time.
	FieldTypeNullableTime
)

func vectorFieldType(v vector) FieldType {
	switch v.(type) {
	case *int8Vector:
		return FieldTypeInt8
	case *nullableInt8Vector:
		return FieldTypeNullableInt8

	case *int16Vector:
		return FieldTypeInt16
	case *nullableInt16Vector:
		return FieldTypeNullableInt16

	case *int32Vector:
		return FieldTypeInt32
	case *nullableInt32Vector:
		return FieldTypeNullableInt32

	case *int64Vector:
		return FieldTypeInt64
	case *nullableInt64Vector:
		return FieldTypeNullableInt64

	case *uint8Vector:
		return FieldTypeUint8
	case *nullableUint8Vector:
		return FieldTypeNullableUint8

	case *uint16Vector:
		return FieldTypeUint16
	case *nullableUint16Vector:
		return FieldTypeNullableUint16

	case *uint32Vector:
		return FieldTypeUint32
	case *nullableUint32Vector:
		return FieldTypeNullableUint32

	case *uint64Vector:
		return FieldTypeUint64
	case *nullableUint64Vector:
		return FieldTypeNullableUint64

	case *float32Vector:
		return FieldTypeFloat32
	case *nullableFloat32Vector:
		return FieldTypeNullableFloat32

	case *float64Vector:
		return FieldTypeFloat64
	case *nullableFloat64Vector:
		return FieldTypeNullableFloat64

	case *stringVector:
		return FieldTypeString
	case *nullableStringVector:
		return FieldTypeNullableString

	case *boolVector:
		return FieldTypeBool
	case *nullableBoolVector:
		return FieldTypeNullableBool

	case *timeTimeVector:
		return FieldTypeTime
	case *nullableTimeTimeVector:
		return FieldTypeNullableTime
	}

	return FieldType(-1)
}

func (p FieldType) String() string {
	if p < 0 {
		return "invalid/unsupported"
	}
	return fmt.Sprintf("[]%v", p.ItemTypeString())
}

// NewFieldFromFieldType creates a new Field of the given FieldType of length n.
func NewFieldFromFieldType(p FieldType, n int) *Field {
	f := &Field{}
	switch p {
	// ints
	case FieldTypeInt8:
		f.vector = newInt8Vector(n)
	case FieldTypeNullableInt8:
		f.vector = newNullableInt8Vector(n)

	case FieldTypeInt16:
		f.vector = newInt16Vector(n)
	case FieldTypeNullableInt16:
		f.vector = newNullableInt16Vector(n)

	case FieldTypeInt32:
		f.vector = newInt32Vector(n)
	case FieldTypeNullableInt32:
		f.vector = newNullableInt32Vector(n)

	case FieldTypeInt64:
		f.vector = newInt64Vector(n)
	case FieldTypeNullableInt64:
		f.vector = newNullableInt64Vector(n)

	// uints
	case FieldTypeUint8:
		f.vector = newUint8Vector(n)
	case FieldTypeNullableUint8:
		f.vector = newNullableUint8Vector(n)

	case FieldTypeUint16:
		f.vector = newUint16Vector(n)
	case FieldTypeNullableUint16:
		f.vector = newNullableUint16Vector(n)

	case FieldTypeUint32:
		f.vector = newUint32Vector(n)
	case FieldTypeNullableUint32:
		f.vector = newNullableUint32Vector(n)

	case FieldTypeUint64:
		f.vector = newUint64Vector(n)
	case FieldTypeNullableUint64:
		f.vector = newNullableUint64Vector(n)

	// floats
	case FieldTypeFloat32:
		f.vector = newFloat32Vector(n)
	case FieldTypeNullableFloat32:
		f.vector = newNullableFloat32Vector(n)

	case FieldTypeFloat64:
		f.vector = newFloat64Vector(n)
	case FieldTypeNullableFloat64:
		f.vector = newNullableFloat64Vector(n)

	// other
	case FieldTypeString:
		f.vector = newStringVector(n)
	case FieldTypeNullableString:
		f.vector = newNullableStringVector(n)

	case FieldTypeBool:
		f.vector = newBoolVector(n)
	case FieldTypeNullableBool:
		f.vector = newNullableBoolVector(n)

	case FieldTypeTime:
		f.vector = newTimeTimeVector(n)
	case FieldTypeNullableTime:
		f.vector = newNullableTimeTimeVector(n)
	default:
		panic("unsupported FieldType")
	}
	return f
}

// NullableType converts the FieldType to the corresponding nullable type.
func (p FieldType) NullableType() FieldType {
	switch p {
	// ints
	case FieldTypeInt8, FieldTypeNullableInt8:
		return FieldTypeNullableInt8

	case FieldTypeInt16, FieldTypeNullableInt16:
		return FieldTypeNullableInt16

	case FieldTypeInt32, FieldTypeNullableInt32:
		return FieldTypeNullableInt32

	case FieldTypeInt64, FieldTypeNullableInt64:
		return FieldTypeNullableInt64

	// uints
	case FieldTypeUint8, FieldTypeNullableUint8:
		return FieldTypeNullableUint8

	case FieldTypeUint16, FieldTypeNullableUint16:
		return FieldTypeNullableUint16

	case FieldTypeUint32, FieldTypeNullableUint32:
		return FieldTypeNullableUint32

	case FieldTypeUint64, FieldTypeNullableUint64:
		return FieldTypeNullableUint64

	// floats
	case FieldTypeFloat32, FieldTypeNullableFloat32:
		return FieldTypeNullableFloat32

	case FieldTypeFloat64, FieldTypeNullableFloat64:
		return FieldTypeNullableFloat64

	// other
	case FieldTypeString, FieldTypeNullableString:
		return FieldTypeNullableString

	case FieldTypeBool, FieldTypeNullableBool:
		return FieldTypeNullableBool

	case FieldTypeTime, FieldTypeNullableTime:
		return FieldTypeNullableTime
	default:
		panic(fmt.Sprintf("unsupported vector ptype: %+v", p))
	}
}

// ItemTypeString returns the string representation of the type of element within in the vector
func (p FieldType) ItemTypeString() string {
	switch p {
	case FieldTypeInt8:
		return "int8"
	case FieldTypeNullableInt8:
		return "*int8"

	case FieldTypeInt16:
		return "int16"
	case FieldTypeNullableInt16:
		return "*int16"

	case FieldTypeInt32:
		return "int32"
	case FieldTypeNullableInt32:
		return "*int32"

	case FieldTypeInt64:
		return "int64"
	case FieldTypeNullableInt64:
		return "*int64"

	case FieldTypeUint8:
		return "unit8"
	case FieldTypeNullableUint8:
		return "*uint8"

	case FieldTypeUint16:
		return "uint16"
	case FieldTypeNullableUint16:
		return "*uint16"

	case FieldTypeUint32:
		return "uint32"
	case FieldTypeNullableUint32:
		return "*uint32"

	case FieldTypeUint64:
		return "uint64"
	case FieldTypeNullableUint64:
		return "*uint64"

	case FieldTypeFloat32:
		return "float32"
	case FieldTypeNullableFloat32:
		return "*float32"

	case FieldTypeFloat64:
		return "float64"
	case FieldTypeNullableFloat64:
		return "*float64"

	case FieldTypeString:
		return "string"
	case FieldTypeNullableString:
		return "*string"

	case FieldTypeBool:
		return "bool"
	case FieldTypeNullableBool:
		return "*bool"

	case FieldTypeTime:
		return "time.Time"
	case FieldTypeNullableTime:
		return "*time.Time"
	}
	return "invalid/unsupported type"
}

// Nullable returns if Field type is a nullable type
func (p FieldType) Nullable() bool {
	switch p {
	case FieldTypeNullableInt8, FieldTypeNullableInt16, FieldTypeNullableInt32, FieldTypeNullableInt64:
		return true

	case FieldTypeNullableUint8, FieldTypeNullableUint16, FieldTypeNullableUint32, FieldTypeNullableUint64:
		return true

	case FieldTypeNullableFloat32, FieldTypeNullableFloat64:
		return true

	case FieldTypeNullableString:
		return true

	case FieldTypeNullableBool:
		return true

	case FieldTypeNullableTime:
		return true
	}
	return false
}

// Numeric returns if Field type is a nullable type.
func (p FieldType) Numeric() bool {
	switch p {
	case FieldTypeInt8, FieldTypeInt16, FieldTypeInt32, FieldTypeInt64:
		return true
	case FieldTypeNullableInt8, FieldTypeNullableInt16, FieldTypeNullableInt32, FieldTypeNullableInt64:
		return true

	case FieldTypeUint8, FieldTypeUint16, FieldTypeUint32, FieldTypeUint64:
		return true
	case FieldTypeNullableUint8, FieldTypeNullableUint16, FieldTypeNullableUint32, FieldTypeNullableUint64:
		return true

	case FieldTypeFloat32, FieldTypeFloat64:
		return true
	case FieldTypeNullableFloat32, FieldTypeNullableFloat64:
		return true
	}
	return false
}

// Time returns if Field type is a time type (FieldTypeTime or FieldTypeNullableTime).
func (p FieldType) Time() bool {
	return p == FieldTypeTime || p == FieldTypeNullableTime
}

// numericFieldTypes is an array of FieldTypes that are numeric.
var numericFieldTypes = [...]FieldType{
	FieldTypeInt8, FieldTypeInt16, FieldTypeInt32, FieldTypeInt64,
	FieldTypeNullableInt8, FieldTypeNullableInt16, FieldTypeNullableInt32, FieldTypeNullableInt64,

	FieldTypeUint8, FieldTypeUint16, FieldTypeUint32, FieldTypeUint64,
	FieldTypeNullableUint8, FieldTypeNullableUint16, FieldTypeNullableUint32, FieldTypeNullableUint64,

	FieldTypeFloat32, FieldTypeFloat64,
	FieldTypeNullableFloat32, FieldTypeNullableFloat64}

// NumericFieldTypes returns a slice of FieldTypes that are numeric.
func NumericFieldTypes() []FieldType {
	return numericFieldTypes[:]
}
