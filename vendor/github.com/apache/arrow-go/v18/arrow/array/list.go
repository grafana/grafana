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

type ListLike interface {
	arrow.Array
	ListValues() arrow.Array
	ValueOffsets(i int) (start, end int64)
}

type VarLenListLike interface {
	ListLike
}

// List represents an immutable sequence of array values.
type List struct {
	array
	values  arrow.Array
	offsets []int32
}

var _ ListLike = (*List)(nil)

// NewListData returns a new List array value, from data.
func NewListData(data arrow.ArrayData) *List {
	a := &List{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *List) ListValues() arrow.Array { return a.values }

func (a *List) ValueStr(i int) string {
	if !a.IsValid(i) {
		return NullValueStr
	}
	return string(a.GetOneForMarshal(i).(json.RawMessage))
}

func (a *List) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		if a.IsNull(i) {
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

func (a *List) newListValue(i int) arrow.Array {
	beg, end := a.ValueOffsets(i)
	return NewSlice(a.values, beg, end)
}

func (a *List) setData(data *Data) {
	debug.Assert(len(data.buffers) >= 2, "list data should have 2 buffers")
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.offsets = arrow.Int32Traits.CastFromBytes(vals.Bytes())
	}
	a.values = MakeFromData(data.childData[0])
}

func (a *List) GetOneForMarshal(i int) interface{} {
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

func (a *List) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)

	buf.WriteByte('[')
	for i := 0; i < a.Len(); i++ {
		if i != 0 {
			buf.WriteByte(',')
		}
		if err := enc.Encode(a.GetOneForMarshal(i)); err != nil {
			return nil, err
		}
	}
	buf.WriteByte(']')
	return buf.Bytes(), nil
}

