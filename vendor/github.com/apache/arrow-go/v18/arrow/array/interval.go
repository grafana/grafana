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
	"bytes"
	"fmt"
	"strconv"
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

func NewIntervalData(data arrow.ArrayData) arrow.Array {
	switch data.DataType().(type) {
	case *arrow.MonthIntervalType:
		return NewMonthIntervalData(data.(*Data))
	case *arrow.DayTimeIntervalType:
		return NewDayTimeIntervalData(data.(*Data))
	case *arrow.MonthDayNanoIntervalType:
		return NewMonthDayNanoIntervalData(data.(*Data))
	default:
		panic(fmt.Errorf("arrow/array: unknown interval data type %T", data.DataType()))
	}
}

// A type which represents an immutable sequence of arrow.MonthInterval values.
type MonthInterval struct {
	array
	values []arrow.MonthInterval
}

func NewMonthIntervalData(data arrow.ArrayData) *MonthInterval {
	a := &MonthInterval{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *MonthInterval) Value(i int) arrow.MonthInterval { return a.values[i] }
func (a *MonthInterval) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}
	return fmt.Sprintf("%v", a.Value(i))
}
func (a *MonthInterval) MonthIntervalValues() []arrow.MonthInterval { return a.Values() }
func (a *MonthInterval) Values() []arrow.MonthInterval              { return a.values }

func (a *MonthInterval) String() string {
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

func (a *MonthInterval) setData(data *Data) {
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.values = arrow.MonthIntervalTraits.CastFromBytes(vals.Bytes())
		beg := a.data.offset
		end := beg + a.data.length
		a.values = a.values[beg:end]
	}
}

func (a *MonthInterval) GetOneForMarshal(i int) interface{} {
	if a.IsValid(i) {
		return a.values[i]
	}
	return nil
}

// MarshalJSON will create a json array out of a MonthInterval array,
// each value will be an object of the form {"months": #} where
// # is the numeric value of that index
func (a *MonthInterval) MarshalJSON() ([]byte, error) {
	if a.NullN() == 0 {
		return json.Marshal(a.values)
	}
	vals := make([]interface{}, a.Len())
	for i := 0; i < a.Len(); i++ {
		if a.IsValid(i) {
			vals[i] = a.values[i]
		} else {
			vals[i] = nil
		}
	}

	return json.Marshal(vals)
}

func arrayEqualMonthInterval(left, right *MonthInterval) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if left.Value(i) != right.Value(i) {
			return false
		}
	}
	return true
}

type MonthIntervalBuilder struct {
	builder

	data    *memory.Buffer
	rawData []arrow.MonthInterval
}

func NewMonthIntervalBuilder(mem memory.Allocator) *MonthIntervalBuilder {
	mib := &MonthIntervalBuilder{builder: builder{mem: mem}}
	mib.refCount.Add(1)
	return mib
}

func (b *MonthIntervalBuilder) Type() arrow.DataType { return arrow.FixedWidthTypes.MonthInterval }

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *MonthIntervalBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
		if b.data != nil {
			b.data.Release()
			b.data = nil
			b.rawData = nil
		}
	}
}

func (b *MonthIntervalBuilder) Append(v arrow.MonthInterval) {
	b.Reserve(1)
	b.UnsafeAppend(v)
}

func (b *MonthIntervalBuilder) AppendNull() {
	b.Reserve(1)
	b.UnsafeAppendBoolToBitmap(false)
}

func (b *MonthIntervalBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *MonthIntervalBuilder) AppendEmptyValue() {
	b.Append(arrow.MonthInterval(0))
}

func (b *MonthIntervalBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *MonthIntervalBuilder) UnsafeAppend(v arrow.MonthInterval) {
	bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	b.rawData[b.length] = v
	b.length++
}

func (b *MonthIntervalBuilder) UnsafeAppendBoolToBitmap(isValid bool) {
	if isValid {
		bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	} else {
		b.nulls++
	}
	b.length++
}

