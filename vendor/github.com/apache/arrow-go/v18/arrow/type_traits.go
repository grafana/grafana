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
	"reflect"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow/decimal"
	"github.com/apache/arrow-go/v18/arrow/float16"
	"golang.org/x/exp/constraints"
)

// IntType is a type constraint for raw values represented as signed
// integer types by  We aren't just using constraints.Signed
// because we don't want to include the raw `int` type here whose size
// changes based on the architecture (int32 on 32-bit architectures and
// int64 on 64-bit architectures).
//
// This will also cover types like MonthInterval or the time types
// as their underlying types are int32 and int64 which will get covered
// by using the ~
type IntType interface {
	~int8 | ~int16 | ~int32 | ~int64
}

// UintType is a type constraint for raw values represented as unsigned
// integer types by  We aren't just using constraints.Unsigned
// because we don't want to include the raw `uint` type here whose size
// changes based on the architecture (uint32 on 32-bit architectures and
// uint64 on 64-bit architectures). We also don't want to include uintptr
type UintType interface {
	~uint8 | ~uint16 | ~uint32 | ~uint64
}

// FloatType is a type constraint for raw values for representing
// floating point values in  This consists of constraints.Float and
// float16.Num
type FloatType interface {
	float16.Num | constraints.Float
}

// NumericType is a type constraint for just signed/unsigned integers
// and float32/float64.
type NumericType interface {
	IntType | UintType | constraints.Float
}

// FixedWidthType is a type constraint for raw values in Arrow that
// can be represented as FixedWidth byte slices. Specifically this is for
// using Go generics to easily re-type a byte slice to a properly-typed
// slice. Booleans are excluded here since they are represented by Arrow
// as a bitmap and thus the buffer can't be just reinterpreted as a []bool
type FixedWidthType interface {
	IntType | UintType |
		FloatType | decimal.DecimalTypes |
		DayTimeInterval | MonthDayNanoInterval
}

type TemporalType interface {
	Date32 | Date64 | Time32 | Time64 |
		Timestamp | Duration | DayTimeInterval |
		MonthInterval | MonthDayNanoInterval
}

func reinterpretSlice[Out, T any](b []T) []Out {
	if cap(b) == 0 {
		return nil
	}
	out := (*Out)(unsafe.Pointer(&b[:1][0]))

	lenBytes := len(b) * int(unsafe.Sizeof(b[0]))
	capBytes := cap(b) * int(unsafe.Sizeof(b[0]))

	lenOut := lenBytes / int(unsafe.Sizeof(*out))
	capOut := capBytes / int(unsafe.Sizeof(*out))

	return unsafe.Slice(out, capOut)[:lenOut]
}

// GetValues reinterprets the data.Buffers()[i] to a slice of T with len=data.Len().
//
// If the buffer is nil, nil will be returned.
//
// NOTE: the buffer's length must be a multiple of Sizeof(T).
func GetValues[T FixedWidthType](data ArrayData, i int) []T {
	if data.Buffers()[i] == nil || data.Buffers()[i].Len() == 0 {
		return nil
	}
	return reinterpretSlice[T](data.Buffers()[i].Bytes())[data.Offset() : data.Offset()+data.Len()]
}

// GetOffsets reinterprets the data.Buffers()[i] to a slice of T with len=data.Len()+1.
//
// NOTE: the buffer's length must be a multiple of Sizeof(T).
func GetOffsets[T int32 | int64](data ArrayData, i int) []T {
	return reinterpretSlice[T](data.Buffers()[i].Bytes())[data.Offset() : data.Offset()+data.Len()+1]
}

// GetBytes reinterprets a slice of T to a slice of bytes.
func GetBytes[T FixedWidthType | ViewHeader](in []T) []byte {
	return reinterpretSlice[byte](in)
}

// GetData reinterprets a slice of bytes to a slice of T.
//
// NOTE: the buffer's length must be a multiple of Sizeof(T).
func GetData[T FixedWidthType | ViewHeader](in []byte) []T {
	return reinterpretSlice[T](in)
}

var typMap = map[reflect.Type]DataType{
	reflect.TypeOf(false):         FixedWidthTypes.Boolean,
	reflect.TypeOf(int8(0)):       PrimitiveTypes.Int8,
	reflect.TypeOf(int16(0)):      PrimitiveTypes.Int16,
	reflect.TypeOf(int32(0)):      PrimitiveTypes.Int32,
	reflect.TypeOf(int64(0)):      PrimitiveTypes.Int64,
	reflect.TypeOf(uint8(0)):      PrimitiveTypes.Uint8,
	reflect.TypeOf(uint16(0)):     PrimitiveTypes.Uint16,
	reflect.TypeOf(uint32(0)):     PrimitiveTypes.Uint32,
	reflect.TypeOf(uint64(0)):     PrimitiveTypes.Uint64,
	reflect.TypeOf(float32(0)):    PrimitiveTypes.Float32,
	reflect.TypeOf(float64(0)):    PrimitiveTypes.Float64,
	reflect.TypeOf(string("")):    BinaryTypes.String,
	reflect.TypeOf(Date32(0)):     FixedWidthTypes.Date32,
	reflect.TypeOf(Date64(0)):     FixedWidthTypes.Date64,
	reflect.TypeOf(true):          FixedWidthTypes.Boolean,
	reflect.TypeOf(float16.Num{}): FixedWidthTypes.Float16,
	reflect.TypeOf([]byte{}):      BinaryTypes.Binary,
}

// GetDataType returns the appropriate DataType for the given type T
// only for non-parametric types. This uses a map and reflection internally
// so don't call this in a tight loop, instead call this once and then use
// a closure with the result.
func GetDataType[T NumericType | bool | string | []byte | float16.Num]() DataType {
	var z T
	return typMap[reflect.TypeOf(z)]
}

// GetType returns the appropriate Type type T, only for non-parametric
// types. This uses a map and reflection internally so don't call this in
// a tight loop, instead call it once and then use a closure with the result.
func GetType[T NumericType | bool | string]() Type {
	var z T
	return typMap[reflect.TypeOf(z)].ID()
}
