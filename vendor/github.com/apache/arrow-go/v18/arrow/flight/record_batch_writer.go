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

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/ipc"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

// DataStreamWriter is an interface that represents an Arrow Flight stream
// writer that writes FlightData objects
type DataStreamWriter interface {
	Send(*FlightData) error
}

type flightPayloadWriter struct {
	w   DataStreamWriter
	fd  FlightData
	buf bytes.Buffer
}

func (f *flightPayloadWriter) Start() error { return nil }
func (f *flightPayloadWriter) WritePayload(payload ipc.Payload) error {
	m := payload.Meta()
	defer m.Release()

	f.fd.DataHeader = m.Bytes()
	f.buf.Reset()

	payload.SerializeBody(&f.buf)
	f.fd.DataBody = f.buf.Bytes()

	return f.w.Send(&f.fd)
}

func (f *flightPayloadWriter) Close() error { return nil }

// Writer is an ipc.Writer which also adds a WriteWithAppMetadata function
// in order to allow adding AppMetadata to the FlightData messages which
// are written.
type Writer struct {
	*ipc.Writer
	pw *flightPayloadWriter
}

// WriteMetadata writes a payload message to the stream containing only
// the specified app metadata.
func (w *Writer) WriteMetadata(appMetadata []byte) error {
	return w.pw.w.Send(&FlightData{AppMetadata: appMetadata})
}

// SetFlightDescriptor sets the flight descriptor into the next payload that will
// be written by the flight writer. It will only be put into the very next payload
// and afterwards the writer will no longer keep it's pointer to the descriptor.
func (w *Writer) SetFlightDescriptor(descr *FlightDescriptor) {
	w.pw.fd.FlightDescriptor = descr
}

// Write writes a recordbatch payload and returns any error, implementing the arrio.Writer interface
func (w *Writer) Write(rec arrow.RecordBatch) error {
	if w.pw.fd.FlightDescriptor != nil {
		defer func() {
			w.pw.fd.FlightDescriptor = nil
		}()
	}
	return w.Writer.Write(rec)
}

// WriteWithAppMetadata will write this record batch with the supplied application
// metadata attached in the flightData message.
func (w *Writer) WriteWithAppMetadata(rec arrow.RecordBatch, appMeta []byte) error {
	w.pw.fd.AppMetadata = appMeta
	defer func() {
		w.pw.fd.AppMetadata = nil
	}()
	return w.Write(rec)
}

// NewRecordWriter can be used to construct a writer for arrow flight via
// the grpc stream handler to write flight data objects and write
// record batches to the stream. Options passed here will be passed to
// ipc.NewWriter
func NewRecordWriter(w DataStreamWriter, opts ...ipc.Option) *Writer {
	pw := &flightPayloadWriter{w: w}
	return &Writer{Writer: ipc.NewWriterWithPayloadWriter(pw, opts...), pw: pw}
}

// SerializeSchema returns the serialized schema bytes for use in Arrow Flight
// protobuf messages.
func SerializeSchema(rec *arrow.Schema, mem memory.Allocator) []byte {
	// even though the spec says to send the message as in Schema.fbs,
	// it looks like all the implementations actually send a fully serialized
	// record batch just with no rows. So let's follow that pattern.
	var buf bytes.Buffer
	w := ipc.NewWriter(&buf, ipc.WithSchema(rec), ipc.WithAllocator(mem))
	w.Close()
	return buf.Bytes()
}

type MetadataWriter interface {
	WriteMetadata([]byte) error
}