// AppendValues will append the values in the v slice. The valid slice determines which values
// in v are valid (not null). The valid slice must either be empty or be equal in length to v. If empty,
// all values in v are appended and considered valid.
func (b *MonthIntervalBuilder) AppendValues(v []arrow.MonthInterval, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	arrow.MonthIntervalTraits.Copy(b.rawData[b.length:], v)
	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

func (b *MonthIntervalBuilder) init(capacity int) {
	b.builder.init(capacity)

	b.data = memory.NewResizableBuffer(b.mem)
	bytesN := arrow.MonthIntervalTraits.BytesRequired(capacity)
	b.data.Resize(bytesN)
	b.rawData = arrow.MonthIntervalTraits.CastFromBytes(b.data.Bytes())
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *MonthIntervalBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *MonthIntervalBuilder) Resize(n int) {
	nBuilder := n
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.resize(nBuilder, b.init)
		b.data.Resize(arrow.MonthIntervalTraits.BytesRequired(n))
		b.rawData = arrow.MonthIntervalTraits.CastFromBytes(b.data.Bytes())
	}
}

// NewArray creates a MonthInterval array from the memory buffers used by the builder and resets the MonthIntervalBuilder
// so it can be used to build a new array.
func (b *MonthIntervalBuilder) NewArray() arrow.Array {
	return b.NewMonthIntervalArray()
}

// NewMonthIntervalArray creates a MonthInterval array from the memory buffers used by the builder and resets the MonthIntervalBuilder
// so it can be used to build a new array.
func (b *MonthIntervalBuilder) NewMonthIntervalArray() (a *MonthInterval) {
	data := b.newData()
	a = NewMonthIntervalData(data)
	data.Release()
	return
}

func (b *MonthIntervalBuilder) newData() (data *Data) {
	bytesRequired := arrow.MonthIntervalTraits.BytesRequired(b.length)
	if bytesRequired > 0 && bytesRequired < b.data.Len() {
		// trim buffers
		b.data.Resize(bytesRequired)
	}
	data = NewData(arrow.FixedWidthTypes.MonthInterval, b.length, []*memory.Buffer{b.nullBitmap, b.data}, nil, b.nulls, 0)
	b.reset()

	if b.data != nil {
		b.data.Release()
		b.data = nil
		b.rawData = nil
	}

	return
}

func (b *MonthIntervalBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}
	v, err := strconv.ParseInt(s, 10, 32)
	if err != nil {
		b.AppendNull()
		return err
	}
	b.Append(arrow.MonthInterval(v))
	return nil
}

func (b *MonthIntervalBuilder) UnmarshalOne(dec *json.Decoder) error {
	var v *arrow.MonthInterval
	if err := dec.Decode(&v); err != nil {
		return err
	}

	if v == nil {
		b.AppendNull()
	} else {
		b.Append(*v)
	}
	return nil
}

func (b *MonthIntervalBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

// UnmarshalJSON will add the unmarshalled values of an array to the builder,
// values are expected to be strings of the form "#months" where # is the int32
// value that will be added to the builder.
func (b *MonthIntervalBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("month interval builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

// A type which represents an immutable sequence of arrow.DayTimeInterval values.
type DayTimeInterval struct {
	array
	values []arrow.DayTimeInterval
}

func NewDayTimeIntervalData(data arrow.ArrayData) *DayTimeInterval {
	a := &DayTimeInterval{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *DayTimeInterval) Value(i int) arrow.DayTimeInterval { return a.values[i] }
func (a *DayTimeInterval) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}
	data, err := json.Marshal(a.GetOneForMarshal(i))
	if err != nil {
		panic(err)
	}
	return string(data)
}

func (a *DayTimeInterval) DayTimeIntervalValues() []arrow.DayTimeInterval { return a.values }

func (a *DayTimeInterval) String() string {
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

func (a *DayTimeInterval) setData(data *Data) {
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.values = arrow.DayTimeIntervalTraits.CastFromBytes(vals.Bytes())
		beg := a.data.offset
		end := beg + a.data.length
		a.values = a.values[beg:end]
	}
}

func (a *DayTimeInterval) GetOneForMarshal(i int) interface{} {
	if a.IsValid(i) {
		return a.values[i]
	}
	return nil
}

// MarshalJSON will marshal this array to JSON as an array of objects,
// consisting of the form {"days": #, "milliseconds": #} for each element.
func (a *DayTimeInterval) MarshalJSON() ([]byte, error) {
	if a.NullN() == 0 {
		return json.Marshal(a.values)
	}
	vals := make([]interface{}, a.Len())
	for i, v := range a.values {
		if a.IsValid(i) {
			vals[i] = v
		} else {
			vals[i] = nil
		}
	}
	return json.Marshal(vals)
}

func arrayEqualDayTimeInterval(left, right *DayTimeInterval) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if left.Value(i) != right.Value(i) {
			return false
		}
	}
	return true
}

