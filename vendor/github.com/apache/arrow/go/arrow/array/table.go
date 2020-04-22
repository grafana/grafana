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
	"sync/atomic"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/internal/debug"
)

// Table represents a logical sequence of chunked arrays.
type Table interface {
	Schema() *arrow.Schema
	NumRows() int64
	NumCols() int64
	Column(i int) *Column

	Retain()
	Release()
}

// Column is an immutable column data structure consisting of
// a field (type metadata) and a chunked data array.
type Column struct {
	field arrow.Field
	data  *Chunked
}

// NewColumn returns a column from a field and a chunked data array.
//
// NewColumn panics if the field's data type is inconsistent with the data type
// of the chunked data array.
func NewColumn(field arrow.Field, chunks *Chunked) *Column {
	col := Column{
		field: field,
		data:  chunks,
	}
	col.data.Retain()

	if !arrow.TypeEqual(col.data.DataType(), col.field.Type) {
		col.data.Release()
		panic("arrow/array: inconsistent data type")
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

func (col *Column) Len() int                 { return col.data.Len() }
func (col *Column) NullN() int               { return col.data.NullN() }
func (col *Column) Data() *Chunked           { return col.data }
func (col *Column) Field() arrow.Field       { return col.field }
func (col *Column) Name() string             { return col.field.Name }
func (col *Column) DataType() arrow.DataType { return col.field.Type }

// NewSlice returns a new zero-copy slice of the column with the indicated
// indices i and j, corresponding to the column's array[i:j].
// The returned column must be Release()'d after use.
//
// NewSlice panics if the slice is outside the valid range of the column's array.
// NewSlice panics if j < i.
func (col *Column) NewSlice(i, j int64) *Column {
	return &Column{
		field: col.field,
		data:  col.data.NewSlice(i, j),
	}
}

// Chunked manages a collection of primitives arrays as one logical large array.
type Chunked struct {
	chunks []Interface

	refCount int64

	length int
	nulls  int
	dtype  arrow.DataType
}

// NewChunked returns a new chunked array from the slice of arrays.
//
// NewChunked panics if the chunks do not have the same data type.
func NewChunked(dtype arrow.DataType, chunks []Interface) *Chunked {
	arr := &Chunked{
		chunks:   make([]Interface, len(chunks)),
		refCount: 1,
		dtype:    dtype,
	}
	for i, chunk := range chunks {
		if !arrow.TypeEqual(chunk.DataType(), dtype) {
			panic("arrow/array: mismatch data type")
		}
		chunk.Retain()
		arr.chunks[i] = chunk
		arr.length += chunk.Len()
		arr.nulls += chunk.NullN()
	}
	return arr
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (a *Chunked) Retain() {
	atomic.AddInt64(&a.refCount, 1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (a *Chunked) Release() {
	debug.Assert(atomic.LoadInt64(&a.refCount) > 0, "too many releases")

	if atomic.AddInt64(&a.refCount, -1) == 0 {
		for _, arr := range a.chunks {
			arr.Release()
		}
		a.chunks = nil
		a.length = 0
		a.nulls = 0
	}
}

func (a *Chunked) Len() int                 { return a.length }
func (a *Chunked) NullN() int               { return a.nulls }
func (a *Chunked) DataType() arrow.DataType { return a.dtype }
func (a *Chunked) Chunks() []Interface      { return a.chunks }
func (a *Chunked) Chunk(i int) Interface    { return a.chunks[i] }

// NewSlice constructs a zero-copy slice of the chunked array with the indicated
// indices i and j, corresponding to array[i:j].
// The returned chunked array must be Release()'d after use.
//
// NewSlice panics if the slice is outside the valid range of the input array.
// NewSlice panics if j < i.
func (a *Chunked) NewSlice(i, j int64) *Chunked {
	if j > int64(a.length) || i > j || i > int64(a.length) {
		panic("arrow/array: index out of range")
	}

	var (
		cur    = 0
		beg    = i
		sz     = j - i
		chunks = make([]Interface, 0, len(a.chunks))
	)

	for cur < len(a.chunks) && beg >= int64(a.chunks[cur].Len()) {
		beg -= int64(a.chunks[cur].Len())
		cur++
	}

	for cur < len(a.chunks) && sz > 0 {
		arr := a.chunks[cur]
		end := beg + sz
		if end > int64(arr.Len()) {
			end = int64(arr.Len())
		}
		chunks = append(chunks, NewSlice(arr, beg, end))
		sz -= int64(arr.Len()) - beg
		beg = 0
		cur++
	}
	chunks = chunks[:len(chunks):len(chunks)]
	defer func() {
		for _, chunk := range chunks {
			chunk.Release()
		}
	}()

	return NewChunked(a.dtype, chunks)
}

// simpleTable is a basic, non-lazy in-memory table.
type simpleTable struct {
	refCount int64

	rows int64
	cols []Column

	schema *arrow.Schema
}

// NewTable returns a new basic, non-lazy in-memory table.
// If rows is negative, the number of rows will be inferred from the height
// of the columns.
//
// NewTable panics if the columns and schema are inconsistent.
// NewTable panics if rows is larger than the height of the columns.
func NewTable(schema *arrow.Schema, cols []Column, rows int64) *simpleTable {
	tbl := simpleTable{
		refCount: 1,
		rows:     rows,
		cols:     cols,
		schema:   schema,
	}

	if tbl.rows < 0 {
		switch len(tbl.cols) {
		case 0:
			tbl.rows = 0
		default:
			tbl.rows = int64(tbl.cols[0].Len())
		}
	}

	// validate the table and its constituents.
	// note we retain the columns after having validated the table
	// in case the validation fails and panics (and would otherwise leak
	// a ref-count on the columns.)
	tbl.validate()

	for i := range tbl.cols {
		tbl.cols[i].Retain()
	}

	return &tbl
}

// NewTableFromRecords returns a new basic, non-lazy in-memory table.
//
// NewTableFromRecords panics if the records and schema are inconsistent.
func NewTableFromRecords(schema *arrow.Schema, recs []Record) *simpleTable {
	arrs := make([]Interface, len(recs))
	cols := make([]Column, len(schema.Fields()))

	defer func(cols []Column) {
		for i := range cols {
			cols[i].Release()
		}
	}(cols)

	for i := range cols {
		field := schema.Field(i)
		for j, rec := range recs {
			arrs[j] = rec.Column(i)
		}
		chunk := NewChunked(field.Type, arrs)
		cols[i] = *NewColumn(field, chunk)
		chunk.Release()
	}

	return NewTable(schema, cols, -1)
}

func (tbl *simpleTable) Schema() *arrow.Schema { return tbl.schema }
func (tbl *simpleTable) NumRows() int64        { return tbl.rows }
func (tbl *simpleTable) NumCols() int64        { return int64(len(tbl.cols)) }
func (tbl *simpleTable) Column(i int) *Column  { return &tbl.cols[i] }

func (tbl *simpleTable) validate() {
	if len(tbl.cols) != len(tbl.schema.Fields()) {
		panic(errors.New("arrow/array: table schema mismatch"))
	}
	for i, col := range tbl.cols {
		if !col.field.Equal(tbl.schema.Field(i)) {
			panic(fmt.Errorf("arrow/array: column field %q is inconsistent with schema", col.Name()))
		}

		if int64(col.Len()) < tbl.rows {
			panic(fmt.Errorf("arrow/array: column %q expected length >= %d but got length %d", col.Name(), tbl.rows, col.Len()))
		}
	}
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (tbl *simpleTable) Retain() {
	atomic.AddInt64(&tbl.refCount, 1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (tbl *simpleTable) Release() {
	debug.Assert(atomic.LoadInt64(&tbl.refCount) > 0, "too many releases")

	if atomic.AddInt64(&tbl.refCount, -1) == 0 {
		for i := range tbl.cols {
			tbl.cols[i].Release()
		}
		tbl.cols = nil
	}
}

// TableReader is a Record iterator over a (possibly chunked) Table
type TableReader struct {
	refCount int64

	tbl   Table
	cur   int64  // current row
	max   int64  // total number of rows
	rec   Record // current Record
	chksz int64  // chunk size

	chunks  []*Chunked
	slots   []int   // chunk indices
	offsets []int64 // chunk offsets
}

// NewTableReader returns a new TableReader to iterate over the (possibly chunked) Table.
// if chunkSize is <= 0, the biggest possible chunk will be selected.
func NewTableReader(tbl Table, chunkSize int64) *TableReader {
	ncols := tbl.NumCols()
	tr := &TableReader{
		refCount: 1,
		tbl:      tbl,
		cur:      0,
		max:      int64(tbl.NumRows()),
		chksz:    chunkSize,
		chunks:   make([]*Chunked, ncols),
		slots:    make([]int, ncols),
		offsets:  make([]int64, ncols),
	}
	tr.tbl.Retain()

	if tr.chksz <= 0 {
		tr.chksz = math.MaxInt64
	}

	for i := range tr.chunks {
		col := tr.tbl.Column(i)
		tr.chunks[i] = col.Data()
		tr.chunks[i].Retain()
	}
	return tr
}

func (tr *TableReader) Schema() *arrow.Schema { return tr.tbl.Schema() }
func (tr *TableReader) Record() Record        { return tr.rec }

func (tr *TableReader) Next() bool {
	if tr.cur >= tr.max {
		return false
	}

	if tr.rec != nil {
		tr.rec.Release()
	}

	// determine the minimum contiguous slice across all columns
	chunksz := imin64(tr.max, tr.chksz)
	chunks := make([]Interface, len(tr.chunks))
	for i := range chunks {
		j := tr.slots[i]
		chunk := tr.chunks[i].Chunk(j)
		remain := int64(chunk.Len()) - tr.offsets[i]
		if remain < chunksz {
			chunksz = remain
		}

		chunks[i] = chunk
	}

	// slice the chunks, advance each chunk slot as appropriate.
	batch := make([]Interface, len(tr.chunks))
	for i, chunk := range chunks {
		var slice Interface
		offset := tr.offsets[i]
		switch int64(chunk.Len()) - offset {
		case chunksz:
			tr.slots[i]++
			tr.offsets[i] = 0
			if offset > 0 {
				// need to slice
				slice = NewSlice(chunk, offset, offset+chunksz)
			} else {
				// no need to slice
				slice = chunk
				slice.Retain()
			}
		default:
			tr.offsets[i] += chunksz
			slice = NewSlice(chunk, offset, offset+chunksz)
		}
		batch[i] = slice
	}

	tr.cur += chunksz
	tr.rec = NewRecord(tr.tbl.Schema(), batch, chunksz)

	for _, arr := range batch {
		arr.Release()
	}

	return true
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (tr *TableReader) Retain() {
	atomic.AddInt64(&tr.refCount, 1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (tr *TableReader) Release() {
	debug.Assert(atomic.LoadInt64(&tr.refCount) > 0, "too many releases")

	if atomic.AddInt64(&tr.refCount, -1) == 0 {
		tr.tbl.Release()
		for _, chk := range tr.chunks {
			chk.Release()
		}
		if tr.rec != nil {
			tr.rec.Release()
		}
		tr.tbl = nil
		tr.chunks = nil
		tr.slots = nil
		tr.offsets = nil
	}
}

func imin64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

var (
	_ Table        = (*simpleTable)(nil)
	_ RecordReader = (*TableReader)(nil)
)
