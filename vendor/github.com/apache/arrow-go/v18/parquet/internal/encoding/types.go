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

package encoding

import (
	"io"
	"sync"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"golang.org/x/xerrors"
)

// TypedDecoder is the general interface for all decoder types which can
// then be type asserted to a specific Type Decoder
type TypedDecoder interface {
	// SetData updates the data in the decoder with the passed in byte slice and the
	// stated number of values as expected to be decoded.
	SetData(buffered int, buf []byte) error
	// Encoding returns the encoding type that this decoder decodes data of
	Encoding() parquet.Encoding
	// ValuesLeft returns the number of remaining values to be decoded
	ValuesLeft() int
	// Type returns the physical type this can decode.
	Type() parquet.Type
	// Discard the next n values from the decoder, returning the actual number
	// of values that were able to be discarded (should be equal to n unless an
	// error occurs).
	Discard(n int) (int, error)
}

// DictDecoder is a special TypedDecoder which implements dictionary decoding
type DictDecoder interface {
	TypedDecoder
	// SetDict takes in a decoder which can decode the dictionary index to be used
	SetDict(TypedDecoder)
}

// TypedEncoder is the general interface for all encoding types which
// can then be type asserted to a specific Type Encoder
type TypedEncoder interface {
	// Bytes returns the current slice of bytes that have been encoded but does not pass ownership
	Bytes() []byte
	// Reset resets the encoder and dumps all the data to let it be reused.
	Reset()
	// ReserveForWrite reserves n bytes in the buffer so that the next n bytes written will not
	// cause a memory allocation.
	ReserveForWrite(n int)
	// EstimatedDataEncodedSize returns the estimated number of bytes in the buffer
	// so far.
	EstimatedDataEncodedSize() int64
	// FlushValues finishes up any unwritten data and returns the buffer of data passing
	// ownership to the caller, Release needs to be called on the Buffer to free the memory
	// if error is nil
	FlushValues() (Buffer, error)
	// Encoding returns the type of encoding that this encoder operates with
	Encoding() parquet.Encoding
	// Allocator returns the allocator that was used when creating this encoder
	Allocator() memory.Allocator
	// Type returns the underlying physical type this encodes.
	Type() parquet.Type
	Release()
}

// DictEncoder is a special kind of TypedEncoder which implements Dictionary
// encoding.
type DictEncoder interface {
	TypedEncoder
	// WriteIndices populates the byte slice with the final indexes of data and returns
	// the number of bytes written
	WriteIndices(out []byte) (int, error)
	// DictEncodedSize returns the current size of the encoded dictionary index.
	DictEncodedSize() int
	// BitWidth returns the bitwidth needed to encode all of the index values based
	// on the number of values in the dictionary index.
	BitWidth() int
	// WriteDict populates out with the dictionary index values, out should be sized to at least
	// as many bytes as DictEncodedSize
	WriteDict(out []byte)
	// NumEntries returns the number of values currently in the dictionary index.
	NumEntries() int
	// PutDictionary allows pre-seeding a dictionary encoder with
	// a dictionary from an Arrow Array.
	//
	// The passed in array must not have any nulls and this can only
	// be called on an empty encoder. The dictionary passed in will
	// be stored internally as a preserved dictionary, and will be
	// released when this encoder is reset or released.
	PutDictionary(arrow.Array) error
	// PreservedDictionary returns the currently stored preserved dict
	// from PutDictionary or nil.
	PreservedDictionary() arrow.Array
	// PutIndices adds the indices from the passed in integral array to
	// the column data. It is assumed that the indices are within the bounds
	// of [0,dictSize) and is not validated. Returns an error if a non-integral
	// array is passed.
	PutIndices(arrow.Array) error
	// NormalizeDict takes an arrow array and normalizes it to a parquet
	// native type. e.g. a dictionary of type int8 will be cast to an int32
	// dictionary for parquet storage.
	//
	// The returned array must always be released by the caller.
	NormalizeDict(arrow.Array) (arrow.Array, error)
}