type DayTimeIntervalBuilder struct {
	builder

	data    *memory.Buffer
	rawData []arrow.DayTimeInterval
}

func NewDayTimeIntervalBuilder(mem memory.Allocator) *DayTimeIntervalBuilder {
	dtb := &DayTimeIntervalBuilder{builder: builder{mem: mem}}
	dtb.refCount.Add(1)
	return dtb
}

func (b *DayTimeIntervalBuilder) Type() arrow.DataType { return arrow.FixedWidthTypes.DayTimeInterval }

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *DayTimeIntervalBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
		if b.data != nil {
			b.data.Release()
			b.data = nil
			b.rawData = nil
		}
	}
}

func (b *DayTimeIntervalBuilder) Append(v arrow.DayTimeInterval) {
	b.Reserve(1)
	b.UnsafeAppend(v)
}

func (b *DayTimeIntervalBuilder) AppendNull() {
	b.Reserve(1)
	b.UnsafeAppendBoolToBitmap(false)
}

func (b *DayTimeIntervalBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *DayTimeIntervalBuilder) AppendEmptyValue() {
	b.Append(arrow.DayTimeInterval{})
}

func (b *DayTimeIntervalBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *DayTimeIntervalBuilder) UnsafeAppend(v arrow.DayTimeInterval) {
	bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	b.rawData[b.length] = v
	b.length++
}

func (b *DayTimeIntervalBuilder) UnsafeAppendBoolToBitmap(isValid bool) {
	if isValid {
		bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	} else {
		b.nulls++
	}
	b.length++
}

// AppendValues will append the values in the v slice. The valid slice determines which values
// in v are valid (not null). The valid slice must either be empty or be equal in length to v. If empty,
// all values in v are appended and considered valid.
func (b *DayTimeIntervalBuilder) AppendValues(v []arrow.DayTimeInterval, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	arrow.DayTimeIntervalTraits.Copy(b.rawData[b.length:], v)
	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

func (b *DayTimeIntervalBuilder) init(capacity int) {
	b.builder.init(capacity)

	b.data = memory.NewResizableBuffer(b.mem)
	bytesN := arrow.DayTimeIntervalTraits.BytesRequired(capacity)
	b.data.Resize(bytesN)
	b.rawData = arrow.DayTimeIntervalTraits.CastFromBytes(b.data.Bytes())
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *DayTimeIntervalBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *DayTimeIntervalBuilder) Resize(n int) {
	nBuilder := n
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.resize(nBuilder, b.init)
		b.data.Resize(arrow.DayTimeIntervalTraits.BytesRequired(n))
		b.rawData = arrow.DayTimeIntervalTraits.CastFromBytes(b.data.Bytes())
	}
}

// NewArray creates a DayTimeInterval array from the memory buffers used by the builder and resets the DayTimeIntervalBuilder
// so it can be used to build a new array.
func (b *DayTimeIntervalBuilder) NewArray() arrow.Array {
	return b.NewDayTimeIntervalArray()
}

// NewDayTimeIntervalArray creates a DayTimeInterval array from the memory buffers used by the builder and resets the DayTimeIntervalBuilder
// so it can be used to build a new array.
func (b *DayTimeIntervalBuilder) NewDayTimeIntervalArray() (a *DayTimeInterval) {
	data := b.newData()
	a = NewDayTimeIntervalData(data)
	data.Release()
	return
}

func (b *DayTimeIntervalBuilder) newData() (data *Data) {
	bytesRequired := arrow.DayTimeIntervalTraits.BytesRequired(b.length)
	if bytesRequired > 0 && bytesRequired < b.data.Len() {
		// trim buffers
		b.data.Resize(bytesRequired)
	}
	data = NewData(arrow.FixedWidthTypes.DayTimeInterval, b.length, []*memory.Buffer{b.nullBitmap, b.data}, nil, b.nulls, 0)
	b.reset()

	if b.data != nil {
		b.data.Release()
		b.data = nil
		b.rawData = nil
	}

	return
}

