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
	"strconv"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

type BooleanBuilder struct {
	builder

	data    *memory.Buffer
	rawData []byte
}

func NewBooleanBuilder(mem memory.Allocator) *BooleanBuilder {
	bb := &BooleanBuilder{builder: builder{mem: mem}}
	bb.refCount.Add(1)
	return bb
}

func (b *BooleanBuilder) Type() arrow.DataType { return arrow.FixedWidthTypes.Boolean }

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (b *BooleanBuilder) Release() {
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

func (b *BooleanBuilder) Append(v bool) {
	b.Reserve(1)
	b.UnsafeAppend(v)
}

func (b *BooleanBuilder) AppendByte(v byte) {
	b.Reserve(1)
	b.UnsafeAppend(v != 0)
}

func (b *BooleanBuilder) AppendNull() {
	b.Reserve(1)
	b.UnsafeAppendBoolToBitmap(false)
}

func (b *BooleanBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *BooleanBuilder) AppendEmptyValue() {
	b.Reserve(1)
	b.UnsafeAppend(false)
}

func (b *BooleanBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *BooleanBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}
	val, err := strconv.ParseBool(s)
	if err != nil {
		return err
	}
	b.Append(val)
	return nil
}

func (b *BooleanBuilder) UnsafeAppend(v bool) {
	bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	if v {
		bitutil.SetBit(b.rawData, b.length)
	} else {
		bitutil.ClearBit(b.rawData, b.length)
	}
	b.length++
}

func (b *BooleanBuilder) AppendValues(v []bool, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	for i, vv := range v {
		bitutil.SetBitTo(b.rawData, b.length+i, vv)
	}
	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

func (b *BooleanBuilder) init(capacity int) {
	b.builder.init(capacity)

	b.data = memory.NewResizableBuffer(b.mem)
	bytesN := arrow.BooleanTraits.BytesRequired(capacity)
	b.data.Resize(bytesN)
	b.rawData = b.data.Bytes()
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *BooleanBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *BooleanBuilder) Resize(n int) {
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.resize(n, b.init)
		b.data.Resize(arrow.BooleanTraits.BytesRequired(n))
		b.rawData = b.data.Bytes()
	}
}

// NewArray creates a Boolean array from the memory buffers used by the builder and resets the BooleanBuilder
// so it can be used to build a new array.
func (b *BooleanBuilder) NewArray() arrow.Array {
	return b.NewBooleanArray()
}

// NewBooleanArray creates a Boolean array from the memory buffers used by the builder and resets the BooleanBuilder
// so it can be used to build a new array.
func (b *BooleanBuilder) NewBooleanArray() (a *Boolean) {
	data := b.newData()
	a = NewBooleanData(data)
	data.Release()
	return
}

func (b *BooleanBuilder) newData() *Data {
	bytesRequired := arrow.BooleanTraits.BytesRequired(b.length)
	if bytesRequired > 0 && bytesRequired < b.data.Len() {
		// trim buffers
		b.data.Resize(bytesRequired)
	}
	res := NewData(arrow.FixedWidthTypes.Boolean, b.length, []*memory.Buffer{b.nullBitmap, b.data}, nil, b.nulls, 0)
	b.reset()

	if b.data != nil {
		b.data.Release()
		b.data = nil
		b.rawData = nil
	}

	return res
}

func (b *BooleanBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch v := t.(type) {
	case bool:
		b.Append(v)
	case string:
		val, err := strconv.ParseBool(v)
		if err != nil {
			return err
		}
		b.Append(val)
	case json.Number:
		val, err := strconv.ParseBool(v.String())
		if err != nil {
			return err
		}
		b.Append(val)
	case nil:
		b.AppendNull()
	default:
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(t),
			Type:   reflect.TypeOf(true),
			Offset: dec.InputOffset(),
		}
	}
	return nil
}

func (b *BooleanBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *BooleanBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("boolean builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

func (b *BooleanBuilder) Value(i int) bool {
	return bitutil.BitIsSet(b.rawData, i)
}

var _ Builder = (*BooleanBuilder)(nil)
