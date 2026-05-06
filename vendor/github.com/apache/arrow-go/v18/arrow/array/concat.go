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
	"errors"
	"fmt"
	"math"
	"math/bits"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/encoded"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	"github.com/apache/arrow-go/v18/internal/utils"
)

// Concatenate creates a new arrow.Array which is the concatenation of the
// passed in arrays. Returns nil if an error is encountered.
//
// The passed in arrays still need to be released manually, and will not be
// released by this function.
func Concatenate(arrs []arrow.Array, mem memory.Allocator) (result arrow.Array, err error) {
	if len(arrs) == 0 {
		return nil, errors.New("array/concat: must pass at least one array")
	}

	// gather Data of inputs
	data := make([]arrow.ArrayData, len(arrs))
	for i, ar := range arrs {
		if !arrow.TypeEqual(ar.DataType(), arrs[0].DataType()) {
			return nil, fmt.Errorf("arrays to be concatenated must be identically typed, but %s and %s were encountered",
				arrs[0].DataType(), ar.DataType())
		}
		data[i] = ar.Data()
	}

	out, err := concat(data, mem)
	if err != nil {
		return nil, err
	}

	defer out.Release()
	return MakeFromData(out), nil
}

// simple struct to hold ranges
type rng struct {
	offset, len int
}

// simple bitmap struct to reference a specific slice of a bitmap where the range
// offset and length are in bits
type bitmap struct {
	data []byte
	rng  rng
}

// gather up the bitmaps from the passed in data objects
func gatherBitmaps(data []arrow.ArrayData, idx int) []bitmap {
	out := make([]bitmap, len(data))
	for i, d := range data {
		if d.Buffers()[idx] != nil {
			out[i].data = d.Buffers()[idx].Bytes()
		}
		out[i].rng.offset = d.Offset()
		out[i].rng.len = d.Len()
	}
	return out
}

// gatherFixedBuffers gathers up the buffer objects of the given index, specifically
// returning only the slices of the buffers which are relevant to the passed in arrays
// in case they are themselves slices of other arrays. nil buffers are ignored and not
// in the output slice.
func gatherFixedBuffers(data []arrow.ArrayData, idx, byteWidth int) []*memory.Buffer {
	out := make([]*memory.Buffer, 0, len(data))
	for _, d := range data {
		buf := d.Buffers()[idx]
		if buf == nil {
			continue
		}

		out = append(out, memory.NewBufferBytes(buf.Bytes()[d.Offset()*byteWidth:(d.Offset()+d.Len())*byteWidth]))
	}
	return out
}

// gatherBuffersFixedWidthType is like gatherFixedBuffers, but uses a datatype to determine the size
// to use for determining the byte slice rather than a passed in bytewidth.
func gatherBuffersFixedWidthType(data []arrow.ArrayData, idx int, fixed arrow.FixedWidthDataType) []*memory.Buffer {
	return gatherFixedBuffers(data, idx, fixed.BitWidth()/8)
}

// gatherBufferRanges requires that len(ranges) == len(data) and returns a list of buffers
// which represent the corresponding range of each buffer in the specified index of each
// data object.
func gatherBufferRanges(data []arrow.ArrayData, idx int, ranges []rng) []*memory.Buffer {
	out := make([]*memory.Buffer, 0, len(data))
	for i, d := range data {
		buf := d.Buffers()[idx]
		if buf == nil {
			debug.Assert(ranges[i].len == 0, "misaligned buffer value ranges")
			continue
		}

		out = append(out, memory.NewBufferBytes(buf.Bytes()[ranges[i].offset:ranges[i].offset+ranges[i].len]))
	}
	return out
}

// gatherChildren gathers the children data objects for child of index idx for all of the data objects.
func gatherChildren(data []arrow.ArrayData, idx int) []arrow.ArrayData {
	return gatherChildrenMultiplier(data, idx, 1)
}

// gatherChildrenMultiplier gathers the full data slice of the underlying values from the children data objects
// such as the values data for a list array so that it can return a slice of the buffer for a given
// index into the children.
func gatherChildrenMultiplier(data []arrow.ArrayData, idx, multiplier int) []arrow.ArrayData {
	out := make([]arrow.ArrayData, len(data))
	for i, d := range data {
		out[i] = NewSliceData(d.Children()[idx], int64(d.Offset()*multiplier), int64(d.Offset()+d.Len())*int64(multiplier))
	}
	return out
}

