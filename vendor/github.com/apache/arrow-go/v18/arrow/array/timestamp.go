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
	"reflect"
	"strings"
	"time"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// Timestamp represents an immutable sequence of arrow.Timestamp values.
type Timestamp struct {
	array
	values []arrow.Timestamp
	layout string
}

// NewTimestampData creates a new Timestamp from Data.
func NewTimestampData(data arrow.ArrayData) *Timestamp {
	return NewTimestampDataWithValueStrLayout(data, time.RFC3339Nano)
}

// NewTimestampDataWithValueStrLayout creates a new Timestamp from Data with a custom ValueStr layout.
// The layout is passed to the time.Time.Format method.
// This is useful for cases where consumers expect a non standard layout
func NewTimestampDataWithValueStrLayout(data arrow.ArrayData, layout string) *Timestamp {
	a := &Timestamp{layout: layout}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

// Reset resets the array for re-use.
func (a *Timestamp) Reset(data *Data) {
	a.setData(data)
}

// Value returns the value at the specified index.
func (a *Timestamp) Value(i int) arrow.Timestamp { return a.values[i] }

func (a *Timestamp) Values() []arrow.Timestamp { return a.values }

// TimestampValues returns the values.
func (a *Timestamp) TimestampValues() []arrow.Timestamp { return a.Values() }

// String returns a string representation of the array.
func (a *Timestamp) String() string {
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

func (a *Timestamp) setData(data *Data) {
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.values = arrow.TimestampTraits.CastFromBytes(vals.Bytes())
		beg := a.data.offset
		end := beg + a.data.length
		a.values = a.values[beg:end]
	}
}

func (a *Timestamp) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}

	toTime, _ := a.DataType().(*arrow.TimestampType).GetToTimeFunc()
	layout := a.layout
	if layout == "" {
		layout = time.RFC3339Nano
	}
	return toTime(a.values[i]).Format(layout)
}

func (a *Timestamp) GetOneForMarshal(i int) interface{} {
	if val := a.ValueStr(i); val != NullValueStr {
		return val
	}
	return nil
}

func (a *Timestamp) MarshalJSON() ([]byte, error) {
	vals := make([]interface{}, a.Len())
	for i := range a.values {
		vals[i] = a.GetOneForMarshal(i)
	}

	return json.Marshal(vals)
}