var bufferPool = sync.Pool{
	New: func() interface{} {
		return memory.NewResizableBuffer(memory.DefaultAllocator)
	},
}

// Buffer is an interface used as a general interface for handling buffers
// regardless of the underlying implementation.
type Buffer interface {
	Len() int
	Buf() []byte
	Bytes() []byte
	Resize(int)
	Release()
}

// poolBuffer is a buffer that will release the allocated buffer to a pool
// of buffers when release is called in order to allow it to be reused to
// cut down on the number of allocations.
type poolBuffer struct {
	buf *memory.Buffer
}

func (p poolBuffer) Resize(n int) { p.buf.ResizeNoShrink(n) }

func (p poolBuffer) Len() int { return p.buf.Len() }

func (p poolBuffer) Bytes() []byte { return p.buf.Bytes() }

func (p poolBuffer) Buf() []byte { return p.buf.Buf() }

func (p poolBuffer) Release() {
	if p.buf.Mutable() {
		memory.Set(p.buf.Buf(), 0)
		p.buf.ResizeNoShrink(0)
		bufferPool.Put(p.buf)
		return
	}

	p.buf.Release()
}

// PooledBufferWriter uses buffers from the buffer pool to back it while
// implementing io.Writer and io.WriterAt interfaces
type PooledBufferWriter struct {
	buf    *memory.Buffer
	pos    int
	offset int
}

// NewPooledBufferWriter returns a new buffer with 'initial' bytes reserved
// and pre-allocated to guarantee that writing that many more bytes will not
// require another allocation.
func NewPooledBufferWriter(initial int) *PooledBufferWriter {
	ret := &PooledBufferWriter{}
	ret.Reserve(initial)
	return ret
}

// SetOffset sets an offset in the buffer which will ensure that all references
// to offsets and sizes in the buffer will be offset by this many bytes, allowing
// the writer to reserve space in the buffer.
func (b *PooledBufferWriter) SetOffset(offset int) {
	b.pos -= b.offset
	b.offset = offset
	b.pos += offset
}

// Reserve pre-allocates nbytes to ensure that the next write of that many bytes
// will not require another allocation.
func (b *PooledBufferWriter) Reserve(nbytes int) {
	if b.buf == nil {
		b.buf = bufferPool.Get().(*memory.Buffer)
	}

	newCap := utils.Max(b.buf.Cap(), 256)
	for newCap < b.pos+nbytes {
		newCap = bitutil.NextPowerOf2(b.pos + nbytes)
	}
	b.buf.Reserve(newCap)
}

// Reset will release any current memory and initialize it with the new
// allocated bytes.
func (b *PooledBufferWriter) Reset(initial int) {
	if b.buf != nil {
		memory.Set(b.buf.Buf(), 0)
		b.buf.ResizeNoShrink(0)
		bufferPool.Put(b.buf)
		b.buf = nil
	}

	b.pos = 0
	b.offset = 0
	b.Reserve(initial)
}

// Finish returns the current buffer, with the responsibility for releasing
// the memory on the caller, resetting this writer to be re-used
func (b *PooledBufferWriter) Finish() Buffer {
	if b.buf.Len() < b.pos {
		b.buf.ResizeNoShrink(b.pos)
	}
	buf := poolBuffer{b.buf}

	b.buf = nil
	b.Reset(0)
	return buf
}

// WriteAt writes the bytes from p into this buffer starting at offset.
//
// Does not affect the internal position of the writer.
func (b *PooledBufferWriter) WriteAt(p []byte, offset int64) (n int, err error) {
	if len(p) == 0 {
		return 0, nil
	}
	offset += int64(b.offset)
	need := int(offset) + len(p)

	if need >= b.buf.Cap() {
		b.Reserve(need - b.pos)
	}
	n = copy(b.buf.Buf()[offset:], p)

	if need > b.buf.Len() {
		b.buf.ResizeNoShrink(need)
	}
	return
}

