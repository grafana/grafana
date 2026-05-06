package data

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"time"
)

// Field represents a typed column of data within a Frame.
//
// A Field is essentially a slice of various types with extra properties and methods.
// See NewField() for supported types.
//
// The slice data in the Field is a not exported, so methods on the Field are used to to manipulate its data.
//
//swagger:model
type Field struct {
	// Name is default identifier of the field. The name does not have to be unique, but the combination
	// of name and Labels should be unique for proper behavior in all situations.
	Name string `json:"name,omitempty"`

	// Labels is an optional set of key=value pairs that in addition to the name, should uniquely
	// identify a Field within a Frame.
	Labels Labels `json:"labels,omitempty"`

	// Config is optional display configuration information for Grafana
	Config *FieldConfig `json:"config,omitempty"`

	// vector is the unexported values. it is unexported so we can change the underlying structure without
	// major breaking changes.
	vector vector
}

// Fields is a slice of Field pointers.
type Fields []*Field

// NewField returns a instance of *Field. Supported types for values are:
//
// Integers:
//
//	[]int8, []*int8, []int16, []*int16, []int32, []*int32, []int64, []*int64
//
// Unsigned Integers:
//
//	[]uint8, []*uint8, []uint16, []*uint16, []uint32, []*uint32, []uint64, []*uint64
//
// Floats:
//
//	[]float32, []*float32, []float64, []*float64
//
// String, Bool, and Time:
//
//	[]string, []*string, []bool, []*bool, []time.Time, and []*time.Time.
//
// JSON:
//
//	[]json.RawMessage, []*json.RawMessage
//
// Enum:
//
//	[]data.EnumItemIndex, []*data.EnumItemIndex
//
// If an unsupported values type is passed, NewField will panic.
// nolint:gocyclo
func NewField(name string, labels Labels, values interface{}) *Field {
	var vec vector
	switch v := values.(type) {
	case []int8:
		vec = newInt8VectorWithValues(v)
	case []*int8:
		vec = newNullableInt8VectorWithValues(v)
	case []int16:
		vec = newInt16VectorWithValues(v)
	case []*int16:
		vec = newNullableInt16VectorWithValues(v)
	case []int32:
		vec = newInt32VectorWithValues(v)
	case []*int32:
		vec = newNullableInt32VectorWithValues(v)
	case []int64:
		vec = newInt64VectorWithValues(v)
	case []*int64:
		vec = newNullableInt64VectorWithValues(v)
	case []uint8:
		vec = newUint8VectorWithValues(v)
	case []*uint8:
		vec = newNullableUint8VectorWithValues(v)
	case []uint16:
		vec = newUint16VectorWithValues(v)
	case []*uint16:
		vec = newNullableUint16VectorWithValues(v)
	case []uint32:
		vec = newUint32VectorWithValues(v)
	case []*uint32:
		vec = newNullableUint32VectorWithValues(v)
	case []uint64:
		vec = newUint64VectorWithValues(v)
	case []*uint64:
		vec = newNullableUint64VectorWithValues(v)
	case []float32:
		vec = newFloat32VectorWithValues(v)
	case []*float32:
		vec = newNullableFloat32VectorWithValues(v)
	case []float64:
		vec = newFloat64VectorWithValues(v)
	case []*float64:
		vec = newNullableFloat64VectorWithValues(v)
	case []string:
		vec = newStringVectorWithValues(v)
	case []*string:
		vec = newNullableStringVectorWithValues(v)
	case []bool:
		vec = newBoolVectorWithValues(v)
	case []*bool:
		vec = newNullableBoolVectorWithValues(v)
	case []time.Time:
		vec = newTimeTimeVectorWithValues(v)
	case []*time.Time:
		vec = newNullableTimeTimeVectorWithValues(v)
	case []json.RawMessage:
		vec = newJsonRawMessageVectorWithValues(v)
	case []*json.RawMessage:
		vec = newNullableJsonRawMessageVectorWithValues(v)
	case []EnumItemIndex:
		vec = newEnumVectorWithValues(v)
	case []*EnumItemIndex:
		vec = newNullableEnumVectorWithValues(v)
	default:
		panic(fmt.Errorf("field '%s' specified with unsupported type %T", name, v))
	}

	return &Field{
		Name:   name,
		vector: vec,
		Labels: labels,
	}
}

// Set sets the Field's value at index idx to val.
// It will panic if idx is out of range or if
// the underlying type of val does not match the element type of the Field.
func (f *Field) Set(idx int, val interface{}) {
	f.vector.Set(idx, val)
}

// SetConcrete sets the Field's value at index idx to val.
// val must be a non-pointer type or a panic will occur.
// If the underlying FieldType is nullable it will set val as a pointer to val. If the FieldType
// is not nullable, then this method behaves the same as the Set method.
// It will panic if the underlying type of val does not match the element concrete type of the Field.
func (f *Field) SetConcrete(idx int, val interface{}) {
	f.vector.SetConcrete(idx, val)
}

// Append appends element e to the Field.
// it will panic if the underlying type of e does not match the element type of the Field.
func (f *Field) Append(e interface{}) {
	f.vector.Append(e)
}

// Extend extends the Field length by i.
// Consider using Frame.Extend() when possible since all Fields within
// a Frame need to be of the same length before marshalling and transmission.
func (f *Field) Extend(i int) {
	f.vector.Extend(i)
}

