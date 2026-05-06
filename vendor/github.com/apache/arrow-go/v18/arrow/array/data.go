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
	"hash/maphash"
	"math/bits"
	"sync/atomic"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

// Data represents the memory and metadata of an Arrow array.
type Data struct {
	refCount atomic.Int64
	dtype    arrow.DataType
	nulls    int
	offset   int
	length   int

	// for dictionary arrays: buffers will be the null validity bitmap and the indexes that reference
	// values in the dictionary member. childData would be empty in a dictionary array
	buffers    []*memory.Buffer  // TODO(sgc): should this be an interface?
	childData  []arrow.ArrayData // TODO(sgc): managed by ListArray, StructArray and UnionArray types
	dictionary *Data             // only populated for dictionary arrays
}

// NewData creates a new Data.
func NewData(dtype arrow.DataType, length int, buffers []*memory.Buffer, childData []arrow.ArrayData, nulls, offset int) *Data {
	for _, b := range buffers {
		if b != nil {
			b.Retain()
		}
	}

	for _, child := range childData {
		if child != nil {
			child.Retain()
		}
	}

	d := &Data{
		dtype:     dtype,
		nulls:     nulls,
		length:    length,
		offset:    offset,
		buffers:   buffers,
		childData: childData,
	}
	d.refCount.Add(1)
	return d
}

// NewDataWithDictionary creates a new data object, but also sets the provided dictionary into the data if it's not nil
func NewDataWithDictionary(dtype arrow.DataType, length int, buffers []*memory.Buffer, nulls, offset int, dict *Data) *Data {
	data := NewData(dtype, length, buffers, nil, nulls, offset)
	if dict != nil {
		dict.Retain()
	}
	data.dictionary = dict
	return data
}

func (d *Data) Copy() *Data {
	// don't pass the slices directly, otherwise it retains the connection
	// we need to make new slices and populate them with the same pointers
	bufs := make([]*memory.Buffer, len(d.buffers))
	copy(bufs, d.buffers)
	children := make([]arrow.ArrayData, len(d.childData))
	copy(children, d.childData)

	data := NewData(d.dtype, d.length, bufs, children, d.nulls, d.offset)
	data.SetDictionary(d.dictionary)
	return data
}

// Reset sets the Data for re-use.
func (d *Data) Reset(dtype arrow.DataType, length int, buffers []*memory.Buffer, childData []arrow.ArrayData, nulls, offset int) {
	// Retain new buffers before releasing existing buffers in-case they're the same ones to prevent accidental premature
	// release.
	for _, b := range buffers {
		if b != nil {
			b.Retain()
		}
	}
	for _, b := range d.buffers {
		if b != nil {
			b.Release()
		}
	}
	d.buffers = buffers

	// Retain new children data before releasing existing children data in-case they're the same ones to prevent accidental
	// premature release.
	for _, d := range childData {
		if d != nil {
			d.Retain()
		}
	}
	for _, d := range d.childData {
		if d != nil {
			d.Release()
		}
	}
	d.childData = childData

	d.dtype = dtype
	d.length = length
	d.nulls = nulls
	d.offset = offset
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (d *Data) Retain() {
	d.refCount.Add(1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (d *Data) Release() {
	debug.Assert(d.refCount.Load() > 0, "too many releases")

	if d.refCount.Add(-1) == 0 {
		for _, b := range d.buffers {
			if b != nil {
				b.Release()
			}
		}

		for _, b := range d.childData {
			b.Release()
		}

		if d.dictionary != nil {
			d.dictionary.Release()
		}
		d.dictionary, d.buffers, d.childData = nil, nil, nil
	}
}

// DataType returns the DataType of the data.
func (d *Data) DataType() arrow.DataType { return d.dtype }

func (d *Data) SetNullN(n int) { d.nulls = n }

// NullN returns the number of nulls.
func (d *Data) NullN() int { return d.nulls }

// Len returns the length.
func (d *Data) Len() int { return d.length }

// Offset returns the offset.
func (d *Data) Offset() int { return d.offset }

// Buffers returns the buffers.
func (d *Data) Buffers() []*memory.Buffer { return d.buffers }

func (d *Data) Children() []arrow.ArrayData { return d.childData }

// Dictionary returns the ArrayData object for the dictionary member, or nil
func (d *Data) Dictionary() arrow.ArrayData { return d.dictionary }

// SetDictionary allows replacing the dictionary for this particular Data object
func (d *Data) SetDictionary(dict arrow.ArrayData) {
	if d.dictionary != nil {
		d.dictionary.Release()
		d.dictionary = nil
	}
	if dict.(*Data) != nil {
		dict.Retain()
		d.dictionary = dict.(*Data)
	}
}

// SizeInBytes returns the size of the Data and any children and/or dictionary in bytes by
// recursively examining the nested structures of children and/or dictionary.
// The value returned is an upper-bound since offset is not taken into account.
func (d *Data) SizeInBytes() uint64 {
	var size uint64

	if d == nil {
		return 0
	}

	for _, b := range d.Buffers() {
		if b != nil {
			size += uint64(b.Len())
		}
	}
	for _, c := range d.Children() {
		size += c.SizeInBytes()
	}
	if d.dictionary != nil {
		size += d.dictionary.SizeInBytes()
	}

	return size
}

// NewSliceData returns a new slice that shares backing data with the input.
// The returned Data slice starts at i and extends j-i elements, such as:
//
//	slice := data[i:j]
//
// The returned value must be Release'd after use.
//
// NewSliceData panics if the slice is outside the valid range of the input Data.
// NewSliceData panics if j < i.
func NewSliceData(data arrow.ArrayData, i, j int64) arrow.ArrayData {
	if j > int64(data.Len()) || i > j || data.Offset()+int(i) > data.Offset()+data.Len() {
		panic("arrow/array: index out of range")
	}

	for _, b := range data.Buffers() {
		if b != nil {
			b.Retain()
		}
	}

	for _, child := range data.Children() {
		if child != nil {
			child.Retain()
		}
	}

	if data.(*Data).dictionary != nil {
		data.(*Data).dictionary.Retain()
	}

	o := &Data{
		dtype:      data.DataType(),
		nulls:      UnknownNullCount,
		length:     int(j - i),
		offset:     data.Offset() + int(i),
		buffers:    data.Buffers(),
		childData:  data.Children(),
		dictionary: data.(*Data).dictionary,
	}
	o.refCount.Add(1)

	if data.NullN() == 0 {
		o.nulls = 0
	}

	return o
}

func Hash(h *maphash.Hash, data arrow.ArrayData) {
	a := data.(*Data)

	h.Write((*[bits.UintSize / 8]byte)(unsafe.Pointer(&a.length))[:])
	h.Write((*[bits.UintSize / 8]byte)(unsafe.Pointer(&a.length))[:])
	if len(a.buffers) > 0 && a.buffers[0] != nil {
		h.Write(a.buffers[0].Bytes())
	}
	for _, c := range a.childData {
		Hash(h, c)
	}
}
