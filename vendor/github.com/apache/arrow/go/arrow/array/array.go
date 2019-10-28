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

package array // import "github.com/apache/arrow/go/arrow/array"

import (
	"sync/atomic"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/internal/bitutil"
	"github.com/apache/arrow/go/arrow/internal/debug"
)

// A type which satisfies array.Interface represents an immutable sequence of values.
type Interface interface {
	// DataType returns the type metadata for this instance.
	DataType() arrow.DataType

	// NullN returns the number of null values in the array.
	NullN() int

	// NullBitmapBytes returns a byte slice of the validity bitmap.
	NullBitmapBytes() []byte

	// IsNull returns true if value at index is null.
	// NOTE: IsNull will panic if NullBitmapBytes is not empty and 0 > i ≥ Len.
	IsNull(i int) bool

	// IsValid returns true if value at index is not null.
	// NOTE: IsValid will panic if NullBitmapBytes is not empty and 0 > i ≥ Len.
	IsValid(i int) bool

	Data() *Data

	// Len returns the number of elements in the array.
	Len() int

	// Retain increases the reference count by 1.
	// Retain may be called simultaneously from multiple goroutines.
	Retain()

	// Release decreases the reference count by 1.
	// Release may be called simultaneously from multiple goroutines.
	// When the reference count goes to zero, the memory is freed.
	Release()
}

const (
	// UnknownNullCount specifies the NullN should be calculated from the null bitmap buffer.
	UnknownNullCount = -1
)

type array struct {
	refCount        int64
	data            *Data
	nullBitmapBytes []byte
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (a *array) Retain() {
	atomic.AddInt64(&a.refCount, 1)
}

// Release decreases the reference count by 1.
// Release may be called simultaneously from multiple goroutines.
// When the reference count goes to zero, the memory is freed.
func (a *array) Release() {
	debug.Assert(atomic.LoadInt64(&a.refCount) > 0, "too many releases")

	if atomic.AddInt64(&a.refCount, -1) == 0 {
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

func (a *array) Data() *Data { return a.data }

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
	if a.data != nil {
		a.data.Release()
	}

	data.Retain()
	if len(data.buffers) > 0 && data.buffers[0] != nil {
		a.nullBitmapBytes = data.buffers[0].Bytes()
	}
	a.data = data
}

func (a *array) Offset() int {
	return a.data.Offset()
}

type arrayConstructorFn func(*Data) Interface

var (
	makeArrayFn [32]arrayConstructorFn
)

func unsupportedArrayType(data *Data) Interface {
	panic("unsupported data type: " + data.dtype.ID().String())
}

func invalidDataType(data *Data) Interface {
	panic("invalid data type: " + data.dtype.ID().String())
}

// MakeFromData constructs a strongly-typed array instance from generic Data.
func MakeFromData(data *Data) Interface {
	return makeArrayFn[byte(data.dtype.ID()&0x1f)](data)
}

// NewSlice constructs a zero-copy slice of the array with the indicated
// indices i and j, corresponding to array[i:j].
// The returned array must be Release()'d after use.
//
// NewSlice panics if the slice is outside the valid range of the input array.
// NewSlice panics if j < i.
func NewSlice(arr Interface, i, j int64) Interface {
	data := NewSliceData(arr.Data(), i, j)
	slice := MakeFromData(data)
	data.Release()
	return slice
}

func init() {
	makeArrayFn = [...]arrayConstructorFn{
		arrow.NULL:              func(data *Data) Interface { return NewNullData(data) },
		arrow.BOOL:              func(data *Data) Interface { return NewBooleanData(data) },
		arrow.UINT8:             func(data *Data) Interface { return NewUint8Data(data) },
		arrow.INT8:              func(data *Data) Interface { return NewInt8Data(data) },
		arrow.UINT16:            func(data *Data) Interface { return NewUint16Data(data) },
		arrow.INT16:             func(data *Data) Interface { return NewInt16Data(data) },
		arrow.UINT32:            func(data *Data) Interface { return NewUint32Data(data) },
		arrow.INT32:             func(data *Data) Interface { return NewInt32Data(data) },
		arrow.UINT64:            func(data *Data) Interface { return NewUint64Data(data) },
		arrow.INT64:             func(data *Data) Interface { return NewInt64Data(data) },
		arrow.FLOAT16:           func(data *Data) Interface { return NewFloat16Data(data) },
		arrow.FLOAT32:           func(data *Data) Interface { return NewFloat32Data(data) },
		arrow.FLOAT64:           func(data *Data) Interface { return NewFloat64Data(data) },
		arrow.STRING:            func(data *Data) Interface { return NewStringData(data) },
		arrow.BINARY:            func(data *Data) Interface { return NewBinaryData(data) },
		arrow.FIXED_SIZE_BINARY: func(data *Data) Interface { return NewFixedSizeBinaryData(data) },
		arrow.DATE32:            func(data *Data) Interface { return NewDate32Data(data) },
		arrow.DATE64:            func(data *Data) Interface { return NewDate64Data(data) },
		arrow.TIMESTAMP:         func(data *Data) Interface { return NewTimestampData(data) },
		arrow.TIME32:            func(data *Data) Interface { return NewTime32Data(data) },
		arrow.TIME64:            func(data *Data) Interface { return NewTime64Data(data) },
		arrow.INTERVAL:          func(data *Data) Interface { return NewIntervalData(data) },
		arrow.DECIMAL:           func(data *Data) Interface { return NewDecimal128Data(data) },
		arrow.LIST:              func(data *Data) Interface { return NewListData(data) },
		arrow.STRUCT:            func(data *Data) Interface { return NewStructData(data) },
		arrow.UNION:             unsupportedArrayType,
		arrow.DICTIONARY:        unsupportedArrayType,
		arrow.MAP:               unsupportedArrayType,
		arrow.EXTENSION:         unsupportedArrayType,
		arrow.FIXED_SIZE_LIST:   func(data *Data) Interface { return NewFixedSizeListData(data) },
		arrow.DURATION:          func(data *Data) Interface { return NewDurationData(data) },

		// invalid data types to fill out array size 2⁵-1
		31: invalidDataType,
	}
}