// gatherChildrenRanges returns a slice of Data objects which each represent slices of the given ranges from the
// child in the specified index from each data object.
func gatherChildrenRanges(data []arrow.ArrayData, idx int, ranges []rng) []arrow.ArrayData {
	debug.Assert(len(data) == len(ranges), "mismatched children ranges for concat")
	out := make([]arrow.ArrayData, len(data))
	for i, d := range data {
		out[i] = NewSliceData(d.Children()[idx], int64(ranges[i].offset), int64(ranges[i].offset+ranges[i].len))
	}
	return out
}

// creates a single contiguous buffer which contains the concatenation of all of the passed
// in buffer objects.
func concatBuffers(bufs []*memory.Buffer, mem memory.Allocator) *memory.Buffer {
	outLen := 0
	for _, b := range bufs {
		outLen += b.Len()
	}
	out := memory.NewResizableBuffer(mem)
	out.Resize(outLen)

	data := out.Bytes()
	for _, b := range bufs {
		copy(data, b.Bytes())
		data = data[b.Len():]
	}
	return out
}

func handle32BitOffsets(outLen int, buffers []*memory.Buffer, out *memory.Buffer) (*memory.Buffer, []rng, error) {
	dst := arrow.Int32Traits.CastFromBytes(out.Bytes())
	valuesRanges := make([]rng, len(buffers))
	nextOffset := int32(0)
	nextElem := int(0)
	for i, b := range buffers {
		if b.Len() == 0 {
			valuesRanges[i].offset = 0
			valuesRanges[i].len = 0
			continue
		}

		// when we gather our buffers, we sliced off the last offset from the buffer
		// so that we could count the lengths accurately
		src := arrow.Int32Traits.CastFromBytes(b.Bytes())
		valuesRanges[i].offset = int(src[0])
		// expand our slice to see that final offset
		expand := src[:len(src)+1]
		// compute the length of this range by taking the final offset and subtracting where we started.
		valuesRanges[i].len = int(expand[len(src)]) - valuesRanges[i].offset

		if nextOffset > math.MaxInt32-int32(valuesRanges[i].len) {
			return nil, nil, errors.New("offset overflow while concatenating arrays")
		}

		// adjust each offset by the difference between our last ending point and our starting point
		adj := nextOffset - src[0]
		for j, o := range src {
			dst[nextElem+j] = adj + o
		}

		// the next index for an element in the output buffer
		nextElem += b.Len() / arrow.Int32SizeBytes
		// update our offset counter to be the total current length of our output
		nextOffset += int32(valuesRanges[i].len)
	}

	// final offset should point to the end of the data
	dst[outLen] = nextOffset
	return out, valuesRanges, nil
}

func unifyDictionaries(mem memory.Allocator, data []arrow.ArrayData, dt *arrow.DictionaryType) ([]*memory.Buffer, arrow.Array, error) {
	unifier, err := NewDictionaryUnifier(mem, dt.ValueType)
	if err != nil {
		return nil, nil, err
	}
	defer unifier.Release()

	newLookup := make([]*memory.Buffer, len(data))
	for i, d := range data {
		dictArr := MakeFromData(d.Dictionary())
		defer dictArr.Release()
		newLookup[i], err = unifier.UnifyAndTranspose(dictArr)
		if err != nil {
			return nil, nil, err
		}
	}

	unified, err := unifier.GetResultWithIndexType(dt.IndexType)
	if err != nil {
		for _, b := range newLookup {
			b.Release()
		}
		return nil, nil, err
	}
	return newLookup, unified, nil
}