// At returns the the element at index idx of the Field.
// It will panic if idx is out of range.
func (f *Field) At(idx int) interface{} {
	return f.vector.At(idx)
}

// NilAt returns true if the element at index idx of the Field is nil.
// This is useful since the interface returned by At() will not be nil
// even if the underlying element is nil (without an type assertion).
// It will always return false if the Field is not nullable.
// It can panic if idx is out of range.
func (f *Field) NilAt(idx int) bool {
	return f.vector.NilAt(idx)
}

// Len returns the number of elements in the Field.
// It will return 0 if the field is nil.
func (f *Field) Len() int {
	if f == nil || f.vector == nil {
		return 0
	}
	return f.vector.Len()
}

// Type returns the FieldType of the Field, which indicates what type of slice it is.
func (f *Field) Type() FieldType {
	return f.vector.Type()
}

// PointerAt returns a pointer to the value at idx of the Field.
// It will panic if idx is out of range.
func (f *Field) PointerAt(idx int) interface{} {
	return f.vector.PointerAt(idx)
}

// Insert extends the Field length by 1,
// shifts any existing field values at indices equal or greater to idx by one place
// and inserts val at index idx of the Field.
// If idx is equal to the Field length, then val will be appended.
// It idx exceeds the Field length, this method will panic.
func (f *Field) Insert(idx int, val interface{}) {
	f.vector.Insert(idx, val)
}

// Delete delete element at index idx of the Field.
func (f *Field) Delete(idx int) {
	f.vector.Delete(idx)
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

// SetConfig modifies the Field's Config property to
// be set to conf and returns the Field.
func (f *Field) SetConfig(conf *FieldConfig) *Field {
	f.Config = conf
	return f
}

// FloatAt returns a float64 at the specified index idx for all supported Field types.
// It will panic if idx is out of range.
//
// If the Field type is numeric and the value at idx is nil, NaN is returned.
// Precision may be lost on large numbers.
//
// If the Field type is a bool then 0 is return if false or nil, and 1 if true.
//
// If the Field type is time.Time, then the millisecond epoch representation of the time
// is returned, or NaN is the value is nil.
//
// If the Field type is a string, then strconv.ParseFloat is called on it and will return
// an error if ParseFloat errors. If the value is nil, NaN is returned.
// nolint:gocyclo
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
		return float64(t.UnixNano() / int64(time.Millisecond)), nil
	}
	return 0, fmt.Errorf("unsupported field type %T", f.Type())
}

// NullableFloatAt it is similar to FloatAt but returns a *float64 at the specified index idx for all supported Field types.
// It will panic if idx is out of range.
// nolint:gocyclo
func (f *Field) NullableFloatAt(idx int) (*float64, error) {
	if !f.Nullable() {
		fv, err := f.FloatAt(idx)
		if err != nil {
			return nil, err
		}
		return &fv, nil
	}

	switch f.Type() {
	case FieldTypeNullableInt8:
		iv := f.At(idx).(*int8)
		if iv == nil {
			return nil, nil
		}
		f := float64(*iv)
		return &f, nil

	case FieldTypeNullableInt16:
		iv := f.At(idx).(*int16)
		if iv == nil {
			return nil, nil
		}
		f := float64(*iv)
		return &f, nil

	case FieldTypeNullableInt32:
		iv := f.At(idx).(*int32)
		if iv == nil {
			return nil, nil
		}
		f := float64(*iv)
		return &f, nil

	case FieldTypeNullableInt64:
		iv := f.At(idx).(*int64)
		if iv == nil {
			return nil, nil
		}
		f := float64(*iv)
		return &f, nil

	case FieldTypeNullableUint8:
		uiv := f.At(idx).(*uint8)
		if uiv == nil {
			return nil, nil
		}
		f := float64(*uiv)
		return &f, nil

	case FieldTypeNullableUint16:
		uiv := f.At(idx).(*uint16)
		if uiv == nil {
			return nil, nil
		}
		f := float64(*uiv)
		return &f, nil

	case FieldTypeNullableUint32:
		uiv := f.At(idx).(*uint32)
		if uiv == nil {
			return nil, nil
		}
		f := float64(*uiv)
		return &f, nil

	case FieldTypeNullableUint64:
		uiv := f.At(idx).(*uint64)
		if uiv == nil {
			return nil, nil
		}
		f := float64(*uiv)
		return &f, nil

	case FieldTypeNullableFloat32:
		fv := f.At(idx).(*float32)
		if fv == nil {
			return nil, nil
		}
		f := float64(*fv)
		return &f, nil

	case FieldTypeNullableFloat64:
		fv := f.At(idx).(*float64)
		if fv == nil {
			return nil, nil
		}
		return fv, nil

	case FieldTypeNullableString:
		s := f.At(idx).(*string)
		if s == nil {
			return nil, nil
		}
		ft, err := strconv.ParseFloat(*s, 64)
		if err != nil {
			return nil, err
		}
		return &ft, nil

	case FieldTypeNullableBool:
		b := f.At(idx).(*bool)
		if b == nil {
			return nil, nil
		}
		f := 0.0
		if *b {
			f = 1.0
		}
		return &f, nil

	case FieldTypeNullableTime:
		t := f.At(idx).(*time.Time)
		if t == nil {
			return nil, nil
		}
		f := float64(t.UnixNano() / int64(time.Millisecond))
		return &f, nil
	}
	return nil, fmt.Errorf("unsupported field type %T", f.Type())
}