func arrayEqualList(left, right *List) bool {
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
func (a *List) Len() int { return a.array.Len() }

func (a *List) Offsets() []int32 { return a.offsets }

func (a *List) Retain() {
	a.array.Retain()
	a.values.Retain()
}

func (a *List) Release() {
	a.array.Release()
	a.values.Release()
}

func (a *List) ValueOffsets(i int) (start, end int64) {
	debug.Assert(i >= 0 && i < a.data.length, "index out of range")
	j := i + a.data.offset
	start, end = int64(a.offsets[j]), int64(a.offsets[j+1])
	return
}

// LargeList represents an immutable sequence of array values.
type LargeList struct {
	array
	values  arrow.Array
	offsets []int64
}

var _ ListLike = (*LargeList)(nil)

// NewLargeListData returns a new LargeList array value, from data.
func NewLargeListData(data arrow.ArrayData) *LargeList {
	a := new(LargeList)
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *LargeList) ListValues() arrow.Array { return a.values }

func (a *LargeList) ValueStr(i int) string {
	if !a.IsValid(i) {
		return NullValueStr
	}
	return string(a.GetOneForMarshal(i).(json.RawMessage))
}

func (a *LargeList) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		if a.IsNull(i) {
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

func (a *LargeList) newListValue(i int) arrow.Array {
	beg, end := a.ValueOffsets(i)
	return NewSlice(a.values, beg, end)
}

func (a *LargeList) setData(data *Data) {
	debug.Assert(len(data.buffers) >= 2, "list data should have 2 buffers")
	a.array.setData(data)
	vals := data.buffers[1]
	if vals != nil {
		a.offsets = arrow.Int64Traits.CastFromBytes(vals.Bytes())
	}
	a.values = MakeFromData(data.childData[0])
}

func (a *LargeList) GetOneForMarshal(i int) interface{} {
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

func (a *LargeList) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)

	buf.WriteByte('[')
	for i := 0; i < a.Len(); i++ {
		if i != 0 {
			buf.WriteByte(',')
		}
		if err := enc.Encode(a.GetOneForMarshal(i)); err != nil {
			return nil, err
		}
	}
	buf.WriteByte(']')
	return buf.Bytes(), nil
}

func arrayEqualLargeList(left, right *LargeList) bool {
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
func (a *LargeList) Len() int { return a.array.Len() }

func (a *LargeList) Offsets() []int64 { return a.offsets }

func (a *LargeList) ValueOffsets(i int) (start, end int64) {
	debug.Assert(i >= 0 && i < a.data.length, "index out of range")
	j := i + a.data.offset
	start, end = a.offsets[j], a.offsets[j+1]
	return
}

func (a *LargeList) Retain() {
	a.array.Retain()
	a.values.Retain()
}

func (a *LargeList) Release() {
	a.array.Release()
	a.values.Release()
}

type baseListBuilder struct {
	builder

	values  Builder // value builder for the list's elements.
	offsets Builder

	// actual list type
	dt              arrow.DataType
	appendOffsetVal func(int)
}

type ListLikeBuilder interface {
	Builder
	ValueBuilder() Builder
	Append(bool)
}

type VarLenListLikeBuilder interface {
	ListLikeBuilder
	AppendWithSize(bool, int)
}

type ListBuilder struct {
	baseListBuilder
}

type LargeListBuilder struct {
	baseListBuilder
}

// NewListBuilder returns a builder, using the provided memory allocator.
// The created list builder will create a list whose elements will be of type etype.
func NewListBuilder(mem memory.Allocator, etype arrow.DataType) *ListBuilder {
	offsetBldr := NewInt32Builder(mem)
	lb := &ListBuilder{
		baseListBuilder{
			builder:         builder{mem: mem},
			values:          NewBuilder(mem, etype),
			offsets:         offsetBldr,
			dt:              arrow.ListOf(etype),
			appendOffsetVal: func(o int) { offsetBldr.Append(int32(o)) },
		},
	}
	lb.refCount.Add(1)
	return lb
}

// NewListBuilderWithField takes a field to use for the child rather than just
// a datatype to allow for more customization.
func NewListBuilderWithField(mem memory.Allocator, field arrow.Field) *ListBuilder {
	offsetBldr := NewInt32Builder(mem)
	lb := &ListBuilder{
		baseListBuilder{
			builder:         builder{mem: mem},
			values:          NewBuilder(mem, field.Type),
			offsets:         offsetBldr,
			dt:              arrow.ListOfField(field),
			appendOffsetVal: func(o int) { offsetBldr.Append(int32(o)) },
		},
	}
	lb.refCount.Add(1)
	return lb
}

func (b *baseListBuilder) Type() arrow.DataType {
	switch dt := b.dt.(type) {
	case *arrow.ListType:
		f := dt.ElemField()
		f.Type = b.values.Type()
		return arrow.ListOfField(f)
	case *arrow.LargeListType:
		f := dt.ElemField()
		f.Type = b.values.Type()
		return arrow.LargeListOfField(f)
	}
	return nil
}

// NewLargeListBuilder returns a builder, using the provided memory allocator.
// The created list builder will create a list whose elements will be of type etype.
func NewLargeListBuilder(mem memory.Allocator, etype arrow.DataType) *LargeListBuilder {
	offsetBldr := NewInt64Builder(mem)
	llb := &LargeListBuilder{
		baseListBuilder{
			builder:         builder{mem: mem},
			values:          NewBuilder(mem, etype),
			offsets:         offsetBldr,
			dt:              arrow.LargeListOf(etype),
			appendOffsetVal: func(o int) { offsetBldr.Append(int64(o)) },
		},
	}
	llb.refCount.Add(1)
	return llb
}

// NewLargeListBuilderWithField takes a field rather than just an element type
// to allow for more customization of the final type of the LargeList Array
func NewLargeListBuilderWithField(mem memory.Allocator, field arrow.Field) *LargeListBuilder {
	offsetBldr := NewInt64Builder(mem)
	llb := &LargeListBuilder{
		baseListBuilder{
			builder:         builder{mem: mem},
			values:          NewBuilder(mem, field.Type),
			offsets:         offsetBldr,
			dt:              arrow.LargeListOfField(field),
			appendOffsetVal: func(o int) { offsetBldr.Append(int64(o)) },
		},
	}
	llb.refCount.Add(1)
	return llb
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *baseListBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
		b.values.Release()
		b.offsets.Release()
	}
}

func (b *baseListBuilder) appendNextOffset() {
	b.appendOffsetVal(b.values.Len())
}

func (b *baseListBuilder) Append(v bool) {
	b.Reserve(1)
	b.unsafeAppendBoolToBitmap(v)
	b.appendNextOffset()
}

func (b *baseListBuilder) AppendWithSize(v bool, _ int) {
	b.Append(v)
}

func (b *baseListBuilder) AppendNull() {
	b.Reserve(1)
	b.unsafeAppendBoolToBitmap(false)
	b.appendNextOffset()
}

func (b *baseListBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *baseListBuilder) AppendEmptyValue() {
	b.Append(true)
}

func (b *baseListBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *ListBuilder) AppendValues(offsets []int32, valid []bool) {
	b.Reserve(len(valid))
	b.offsets.(*Int32Builder).AppendValues(offsets, nil)
	b.unsafeAppendBoolsToBitmap(valid, len(valid))
}

func (b *LargeListBuilder) AppendValues(offsets []int64, valid []bool) {
	b.Reserve(len(valid))
	b.offsets.(*Int64Builder).AppendValues(offsets, nil)
	b.unsafeAppendBoolsToBitmap(valid, len(valid))
}

func (b *baseListBuilder) unsafeAppendBoolToBitmap(isValid bool) {
	if isValid {
		bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	} else {
		b.nulls++
	}
	b.length++
}

func (b *baseListBuilder) init(capacity int) {
	b.builder.init(capacity)
	b.offsets.init(capacity + 1)
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *baseListBuilder) Reserve(n int) {
	b.reserve(n, b.resizeHelper)
	b.offsets.Reserve(n)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *baseListBuilder) Resize(n int) {
	b.resizeHelper(n)
	b.offsets.Resize(n)
}

func (b *baseListBuilder) resizeHelper(n int) {
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.resize(n, b.builder.init)
	}
}

