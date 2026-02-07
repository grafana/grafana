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
	"fmt"

	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// ArrayData is the underlying memory and metadata of an Arrow array, corresponding
// to the same-named object in the C++ implementation.
//
// The Array interface and subsequent typed objects provide strongly typed
// accessors which support marshalling and other patterns to the data.
// This interface allows direct access to the underlying raw byte buffers
// which allows for manipulating the internal data and casting. For example,
// one could cast the raw bytes from int64 to float64 like so:
//
//	arrdata := GetMyInt64Data().Data()
//	newdata := array.NewData(arrow.PrimitiveTypes.Float64, arrdata.Len(),
//			arrdata.Buffers(), nil, arrdata.NullN(), arrdata.Offset())
//	defer newdata.Release()
//	float64arr := array.NewFloat64Data(newdata)
//	defer float64arr.Release()
//
// This is also useful in an analytics setting where memory may be reused. For
// example, if we had a group of operations all returning float64 such as:
//
//	Log(Sqrt(Expr(arr)))
//
// The low-level implementations could have signatures such as:
//
//	func Log(values arrow.ArrayData) arrow.ArrayData
//
// Another example would be a function that consumes one or more memory buffers
// in an input array and replaces them with newly-allocated data, changing the
// output data type as well.
type ArrayData interface {
	// Retain increases the reference count by 1, it is safe to call
	// in multiple goroutines simultaneously.
	Retain()
	// Release decreases the reference count by 1, it is safe to call
	// in multiple goroutines simultaneously. Data is removed when reference
	// count is 0.
	Release()
	// DataType returns the current datatype stored in the object.
	DataType() DataType
	// NullN returns the number of nulls for this data instance.
	NullN() int
	// Len returns the length of this data instance
	Len() int
	// Offset returns the offset into the raw buffers where this data begins
	Offset() int
	// Buffers returns the slice of raw data buffers for this data instance. Their
	// meaning depends on the context of the data type.
	Buffers() []*memory.Buffer
	// Children returns the slice of children data instances, only relevant for
	// nested data types. For instance, List data will have a single child containing
	// elements of all the rows and Struct data will contain numfields children which
	// are the arrays for each field of the struct.
	Children() []ArrayData
	// Reset allows reusing this ArrayData object by replacing the data in this ArrayData
	// object without changing the reference count.
	Reset(newtype DataType, newlength int, newbuffers []*memory.Buffer, newchildren []ArrayData, newnulls int, newoffset int)
	// Dictionary returns the ArrayData object for the dictionary if this is a
	// dictionary array, otherwise it will be nil.
	Dictionary() ArrayData
	// SizeInBytes returns the size of the ArrayData buffers and any children and/or dictionary in bytes.
	SizeInBytes() uint64
}

// Array represents an immutable sequence of values using the Arrow in-memory format.
type Array interface {
	json.Marshaler

	fmt.Stringer

	// DataType returns the type metadata for this instance.
	DataType() DataType

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
	// ValueStr returns the value at index as a string.
	ValueStr(i int) string

	// Get single value to be marshalled with `json.Marshal`
	GetOneForMarshal(i int) interface{}

	Data() ArrayData

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

// ValueType is a generic constraint for valid Arrow primitive types
type ValueType interface {
	bool | FixedWidthType | string | []byte
}

// TypedArray is an interface representing an Array of a particular type
// allowing for easy propagation of generics
type TypedArray[T ValueType] interface {
	Array
	Value(int) T
}