func concatDictIndices(mem memory.Allocator, data []arrow.ArrayData, idxType arrow.FixedWidthDataType, transpositions []*memory.Buffer) (out *memory.Buffer, err error) {
	defer func() {
		if err != nil && out != nil {
			out.Release()
			out = nil
		}
	}()

	idxWidth := idxType.BitWidth() / 8
	outLen := 0
	for i, d := range data {
		outLen += d.Len()
		defer transpositions[i].Release()
	}

	out = memory.NewResizableBuffer(mem)
	out.Resize(outLen * idxWidth)

	outData := out.Bytes()
	for i, d := range data {
		transposeMap := arrow.Int32Traits.CastFromBytes(transpositions[i].Bytes())
		src := d.Buffers()[1].Bytes()
		if d.Buffers()[0] == nil {
			if err = utils.TransposeIntsBuffers(idxType, idxType, src, outData, d.Offset(), 0, d.Len(), transposeMap); err != nil {
				return
			}
		} else {
			rdr := bitutils.NewBitRunReader(d.Buffers()[0].Bytes(), int64(d.Offset()), int64(d.Len()))
			pos := 0
			for {
				run := rdr.NextRun()
				if run.Len == 0 {
					break
				}

				if run.Set {
					err = utils.TransposeIntsBuffers(idxType, idxType, src, outData, d.Offset()+pos, pos, int(run.Len), transposeMap)
					if err != nil {
						return
					}
				} else {
					memory.Set(outData[pos:pos+(int(run.Len)*idxWidth)], 0x00)
				}

				pos += int(run.Len)
			}
		}
		outData = outData[d.Len()*idxWidth:]
	}
	return
}

func handle64BitOffsets(outLen int, buffers []*memory.Buffer, out *memory.Buffer) (*memory.Buffer, []rng, error) {
	dst := arrow.Int64Traits.CastFromBytes(out.Bytes())
	valuesRanges := make([]rng, len(buffers))
	nextOffset := int64(0)
	nextElem := int(0)
	for i, b := range buffers {
		if b.Len() == 0 {
			valuesRanges[i].offset = 0
			valuesRanges[i].len = 0
			continue
		}

		// when we gather our buffers, we sliced off the last offset from the buffer
		// so that we could count the lengths accurately
		src := arrow.Int64Traits.CastFromBytes(b.Bytes())
		valuesRanges[i].offset = int(src[0])
		// expand our slice to see that final offset
		expand := src[:len(src)+1]
		// compute the length of this range by taking the final offset and subtracting where we started.
		valuesRanges[i].len = int(expand[len(src)]) - valuesRanges[i].offset

		if nextOffset > math.MaxInt64-int64(valuesRanges[i].len) {
			return nil, nil, errors.New("offset overflow while concatenating arrays")
		}

		// adjust each offset by the difference between our last ending point and our starting point
		adj := nextOffset - src[0]
		for j, o := range src {
			dst[nextElem+j] = adj + o
		}

		// the next index for an element in the output buffer
		nextElem += b.Len() / arrow.Int64SizeBytes
		// update our offset counter to be the total current length of our output
		nextOffset += int64(valuesRanges[i].len)
	}

	// final offset should point to the end of the data
	dst[outLen] = nextOffset
	return out, valuesRanges, nil
}

// concatOffsets creates a single offset buffer which represents the concatenation of all of the
// offsets buffers, adjusting the offsets appropriately to their new relative locations.
//
// It also returns the list of ranges that need to be fetched for the corresponding value buffers
// to construct the final concatenated value buffer.
func concatOffsets(buffers []*memory.Buffer, byteWidth int, mem memory.Allocator) (*memory.Buffer, []rng, error) {
	outLen := 0
	for _, b := range buffers {
		outLen += b.Len() / byteWidth
	}

	out := memory.NewResizableBuffer(mem)
	out.Resize(byteWidth * (outLen + 1))

	switch byteWidth {
	case arrow.Int64SizeBytes:
		return handle64BitOffsets(outLen, buffers, out)
	default:
		return handle32BitOffsets(outLen, buffers, out)
	}
}

func sumArraySizes(data []arrow.ArrayData) int {
	outSize := 0
	for _, arr := range data {
		outSize += arr.Len()
	}
	return outSize
}

func getListViewBufferValues[T int32 | int64](data arrow.ArrayData, i int) []T {
	bytes := data.Buffers()[i].Bytes()
	base := (*T)(unsafe.Pointer(&bytes[0]))
	ret := unsafe.Slice(base, data.Offset()+data.Len())
	return ret[data.Offset():]
}

