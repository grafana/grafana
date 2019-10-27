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

package ipc // import "github.com/apache/arrow/go/arrow/ipc"

import (
	"encoding/binary"
	"io"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/array"
	"github.com/apache/arrow/go/arrow/internal/bitutil"
	"github.com/apache/arrow/go/arrow/internal/flatbuf"
	"github.com/apache/arrow/go/arrow/memory"
	"github.com/pkg/errors"
)

type payloadWriter interface {
	start() error
	write(payload) error
	Close() error
}

type pwriter struct {
	w   io.WriteSeeker
	pos int64

	schema *arrow.Schema
	dicts  []fileBlock
	recs   []fileBlock
}

func (w *pwriter) start() error {
	var err error

	err = w.updatePos()
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not update position while in start")
	}

	// only necessary to align to 8-byte boundary at the start of the file
	_, err = w.Write(Magic)
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not write magic Arrow bytes")
	}

	err = w.align(kArrowIPCAlignment)
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not align start block")
	}

	return err
}

func (w *pwriter) write(p payload) error {
	blk := fileBlock{Offset: w.pos, Meta: 0, Body: p.size}
	n, err := writeIPCPayload(w, p)
	if err != nil {
		return err
	}

	blk.Meta = int32(n)

	err = w.updatePos()
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not update position while in write-payload")
	}

	switch byte(p.msg) {
	case flatbuf.MessageHeaderDictionaryBatch:
		w.dicts = append(w.dicts, blk)
	case flatbuf.MessageHeaderRecordBatch:
		w.recs = append(w.recs, blk)
	}

	return nil
}

func (w *pwriter) Close() error {
	var err error

	// write file footer
	err = w.updatePos()
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not update position while in close")
	}

	pos := w.pos
	err = writeFileFooter(w.schema, w.dicts, w.recs, w)
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not write file footer")
	}

	// write file footer length
	err = w.updatePos() // not strictly needed as we passed w to writeFileFooter...
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not compute file footer length")
	}

	size := w.pos - pos
	if size <= 0 {
		return errors.Errorf("arrow/ipc: invalid file footer size (size=%d)", size)
	}

	buf := make([]byte, 4)
	binary.LittleEndian.PutUint32(buf, uint32(size))
	_, err = w.Write(buf)
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not write file footer size")
	}

	_, err = w.Write(Magic)
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not write Arrow magic bytes")
	}

	return nil
}

func (w *pwriter) updatePos() error {
	var err error
	w.pos, err = w.w.Seek(0, io.SeekCurrent)
	return err
}

func (w *pwriter) align(align int32) error {
	remainder := paddedLength(w.pos, align) - w.pos
	if remainder == 0 {
		return nil
	}

	_, err := w.Write(paddingBytes[:int(remainder)])
	return err
}

func (w *pwriter) Write(p []byte) (int, error) {
	n, err := w.w.Write(p)
	w.pos += int64(n)
	return n, err
}

func writeIPCPayload(w io.Writer, p payload) (int, error) {
	n, err := writeMessage(p.meta, kArrowIPCAlignment, w)
	if err != nil {
		return n, err
	}

	// now write the buffers
	for _, buf := range p.body {
		var (
			size    int64
			padding int64
		)

		// the buffer might be null if we are handling zero row lengths.
		if buf != nil {
			size = int64(buf.Len())
			padding = bitutil.CeilByte64(size) - size
		}

		if size > 0 {
			_, err = w.Write(buf.Bytes())
			if err != nil {
				return n, errors.Wrap(err, "arrow/ipc: could not write payload message body")
			}
		}

		if padding > 0 {
			_, err = w.Write(paddingBytes[:padding])
			if err != nil {
				return n, errors.Wrap(err, "arrow/ipc: could not write payload message padding")
			}
		}
	}

	return n, err
}

type payload struct {
	msg  MessageType
	meta *memory.Buffer
	body []*memory.Buffer
	size int64 // length of body
}

func (p *payload) Release() {
	if p.meta != nil {
		p.meta.Release()
		p.meta = nil
	}
	for i, b := range p.body {
		if b == nil {
			continue
		}
		b.Release()
		p.body[i] = nil
	}
}

type payloads []payload

func (ps payloads) Release() {
	for i := range ps {
		ps[i].Release()
	}
}

// FileWriter is an Arrow file writer.
type FileWriter struct {
	w io.WriteSeeker

	mem memory.Allocator

	header struct {
		started bool
		offset  int64
	}

	footer struct {
		written bool
	}

	pw payloadWriter

	schema *arrow.Schema
}

// NewFileWriter opens an Arrow file using the provided writer w.
func NewFileWriter(w io.WriteSeeker, opts ...Option) (*FileWriter, error) {
	var (
		cfg = newConfig(opts...)
		err error
	)

	f := FileWriter{
		w:      w,
		pw:     &pwriter{w: w, schema: cfg.schema, pos: -1},
		mem:    cfg.alloc,
		schema: cfg.schema,
	}

	pos, err := f.w.Seek(0, io.SeekCurrent)
	if err != nil {
		return nil, errors.Errorf("arrow/ipc: could not seek current position: %v", err)
	}
	f.header.offset = pos

	return &f, err
}

func (f *FileWriter) Close() error {
	err := f.checkStarted()
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not write empty file")
	}

	if f.footer.written {
		return nil
	}

	err = f.pw.Close()
	if err != nil {
		return errors.Wrap(err, "arrow/ipc: could not close payload writer")
	}
	f.footer.written = true

	return nil
}

func (f *FileWriter) Write(rec array.Record) error {
	schema := rec.Schema()
	if schema == nil || !schema.Equal(f.schema) {
		return errInconsistentSchema
	}

	if err := f.checkStarted(); err != nil {
		return errors.Wrap(err, "arrow/ipc: could not write header")
	}

	const allow64b = true
	var (
		data = payload{msg: MessageRecordBatch}
		enc  = newRecordEncoder(f.mem, 0, kMaxNestingDepth, allow64b)
	)
	defer data.Release()

	if err := enc.Encode(&data, rec); err != nil {
		return errors.Wrap(err, "arrow/ipc: could not encode record to payload")
	}

	return f.pw.write(data)
}

func (f *FileWriter) checkStarted() error {
	if !f.header.started {
		return f.start()
	}
	return nil
}

func (f *FileWriter) start() error {
	f.header.started = true
	err := f.pw.start()
	if err != nil {
		return err
	}

	// write out schema payloads
	ps := payloadsFromSchema(f.schema, f.mem, nil)
	defer ps.Release()

	for _, data := range ps {
		err = f.pw.write(data)
		if err != nil {
			return err
		}
	}

	return nil
}
