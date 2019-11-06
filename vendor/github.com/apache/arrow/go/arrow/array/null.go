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
	"sync/atomic"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/internal/debug"
	"github.com/apache/arrow/go/arrow/memory"
)

// Null represents an immutable, degenerate array with no physical storage.
type Null struct {
	array
}

// NewNull returns a new Null array value of size n.
func NewNull(n int) *Null {
	a := &Null{}
	a.refCount = 1
	data := NewData(
		arrow.Null, n,
		[]*memory.Buffer{nil},
		nil,
		n,
		0,
	)
	a.setData(data)
	data.Release()
	return a
}

// NewNullData returns a new Null array value, from data.
func NewNullData(data *Data) *Null {
	a := &Null{}
	a.refCount = 1
	a.setData(data)
	return a
}

func (a *Null) setData(data *Data) {
	a.array.setData(data)
	a.array.nullBitmapBytes = nil
	a.array.data.nulls = a.array.data.length
}

type NullBuilder struct {
	builder
}

// NewNullBuilder returns a builder, using the provided memory allocator.
func NewNullBuilder(mem memory.Allocator) *NullBuilder {
	return &NullBuilder{builder: builder{refCount: 1, mem: mem}}
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *NullBuilder) Release() {
	debug.Assert(atomic.LoadInt64(&b.refCount) > 0, "too many releases")

	if atomic.AddInt64(&b.refCount, -1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
	}
}

func (b *NullBuilder) AppendNull() {
	b.builder.length++
	b.builder.nulls++
}

func (*NullBuilder) Reserve(size int) {}
func (*NullBuilder) Resize(size int)  {}

func (*NullBuilder) init(cap int)                       {}
func (*NullBuilder) resize(newBits int, init func(int)) {}

// NewArray creates a Null array from the memory buffers used by the builder and resets the NullBuilder
// so it can be used to build a new array.
func (b *NullBuilder) NewArray() Interface {
	return b.NewNullArray()
}

// NewNullArray creates a Null array from the memory buffers used by the builder and resets the NullBuilder
// so it can be used to build a new array.
func (b *NullBuilder) NewNullArray() (a *Null) {
	data := b.newData()
	a = NewNullData(data)
	data.Release()
	return
}

func (b *NullBuilder) newData() (data *Data) {
	data = NewData(
		arrow.Null, b.length,
		[]*memory.Buffer{nil},
		nil,
		b.nulls,
		0,
	)
	b.reset()

	return
}

var (
	_ Interface = (*Null)(nil)
	_ Builder   = (*NullBuilder)(nil)
)