func putListViewOffsets32(in arrow.ArrayData, displacement int32, out *memory.Buffer, outOff int) {
	debug.Assert(in.DataType().ID() == arrow.LIST_VIEW, "putListViewOffsets32: expected LIST_VIEW data")
	inOff, inLen := in.Offset(), in.Len()
	if inLen == 0 {
		return
	}
	bitmap := in.Buffers()[0]
	srcOffsets := getListViewBufferValues[int32](in, 1)
	srcSizes := getListViewBufferValues[int32](in, 2)
	isValidAndNonEmpty := func(i int) bool {
		return (bitmap == nil || bitutil.BitIsSet(bitmap.Bytes(), inOff+i)) && srcSizes[i] > 0
	}

	dstOffsets := arrow.Int32Traits.CastFromBytes(out.Bytes())
	for i, offset := range srcOffsets {
		if isValidAndNonEmpty(i) {
			// This is guaranteed by RangeOfValuesUsed returning the smallest offset
			// of valid and non-empty list-views.
			debug.Assert(offset+displacement >= 0, "putListViewOffsets32: offset underflow while concatenating arrays")
			dstOffsets[outOff+i] = offset + displacement
		} else {
			dstOffsets[outOff+i] = 0
		}
	}
}

func putListViewOffsets64(in arrow.ArrayData, displacement int64, out *memory.Buffer, outOff int) {
	debug.Assert(in.DataType().ID() == arrow.LARGE_LIST_VIEW, "putListViewOffsets64: expected LARGE_LIST_VIEW data")
	inOff, inLen := in.Offset(), in.Len()
	if inLen == 0 {
		return
	}
	bitmap := in.Buffers()[0]
	srcOffsets := getListViewBufferValues[int64](in, 1)
	srcSizes := getListViewBufferValues[int64](in, 2)
	isValidAndNonEmpty := func(i int) bool {
		return (bitmap == nil || bitutil.BitIsSet(bitmap.Bytes(), inOff+i)) && srcSizes[i] > 0
	}

	dstOffsets := arrow.Int64Traits.CastFromBytes(out.Bytes())
	for i, offset := range srcOffsets {
		if isValidAndNonEmpty(i) {
			// This is guaranteed by RangeOfValuesUsed returning the smallest offset
			// of valid and non-empty list-views.
			debug.Assert(offset+displacement >= 0, "putListViewOffsets64: offset underflow while concatenating arrays")
			dstOffsets[outOff+i] = offset + displacement
		} else {
			dstOffsets[outOff+i] = 0
		}
	}
}

// Concatenate buffers holding list-view offsets into a single buffer of offsets
//
// valueRanges contains the relevant ranges of values in the child array actually
// referenced to by the views. Most commonly, these ranges will start from 0,
// but when that is not the case, we need to adjust the displacement of offsets.
// The concatenated child array does not contain values from the beginning
// if they are not referenced to by any view.
func concatListViewOffsets(data []arrow.ArrayData, byteWidth int, valueRanges []rng, mem memory.Allocator) (*memory.Buffer, error) {
	outSize := sumArraySizes(data)
	if byteWidth == 4 && outSize > math.MaxInt32 {
		return nil, fmt.Errorf("%w: offset overflow while concatenating arrays", arrow.ErrInvalid)
	}
	out := memory.NewResizableBuffer(mem)
	out.Resize(byteWidth * outSize)

	numChildValues, elementsLength := 0, 0
	for i, arr := range data {
		displacement := numChildValues - valueRanges[i].offset
		if byteWidth == 4 {
			putListViewOffsets32(arr, int32(displacement), out, elementsLength)
		} else {
			putListViewOffsets64(arr, int64(displacement), out, elementsLength)
		}
		elementsLength += arr.Len()
		numChildValues += valueRanges[i].len
	}
	debug.Assert(elementsLength == outSize, "implementation error")

	return out, nil
}

func zeroNullListViewSizes[T int32 | int64](data arrow.ArrayData) {
	if data.Len() == 0 || data.Buffers()[0] == nil {
		return
	}
	validity := data.Buffers()[0].Bytes()
	sizes := getListViewBufferValues[T](data, 2)

	for i := 0; i < data.Len(); i++ {
		if !bitutil.BitIsSet(validity, data.Offset()+i) {
			sizes[i] = 0
		}
	}
}

