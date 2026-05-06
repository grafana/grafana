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
	"sync/atomic"

	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

// Table represents a logical sequence of chunked arrays of equal length. It is
// similar to a Record except that the columns are ChunkedArrays instead,
// allowing for a Table to be built up by chunks progressively whereas the columns
// in a single Record are always each a single contiguous array.
type Table interface {
	Schema() *Schema
	NumRows() int64
	NumCols() int64
	Column(i int) *Column

	// AddColumn adds a new column to the table and a corresponding field (of the same type)
	// to its schema, at the specified position. Returns the new table with updated columns and schema.
	AddColumn(pos int, f Field, c Column) (Table, error)

	Retain()
	Release()

	fmt.Stringer
}

// Column is an immutable column data structure consisting of
// a field (type metadata) and a chunked data array.
//
// To get strongly typed data from a Column, you need to iterate the
// chunks and type assert each individual Array. For example:
//
//	switch column.DataType().ID() {
//	case arrow.INT32:
//		for _, c := range column.Data().Chunks() {
//			arr := c.(*array.Int32)
//			// do something with arr
//		}
//	case arrow.INT64:
//		for _, c := range column.Data().Chunks() {
//			arr := c.(*array.Int64)
//			// do something with arr
//		}
//	case ...
//	}
type Column struct {
	field Field
	data  *Chunked
}

// NewColumnFromArr is a convenience function to create a column from
// a field and a non-chunked array.
//
// This provides a simple mechanism for bypassing the middle step of
// constructing a Chunked array of one and then releasing it because
// of the ref counting.
func NewColumnFromArr(field Field, arr Array) Column {
	if !TypeEqual(field.Type, arr.DataType()) {
		panic(fmt.Errorf("%w: arrow/array: inconsistent data type %s vs %s", ErrInvalid, field.Type, arr.DataType()))
	}

	arr.Retain()
	col := Column{
		field: field,
		data: &Chunked{
			chunks: []Array{arr},
			length: arr.Len(),
			nulls:  arr.NullN(),
			dtype:  field.Type,
		},
	}
	col.data.refCount.Add(1)
	return col
}

// NewColumn returns a column from a field and a chunked data array.
//
// NewColumn panics if the field's data type is inconsistent with the data type
// of the chunked data array.
func NewColumn(field Field, chunks *Chunked) *Column {
	col := Column{
		field: field,
		data:  chunks,
	}
	col.data.Retain()

	if !TypeEqual(col.data.DataType(), col.field.Type) {
		col.data.Release()
		panic(fmt.Errorf("%w: arrow/array: inconsistent data type %s vs %s", ErrInvalid, col.data.DataType(), col.field.Type))
	}

	return &col
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (col *Column) Retain() {
	col.data.Retain()
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (col *Column) Release() {
	col.data.Release()
}

func (col *Column) Len() int           { return col.data.Len() }
func (col *Column) NullN() int         { return col.data.NullN() }
func (col *Column) Data() *Chunked     { return col.data }
func (col *Column) Field() Field       { return col.field }
func (col *Column) Name() string       { return col.field.Name }
func (col *Column) DataType() DataType { return col.field.Type }

// Chunked manages a collection of primitives arrays as one logical large array.
type Chunked struct {
	refCount atomic.Int64

	chunks []Array

	length int
	nulls  int
	dtype  DataType
}

// NewChunked returns a new chunked array from the slice of arrays.
//
// NewChunked panics if the chunks do not have the same data type.
func NewChunked(dtype DataType, chunks []Array) *Chunked {
	arr := &Chunked{
		chunks: make([]Array, 0, len(chunks)),
		dtype:  dtype,
	}
	arr.refCount.Add(1)

	for _, chunk := range chunks {
		if chunk == nil {
			continue
		}

		if !TypeEqual(chunk.DataType(), dtype) {
			panic(fmt.Errorf("%w: arrow/array: mismatch data type %s vs %s", ErrInvalid, chunk.DataType().String(), dtype.String()))
		}
		chunk.Retain()
		arr.chunks = append(arr.chunks, chunk)
		arr.length += chunk.Len()
		arr.nulls += chunk.NullN()
	}
	return arr
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (a *Chunked) Retain() {
	a.refCount.Add(1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (a *Chunked) Release() {
	debug.Assert(a.refCount.Load() > 0, "too many releases")

	if a.refCount.Add(-1) == 0 {
		for _, arr := range a.chunks {
			arr.Release()
		}
		a.chunks = nil
		a.length = 0
		a.nulls = 0
	}
}

func (a *Chunked) Len() int           { return a.length }
func (a *Chunked) NullN() int         { return a.nulls }
func (a *Chunked) DataType() DataType { return a.dtype }
func (a *Chunked) Chunks() []Array    { return a.chunks }
func (a *Chunked) Chunk(i int) Array  { return a.chunks[i] }
