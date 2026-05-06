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

//go:build go1.18

package exec

import (
	"fmt"
	"math"
	"sync/atomic"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"golang.org/x/exp/constraints"
	"golang.org/x/exp/slices"
)

// GetSpanValues returns a properly typed slice by reinterpreting
// the buffer at index i using unsafe.Slice. This will take into account
// the offset of the given ArraySpan.
func GetSpanValues[T arrow.FixedWidthType](span *ArraySpan, i int) []T {
	if len(span.Buffers[i].Buf) == 0 {
		return nil
	}
	ret := unsafe.Slice((*T)(unsafe.Pointer(&span.Buffers[i].Buf[0])), span.Offset+span.Len)
	return ret[span.Offset:]
}

// GetSpanOffsets is like GetSpanValues, except it is only for int32
// or int64 and adds the additional 1 expected value for an offset
// buffer (ie. len(output) == span.Len+1)
func GetSpanOffsets[T int32 | int64](span *ArraySpan, i int) []T {
	ret := unsafe.Slice((*T)(unsafe.Pointer(&span.Buffers[i].Buf[0])), span.Offset+span.Len+1)
	return ret[span.Offset:]
}

func Min[T constraints.Ordered](a, b T) T {
	if a < b {
		return a
	}
	return b
}

func Max[T constraints.Ordered](a, b T) T {
	if a > b {
		return a
	}
	return b
}

// OptionsInit should be used in the case where a KernelState is simply
// represented with a specific type by value (instead of pointer).
// This will initialize the KernelState as a value-copied instance of
// the passed in function options argument to ensure separation
// and allow the kernel to manipulate the options if necessary without
// any negative consequences since it will have its own copy of the options.
func OptionsInit[T any](_ *KernelCtx, args KernelInitArgs) (KernelState, error) {
	if opts, ok := args.Options.(*T); ok {
		return *opts, nil
	}

	return nil, fmt.Errorf("%w: attempted to initialize kernel state from invalid function options",
		arrow.ErrInvalid)
}

type arrayBuilder[T arrow.NumericType | bool] interface {
	array.Builder
	Append(T)
	AppendValues([]T, []bool)
}

func ArrayFromSlice[T arrow.NumericType | bool](mem memory.Allocator, data []T) arrow.Array {
	bldr := array.NewBuilder(mem, arrow.GetDataType[T]()).(arrayBuilder[T])
	defer bldr.Release()

	bldr.AppendValues(data, nil)
	return bldr.NewArray()
}

func ArrayFromSliceWithValid[T arrow.NumericType | bool](mem memory.Allocator, data []T, valid []bool) arrow.Array {
	bldr := array.NewBuilder(mem, arrow.GetDataType[T]()).(arrayBuilder[T])
	defer bldr.Release()

	bldr.AppendValues(data, valid)
	return bldr.NewArray()
}

func RechunkArraysConsistently(groups [][]arrow.Array) [][]arrow.Array {
	if len(groups) <= 1 {
		return groups
	}

	var totalLen int
	for _, a := range groups[0] {
		totalLen += a.Len()
	}

	if totalLen == 0 {
		return groups
	}

	rechunked := make([][]arrow.Array, len(groups))
	offsets := make([]int64, len(groups))
	// scan all array vectors at once, rechunking along the way
	var start int64
	for start < int64(totalLen) {
		// first compute max possible length for next chunk
		var chunkLength int64 = math.MaxInt64
		for i, g := range groups {
			offset := offsets[i]
			// skip any done arrays including 0-length
			for offset == int64(g[0].Len()) {
				g = g[1:]
				offset = 0
			}
			arr := g[0]
			chunkLength = Min(chunkLength, int64(arr.Len())-offset)

			offsets[i] = offset
			groups[i] = g
		}

		// now slice all the arrays along this chunk size
		for i, g := range groups {
			offset := offsets[i]
			arr := g[0]
			if offset == 0 && int64(arr.Len()) == chunkLength {
				// slice spans entire array
				arr.Retain()
				rechunked[i] = append(rechunked[i], arr)
			} else {
				rechunked[i] = append(rechunked[i], array.NewSlice(arr, int64(offset), int64(offset+chunkLength)))
			}
			offsets[i] += chunkLength
		}

		start += int64(chunkLength)
	}
	return rechunked
}