func (b *PooledBufferWriter) Write(buf []byte) (int, error) {
	if len(buf) == 0 {
		return 0, nil
	}
	b.Reserve(len(buf))
	return b.UnsafeWrite(buf)
}

func (b *PooledBufferWriter) UnsafeWriteCopy(ncopies int, pattern []byte) (int, error) {
	nbytes := len(pattern) * ncopies
	slc := b.buf.Buf()[b.pos : b.pos+nbytes]
	copy(slc, pattern)
	for j := len(pattern); j < len(slc); j *= 2 {
		copy(slc[j:], slc[:j])
	}
	b.pos += nbytes
	return nbytes, nil
}

// UnsafeWrite does not check the capacity / length before writing.
func (b *PooledBufferWriter) UnsafeWrite(buf []byte) (n int, err error) {
	n = copy(b.buf.Buf()[b.pos:], buf)
	b.pos += n
	return
}

func (b *PooledBufferWriter) Tell() int64 {
	return int64(b.pos)
}

// Bytes returns the current bytes slice of slice Len
func (b *PooledBufferWriter) Bytes() []byte {
	if b.buf.Len() < b.pos {
		b.buf.ResizeNoShrink(b.pos)
	}
	return b.buf.Bytes()[b.offset:]
}

// Len provides the current Length of the byte slice
func (b *PooledBufferWriter) Len() int {
	if b.buf.Len() < b.pos {
		b.buf.ResizeNoShrink(b.pos)
	}
	return b.buf.Len() - b.offset
}

// BufferWriter is a utility class for building and writing to a memory.Buffer
// with a given allocator that fulfills the interfaces io.Write, io.WriteAt
// and io.Seeker, while providing the ability to pre-allocate memory.
type BufferWriter struct {
	buffer *memory.Buffer
	pos    int
	mem    memory.Allocator

	offset int
}

// NewBufferWriterFromBuffer wraps the provided buffer to allow it to fulfill these
// interfaces.
func NewBufferWriterFromBuffer(b *memory.Buffer, mem memory.Allocator) *BufferWriter {
	return &BufferWriter{b, 0, mem, 0}
}

// NewBufferWriter constructs a buffer with initially reserved/allocated memory.
func NewBufferWriter(initial int, mem memory.Allocator) *BufferWriter {
	buf := memory.NewResizableBuffer(mem)
	buf.Reserve(initial)
	return &BufferWriter{buffer: buf, mem: mem}
}

func (b *BufferWriter) SetOffset(offset int) {
	b.offset = offset
}

// Bytes returns the current bytes slice of slice Len
func (b *BufferWriter) Bytes() []byte {
	return b.buffer.Bytes()[b.offset:]
}

// Len provides the current Length of the byte slice
func (b *BufferWriter) Len() int {
	return b.buffer.Len() - b.offset
}

// Cap returns the current capacity of the underlying buffer
func (b *BufferWriter) Cap() int {
	return b.buffer.Cap() - b.offset
}

// Finish returns the current buffer, with the responsibility for releasing
// the memory on the caller, resetting this writer to be re-used
func (b *BufferWriter) Finish() *memory.Buffer {
	buf := b.buffer
	b.buffer = nil
	b.Reset(0)
	return buf
}

// Release the underlying buffer and not allocate anything else. To re-use this buffer, Reset() or Finish() should be called
func (b *BufferWriter) Release() {
	b.buffer.Release()
	b.buffer = nil
}

func (b *BufferWriter) Truncate() {
	b.pos = 0
	b.offset = 0

	if b.buffer == nil {
		b.Reserve(1024)
	} else {
		b.buffer.ResizeNoShrink(0)
	}
}

// Reset will release any current memory and initialize it with the new
// allocated bytes.
func (b *BufferWriter) Reset(initial int) {
	if b.buffer != nil {
		b.buffer.Release()
	} else {
		b.buffer = memory.NewResizableBuffer(b.mem)
	}

	b.pos = 0
	b.offset = 0

	if initial > 0 {
		b.Reserve(initial)
	}
}

