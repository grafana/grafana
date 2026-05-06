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
	"io"
	"sync/atomic"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

type (
	Option func(config)
	config interface{}
)

// WithChunk sets the chunk size for reading in json records. The default is to
// read in one row per record batch as a single object. If chunk size is set to
// a negative value, then the entire file is read as a single record batch.
// Otherwise a record batch is read in with chunk size rows per record batch until
// it reaches EOF.
func WithChunk(n int) Option {
	return func(cfg config) {
		switch cfg := cfg.(type) {
		case *JSONReader:
			cfg.chunk = n
		default:
			panic(fmt.Errorf("arrow/json): unknown config type %T", cfg))
		}
	}
}

// WithAllocator specifies the allocator to use for creating the record batches,
// if it is not called, then memory.DefaultAllocator will be used.
func WithAllocator(mem memory.Allocator) Option {
	return func(cfg config) {
		switch cfg := cfg.(type) {
		case *JSONReader:
			cfg.mem = mem
		default:
			panic(fmt.Errorf("arrow/json): unknown config type %T", cfg))
		}
	}
}

// JSONReader is a json reader that meets the RecordReader interface definition.
//
// To read in an array of objects as a record, you can use RecordFromJSON
// which is equivalent to reading the json as a struct array whose fields are
// the columns of the record. This primarily exists to fit the RecordReader
// interface as a matching reader for the csv reader.
type JSONReader struct {
	r      *json.Decoder
	schema *arrow.Schema

	bldr *RecordBuilder

	refs atomic.Int64
	cur  arrow.Record
	err  error

	chunk int
	done  bool

	mem  memory.Allocator
	next func() bool
}

// NewJSONReader returns a json RecordReader which expects to find one json object
// per row of dataset. Using WithChunk can control how many rows are processed
// per record, which is how many objects become a single record from the file.
//
// If it is desired to write out an array of rows, then simply use RecordToStructArray
// and json.Marshal the struct array for the same effect.
func NewJSONReader(r io.Reader, schema *arrow.Schema, opts ...Option) *JSONReader {
	rr := &JSONReader{
		r:      json.NewDecoder(r),
		schema: schema,
		chunk:  1,
	}
	rr.refs.Add(1)

	for _, o := range opts {
		o(rr)
	}

	if rr.mem == nil {
		rr.mem = memory.DefaultAllocator
	}

	rr.bldr = NewRecordBuilder(rr.mem, schema)
	switch {
	case rr.chunk < 0:
		rr.next = rr.nextall
	case rr.chunk > 1:
		rr.next = rr.nextn
	default:
		rr.next = rr.next1
	}
	return rr
}

// Err returns the last encountered error
func (r *JSONReader) Err() error { return r.err }

func (r *JSONReader) Schema() *arrow.Schema { return r.schema }

// Record returns the last read in record. The returned record is only valid
// until the next call to Next unless Retain is called on the record itself.
func (r *JSONReader) Record() arrow.Record { return r.cur }

func (r *JSONReader) Retain() {
	r.refs.Add(1)
}

func (r *JSONReader) Release() {
	debug.Assert(r.refs.Load() > 0, "too many releases")

	if r.refs.Add(-1) == 0 {
		if r.cur != nil {
			r.cur.Release()
			r.bldr.Release()
			r.r = nil
		}
	}
}

// Next returns true if it read in a record, which will be available via Record
// and false if there is either an error or the end of the reader.
func (r *JSONReader) Next() bool {
	if r.cur != nil {
		r.cur.Release()
		r.cur = nil
	}

	if r.err != nil || r.done {
		return false
	}

	return r.next()
}

func (r *JSONReader) readNext() bool {
	r.err = r.r.Decode(r.bldr)
	if r.err != nil {
		r.done = true
		if errors.Is(r.err, io.EOF) {
			r.err = nil
		}
		return false
	}
	return true
}

func (r *JSONReader) nextall() bool {
	for r.readNext() {
	}

	r.cur = r.bldr.NewRecord()
	return r.cur.NumRows() > 0
}

func (r *JSONReader) next1() bool {
	if !r.readNext() {
		return false
	}

	r.cur = r.bldr.NewRecord()
	return true
}

func (r *JSONReader) nextn() bool {
	n := 0

	for i := 0; i < r.chunk && !r.done; i, n = i+1, n+1 {
		if !r.readNext() {
			break
		}
	}

	if n > 0 {
		r.cur = r.bldr.NewRecord()
	}
	return n > 0
}

var _ RecordReader = (*JSONReader)(nil)
