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

	"github.com/apache/arrow/go/arrow/bitutil"
	"github.com/apache/arrow/go/arrow/internal/debug"
	"github.com/apache/arrow/go/arrow/memory"
)

// A bufferBuilder provides common functionality for populating memory with a sequence of type-specific values.
// Specialized implementations provide type-safe APIs for appending and accessing the memory.
type bufferBuilder struct {
	refCount int64
	mem      memory.Allocator
	buffer   *memory.Buffer
	length   int
	capacity int

	bytes []byte
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (b *bufferBuilder) Retain() {
	atomic.AddInt64(&b.refCount, 1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (b *bufferBuilder) Release() {
	debug.Assert(atomic.LoadInt64(&b.refCount) > 0, "too many releases")

	if atomic.AddInt64(&b.refCount, -1) == 0 {
		if b.buffer != nil {
			b.buffer.Release()
			b.buffer, b.bytes = nil, nil
		}
	}
}

// Len returns the length of the memory buffer in bytes.
func (b *bufferBuilder) Len() int { return b.length }

// Cap returns the total number of bytes that can be stored without allocating additional memory.
func (b *bufferBuilder) Cap() int { return b.capacity }

// Bytes returns a slice of length b.Len().
// The slice is only valid for use until the next buffer modification. That is, until the next call
// to Advance, Reset, Finish or any Append function. The slice aliases the buffer content at least until the next
// buffer modification.
func (b *bufferBuilder) Bytes() []byte { return b.bytes[:b.length] }

func (b *bufferBuilder) resize(elements int) {
	if b.buffer == nil {
		b.buffer = memory.NewResizableBuffer(b.mem)
	}

	b.buffer.Resize(elements)
	oldCapacity := b.capacity
	b.capacity = b.buffer.Cap()
	b.bytes = b.buffer.Buf()

	if b.capacity > oldCapacity {
		memory.Set(b.bytes[oldCapacity:], 0)
	}
}

// Advance increases the buffer by length and initializes the skipped bytes to zero.
func (b *bufferBuilder) Advance(length int) {
	if b.capacity < b.length+length {
		newCapacity := bitutil.NextPowerOf2(b.length + length)
		b.resize(newCapacity)
	}
	b.length += length
}

// Append appends the contents of v to the buffer, resizing it if necessary.
func (b *bufferBuilder) Append(v []byte) {
	if b.capacity < b.length+len(v) {
		newCapacity := bitutil.NextPowerOf2(b.length + len(v))
		b.resize(newCapacity)
	}
	b.unsafeAppend(v)
}

// Reset returns the buffer to an empty state. Reset releases the memory and sets the length and capacity to zero.
func (b *bufferBuilder) Reset() {
	if b.buffer != nil {
		b.buffer.Release()
	}
	b.buffer, b.bytes = nil, nil
	b.capacity, b.length = 0, 0
}

// Finish TODO(sgc)
func (b *bufferBuilder) Finish() (buffer *memory.Buffer) {
	if b.length > 0 {
		b.buffer.ResizeNoShrink(b.length)
	}
	buffer = b.buffer
	b.buffer = nil
	b.Reset()
	return
}

func (b *bufferBuilder) unsafeAppend(data []byte) {
	copy(b.bytes[b.length:], data)
	b.length += len(data)
}
