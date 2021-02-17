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
	"math"
	"strings"
	"unsafe"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/memory"
)

const (
	stringArrayMaximumCapacity = math.MaxInt32
)

// String represents an immutable sequence of variable-length UTF-8 strings.
type String struct {
	array
	offsets []int32
	values  string
}

// NewStringData constructs a new String array from data.
func NewStringData(data *Data) *String {
	a := &String{}
	a.refCount = 1
	a.setData(data)
	return a
}

// Reset resets the String with a different set of Data.
func (a *String) Reset(data *Data) {
	a.setData(data)
}

// Value returns the slice at index i. This value should not be mutated.
func (a *String) Value(i int) string {
	i = i + a.array.data.offset
	return a.values[a.offsets[i]:a.offsets[i+1]]
}

// ValueOffset returns the offset of the value at index i.
func (a *String) ValueOffset(i int) int { return int(a.offsets[i]) }

func (a *String) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString("(null)")
		default:
			fmt.Fprintf(o, "%q", a.Value(i))
		}
	}
	o.WriteString("]")
	return o.String()
}

func (a *String) setData(data *Data) {
	if len(data.buffers) != 3 {
		panic("arrow/array: len(data.buffers) != 3")
	}

	a.array.setData(data)

	if vdata := data.buffers[2]; vdata != nil {
		b := vdata.Bytes()
		a.values = *(*string)(unsafe.Pointer(&b))
	}

	if offsets := data.buffers[1]; offsets != nil {
		a.offsets = arrow.Int32Traits.CastFromBytes(offsets.Bytes())
	}
}

func arrayEqualString(left, right *String) bool {
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

// A StringBuilder is used to build a String array using the Append methods.
type StringBuilder struct {
	builder *BinaryBuilder
}

// NewStringBuilder creates a new StringBuilder.
func NewStringBuilder(mem memory.Allocator) *StringBuilder {
	b := &StringBuilder{
		builder: NewBinaryBuilder(mem, arrow.BinaryTypes.String),
	}
	return b
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (b *StringBuilder) Release() {
	b.builder.Release()
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (b *StringBuilder) Retain() {
	b.builder.Retain()
}

//
// Len returns the number of elements in the array builder.
func (b *StringBuilder) Len() int { return b.builder.Len() }

// Cap returns the total number of elements that can be stored without allocating additional memory.
func (b *StringBuilder) Cap() int { return b.builder.Cap() }

// NullN returns the number of null values in the array builder.
func (b *StringBuilder) NullN() int { return b.builder.NullN() }

// Append appends a string to the builder.
func (b *StringBuilder) Append(v string) {
	b.builder.Append([]byte(v))
}

// AppendNull appends a null to the builder.
func (b *StringBuilder) AppendNull() {
	b.builder.AppendNull()
}

// AppendValues will append the values in the v slice. The valid slice determines which values
// in v are valid (not null). The valid slice must either be empty or be equal in length to v. If empty,
// all values in v are appended and considered valid.
func (b *StringBuilder) AppendValues(v []string, valid []bool) {
	b.builder.AppendStringValues(v, valid)
}

// Value returns the string at index i.
func (b *StringBuilder) Value(i int) string {
	return string(b.builder.Value(i))
}

func (b *StringBuilder) init(capacity int) {
	b.builder.init(capacity)
}

func (b *StringBuilder) resize(newBits int, init func(int)) {
	b.builder.resize(newBits, init)
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *StringBuilder) Reserve(n int) {
	b.builder.Reserve(n)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *StringBuilder) Resize(n int) {
	b.builder.Resize(n)
}

// NewArray creates a String array from the memory buffers used by the builder and resets the StringBuilder
// so it can be used to build a new array.
func (b *StringBuilder) NewArray() Interface {
	return b.NewStringArray()
}

// NewStringArray creates a String array from the memory buffers used by the builder and resets the StringBuilder
// so it can be used to build a new array.
func (b *StringBuilder) NewStringArray() (a *String) {
	data := b.builder.newData()
	a = NewStringData(data)
	data.Release()
	return
}

var (
	_ Interface = (*String)(nil)
	_ Builder   = (*StringBuilder)(nil)
)
