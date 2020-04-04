package data

import (
	"fmt"
	"math"
	"strconv"
	"time"
)

// Field represents a typed column of data within a Frame.
// The data in the Field is a not exported, so methods on the Field are used to to manipulate its data.
type Field struct {
	Name   string
	Config *FieldConfig
	vector vector
	Labels Labels
}

// Fields is a slice of Field pointers.
type Fields []*Field

// NewField returns a instance of *Field.
//
// Supported types for values are: []int8, []*int8, []int16, []*int16, []int32, []*int32, []int64, []*int64,
// []uint8, []*uint8, []uint16, []*uint16, []uint32, []*uint32, []uint64, []*uint64,
// []float32, []*float32, []float64, []*float64,
// []string, []*string, []bool, []*bool, []time.Time, and []*time.Time.
//
// If an unsupported values type is passed, NewField will panic.
func NewField(name string, labels Labels, values interface{}) *Field {
	var vec vector
	switch v := values.(type) {
	case []int8:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*int8:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []int16:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*int16:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []int32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*int32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []int64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*int64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []uint8:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*uint8:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []uint16:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*uint16:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []uint32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*uint32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []uint64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*uint64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []float32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*float32:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []float64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*float64:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []string:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*string:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []bool:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*bool:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []time.Time:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	case []*time.Time:
		vec = newVector(v, len(v))
		for i := 0; i < len(v); i++ {
			vec.Set(i, v[i])
		}
	default:
		panic(fmt.Errorf("unsupported field type %T", v))
	}

	return &Field{
		Name:   name,
		vector: vec,
		Labels: labels,
	}
}

// Set sets the Field's value at index idx to val.
// It will panic if idx is out of range.
func (f *Field) Set(idx int, val interface{}) {
	f.vector.Set(idx, val)
}

// Append appends element i to the Field.
func (f *Field) Append(i interface{}) {
	f.vector.Append(i)
}

// Extend extends the Field length by i.
func (f *Field) Extend(i int) {
	f.vector.Extend(i)
}

// At returns the the element at index idx of the Field.
// It will panic if idx is out of range.
func (f *Field) At(idx int) interface{} {
	return f.vector.At(idx)
}

// Len returns the number of elements in the Field.
func (f *Field) Len() int {
	return f.vector.Len()
}

// Type returns the underlying primitive type of the Field.
func (f *Field) Type() FieldType {
	return f.vector.Type()
}

// PointerAt returns a pointer to the value at idx of the Field.
// It will panic if idx is out of range.
func (f *Field) PointerAt(idx int) interface{} {
	return f.vector.PointerAt(idx)
}

// CopyAt returns a copy of the value of the specified index idx.
// It will panic if idx is out of range.
func (f *Field) CopyAt(idx int) interface{} {
	return f.vector.CopyAt(idx)
}

// ConcreteAt returns the concrete value at the specified index idx.
// A non-pointer type is returned regardless if the underlying vector is a pointer
// type or not. If the value is a pointer type, and is nil, then the zero value
// is returned and ok will be false.
func (f *Field) ConcreteAt(idx int) (val interface{}, ok bool) {
	return f.vector.ConcreteAt(idx)
}

// Nullable returns if the the Field's elements are nullable.
func (f *Field) Nullable() bool {
	return f.Type().Nullable()
}

