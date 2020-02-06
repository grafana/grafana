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
	"strings"
	"sync/atomic"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/internal/bitutil"
	"github.com/apache/arrow/go/arrow/internal/debug"
	"github.com/apache/arrow/go/arrow/memory"
)

// FixedSizeList represents an immutable sequence of N array values.
type FixedSizeList struct {
	array
	n      int32
	values Interface
}

// NewFixedSizeListData returns a new List array value, from data.
func NewFixedSizeListData(data *Data) *FixedSizeList {
	a := &FixedSizeList{}
	a.refCount = 1
	a.setData(data)
	return a
}

func (a *FixedSizeList) ListValues() Interface { return a.values }

func (a *FixedSizeList) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		if !a.IsValid(i) {
			o.WriteString("(null)")
			continue
		}
		sub := a.newListValue(i)
		fmt.Fprintf(o, "%v", sub)
		sub.Release()
	}
	o.WriteString("]")
	return o.String()
}

func (a *FixedSizeList) newListValue(i int) Interface {
	n := int64(a.n)
	off := int64(a.array.data.offset)
	beg := (off + int64(i)) * n
	end := (off + int64(i+1)) * n
	sli := NewSlice(a.values, beg, end)
	return sli
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
			return ArrayEqual(l, r)
		}()
		if !o {
			return false
		}
	}
	return true
}

// Len returns the number of elements in the array.
func (a *FixedSizeList) Len() int { return a.array.Len() }

func (a *FixedSizeList) Retain() {
	a.array.Retain()
	a.values.Retain()
}

func (a *FixedSizeList) Release() {
	a.array.Release()
	a.values.Release()
}

type FixedSizeListBuilder struct {
	builder

	etype  arrow.DataType // data type of the list's elements.
	n      int32          // number of elements in the fixed-size list.
	values Builder        // value builder for the list's elements.
}

// NewFixedSizeListBuilder returns a builder, using the provided memory allocator.
// The created list builder will create a list whose elements will be of type etype.
func NewFixedSizeListBuilder(mem memory.Allocator, n int32, etype arrow.DataType) *FixedSizeListBuilder {
	return &FixedSizeListBuilder{
		builder: builder{refCount: 1, mem: mem},
		etype:   etype,
		n:       n,
		values:  newBuilder(mem, etype),
	}
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *FixedSizeListBuilder) Release() {
	debug.Assert(atomic.LoadInt64(&b.refCount) > 0, "too many releases")

	if atomic.AddInt64(&b.refCount, -1) == 0 {
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

func (b *FixedSizeListBuilder) AppendNull() {
	b.Reserve(1)
	b.unsafeAppendBoolToBitmap(false)
}

func (b *FixedSizeListBuilder) AppendValues(valid []bool) {
	b.Reserve(len(valid))
	b.builder.unsafeAppendBoolsToBitmap(valid, len(valid))
}

func (b *FixedSizeListBuilder) unsafeAppend(v bool) {
	bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	b.length++
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
	b.builder.reserve(n, b.Resize)
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
		b.builder.resize(n, b.builder.init)
	}
}

func (b *FixedSizeListBuilder) ValueBuilder() Builder {
	return b.values
}

// NewArray creates a List array from the memory buffers used by the builder and resets the FixedSizeListBuilder
// so it can be used to build a new array.
func (b *FixedSizeListBuilder) NewArray() Interface {
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
		arrow.FixedSizeListOf(b.n, b.etype), b.length,
		[]*memory.Buffer{b.nullBitmap},
		[]*Data{values.Data()},
		b.nulls,
		0,
	)
	b.reset()

	return
}

var (
	_ Interface = (*FixedSizeList)(nil)
	_ Builder   = (*FixedSizeListBuilder)(nil)
)
