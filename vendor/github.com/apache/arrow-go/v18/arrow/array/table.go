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
	"strings"
	"sync/atomic"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

// NewColumnSlice returns a new zero-copy slice of the column with the indicated
// indices i and j, corresponding to the column's array[i:j].
// The returned column must be Release()'d after use.
//
// NewColSlice panics if the slice is outside the valid range of the column's array.
// NewColSlice panics if j < i.
func NewColumnSlice(col *arrow.Column, i, j int64) *arrow.Column {
	slice := NewChunkedSlice(col.Data(), i, j)
	defer slice.Release()
	return arrow.NewColumn(col.Field(), slice)
}

// NewChunkedSlice constructs a zero-copy slice of the chunked array with the indicated
// indices i and j, corresponding to array[i:j].
// The returned chunked array must be Release()'d after use.
//
// NewSlice panics if the slice is outside the valid range of the input array.
// NewSlice panics if j < i.
func NewChunkedSlice(a *arrow.Chunked, i, j int64) *arrow.Chunked {
	if j > int64(a.Len()) || i > j || i > int64(a.Len()) {
		panic("arrow/array: index out of range")
	}

	var (
		cur    = 0
		beg    = i
		sz     = j - i
		chunks = make([]arrow.Array, 0, len(a.Chunks()))
	)

	for cur < len(a.Chunks()) && beg >= int64(a.Chunks()[cur].Len()) {
		beg -= int64(a.Chunks()[cur].Len())
		cur++
	}

	for cur < len(a.Chunks()) && sz > 0 {
		arr := a.Chunks()[cur]
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

	return arrow.NewChunked(a.DataType(), chunks)
}

// simpleTable is a basic, non-lazy in-memory table.
type simpleTable struct {
	refCount atomic.Int64

	rows int64
	cols []arrow.Column

	schema *arrow.Schema
}

// NewTable returns a new basic, non-lazy in-memory table.
// If rows is negative, the number of rows will be inferred from the height
// of the columns.
//
// NewTable panics if the columns and schema are inconsistent.
// NewTable panics if rows is larger than the height of the columns.
func NewTable(schema *arrow.Schema, cols []arrow.Column, rows int64) arrow.Table {
	tbl := simpleTable{
		rows:   rows,
		cols:   cols,
		schema: schema,
	}
	tbl.refCount.Add(1)

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

// NewTableFromSlice is a convenience function to create a table from a slice
// of slices of arrow.Array.
//
// Like other NewTable functions this can panic if:
//   - len(schema.Fields) != len(data)
//   - the total length of each column's array slice (ie: number of rows
//     in the column) aren't the same for all columns.
func NewTableFromSlice(schema *arrow.Schema, data [][]arrow.Array) arrow.Table {
	if len(data) != schema.NumFields() {
		panic("array/table: mismatch in number of columns and data for creating a table")
	}

	cols := make([]arrow.Column, schema.NumFields())
	for i, arrs := range data {
		field := schema.Field(i)
		chunked := arrow.NewChunked(field.Type, arrs)
		cols[i] = *arrow.NewColumn(field, chunked)
		chunked.Release()
	}

	tbl := simpleTable{
		schema: schema,
		cols:   cols,
		rows:   int64(cols[0].Len()),
	}
	tbl.refCount.Add(1)

	defer func() {
		if r := recover(); r != nil {
			// if validate panics, let's release the columns
			// so that we don't leak them, then propagate the panic
			for _, c := range cols {
				c.Release()
			}
			panic(r)
		}
	}()
	// validate the table and its constituents.
	tbl.validate()

	return &tbl
}

// NewTableFromRecords returns a new basic, non-lazy in-memory table.
//
// NewTableFromRecords panics if the records and schema are inconsistent.
func NewTableFromRecords(schema *arrow.Schema, recs []arrow.Record) arrow.Table {
	arrs := make([]arrow.Array, len(recs))
	cols := make([]arrow.Column, schema.NumFields())

	defer func(cols []arrow.Column) {
		for i := range cols {
			cols[i].Release()
		}
	}(cols)

	for i := range cols {
		field := schema.Field(i)
		for j, rec := range recs {
			arrs[j] = rec.Column(i)
		}
		chunk := arrow.NewChunked(field.Type, arrs)
		cols[i] = *arrow.NewColumn(field, chunk)
		chunk.Release()
	}

	return NewTable(schema, cols, -1)
}

func (tbl *simpleTable) Schema() *arrow.Schema { return tbl.schema }

func (tbl *simpleTable) AddColumn(i int, field arrow.Field, column arrow.Column) (arrow.Table, error) {
	if int64(column.Len()) != tbl.rows {
		return nil, fmt.Errorf("arrow/array: column length mismatch: %d != %d", column.Len(), tbl.rows)
	}
	if field.Type != column.DataType() {
		return nil, fmt.Errorf("arrow/array: column type mismatch: %v != %v", field.Type, column.DataType())
	}
	newSchema, err := tbl.schema.AddField(i, field)
	if err != nil {
		return nil, err
	}
	cols := make([]arrow.Column, len(tbl.cols)+1)
	copy(cols[:i], tbl.cols[:i])
	cols[i] = column
	copy(cols[i+1:], tbl.cols[i:])
	newTable := NewTable(newSchema, cols, tbl.rows)
	return newTable, nil
}

func (tbl *simpleTable) NumRows() int64             { return tbl.rows }
func (tbl *simpleTable) NumCols() int64             { return int64(len(tbl.cols)) }
func (tbl *simpleTable) Column(i int) *arrow.Column { return &tbl.cols[i] }

func (tbl *simpleTable) validate() {
	if len(tbl.cols) != tbl.schema.NumFields() {
		panic(errors.New("arrow/array: table schema mismatch"))
	}
	for i, col := range tbl.cols {
		if !col.Field().Equal(tbl.schema.Field(i)) {
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
	tbl.refCount.Add(1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (tbl *simpleTable) Release() {
	debug.Assert(tbl.refCount.Load() > 0, "too many releases")

	if tbl.refCount.Add(-1) == 0 {
		for i := range tbl.cols {
			tbl.cols[i].Release()
		}
		tbl.cols = nil
	}
}

func (tbl *simpleTable) String() string {
	o := new(strings.Builder)
	o.WriteString(tbl.Schema().String())
	o.WriteString("\n")

	for i := 0; i < int(tbl.NumCols()); i++ {
		col := tbl.Column(i)
		o.WriteString(col.Field().Name + ": [")
		for j, chunk := range col.Data().Chunks() {
			if j != 0 {
				o.WriteString(", ")
			}
			o.WriteString(chunk.String())
		}
		o.WriteString("]\n")
	}
	return o.String()
}

// TableReader is a Record iterator over a (possibly chunked) Table
type TableReader struct {
	refCount atomic.Int64

	tbl   arrow.Table
	cur   int64        // current row
	max   int64        // total number of rows
	rec   arrow.Record // current Record
	chksz int64        // chunk size

	chunks  []*arrow.Chunked
	slots   []int   // chunk indices
	offsets []int64 // chunk offsets
}

// NewTableReader returns a new TableReader to iterate over the (possibly chunked) Table.
// if chunkSize is <= 0, the biggest possible chunk will be selected.
func NewTableReader(tbl arrow.Table, chunkSize int64) *TableReader {
	ncols := tbl.NumCols()
	tr := &TableReader{
		tbl:     tbl,
		cur:     0,
		max:     int64(tbl.NumRows()),
		chksz:   chunkSize,
		chunks:  make([]*arrow.Chunked, ncols),
		slots:   make([]int, ncols),
		offsets: make([]int64, ncols),
	}
	tr.refCount.Add(1)
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
func (tr *TableReader) Record() arrow.Record  { return tr.rec }

func (tr *TableReader) Next() bool {
	if tr.cur >= tr.max {
		return false
	}

	if tr.rec != nil {
		tr.rec.Release()
	}

	// determine the minimum contiguous slice across all columns
	chunksz := imin64(tr.max, tr.chksz)
	chunks := make([]arrow.Array, len(tr.chunks))
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
	batch := make([]arrow.Array, len(tr.chunks))
	for i, chunk := range chunks {
		var slice arrow.Array
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
	tr.refCount.Add(1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (tr *TableReader) Release() {
	debug.Assert(tr.refCount.Load() > 0, "too many releases")

	if tr.refCount.Add(-1) == 0 {
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
func (tr *TableReader) Err() error { return nil }

func imin64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

var (
	_ arrow.Table  = (*simpleTable)(nil)
	_ RecordReader = (*TableReader)(nil)
)