func (b *DayTimeIntervalBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}
	var v arrow.DayTimeInterval
	if err := json.Unmarshal([]byte(s), &v); err != nil {
		b.AppendNull()
		return err
	}
	b.Append(v)
	return nil
}

func (b *DayTimeIntervalBuilder) UnmarshalOne(dec *json.Decoder) error {
	var v *arrow.DayTimeInterval
	if err := dec.Decode(&v); err != nil {
		return err
	}

	if v == nil {
		b.AppendNull()
	} else {
		b.Append(*v)
	}
	return nil
}

func (b *DayTimeIntervalBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

// UnmarshalJSON will add the values unmarshalled from an array to the builder,
// with the values expected to be objects of the form {"days": #, "milliseconds": #}
func (b *DayTimeIntervalBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("day_time interval builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

// A type which represents an immutable sequence of arrow.DayTimeInterval values.
type MonthDayNanoInterval struct {
	array
	values []arrow.MonthDayNanoInterval
}

func NewMonthDayNanoIntervalData(data arrow.ArrayData) *MonthDayNanoInterval {
	a := &MonthDayNanoInterval{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *MonthDayNanoInterval) Value(i int) arrow.MonthDayNanoInterval { return a.values[i] }
func (a *MonthDayNanoInterval) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}
	data, err := json.Marshal(a.GetOneForMarshal(i))
	if err != nil {
		panic(err)
	}
	return string(data)
}

func (a *MonthDayNanoInterval) MonthDayNanoIntervalValues() []arrow.MonthDayNanoInterval {
	return a.values
}

func (a *MonthDayNanoInterval) String() string {
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

func (a *MonthDayNanoInterval) setData(data *Data) {
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.values = arrow.MonthDayNanoIntervalTraits.CastFromBytes(vals.Bytes())
		beg := a.data.offset
		end := beg + a.data.length
		a.values = a.values[beg:end]
	}
}

func (a *MonthDayNanoInterval) GetOneForMarshal(i int) interface{} {
	if a.IsValid(i) {
		return a.values[i]
	}
	return nil
}

// MarshalJSON will marshal this array to a JSON array with elements
// marshalled to the form {"months": #, "days": #, "nanoseconds": #}
func (a *MonthDayNanoInterval) MarshalJSON() ([]byte, error) {
	if a.NullN() == 0 {
		return json.Marshal(a.values)
	}
	vals := make([]interface{}, a.Len())
	for i, v := range a.values {
		if a.IsValid(i) {
			vals[i] = v
		} else {
			vals[i] = nil
		}
	}
	return json.Marshal(vals)
}

func arrayEqualMonthDayNanoInterval(left, right *MonthDayNanoInterval) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if left.Value(i) != right.Value(i) {
			return false
		}
	}
	return true
}

type MonthDayNanoIntervalBuilder struct {
	builder

	data    *memory.Buffer
	rawData []arrow.MonthDayNanoInterval
}

func NewMonthDayNanoIntervalBuilder(mem memory.Allocator) *MonthDayNanoIntervalBuilder {
	mb := &MonthDayNanoIntervalBuilder{builder: builder{mem: mem}}
	mb.refCount.Add(1)
	return mb
}

func (b *MonthDayNanoIntervalBuilder) Type() arrow.DataType {
	return arrow.FixedWidthTypes.MonthDayNanoInterval
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *MonthDayNanoIntervalBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
		if b.data != nil {
			b.data.Release()
			b.data = nil
			b.rawData = nil
		}
	}
}

func (b *MonthDayNanoIntervalBuilder) Append(v arrow.MonthDayNanoInterval) {
	b.Reserve(1)
	b.UnsafeAppend(v)
}

func (b *MonthDayNanoIntervalBuilder) AppendNull() {
	b.Reserve(1)
	b.UnsafeAppendBoolToBitmap(false)
}

func (b *MonthDayNanoIntervalBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *MonthDayNanoIntervalBuilder) AppendEmptyValue() {
	b.Append(arrow.MonthDayNanoInterval{})
}

func (b *MonthDayNanoIntervalBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *MonthDayNanoIntervalBuilder) UnsafeAppend(v arrow.MonthDayNanoInterval) {
	bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	b.rawData[b.length] = v
	b.length++
}

func (b *MonthDayNanoIntervalBuilder) UnsafeAppendBoolToBitmap(isValid bool) {
	if isValid {
		bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	} else {
		b.nulls++
	}
	b.length++
}

