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

// Struct represents an ordered sequence of relative types.
type Struct struct {
	array
	fields []Interface
}

// NewStructData returns a new Struct array value from data.
func NewStructData(data *Data) *Struct {
	a := &Struct{}
	a.refCount = 1
	a.setData(data)
	return a
}

func (a *Struct) NumField() int         { return len(a.fields) }
func (a *Struct) Field(i int) Interface { return a.fields[i] }

func (a *Struct) String() string {
	o := new(strings.Builder)
	o.WriteString("{")
	for i, v := range a.fields {
		if i > 0 {
			o.WriteString(" ")
		}
		fmt.Fprintf(o, "%v", v)
	}
	o.WriteString("}")
	return o.String()
}

func (a *Struct) setData(data *Data) {
	a.array.setData(data)
	a.fields = make([]Interface, len(data.childData))
	for i, child := range data.childData {
		a.fields[i] = MakeFromData(child)
	}
}

func arrayEqualStruct(left, right *Struct) bool {
	for i, lf := range left.fields {
		rf := right.fields[i]
		if !ArrayEqual(lf, rf) {
			return false
		}
	}
	return true
}

func (a *Struct) Retain() {
	a.array.Retain()
	for _, f := range a.fields {
		f.Retain()
	}
}

func (a *Struct) Release() {
	a.array.Release()
	for _, f := range a.fields {
		f.Release()
	}
}

type StructBuilder struct {
	builder

	dtype  arrow.DataType
	fields []Builder
}

// NewStructBuilder returns a builder, using the provided memory allocator.
func NewStructBuilder(mem memory.Allocator, dtype *arrow.StructType) *StructBuilder {
	b := &StructBuilder{
		builder: builder{refCount: 1, mem: mem},
		dtype:   dtype,
		fields:  make([]Builder, len(dtype.Fields())),
	}
	for i, f := range dtype.Fields() {
		b.fields[i] = newBuilder(b.mem, f.Type)
	}
	return b
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *StructBuilder) Release() {
	debug.Assert(atomic.LoadInt64(&b.refCount) > 0, "too many releases")

	if atomic.AddInt64(&b.refCount, -1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
	}

	for _, f := range b.fields {
		f.Release()
	}
}

func (b *StructBuilder) Append(v bool) {
	b.Reserve(1)
	b.unsafeAppendBoolToBitmap(v)
	if !v {
		for _, f := range b.fields {
			f.AppendNull()
		}
	}
}

func (b *StructBuilder) AppendValues(valids []bool) {
	b.Reserve(len(valids))
	b.builder.unsafeAppendBoolsToBitmap(valids, len(valids))
}

func (b *StructBuilder) AppendNull() { b.Append(false) }

func (b *StructBuilder) unsafeAppend(v bool) {
	bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	b.length++
}

func (b *StructBuilder) unsafeAppendBoolToBitmap(isValid bool) {
	if isValid {
		bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	} else {
		b.nulls++
	}
	b.length++
}

func (b *StructBuilder) init(capacity int) {
	b.builder.init(capacity)
	for _, f := range b.fields {
		f.init(capacity)
	}
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *StructBuilder) Reserve(n int) {
	b.builder.reserve(n, b.Resize)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *StructBuilder) Resize(n int) {
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.builder.resize(n, b.builder.init)
		for _, f := range b.fields {
			f.resize(n, f.init)
		}
	}
}

func (b *StructBuilder) NumField() int              { return len(b.fields) }
func (b *StructBuilder) FieldBuilder(i int) Builder { return b.fields[i] }

// NewArray creates a Struct array from the memory buffers used by the builder and resets the StructBuilder
// so it can be used to build a new array.
func (b *StructBuilder) NewArray() Interface {
	return b.NewStructArray()
}

// NewStructArray creates a Struct array from the memory buffers used by the builder and resets the StructBuilder
// so it can be used to build a new array.
func (b *StructBuilder) NewStructArray() (a *Struct) {
	data := b.newData()
	a = NewStructData(data)
	data.Release()
	return
}

func (b *StructBuilder) newData() (data *Data) {
	fields := make([]*Data, len(b.fields))
	for i, f := range b.fields {
		arr := f.NewArray()
		defer arr.Release()
		fields[i] = arr.Data()
	}

	data = NewData(
		b.dtype, b.length,
		[]*memory.Buffer{
			b.nullBitmap,
			nil, // FIXME(sbinet)
		},
		fields,
		b.nulls,
		0,
	)
	b.reset()

	return
}

var (
	_ Interface = (*Struct)(nil)
	_ Builder   = (*StructBuilder)(nil)
)
