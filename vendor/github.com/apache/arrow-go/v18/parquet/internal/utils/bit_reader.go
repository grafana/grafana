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
	"errors"
	"io"
	"math"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
)

// masks for grabbing the trailing bits based on the number of trailing bits desired
var trailingMask [64]uint64

func init() {
	// generate the masks at init so we don't have to hard code them.
	for i := 0; i < 64; i++ {
		trailingMask[i] = (math.MaxUint64 >> (64 - i))
	}
}

// trailingBits returns a value constructed from the bits trailing bits of
// the value v that is passed in. If bits >= 64, then we just return v.
func trailingBits(v uint64, bits uint) uint64 {
	if bits >= 64 {
		return v
	}
	return v & trailingMask[bits]
}

// reader is a useful interface to define the functionality we need for implementation
type reader interface {
	io.Reader
	io.ReaderAt
	io.Seeker
}

// default buffer length
const buflen = 1024

// BitReader implements functionality for reading bits or bytes buffering up to a uint64
// at a time from the reader in order to improve efficiency. It also provides
// methods to read multiple bytes in one read such as encoded ints/values.
//
// This BitReader is the basis for the other utility classes like RLE decoding
// and such, providing the necessary functions for interpreting the values.
type BitReader struct {
	reader     reader
	buffer     uint64
	byteoffset int64
	bitoffset  uint
	raw        [8]byte

	unpackBuf [buflen]uint32
}

// NewBitReader takes in a reader that implements io.Reader, io.ReaderAt and io.Seeker
// interfaces and returns a BitReader for use with various bit level manipulations.
func NewBitReader(r reader) *BitReader {
	return &BitReader{reader: r}
}

// CurOffset returns the current Byte offset into the data that the reader is at.
func (b *BitReader) CurOffset() int64 {
	return b.byteoffset + bitutil.BytesForBits(int64(b.bitoffset))
}

// Reset allows reusing a BitReader by setting a new reader and resetting the internal
// state back to zeros.
func (b *BitReader) Reset(r reader) {
	b.reader = r
	b.buffer = 0
	b.byteoffset = 0
	b.bitoffset = 0
}

// GetVlqInt reads a Vlq encoded int from the stream. The encoded value must start
// at the beginning of a byte and this returns false if there weren't enough bytes
// in the buffer or reader. This will call `ReadByte` which in turn retrieves byte
// aligned values from the reader
func (b *BitReader) GetVlqInt() (uint64, bool) {
	tmp, err := binary.ReadUvarint(b)
	if err != nil {
		return 0, false
	}
	return tmp, true
}

// GetZigZagVlqInt reads a zigzag encoded integer, returning false if there weren't
// enough bytes remaining.
func (b *BitReader) GetZigZagVlqInt() (int64, bool) {
	u, ok := b.GetVlqInt()
	if !ok {
		return 0, false
	}

	return int64(u>>1) ^ -int64(u&1), true
}

// ReadByte reads a single aligned byte from the underlying stream, or populating
// error if there aren't enough bytes left.
func (b *BitReader) ReadByte() (byte, error) {
	var tmp byte
	if ok := b.getAlignedUint8(1, &tmp); !ok {
		return 0, errors.New("failed to read byte")
	}

	return tmp, nil
}

// getAlignedUint8 reads nbytes from the underlying stream into the passed uint8 value.
// Returning false if there aren't enough bytes remaining in the stream or if an invalid
// type is passed. The bytes are read aligned to byte boundaries.
func (b *BitReader) getAlignedUint8(nbytes int, v *uint8) bool {
	if nbytes > 1 {
		return false
	}

	bread := bitutil.BytesForBits(int64(b.bitoffset))
	b.byteoffset += bread
	n, err := b.reader.ReadAt(b.raw[:nbytes], b.byteoffset)
	if err != nil && err != io.EOF {
		return false
	}
	if n != nbytes {
		return false
	}

	*v = b.raw[0]

	b.byteoffset += int64(nbytes)
	b.bitoffset = 0
	b.fillbuffer()
	return true
}

