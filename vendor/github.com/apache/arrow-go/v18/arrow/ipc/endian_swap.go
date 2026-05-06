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

package ipc

import (
	"errors"
	"fmt"
	"math/bits"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

// swap the endianness of the array's buffers as needed in-place to save
// the cost of reallocation.
//
// assumes that nested data buffers are never re-used, if an *array.Data
// child is re-used among the children or the dictionary then this might
// end up double-swapping (putting it back into the original endianness).
// if it is needed to support re-using the buffers, then this can be
// re-factored to instead return a NEW array.Data object with newly
// allocated buffers, rather than doing it in place.
//
// For now this is intended to be used by the IPC readers after loading
// arrays from an IPC message which currently is guaranteed to not re-use
// buffers between arrays.
func swapEndianArrayData(data *array.Data) error {
	if data.Offset() != 0 {
		return errors.New("unsupported data format: data.offset != 0")
	}
	if err := swapType(data.DataType(), data); err != nil {
		return err
	}
	return swapChildren(data.Children())
}

func swapChildren(children []arrow.ArrayData) (err error) {
	for i := range children {
		if err = swapEndianArrayData(children[i].(*array.Data)); err != nil {
			break
		}
	}
	return
}

func swapType(dt arrow.DataType, data *array.Data) (err error) {
	switch dt.ID() {
	case arrow.BINARY, arrow.STRING:
		swapOffsets(1, 32, data)
		return
	case arrow.LARGE_BINARY, arrow.LARGE_STRING:
		swapOffsets(1, 64, data)
		return
	case arrow.NULL, arrow.BOOL, arrow.INT8, arrow.UINT8,
		arrow.FIXED_SIZE_BINARY, arrow.FIXED_SIZE_LIST, arrow.STRUCT:
		return
	}

	switch dt := dt.(type) {
	case *arrow.Decimal128Type:
		rawdata := arrow.Uint64Traits.CastFromBytes(data.Buffers()[1].Bytes())
		length := data.Buffers()[1].Len() / arrow.Decimal128SizeBytes
		for i := 0; i < length; i++ {
			idx := i * 2
			tmp := bits.ReverseBytes64(rawdata[idx])
			rawdata[idx] = bits.ReverseBytes64(rawdata[idx+1])
			rawdata[idx+1] = tmp
		}
	case *arrow.Decimal256Type:
		rawdata := arrow.Uint64Traits.CastFromBytes(data.Buffers()[1].Bytes())
		length := data.Buffers()[1].Len() / arrow.Decimal256SizeBytes
		for i := 0; i < length; i++ {
			idx := i * 4
			tmp0 := bits.ReverseBytes64(rawdata[idx])
			tmp1 := bits.ReverseBytes64(rawdata[idx+1])
			tmp2 := bits.ReverseBytes64(rawdata[idx+2])
			rawdata[idx] = bits.ReverseBytes64(rawdata[idx+3])
			rawdata[idx+1] = tmp2
			rawdata[idx+2] = tmp1
			rawdata[idx+3] = tmp0
		}
	case arrow.UnionType:
		if dt.Mode() == arrow.DenseMode {
			swapOffsets(2, 32, data)
		}
	case *arrow.ListType:
		swapOffsets(1, 32, data)
	case *arrow.LargeListType:
		swapOffsets(1, 64, data)
	case *arrow.MapType:
		swapOffsets(1, 32, data)
	case *arrow.DayTimeIntervalType:
		byteSwapBuffer(32, data.Buffers()[1])
	case *arrow.MonthDayNanoIntervalType:
		rawdata := arrow.MonthDayNanoIntervalTraits.CastFromBytes(data.Buffers()[1].Bytes())
		for i, tmp := range rawdata {
			rawdata[i].Days = int32(bits.ReverseBytes32(uint32(tmp.Days)))
			rawdata[i].Months = int32(bits.ReverseBytes32(uint32(tmp.Months)))
			rawdata[i].Nanoseconds = int64(bits.ReverseBytes64(uint64(tmp.Nanoseconds)))
		}
	case arrow.ExtensionType:
		return swapType(dt.StorageType(), data)
	case *arrow.DictionaryType:
		// dictionary itself was already swapped in ReadDictionary calls
		return swapType(dt.IndexType, data)
	case arrow.FixedWidthDataType:
		byteSwapBuffer(dt.BitWidth(), data.Buffers()[1])
	default:
		err = fmt.Errorf("%w: swapping endianness of %s", arrow.ErrNotImplemented, dt)
	}

	return
}

// this can get called on an invalid Array Data object by the IPC reader,
// so we won't rely on the data.length and will instead rely on the buffer's
// own size instead.
func byteSwapBuffer(bw int, buf *memory.Buffer) {
	if bw == 1 || buf == nil {
		// if byte width == 1, no need to swap anything
		return
	}

	switch bw {
	case 16:
		data := arrow.Uint16Traits.CastFromBytes(buf.Bytes())
		for i := range data {
			data[i] = bits.ReverseBytes16(data[i])
		}
	case 32:
		data := arrow.Uint32Traits.CastFromBytes(buf.Bytes())
		for i := range data {
			data[i] = bits.ReverseBytes32(data[i])
		}
	case 64:
		data := arrow.Uint64Traits.CastFromBytes(buf.Bytes())
		for i := range data {
			data[i] = bits.ReverseBytes64(data[i])
		}
	}
}

func swapOffsets(index int, bitWidth int, data *array.Data) {
	if data.Buffers()[index] == nil || data.Buffers()[index].Len() == 0 {
		return
	}

	// other than unions, offset has one more element than the data.length
	// don't yet implement large types, so hardcode 32bit offsets for now
	byteSwapBuffer(bitWidth, data.Buffers()[index])
}