type ChunkResolver struct {
	offsets []int64
	cached  atomic.Int64
}

func NewChunkResolver(chunks []arrow.Array) *ChunkResolver {
	offsets := make([]int64, len(chunks)+1)
	var offset int64
	for i, c := range chunks {
		curOffset := offset
		offset += int64(c.Len())
		offsets[i] = curOffset
	}
	offsets[len(chunks)] = offset
	return &ChunkResolver{offsets: offsets}
}

func (c *ChunkResolver) Resolve(idx int64) (chunk, index int64) {
	// some algorithms consecutively access indexes that are a
	// relatively small distance from each other, falling into
	// the same chunk.
	// This is trivial when merging (assuming each side of the
	// merge uses its own resolver), but also in the inner
	// recursive invocations of partitioning.
	if len(c.offsets) <= 1 {
		return 0, idx
	}

	cached := c.cached.Load()
	cacheHit := idx >= c.offsets[cached] && idx < c.offsets[cached+1]
	if cacheHit {
		return cached, idx - c.offsets[cached]
	}

	chkIdx, found := slices.BinarySearch(c.offsets, idx)
	if !found {
		chkIdx--
	}

	chunk, index = int64(chkIdx), idx-c.offsets[chkIdx]
	c.cached.Store(chunk)
	return
}

type arrayTypes interface {
	arrow.FixedWidthType | arrow.TemporalType | bool | string | []byte
}

type ArrayIter[T arrayTypes] interface {
	Next() T
}

type BoolIter struct {
	Rdr *bitutil.BitmapReader
}

func NewBoolIter(arr *ArraySpan) ArrayIter[bool] {
	return &BoolIter{
		Rdr: bitutil.NewBitmapReader(arr.Buffers[1].Buf, int(arr.Offset), int(arr.Len)),
	}
}

func (b *BoolIter) Next() (out bool) {
	out = b.Rdr.Set()
	b.Rdr.Next()
	return
}

type PrimitiveIter[T arrow.FixedWidthType] struct {
	Values []T
}

func NewPrimitiveIter[T arrow.FixedWidthType](arr *ArraySpan) ArrayIter[T] {
	return &PrimitiveIter[T]{Values: GetSpanValues[T](arr, 1)}
}

func (p *PrimitiveIter[T]) Next() (v T) {
	v = p.Values[0]
	p.Values = p.Values[1:]
	return
}

type VarBinaryIter[OffsetT int32 | int64] struct {
	Offsets []OffsetT
	Data    []byte
	Pos     int64
}

func NewVarBinaryIter[OffsetT int32 | int64](arr *ArraySpan) ArrayIter[[]byte] {
	return &VarBinaryIter[OffsetT]{
		Offsets: GetSpanOffsets[OffsetT](arr, 1),
		Data:    arr.Buffers[2].Buf,
	}
}

func (v *VarBinaryIter[OffsetT]) Next() []byte {
	cur := v.Pos
	v.Pos++
	return v.Data[v.Offsets[cur]:v.Offsets[v.Pos]]
}

type FSBIter struct {
	Data  []byte
	Width int
	Pos   int64
}

func NewFSBIter(arr *ArraySpan) ArrayIter[[]byte] {
	return &FSBIter{
		Data:  arr.Buffers[1].Buf,
		Width: arr.Type.(arrow.FixedWidthDataType).Bytes(),
	}
}

func (f *FSBIter) Next() []byte {
	start := f.Width * int(f.Pos)
	f.Pos++
	return f.Data[start : start+f.Width]
}
