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
	"strings"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

type BinaryLike interface {
	arrow.Array
	ValueLen(int) int
	ValueBytes() []byte
	ValueOffset64(int) int64
}

// A type which represents an immutable sequence of variable-length binary strings.
type Binary struct {
	array
	valueOffsets []int32
	valueBytes   []byte
}

// NewBinaryData constructs a new Binary array from data.
func NewBinaryData(data arrow.ArrayData) *Binary {
	a := &Binary{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

// Value returns the slice at index i. This value should not be mutated.
func (a *Binary) Value(i int) []byte {
	if i < 0 || i >= a.data.length {
		panic("arrow/array: index out of range")
	}
	idx := a.data.offset + i
	return a.valueBytes[a.valueOffsets[idx]:a.valueOffsets[idx+1]]
}

// ValueStr returns a copy of the base64-encoded string value or NullValueStr
func (a *Binary) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}
	return base64.StdEncoding.EncodeToString(a.Value(i))
}

// ValueString returns the string at index i without performing additional allocations.
// The string is only valid for the lifetime of the Binary array.
func (a *Binary) ValueString(i int) string {
	b := a.Value(i)
	return *(*string)(unsafe.Pointer(&b))
}

func (a *Binary) ValueOffset(i int) int {
	if i < 0 || i >= a.data.length {
		panic("arrow/array: index out of range")
	}
	return int(a.valueOffsets[a.data.offset+i])
}

func (a *Binary) ValueOffset64(i int) int64 {
	return int64(a.ValueOffset(i))
}

func (a *Binary) ValueLen(i int) int {
	if i < 0 || i >= a.data.length {
		panic("arrow/array: index out of range")
	}
	beg := a.data.offset + i
	return int(a.valueOffsets[beg+1] - a.valueOffsets[beg])
}

func (a *Binary) ValueOffsets() []int32 {
	beg := a.data.offset
	end := beg + a.data.length + 1
	return a.valueOffsets[beg:end]
}

func (a *Binary) ValueBytes() []byte {
	beg := a.data.offset
	end := beg + a.data.length
	return a.valueBytes[a.valueOffsets[beg]:a.valueOffsets[end]]
}

func (a *Binary) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString(NullValueStr)
		default:
			fmt.Fprintf(o, "%q", a.ValueString(i))
		}
	}
	o.WriteString("]")
	return o.String()
}

func (a *Binary) setData(data *Data) {
	if len(data.buffers) != 3 {
		panic("len(data.buffers) != 3")
	}

	a.array.setData(data)

	if valueData := data.buffers[2]; valueData != nil {
		a.valueBytes = valueData.Bytes()
	}

	if valueOffsets := data.buffers[1]; valueOffsets != nil {
		a.valueOffsets = arrow.Int32Traits.CastFromBytes(valueOffsets.Bytes())
	}

	if a.data.length < 1 {
		return
	}

	expNumOffsets := a.data.offset + a.data.length + 1
	if len(a.valueOffsets) < expNumOffsets {
		panic(fmt.Errorf("arrow/array: binary offset buffer must have at least %d values", expNumOffsets))
	}

	if int(a.valueOffsets[expNumOffsets-1]) > len(a.valueBytes) {
		panic("arrow/array: binary offsets out of bounds of data buffer")
	}
}

func (a *Binary) GetOneForMarshal(i int) interface{} {
	if a.IsNull(i) {
		return nil
	}
	return a.Value(i)
}

func (a *Binary) MarshalJSON() ([]byte, error) {
	vals := make([]interface{}, a.Len())
	for i := 0; i < a.Len(); i++ {
		vals[i] = a.GetOneForMarshal(i)
	}
	// golang marshal standard says that []byte will be marshalled
	// as a base64-encoded string
	return json.Marshal(vals)
}

func arrayEqualBinary(left, right *Binary) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if !bytes.Equal(left.Value(i), right.Value(i)) {
			return false
		}
	}
	return true
}

type LargeBinary struct {
	array
	valueOffsets []int64
	valueBytes   []byte
}

func NewLargeBinaryData(data arrow.ArrayData) *LargeBinary {
	a := &LargeBinary{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *LargeBinary) Value(i int) []byte {
	if i < 0 || i >= a.data.length {
		panic("arrow/array: index out of range")
	}
	idx := a.data.offset + i
	return a.valueBytes[a.valueOffsets[idx]:a.valueOffsets[idx+1]]
}

func (a *LargeBinary) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}
	return base64.StdEncoding.EncodeToString(a.Value(i))
}

func (a *LargeBinary) ValueString(i int) string {
	b := a.Value(i)
	return *(*string)(unsafe.Pointer(&b))
}

func (a *LargeBinary) ValueOffset(i int) int64 {
	if i < 0 || i >= a.data.length {
		panic("arrow/array: index out of range")
	}
	return a.valueOffsets[a.data.offset+i]
}

func (a *LargeBinary) ValueOffset64(i int) int64 {
	return a.ValueOffset(i)
}

func (a *LargeBinary) ValueLen(i int) int {
	if i < 0 || i >= a.data.length {
		panic("arrow/array: index out of range")
	}
	beg := a.data.offset + i
	return int(a.valueOffsets[beg+1] - a.valueOffsets[beg])
}

func (a *LargeBinary) ValueOffsets() []int64 {
	beg := a.data.offset
	end := beg + a.data.length + 1
	return a.valueOffsets[beg:end]
}

func (a *LargeBinary) ValueBytes() []byte {
	beg := a.data.offset
	end := beg + a.data.length
	return a.valueBytes[a.valueOffsets[beg]:a.valueOffsets[end]]
}