// AppendValues will append the values in the v slice. The valid slice determines which values
// in v are valid (not null). The valid slice must either be empty or be equal in length to v. If empty,
// all values in v are appended and considered valid.
func (b *MonthDayNanoIntervalBuilder) AppendValues(v []arrow.MonthDayNanoInterval, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	arrow.MonthDayNanoIntervalTraits.Copy(b.rawData[b.length:], v)
	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

func (b *MonthDayNanoIntervalBuilder) init(capacity int) {
	b.builder.init(capacity)

	b.data = memory.NewResizableBuffer(b.mem)
	bytesN := arrow.MonthDayNanoIntervalTraits.BytesRequired(capacity)
	b.data.Resize(bytesN)
	b.rawData = arrow.MonthDayNanoIntervalTraits.CastFromBytes(b.data.Bytes())
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *MonthDayNanoIntervalBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *MonthDayNanoIntervalBuilder) Resize(n int) {
	nBuilder := n
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.resize(nBuilder, b.init)
		b.data.Resize(arrow.MonthDayNanoIntervalTraits.BytesRequired(n))
		b.rawData = arrow.MonthDayNanoIntervalTraits.CastFromBytes(b.data.Bytes())
	}
}

// NewArray creates a MonthDayNanoInterval array from the memory buffers used by the builder and resets the MonthDayNanoIntervalBuilder
// so it can be used to build a new array.
func (b *MonthDayNanoIntervalBuilder) NewArray() arrow.Array {
	return b.NewMonthDayNanoIntervalArray()
}

// NewMonthDayNanoIntervalArray creates a MonthDayNanoInterval array from the memory buffers used by the builder and resets the MonthDayNanoIntervalBuilder
// so it can be used to build a new array.
func (b *MonthDayNanoIntervalBuilder) NewMonthDayNanoIntervalArray() (a *MonthDayNanoInterval) {
	data := b.newData()
	a = NewMonthDayNanoIntervalData(data)
	data.Release()
	return
}

func (b *MonthDayNanoIntervalBuilder) newData() (data *Data) {
	bytesRequired := arrow.MonthDayNanoIntervalTraits.BytesRequired(b.length)
	if bytesRequired > 0 && bytesRequired < b.data.Len() {
		// trim buffers
		b.data.Resize(bytesRequired)
	}
	data = NewData(arrow.FixedWidthTypes.MonthDayNanoInterval, b.length, []*memory.Buffer{b.nullBitmap, b.data}, nil, b.nulls, 0)
	b.reset()

	if b.data != nil {
		b.data.Release()
		b.data = nil
		b.rawData = nil
	}

	return
}

func (b *MonthDayNanoIntervalBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}
	var v arrow.MonthDayNanoInterval
	if err := json.Unmarshal([]byte(s), &v); err != nil {
		return err
	}
	b.Append(v)
	return nil
}

func (b *MonthDayNanoIntervalBuilder) UnmarshalOne(dec *json.Decoder) error {
	var v *arrow.MonthDayNanoInterval
	if err := dec.Decode(&v); err != nil {
		return err
	}

	if v == nil {
		b.AppendNull()
	} else {
		b.Append(*v)
	}
	return nil
}

func (b *MonthDayNanoIntervalBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

// UnmarshalJSON unmarshals a JSON array of objects and adds them to this builder,
// each element of the array is expected to be an object of the form
// {"months": #, "days": #, "nanoseconds": #}
func (b *MonthDayNanoIntervalBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("month_day_nano interval builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

var (
	_ arrow.Array = (*MonthInterval)(nil)
	_ arrow.Array = (*DayTimeInterval)(nil)
	_ arrow.Array = (*MonthDayNanoInterval)(nil)

	_ Builder = (*MonthIntervalBuilder)(nil)
	_ Builder = (*DayTimeIntervalBuilder)(nil)
	_ Builder = (*MonthDayNanoIntervalBuilder)(nil)

	_ arrow.TypedArray[arrow.MonthInterval]        = (*MonthInterval)(nil)
	_ arrow.TypedArray[arrow.DayTimeInterval]      = (*DayTimeInterval)(nil)
	_ arrow.TypedArray[arrow.MonthDayNanoInterval] = (*MonthDayNanoInterval)(nil)
)