func (b *baseListBuilder) ValueBuilder() Builder {
	return b.values
}

// NewArray creates a List array from the memory buffers used by the builder and resets the ListBuilder
// so it can be used to build a new array.
func (b *ListBuilder) NewArray() arrow.Array {
	return b.NewListArray()
}

// NewArray creates a LargeList array from the memory buffers used by the builder and resets the LargeListBuilder
// so it can be used to build a new array.
func (b *LargeListBuilder) NewArray() arrow.Array {
	return b.NewLargeListArray()
}

// NewListArray creates a List array from the memory buffers used by the builder and resets the ListBuilder
// so it can be used to build a new array.
func (b *ListBuilder) NewListArray() (a *List) {
	data := b.newData()
	a = NewListData(data)
	data.Release()
	return
}

// NewLargeListArray creates a List array from the memory buffers used by the builder and resets the LargeListBuilder
// so it can be used to build a new array.
func (b *LargeListBuilder) NewLargeListArray() (a *LargeList) {
	data := b.newData()
	a = NewLargeListData(data)
	data.Release()
	return
}

func (b *baseListBuilder) newData() (data *Data) {
	if b.offsets.Len() != b.length+1 {
		b.appendNextOffset()
	}
	values := b.values.NewArray()
	defer values.Release()

	var offsets *memory.Buffer
	if b.offsets != nil {
		arr := b.offsets.NewArray()
		defer arr.Release()
		offsets = arr.Data().Buffers()[1]
	}

	data = NewData(
		b.Type(), b.length,
		[]*memory.Buffer{
			b.nullBitmap,
			offsets,
		},
		[]arrow.ArrayData{values.Data()},
		b.nulls,
		0,
	)
	b.reset()

	return
}

func (b *baseListBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}

	return b.UnmarshalOne(json.NewDecoder(strings.NewReader(s)))
}

