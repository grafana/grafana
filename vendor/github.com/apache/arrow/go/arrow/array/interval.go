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

package array // import "github.com/apache/arrow/go/arrow/array"

import (
	"fmt"
	"strings"
	"sync/atomic"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/internal/bitutil"
	"github.com/apache/arrow/go/arrow/internal/debug"
	"github.com/apache/arrow/go/arrow/memory"
	"github.com/pkg/errors"
)

func NewIntervalData(data *Data) Interface {
	switch data.dtype.(type) {
	case *arrow.MonthIntervalType:
		return NewMonthIntervalData(data)
	case *arrow.DayTimeIntervalType:
		return NewDayTimeIntervalData(data)
	default:
		panic(errors.Errorf("arrow/array: unknown interval data type %T", data.dtype))
	}
}

// A type which represents an immutable sequence of arrow.MonthInterval values.
type MonthInterval struct {
	array
	values []arrow.MonthInterval
}

func NewMonthIntervalData(data *Data) *MonthInterval {
	a := &MonthInterval{}
	a.refCount = 1
	a.setData(data)
	return a
}

func (a *MonthInterval) Value(i int) arrow.MonthInterval            { return a.values[i] }
func (a *MonthInterval) MonthIntervalValues() []arrow.MonthInterval { return a.values }

func (a *MonthInterval) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i, v := range a.values {
		if i > 0 {
			fmt.Fprintf(o, " ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString("(null)")
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
		beg := a.array.data.offset
		end := beg + a.array.data.length
		a.values = a.values[beg:end]
	}
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
	return &MonthIntervalBuilder{builder: builder{refCount: 1, mem: mem}}
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *MonthIntervalBuilder) Release() {
	debug.Assert(atomic.LoadInt64(&b.refCount) > 0, "too many releases")

	if atomic.AddInt64(&b.refCount, -1) == 0 {
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
	b.builder.unsafeAppendBoolsToBitmap(valid, len(v))
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
	b.builder.reserve(n, b.Resize)
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
		b.builder.resize(nBuilder, b.init)
		b.data.Resize(arrow.MonthIntervalTraits.BytesRequired(n))
		b.rawData = arrow.MonthIntervalTraits.CastFromBytes(b.data.Bytes())
	}
}

// NewArray creates a MonthInterval array from the memory buffers used by the builder and resets the MonthIntervalBuilder
// so it can be used to build a new array.
func (b *MonthIntervalBuilder) NewArray() Interface {
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

// A type which represents an immutable sequence of arrow.DayTimeInterval values.
type DayTimeInterval struct {
	array
	values []arrow.DayTimeInterval
}

func NewDayTimeIntervalData(data *Data) *DayTimeInterval {
	a := &DayTimeInterval{}
	a.refCount = 1
	a.setData(data)
	return a
}

func (a *DayTimeInterval) Value(i int) arrow.DayTimeInterval              { return a.values[i] }
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
			o.WriteString("(null)")
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
		beg := a.array.data.offset
		end := beg + a.array.data.length
		a.values = a.values[beg:end]
	}
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
	return &DayTimeIntervalBuilder{builder: builder{refCount: 1, mem: mem}}
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *DayTimeIntervalBuilder) Release() {
	debug.Assert(atomic.LoadInt64(&b.refCount) > 0, "too many releases")

	if atomic.AddInt64(&b.refCount, -1) == 0 {
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
	b.builder.unsafeAppendBoolsToBitmap(valid, len(v))
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
	b.builder.reserve(n, b.Resize)
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
		b.builder.resize(nBuilder, b.init)
		b.data.Resize(arrow.DayTimeIntervalTraits.BytesRequired(n))
		b.rawData = arrow.DayTimeIntervalTraits.CastFromBytes(b.data.Bytes())
	}
}

// NewArray creates a DayTimeInterval array from the memory buffers used by the builder and resets the DayTimeIntervalBuilder
// so it can be used to build a new array.
func (b *DayTimeIntervalBuilder) NewArray() Interface {
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

var (
	_ Interface = (*MonthInterval)(nil)
	_ Interface = (*DayTimeInterval)(nil)

	_ Builder = (*MonthIntervalBuilder)(nil)
	_ Builder = (*DayTimeIntervalBuilder)(nil)
)
