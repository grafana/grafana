package data

import (
	"fmt"
)

// vector represents a Field's collection of Elements.
type vector interface {
	Set(idx int, i interface{})
	Append(i interface{})
	Extend(i int)
	At(i int) interface{}
	NilAt(i int) bool
	Len() int
	Type() FieldType
	PointerAt(i int) interface{}
	CopyAt(i int) interface{}
	ConcreteAt(i int) (val interface{}, ok bool)
	SetConcrete(i int, val interface{})
	Insert(i int, val interface{})
	Delete(i int)
}

// nolint:gocyclo
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
	case *jsonRawMessageVector:
		return FieldTypeJSON
	case *nullableJsonRawMessageVector:
		return FieldTypeNullableJSON
	case *enumVector:
		return FieldTypeEnum
	case *nullableEnumVector:
		return FieldTypeNullableEnum
	}

	return FieldTypeUnknown
}

func (p FieldType) String() string {
	if p <= 0 {
		return "invalid/unsupported"
	}
	return fmt.Sprintf("[]%v", p.ItemTypeString())
}

// NewFieldFromFieldType creates a new Field of the given FieldType of length n.
// nolint:gocyclo
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

	case FieldTypeJSON:
		f.vector = newJsonRawMessageVector(n)
	case FieldTypeNullableJSON:
		f.vector = newNullableJsonRawMessageVector(n)

	case FieldTypeEnum:
		f.vector = newEnumVector(n)
	case FieldTypeNullableEnum:
		f.vector = newNullableEnumVector(n)
	default:
		panic("unsupported FieldType")
	}
	return f
}