// getAlignedUint16 reads nbytes from the underlying stream into the passed uint16 value.
func (b *BitReader) getAlignedUint16(nbytes int, v *uint16) bool {
	if nbytes > 2 {
		return false
	}

	bread := bitutil.BytesForBits(int64(b.bitoffset))
	b.byteoffset += bread
	n, err := b.reader.ReadAt(b.raw[:nbytes], b.byteoffset)
	if err != nil && err != io.EOF {
		return false
	}
	if n != nbytes {
		return false
	}

	// zero pad the bytes
	memory.Set(b.raw[n:2], 0)

	*v = binary.LittleEndian.Uint16(b.raw[:2])

	b.byteoffset += int64(nbytes)
	b.bitoffset = 0
	b.fillbuffer()
	return true
}

// getAlignedUint32 reads nbytes from the underlying stream into the passed uint32 value.
func (b *BitReader) getAlignedUint32(nbytes int, v *uint32) bool {
	if nbytes > 4 {
		return false
	}

	bread := bitutil.BytesForBits(int64(b.bitoffset))
	b.byteoffset += bread
	n, err := b.reader.ReadAt(b.raw[:nbytes], b.byteoffset)
	if err != nil && err != io.EOF {
		return false
	}
	if n != nbytes {
		return false
	}

	// zero pad the bytes
	memory.Set(b.raw[n:4], 0)

	*v = binary.LittleEndian.Uint32(b.raw[:4])

	b.byteoffset += int64(nbytes)
	b.bitoffset = 0
	b.fillbuffer()
	return true
}

// getAlignedUint64 reads nbytes from the underlying stream into the passed uint64 value.
func (b *BitReader) getAlignedUint64(nbytes int, v *uint64) bool {
	if nbytes > 8 {
		return false
	}

	bread := bitutil.BytesForBits(int64(b.bitoffset))
	b.byteoffset += bread
	n, err := b.reader.ReadAt(b.raw[:nbytes], b.byteoffset)
	if err != nil && err != io.EOF {
		return false
	}
	if n != nbytes {
		return false
	}

	// zero pad the bytes
	memory.Set(b.raw[n:8], 0)

	*v = binary.LittleEndian.Uint64(b.raw[:8])

	b.byteoffset += int64(nbytes)
	b.bitoffset = 0
	b.fillbuffer()
	return true
}

// fillbuffer fills the uint64 buffer with bytes from the underlying stream
func (b *BitReader) fillbuffer() error {
	n, err := b.reader.ReadAt(b.raw[:], b.byteoffset)
	if err != nil && n == 0 && err != io.EOF {
		return err
	}
	for i := n; i < 8; i++ {
		b.raw[i] = 0
	}
	b.buffer = binary.LittleEndian.Uint64(b.raw[:])
	return nil
}

// next reads an integral value from the next bits in the buffer
func (b *BitReader) next(bits uint) (v uint64, err error) {
	v = trailingBits(b.buffer, b.bitoffset+bits) >> b.bitoffset
	b.bitoffset += bits
	// if we need more bits to get what was requested then refill the buffer
	if b.bitoffset >= 64 {
		b.byteoffset += 8
		b.bitoffset -= 64
		if err = b.fillbuffer(); err != nil {
			return 0, err
		}
		v |= trailingBits(b.buffer, b.bitoffset) << (bits - b.bitoffset)
	}
	return
}

// GetBatchIndex is like GetBatch but for IndexType (used for dictionary decoding)
func (b *BitReader) GetBatchIndex(bits uint, out []IndexType) (i int, err error) {
	// IndexType is a 32-bit value so bits must be less than 32 when unpacking
	// values using the bitreader.
	if bits > 32 {
		return 0, errors.New("must be 32 bits or less per read")
	}

	var val uint64

	length := len(out)
	// if we aren't currently byte-aligned, read bits until we are byte-aligned.
	for ; i < length && b.bitoffset != 0; i++ {
		val, err = b.next(bits)
		out[i] = IndexType(val)
		if err != nil {
			return
		}
	}

	b.reader.Seek(b.byteoffset, io.SeekStart)
	// grab as many 32 byte chunks as possible in one shot
	if i < length { // IndexType should be a 32 bit value so we can do quick unpacking right into the output
		numUnpacked := unpack32(b.reader, (*(*[]uint32)(unsafe.Pointer(&out)))[i:], int(bits))
		i += numUnpacked
		b.byteoffset += int64(numUnpacked * int(bits) / 8)
	}

	// re-fill our buffer just in case.
	b.fillbuffer()
	// grab the remaining values that aren't 32 byte aligned
	for ; i < length; i++ {
		val, err = b.next(bits)
		out[i] = IndexType(val)
		if err != nil {
			break
		}
	}
	return
}

