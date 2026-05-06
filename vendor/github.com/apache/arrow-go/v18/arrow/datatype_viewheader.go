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

package arrow

import (
	"bytes"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow/endian"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

const (
	ViewPrefixLen  = 4
	viewInlineSize = 12
)

func IsViewInline(length int) bool {
	return length < viewInlineSize
}

// ViewHeader is a variable length string (utf8) or byte slice with
// a 4 byte prefix and inline optimization for small values (12 bytes
// or fewer). This is similar to Go's standard string but limited by
// a length of Uint32Max and up to the first four bytes of the string
// are copied into the struct. This prefix allows failing comparisons
// early and can reduce CPU cache working set when dealing with short
// strings.
//
// There are two situations:
//
//		Entirely inlined string data
//	                |----|------------|
//		                ^    ^
//		                |    |
//		              size  inline string data, zero padded
//
//		Reference into buffer
//	                |----|----|----|----|
//		                ^    ^     ^     ^
//		                |    |     |     |
//		              size prefix buffer index and offset to out-of-line portion
//
// Adapted from TU Munich's UmbraDB [1], Velox, DuckDB.
//
// [1]: https://db.in.tum.de/~freitag/papers/p29-neumann-cidr20.pdf
type ViewHeader struct {
	size int32
	// the first 4 bytes of this are the prefix for the string
	// if size <= StringHeaderInlineSize, then the entire string
	// is in the data array and is zero padded.
	// if size > StringHeaderInlineSize, the next 8 bytes are 2 uint32
	// values which are the buffer index and offset in that buffer
	// containing the full string.
	data [viewInlineSize]byte
}

func (sh *ViewHeader) IsInline() bool {
	return sh.size <= int32(viewInlineSize)
}

func (sh *ViewHeader) Len() int { return int(sh.size) }
func (sh *ViewHeader) Prefix() [ViewPrefixLen]byte {
	return *(*[4]byte)(unsafe.Pointer(&sh.data))
}

func (sh *ViewHeader) BufferIndex() int32 {
	return int32(endian.Native.Uint32(sh.data[ViewPrefixLen:]))
}

func (sh *ViewHeader) BufferOffset() int32 {
	return int32(endian.Native.Uint32(sh.data[ViewPrefixLen+4:]))
}

func (sh *ViewHeader) InlineBytes() (data []byte) {
	debug.Assert(sh.IsInline(), "calling InlineBytes on non-inline ViewHeader")
	return sh.data[:sh.size]
}

func (sh *ViewHeader) SetBytes(data []byte) int {
	sh.size = int32(len(data))
	if sh.IsInline() {
		return copy(sh.data[:], data)
	}
	return copy(sh.data[:4], data)
}

func (sh *ViewHeader) SetString(data string) int {
	sh.size = int32(len(data))
	if sh.IsInline() {
		return copy(sh.data[:], data)
	}
	return copy(sh.data[:4], data)
}

func (sh *ViewHeader) SetIndexOffset(bufferIndex, offset int32) {
	endian.Native.PutUint32(sh.data[ViewPrefixLen:], uint32(bufferIndex))
	endian.Native.PutUint32(sh.data[ViewPrefixLen+4:], uint32(offset))
}

func (sh *ViewHeader) Equals(buffers []*memory.Buffer, other *ViewHeader, otherBuffers []*memory.Buffer) bool {
	if sh.sizeAndPrefixAsInt64() != other.sizeAndPrefixAsInt64() {
		return false
	}

	if sh.IsInline() {
		return sh.inlinedAsInt64() == other.inlinedAsInt64()
	}

	return bytes.Equal(sh.getBufferBytes(buffers), other.getBufferBytes(otherBuffers))
}

func (sh *ViewHeader) getBufferBytes(buffers []*memory.Buffer) []byte {
	offset := sh.BufferOffset()
	return buffers[sh.BufferIndex()].Bytes()[offset : offset+sh.size]
}

func (sh *ViewHeader) inlinedAsInt64() int64 {
	s := unsafe.Slice((*int64)(unsafe.Pointer(sh)), 2)
	return s[1]
}

func (sh *ViewHeader) sizeAndPrefixAsInt64() int64 {
	s := unsafe.Slice((*int64)(unsafe.Pointer(sh)), 2)
	return s[0]
}