// Reserve ensures that there is at least enough capacity to write nbytes
// without another allocation, may allocate more than that in order to
// efficiently reduce allocations
func (b *BufferWriter) Reserve(nbytes int) {
	if b.buffer == nil {
		b.buffer = memory.NewResizableBuffer(b.mem)
	}
	newCap := utils.Max(b.buffer.Cap(), 256)
	for newCap < b.pos+nbytes {
		newCap = bitutil.NextPowerOf2(b.pos + nbytes)
	}
	b.buffer.Reserve(newCap)
}

// WriteAt writes the bytes from p into this buffer starting at offset.
//
// Does not affect the internal position of the writer.
func (b *BufferWriter) WriteAt(p []byte, offset int64) (n int, err error) {
	if len(p) == 0 {
		return 0, nil
	}
	offset += int64(b.offset)
	need := int(offset) + len(p)

	if need >= b.buffer.Cap() {
		b.Reserve(need - b.pos)
	}
	copy(b.buffer.Buf()[offset:], p)

	if need > b.buffer.Len() {
		b.buffer.ResizeNoShrink(need)
	}
	return len(p), nil
}

func (b *BufferWriter) Write(buf []byte) (int, error) {
	if len(buf) == 0 {
		return 0, nil
	}
	if b.buffer == nil {
		b.Reserve(len(buf))
	}

	if b.pos+b.offset+len(buf) >= b.buffer.Cap() {
		b.Reserve(len(buf))
	}
	return b.UnsafeWrite(buf)
}

func (b *BufferWriter) UnsafeWriteCopy(ncopies int, pattern []byte) (int, error) {
	nbytes := len(pattern) * ncopies
	slc := b.buffer.Buf()[b.pos : b.pos+nbytes]
	copy(slc, pattern)
	for j := len(pattern); j < len(slc); j *= 2 {
		copy(slc[j:], slc[:j])
	}
	b.pos += nbytes
	b.buffer.ResizeNoShrink(b.pos)
	return nbytes, nil
}

// UnsafeWrite does not check the capacity / length before writing.
func (b *BufferWriter) UnsafeWrite(buf []byte) (int, error) {
	copy(b.buffer.Buf()[b.pos+b.offset:], buf)
	b.pos += len(buf)
	b.buffer.ResizeNoShrink(b.pos)
	return len(buf), nil
}

// Seek fulfills the io.Seeker interface returning it's new position
// whence must be io.SeekStart, io.SeekCurrent or io.SeekEnd or it will be ignored.
func (b *BufferWriter) Seek(offset int64, whence int) (int64, error) {
	newPos, offs := 0, int(offset)
	offs += b.offset
	switch whence {
	case io.SeekStart:
		newPos = offs
	case io.SeekCurrent:
		newPos = b.pos + offs
	case io.SeekEnd:
		newPos = b.buffer.Len() + offs
	}
	if newPos < 0 {
		return 0, xerrors.New("negative result pos")
	}
	b.pos = newPos
	return int64(newPos), nil
}

func (b *BufferWriter) Tell() int64 {
	return int64(b.pos)
}

type fixedLenTypes interface {
	int32 | int64 | parquet.Int96 | float32 | float64
}

func getBytes[T fixedLenTypes](in []T) []byte {
	var z T
	return unsafe.Slice((*byte)(unsafe.Pointer(unsafe.SliceData(in))),
		len(in)*int(unsafe.Sizeof(z)))
}

func fromBytes[T fixedLenTypes](in []byte) []T {
	var z T
	return unsafe.Slice((*T)(unsafe.Pointer(unsafe.SliceData(in))),
		len(in)/int(unsafe.Sizeof(z)))
}

func requiredBytes[T fixedLenTypes](n int) int {
	var z T
	return n * int(unsafe.Sizeof(z))
}