// GetBatchBools is like GetBatch but optimized for reading bits as boolean values
func (b *BitReader) GetBatchBools(out []bool) (int, error) {
	bits := uint(1)
	length := len(out)

	i := 0
	// read until we are byte-aligned
	for ; i < length && b.bitoffset != 0; i++ {
		val, err := b.next(bits)
		out[i] = val != 0
		if err != nil {
			return i, err
		}
	}

	b.reader.Seek(b.byteoffset, io.SeekStart)
	buf := arrow.Uint32Traits.CastToBytes(b.unpackBuf[:])
	blen := buflen * 8
	for i < length {
		// grab byte-aligned bits in a loop since it's more efficient than going
		// bit by bit when you can grab 8 bools at a time.
		unpackSize := utils.Min(blen, length-i) / 8 * 8
		n, err := b.reader.Read(buf[:bitutil.BytesForBits(int64(unpackSize))])
		if err != nil {
			return i, err
		}
		BytesToBools(buf[:n], out[i:])
		i += unpackSize
		b.byteoffset += int64(n)
	}

	b.fillbuffer()
	// grab the trailing bits
	for ; i < length; i++ {
		val, err := b.next(bits)
		out[i] = val != 0
		if err != nil {
			return i, err
		}
	}

	return i, nil
}

func (b *BitReader) Discard(bits uint, n int) (int, error) {
	if bits > 64 {
		return 0, errors.New("must be 64 bits or less per read")
	}

	i := 0
	for ; i < n && b.bitoffset != 0; i++ {
		if _, err := b.next(bits); err != nil {
			return i, err
		}
	}

	if n-i > 32 {
		toSkip := (n - i) / 32 * 32

		bytesToSkip := bitutil.BytesForBits(int64(toSkip * int(bits)))
		b.byteoffset += int64(bytesToSkip)
		i += toSkip
	}

	b.fillbuffer()
	for ; i < n; i++ {
		if _, err := b.next(bits); err != nil {
			return i, err
		}
	}
	return n, nil
}

// GetBatch fills out by decoding values repeated from the stream that are encoded
// using bits as the number of bits per value. The values are expected to be bit packed
// so we will unpack the values to populate.
func (b *BitReader) GetBatch(bits uint, out []uint64) (int, error) {
	// since we're unpacking into uint64 values, we can't support bits being
	// larger than 64 here as that's the largest size value we're reading
	if bits > 64 {
		return 0, errors.New("must be 64 bits or less per read")
	}

	length := len(out)

	i := 0
	// read until we are byte aligned
	for ; i < length && b.bitoffset != 0; i++ {
		val, err := b.next(bits)
		out[i] = val
		if err != nil {
			return i, err
		}
	}

	b.reader.Seek(b.byteoffset, io.SeekStart)
	for i < length {
		// unpack groups of 32 bytes at a time into a buffer since it's more efficient
		unpackSize := utils.Min(buflen, length-i)
		numUnpacked := unpack32(b.reader, b.unpackBuf[:unpackSize], int(bits))
		if numUnpacked == 0 {
			break
		}

		for k := 0; k < numUnpacked; k++ {
			out[i+k] = uint64(b.unpackBuf[k])
		}
		i += numUnpacked
		b.byteoffset += int64(numUnpacked * int(bits) / 8)
	}

	b.fillbuffer()
	// and then the remaining trailing values
	for ; i < length; i++ {
		val, err := b.next(bits)
		out[i] = val
		if err != nil {
			return i, err
		}
	}

	return i, nil
}

// GetValue returns a single value that is bit packed using width as the number of bits
// and returns false if there weren't enough bits remaining.
func (b *BitReader) GetValue(width int) (uint64, bool) {
	v := make([]uint64, 1)
	n, _ := b.GetBatch(uint(width), v)
	return v[0], n == 1
}
