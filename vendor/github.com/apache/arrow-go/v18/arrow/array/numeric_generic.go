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

package array

import (
	"fmt"
	"strconv"
	"strings"
	"time"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/internal/json"
)

type numericArray[T arrow.IntType | arrow.UintType | arrow.FloatType] struct {
	array
	values []T
}

func newNumericData[T arrow.IntType | arrow.UintType | arrow.FloatType](data arrow.ArrayData) numericArray[T] {
	a := numericArray[T]{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *numericArray[T]) Reset(data *Data) {
	a.setData(data)
}

func (a *numericArray[T]) Value(i int) T { return a.values[i] }
func (a *numericArray[T]) Values() []T   { return a.values }
func (a *numericArray[T]) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i, v := range a.values {
		if i > 0 {
			fmt.Fprintf(o, " ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString(NullValueStr)
		default:
			fmt.Fprintf(o, "%v", v)
		}
	}
	o.WriteString("]")
	return o.String()
}

func (a *numericArray[T]) setData(data *Data) {
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.values = arrow.GetData[T](vals.Bytes())
		beg := a.data.offset
		end := beg + a.data.length
		a.values = a.values[beg:end]
	}
}

func (a *numericArray[T]) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}

	return fmt.Sprintf("%v", a.values[i])
}

func (a *numericArray[T]) GetOneForMarshal(i int) any {
	if a.IsNull(i) {
		return nil
	}

	return a.values[i]
}

func (a *numericArray[T]) MarshalJSON() ([]byte, error) {
	vals := make([]any, a.Len())
	for i := range a.Len() {
		if a.IsValid(i) {
			vals[i] = a.values[i]
		} else {
			vals[i] = nil
		}
	}
	return json.Marshal(vals)
}

type oneByteArrs[T int8 | uint8] struct {
	numericArray[T]
}

func (a *oneByteArrs[T]) GetOneForMarshal(i int) any {
	if a.IsNull(i) {
		return nil
	}

	return float64(a.values[i]) // prevent uint8/int8 from being seen as binary data
}

func (a *oneByteArrs[T]) MarshalJSON() ([]byte, error) {
	vals := make([]any, a.Len())
	for i := range a.Len() {
		if a.IsValid(i) {
			vals[i] = float64(a.values[i]) // prevent uint8/int8 from being seen as binary data
		} else {
			vals[i] = nil
		}
	}
	return json.Marshal(vals)
}

type floatArray[T float32 | float64] struct {
	numericArray[T]
}

func (a *floatArray[T]) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}

	f := a.Value(i)
	bitWidth := int(unsafe.Sizeof(f) * 8)
	return strconv.FormatFloat(float64(a.Value(i)), 'g', -1, bitWidth)
}

func (a *floatArray[T]) GetOneForMarshal(i int) any {
	if a.IsNull(i) {
		return nil
	}

	f := a.Value(i)
	bitWidth := int(unsafe.Sizeof(f) * 8)
	v := strconv.FormatFloat(float64(a.Value(i)), 'g', -1, bitWidth)
	switch v {
	case "NaN", "+Inf", "-Inf":
		return v
	default:
		return f
	}
}

func (a *floatArray[T]) MarshalJSON() ([]byte, error) {
	vals := make([]any, a.Len())
	for i := range a.values {
		vals[i] = a.GetOneForMarshal(i)
	}
	return json.Marshal(vals)
}

type dateArray[T interface {
	arrow.Date32 | arrow.Date64
	FormattedString() string
	ToTime() time.Time
}] struct {
	numericArray[T]
}

func (d *dateArray[T]) MarshalJSON() ([]byte, error) {
	vals := make([]any, d.Len())
	for i := range d.values {
		vals[i] = d.GetOneForMarshal(i)
	}
	return json.Marshal(vals)
}

func (d *dateArray[T]) ValueStr(i int) string {
	if d.IsNull(i) {
		return NullValueStr
	}

	return d.values[i].FormattedString()
}

func (d *dateArray[T]) GetOneForMarshal(i int) interface{} {
	if d.IsNull(i) {
		return nil
	}

	return d.values[i].FormattedString()
}

type timeType interface {
	TimeUnit() arrow.TimeUnit
}

type timeArray[T interface {
	arrow.Time32 | arrow.Time64
	FormattedString(arrow.TimeUnit) string
	ToTime(arrow.TimeUnit) time.Time
}] struct {
	numericArray[T]
}

func (a *timeArray[T]) MarshalJSON() ([]byte, error) {
	vals := make([]any, a.Len())
	for i := range a.values {
		vals[i] = a.GetOneForMarshal(i)
	}
	return json.Marshal(vals)
}

func (a *timeArray[T]) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}

	return a.values[i].FormattedString(a.DataType().(timeType).TimeUnit())
}

func (a *timeArray[T]) GetOneForMarshal(i int) interface{} {
	if a.IsNull(i) {
		return nil
	}

	return a.values[i].ToTime(a.DataType().(timeType).TimeUnit()).Format("15:04:05.999999999")
}

type Duration struct {
	numericArray[arrow.Duration]
}