func concatListView(data []arrow.ArrayData, offsetType arrow.FixedWidthDataType, out *Data, mem memory.Allocator) (err error) {
	// Calculate the ranges of values that each list-view array uses
	valueRanges := make([]rng, len(data))
	for i, input := range data {
		offset, len := rangeOfValuesUsed(input)
		valueRanges[i].offset = offset
		valueRanges[i].len = len
	}

	// Gather the children ranges of each input array
	childData := gatherChildrenRanges(data, 0, valueRanges)
	for _, c := range childData {
		defer c.Release()
	}

	// Concatenate the values
	values, err := concat(childData, mem)
	if err != nil {
		return err
	}

	// Concatenate the offsets
	offsetBuffer, err := concatListViewOffsets(data, offsetType.Bytes(), valueRanges, mem)
	if err != nil {
		return err
	}

	// Concatenate the sizes
	sizeBuffers := gatherBuffersFixedWidthType(data, 2, offsetType)
	sizeBuffer := concatBuffers(sizeBuffers, mem)

	out.childData = []arrow.ArrayData{values}
	out.buffers[1] = offsetBuffer
	out.buffers[2] = sizeBuffer

	// To make sure the sizes don't reference values that are not in the new
	// concatenated values array, we zero the sizes of null list-view values.
	if offsetType.ID() == arrow.INT32 {
		zeroNullListViewSizes[int32](out)
	} else {
		zeroNullListViewSizes[int64](out)
	}

	return nil
}

