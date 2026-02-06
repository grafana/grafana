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
	"encoding/base64"
	"fmt"
	"math"
	"reflect"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// A BinaryBuilder is used to build a Binary array using the Append methods.
type BinaryBuilder struct {
	builder

	dtype   arrow.BinaryDataType
	offsets bufBuilder
	values  *byteBufferBuilder

	appendOffsetVal func(int)
	getOffsetVal    func(int) int
	maxCapacity     uint64
	offsetByteWidth int
}

// NewBinaryBuilder can be used for any of the variable length binary types,
// Binary, LargeBinary, String, LargeString by passing the appropriate data type
func NewBinaryBuilder(mem memory.Allocator, dtype arrow.BinaryDataType) *BinaryBuilder {
	var (
		offsets         bufBuilder
		offsetValFn     func(int)
		maxCapacity     uint64
		offsetByteWidth int
		getOffsetVal    func(int) int
	)
	switch dtype.Layout().Buffers[1].ByteWidth {
	case 4:
		b := newInt32BufferBuilder(mem)
		offsetValFn = func(v int) { b.AppendValue(int32(v)) }
		getOffsetVal = func(i int) int { return int(b.Value(i)) }
		offsets = b
		maxCapacity = math.MaxInt32
		offsetByteWidth = arrow.Int32SizeBytes
	case 8:
		b := newInt64BufferBuilder(mem)
		offsetValFn = func(v int) { b.AppendValue(int64(v)) }
		getOffsetVal = func(i int) int { return int(b.Value(i)) }
		offsets = b
		maxCapacity = math.MaxInt64
		offsetByteWidth = arrow.Int64SizeBytes
	}

	bb := &BinaryBuilder{
		builder:         builder{mem: mem},
		dtype:           dtype,
		offsets:         offsets,
		values:          newByteBufferBuilder(mem),
		appendOffsetVal: offsetValFn,
		maxCapacity:     maxCapacity,
		offsetByteWidth: offsetByteWidth,
		getOffsetVal:    getOffsetVal,
	}
	bb.refCount.Add(1)
	return bb
}

func (b *BinaryBuilder) Type() arrow.DataType { return b.dtype }

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (b *BinaryBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
		if b.offsets != nil {
			b.offsets.Release()
			b.offsets = nil
		}
		if b.values != nil {
			b.values.Release()
			b.values = nil
		}
	}
}

func (b *BinaryBuilder) Append(v []byte) {
	b.Reserve(1)
	b.appendNextOffset()
	b.values.Append(v)
	b.UnsafeAppendBoolToBitmap(true)
}

func (b *BinaryBuilder) AppendString(v string) {
	b.Append([]byte(v))
}

func (b *BinaryBuilder) AppendNull() {
	b.Reserve(1)
	b.appendNextOffset()
	b.UnsafeAppendBoolToBitmap(false)
}

func (b *BinaryBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *BinaryBuilder) AppendEmptyValue() {
	b.Reserve(1)
	b.appendNextOffset()
	b.UnsafeAppendBoolToBitmap(true)
}

