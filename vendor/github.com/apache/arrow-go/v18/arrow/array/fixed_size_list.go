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
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// FixedSizeList represents an immutable sequence of N array values.
type FixedSizeList struct {
	array
	n      int32
	values arrow.Array
}

var _ ListLike = (*FixedSizeList)(nil)

// NewFixedSizeListData returns a new List array value, from data.
func NewFixedSizeListData(data arrow.ArrayData) *FixedSizeList {
	a := &FixedSizeList{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *FixedSizeList) ListValues() arrow.Array { return a.values }

func (a *FixedSizeList) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}
	return string(a.GetOneForMarshal(i).(json.RawMessage))
}

func (a *FixedSizeList) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		if !a.IsValid(i) {
			o.WriteString(NullValueStr)
			continue
		}
		sub := a.newListValue(i)
		fmt.Fprintf(o, "%v", sub)
		sub.Release()
	}
	o.WriteString("]")
	return o.String()
}

func (a *FixedSizeList) newListValue(i int) arrow.Array {
	beg, end := a.ValueOffsets(i)
	return NewSlice(a.values, beg, end)
}

func (a *FixedSizeList) setData(data *Data) {
	a.array.setData(data)
	a.n = a.DataType().(*arrow.FixedSizeListType).Len()
	a.values = MakeFromData(data.childData[0])
}

func arrayEqualFixedSizeList(left, right *FixedSizeList) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		o := func() bool {
			l := left.newListValue(i)
			defer l.Release()
			r := right.newListValue(i)
			defer r.Release()
			return Equal(l, r)
		}()
		if !o {
			return false
		}
	}
	return true
}

// Len returns the number of elements in the array.
func (a *FixedSizeList) Len() int { return a.array.Len() }

func (a *FixedSizeList) ValueOffsets(i int) (start, end int64) {
	n := int64(a.n)
	off := int64(a.data.offset)
	start, end = (off+int64(i))*n, (off+int64(i+1))*n
	return
}

func (a *FixedSizeList) Retain() {
	a.array.Retain()
	a.values.Retain()
}

func (a *FixedSizeList) Release() {
	a.array.Release()
	a.values.Release()
}

func (a *FixedSizeList) GetOneForMarshal(i int) interface{} {
	if a.IsNull(i) {
		return nil
	}
	slice := a.newListValue(i)
	defer slice.Release()
	v, err := json.Marshal(slice)
	if err != nil {
		panic(err)
	}

	return json.RawMessage(v)
}

func (a *FixedSizeList) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)

	buf.WriteByte('[')
	for i := 0; i < a.Len(); i++ {
		if i != 0 {
			buf.WriteByte(',')
		}
		if a.IsNull(i) {
			enc.Encode(nil)
			continue
		}

		slice := a.newListValue(i)
		if err := enc.Encode(slice); err != nil {
			return nil, err
		}
		slice.Release()
	}
	buf.WriteByte(']')
	return buf.Bytes(), nil
}

type FixedSizeListBuilder struct {
	baseListBuilder
	n int32 // number of elements in the fixed-size list.
}

// NewFixedSizeListBuilder returns a builder, using the provided memory allocator.
// The created list builder will create a list whose elements will be of type etype.
func NewFixedSizeListBuilder(mem memory.Allocator, n int32, etype arrow.DataType) *FixedSizeListBuilder {
	fslb := &FixedSizeListBuilder{
		baseListBuilder{
			builder: builder{mem: mem},
			values:  NewBuilder(mem, etype),
			dt:      arrow.FixedSizeListOf(n, etype),
		},
		n,
	}
	fslb.refCount.Add(1)
	return fslb
}

// NewFixedSizeListBuilderWithField returns a builder similarly to
// NewFixedSizeListBuilder, but it accepts a child rather than just a datatype
// to ensure nullability context is preserved.
func NewFixedSizeListBuilderWithField(mem memory.Allocator, n int32, field arrow.Field) *FixedSizeListBuilder {
	fslb := &FixedSizeListBuilder{
		baseListBuilder{
			builder: builder{mem: mem},
			values:  NewBuilder(mem, field.Type),
			dt:      arrow.FixedSizeListOfField(n, field),
		},
		n,
	}

	fslb.refCount.Add(1)
	return fslb
}

func (b *FixedSizeListBuilder) Type() arrow.DataType { return b.dt }

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *FixedSizeListBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
		if b.values != nil {
			b.values.Release()
			b.values = nil
		}
	}
}

func (b *FixedSizeListBuilder) Append(v bool) {
	b.Reserve(1)
	b.unsafeAppendBoolToBitmap(v)
}

// AppendNull will append null values to the underlying values by itself
func (b *FixedSizeListBuilder) AppendNull() {
	b.Reserve(1)
	b.unsafeAppendBoolToBitmap(false)
	// require to append this due to value indexes
	for i := int32(0); i < b.n; i++ {
		b.values.AppendNull()
	}
}

// AppendNulls will append n null values to the underlying values by itself
func (b *FixedSizeListBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *FixedSizeListBuilder) AppendEmptyValue() {
	b.Append(true)
	for i := int32(0); i < b.n; i++ {
		b.values.AppendEmptyValue()
	}
}

func (b *FixedSizeListBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *FixedSizeListBuilder) AppendValues(valid []bool) {
	b.Reserve(len(valid))
	b.unsafeAppendBoolsToBitmap(valid, len(valid))
}

func (b *FixedSizeListBuilder) unsafeAppendBoolToBitmap(isValid bool) {
	if isValid {
		bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	} else {
		b.nulls++
	}
	b.length++
}

func (b *FixedSizeListBuilder) init(capacity int) {
	b.builder.init(capacity)
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *FixedSizeListBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *FixedSizeListBuilder) Resize(n int) {
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.resize(n, b.builder.init)
	}
}

func (b *FixedSizeListBuilder) ValueBuilder() Builder {
	return b.values
}

// NewArray creates a List array from the memory buffers used by the builder and resets the FixedSizeListBuilder
// so it can be used to build a new array.
func (b *FixedSizeListBuilder) NewArray() arrow.Array {
	return b.NewListArray()
}

// NewListArray creates a List array from the memory buffers used by the builder and resets the FixedSizeListBuilder
// so it can be used to build a new array.
func (b *FixedSizeListBuilder) NewListArray() (a *FixedSizeList) {
	data := b.newData()
	a = NewFixedSizeListData(data)
	data.Release()
	return
}

func (b *FixedSizeListBuilder) newData() (data *Data) {
	values := b.values.NewArray()
	defer values.Release()

	data = NewData(
		b.dt, b.length,
		[]*memory.Buffer{b.nullBitmap},
		[]arrow.ArrayData{values.Data()},
		b.nulls,
		0,
	)
	b.reset()

	return
}

func (b *FixedSizeListBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}
	dec := json.NewDecoder(strings.NewReader(s))
	return b.UnmarshalOne(dec)
}

func (b *FixedSizeListBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch t {
	case json.Delim('['):
		b.Append(true)
		if err := b.values.Unmarshal(dec); err != nil {
			return err
		}
		// consume ']'
		_, err := dec.Token()
		return err
	case nil:
		b.AppendNull()
	default:
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(t),
			Struct: b.dt.String(),
		}
	}

	return nil
}

func (b *FixedSizeListBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *FixedSizeListBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("fixed size list builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

var (
	_ arrow.Array = (*FixedSizeList)(nil)
	_ Builder     = (*FixedSizeListBuilder)(nil)
)