func arrayEqualTimestamp(left, right *Timestamp) bool {
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

type TimestampBuilder struct {
	builder

	dtype   *arrow.TimestampType
	data    *memory.Buffer
	rawData []arrow.Timestamp
	layout  string
}

func NewTimestampBuilder(mem memory.Allocator, dtype *arrow.TimestampType) *TimestampBuilder {
	return NewTimestampBuilderWithValueStrLayout(mem, dtype, time.RFC3339Nano)
}

// NewTimestampBuilderWithValueStrLayout creates a new TimestampBuilder with a custom ValueStr layout.
// The layout is passed to the time.Time.Format method.
// This is useful for cases where consumers expect a non standard layout
func NewTimestampBuilderWithValueStrLayout(mem memory.Allocator, dtype *arrow.TimestampType, layout string) *TimestampBuilder {
	tb := &TimestampBuilder{builder: builder{mem: mem}, dtype: dtype, layout: layout}
	tb.refCount.Add(1)
	return tb
}

func (b *TimestampBuilder) Type() arrow.DataType { return b.dtype }

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *TimestampBuilder) Release() {
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

func (b *TimestampBuilder) AppendTime(t time.Time) {
	ts, err := arrow.TimestampFromTime(t, b.dtype.Unit)
	if err != nil {
		panic(err)
	}
	b.Append(ts)
}

func (b *TimestampBuilder) Append(v arrow.Timestamp) {
	b.Reserve(1)
	b.UnsafeAppend(v)
}

func (b *TimestampBuilder) AppendNull() {
	b.Reserve(1)
	b.UnsafeAppendBoolToBitmap(false)
}

func (b *TimestampBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *TimestampBuilder) AppendEmptyValue() {
	b.Append(0)
}

func (b *TimestampBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *TimestampBuilder) UnsafeAppend(v arrow.Timestamp) {
	bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	b.rawData[b.length] = v
	b.length++
}

func (b *TimestampBuilder) UnsafeAppendBoolToBitmap(isValid bool) {
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
func (b *TimestampBuilder) AppendValues(v []arrow.Timestamp, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	arrow.TimestampTraits.Copy(b.rawData[b.length:], v)
	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

func (b *TimestampBuilder) init(capacity int) {
	b.builder.init(capacity)

	b.data = memory.NewResizableBuffer(b.mem)
	bytesN := arrow.TimestampTraits.BytesRequired(capacity)
	b.data.Resize(bytesN)
	b.rawData = arrow.TimestampTraits.CastFromBytes(b.data.Bytes())
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *TimestampBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *TimestampBuilder) Resize(n int) {
	nBuilder := n
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.resize(nBuilder, b.init)
		b.data.Resize(arrow.TimestampTraits.BytesRequired(n))
		b.rawData = arrow.TimestampTraits.CastFromBytes(b.data.Bytes())
	}
}

// NewArray creates a Timestamp array from the memory buffers used by the builder and resets the TimestampBuilder
// so it can be used to build a new array.
func (b *TimestampBuilder) NewArray() arrow.Array {
	return b.NewTimestampArray()
}

// NewTimestampArray creates a Timestamp array from the memory buffers used by the builder and resets the TimestampBuilder
// so it can be used to build a new array.
func (b *TimestampBuilder) NewTimestampArray() (a *Timestamp) {
	data := b.newData()
	a = NewTimestampDataWithValueStrLayout(data, b.layout)
	data.Release()
	return
}

func (b *TimestampBuilder) newData() (data *Data) {
	bytesRequired := arrow.TimestampTraits.BytesRequired(b.length)
	if bytesRequired > 0 && bytesRequired < b.data.Len() {
		// trim buffers
		b.data.Resize(bytesRequired)
	}
	data = NewData(b.dtype, b.length, []*memory.Buffer{b.nullBitmap, b.data}, nil, b.nulls, 0)
	b.reset()

	if b.data != nil {
		b.data.Release()
		b.data = nil
		b.rawData = nil
	}

	return
}

func (b *TimestampBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}

	loc, err := b.dtype.GetZone()
	if err != nil {
		return err
	}

	v, _, err := arrow.TimestampFromStringInLocation(s, b.dtype.Unit, loc)
	if err != nil {
		b.AppendNull()
		return err
	}
	b.Append(v)
	return nil
}

func (b *TimestampBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch v := t.(type) {
	case nil:
		b.AppendNull()
	case string:
		loc, _ := b.dtype.GetZone()
		tm, _, err := arrow.TimestampFromStringInLocation(v, b.dtype.Unit, loc)
		if err != nil {
			return &json.UnmarshalTypeError{
				Value:  v,
				Type:   reflect.TypeOf(arrow.Timestamp(0)),
				Offset: dec.InputOffset(),
			}
		}

		b.Append(tm)
	case json.Number:
		n, err := v.Int64()
		if err != nil {
			return &json.UnmarshalTypeError{
				Value:  v.String(),
				Type:   reflect.TypeOf(arrow.Timestamp(0)),
				Offset: dec.InputOffset(),
			}
		}
		b.Append(arrow.Timestamp(n))
	case float64:
		b.Append(arrow.Timestamp(v))

	default:
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(t),
			Type:   reflect.TypeOf(arrow.Timestamp(0)),
			Offset: dec.InputOffset(),
		}
	}

	return nil
}

func (b *TimestampBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *TimestampBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("binary builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

var (
	_ arrow.Array                       = (*Timestamp)(nil)
	_ Builder                           = (*TimestampBuilder)(nil)
	_ arrow.TypedArray[arrow.Timestamp] = (*Timestamp)(nil)
)