// concat is the implementation for actually performing the concatenation of the arrow.ArrayData
// objects that we can call internally for nested types.
func concat(data []arrow.ArrayData, mem memory.Allocator) (arr arrow.ArrayData, err error) {
	out := &Data{dtype: data[0].DataType(), nulls: 0}
	out.refCount.Add(1)

	defer func() {
		if pErr := recover(); pErr != nil {
			err = utils.FormatRecoveredError("arrow/concat", pErr)
		}
		if err != nil {
			out.Release()
		}
	}()
	for _, d := range data {
		out.length += d.Len()
		if out.nulls == UnknownNullCount || d.NullN() == UnknownNullCount {
			out.nulls = UnknownNullCount
			continue
		}
		out.nulls += d.NullN()
	}

	out.buffers = make([]*memory.Buffer, len(data[0].Buffers()))
	if out.nulls != 0 && out.dtype.ID() != arrow.NULL {
		bm, err := concatBitmaps(gatherBitmaps(data, 0), mem)
		if err != nil {
			return nil, err
		}
		out.buffers[0] = bm
	}

	dt := out.dtype
	if dt.ID() == arrow.EXTENSION {
		dt = dt.(arrow.ExtensionType).StorageType()
	}

	switch dt := dt.(type) {
	case *arrow.NullType:
	case *arrow.BooleanType:
		bm, err := concatBitmaps(gatherBitmaps(data, 1), mem)
		if err != nil {
			return nil, err
		}
		out.buffers[1] = bm
	case *arrow.DictionaryType:
		idxType := dt.IndexType.(arrow.FixedWidthDataType)
		// two cases: all dictionaries are the same or we need to unify them
		dictsSame := true
		dict0 := MakeFromData(data[0].Dictionary())
		defer dict0.Release()
		for _, d := range data {
			dict := MakeFromData(d.Dictionary())
			if !Equal(dict0, dict) {
				dict.Release()
				dictsSame = false
				break
			}
			dict.Release()
		}

		indexBuffers := gatherBuffersFixedWidthType(data, 1, idxType)
		if dictsSame {
			out.dictionary = dict0.Data().(*Data)
			out.dictionary.Retain()
			out.buffers[1] = concatBuffers(indexBuffers, mem)
			break
		}

		indexLookup, unifiedDict, err := unifyDictionaries(mem, data, dt)
		if err != nil {
			return nil, err
		}
		defer unifiedDict.Release()
		out.dictionary = unifiedDict.Data().(*Data)
		out.dictionary.Retain()

		out.buffers[1], err = concatDictIndices(mem, data, idxType, indexLookup)
		if err != nil {
			return nil, err
		}
	case arrow.FixedWidthDataType:
		out.buffers[1] = concatBuffers(gatherBuffersFixedWidthType(data, 1, dt), mem)
	case arrow.BinaryViewDataType:
		out.buffers = out.buffers[:2]
		for _, d := range data {
			for _, buf := range d.Buffers()[2:] {
				buf.Retain()
				out.buffers = append(out.buffers, buf)
			}
		}

		out.buffers[1] = concatBuffers(gatherFixedBuffers(data, 1, arrow.ViewHeaderSizeBytes), mem)

		var (
			s                  = arrow.ViewHeaderTraits.CastFromBytes(out.buffers[1].Bytes())
			i                  = data[0].Len()
			precedingBufsCount int
		)

		for idx := 1; idx < len(data); idx++ {
			precedingBufsCount += len(data[idx-1].Buffers()) - 2

			for end := i + data[idx].Len(); i < end; i++ {
				if s[i].IsInline() {
					continue
				}

				bufIndex := s[i].BufferIndex() + int32(precedingBufsCount)
				s[i].SetIndexOffset(bufIndex, s[i].BufferOffset())
			}
		}
	case arrow.BinaryDataType:
		offsetWidth := dt.Layout().Buffers[1].ByteWidth
		offsetBuffer, valueRanges, err := concatOffsets(gatherFixedBuffers(data, 1, offsetWidth), offsetWidth, mem)
		if err != nil {
			return nil, err
		}
		out.buffers[1] = offsetBuffer
		out.buffers[2] = concatBuffers(gatherBufferRanges(data, 2, valueRanges), mem)
	case *arrow.ListType:
		offsetWidth := dt.Layout().Buffers[1].ByteWidth
		offsetBuffer, valueRanges, err := concatOffsets(gatherFixedBuffers(data, 1, offsetWidth), offsetWidth, mem)
		if err != nil {
			return nil, err
		}
		childData := gatherChildrenRanges(data, 0, valueRanges)
		for _, c := range childData {
			defer c.Release()
		}

		out.buffers[1] = offsetBuffer
		out.childData = make([]arrow.ArrayData, 1)
		out.childData[0], err = concat(childData, mem)
		if err != nil {
			return nil, err
		}
	case *arrow.LargeListType:
		offsetWidth := dt.Layout().Buffers[1].ByteWidth
		offsetBuffer, valueRanges, err := concatOffsets(gatherFixedBuffers(data, 1, offsetWidth), offsetWidth, mem)
		if err != nil {
			return nil, err
		}
		childData := gatherChildrenRanges(data, 0, valueRanges)
		for _, c := range childData {
			defer c.Release()
		}

		out.buffers[1] = offsetBuffer
		out.childData = make([]arrow.ArrayData, 1)
		out.childData[0], err = concat(childData, mem)
		if err != nil {
			return nil, err
		}
	case *arrow.ListViewType:
		offsetType := arrow.PrimitiveTypes.Int32.(arrow.FixedWidthDataType)
		err := concatListView(data, offsetType, out, mem)
		if err != nil {
			return nil, err
		}
	case *arrow.LargeListViewType:
		offsetType := arrow.PrimitiveTypes.Int64.(arrow.FixedWidthDataType)
		err := concatListView(data, offsetType, out, mem)
		if err != nil {
			return nil, err
		}
	case *arrow.FixedSizeListType:
		childData := gatherChildrenMultiplier(data, 0, int(dt.Len()))
		for _, c := range childData {
			defer c.Release()
		}

		children, err := concat(childData, mem)
		if err != nil {
			return nil, err
		}
		out.childData = []arrow.ArrayData{children}
	case *arrow.StructType:
		out.childData = make([]arrow.ArrayData, dt.NumFields())
		for i := range dt.Fields() {
			children := gatherChildren(data, i)
			for _, c := range children {
				defer c.Release()
			}

			childData, err := concat(children, mem)
			if err != nil {
				return nil, err
			}
			out.childData[i] = childData
		}
	case *arrow.MapType:
		offsetWidth := dt.Layout().Buffers[1].ByteWidth
		offsetBuffer, valueRanges, err := concatOffsets(gatherFixedBuffers(data, 1, offsetWidth), offsetWidth, mem)
		if err != nil {
			return nil, err
		}
		childData := gatherChildrenRanges(data, 0, valueRanges)
		for _, c := range childData {
			defer c.Release()
		}

		out.buffers[1] = offsetBuffer
		out.childData = make([]arrow.ArrayData, 1)
		out.childData[0], err = concat(childData, mem)
		if err != nil {
			return nil, err
		}
	case *arrow.RunEndEncodedType:
		physicalLength, overflow := int(0), false
		// we can't use gatherChildren because the Offset and Len of
		// data doesn't correspond to the physical length or offset
		runs := make([]arrow.ArrayData, len(data))
		values := make([]arrow.ArrayData, len(data))
		for i, d := range data {
			plen := encoded.GetPhysicalLength(d)
			off := encoded.FindPhysicalOffset(d)

			runs[i] = NewSliceData(d.Children()[0], int64(off), int64(off+plen))
			defer runs[i].Release()
			values[i] = NewSliceData(d.Children()[1], int64(off), int64(off+plen))
			defer values[i].Release()

			physicalLength, overflow = addOvf(physicalLength, plen)
			if overflow {
				return nil, fmt.Errorf("%w: run end encoded array length must fit into a 32-bit signed integer",
					arrow.ErrInvalid)
			}
		}

		runEndsByteWidth := runs[0].DataType().(arrow.FixedWidthDataType).Bytes()
		runEndsBuffers := gatherFixedBuffers(runs, 1, runEndsByteWidth)
		outRunEndsLen := physicalLength * runEndsByteWidth
		outRunEndsBuf := memory.NewResizableBuffer(mem)
		outRunEndsBuf.Resize(outRunEndsLen)
		defer outRunEndsBuf.Release()

		if err := updateRunEnds(runEndsByteWidth, data, runEndsBuffers, outRunEndsBuf); err != nil {
			return nil, err
		}

		out.childData = make([]arrow.ArrayData, 2)
		out.childData[0] = NewData(data[0].Children()[0].DataType(), int(physicalLength),
			[]*memory.Buffer{nil, outRunEndsBuf}, nil, 0, 0)

		var err error
		out.childData[1], err = concat(values, mem)
		if err != nil {
			out.childData[0].Release()
			return nil, err
		}
	default:
		return nil, fmt.Errorf("concatenate not implemented for type %s", dt)
	}

	return out, nil
}