func NewDurationData(data arrow.ArrayData) *Duration {
	return &Duration{numericArray: newNumericData[arrow.Duration](data)}
}

func (a *Duration) DurationValues() []arrow.Duration { return a.Values() }

func (a *Duration) MarshalJSON() ([]byte, error) {
	vals := make([]any, a.Len())
	for i := range a.values {
		vals[i] = a.GetOneForMarshal(i)
	}
	return json.Marshal(vals)
}

func (a *Duration) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}

	return fmt.Sprintf("%d%s", a.values[i], a.DataType().(timeType).TimeUnit())
}

func (a *Duration) GetOneForMarshal(i int) any {
	if a.IsNull(i) {
		return nil
	}
	return fmt.Sprintf("%d%s", a.values[i], a.DataType().(timeType).TimeUnit())
}

type Int64 struct {
	numericArray[int64]
}

func NewInt64Data(data arrow.ArrayData) *Int64 {
	return &Int64{numericArray: newNumericData[int64](data)}
}

func (a *Int64) Int64Values() []int64 { return a.Values() }

type Uint64 struct {
	numericArray[uint64]
}

func NewUint64Data(data arrow.ArrayData) *Uint64 {
	return &Uint64{numericArray: newNumericData[uint64](data)}
}

func (a *Uint64) Uint64Values() []uint64 { return a.Values() }

type Float32 struct {
	floatArray[float32]
}

func NewFloat32Data(data arrow.ArrayData) *Float32 {
	return &Float32{floatArray[float32]{newNumericData[float32](data)}}
}

func (a *Float32) Float32Values() []float32 { return a.Values() }

type Float64 struct {
	floatArray[float64]
}

func NewFloat64Data(data arrow.ArrayData) *Float64 {
	return &Float64{floatArray: floatArray[float64]{newNumericData[float64](data)}}
}

func (a *Float64) Float64Values() []float64 { return a.Values() }

type Int32 struct {
	numericArray[int32]
}

func NewInt32Data(data arrow.ArrayData) *Int32 {
	return &Int32{newNumericData[int32](data)}
}

func (a *Int32) Int32Values() []int32 { return a.Values() }

type Uint32 struct {
	numericArray[uint32]
}

func NewUint32Data(data arrow.ArrayData) *Uint32 {
	return &Uint32{numericArray: newNumericData[uint32](data)}
}

func (a *Uint32) Uint32Values() []uint32 { return a.Values() }

type Int16 struct {
	numericArray[int16]
}

func NewInt16Data(data arrow.ArrayData) *Int16 {
	return &Int16{newNumericData[int16](data)}
}

func (a *Int16) Int16Values() []int16 { return a.Values() }

type Uint16 struct {
	numericArray[uint16]
}

func NewUint16Data(data arrow.ArrayData) *Uint16 {
	return &Uint16{numericArray: newNumericData[uint16](data)}
}

func (a *Uint16) Uint16Values() []uint16 { return a.Values() }

type Int8 struct {
	oneByteArrs[int8]
}

func NewInt8Data(data arrow.ArrayData) *Int8 {
	return &Int8{oneByteArrs[int8]{newNumericData[int8](data)}}
}

func (a *Int8) Int8Values() []int8 { return a.Values() }

type Uint8 struct {
	oneByteArrs[uint8]
}

func NewUint8Data(data arrow.ArrayData) *Uint8 {
	return &Uint8{oneByteArrs[uint8]{newNumericData[uint8](data)}}
}

func (a *Uint8) Uint8Values() []uint8 { return a.Values() }

type Time32 struct {
	timeArray[arrow.Time32]
}

func NewTime32Data(data arrow.ArrayData) *Time32 {
	return &Time32{timeArray[arrow.Time32]{newNumericData[arrow.Time32](data)}}
}

func (a *Time32) Time32Values() []arrow.Time32 { return a.Values() }

type Time64 struct {
	timeArray[arrow.Time64]
}

func NewTime64Data(data arrow.ArrayData) *Time64 {
	return &Time64{timeArray[arrow.Time64]{newNumericData[arrow.Time64](data)}}
}

func (a *Time64) Time64Values() []arrow.Time64 { return a.Values() }

type Date32 struct {
	dateArray[arrow.Date32]
}

func NewDate32Data(data arrow.ArrayData) *Date32 {
	return &Date32{dateArray[arrow.Date32]{newNumericData[arrow.Date32](data)}}
}

func (a *Date32) Date32Values() []arrow.Date32 { return a.Values() }

type Date64 struct {
	dateArray[arrow.Date64]
}

func NewDate64Data(data arrow.ArrayData) *Date64 {
	return &Date64{dateArray[arrow.Date64]{newNumericData[arrow.Date64](data)}}
}

func (a *Date64) Date64Values() []arrow.Date64 { return a.Values() }

func arrayEqualFixedWidth[T arrow.FixedWidthType](left, right arrow.TypedArray[T]) bool {
	for i := range left.Len() {
		if left.IsNull(i) {
			continue
		}
		if left.Value(i) != right.Value(i) {
			return false
		}
	}
	return true
}