func (b *baseListBuilder) UnmarshalOne(dec *json.Decoder) error {
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

func (b *baseListBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *baseListBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("list builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

// ListView represents an immutable sequence of array values defined by an
// offset into a child array and a length.
type ListView struct {
	array
	values  arrow.Array
	offsets []int32
	sizes   []int32
}

var _ VarLenListLike = (*ListView)(nil)

func NewListViewData(data arrow.ArrayData) *ListView {
	a := &ListView{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *ListView) ListValues() arrow.Array { return a.values }

func (a *ListView) ValueStr(i int) string {
	if !a.IsValid(i) {
		return NullValueStr
	}
	return string(a.GetOneForMarshal(i).(json.RawMessage))
}

func (a *ListView) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		if a.IsNull(i) {
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

func (a *ListView) newListValue(i int) arrow.Array {
	beg, end := a.ValueOffsets(i)
	return NewSlice(a.values, beg, end)
}

func (a *ListView) setData(data *Data) {
	debug.Assert(len(data.buffers) >= 3, "list-view data should have 3 buffers")
	a.array.setData(data)
	offsets := data.buffers[1]
	if offsets != nil {
		a.offsets = arrow.Int32Traits.CastFromBytes(offsets.Bytes())
	}
	sizes := data.buffers[2]
	if sizes != nil {
		a.sizes = arrow.Int32Traits.CastFromBytes(sizes.Bytes())
	}
	a.values = MakeFromData(data.childData[0])
}

func (a *ListView) GetOneForMarshal(i int) interface{} {
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

func (a *ListView) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)

	buf.WriteByte('[')
	for i := 0; i < a.Len(); i++ {
		if i != 0 {
			buf.WriteByte(',')
		}
		if err := enc.Encode(a.GetOneForMarshal(i)); err != nil {
			return nil, err
		}
	}
	buf.WriteByte(']')
	return buf.Bytes(), nil
}

func arrayEqualListView(left, right *ListView) bool {
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
func (a *ListView) Len() int { return a.array.Len() }

func (a *ListView) Offsets() []int32 { return a.offsets }

func (a *ListView) Sizes() []int32 { return a.sizes }

func (a *ListView) Retain() {
	a.array.Retain()
	a.values.Retain()
}

func (a *ListView) Release() {
	a.array.Release()
	a.values.Release()
}

func (a *ListView) ValueOffsets(i int) (start, end int64) {
	debug.Assert(i >= 0 && i < a.data.length, "index out of range")
	j := i + a.data.offset
	size := int64(a.sizes[j])
	// If size is 0, skip accessing offsets.
	if size == 0 {
		start, end = 0, 0
		return
	}
	start = int64(a.offsets[j])
	end = start + size
	return
}

// LargeListView represents an immutable sequence of array values defined by an
// offset into a child array and a length.
type LargeListView struct {
	array
	values  arrow.Array
	offsets []int64
	sizes   []int64
}

var _ VarLenListLike = (*LargeListView)(nil)

// NewLargeListViewData returns a new LargeListView array value, from data.
func NewLargeListViewData(data arrow.ArrayData) *LargeListView {
	a := new(LargeListView)
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *LargeListView) ListValues() arrow.Array { return a.values }

func (a *LargeListView) ValueStr(i int) string {
	if !a.IsValid(i) {
		return NullValueStr
	}
	return string(a.GetOneForMarshal(i).(json.RawMessage))
}

func (a *LargeListView) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		if a.IsNull(i) {
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

func (a *LargeListView) newListValue(i int) arrow.Array {
	beg, end := a.ValueOffsets(i)
	return NewSlice(a.values, beg, end)
}

func (a *LargeListView) setData(data *Data) {
	debug.Assert(len(data.buffers) >= 3, "list-view data should have 3 buffers")
	a.array.setData(data)
	offsets := data.buffers[1]
	if offsets != nil {
		a.offsets = arrow.Int64Traits.CastFromBytes(offsets.Bytes())
	}
	sizes := data.buffers[2]
	if sizes != nil {
		a.sizes = arrow.Int64Traits.CastFromBytes(sizes.Bytes())
	}
	a.values = MakeFromData(data.childData[0])
}

func (a *LargeListView) GetOneForMarshal(i int) interface{} {
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

func (a *LargeListView) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)

	buf.WriteByte('[')
	for i := 0; i < a.Len(); i++ {
		if i != 0 {
			buf.WriteByte(',')
		}
		if err := enc.Encode(a.GetOneForMarshal(i)); err != nil {
			return nil, err
		}
	}
	buf.WriteByte(']')
	return buf.Bytes(), nil
}

func arrayEqualLargeListView(left, right *LargeListView) bool {
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
func (a *LargeListView) Len() int { return a.array.Len() }

func (a *LargeListView) Offsets() []int64 { return a.offsets }

func (a *LargeListView) Sizes() []int64 { return a.sizes }

func (a *LargeListView) ValueOffsets(i int) (start, end int64) {
	debug.Assert(i >= 0 && i < a.data.length, "index out of range")
	j := i + a.data.offset
	size := a.sizes[j]
	// If size is 0, skip accessing offsets.
	if size == 0 {
		return 0, 0
	}
	start = a.offsets[j]
	end = start + size
	return
}

func (a *LargeListView) Retain() {
	a.array.Retain()
	a.values.Retain()
}

func (a *LargeListView) Release() {
	a.array.Release()
	a.values.Release()
}

// Accessors for offsets and sizes to make ListView and LargeListView validation generic.
type offsetsAndSizes interface {
	offsetAt(slot int64) int64
	sizeAt(slot int64) int64
}

var (
	_ offsetsAndSizes = (*ListView)(nil)
	_ offsetsAndSizes = (*LargeListView)(nil)
)

func (a *ListView) offsetAt(slot int64) int64 { return int64(a.offsets[int64(a.data.offset)+slot]) }

func (a *ListView) sizeAt(slot int64) int64 { return int64(a.sizes[int64(a.data.offset)+slot]) }

func (a *LargeListView) offsetAt(slot int64) int64 { return a.offsets[int64(a.data.offset)+slot] }

func (a *LargeListView) sizeAt(slot int64) int64 { return a.sizes[int64(a.data.offset)+slot] }

func outOfBoundsListViewOffset(l offsetsAndSizes, slot int64, offsetLimit int64) error {
	offset := l.offsetAt(slot)
	return fmt.Errorf("%w: Offset invariant failure: offset for slot %d out of bounds. Expected %d to be at least 0 and less than %d", arrow.ErrInvalid, slot, offset, offsetLimit)
}

func outOfBoundsListViewSize(l offsetsAndSizes, slot int64, offsetLimit int64) error {
	size := l.sizeAt(slot)
	if size < 0 {
		return fmt.Errorf("%w: Offset invariant failure: size for slot %d out of bounds: %d < 0", arrow.ErrInvalid, slot, size)
	}
	offset := l.offsetAt(slot)
	return fmt.Errorf("%w: Offset invariant failure: size for slot %d out of bounds: %d + %d > %d", arrow.ErrInvalid, slot, offset, size, offsetLimit)
}

// Pre-condition: Basic validation has already been performed
func (a *array) fullyValidateOffsetsAndSizes(l offsetsAndSizes, offsetLimit int64) error {
	for slot := int64(0); slot < int64(a.Len()); slot += 1 {
		size := l.sizeAt(slot)
		if size > 0 {
			offset := l.offsetAt(slot)
			if offset < 0 || offset > offsetLimit {
				return outOfBoundsListViewOffset(l, slot, offsetLimit)
			}
			if size > offsetLimit-int64(offset) {
				return outOfBoundsListViewSize(l, slot, offsetLimit)
			}
		} else if size < 0 {
			return outOfBoundsListViewSize(l, slot, offsetLimit)
		}
	}

	return nil
}

func (a *array) validateOffsetsAndMaybeSizes(l offsetsAndSizes, offsetByteWidth int, isListView bool, offsetLimit int64, fullValidation bool) error {
	nonEmpty := a.Len() > 0
	if a.data.buffers[1] == nil {
		// For length 0, an empty offsets buffer is accepted (ARROW-544).
		if nonEmpty {
			return fmt.Errorf("non-empty array but offsets are null")
		}
		return nil
	}
	if isListView && a.data.buffers[2] == nil {
		if nonEmpty {
			return fmt.Errorf("non-empty array but sizes are null")
		}
		return nil
	}

	var requiredOffsets int
	if nonEmpty {
		requiredOffsets = a.Len() + a.Offset()
		if !isListView {
			requiredOffsets += 1
		}
	} else {
		requiredOffsets = 0
	}
	offsetsByteSize := a.data.buffers[1].Len()
	if offsetsByteSize/offsetByteWidth < requiredOffsets {
		return fmt.Errorf("offsets buffer size (bytes): %d isn't large enough for length: %d and offset: %d",
			offsetsByteSize, a.Len(), a.Offset())
	}
	if isListView {
		requiredSizes := a.Len() + a.Offset()
		sizesBytesSize := a.data.buffers[2].Len()
		if sizesBytesSize/offsetByteWidth < requiredSizes {
			return fmt.Errorf("sizes buffer size (bytes): %d isn't large enough for length: %d and offset: %d",
				sizesBytesSize, a.Len(), a.Offset())
		}
	}

	if fullValidation && requiredOffsets > 0 {
		if isListView {
			return a.fullyValidateOffsetsAndSizes(l, offsetLimit)
		}
		// TODO: implement validation of List and LargeList
		// return fullyValidateOffsets(offset_limit)
		return nil
	}
	return nil
}

func (a *ListView) validate(fullValidation bool) error {
	values := a.data.childData[0]
	offsetLimit := values.Len()
	return a.validateOffsetsAndMaybeSizes(a, 4, true, int64(offsetLimit), fullValidation)
}

func (a *ListView) Validate() error {
	return a.validate(false)
}

func (a *ListView) ValidateFull() error {
	return a.validate(true)
}

func (a *LargeListView) validate(fullValidation bool) error {
	values := a.data.childData[0]
	offsetLimit := values.Len()
	return a.validateOffsetsAndMaybeSizes(a, 8, true, int64(offsetLimit), fullValidation)
}

func (a *LargeListView) Validate() error {
	return a.validate(false)
}

func (a *LargeListView) ValidateFull() error {
	return a.validate(true)
}

type baseListViewBuilder struct {
	builder

	values  Builder // value builder for the list-view's elements.
	offsets Builder
	sizes   Builder

	// actual list-view type
	dt              arrow.DataType
	appendOffsetVal func(int)
	appendSizeVal   func(int)
}

type ListViewBuilder struct {
	baseListViewBuilder
}

type LargeListViewBuilder struct {
	baseListViewBuilder
}

// NewListViewBuilder returns a builder, using the provided memory allocator.
// The created list-view builder will create a list whose elements will be
// of type etype.
func NewListViewBuilder(mem memory.Allocator, etype arrow.DataType) *ListViewBuilder {
	offsetBldr := NewInt32Builder(mem)
	sizeBldr := NewInt32Builder(mem)
	lvb := &ListViewBuilder{
		baseListViewBuilder{
			builder:         builder{mem: mem},
			values:          NewBuilder(mem, etype),
			offsets:         offsetBldr,
			sizes:           sizeBldr,
			dt:              arrow.ListViewOf(etype),
			appendOffsetVal: func(o int) { offsetBldr.Append(int32(o)) },
			appendSizeVal:   func(s int) { sizeBldr.Append(int32(s)) },
		},
	}
	lvb.refCount.Add(1)
	return lvb
}

// NewListViewBuilderWithField takes a field to use for the child rather than just
// a datatype to allow for more customization.
func NewListViewBuilderWithField(mem memory.Allocator, field arrow.Field) *ListViewBuilder {
	offsetBldr := NewInt32Builder(mem)
	sizeBldr := NewInt32Builder(mem)
	lvb := &ListViewBuilder{
		baseListViewBuilder{
			builder:         builder{mem: mem},
			values:          NewBuilder(mem, field.Type),
			offsets:         offsetBldr,
			sizes:           sizeBldr,
			dt:              arrow.ListViewOfField(field),
			appendOffsetVal: func(o int) { offsetBldr.Append(int32(o)) },
			appendSizeVal:   func(s int) { sizeBldr.Append(int32(s)) },
		},
	}
	lvb.refCount.Add(1)
	return lvb
}

func (b *baseListViewBuilder) Type() arrow.DataType {
	switch dt := b.dt.(type) {
	case *arrow.ListViewType:
		f := dt.ElemField()
		f.Type = b.values.Type()
		return arrow.ListViewOfField(f)
	case *arrow.LargeListViewType:
		f := dt.ElemField()
		f.Type = b.values.Type()
		return arrow.LargeListViewOfField(f)
	}
	return nil
}

// NewLargeListViewBuilder returns a builder, using the provided memory allocator.
// The created list-view builder will create a list whose elements will be of type etype.
func NewLargeListViewBuilder(mem memory.Allocator, etype arrow.DataType) *LargeListViewBuilder {
	offsetBldr := NewInt64Builder(mem)
	sizeBldr := NewInt64Builder(mem)
	llvb := &LargeListViewBuilder{
		baseListViewBuilder{
			builder:         builder{mem: mem},
			values:          NewBuilder(mem, etype),
			offsets:         offsetBldr,
			sizes:           sizeBldr,
			dt:              arrow.LargeListViewOf(etype),
			appendOffsetVal: func(o int) { offsetBldr.Append(int64(o)) },
			appendSizeVal:   func(s int) { sizeBldr.Append(int64(s)) },
		},
	}
	llvb.refCount.Add(1)
	return llvb
}

// NewLargeListViewBuilderWithField takes a field rather than just an element type
// to allow for more customization of the final type of the LargeListView Array
func NewLargeListViewBuilderWithField(mem memory.Allocator, field arrow.Field) *LargeListViewBuilder {
	offsetBldr := NewInt64Builder(mem)
	sizeBldr := NewInt64Builder(mem)
	llvb := &LargeListViewBuilder{
		baseListViewBuilder{
			builder:         builder{mem: mem},
			values:          NewBuilder(mem, field.Type),
			offsets:         offsetBldr,
			sizes:           sizeBldr,
			dt:              arrow.LargeListViewOfField(field),
			appendOffsetVal: func(o int) { offsetBldr.Append(int64(o)) },
			appendSizeVal:   func(o int) { sizeBldr.Append(int64(o)) },
		},
	}

	llvb.refCount.Add(1)
	return llvb
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *baseListViewBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
		b.values.Release()
		b.offsets.Release()
		b.sizes.Release()
	}
}

func (b *baseListViewBuilder) AppendDimensions(offset int, listSize int) {
	b.Reserve(1)
	b.unsafeAppendBoolToBitmap(true)
	b.appendOffsetVal(offset)
	b.appendSizeVal(listSize)
}

func (b *baseListViewBuilder) Append(v bool) {
	debug.Assert(false, "baseListViewBuilder.Append should never be called -- use AppendWithSize instead")
}

func (b *baseListViewBuilder) AppendWithSize(v bool, listSize int) {
	debug.Assert(v || listSize == 0, "invalid list-view should have size 0")
	b.Reserve(1)
	b.unsafeAppendBoolToBitmap(v)
	b.appendOffsetVal(b.values.Len())
	b.appendSizeVal(listSize)
}

func (b *baseListViewBuilder) AppendNull() {
	b.AppendWithSize(false, 0)
}

func (b *baseListViewBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *baseListViewBuilder) AppendEmptyValue() {
	b.AppendWithSize(true, 0)
}

func (b *baseListViewBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *ListViewBuilder) AppendValuesWithSizes(offsets []int32, sizes []int32, valid []bool) {
	b.Reserve(len(valid))
	b.offsets.(*Int32Builder).AppendValues(offsets, nil)
	b.sizes.(*Int32Builder).AppendValues(sizes, nil)
	b.unsafeAppendBoolsToBitmap(valid, len(valid))
}

func (b *LargeListViewBuilder) AppendValuesWithSizes(offsets []int64, sizes []int64, valid []bool) {
	b.Reserve(len(valid))
	b.offsets.(*Int64Builder).AppendValues(offsets, nil)
	b.sizes.(*Int64Builder).AppendValues(sizes, nil)
	b.unsafeAppendBoolsToBitmap(valid, len(valid))
}

func (b *baseListViewBuilder) unsafeAppendBoolToBitmap(isValid bool) {
	if isValid {
		bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	} else {
		b.nulls++
	}
	b.length++
}

func (b *baseListViewBuilder) init(capacity int) {
	b.builder.init(capacity)
	b.offsets.init(capacity)
	b.sizes.init(capacity)
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *baseListViewBuilder) Reserve(n int) {
	b.reserve(n, b.resizeHelper)
	b.offsets.Reserve(n)
	b.sizes.Reserve(n)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *baseListViewBuilder) Resize(n int) {
	b.resizeHelper(n)
	b.offsets.Resize(n)
	b.sizes.Resize(n)
}

func (b *baseListViewBuilder) resizeHelper(n int) {
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.resize(n, b.builder.init)
	}
}

func (b *baseListViewBuilder) ValueBuilder() Builder {
	return b.values
}

// NewArray creates a ListView array from the memory buffers used by the builder and
// resets the ListViewBuilder so it can be used to build a new array.
func (b *ListViewBuilder) NewArray() arrow.Array {
	return b.NewListViewArray()
}

// NewArray creates a LargeListView array from the memory buffers used by the builder
// and resets the LargeListViewBuilder so it can be used to build a new array.
func (b *LargeListViewBuilder) NewArray() arrow.Array {
	return b.NewLargeListViewArray()
}

// NewListViewArray creates a ListView array from the memory buffers used by the builder
// and resets the ListViewBuilder so it can be used to build a new array.
func (b *ListViewBuilder) NewListViewArray() (a *ListView) {
	data := b.newData()
	a = NewListViewData(data)
	data.Release()
	return
}

// NewLargeListViewArray creates a ListView array from the memory buffers used by the
// builder and resets the LargeListViewBuilder so it can be used to build a new array.
func (b *LargeListViewBuilder) NewLargeListViewArray() (a *LargeListView) {
	data := b.newData()
	a = NewLargeListViewData(data)
	data.Release()
	return
}

func (b *baseListViewBuilder) newData() (data *Data) {
	values := b.values.NewArray()
	defer values.Release()

	var offsets *memory.Buffer
	if b.offsets != nil {
		arr := b.offsets.NewArray()
		defer arr.Release()
		offsets = arr.Data().Buffers()[1]
	}

	var sizes *memory.Buffer
	if b.sizes != nil {
		arr := b.sizes.NewArray()
		defer arr.Release()
		sizes = arr.Data().Buffers()[1]
	}

	data = NewData(
		b.Type(), b.length,
		[]*memory.Buffer{
			b.nullBitmap,
			offsets,
			sizes,
		},
		[]arrow.ArrayData{values.Data()},
		b.nulls,
		0,
	)
	b.reset()

	return
}

func (b *baseListViewBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}

	return b.UnmarshalOne(json.NewDecoder(strings.NewReader(s)))
}

func (b *baseListViewBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch t {
	case json.Delim('['):
		offset := b.values.Len()
		// 0 is a placeholder size as we don't know the actual size yet
		b.AppendWithSize(true, 0)
		if err := b.values.Unmarshal(dec); err != nil {
			return err
		}
		// consume ']'
		_, err := dec.Token()
		// replace the last size with the actual size
		switch b.sizes.(type) {
		case *Int32Builder:
			b.sizes.(*Int32Builder).rawData[b.sizes.Len()-1] = int32(b.values.Len() - offset)
		case *Int64Builder:
			b.sizes.(*Int64Builder).rawData[b.sizes.Len()-1] = int64(b.values.Len() - offset)
		}
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

func (b *baseListViewBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *baseListViewBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("list-view builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

// Find the minimum offset+size in a LIST_VIEW/LARGE_LIST_VIEW array.
//
// Pre-conditions:
//
//	input.DataType() is ListViewType if Offset=int32 or LargeListViewType if Offset=int64
//	input.Len() > 0 && input.NullN() != input.Len()
func minListViewOffset[Offset int32 | int64](input arrow.ArrayData) Offset {
	var bitmap []byte
	if input.Buffers()[0] != nil {
		bitmap = input.Buffers()[0].Bytes()
	}
	offsets := arrow.GetData[Offset](input.Buffers()[1].Bytes())[input.Offset():]
	sizes := arrow.GetData[Offset](input.Buffers()[2].Bytes())[input.Offset():]

	isNull := func(i int) bool {
		return bitmap != nil && bitutil.BitIsNotSet(bitmap, input.Offset()+i)
	}

	// It's very likely that the first non-null non-empty list-view starts at
	// offset 0 of the child array.
	i := 0
	for i < input.Len() && (isNull(i) || sizes[i] == 0) {
		i += 1
	}
	if i >= input.Len() {
		return 0
	}
	minOffset := offsets[i]
	if minOffset == 0 {
		// early exit: offset 0 found already
		return 0
	}

	// Slow path: scan the buffers entirely.
	i += 1
	for ; i < input.Len(); i += 1 {
		if isNull(i) {
			continue
		}
		offset := offsets[i]
		if offset < minOffset && sizes[i] > 0 {
			minOffset = offset
		}
	}
	return minOffset
}

// Find the maximum offset+size in a LIST_VIEW/LARGE_LIST_VIEW array.
//
// Pre-conditions:
//
//	input.DataType() is ListViewType if Offset=int32 or LargeListViewType if Offset=int64
//	input.Len() > 0 && input.NullN() != input.Len()
func maxListViewEnd[Offset int32 | int64](input arrow.ArrayData) Offset {
	inputOffset := input.Offset()
	var bitmap []byte
	if input.Buffers()[0] != nil {
		bitmap = input.Buffers()[0].Bytes()
	}
	offsets := arrow.GetData[Offset](input.Buffers()[1].Bytes())[inputOffset:]
	sizes := arrow.GetData[Offset](input.Buffers()[2].Bytes())[inputOffset:]

	isNull := func(i int) bool {
		return bitmap != nil && bitutil.BitIsNotSet(bitmap, inputOffset+i)
	}

	i := input.Len() - 1 // safe because input.Len() > 0
	for i != 0 && (isNull(i) || sizes[i] == 0) {
		i -= 1
	}
	offset := offsets[i]
	size := sizes[i]
	if i == 0 {
		if isNull(i) || sizes[i] == 0 {
			return 0
		} else {
			return offset + size
		}
	}

	values := input.Children()[0]
	maxEnd := offsets[i] + sizes[i]
	if maxEnd == Offset(values.Len()) {
		// Early-exit: maximum possible view-end found already.
		return maxEnd
	}

	// Slow path: scan the buffers entirely.
	for ; i >= 0; i -= 1 {
		offset := offsets[i]
		size := sizes[i]
		if size > 0 && !isNull(i) {
			if offset+size > maxEnd {
				maxEnd = offset + size
				if maxEnd == Offset(values.Len()) {
					return maxEnd
				}
			}
		}
	}
	return maxEnd
}

func rangeOfValuesUsed(input arrow.ArrayData) (int, int) {
	if input.Len() == 0 || input.NullN() == input.Len() {
		return 0, 0
	}
	var minOffset, maxEnd int
	switch input.DataType().(type) {
	case *arrow.ListViewType:
		minOffset = int(minListViewOffset[int32](input))
		maxEnd = int(maxListViewEnd[int32](input))
	case *arrow.LargeListViewType:
		minOffset = int(minListViewOffset[int64](input))
		maxEnd = int(maxListViewEnd[int64](input))
	case *arrow.ListType:
		offsets := arrow.Int32Traits.CastFromBytes(input.Buffers()[1].Bytes())[input.Offset():]
		minOffset = int(offsets[0])
		maxEnd = int(offsets[len(offsets)-1])
	case *arrow.LargeListType:
		offsets := arrow.Int64Traits.CastFromBytes(input.Buffers()[1].Bytes())[input.Offset():]
		minOffset = int(offsets[0])
		maxEnd = int(offsets[len(offsets)-1])
	case *arrow.MapType:
		offsets := arrow.Int32Traits.CastFromBytes(input.Buffers()[1].Bytes())[input.Offset():]
		minOffset = int(offsets[0])
		maxEnd = int(offsets[len(offsets)-1])
	}
	return minOffset, maxEnd - minOffset
}

// Returns the smallest contiguous range of values of the child array that are
// referenced by all the list values in the input array.
func RangeOfValuesUsed(input VarLenListLike) (int, int) {
	return rangeOfValuesUsed(input.Data())
}

var (
	_ arrow.Array = (*List)(nil)
	_ arrow.Array = (*LargeList)(nil)
	_ arrow.Array = (*ListView)(nil)
	_ arrow.Array = (*LargeListView)(nil)

	_ Builder = (*ListBuilder)(nil)
	_ Builder = (*LargeListBuilder)(nil)
	_ Builder = (*ListViewBuilder)(nil)
	_ Builder = (*LargeListViewBuilder)(nil)

	_ VarLenListLike = (*List)(nil)
	_ VarLenListLike = (*LargeList)(nil)
	_ VarLenListLike = (*Map)(nil)
	_ VarLenListLike = (*ListView)(nil)
	_ VarLenListLike = (*LargeListView)(nil)
	_ ListLike       = (*FixedSizeList)(nil)

	_ VarLenListLikeBuilder = (*ListBuilder)(nil)
	_ VarLenListLikeBuilder = (*LargeListBuilder)(nil)
	_ VarLenListLikeBuilder = (*ListBuilder)(nil)
	_ VarLenListLikeBuilder = (*LargeListBuilder)(nil)
	_ VarLenListLikeBuilder = (*MapBuilder)(nil)
	_ ListLikeBuilder       = (*FixedSizeListBuilder)(nil)
)