// check overflow in the addition, taken from bits.Add but adapted for signed integers
// rather than unsigned integers. bits.UintSize will be either 32 or 64 based on
// whether our architecture is 32 bit or 64. The operation is the same for both cases,
// the only difference is how much we need to shift by 30 for 32 bit and 62 for 64 bit.
// Thus, bits.UintSize - 2 is how much we shift right by to check if we had an overflow
// in the signed addition.
//
// First return is the result of the sum, the second return is true if there was an overflow
func addOvf(x, y int) (int, bool) {
	sum := x + y
	return sum, ((x&y)|((x|y)&^sum))>>(bits.UintSize-2) == 1
}

// concatenate bitmaps together and return a buffer with the combined bitmaps
func concatBitmaps(bitmaps []bitmap, mem memory.Allocator) (*memory.Buffer, error) {
	var (
		outlen   int
		overflow bool
	)

	for _, bm := range bitmaps {
		if outlen, overflow = addOvf(outlen, bm.rng.len); overflow {
			return nil, errors.New("length overflow when concatenating arrays")
		}
	}

	out := memory.NewResizableBuffer(mem)
	out.Resize(int(bitutil.BytesForBits(int64(outlen))))
	dst := out.Bytes()

	offset := 0
	for _, bm := range bitmaps {
		if bm.data == nil { // if the bitmap is nil, that implies that the value is true for all elements
			bitutil.SetBitsTo(out.Bytes(), int64(offset), int64(bm.rng.len), true)
		} else {
			bitutil.CopyBitmap(bm.data, bm.rng.offset, bm.rng.len, dst, offset)
		}
		offset += bm.rng.len
	}
	return out, nil
}

