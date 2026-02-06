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

package flight

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"sync/atomic"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/arrio"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/ipc"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
)

// DataStreamReader is an interface for receiving flight data messages on a stream
// such as via grpc with Arrow Flight.
type DataStreamReader interface {
	Recv() (*FlightData, error)
}

type dataMessageReader struct {
	rdr DataStreamReader

	peeked   *FlightData
	refCount atomic.Int64
	msg      *ipc.Message

	lastAppMetadata []byte
	descr           *FlightDescriptor
}

func (d *dataMessageReader) Message() (*ipc.Message, error) {
	var (
		fd  *FlightData
		err error
	)

	if d.peeked != nil {
		fd = d.peeked
		d.peeked = nil
	} else {
		fd, err = d.rdr.Recv()
	}

	if err != nil {
		if d.msg != nil {
			// clear the previous message in the error case
			d.msg.Release()
			d.msg = nil
		}
		d.lastAppMetadata = nil
		d.descr = nil
		return nil, err
	}

	d.lastAppMetadata = fd.AppMetadata
	d.descr = fd.FlightDescriptor
	d.msg = ipc.NewMessage(memory.NewBufferBytes(fd.DataHeader), memory.NewBufferBytes(fd.DataBody))
	return d.msg, nil
}

func (d *dataMessageReader) Retain() {
	d.refCount.Add(1)
}

func (d *dataMessageReader) Release() {
	debug.Assert(d.refCount.Load() > 0, "too many releases")

	if d.refCount.Add(-1) == 0 {
		if d.msg != nil {
			d.msg.Release()
			d.msg = nil
		}
		d.lastAppMetadata = nil
	}
}

// Reader is an ipc.Reader which also keeps track of the metadata from
// the FlightData messages as they come in, calling LatestAppMetadata
// will return the metadata bytes from the most recently read message.
type Reader struct {
	*ipc.Reader
	dmr *dataMessageReader
}

// Retain increases the reference count for the underlying message reader
// and ipc.Reader which are utilized by this Reader.
func (r *Reader) Retain() {
	r.Reader.Retain()
	r.dmr.Retain()
}

// Release reduces the reference count for the underlying message reader
// and ipc.Reader, when the reference counts become zero, the allocated
// memory is released for the stored record and metadata.
func (r *Reader) Release() {
	r.Reader.Release()
	r.dmr.Release()
}

// LatestAppMetadata returns the bytes from the AppMetadata field of the
// most recently read FlightData message that was processed by calling
// the Next function. The metadata returned would correspond to the record
// retrieved by calling RecordBatch().
func (r *Reader) LatestAppMetadata() []byte {
	return r.dmr.lastAppMetadata
}

// LatestFlightDescriptor returns a pointer to the last FlightDescriptor object
// that was received in the most recently read FlightData message that was
// processed by calling the Next function. The descriptor returned would correspond
// to the record batch retrieved by calling RecordBatch().
func (r *Reader) LatestFlightDescriptor() *FlightDescriptor {
	return r.dmr.descr
}

// Chunk is a convenience function to return a chunk of the flight stream
// returning the RecordBatch along with the FlightDescriptor and any AppMetadata.
// Each of these can be retrieved separately with their respective functions,
// this is just a convenience to retrieve all three with one function call.
func (r *Reader) Chunk() StreamChunk {
	return StreamChunk{
		Data:        r.RecordBatch(),
		Desc:        r.dmr.descr,
		AppMetadata: r.dmr.lastAppMetadata,
	}
}

// NewRecordReader constructs an ipc reader using the flight data stream reader
// as the source of the ipc messages, opts passed will be passed to the underlying
// ipc.Reader such as ipc.WithSchema and ipc.WithAllocator
func NewRecordReader(r DataStreamReader, opts ...ipc.Option) (*Reader, error) {
	// peek the first message for a descriptor
	data, err := r.Recv()
	if err != nil {
		return nil, err
	}

	rdr := &Reader{dmr: &dataMessageReader{rdr: r}}
	rdr.dmr.refCount.Add(1)
	rdr.dmr.descr = data.FlightDescriptor
	if len(data.DataHeader) > 0 {
		rdr.dmr.peeked = data
	}

	rdr.dmr.Retain()
	if rdr.Reader, err = ipc.NewReaderFromMessageReader(rdr.dmr, opts...); err != nil {
		return nil, fmt.Errorf("arrow/flight: could not create flight reader: %w", err)
	}

	return rdr, nil
}

// DeserializeSchema takes the schema bytes from FlightInfo or SchemaResult
// and returns the deserialized arrow schema.
func DeserializeSchema(info []byte, mem memory.Allocator) (*arrow.Schema, error) {
	// even though the Flight proto file says that the bytes should be the
	// flatbuffer message as per Schema.fbs, the current implementations send
	// a serialized recordbatch with no body rows rather than just the
	// schema message. So let's make sure to follow that.
	rdr, err := ipc.NewReader(bytes.NewReader(info), ipc.WithAllocator(mem))
	if err != nil {
		return nil, err
	}
	defer rdr.Release()
	return rdr.Schema(), nil
}

// StreamChunk represents a single chunk of a FlightData stream
type StreamChunk struct {
	Data        arrow.RecordBatch
	Desc        *FlightDescriptor
	AppMetadata []byte
	Err         error
}

// MessageReader is an interface representing a RecordReader
// that also provides StreamChunks and/or the ability to retrieve
// FlightDescriptors and AppMetadata from the flight stream
type MessageReader interface {
	array.RecordReader
	arrio.Reader
	Err() error
	Chunk() StreamChunk
	LatestFlightDescriptor() *FlightDescriptor
	LatestAppMetadata() []byte
}

type haserr interface {
	Err() error
}

// StreamChunksFromReader is a convenience function to populate a channel
// from a record reader. It is intended to be run using a separate goroutine
// by calling `go flight.StreamChunksFromReader(rdr, ch)`.
//
// If the record reader panics, an error chunk will get sent on the channel.
//
// This will close the channel and release the reader when it completes.
func StreamChunksFromReader(rdr array.RecordReader, ch chan<- StreamChunk) {
	defer close(ch)
	defer func() {
		if err := recover(); err != nil {
			ch <- StreamChunk{Err: utils.FormatRecoveredError("panic while reading", err)}
		}
	}()

	defer rdr.Release()
	for rdr.Next() {
		rec := rdr.RecordBatch()
		rec.Retain()
		ch <- StreamChunk{Data: rec}
	}

	if e, ok := rdr.(haserr); ok {
		if e.Err() != nil {
			ch <- StreamChunk{Err: e.Err()}
		}
	}
}

func ConcatenateReaders(rdrs []array.RecordReader, ch chan<- StreamChunk) {
	defer close(ch)
	defer func() {
		for _, r := range rdrs {
			r.Release()
		}

		if err := recover(); err != nil {
			ch <- StreamChunk{Err: utils.FormatRecoveredError("panic while reading", err)}
		}
	}()

	for _, r := range rdrs {
		for r.Next() {
			rec := r.RecordBatch()
			rec.Retain()
			ch <- StreamChunk{Data: rec}
		}
		if e, ok := r.(haserr); ok {
			if e.Err() != nil && !errors.Is(e.Err(), io.EOF) {
				ch <- StreamChunk{Err: e.Err()}
				return
			}
		}
	}
}