func (b *BinaryBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

// AppendValues will append the values in the v slice. The valid slice determines which values
// in v are valid (not null). The valid slice must either be empty or be equal in length to v. If empty,
// all values in v are appended and considered valid.
func (b *BinaryBuilder) AppendValues(v [][]byte, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	for _, vv := range v {
		b.appendNextOffset()
		b.values.Append(vv)
	}

	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

// AppendStringValues will append the values in the v slice. The valid slice determines which values
// in v are valid (not null). The valid slice must either be empty or be equal in length to v. If empty,
// all values in v are appended and considered valid.
func (b *BinaryBuilder) AppendStringValues(v []string, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	for _, vv := range v {
		b.appendNextOffset()
		b.values.Append([]byte(vv))
	}

	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

func (b *BinaryBuilder) UnsafeAppend(v []byte) {
	b.appendNextOffset()
	b.values.unsafeAppend(v)
	b.UnsafeAppendBoolToBitmap(true)
}

func (b *BinaryBuilder) Value(i int) []byte {
	start := b.getOffsetVal(i)
	var end int
	if i == (b.length - 1) {
		end = b.values.Len()
	} else {
		end = b.getOffsetVal(i + 1)
	}
	return b.values.Bytes()[start:end]
}

func (b *BinaryBuilder) init(capacity int) {
	b.builder.init(capacity)
	b.offsets.resize((capacity + 1) * b.offsetByteWidth)
}

// DataLen returns the number of bytes in the data array.
func (b *BinaryBuilder) DataLen() int { return b.values.length }

// DataCap returns the total number of bytes that can be stored
// without allocating additional memory.
func (b *BinaryBuilder) DataCap() int { return b.values.capacity }

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *BinaryBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

// ReserveData ensures there is enough space for appending n bytes
// by checking the capacity and resizing the data buffer if necessary.
func (b *BinaryBuilder) ReserveData(n int) {
	if b.values.capacity < b.values.length+n {
		b.values.resize(b.values.Len() + n)
	}
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may be reduced.
func (b *BinaryBuilder) Resize(n int) {
	b.offsets.resize((n + 1) * b.offsetByteWidth)
	if (n * b.offsetByteWidth) < b.offsets.Len() {
		b.offsets.SetLength(n * b.offsetByteWidth)
	}
	b.resize(n, b.init)
}

func (b *BinaryBuilder) ResizeData(n int) {
	b.values.length = n
}

// NewArray creates a Binary array from the memory buffers used by the builder and resets the BinaryBuilder
// so it can be used to build a new array.
//
// Builds the appropriate Binary or LargeBinary array based on the datatype
// it was initialized with.
func (b *BinaryBuilder) NewArray() arrow.Array {
	if b.offsetByteWidth == arrow.Int32SizeBytes {
		return b.NewBinaryArray()
	}
	return b.NewLargeBinaryArray()
}

// NewBinaryArray creates a Binary array from the memory buffers used by the builder and resets the BinaryBuilder
// so it can be used to build a new array.
func (b *BinaryBuilder) NewBinaryArray() (a *Binary) {
	if b.offsetByteWidth != arrow.Int32SizeBytes {
		panic("arrow/array: invalid call to NewBinaryArray when building a LargeBinary array")
	}

	data := b.newData()
	a = NewBinaryData(data)
	data.Release()
	return
}

func (b *BinaryBuilder) NewLargeBinaryArray() (a *LargeBinary) {
	if b.offsetByteWidth != arrow.Int64SizeBytes {
		panic("arrow/array: invalid call to NewLargeBinaryArray when building a Binary array")
	}

	data := b.newData()
	a = NewLargeBinaryData(data)
	data.Release()
	return
}

func (b *BinaryBuilder) newData() (data *Data) {
	b.appendNextOffset()
	offsets, values := b.offsets.Finish(), b.values.Finish()
	data = NewData(b.dtype, b.length, []*memory.Buffer{b.nullBitmap, offsets, values}, nil, b.nulls, 0)
	if offsets != nil {
		offsets.Release()
	}

	if values != nil {
		values.Release()
	}

	b.reset()

	return
}

func (b *BinaryBuilder) appendNextOffset() {
	numBytes := b.values.Len()
	debug.Assert(uint64(numBytes) <= b.maxCapacity, "exceeded maximum capacity of binary array")
	b.appendOffsetVal(numBytes)
}

func (b *BinaryBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}

	if b.dtype.IsUtf8() {
		b.Append([]byte(s))
		return nil
	}

	decodedVal, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return fmt.Errorf("could not decode base64 string: %w", err)
	}
	b.Append(decodedVal)
	return nil
}

func (b *BinaryBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch v := t.(type) {
	case string:
		data, err := base64.StdEncoding.DecodeString(v)
		if err != nil {
			return err
		}
		b.Append(data)
	case []byte:
		b.Append(v)
	case nil:
		b.AppendNull()
	default:
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(t),
			Type:   reflect.TypeOf([]byte{}),
			Offset: dec.InputOffset(),
		}
	}
	return nil
}

func (b *BinaryBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *BinaryBuilder) UnmarshalJSON(data []byte) error {
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

const (
	dfltBlockSize            = 32 << 10 // 32 KB
	viewValueSizeLimit int32 = math.MaxInt32
)

type BinaryViewBuilder struct {
	builder
	dtype arrow.BinaryDataType

	data    *memory.Buffer
	rawData []arrow.ViewHeader

	blockBuilder multiBufferBuilder
}

func NewBinaryViewBuilder(mem memory.Allocator) *BinaryViewBuilder {
	bvb := &BinaryViewBuilder{
		dtype: arrow.BinaryTypes.BinaryView,
		builder: builder{
			mem: mem,
		},
		blockBuilder: multiBufferBuilder{
			blockSize: dfltBlockSize,
			mem:       mem,
		},
	}
	bvb.refCount.Add(1)
	bvb.blockBuilder.refCount.Add(1)
	return bvb
}

func (b *BinaryViewBuilder) SetBlockSize(sz uint) {
	b.blockBuilder.blockSize = int(sz)
}

func (b *BinaryViewBuilder) Type() arrow.DataType { return b.dtype }

func (b *BinaryViewBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) != 0 {
		return
	}

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

func (b *BinaryViewBuilder) init(capacity int) {
	b.builder.init(capacity)
	b.data = memory.NewResizableBuffer(b.mem)
	bytesN := arrow.ViewHeaderTraits.BytesRequired(capacity)
	b.data.Resize(bytesN)
	b.rawData = arrow.ViewHeaderTraits.CastFromBytes(b.data.Bytes())
}

func (b *BinaryViewBuilder) Resize(n int) {
	nbuild := n
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
		return
	}

	b.resize(nbuild, b.init)
	b.data.Resize(arrow.ViewHeaderTraits.BytesRequired(n))
	b.rawData = arrow.ViewHeaderTraits.CastFromBytes(b.data.Bytes())
}

func (b *BinaryViewBuilder) ReserveData(length int) {
	if int32(length) > viewValueSizeLimit {
		panic(fmt.Errorf("%w: BinaryView or StringView elements cannot reference strings larger than 2GB",
			arrow.ErrInvalid))
	}
	b.blockBuilder.Reserve(int(length))
}

func (b *BinaryViewBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

func (b *BinaryViewBuilder) Append(v []byte) {
	if int32(len(v)) > viewValueSizeLimit {
		panic(fmt.Errorf("%w: BinaryView or StringView elements cannot reference strings larger than 2GB", arrow.ErrInvalid))
	}

	if !arrow.IsViewInline(len(v)) {
		b.ReserveData(len(v))
	}

	b.Reserve(1)
	b.UnsafeAppend(v)
}

// AppendString is identical to Append, only accepting a string instead
// of a byte slice, avoiding the extra copy that would occur if you simply
// did []byte(v).
//
// This is different than AppendValueFromString which exists for the
// Builder interface, in that this expects raw binary data which is
// appended unmodified. AppendValueFromString expects base64 encoded binary
// data instead.
func (b *BinaryViewBuilder) AppendString(v string) {
	// create a []byte without copying the bytes
	// in go1.20 this would be unsafe.StringData
	val := *(*[]byte)(unsafe.Pointer(&struct {
		string
		int
	}{v, len(v)}))
	b.Append(val)
}

func (b *BinaryViewBuilder) AppendNull() {
	b.Reserve(1)
	b.UnsafeAppendBoolToBitmap(false)
}

func (b *BinaryViewBuilder) AppendNulls(n int) {
	b.Reserve(n)
	for i := 0; i < n; i++ {
		b.UnsafeAppendBoolToBitmap(false)
	}
}

func (b *BinaryViewBuilder) AppendEmptyValue() {
	b.Reserve(1)
	b.UnsafeAppendBoolToBitmap(true)
}

func (b *BinaryViewBuilder) AppendEmptyValues(n int) {
	b.Reserve(n)
	b.unsafeAppendBoolsToBitmap(nil, n)
}

func (b *BinaryViewBuilder) UnsafeAppend(v []byte) {
	hdr := &b.rawData[b.length]
	hdr.SetBytes(v)
	if !hdr.IsInline() {
		b.blockBuilder.UnsafeAppend(hdr, v)
	}
	b.UnsafeAppendBoolToBitmap(true)
}

func (b *BinaryViewBuilder) AppendValues(v [][]byte, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	outOfLineTotal := 0
	for i, vv := range v {
		if len(valid) == 0 || valid[i] {
			if !arrow.IsViewInline(len(vv)) {
				outOfLineTotal += len(vv)
			}
		}
	}

	b.ReserveData(outOfLineTotal)
	for i, vv := range v {
		if len(valid) == 0 || valid[i] {
			hdr := &b.rawData[b.length+i]
			hdr.SetBytes(vv)
			if !hdr.IsInline() {
				b.blockBuilder.UnsafeAppend(hdr, vv)
			}
		}
	}

	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

func (b *BinaryViewBuilder) AppendStringValues(v []string, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	outOfLineTotal := 0
	for i, vv := range v {
		if len(valid) == 0 || valid[i] {
			if !arrow.IsViewInline(len(vv)) {
				outOfLineTotal += len(vv)
			}
		}
	}

	b.ReserveData(outOfLineTotal)
	for i, vv := range v {
		if len(valid) == 0 || valid[i] {
			hdr := &b.rawData[b.length+i]
			hdr.SetString(vv)
			if !hdr.IsInline() {
				b.blockBuilder.UnsafeAppendString(hdr, vv)
			}
		}
	}

	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

// AppendValueFromString is paired with ValueStr for fulfilling the
// base Builder interface. This is intended to read in a human-readable
// string such as from CSV or JSON and append it to the array.
//
// For Binary values are expected to be base64 encoded (and will be
// decoded as such before being appended).
func (b *BinaryViewBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}

	if b.dtype.IsUtf8() {
		b.Append([]byte(s))
		return nil
	}

	decodedVal, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return fmt.Errorf("could not decode base64 string: %w", err)
	}
	b.Append(decodedVal)
	return nil
}

func (b *BinaryViewBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch v := t.(type) {
	case string:
		data, err := base64.StdEncoding.DecodeString(v)
		if err != nil {
			return err
		}
		b.Append(data)
	case []byte:
		b.Append(v)
	case nil:
		b.AppendNull()
	default:
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(t),
			Type:   reflect.TypeOf([]byte{}),
			Offset: dec.InputOffset(),
		}
	}
	return nil
}

func (b *BinaryViewBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *BinaryViewBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("binary view builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

func (b *BinaryViewBuilder) newData() (data *Data) {
	bytesRequired := arrow.ViewHeaderTraits.BytesRequired(b.length)
	if bytesRequired > 0 && bytesRequired < b.data.Len() {
		// trim buffers
		b.data.Resize(bytesRequired)
	}

	dataBuffers := b.blockBuilder.Finish()
	data = NewData(b.dtype, b.length, append([]*memory.Buffer{
		b.nullBitmap, b.data,
	}, dataBuffers...), nil, b.nulls, 0)
	b.reset()

	if b.data != nil {
		b.data.Release()
		b.data = nil
		b.rawData = nil
		for _, buf := range dataBuffers {
			buf.Release()
		}
	}
	return
}

func (b *BinaryViewBuilder) NewBinaryViewArray() (a *BinaryView) {
	data := b.newData()
	a = NewBinaryViewData(data)
	data.Release()
	return
}

func (b *BinaryViewBuilder) NewArray() arrow.Array {
	return b.NewBinaryViewArray()
}

type BinaryLikeBuilder interface {
	Builder
	Append([]byte)
	AppendValues([][]byte, []bool)
	UnsafeAppend([]byte)
	ReserveData(int)
}

var (
	_ Builder = (*BinaryBuilder)(nil)
	_ Builder = (*BinaryViewBuilder)(nil)

	_ BinaryLikeBuilder = (*BinaryBuilder)(nil)
	_ BinaryLikeBuilder = (*BinaryViewBuilder)(nil)
)
