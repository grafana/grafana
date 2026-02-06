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

package scalar

import (
	"errors"
	"fmt"
	"math/bits"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/decimal256"
	"github.com/apache/arrow-go/v18/arrow/float16"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

type TypeToScalar interface {
	ToScalar() (Scalar, error)
}

type TypeFromScalar interface {
	FromStructScalar(*Struct) error
}

type hasTypename interface {
	TypeName() string
}

var (
	hasTypenameType = reflect.TypeOf((*hasTypename)(nil)).Elem()
	dataTypeType    = reflect.TypeOf((*arrow.DataType)(nil)).Elem()
)

func FromScalar(sc *Struct, val interface{}) error {
	if sc == nil || len(sc.Value) == 0 {
		return nil
	}

	if v, ok := val.(TypeFromScalar); ok {
		return v.FromStructScalar(sc)
	}

	v := reflect.ValueOf(val)
	if v.Kind() != reflect.Ptr {
		return errors.New("fromscalar must be given a pointer to an object to populate")
	}
	value := reflect.Indirect(v)

	for i := 0; i < value.Type().NumField(); i++ {
		fld := value.Type().Field(i)
		tag := fld.Tag.Get("compute")
		if tag == "-" || fld.Name == "_type_name" {
			continue
		}

		fldVal, err := sc.Field(tag)
		if err != nil {
			return err
		}
		if err := setFromScalar(fldVal, value.Field(i)); err != nil {
			return err
		}
	}

	return nil
}

func setFromScalar(s Scalar, v reflect.Value) error {
	if v.Type() == dataTypeType {
		v.Set(reflect.ValueOf(s.DataType()))
		return nil
	}

	switch s := s.(type) {
	case BinaryScalar:
		value := s.value().(*memory.Buffer)
		switch v.Kind() {
		case reflect.String:
			if value == nil {
				v.SetString("")
			} else {
				v.SetString(string(value.Bytes()))
			}
		default:
			if value == nil {
				v.SetBytes(nil)
			} else {
				v.SetBytes(value.Bytes())
			}
		}
	case ListScalar:
		return fromListScalar(s, v)
	case *Struct:
		return FromScalar(s, v.Interface())
	default:
		if v.Type() == reflect.TypeOf(arrow.TimeUnit(0)) {
			v.Set(reflect.ValueOf(arrow.TimeUnit(s.value().(uint32))))
		} else {
			v.Set(reflect.ValueOf(s.value()))
		}
	}
	return nil
}

func ToScalar(val interface{}, mem memory.Allocator) (Scalar, error) {
	switch v := val.(type) {
	case arrow.DataType:
		return MakeScalar(v), nil
	case TypeToScalar:
		return v.ToScalar()
	}

	v := reflect.Indirect(reflect.ValueOf(val))
	switch v.Kind() {
	case reflect.Struct:
		scalars := make([]Scalar, 0, v.Type().NumField())
		fields := make([]string, 0, v.Type().NumField())
		for i := 0; i < v.Type().NumField(); i++ {
			fld := v.Type().Field(i)
			tag := fld.Tag.Get("compute")
			if tag == "-" {
				continue
			}

			fldVal := v.Field(i)
			s, err := ToScalar(fldVal.Interface(), mem)
			if err != nil {
				return nil, err
			}
			scalars = append(scalars, s)
			fields = append(fields, tag)
		}

		if v.Type().Implements(hasTypenameType) {
			t := val.(hasTypename)
			scalars = append(scalars, NewBinaryScalar(memory.NewBufferBytes([]byte(t.TypeName())), arrow.BinaryTypes.Binary))
			fields = append(fields, "_type_name")
		}

		return NewStructScalarWithNames(scalars, fields)
	case reflect.Slice:
		return createListScalar(v, mem)
	default:
		return MakeScalar(val), nil
	}
}

func createListScalar(sliceval reflect.Value, mem memory.Allocator) (Scalar, error) {
	if sliceval.Kind() != reflect.Slice {
		return nil, fmt.Errorf("createListScalar only works for slices, not %s", sliceval.Kind())
	}

	var arr arrow.Array

	switch sliceval.Type().Elem().Kind() {
	case reflect.String:
		bldr := array.NewStringBuilder(mem)
		defer bldr.Release()
		bldr.AppendValues(sliceval.Interface().([]string), nil)
		arr = bldr.NewArray()
	case reflect.Bool:
		bldr := array.NewBooleanBuilder(mem)
		defer bldr.Release()
		bldr.AppendValues(sliceval.Interface().([]bool), nil)
		arr = bldr.NewArray()
	case reflect.Int8:
		bldr := array.NewInt8Builder(mem)
		defer bldr.Release()
		bldr.AppendValues(sliceval.Interface().([]int8), nil)
		arr = bldr.NewArray()
	case reflect.Uint8:
		bldr := array.NewUint8Builder(mem)
		defer bldr.Release()
		bldr.AppendValues(sliceval.Interface().([]uint8), nil)
		arr = bldr.NewArray()
	case reflect.Int16:
		bldr := array.NewInt16Builder(mem)
		defer bldr.Release()
		bldr.AppendValues(sliceval.Interface().([]int16), nil)
		arr = bldr.NewArray()
	case reflect.Uint16:
		bldr := array.NewUint16Builder(mem)
		defer bldr.Release()
		bldr.AppendValues(sliceval.Interface().([]uint16), nil)
		arr = bldr.NewArray()
	case reflect.Int32:
		bldr := array.NewInt32Builder(mem)
		defer bldr.Release()
		bldr.AppendValues(sliceval.Interface().([]int32), nil)
		arr = bldr.NewArray()
	case reflect.Uint32:
		bldr := array.NewUint32Builder(mem)
		defer bldr.Release()
		bldr.AppendValues(sliceval.Interface().([]uint32), nil)
		arr = bldr.NewArray()
	case reflect.Int64:
		bldr := array.NewInt64Builder(mem)
		defer bldr.Release()
		bldr.AppendValues(sliceval.Interface().([]int64), nil)
		arr = bldr.NewArray()
	case reflect.Uint64:
		bldr := array.NewUint64Builder(mem)
		defer bldr.Release()
		bldr.AppendValues(sliceval.Interface().([]uint64), nil)
		arr = bldr.NewArray()
	case reflect.Int:
		if bits.UintSize == 32 {
			bldr := array.NewInt32Builder(mem)
			defer bldr.Release()
			for _, v := range sliceval.Interface().([]int) {
				bldr.Append(int32(v))
			}
			arr = bldr.NewArray()
			break
		}
		bldr := array.NewInt64Builder(mem)
		defer bldr.Release()
		for _, v := range sliceval.Interface().([]int) {
			bldr.Append(int64(v))
		}
		arr = bldr.NewArray()
	case reflect.Uint:
		if bits.UintSize == 32 {
			bldr := array.NewUint32Builder(mem)
			defer bldr.Release()
			for _, v := range sliceval.Interface().([]uint) {
				bldr.Append(uint32(v))
			}
			arr = bldr.NewArray()
			break
		}
		bldr := array.NewUint64Builder(mem)
		defer bldr.Release()
		for _, v := range sliceval.Interface().([]uint) {
			bldr.Append(uint64(v))
		}
		arr = bldr.NewArray()
	case reflect.Ptr:
		meta, ok := sliceval.Interface().([]*arrow.Metadata)
		if !ok {
			break
		}

		bldr := array.NewMapBuilder(mem, arrow.BinaryTypes.Binary, arrow.BinaryTypes.Binary, false)
		defer bldr.Release()

		kbldr := bldr.KeyBuilder().(*array.BinaryBuilder)
		ibldr := bldr.ItemBuilder().(*array.BinaryBuilder)
		for _, md := range meta {
			bldr.Append(true)
			if md != nil {
				kbldr.AppendStringValues(md.Keys(), nil)
				ibldr.AppendStringValues(md.Values(), nil)
			}
		}

		arr := bldr.NewMapArray()
		defer arr.Release()

		return NewListScalar(arr), nil
	}

	if arr == nil {
		return nil, fmt.Errorf("createListScalar not implemented for %s", sliceval.Type())
	}

	defer arr.Release()
	return MakeScalarParam(arr, arrow.ListOf(arr.DataType()))
}

func fromListScalar(s ListScalar, v reflect.Value) error {
	if v.Kind() != reflect.Slice {
		return fmt.Errorf("could not populate field from list scalar, incompatible types: %s is not a slice", v.Type().String())
	}

	arr := s.GetList()
	v.Set(reflect.MakeSlice(v.Type(), arr.Len(), arr.Len()))
	switch arr := arr.(type) {
	case *array.Boolean:
		for i := 0; i < arr.Len(); i++ {
			v.Index(i).SetBool(arr.Value(i))
		}
	case *array.Int8:
		reflect.Copy(v, reflect.ValueOf(arr.Int8Values()))
	case *array.Uint8:
		reflect.Copy(v, reflect.ValueOf(arr.Uint8Values()))
	case *array.Int16:
		reflect.Copy(v, reflect.ValueOf(arr.Int16Values()))
	case *array.Uint16:
		reflect.Copy(v, reflect.ValueOf(arr.Uint16Values()))
	case *array.Int32:
		reflect.Copy(v, reflect.ValueOf(arr.Int32Values()))
	case *array.Uint32:
		reflect.Copy(v, reflect.ValueOf(arr.Uint32Values()))
	case *array.Int64:
		reflect.Copy(v, reflect.ValueOf(arr.Int64Values()))
	case *array.Uint64:
		reflect.Copy(v, reflect.ValueOf(arr.Uint64Values()))
	case *array.Float32:
		reflect.Copy(v, reflect.ValueOf(arr.Float32Values()))
	case *array.Float64:
		reflect.Copy(v, reflect.ValueOf(arr.Float64Values()))
	case *array.Binary:
		for i := 0; i < arr.Len(); i++ {
			v.Index(i).SetString(arr.ValueString(i))
		}
	case *array.String:
		for i := 0; i < arr.Len(); i++ {
			v.Index(i).SetString(arr.Value(i))
		}
	case *array.Map:
		// only implementing slice of metadata for now
		if v.Type().Elem() != reflect.PointerTo(reflect.TypeOf(arrow.Metadata{})) {
			return fmt.Errorf("unimplemented fromListScalar type %s to %s", arr.DataType(), v.Type().String())
		}

		var (
			offsets    = arr.Offsets()
			keys       = arr.Keys().(*array.Binary)
			values     = arr.Items().(*array.Binary)
			metaKeys   []string
			metaValues []string
		)

		for i, o := range offsets[:len(offsets)-1] {
			start := o
			end := offsets[i+1]

			metaKeys = make([]string, end-start)
			metaValues = make([]string, end-start)
			for j := start; j < end; j++ {
				metaKeys = append(metaKeys, keys.ValueString(int(j)))
				metaValues = append(metaValues, values.ValueString(int(j)))
			}

			m := arrow.NewMetadata(metaKeys, metaValues)
			v.Index(i).Set(reflect.ValueOf(&m))
		}

	default:
		return fmt.Errorf("unimplemented fromListScalar type: %s", arr.DataType())
	}

	return nil
}

// MakeScalarParam is for converting a value to a scalar when it requires a
// parameterized data type such as a time type that needs units, or a fixed
// size list which needs it's size.
//
// Will fall back to MakeScalar without the passed in type if not one of the
// parameterized types.
func MakeScalarParam(val interface{}, dt arrow.DataType) (Scalar, error) {
	switch v := val.(type) {
	case []byte:
		buf := memory.NewBufferBytes(v)
		defer buf.Release()

		switch dt.ID() {
		case arrow.BINARY:
			return NewBinaryScalar(buf, dt), nil
		case arrow.LARGE_BINARY:
			return NewLargeBinaryScalar(buf), nil
		case arrow.STRING:
			return NewStringScalarFromBuffer(buf), nil
		case arrow.LARGE_STRING:
			return NewLargeStringScalarFromBuffer(buf), nil
		case arrow.FIXED_SIZE_BINARY:
			if buf.Len() == dt.(*arrow.FixedSizeBinaryType).ByteWidth {
				return NewFixedSizeBinaryScalar(buf, dt), nil
			}
			return nil, fmt.Errorf("invalid scalar value of len %d for type %s", v, dt)
		}
	case *memory.Buffer:
		switch dt.ID() {
		case arrow.BINARY:
			return NewBinaryScalar(v, dt), nil
		case arrow.LARGE_BINARY:
			return NewLargeBinaryScalar(v), nil
		case arrow.STRING:
			return NewStringScalarFromBuffer(v), nil
		case arrow.LARGE_STRING:
			return NewLargeStringScalarFromBuffer(v), nil
		case arrow.FIXED_SIZE_BINARY:
			if v.Len() == dt.(*arrow.FixedSizeBinaryType).ByteWidth {
				return NewFixedSizeBinaryScalar(v, dt), nil
			}
			return nil, fmt.Errorf("invalid scalar value of len %d for type %s", v.Len(), dt)
		}
	case string:
		switch {
		case arrow.IsBaseBinary(dt.ID()):
			buf := memory.NewBufferBytes([]byte(v))
			defer buf.Release()

			switch dt.ID() {
			case arrow.BINARY:
				return NewBinaryScalar(buf, dt), nil
			case arrow.LARGE_BINARY:
				return NewLargeBinaryScalar(buf), nil
			case arrow.STRING:
				return NewStringScalar(v), nil
			case arrow.LARGE_STRING:
				return NewLargeStringScalar(v), nil
			}
		case arrow.IsInteger(dt.ID()):
			bits := dt.(arrow.FixedWidthDataType).BitWidth()
			if arrow.IsUnsignedInteger(dt.ID()) {
				val, err := strconv.ParseUint(v, 0, bits)
				if err != nil {
					return nil, err
				}
				return MakeUnsignedIntegerScalar(val, bits)
			}
			val, err := strconv.ParseInt(v, 0, bits)
			if err != nil {
				return nil, err
			}
			return MakeIntegerScalar(val, bits)
		case arrow.IsFixedSizeBinary(dt.ID()):
			switch dt.ID() {
			case arrow.FIXED_SIZE_BINARY:
				ty := dt.(*arrow.FixedSizeBinaryType)
				if len(v) != ty.ByteWidth {
					return nil, fmt.Errorf("%w: invalid length for fixed size binary scalar", arrow.ErrInvalid)
				}
				return NewFixedSizeBinaryScalar(memory.NewBufferBytes([]byte(v)), ty), nil
			case arrow.DECIMAL128:
				ty := dt.(*arrow.Decimal128Type)
				n, err := decimal128.FromString(v, ty.Precision, ty.Scale)
				if err != nil {
					return nil, err
				}
				return NewDecimal128Scalar(n, ty), nil
			case arrow.DECIMAL256:
				ty := dt.(*arrow.Decimal256Type)
				n, err := decimal256.FromString(v, ty.Precision, ty.Scale)
				if err != nil {
					return nil, err
				}
				return NewDecimal256Scalar(n, ty), nil
			}
		case arrow.IsFloating(dt.ID()):
			bits := dt.(arrow.FixedWidthDataType).BitWidth()
			val, err := strconv.ParseFloat(v, bits)
			if err != nil {
				return nil, err
			}
			if bits == 32 {
				return NewFloat32Scalar(float32(val)), nil
			}
			return NewFloat64Scalar(val), nil
		case dt.ID() == arrow.TIMESTAMP:
			ty := dt.(*arrow.TimestampType)
			if ty.TimeZone == "" || strings.ToLower(ty.TimeZone) == "utc" {
				ts, err := arrow.TimestampFromString(v, ty.Unit)
				if err != nil {
					return nil, err
				}
				return NewTimestampScalar(ts, dt), nil
			}
			loc, err := time.LoadLocation(ty.TimeZone)
			if err != nil {
				return nil, err
			}
			ts, _, err := arrow.TimestampFromStringInLocation(v, ty.Unit, loc)
			if err != nil {
				return nil, err
			}
			return NewTimestampScalar(ts, ty), nil
		}
	case arrow.Time32:
		return NewTime32Scalar(v, dt), nil
	case arrow.Time64:
		return NewTime64Scalar(v, dt), nil
	case arrow.Timestamp:
		return NewTimestampScalar(v, dt), nil
	case arrow.Array:
		switch dt.ID() {
		case arrow.LIST:
			if !arrow.TypeEqual(v.DataType(), dt.(*arrow.ListType).Elem()) {
				return nil, fmt.Errorf("inconsistent type for list scalar array and data type")
			}
			return NewListScalar(v), nil
		case arrow.LARGE_LIST:
			if !arrow.TypeEqual(v.DataType(), dt.(*arrow.LargeListType).Elem()) {
				return nil, fmt.Errorf("inconsistent type for large list scalar array and data type")
			}
			return NewLargeListScalar(v), nil
		case arrow.FIXED_SIZE_LIST:
			if !arrow.TypeEqual(v.DataType(), dt.(*arrow.FixedSizeListType).Elem()) {
				return nil, fmt.Errorf("inconsistent type for list scalar array and data type")
			}
			return NewFixedSizeListScalarWithType(v, dt), nil
		case arrow.MAP:
			if !arrow.TypeEqual(dt.(*arrow.MapType).Elem(), v.DataType()) {
				return nil, fmt.Errorf("inconsistent type for map scalar type")
			}
			return NewMapScalar(v), nil
		}
	case decimal128.Num:
		if _, ok := dt.(*arrow.Decimal128Type); !ok {
			return nil, fmt.Errorf("mismatch cannot create decimal128 scalar with incorrect data type")
		}

		return NewDecimal128Scalar(v, dt), nil
	case decimal256.Num:
		if _, ok := dt.(*arrow.Decimal256Type); !ok {
			return nil, fmt.Errorf("mismatch cannot create decimal256 scalar with incorrect data type")
		}

		return NewDecimal256Scalar(v, dt), nil

	}

	if arrow.IsInteger(dt.ID()) {
		bits := dt.(arrow.FixedWidthDataType).BitWidth()
		val := reflect.ValueOf(val)
		if arrow.IsUnsignedInteger(dt.ID()) {
			return MakeUnsignedIntegerScalar(val.Convert(reflect.TypeOf(uint64(0))).Uint(), bits)
		}
		return MakeIntegerScalar(val.Convert(reflect.TypeOf(int64(0))).Int(), bits)
	}

	if dt.ID() == arrow.DICTIONARY {
		return MakeScalarParam(val, dt.(*arrow.DictionaryType).ValueType)
	}
	return MakeScalar(val), nil
}

// MakeScalar creates a scalar of the passed in type via reflection.
func MakeScalar(val interface{}) Scalar {
	switch v := val.(type) {
	case nil:
		return ScalarNull
	case bool:
		return NewBooleanScalar(v)
	case int8:
		return NewInt8Scalar(v)
	case uint8:
		return NewUint8Scalar(v)
	case int16:
		return NewInt16Scalar(v)
	case uint16:
		return NewUint16Scalar(v)
	case int32:
		return NewInt32Scalar(v)
	case uint32:
		return NewUint32Scalar(v)
	case int64:
		return NewInt64Scalar(v)
	case uint64:
		return NewUint64Scalar(v)
	case int:
		// determine size of an int on this system
		switch bits.UintSize {
		case 32:
			return NewInt32Scalar(int32(v))
		case 64:
			return NewInt64Scalar(int64(v))
		}
	case uint:
		// determine size of an int on this system
		switch bits.UintSize {
		case 32:
			return NewUint32Scalar(uint32(v))
		case 64:
			return NewUint64Scalar(uint64(v))
		}
	case []byte:
		buf := memory.NewBufferBytes(v)
		defer buf.Release()
		return NewBinaryScalar(buf, arrow.BinaryTypes.Binary)
	case string:
		return NewStringScalar(v)
	case arrow.Date32:
		return NewDate32Scalar(v)
	case arrow.Date64:
		return NewDate64Scalar(v)
	case float16.Num:
		return NewFloat16Scalar(v)
	case float32:
		return NewFloat32Scalar(v)
	case float64:
		return NewFloat64Scalar(v)
	case arrow.MonthInterval:
		return NewMonthIntervalScalar(v)
	case arrow.DayTimeInterval:
		return NewDayTimeIntervalScalar(v)
	case arrow.MonthDayNanoInterval:
		return NewMonthDayNanoIntervalScalar(v)
	case arrow.DataType:
		return MakeNullScalar(v)
	default:
		testval := reflect.ValueOf(v)
		if testval.Type().ConvertibleTo(reflect.TypeOf(uint32(0))) {
			return NewUint32Scalar(uint32(testval.Convert(reflect.TypeOf(uint32(0))).Uint()))
		}
	}

	panic(fmt.Errorf("makescalar not implemented for type value %#v", val))
}

// MakeIntegerScalar is a helper function for creating an integer scalar of a
// given bitsize.
func MakeIntegerScalar(v int64, bitsize int) (Scalar, error) {
	switch bitsize {
	case 8:
		return NewInt8Scalar(int8(v)), nil
	case 16:
		return NewInt16Scalar(int16(v)), nil
	case 32:
		return NewInt32Scalar(int32(v)), nil
	case 64:
		return NewInt64Scalar(int64(v)), nil
	}
	return nil, fmt.Errorf("invalid bitsize for integer scalar: %d", bitsize)
}

// MakeUnsignedIntegerScalar is a helper function for creating an unsigned int
// scalar of the specified bit width.
func MakeUnsignedIntegerScalar(v uint64, bitsize int) (Scalar, error) {
	switch bitsize {
	case 8:
		return NewUint8Scalar(uint8(v)), nil
	case 16:
		return NewUint16Scalar(uint16(v)), nil
	case 32:
		return NewUint32Scalar(uint32(v)), nil
	case 64:
		return NewUint64Scalar(uint64(v)), nil
	}
	return nil, fmt.Errorf("invalid bitsize for uint scalar: %d", bitsize)
}

// ParseScalar parses a string to create a scalar of the passed in type. Currently
// does not support any nested types such as Structs or Lists.
func ParseScalar(dt arrow.DataType, val string) (Scalar, error) {
	switch dt.ID() {
	case arrow.STRING:
		return NewStringScalar(val), nil
	case arrow.BINARY:
		buf := memory.NewBufferBytes([]byte(val))
		defer buf.Release()
		return NewBinaryScalar(buf, dt), nil
	case arrow.FIXED_SIZE_BINARY:
		if len(val) != dt.(*arrow.FixedSizeBinaryType).ByteWidth {
			return nil, fmt.Errorf("invalid value %s for scalar of type %s", val, dt)
		}
		buf := memory.NewBufferBytes([]byte(val))
		defer buf.Release()
		return NewFixedSizeBinaryScalar(buf, dt), nil
	case arrow.BOOL:
		val, err := strconv.ParseBool(val)
		if err != nil {
			return nil, err
		}
		return NewBooleanScalar(val), nil
	case arrow.INT8, arrow.INT16, arrow.INT32, arrow.INT64:
		width := dt.(arrow.FixedWidthDataType).BitWidth()
		val, err := strconv.ParseInt(val, 0, width)
		if err != nil {
			return nil, err
		}
		return MakeIntegerScalar(val, width)
	case arrow.UINT8, arrow.UINT16, arrow.UINT32, arrow.UINT64:
		width := dt.(arrow.FixedWidthDataType).BitWidth()
		val, err := strconv.ParseUint(val, 0, width)
		if err != nil {
			return nil, err
		}
		return MakeUnsignedIntegerScalar(val, width)
	case arrow.FLOAT16:
		val, err := strconv.ParseFloat(val, 32)
		if err != nil {
			return nil, err
		}
		return NewFloat16ScalarFromFloat32(float32(val)), nil
	case arrow.FLOAT32, arrow.FLOAT64:
		width := dt.(arrow.FixedWidthDataType).BitWidth()
		val, err := strconv.ParseFloat(val, width)
		if err != nil {
			return nil, err
		}
		switch width {
		case 32:
			return NewFloat32Scalar(float32(val)), nil
		case 64:
			return NewFloat64Scalar(float64(val)), nil
		}
	case arrow.TIMESTAMP:
		value, err := arrow.TimestampFromString(val, dt.(*arrow.TimestampType).Unit)
		if err != nil {
			return nil, err
		}
		return NewTimestampScalar(value, dt), nil
	case arrow.DURATION:
		value, err := time.ParseDuration(val)
		if err != nil {
			return nil, err
		}
		unit := dt.(*arrow.DurationType).Unit
		var out arrow.Duration
		switch unit {
		case arrow.Nanosecond:
			out = arrow.Duration(value.Nanoseconds())
		case arrow.Microsecond:
			out = arrow.Duration(value.Microseconds())
		case arrow.Millisecond:
			out = arrow.Duration(value.Milliseconds())
		case arrow.Second:
			out = arrow.Duration(value.Seconds())
		}
		return NewDurationScalar(out, dt), nil
	case arrow.DATE32, arrow.DATE64:
		out, err := time.ParseInLocation("2006-01-02", val, time.UTC)
		if err != nil {
			return nil, err
		}
		if dt.ID() == arrow.DATE32 {
			return NewDate32Scalar(arrow.Date32FromTime(out)), nil
		} else {
			return NewDate64Scalar(arrow.Date64FromTime(out)), nil
		}
	case arrow.TIME32:
		tm, err := arrow.Time32FromString(val, dt.(*arrow.Time32Type).Unit)
		if err != nil {
			return nil, err
		}

		return NewTime32Scalar(tm, dt), nil
	case arrow.TIME64:
		tm, err := arrow.Time64FromString(val, dt.(*arrow.Time64Type).Unit)
		if err != nil {
			return nil, err
		}

		return NewTime64Scalar(tm, dt), nil
	case arrow.DICTIONARY:
		return ParseScalar(dt.(*arrow.DictionaryType).ValueType, val)
	case arrow.DECIMAL128:
		typ := dt.(*arrow.Decimal128Type)
		n, err := decimal128.FromString(val, typ.Precision, typ.Scale)
		if err != nil {
			return nil, err
		}
		return NewDecimal128Scalar(n, typ), nil
	case arrow.DECIMAL256:
		typ := dt.(*arrow.Decimal256Type)
		n, err := decimal256.FromString(val, typ.Precision, typ.Scale)
		if err != nil {
			return nil, err
		}
		return NewDecimal256Scalar(n, typ), nil
	}

	return nil, fmt.Errorf("parsing of scalar for type %s not implemented", dt)
}
