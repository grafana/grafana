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
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

type bufBuilder interface {
	Retain()
	Release()
	Len() int
	Cap() int
	Bytes() []byte
	resize(int)
	Advance(int)
	SetLength(int)
	Append([]byte)
	Reset()
	Finish() *memory.Buffer
}

// A bufferBuilder provides common functionality for populating memory with a sequence of type-specific values.
// Specialized implementations provide type-safe APIs for appending and accessing the memory.
type bufferBuilder struct {
	refCount atomic.Int64
	mem      memory.Allocator
	buffer   *memory.Buffer
	length   int
	capacity int

	bytes []byte
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (b *bufferBuilder) Retain() {
	b.refCount.Add(1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (b *bufferBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
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

	b.buffer.ResizeNoShrink(elements)
	oldCapacity := b.capacity
	b.capacity = b.buffer.Cap()
	b.bytes = b.buffer.Buf()

	if b.capacity > oldCapacity {
		memory.Set(b.bytes[oldCapacity:], 0)
	}
}

func (b *bufferBuilder) SetLength(length int) {
	if length > b.length {
		b.Advance(length)
		return
	}

	b.length = length
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
	if buffer == nil {
		buffer = memory.NewBufferBytes(nil)
	}
	return
}

func (b *bufferBuilder) unsafeAppend(data []byte) {
	copy(b.bytes[b.length:], data)
	b.length += len(data)
}

type multiBufferBuilder struct {
	refCount  atomic.Int64
	blockSize int

	mem              memory.Allocator
	blocks           []*memory.Buffer
	currentOutBuffer int
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (b *multiBufferBuilder) Retain() {
	b.refCount.Add(1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (b *multiBufferBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		b.Reset()
	}
}

func (b *multiBufferBuilder) Reserve(nbytes int) {
	if len(b.blocks) == 0 {
		out := memory.NewResizableBuffer(b.mem)
		if nbytes < b.blockSize {
			nbytes = b.blockSize
		}
		out.Reserve(nbytes)
		b.currentOutBuffer = 0
		b.blocks = []*memory.Buffer{out}
		return
	}

	curBuf := b.blocks[b.currentOutBuffer]
	remain := curBuf.Cap() - curBuf.Len()
	if nbytes <= remain {
		return
	}

	// search for underfull block that has enough bytes
	for i, block := range b.blocks {
		remaining := block.Cap() - block.Len()
		if nbytes <= remaining {
			b.currentOutBuffer = i
			return
		}
	}

	// current buffer doesn't have enough space, no underfull buffers
	// make new buffer and set that as our current.
	newBuf := memory.NewResizableBuffer(b.mem)
	if nbytes < b.blockSize {
		nbytes = b.blockSize
	}

	newBuf.Reserve(nbytes)
	b.currentOutBuffer = len(b.blocks)
	b.blocks = append(b.blocks, newBuf)
}

func (b *multiBufferBuilder) RemainingBytes() int {
	if len(b.blocks) == 0 {
		return 0
	}

	buf := b.blocks[b.currentOutBuffer]
	return buf.Cap() - buf.Len()
}

func (b *multiBufferBuilder) Reset() {
	b.currentOutBuffer = 0
	for _, block := range b.Finish() {
		block.Release()
	}
}

func (b *multiBufferBuilder) UnsafeAppend(hdr *arrow.ViewHeader, val []byte) {
	buf := b.blocks[b.currentOutBuffer]
	idx, offset := b.currentOutBuffer, buf.Len()
	hdr.SetIndexOffset(int32(idx), int32(offset))

	n := copy(buf.Buf()[offset:], val)
	buf.ResizeNoShrink(offset + n)
}

func (b *multiBufferBuilder) UnsafeAppendString(hdr *arrow.ViewHeader, val string) {
	// create a byte slice with zero-copies
	// in go1.20 this would be equivalent to unsafe.StringData
	v := *(*[]byte)(unsafe.Pointer(&struct {
		string
		int
	}{val, len(val)}))
	b.UnsafeAppend(hdr, v)
}

func (b *multiBufferBuilder) Finish() (out []*memory.Buffer) {
	b.currentOutBuffer = 0
	out, b.blocks = b.blocks, nil
	return
}
