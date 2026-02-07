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

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

const (
	// UnknownNullCount specifies the NullN should be calculated from the null bitmap buffer.
	UnknownNullCount = -1

	// NullValueStr represents a null value in arrow.Array.ValueStr and in Builder.AppendValueFromString.
	// It should be returned from the arrow.Array.ValueStr implementations.
	// Using it as the value in Builder.AppendValueFromString should be equivalent to Builder.AppendNull.
	NullValueStr = "(null)"
)

type array struct {
	refCount        atomic.Int64
	data            *Data
	nullBitmapBytes []byte
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (a *array) Retain() {
	a.refCount.Add(1)
}

// Release decreases the reference count by 1.
// Release may be called simultaneously from multiple goroutines.
// When the reference count goes to zero, the memory is freed.
func (a *array) Release() {
	debug.Assert(a.refCount.Load() > 0, "too many releases")

	if a.refCount.Add(-1) == 0 {
		a.data.Release()
		a.data, a.nullBitmapBytes = nil, nil
	}
}

// DataType returns the type metadata for this instance.
func (a *array) DataType() arrow.DataType { return a.data.dtype }

// NullN returns the number of null values in the array.
func (a *array) NullN() int {
	if a.data.nulls < 0 {
		a.data.nulls = a.data.length - bitutil.CountSetBits(a.nullBitmapBytes, a.data.offset, a.data.length)
	}
	return a.data.nulls
}

// NullBitmapBytes returns a byte slice of the validity bitmap.
func (a *array) NullBitmapBytes() []byte { return a.nullBitmapBytes }

func (a *array) Data() arrow.ArrayData { return a.data }

// Len returns the number of elements in the array.
func (a *array) Len() int { return a.data.length }

// IsNull returns true if value at index is null.
// NOTE: IsNull will panic if NullBitmapBytes is not empty and 0 > i ≥ Len.
func (a *array) IsNull(i int) bool {
	return len(a.nullBitmapBytes) != 0 && bitutil.BitIsNotSet(a.nullBitmapBytes, a.data.offset+i)
}

// IsValid returns true if value at index is not null.
// NOTE: IsValid will panic if NullBitmapBytes is not empty and 0 > i ≥ Len.
func (a *array) IsValid(i int) bool {
	return len(a.nullBitmapBytes) == 0 || bitutil.BitIsSet(a.nullBitmapBytes, a.data.offset+i)
}

func (a *array) setData(data *Data) {
	// Retain before releasing in case a.data is the same as data.
	data.Retain()

	if a.data != nil {
		a.data.Release()
	}

	if len(data.buffers) > 0 && data.buffers[0] != nil {
		a.nullBitmapBytes = data.buffers[0].Bytes()
	}
	a.data = data
}

func (a *array) Offset() int {
	return a.data.Offset()
}

type arrayConstructorFn func(arrow.ArrayData) arrow.Array

var makeArrayFn [64]arrayConstructorFn

func invalidDataType(data arrow.ArrayData) arrow.Array {
	panic("invalid data type: " + data.DataType().ID().String())
}

// MakeFromData constructs a strongly-typed array instance from generic Data.
func MakeFromData(data arrow.ArrayData) arrow.Array {
	return makeArrayFn[byte(data.DataType().ID()&0x3f)](data)
}

// NewSlice constructs a zero-copy slice of the array with the indicated
// indices i and j, corresponding to array[i:j].
// The returned array must be Release()'d after use.
//
// NewSlice panics if the slice is outside the valid range of the input array.
// NewSlice panics if j < i.
func NewSlice(arr arrow.Array, i, j int64) arrow.Array {
	data := NewSliceData(arr.Data(), i, j)
	slice := MakeFromData(data)
	data.Release()
	return slice
}

func init() {
	makeArrayFn = [...]arrayConstructorFn{
		arrow.NULL:                    func(data arrow.ArrayData) arrow.Array { return NewNullData(data) },
		arrow.BOOL:                    func(data arrow.ArrayData) arrow.Array { return NewBooleanData(data) },
		arrow.UINT8:                   func(data arrow.ArrayData) arrow.Array { return NewUint8Data(data) },
		arrow.INT8:                    func(data arrow.ArrayData) arrow.Array { return NewInt8Data(data) },
		arrow.UINT16:                  func(data arrow.ArrayData) arrow.Array { return NewUint16Data(data) },
		arrow.INT16:                   func(data arrow.ArrayData) arrow.Array { return NewInt16Data(data) },
		arrow.UINT32:                  func(data arrow.ArrayData) arrow.Array { return NewUint32Data(data) },
		arrow.INT32:                   func(data arrow.ArrayData) arrow.Array { return NewInt32Data(data) },
		arrow.UINT64:                  func(data arrow.ArrayData) arrow.Array { return NewUint64Data(data) },
		arrow.INT64:                   func(data arrow.ArrayData) arrow.Array { return NewInt64Data(data) },
		arrow.FLOAT16:                 func(data arrow.ArrayData) arrow.Array { return NewFloat16Data(data) },
		arrow.FLOAT32:                 func(data arrow.ArrayData) arrow.Array { return NewFloat32Data(data) },
		arrow.FLOAT64:                 func(data arrow.ArrayData) arrow.Array { return NewFloat64Data(data) },
		arrow.STRING:                  func(data arrow.ArrayData) arrow.Array { return NewStringData(data) },
		arrow.BINARY:                  func(data arrow.ArrayData) arrow.Array { return NewBinaryData(data) },
		arrow.FIXED_SIZE_BINARY:       func(data arrow.ArrayData) arrow.Array { return NewFixedSizeBinaryData(data) },
		arrow.DATE32:                  func(data arrow.ArrayData) arrow.Array { return NewDate32Data(data) },
		arrow.DATE64:                  func(data arrow.ArrayData) arrow.Array { return NewDate64Data(data) },
		arrow.TIMESTAMP:               func(data arrow.ArrayData) arrow.Array { return NewTimestampData(data) },
		arrow.TIME32:                  func(data arrow.ArrayData) arrow.Array { return NewTime32Data(data) },
		arrow.TIME64:                  func(data arrow.ArrayData) arrow.Array { return NewTime64Data(data) },
		arrow.INTERVAL_MONTHS:         func(data arrow.ArrayData) arrow.Array { return NewMonthIntervalData(data) },
		arrow.INTERVAL_DAY_TIME:       func(data arrow.ArrayData) arrow.Array { return NewDayTimeIntervalData(data) },
		arrow.DECIMAL32:               func(data arrow.ArrayData) arrow.Array { return NewDecimal32Data(data) },
		arrow.DECIMAL64:               func(data arrow.ArrayData) arrow.Array { return NewDecimal64Data(data) },
		arrow.DECIMAL128:              func(data arrow.ArrayData) arrow.Array { return NewDecimal128Data(data) },
		arrow.DECIMAL256:              func(data arrow.ArrayData) arrow.Array { return NewDecimal256Data(data) },
		arrow.LIST:                    func(data arrow.ArrayData) arrow.Array { return NewListData(data) },
		arrow.STRUCT:                  func(data arrow.ArrayData) arrow.Array { return NewStructData(data) },
		arrow.SPARSE_UNION:            func(data arrow.ArrayData) arrow.Array { return NewSparseUnionData(data) },
		arrow.DENSE_UNION:             func(data arrow.ArrayData) arrow.Array { return NewDenseUnionData(data) },
		arrow.DICTIONARY:              func(data arrow.ArrayData) arrow.Array { return NewDictionaryData(data) },
		arrow.MAP:                     func(data arrow.ArrayData) arrow.Array { return NewMapData(data) },
		arrow.EXTENSION:               func(data arrow.ArrayData) arrow.Array { return NewExtensionData(data) },
		arrow.FIXED_SIZE_LIST:         func(data arrow.ArrayData) arrow.Array { return NewFixedSizeListData(data) },
		arrow.DURATION:                func(data arrow.ArrayData) arrow.Array { return NewDurationData(data) },
		arrow.LARGE_STRING:            func(data arrow.ArrayData) arrow.Array { return NewLargeStringData(data) },
		arrow.LARGE_BINARY:            func(data arrow.ArrayData) arrow.Array { return NewLargeBinaryData(data) },
		arrow.LARGE_LIST:              func(data arrow.ArrayData) arrow.Array { return NewLargeListData(data) },
		arrow.INTERVAL_MONTH_DAY_NANO: func(data arrow.ArrayData) arrow.Array { return NewMonthDayNanoIntervalData(data) },
		arrow.RUN_END_ENCODED:         func(data arrow.ArrayData) arrow.Array { return NewRunEndEncodedData(data) },
		arrow.LIST_VIEW:               func(data arrow.ArrayData) arrow.Array { return NewListViewData(data) },
		arrow.LARGE_LIST_VIEW:         func(data arrow.ArrayData) arrow.Array { return NewLargeListViewData(data) },
		arrow.BINARY_VIEW:             func(data arrow.ArrayData) arrow.Array { return NewBinaryViewData(data) },
		arrow.STRING_VIEW:             func(data arrow.ArrayData) arrow.Array { return NewStringViewData(data) },
		// invalid data types to fill out array to size 2^6 - 1
		63: invalidDataType,
	}
}
