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
	"bytes"
	"fmt"
	"iter"
	"strings"
	"sync/atomic"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// RecordReader reads a stream of records.
type RecordReader interface {
	Retain()
	Release()

	Schema() *arrow.Schema

	Next() bool
	Record() arrow.Record
	Err() error
}

// simpleRecords is a simple iterator over a collection of records.
type simpleRecords struct {
	refCount atomic.Int64

	schema *arrow.Schema
	recs   []arrow.Record
	cur    arrow.Record
}

// NewRecordReader returns a simple iterator over the given slice of records.
func NewRecordReader(schema *arrow.Schema, recs []arrow.Record) (RecordReader, error) {
	rs := &simpleRecords{
		schema: schema,
		recs:   recs,
		cur:    nil,
	}
	rs.refCount.Add(1)

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
	rs.refCount.Add(1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (rs *simpleRecords) Release() {
	debug.Assert(rs.refCount.Load() > 0, "too many releases")

	if rs.refCount.Add(-1) == 0 {
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
func (rs *simpleRecords) Record() arrow.Record  { return rs.cur }
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
func (rs *simpleRecords) Err() error { return nil }

// simpleRecord is a basic, non-lazy in-memory record batch.
type simpleRecord struct {
	refCount atomic.Int64

	schema *arrow.Schema

	rows int64
	arrs []arrow.Array
}

// NewRecord returns a basic, non-lazy in-memory record batch.
//
// NewRecord panics if the columns and schema are inconsistent.
// NewRecord panics if rows is larger than the height of the columns.
func NewRecord(schema *arrow.Schema, cols []arrow.Array, nrows int64) arrow.Record {
	rec := &simpleRecord{
		schema: schema,
		rows:   nrows,
		arrs:   make([]arrow.Array, len(cols)),
	}
	rec.refCount.Add(1)

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

func (rec *simpleRecord) SetColumn(i int, arr arrow.Array) (arrow.Record, error) {
	if i < 0 || i >= len(rec.arrs) {
		return nil, fmt.Errorf("arrow/array: column index out of range [0, %d): got=%d", len(rec.arrs), i)
	}

	if arr.Len() != int(rec.rows) {
		return nil, fmt.Errorf("arrow/array: mismatch number of rows in column %q: got=%d, want=%d",
			rec.schema.Field(i).Name,
			arr.Len(), rec.rows,
		)
	}

	f := rec.schema.Field(i)
	if !arrow.TypeEqual(f.Type, arr.DataType()) {
		return nil, fmt.Errorf("arrow/array: column %q type mismatch: got=%v, want=%v",
			f.Name,
			arr.DataType(), f.Type,
		)
	}
	arrs := make([]arrow.Array, len(rec.arrs))
	copy(arrs, rec.arrs)
	arrs[i] = arr

	return NewRecord(rec.schema, arrs, rec.rows), nil
}

func (rec *simpleRecord) validate() error {
	if rec.rows == 0 && len(rec.arrs) == 0 {
		return nil
	}

	if len(rec.arrs) != rec.schema.NumFields() {
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
	rec.refCount.Add(1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (rec *simpleRecord) Release() {
	debug.Assert(rec.refCount.Load() > 0, "too many releases")

	if rec.refCount.Add(-1) == 0 {
		for _, arr := range rec.arrs {
			arr.Release()
		}
		rec.arrs = nil
	}
}

func (rec *simpleRecord) Schema() *arrow.Schema    { return rec.schema }
func (rec *simpleRecord) NumRows() int64           { return rec.rows }
func (rec *simpleRecord) NumCols() int64           { return int64(len(rec.arrs)) }
func (rec *simpleRecord) Columns() []arrow.Array   { return rec.arrs }
func (rec *simpleRecord) Column(i int) arrow.Array { return rec.arrs[i] }
func (rec *simpleRecord) ColumnName(i int) string  { return rec.schema.Field(i).Name }

// NewSlice constructs a zero-copy slice of the record with the indicated
// indices i and j, corresponding to array[i:j].
// The returned record must be Release()'d after use.
//
// NewSlice panics if the slice is outside the valid range of the record array.
// NewSlice panics if j < i.
func (rec *simpleRecord) NewSlice(i, j int64) arrow.Record {
	arrs := make([]arrow.Array, len(rec.arrs))
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

func (rec *simpleRecord) MarshalJSON() ([]byte, error) {
	arr := RecordToStructArray(rec)
	defer arr.Release()
	return arr.MarshalJSON()
}

// RecordBuilder eases the process of building a Record, iteratively, from
// a known Schema.
type RecordBuilder struct {
	refCount atomic.Int64
	mem      memory.Allocator
	schema   *arrow.Schema
	fields   []Builder
}

// NewRecordBuilder returns a builder, using the provided memory allocator and a schema.
func NewRecordBuilder(mem memory.Allocator, schema *arrow.Schema) *RecordBuilder {
	b := &RecordBuilder{
		mem:    mem,
		schema: schema,
		fields: make([]Builder, schema.NumFields()),
	}
	b.refCount.Add(1)

	for i := 0; i < schema.NumFields(); i++ {
		b.fields[i] = NewBuilder(b.mem, schema.Field(i).Type)
	}

	return b
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (b *RecordBuilder) Retain() {
	b.refCount.Add(1)
}

// Release decreases the reference count by 1.
func (b *RecordBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		for _, f := range b.fields {
			f.Release()
		}
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
func (b *RecordBuilder) NewRecord() arrow.Record {
	cols := make([]arrow.Array, len(b.fields))
	rows := int64(0)

	defer func(cols []arrow.Array) {
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

// UnmarshalJSON for record builder will read in a single object and add the values
// to each field in the recordbuilder, missing fields will get a null and unexpected
// keys will be ignored. If reading in an array of records as a single batch, then use
// a structbuilder and use RecordFromStruct.
func (b *RecordBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	// should start with a '{'
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '{' {
		return fmt.Errorf("record should start with '{', not %s", t)
	}

	keylist := make(map[string]bool)
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return err
		}

		key := keyTok.(string)
		if keylist[key] {
			return fmt.Errorf("key %s shows up twice in row to be decoded", key)
		}
		keylist[key] = true

		indices := b.schema.FieldIndices(key)
		if len(indices) == 0 {
			var extra interface{}
			if err := dec.Decode(&extra); err != nil {
				return err
			}
			continue
		}

		if err := b.fields[indices[0]].UnmarshalOne(dec); err != nil {
			return err
		}
	}

	for i := 0; i < b.schema.NumFields(); i++ {
		if !keylist[b.schema.Field(i).Name] {
			b.fields[i].AppendNull()
		}
	}
	return nil
}

type iterReader struct {
	refCount atomic.Int64

	schema *arrow.Schema
	cur    arrow.Record

	next func() (arrow.Record, error, bool)
	stop func()

	err error
}

func (ir *iterReader) Schema() *arrow.Schema { return ir.schema }

func (ir *iterReader) Retain() { ir.refCount.Add(1) }
func (ir *iterReader) Release() {
	debug.Assert(ir.refCount.Load() > 0, "too many releases")

	if ir.refCount.Add(-1) == 0 {
		ir.stop()
		ir.schema, ir.next = nil, nil
		if ir.cur != nil {
			ir.cur.Release()
		}
	}
}

func (ir *iterReader) Record() arrow.Record { return ir.cur }
func (ir *iterReader) Err() error           { return ir.err }

func (ir *iterReader) Next() bool {
	if ir.cur != nil {
		ir.cur.Release()
	}

	var ok bool
	ir.cur, ir.err, ok = ir.next()
	if ir.err != nil {
		ir.stop()
		return false
	}

	return ok
}

// ReaderFromIter wraps a go iterator for arrow.Record + error into a RecordReader
// interface object for ease of use.
func ReaderFromIter(schema *arrow.Schema, itr iter.Seq2[arrow.Record, error]) RecordReader {
	next, stop := iter.Pull2(itr)
	rdr := &iterReader{
		schema: schema,
		next:   next,
		stop:   stop,
	}
	rdr.refCount.Add(1)
	return rdr
}

// IterFromReader converts a RecordReader interface into an iterator that
// you can use range on. The semantics are still important, if a record
// that is returned is desired to be utilized beyond the scope of an iteration
// then Retain must be called on it.
func IterFromReader(rdr RecordReader) iter.Seq2[arrow.Record, error] {
	rdr.Retain()
	return func(yield func(arrow.Record, error) bool) {
		defer rdr.Release()
		for rdr.Next() {
			if !yield(rdr.Record(), nil) {
				return
			}
		}

		if rdr.Err() != nil {
			yield(nil, rdr.Err())
		}
	}
}

var (
	_ arrow.Record = (*simpleRecord)(nil)
	_ RecordReader = (*simpleRecords)(nil)
)