func (a *LargeBinary) String() string {
	var o strings.Builder
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString(NullValueStr)
		default:
			fmt.Fprintf(&o, "%q", a.ValueString(i))
		}
	}
	o.WriteString("]")
	return o.String()
}

func (a *LargeBinary) setData(data *Data) {
	if len(data.buffers) != 3 {
		panic("len(data.buffers) != 3")
	}

	a.array.setData(data)

	if valueData := data.buffers[2]; valueData != nil {
		a.valueBytes = valueData.Bytes()
	}

	if valueOffsets := data.buffers[1]; valueOffsets != nil {
		a.valueOffsets = arrow.Int64Traits.CastFromBytes(valueOffsets.Bytes())
	}

	if a.data.length < 1 {
		return
	}

	expNumOffsets := a.data.offset + a.data.length + 1
	if len(a.valueOffsets) < expNumOffsets {
		panic(fmt.Errorf("arrow/array: large binary offset buffer must have at least %d values", expNumOffsets))
	}

	if int(a.valueOffsets[expNumOffsets-1]) > len(a.valueBytes) {
		panic("arrow/array: large binary offsets out of bounds of data buffer")
	}
}

func (a *LargeBinary) GetOneForMarshal(i int) interface{} {
	if a.IsNull(i) {
		return nil
	}
	return a.Value(i)
}

func (a *LargeBinary) MarshalJSON() ([]byte, error) {
	vals := make([]interface{}, a.Len())
	for i := 0; i < a.Len(); i++ {
		vals[i] = a.GetOneForMarshal(i)
	}
	// golang marshal standard says that []byte will be marshalled
	// as a base64-encoded string
	return json.Marshal(vals)
}

func arrayEqualLargeBinary(left, right *LargeBinary) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if !bytes.Equal(left.Value(i), right.Value(i)) {
			return false
		}
	}
	return true
}

type ViewLike interface {
	arrow.Array
	ValueHeader(int) *arrow.ViewHeader
}

type BinaryView struct {
	array
	values      []arrow.ViewHeader
	dataBuffers []*memory.Buffer
}

func NewBinaryViewData(data arrow.ArrayData) *BinaryView {
	a := &BinaryView{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *BinaryView) setData(data *Data) {
	if len(data.buffers) < 2 {
		panic("len(data.buffers) < 2")
	}
	a.array.setData(data)

	if valueData := data.buffers[1]; valueData != nil {
		a.values = arrow.ViewHeaderTraits.CastFromBytes(valueData.Bytes())
	}

	a.dataBuffers = data.buffers[2:]
}

func (a *BinaryView) ValueHeader(i int) *arrow.ViewHeader {
	if i < 0 || i >= a.data.length {
		panic("arrow/array: index out of range")
	}
	return &a.values[a.data.offset+i]
}

func (a *BinaryView) Value(i int) []byte {
	s := a.ValueHeader(i)
	if s.IsInline() {
		return s.InlineBytes()
	}
	start := s.BufferOffset()
	buf := a.dataBuffers[s.BufferIndex()]
	return buf.Bytes()[start : start+int32(s.Len())]
}

func (a *BinaryView) ValueLen(i int) int {
	s := a.ValueHeader(i)
	return s.Len()
}

// ValueString returns the value at index i as a string instead of
// a byte slice, without copying the underlying data.
func (a *BinaryView) ValueString(i int) string {
	b := a.Value(i)
	return *(*string)(unsafe.Pointer(&b))
}

func (a *BinaryView) String() string {
	var o strings.Builder
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString(NullValueStr)
		default:
			fmt.Fprintf(&o, "%q", a.ValueString(i))
		}
	}
	o.WriteString("]")
	return o.String()
}

// ValueStr is paired with AppendValueFromString in that it returns
// the value at index i as a string: Semantically this means that for
// a null value it will return the string "(null)", otherwise it will
// return the value as a base64 encoded string suitable for CSV/JSON.
//
// This is always going to be less performant than just using ValueString
// and exists to fulfill the Array interface to provide a method which
// can produce a human readable string for a given index.
func (a *BinaryView) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}
	return base64.StdEncoding.EncodeToString(a.Value(i))
}

func (a *BinaryView) GetOneForMarshal(i int) interface{} {
	if a.IsNull(i) {
		return nil
	}
	return a.Value(i)
}

func (a *BinaryView) MarshalJSON() ([]byte, error) {
	vals := make([]interface{}, a.Len())
	for i := 0; i < a.Len(); i++ {
		vals[i] = a.GetOneForMarshal(i)
	}
	// golang marshal standard says that []byte will be marshalled
	// as a base64-encoded string
	return json.Marshal(vals)
}

func arrayEqualBinaryView(left, right *BinaryView) bool {
	leftBufs, rightBufs := left.dataBuffers, right.dataBuffers
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if !left.ValueHeader(i).Equals(leftBufs, right.ValueHeader(i), rightBufs) {
			return false
		}
	}
	return true
}

var (
	_ arrow.Array = (*Binary)(nil)
	_ arrow.Array = (*LargeBinary)(nil)
	_ arrow.Array = (*BinaryView)(nil)

	_ BinaryLike = (*Binary)(nil)
	_ BinaryLike = (*LargeBinary)(nil)

	_ arrow.TypedArray[[]byte] = (*Binary)(nil)
	_ arrow.TypedArray[[]byte] = (*LargeBinary)(nil)
	_ arrow.TypedArray[[]byte] = (*BinaryView)(nil)
)
