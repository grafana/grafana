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

package utils

import (
	"encoding/binary"
	"io"
	"log"

	"github.com/apache/arrow-go/v18/arrow/bitutil"
)

// WriterAtBuffer is a convenience struct for providing a WriteAt function
// to a byte slice for use with things that want an io.WriterAt
type WriterAtBuffer struct {
	buf []byte
}

// NewWriterAtBuffer returns an object which fulfills the io.WriterAt interface
// by taking ownership of the passed in slice.
func NewWriterAtBuffer(buf []byte) WriterAtWithLen {
	return &WriterAtBuffer{buf}
}

// Len returns the length of the underlying byte slice.
func (w *WriterAtBuffer) Len() int {
	return len(w.buf)
}

// WriteAt fulfills the io.WriterAt interface to write len(p) bytes from p
// to the underlying byte slice starting at offset off. It returns the number
// of bytes written from p (0 <= n <= len(p)) and any error encountered.
func (w *WriterAtBuffer) WriteAt(p []byte, off int64) (n int, err error) {
	if off > int64(len(w.buf)) {
		return 0, io.ErrUnexpectedEOF
	}

	n = copy(w.buf[off:], p)
	if n < len(p) {
		err = io.ErrUnexpectedEOF
	}
	return
}

func (w *WriterAtBuffer) Reserve(nbytes int) {
	// no-op. We should not expand or otherwise modify the underlying buffer
}

// WriterAtWithLen is an interface for an io.WriterAt with a Len function
type WriterAtWithLen interface {
	io.WriterAt
	Len() int
	Reserve(int)
}

// BitWriter is a utility for writing values of specific bit widths to a stream
// using a uint64 as a buffer to build up between flushing for efficiency.
type BitWriter struct {
	wr         WriterAtWithLen
	buffer     uint64
	byteoffset int
	bitoffset  uint
	raw        [8]byte
	buf        [binary.MaxVarintLen64]byte
}

// NewBitWriter initializes a new bit writer to write to the passed in interface
// using WriteAt to write the appropriate offsets and values.
func NewBitWriter(w WriterAtWithLen) *BitWriter {
	return &BitWriter{wr: w}
}

// SkipBytes reserves the next aligned nbytes, skipping them and returning
// the offset to use with WriteAt to write to those reserved bytes. Used for
// RLE encoding to fill in the indicators after encoding.
func (b *BitWriter) SkipBytes(nbytes int) (int, error) {
	b.Flush(true)
	ret := b.byteoffset
	b.byteoffset += nbytes
	b.wr.Reserve(b.byteoffset)
	return ret, nil
}

// WriteAt fulfills the io.WriterAt interface to write len(p) bytes from p
// to the underlying byte slice starting at offset off. It returns the number
// of bytes written from p (0 <= n <= len(p)) and any error encountered.
// This allows writing full bytes directly to the underlying writer.
func (b *BitWriter) WriteAt(val []byte, off int64) (int, error) {
	return b.wr.WriteAt(val, off)
}

// Written returns the number of bytes that have been written to the BitWriter,
// not how many bytes have been flushed. Use Flush to ensure that all data is flushed
// to the underlying writer.
func (b *BitWriter) Written() int {
	return b.byteoffset + int(bitutil.BytesForBits(int64(b.bitoffset)))
}

// WriteValue writes the value v using nbits to pack it, returning false if it fails
// for some reason.
func (b *BitWriter) WriteValue(v uint64, nbits uint) error {
	b.buffer |= v << b.bitoffset
	b.bitoffset += nbits

	if b.bitoffset >= 64 {
		binary.LittleEndian.PutUint64(b.raw[:], b.buffer)
		if _, err := b.wr.WriteAt(b.raw[:], int64(b.byteoffset)); err != nil {
			return err
		}
		b.buffer = 0
		b.byteoffset += 8
		b.bitoffset -= 64
		b.buffer = v >> (nbits - b.bitoffset)
	}
	return nil
}

// Flush will flush any buffered data to the underlying writer, pass true if
// the next write should be byte-aligned after this flush.
func (b *BitWriter) Flush(align bool) {
	var nbytes int64
	if b.bitoffset > 0 {
		nbytes = bitutil.BytesForBits(int64(b.bitoffset))
		binary.LittleEndian.PutUint64(b.raw[:], b.buffer)
		b.wr.WriteAt(b.raw[:nbytes], int64(b.byteoffset))
	}

	if align {
		b.buffer = 0
		b.byteoffset += int(nbytes)
		b.bitoffset = 0
	}
}

// WriteAligned writes the value val as a little endian value in exactly nbytes
// byte-aligned to the underlying writer, flushing via Flush(true) before writing nbytes
// without buffering.
func (b *BitWriter) WriteAligned(val uint64, nbytes int) bool {
	b.Flush(true)
	binary.LittleEndian.PutUint64(b.raw[:], val)
	if _, err := b.wr.WriteAt(b.raw[:nbytes], int64(b.byteoffset)); err != nil {
		log.Println(err)
		return false
	}
	b.byteoffset += nbytes
	return true
}

// WriteVlqInt writes v as a vlq encoded integer byte-aligned to the underlying writer
// without buffering.
func (b *BitWriter) WriteVlqInt(v uint64) bool {
	b.Flush(true)
	nbytes := binary.PutUvarint(b.buf[:], v)
	if _, err := b.wr.WriteAt(b.buf[:nbytes], int64(b.byteoffset)); err != nil {
		log.Println(err)
		return false
	}
	b.byteoffset += nbytes
	return true
}

// WriteZigZagVlqInt writes a zigzag encoded integer byte-aligned to the underlying writer
// without buffering.
func (b *BitWriter) WriteZigZagVlqInt(v int64) bool {
	return b.WriteVlqInt(uint64((v << 1) ^ (v >> 63)))
}

// Clear resets the writer so that subsequent writes will start from offset 0,
// allowing reuse of the underlying buffer and writer.
func (b *BitWriter) Clear() {
	b.byteoffset = 0
	b.bitoffset = 0
	b.buffer = 0
}
