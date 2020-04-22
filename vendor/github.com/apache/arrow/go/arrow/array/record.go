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
	"fmt"
	"strings"
	"sync/atomic"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/internal/debug"
	"github.com/apache/arrow/go/arrow/memory"
)

// RecordReader reads a stream of records.
type RecordReader interface {
	Retain()
	Release()

	Schema() *arrow.Schema

	Next() bool
	Record() Record
}

// simpleRecords is a simple iterator over a collection of records.
type simpleRecords struct {
	refCount int64

	schema *arrow.Schema
	recs   []Record
	cur    Record
}

// NewRecordReader returns a simple iterator over the given slice of records.
func NewRecordReader(schema *arrow.Schema, recs []Record) (*simpleRecords, error) {
	rs := &simpleRecords{
		refCount: 1,
		schema:   schema,
		recs:     recs,
		cur:      nil,
	}

	for _, rec := range rs.recs {
		rec.Retain()
	}

	for _, rec := range recs {
		if !rec.Schema().Equal(rs.schema) {
			rs.Release()
			return nil, fmt.Errorf("arrow/array: mismatch schema")
		}
	}

	return rs, nil
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (rs *simpleRecords) Retain() {
	atomic.AddInt64(&rs.refCount, 1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (rs *simpleRecords) Release() {
	debug.Assert(atomic.LoadInt64(&rs.refCount) > 0, "too many releases")

	if atomic.AddInt64(&rs.refCount, -1) == 0 {
		if rs.cur != nil {
			rs.cur.Release()
		}
		for _, rec := range rs.recs {
			rec.Release()
		}
		rs.recs = nil
	}
}

func (rs *simpleRecords) Schema() *arrow.Schema { return rs.schema }
func (rs *simpleRecords) Record() Record        { return rs.cur }
func (rs *simpleRecords) Next() bool {
	if len(rs.recs) == 0 {
		return false
	}
	if rs.cur != nil {
		rs.cur.Release()
	}
	rs.cur = rs.recs[0]
	rs.recs = rs.recs[1:]
	return true
}

// Record is a collection of equal-length arrays
// matching a particular Schema.
type Record interface {
	Release()
	Retain()

	Schema() *arrow.Schema

	NumRows() int64
	NumCols() int64

	Columns() []Interface
	Column(i int) Interface
	ColumnName(i int) string

	// NewSlice constructs a zero-copy slice of the record with the indicated
	// indices i and j, corresponding to array[i:j].
	// The returned record must be Release()'d after use.
	//
	// NewSlice panics if the slice is outside the valid range of the record array.
	// NewSlice panics if j < i.
	NewSlice(i, j int64) Record
}

// simpleRecord is a basic, non-lazy in-memory record batch.
type simpleRecord struct {
	refCount int64

	schema *arrow.Schema

	rows int64
	arrs []Interface
}

// NewRecord returns a basic, non-lazy in-memory record batch.
//
// NewRecord panics if the columns and schema are inconsistent.
// NewRecord panics if rows is larger than the height of the columns.
func NewRecord(schema *arrow.Schema, cols []Interface, nrows int64) *simpleRecord {
	rec := &simpleRecord{
		refCount: 1,
		schema:   schema,
		rows:     nrows,
		arrs:     make([]Interface, len(cols)),
	}
	copy(rec.arrs, cols)
	for _, arr := range rec.arrs {
		arr.Retain()
	}

	if rec.rows < 0 {
		switch len(rec.arrs) {
		case 0:
			rec.rows = 0
		default:
			rec.rows = int64(rec.arrs[0].Len())
		}
	}

	err := rec.validate()
	if err != nil {
		rec.Release()
		panic(err)
	}

	return rec
}

func (rec *simpleRecord) validate() error {
	if len(rec.arrs) != len(rec.schema.Fields()) {
		return fmt.Errorf("arrow/array: number of columns/fields mismatch")
	}

	for i, arr := range rec.arrs {
		f := rec.schema.Field(i)
		if int64(arr.Len()) < rec.rows {
			return fmt.Errorf("arrow/array: mismatch number of rows in column %q: got=%d, want=%d",
				f.Name,
				arr.Len(), rec.rows,
			)
		}
		if !arrow.TypeEqual(f.Type, arr.DataType()) {
			return fmt.Errorf("arrow/array: column %q type mismatch: got=%v, want=%v",
				f.Name,
				arr.DataType(), f.Type,
			)
		}
	}
	return nil
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (rec *simpleRecord) Retain() {
	atomic.AddInt64(&rec.refCount, 1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (rec *simpleRecord) Release() {
	debug.Assert(atomic.LoadInt64(&rec.refCount) > 0, "too many releases")

	if atomic.AddInt64(&rec.refCount, -1) == 0 {
		for _, arr := range rec.arrs {
			arr.Release()
		}
		rec.arrs = nil
	}
}

func (rec *simpleRecord) Schema() *arrow.Schema   { return rec.schema }
func (rec *simpleRecord) NumRows() int64          { return rec.rows }
func (rec *simpleRecord) NumCols() int64          { return int64(len(rec.arrs)) }
func (rec *simpleRecord) Columns() []Interface    { return rec.arrs }
func (rec *simpleRecord) Column(i int) Interface  { return rec.arrs[i] }
func (rec *simpleRecord) ColumnName(i int) string { return rec.schema.Field(i).Name }

// NewSlice constructs a zero-copy slice of the record with the indicated
// indices i and j, corresponding to array[i:j].
// The returned record must be Release()'d after use.
//
// NewSlice panics if the slice is outside the valid range of the record array.
// NewSlice panics if j < i.
func (rec *simpleRecord) NewSlice(i, j int64) Record {
	arrs := make([]Interface, len(rec.arrs))
	for ii, arr := range rec.arrs {
		arrs[ii] = NewSlice(arr, i, j)
	}
	defer func() {
		for _, arr := range arrs {
			arr.Release()
		}
	}()
	return NewRecord(rec.schema, arrs, j-i)
}

func (rec *simpleRecord) String() string {
	o := new(strings.Builder)
	fmt.Fprintf(o, "record:\n  %v\n", rec.schema)
	fmt.Fprintf(o, "  rows: %d\n", rec.rows)
	for i, col := range rec.arrs {
		fmt.Fprintf(o, "  col[%d][%s]: %v\n", i, rec.schema.Field(i).Name, col)
	}

	return o.String()
}

// RecordBuilder eases the process of building a Record, iteratively, from
// a known Schema.
type RecordBuilder struct {
	refCount int64
	mem      memory.Allocator
	schema   *arrow.Schema
	fields   []Builder
}

// NewRecordBuilder returns a builder, using the provided memory allocator and a schema.
func NewRecordBuilder(mem memory.Allocator, schema *arrow.Schema) *RecordBuilder {
	b := &RecordBuilder{
		refCount: 1,
		mem:      mem,
		schema:   schema,
		fields:   make([]Builder, len(schema.Fields())),
	}

	for i, f := range schema.Fields() {
		b.fields[i] = newBuilder(b.mem, f.Type)
	}

	return b
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (b *RecordBuilder) Retain() {
	atomic.AddInt64(&b.refCount, 1)
}

// Release decreases the reference count by 1.
func (b *RecordBuilder) Release() {
	debug.Assert(atomic.LoadInt64(&b.refCount) > 0, "too many releases")

	for _, f := range b.fields {
		f.Release()
	}

	if atomic.AddInt64(&b.refCount, -1) == 0 {
		b.fields = nil
	}
}

func (b *RecordBuilder) Schema() *arrow.Schema { return b.schema }
func (b *RecordBuilder) Fields() []Builder     { return b.fields }
func (b *RecordBuilder) Field(i int) Builder   { return b.fields[i] }

func (b *RecordBuilder) Reserve(size int) {
	for _, f := range b.fields {
		f.Reserve(size)
	}
}

// NewRecord creates a new record from the memory buffers and resets the
// RecordBuilder so it can be used to build a new record.
//
// The returned Record must be Release()'d after use.
//
// NewRecord panics if the fields' builder do not have the same length.
func (b *RecordBuilder) NewRecord() Record {
	cols := make([]Interface, len(b.fields))
	rows := int64(0)

	defer func(cols []Interface) {
		for _, col := range cols {
			if col == nil {
				continue
			}
			col.Release()
		}
	}(cols)

	for i, f := range b.fields {
		cols[i] = f.NewArray()
		irow := int64(cols[i].Len())
		if i > 0 && irow != rows {
			panic(fmt.Errorf("arrow/array: field %d has %d rows. want=%d", i, irow, rows))
		}
		rows = irow
	}

	return NewRecord(b.schema, cols, rows)
}

var (
	_ Record       = (*simpleRecord)(nil)
	_ RecordReader = (*simpleRecords)(nil)
)
