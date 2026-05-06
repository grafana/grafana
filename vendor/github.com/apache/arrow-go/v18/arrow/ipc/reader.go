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
	"io"
	"sync/atomic"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/endian"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/internal/dictutils"
	"github.com/apache/arrow-go/v18/arrow/internal/flatbuf"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
)

// Reader reads records from an io.Reader.
// Reader expects a schema (plus any dictionaries) as the first messages
// in the stream, followed by records.
type Reader struct {
	r      MessageReader
	schema *arrow.Schema

	refCount atomic.Int64
	rec      arrow.Record
	err      error

	// types dictTypeMap
	memo               dictutils.Memo
	readInitialDicts   bool
	done               bool
	swapEndianness     bool
	ensureNativeEndian bool
	expectedSchema     *arrow.Schema

	mem memory.Allocator
}

// NewReaderFromMessageReader allows constructing a new reader object with the
// provided MessageReader allowing injection of reading messages other than
// by simple streaming bytes such as Arrow Flight which receives a protobuf message
func NewReaderFromMessageReader(r MessageReader, opts ...Option) (reader *Reader, err error) {
	defer func() {
		if pErr := recover(); pErr != nil {
			err = utils.FormatRecoveredError("arrow/ipc: unknown error while reading", pErr)
		}
	}()
	cfg := newConfig()
	for _, opt := range opts {
		opt(cfg)
	}

	rr := &Reader{
		r:        r,
		refCount: atomic.Int64{},
		// types:    make(dictTypeMap),
		memo:               dictutils.NewMemo(),
		mem:                cfg.alloc,
		ensureNativeEndian: cfg.ensureNativeEndian,
		expectedSchema:     cfg.schema,
	}
	rr.refCount.Add(1)

	if !cfg.noAutoSchema {
		if err := rr.readSchema(cfg.schema); err != nil {
			return nil, err
		}
	}

	return rr, nil
}

// NewReader returns a reader that reads records from an input stream.
func NewReader(r io.Reader, opts ...Option) (*Reader, error) {
	return NewReaderFromMessageReader(NewMessageReader(r, opts...), opts...)
}

// Err returns the last error encountered during the iteration over the
// underlying stream.
func (r *Reader) Err() error { return r.err }

func (r *Reader) Schema() *arrow.Schema {
	if r.schema == nil {
		if err := r.readSchema(r.expectedSchema); err != nil {
			r.err = fmt.Errorf("arrow/ipc: could not read schema from stream: %w", err)
			r.done = true
		}
	}
	return r.schema
}

func (r *Reader) readSchema(schema *arrow.Schema) error {
	msg, err := r.r.Message()
	if err != nil {
		return fmt.Errorf("arrow/ipc: could not read message schema: %w", err)
	}

	if msg.Type() != MessageSchema {
		return fmt.Errorf("arrow/ipc: invalid message type (got=%v, want=%v)", msg.Type(), MessageSchema)
	}

	// FIXME(sbinet) refactor msg-header handling.
	var schemaFB flatbuf.Schema
	initFB(&schemaFB, msg.msg.Header)

	r.schema, err = schemaFromFB(&schemaFB, &r.memo)
	if err != nil {
		return fmt.Errorf("arrow/ipc: could not decode schema from message schema: %w", err)
	}

	// check the provided schema match the one read from stream.
	if schema != nil && !schema.Equal(r.schema) {
		return errInconsistentSchema
	}

	if r.ensureNativeEndian && !r.schema.IsNativeEndian() {
		r.swapEndianness = true
		r.schema = r.schema.WithEndianness(endian.NativeEndian)
	}

	return nil
}

// Retain increases the reference count by 1.
// Retain may be called simultaneously from multiple goroutines.
func (r *Reader) Retain() {
	r.refCount.Add(1)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (r *Reader) Release() {
	debug.Assert(r.refCount.Load() > 0, "too many releases")

	if r.refCount.Add(-1) == 0 {
		if r.rec != nil {
			r.rec.Release()
			r.rec = nil
		}
		if r.r != nil {
			r.r.Release()
			r.r = nil
		}
		r.memo.Clear()
	}
}

// Next returns whether a Record could be extracted from the underlying stream.
func (r *Reader) Next() bool {
	if r.rec != nil {
		r.rec.Release()
		r.rec = nil
	}

	if r.err != nil || r.done {
		return false
	}

	return r.next()
}

func (r *Reader) getInitialDicts() bool {
	var msg *Message
	// we have to get all dictionaries before reconstructing the first
	// record. subsequent deltas and replacements modify the memo
	numDicts := r.memo.Mapper.NumDicts()
	// there should be numDicts dictionary messages
	for i := 0; i < numDicts; i++ {
		msg, r.err = r.r.Message()
		if r.err != nil {
			r.done = true
			if r.err == io.EOF {
				if i == 0 {
					r.err = nil
				} else {
					r.err = fmt.Errorf("arrow/ipc: IPC stream ended without reading the expected (%d) dictionaries", numDicts)
				}
			}
			return false
		}

		if msg.Type() != MessageDictionaryBatch {
			r.err = fmt.Errorf("arrow/ipc: IPC stream did not have the expected (%d) dictionaries at the start of the stream", numDicts)
		}
		if _, err := readDictionary(&r.memo, msg.meta, msg.body, r.swapEndianness, r.mem); err != nil {
			r.done = true
			r.err = err
			return false
		}
	}
	r.readInitialDicts = true
	return true
}

func (r *Reader) next() bool {
	defer func() {
		if pErr := recover(); pErr != nil {
			r.err = utils.FormatRecoveredError("arrow/ipc: unknown error while reading", pErr)
		}
	}()
	if r.schema == nil {
		if err := r.readSchema(r.expectedSchema); err != nil {
			r.err = fmt.Errorf("arrow/ipc: could not read schema from stream: %w", err)
			r.done = true
			return false
		}
	}

	if !r.readInitialDicts && !r.getInitialDicts() {
		return false
	}

	var msg *Message
	msg, r.err = r.r.Message()

	for msg != nil && msg.Type() == MessageDictionaryBatch {
		if _, r.err = readDictionary(&r.memo, msg.meta, msg.body, r.swapEndianness, r.mem); r.err != nil {
			r.done = true
			return false
		}
		msg, r.err = r.r.Message()
	}
	if r.err != nil {
		r.done = true
		if errors.Is(r.err, io.EOF) {
			r.err = nil
		}
		return false
	}

	if got, want := msg.Type(), MessageRecordBatch; got != want {
		r.err = fmt.Errorf("arrow/ipc: invalid message type (got=%v, want=%v", got, want)
		return false
	}

	r.rec = newRecord(r.schema, &r.memo, msg.meta, msg.body, r.swapEndianness, r.mem)
	return true
}

// Record returns the current record that has been extracted from the
// underlying stream.
// It is valid until the next call to Next.
func (r *Reader) Record() arrow.Record {
	return r.rec
}

// Read reads the current record from the underlying stream and an error, if any.
// When the Reader reaches the end of the underlying stream, it returns (nil, io.EOF).
func (r *Reader) Read() (arrow.Record, error) {
	if r.rec != nil {
		r.rec.Release()
		r.rec = nil
	}

	if !r.next() {
		if r.done && r.err == nil {
			return nil, io.EOF
		}
		return nil, r.err
	}

	return r.rec, nil
}

var _ array.RecordReader = (*Reader)(nil)