// FloatAt returns a float64 at the specified index idx.
// It will panic if idx is out of range.
// If the Field type is numeric and the value at idx is nil, NaN is returned. Precision may be lost on large numbers.
// If the Field type is a bool then 0 is return if false or nil, and 1 if true.
// If the Field type is time.Time, then the millisecond epoch representation of the time
// is returned, or NaN is the value is nil.
// If the Field type is a string, then strconv.ParseFloat is called on it and will return
// an error if ParseFloat errors. If the value is nil, NaN is returned.
func (f *Field) FloatAt(idx int) (float64, error) {
	switch f.Type() {
	case FieldTypeInt8:
		return float64(f.At(idx).(int8)), nil
	case FieldTypeNullableInt8:
		iv := f.At(idx).(*int8)
		if iv == nil {
			return math.NaN(), nil
		}
		return float64(*iv), nil

	case FieldTypeInt16:
		return float64(f.At(idx).(int16)), nil
	case FieldTypeNullableInt16:
		iv := f.At(idx).(*int16)
		if iv == nil {
			return math.NaN(), nil
		}
		return float64(*iv), nil

	case FieldTypeInt32:
		return float64(f.At(idx).(int32)), nil
	case FieldTypeNullableInt32:
		iv := f.At(idx).(*int32)
		if iv == nil {
			return math.NaN(), nil
		}
		return float64(*iv), nil

	case FieldTypeInt64:
		return float64(f.At(idx).(int64)), nil
	case FieldTypeNullableInt64:
		iv := f.At(idx).(*int64)
		if iv == nil {
			return math.NaN(), nil
		}
		return float64(*iv), nil

	case FieldTypeUint8:
		return float64(f.At(idx).(uint8)), nil
	case FieldTypeNullableUint8:
		uiv := f.At(idx).(*uint8)
		if uiv == nil {
			return math.NaN(), nil
		}
		return float64(*uiv), nil

	case FieldTypeUint16:
		return float64(f.At(idx).(uint16)), nil
	case FieldTypeNullableUint16:
		uiv := f.At(idx).(*uint16)
		if uiv == nil {
			return math.NaN(), nil
		}
		return float64(*uiv), nil

	case FieldTypeUint32:
		return float64(f.At(idx).(uint32)), nil
	case FieldTypeNullableUint32:
		uiv := f.At(idx).(*uint32)
		if uiv == nil {
			return math.NaN(), nil
		}
		return float64(*uiv), nil

	// TODO: third param for loss of precision?
	// Maybe something in math/big can help with this (also see https://github.com/golang/go/issues/29463).
	case FieldTypeUint64:
		return float64(f.At(idx).(uint64)), nil
	case FieldTypeNullableUint64:
		uiv := f.At(idx).(*uint64)
		if uiv == nil {
			return math.NaN(), nil
		}
		return float64(*uiv), nil

	case FieldTypeFloat32:
		return float64(f.At(idx).(float32)), nil
	case FieldTypeNullableFloat32:
		fv := f.At(idx).(*float32)
		if fv == nil {
			return math.NaN(), nil
		}
		return float64(*fv), nil

	case FieldTypeFloat64:
		return f.At(idx).(float64), nil
	case FieldTypeNullableFloat64:
		fv := f.At(idx).(*float64)
		if fv == nil {
			return math.NaN(), nil
		}
		return *fv, nil

	case FieldTypeString:
		s := f.At(idx).(string)
		ft, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return 0, err
		}
		return ft, nil
	case FieldTypeNullableString:
		s := f.At(idx).(*string)
		if s == nil {
			return math.NaN(), nil
		}
		ft, err := strconv.ParseFloat(*s, 64)
		if err != nil {
			return 0, err
		}
		return ft, nil

	case FieldTypeBool:
		if f.At(idx).(bool) {
			return 1, nil
		}
		return 0, nil

	case FieldTypeNullableBool:
		b := f.At(idx).(*bool)
		if b == nil || !*b {
			return 0, nil
		}
		return 1, nil

	case FieldTypeTime:
		return float64(f.At(idx).(time.Time).UnixNano() / int64(time.Millisecond)), nil
	case FieldTypeNullableTime:
		t := f.At(idx).(*time.Time)
		if t == nil {
			return math.NaN(), nil
		}
		return float64(f.At(idx).(*time.Time).UnixNano() / int64(time.Millisecond)), nil
	}
	return 0, fmt.Errorf("unsupported field type %T", f.Type())
}