func updateRunEnds(byteWidth int, inputData []arrow.ArrayData, inputBuffers []*memory.Buffer, outputBuffer *memory.Buffer) error {
	switch byteWidth {
	case 2:
		out := arrow.Int16Traits.CastFromBytes(outputBuffer.Bytes())
		return updateRunsInt16(inputData, inputBuffers, out)
	case 4:
		out := arrow.Int32Traits.CastFromBytes(outputBuffer.Bytes())
		return updateRunsInt32(inputData, inputBuffers, out)
	case 8:
		out := arrow.Int64Traits.CastFromBytes(outputBuffer.Bytes())
		return updateRunsInt64(inputData, inputBuffers, out)
	}
	return fmt.Errorf("%w: invalid dataType for RLE runEnds", arrow.ErrInvalid)
}

func updateRunsInt16(inputData []arrow.ArrayData, inputBuffers []*memory.Buffer, output []int16) error {
	// for now we will not attempt to optimize by checking if we
	// can fold the end and beginning of each array we're concatenating
	// into a single run
	pos := 0
	for i, buf := range inputBuffers {
		if buf.Len() == 0 {
			continue
		}
		src := arrow.Int16Traits.CastFromBytes(buf.Bytes())
		if pos == 0 {
			pos += copy(output, src)
			continue
		}

		lastEnd := output[pos-1]
		// we can check the last runEnd in the src and add it to the
		// last value that we're adjusting them all by to see if we
		// are going to overflow
		if int64(lastEnd)+int64(int(src[len(src)-1])-inputData[i].Offset()) > math.MaxInt16 {
			return fmt.Errorf("%w: overflow in run-length-encoded run ends concat", arrow.ErrInvalid)
		}

		// adjust all of the run ends by first normalizing them (e - data[i].offset)
		// then adding the previous value we ended on. Since the offset
		// is a logical length offset it should be accurate to just subtract
		// it from each value.
		for j, e := range src {
			output[pos+j] = lastEnd + int16(int(e)-inputData[i].Offset())
		}
		pos += len(src)
	}
	return nil
}

func updateRunsInt32(inputData []arrow.ArrayData, inputBuffers []*memory.Buffer, output []int32) error {
	// for now we will not attempt to optimize by checking if we
	// can fold the end and beginning of each array we're concatenating
	// into a single run
	pos := 0
	for i, buf := range inputBuffers {
		if buf.Len() == 0 {
			continue
		}
		src := arrow.Int32Traits.CastFromBytes(buf.Bytes())
		if pos == 0 {
			pos += copy(output, src)
			continue
		}

		lastEnd := output[pos-1]
		// we can check the last runEnd in the src and add it to the
		// last value that we're adjusting them all by to see if we
		// are going to overflow
		if int64(lastEnd)+int64(int(src[len(src)-1])-inputData[i].Offset()) > math.MaxInt32 {
			return fmt.Errorf("%w: overflow in run-length-encoded run ends concat", arrow.ErrInvalid)
		}

		// adjust all of the run ends by first normalizing them (e - data[i].offset)
		// then adding the previous value we ended on. Since the offset
		// is a logical length offset it should be accurate to just subtract
		// it from each value.
		for j, e := range src {
			output[pos+j] = lastEnd + int32(int(e)-inputData[i].Offset())
		}
		pos += len(src)
	}
	return nil
}

func updateRunsInt64(inputData []arrow.ArrayData, inputBuffers []*memory.Buffer, output []int64) error {
	// for now we will not attempt to optimize by checking if we
	// can fold the end and beginning of each array we're concatenating
	// into a single run
	pos := 0
	for i, buf := range inputBuffers {
		if buf.Len() == 0 {
			continue
		}
		src := arrow.Int64Traits.CastFromBytes(buf.Bytes())
		if pos == 0 {
			pos += copy(output, src)
			continue
		}

		lastEnd := output[pos-1]
		// we can check the last runEnd in the src and add it to the
		// last value that we're adjusting them all by to see if we
		// are going to overflow
		if uint64(lastEnd)+uint64(int(src[len(src)-1])-inputData[i].Offset()) > math.MaxInt64 {
			return fmt.Errorf("%w: overflow in run-length-encoded run ends concat", arrow.ErrInvalid)
		}

		// adjust all of the run ends by first normalizing them (e - data[i].offset)
		// then adding the previous value we ended on. Since the offset
		// is a logical length offset it should be accurate to just subtract
		// it from each value.
		for j, e := range src {
			output[pos+j] = lastEnd + e - int64(inputData[i].Offset())
		}
		pos += len(src)
	}
	return nil
}
