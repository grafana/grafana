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

package bitutil

import (
	"bytes"
	"errors"
	"math/bits"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow/endian"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

// BitmapReader is a simple bitmap reader for a byte slice.
type BitmapReader struct {
	bitmap []byte
	pos    int
	len    int

	current    byte
	byteOffset int
	bitOffset  int
}

// NewBitmapReader creates and returns a new bitmap reader for the given bitmap
func NewBitmapReader(bitmap []byte, offset, length int) *BitmapReader {
	curbyte := byte(0)
	if length > 0 && bitmap != nil {
		curbyte = bitmap[offset/8]
	}
	return &BitmapReader{
		bitmap:     bitmap,
		byteOffset: offset / 8,
		bitOffset:  offset % 8,
		current:    curbyte,
		len:        length,
	}
}

// Set returns true if the current bit is set
func (b *BitmapReader) Set() bool {
	return (b.current & (1 << b.bitOffset)) != 0
}

// NotSet returns true if the current bit is not set
func (b *BitmapReader) NotSet() bool {
	return (b.current & (1 << b.bitOffset)) == 0
}

// Next advances the reader to the next bit in the bitmap.
func (b *BitmapReader) Next() {
	b.bitOffset++
	b.pos++
	if b.bitOffset == 8 {
		b.bitOffset = 0
		b.byteOffset++
		if b.pos < b.len {
			b.current = b.bitmap[int(b.byteOffset)]
		}
	}
}

// Pos returns the current bit position in the bitmap that the reader is looking at
func (b *BitmapReader) Pos() int { return b.pos }

// Len returns the total number of bits in the bitmap
func (b *BitmapReader) Len() int { return b.len }

// BitmapWriter is a simple writer for writing bitmaps to byte slices
type BitmapWriter struct {
	buf    []byte
	pos    int
	length int

	curByte    uint8
	bitMask    uint8
	byteOffset int
}

// NewBitmapWriter returns a sequential bitwise writer that preserves surrounding
// bit values as it writes.
func NewBitmapWriter(bitmap []byte, start, length int) *BitmapWriter {
	ret := &BitmapWriter{
		buf:        bitmap,
		length:     length,
		byteOffset: start / 8,
		bitMask:    BitMask[start%8],
	}
	if length > 0 {
		ret.curByte = bitmap[int(ret.byteOffset)]
	}
	return ret
}

// Reset resets the position and view of the slice to restart writing a bitmap
// to the same byte slice.
func (b *BitmapWriter) Reset(start, length int) {
	b.pos = 0
	b.byteOffset = start / 8
	b.bitMask = BitMask[start%8]
	b.length = length
	if b.length > 0 {
		b.curByte = b.buf[int(b.byteOffset)]
	}
}

func (b *BitmapWriter) Pos() int { return b.pos }
func (b *BitmapWriter) Set()     { b.curByte |= b.bitMask }
func (b *BitmapWriter) Clear()   { b.curByte &= ^b.bitMask }

// Next increments the writer to the next bit for writing.
func (b *BitmapWriter) Next() {
	b.bitMask = b.bitMask << 1
	b.pos++
	if b.bitMask == 0 {
		b.bitMask = 0x01
		b.buf[b.byteOffset] = b.curByte
		b.byteOffset++
		if b.pos < b.length {
			b.curByte = b.buf[int(b.byteOffset)]
		}
	}
}

// AppendBools writes a series of booleans to the bitmapwriter and returns
// the number of remaining bytes left in the buffer for writing.
func (b *BitmapWriter) AppendBools(in []bool) int {
	space := min(b.length-b.pos, len(in))
	if space == 0 {
		return 0
	}

	bitOffset := bits.TrailingZeros32(uint32(b.bitMask))
	// location that the first byte needs to be written to for appending
	appslice := b.buf[int(b.byteOffset) : b.byteOffset+int(BytesForBits(int64(bitOffset+space)))]
	// update everything but curByte
	appslice[0] = b.curByte
	for i, b := range in[:space] {
		if b {
			SetBit(appslice, i+bitOffset)
		} else {
			ClearBit(appslice, i+bitOffset)
		}
	}

	b.pos += space
	b.bitMask = BitMask[(bitOffset+space)%8]
	b.byteOffset += (bitOffset + space) / 8
	b.curByte = appslice[len(appslice)-1]

	return space
}

// Finish flushes the final byte out to the byteslice in case it was not already
// on a byte aligned boundary.
func (b *BitmapWriter) Finish() {
	if b.length > 0 && (b.bitMask != 0x01 || b.pos < b.length) {
		b.buf[int(b.byteOffset)] = b.curByte
	}
}

// BitmapWordReader is a reader for bitmaps that reads a word at a time (a word being an 8 byte uint64)
// and then provides functions to grab the individual trailing bytes after the last word
type BitmapWordReader struct {
	bitmap        []byte
	offset        int
	nwords        int
	trailingBits  int
	trailingBytes int
	curword       uint64
}

// NewBitmapWordReader sets up a word reader, calculates the number of trailing bits and
// number of trailing bytes, along with the number of words.
func NewBitmapWordReader(bitmap []byte, offset, length int) *BitmapWordReader {
	bitoffset := offset % 8
	byteOffset := offset / 8
	bm := &BitmapWordReader{
		offset: bitoffset,
		bitmap: bitmap[byteOffset : byteOffset+int(BytesForBits(int64(bitoffset+length)))],
		// decrement wordcount by 1 as we may touch two adjacent words in one iteration
		nwords: length/int(unsafe.Sizeof(uint64(0))*8) - 1,
	}
	if bm.nwords < 0 {
		bm.nwords = 0
	}
	bm.trailingBits = length - bm.nwords*int(unsafe.Sizeof(uint64(0)))*8
	bm.trailingBytes = int(BytesForBits(int64(bm.trailingBits)))

	if bm.nwords > 0 {
		bm.curword = toFromLEFunc(endian.Native.Uint64(bm.bitmap))
	} else if length > 0 {
		setLSB(&bm.curword, bm.bitmap[0])
	}
	return bm
}

// NextWord returns the next full word read from the bitmap, should not be called
// if Words() is 0 as it will step outside of the bounds of the bitmap slice and panic.
//
// We don't perform the bounds checking in order to improve performance.
func (bm *BitmapWordReader) NextWord() uint64 {
	bm.bitmap = bm.bitmap[unsafe.Sizeof(bm.curword):]
	word := bm.curword
	nextWord := toFromLEFunc(endian.Native.Uint64(bm.bitmap))
	if bm.offset != 0 {
		// combine two adjacent words into one word
		// |<------ next ----->|<---- current ---->|
		// +-------------+-----+-------------+-----+
		// |     ---     |  A  |      B      | --- |
		// +-------------+-----+-------------+-----+
		//                  |         |       offset
		//                  v         v
		//               +-----+-------------+
		//               |  A  |      B      |
		//               +-----+-------------+
		//               |<------ word ----->|
		word >>= uint64(bm.offset)
		word |= nextWord << (int64(unsafe.Sizeof(uint64(0))*8) - int64(bm.offset))
	}
	bm.curword = nextWord
	return word
}

// NextTrailingByte returns the next trailing byte of the bitmap after the last word
// along with the number of valid bits in that byte. When validBits < 8, that
// is the last byte.
//
// If the bitmap ends on a byte alignment, then the last byte can also return 8 valid bits.
// Thus the TrailingBytes function should be used to know how many trailing bytes to read.
func (bm *BitmapWordReader) NextTrailingByte() (val byte, validBits int) {
	debug.Assert(bm.trailingBits > 0, "next trailing byte called with no trailing bits")

	if bm.trailingBits <= 8 {
		// last byte
		validBits = bm.trailingBits
		bm.trailingBits = 0
		rdr := NewBitmapReader(bm.bitmap, bm.offset, validBits)
		for i := 0; i < validBits; i++ {
			val >>= 1
			if rdr.Set() {
				val |= 0x80
			}
			rdr.Next()
		}
		val >>= (8 - validBits)
		return
	}

	bm.bitmap = bm.bitmap[1:]
	nextByte := bm.bitmap[0]
	val = getLSB(bm.curword)
	if bm.offset != 0 {
		val >>= byte(bm.offset)
		val |= nextByte << (8 - bm.offset)
	}
	setLSB(&bm.curword, nextByte)
	bm.trailingBits -= 8
	bm.trailingBytes--
	validBits = 8
	return
}

func (bm *BitmapWordReader) Words() int         { return bm.nwords }
func (bm *BitmapWordReader) TrailingBytes() int { return bm.trailingBytes }

// BitmapWordWriter is a bitmap writer for writing a full word at a time (a word being
// a uint64). After the last full word is written, PutNextTrailingByte can be used to
// write the remaining trailing bytes.
type BitmapWordWriter struct {
	bitmap []byte
	offset int
	len    int

	bitMask     uint64
	currentWord uint64
}

// NewBitmapWordWriter initializes a new bitmap word writer which will start writing
// into the byte slice at bit offset start, expecting to write len bits.
func NewBitmapWordWriter(bitmap []byte, start, len int) *BitmapWordWriter {
	ret := &BitmapWordWriter{
		bitmap:  bitmap[start/8:],
		len:     len,
		offset:  start % 8,
		bitMask: (uint64(1) << uint64(start%8)) - 1,
	}

	if ret.offset != 0 {
		if ret.len >= int(unsafe.Sizeof(uint64(0))*8) {
			ret.currentWord = toFromLEFunc(endian.Native.Uint64(ret.bitmap))
		} else if ret.len > 0 {
			setLSB(&ret.currentWord, ret.bitmap[0])
		}
	}
	return ret
}

// PutNextWord writes the given word to the bitmap, potentially splitting across
// two adjacent words.
func (bm *BitmapWordWriter) PutNextWord(word uint64) {
	sz := int(unsafe.Sizeof(word))
	if bm.offset != 0 {
		// split one word into two adjacent words, don't touch unused bits
		//               |<------ word ----->|
		//               +-----+-------------+
		//               |  A  |      B      |
		//               +-----+-------------+
		//                  |         |
		//                  v         v       offset
		// +-------------+-----+-------------+-----+
		// |     ---     |  A  |      B      | --- |
		// +-------------+-----+-------------+-----+
		// |<------ next ----->|<---- current ---->|
		word = (word << uint64(bm.offset)) | (word >> (int64(sz*8) - int64(bm.offset)))
		next := toFromLEFunc(endian.Native.Uint64(bm.bitmap[sz:]))
		bm.currentWord = (bm.currentWord & bm.bitMask) | (word &^ bm.bitMask)
		next = (next &^ bm.bitMask) | (word & bm.bitMask)
		endian.Native.PutUint64(bm.bitmap, toFromLEFunc(bm.currentWord))
		endian.Native.PutUint64(bm.bitmap[sz:], toFromLEFunc(next))
		bm.currentWord = next
	} else {
		endian.Native.PutUint64(bm.bitmap, toFromLEFunc(word))
	}
	bm.bitmap = bm.bitmap[sz:]
}

// PutNextTrailingByte writes the number of bits indicated by validBits from b to
// the bitmap.
func (bm *BitmapWordWriter) PutNextTrailingByte(b byte, validBits int) {
	curbyte := getLSB(bm.currentWord)
	if validBits == 8 {
		if bm.offset != 0 {
			b = (b << bm.offset) | (b >> (8 - bm.offset))
			next := bm.bitmap[1]
			curbyte = (curbyte & byte(bm.bitMask)) | (b &^ byte(bm.bitMask))
			next = (next &^ byte(bm.bitMask)) | (b & byte(bm.bitMask))
			bm.bitmap[0] = curbyte
			bm.bitmap[1] = next
			bm.currentWord = uint64(next)
		} else {
			bm.bitmap[0] = b
		}
		bm.bitmap = bm.bitmap[1:]
	} else {
		debug.Assert(validBits > 0 && validBits < 8, "invalid valid bits in bitmap word writer")
		debug.Assert(BytesForBits(int64(bm.offset+validBits)) <= int64(len(bm.bitmap)), "writing trailing byte outside of bounds of bitmap")
		wr := NewBitmapWriter(bm.bitmap, int(bm.offset), validBits)
		for i := 0; i < validBits; i++ {
			if b&0x01 != 0 {
				wr.Set()
			} else {
				wr.Clear()
			}
			wr.Next()
			b >>= 1
		}
		wr.Finish()
	}
}

type transferMode int8

const (
	transferCopy transferMode = iota
	transferInvert
)

func transferBitmap(mode transferMode, src []byte, srcOffset, length int, dst []byte, dstOffset int) {
	if length == 0 {
		// if there's nothing to write, end early.
		return
	}

	bitOffset := srcOffset % 8
	destBitOffset := dstOffset % 8

	// slow path, one of the bitmaps are not byte aligned.
	if bitOffset != 0 || destBitOffset != 0 {
		rdr := NewBitmapWordReader(src, srcOffset, length)
		wr := NewBitmapWordWriter(dst, dstOffset, length)

		nwords := rdr.Words()
		for nwords > 0 {
			nwords--
			if mode == transferInvert {
				wr.PutNextWord(^rdr.NextWord())
			} else {
				wr.PutNextWord(rdr.NextWord())
			}
		}
		nbytes := rdr.TrailingBytes()
		for nbytes > 0 {
			nbytes--
			bt, validBits := rdr.NextTrailingByte()
			if mode == transferInvert {
				bt = ^bt
			}
			wr.PutNextTrailingByte(bt, validBits)
		}
		return
	}

	// fast path, both are starting with byte-aligned bitmaps
	nbytes := int(BytesForBits(int64(length)))

	// shift by its byte offset
	src = src[srcOffset/8:]
	dst = dst[dstOffset/8:]

	// Take care of the trailing bits in the last byte
	// E.g., if trailing_bits = 5, last byte should be
	// - low  3 bits: new bits from last byte of data buffer
	// - high 5 bits: old bits from last byte of dest buffer
	trailingBits := nbytes*8 - length
	trailMask := byte(uint(1)<<(8-trailingBits)) - 1
	var lastData byte
	if mode == transferInvert {
		for i, b := range src[:nbytes-1] {
			dst[i] = ^b
		}
		lastData = ^src[nbytes-1]
	} else {
		copy(dst, src[:nbytes-1])
		lastData = src[nbytes-1]
	}

	dst[nbytes-1] &= ^trailMask
	dst[nbytes-1] |= lastData & trailMask
}

// CopyBitmap copies the bitmap indicated by src, starting at bit offset srcOffset,
// and copying length bits into dst, starting at bit offset dstOffset.
func CopyBitmap(src []byte, srcOffset, length int, dst []byte, dstOffset int) {
	transferBitmap(transferCopy, src, srcOffset, length, dst, dstOffset)
}

// InvertBitmap copies a bit range of a bitmap, inverting it as it copies
// over into the destination.
func InvertBitmap(src []byte, srcOffset, length int, dst []byte, dstOffset int) {
	transferBitmap(transferInvert, src, srcOffset, length, dst, dstOffset)
}

type bitOp struct {
	opWord    func(uint64, uint64) uint64
	opByte    func(byte, byte) byte
	opAligned func(l, r, o []byte)
}

var (
	bitAndOp = bitOp{
		opWord:    func(l, r uint64) uint64 { return l & r },
		opByte:    func(l, r byte) byte { return l & r },
		opAligned: alignedBitAndGo,
	}
	bitOrOp = bitOp{
		opWord:    func(l, r uint64) uint64 { return l | r },
		opByte:    func(l, r byte) byte { return l | r },
		opAligned: alignedBitOrGo,
	}
	bitAndNotOp = bitOp{
		opWord:    func(l, r uint64) uint64 { return l &^ r },
		opByte:    func(l, r byte) byte { return l &^ r },
		opAligned: alignedBitAndNotGo,
	}
	bitXorOp = bitOp{
		opWord:    func(l, r uint64) uint64 { return l ^ r },
		opByte:    func(l, r byte) byte { return l ^ r },
		opAligned: alignedBitXorGo,
	}
)

func alignedBitmapOp(op bitOp, left, right []byte, lOffset, rOffset int64, out []byte, outOffset int64, length int64) {
	debug.Assert(lOffset%8 == rOffset%8, "aligned bitmap op called with unaligned offsets")
	debug.Assert(lOffset%8 == outOffset%8, "aligned bitmap op called with unaligned output offset")

	nbytes := BytesForBits(length + lOffset%8)
	left = left[lOffset/8:]
	right = right[rOffset/8:]
	out = out[outOffset/8:]
	endMask := (lOffset + length%8)
	switch nbytes {
	case 0:
		return
	case 1: // everything within a single byte
		// (length+lOffset%8) <= 8
		mask := PrecedingBitmask[lOffset%8]
		if endMask != 0 {
			mask |= TrailingBitmask[(lOffset+length)%8]
		}
		out[0] = (out[0] & mask) | (op.opByte(left[0], right[0]) &^ mask)
	case 2: // don't send zero length to opAligned
		firstByteMask := PrecedingBitmask[lOffset%8]
		out[0] = (out[0] & firstByteMask) | (op.opByte(left[0], right[0]) &^ firstByteMask)
		lastByteMask := byte(0)
		if endMask != 0 {
			lastByteMask = TrailingBitmask[(lOffset+length)%8]
		}
		out[1] = (out[1] & lastByteMask) | (op.opByte(left[1], right[1]) &^ lastByteMask)
	default:
		firstByteMask := PrecedingBitmask[lOffset%8]
		out[0] = (out[0] & firstByteMask) | (op.opByte(left[0], right[0]) &^ firstByteMask)

		op.opAligned(left[1:nbytes-1], right[1:nbytes-1], out[1:nbytes-1])

		lastByteMask := byte(0)
		if endMask != 0 {
			lastByteMask = TrailingBitmask[(lOffset+length)%8]
		}
		out[nbytes-1] = (out[nbytes-1] & lastByteMask) | (op.opByte(left[nbytes-1], right[nbytes-1]) &^ lastByteMask)
	}
}

func unalignedBitmapOp(op bitOp, left, right []byte, lOffset, rOffset int64, out []byte, outOffset int64, length int64) {
	leftRdr := NewBitmapWordReader(left, int(lOffset), int(length))
	rightRdr := NewBitmapWordReader(right, int(rOffset), int(length))
	writer := NewBitmapWordWriter(out, int(outOffset), int(length))

	for nwords := leftRdr.Words(); nwords > 0; nwords-- {
		writer.PutNextWord(op.opWord(leftRdr.NextWord(), rightRdr.NextWord()))
	}
	for nbytes := leftRdr.TrailingBytes(); nbytes > 0; nbytes-- {
		leftByte, leftValid := leftRdr.NextTrailingByte()
		rightByte, rightValid := rightRdr.NextTrailingByte()
		debug.Assert(leftValid == rightValid, "unexpected mismatch of valid bits")
		writer.PutNextTrailingByte(op.opByte(leftByte, rightByte), leftValid)
	}
}

func BitmapOp(op bitOp, left, right []byte, lOffset, rOffset int64, out []byte, outOffset, length int64) {
	if (outOffset%8 == lOffset%8) && (outOffset%8 == rOffset%8) {
		// fastcase!
		alignedBitmapOp(op, left, right, lOffset, rOffset, out, outOffset, length)
	} else {
		unalignedBitmapOp(op, left, right, lOffset, rOffset, out, outOffset, length)
	}
}

func BitmapOpAlloc(mem memory.Allocator, op bitOp, left, right []byte, lOffset, rOffset int64, length int64, outOffset int64) *memory.Buffer {
	bits := length + outOffset
	buf := memory.NewResizableBuffer(mem)
	buf.Resize(int(BytesForBits(bits)))
	BitmapOp(op, left, right, lOffset, rOffset, buf.Bytes(), outOffset, length)
	return buf
}

func BitmapAnd(left, right []byte, lOffset, rOffset int64, out []byte, outOffset int64, length int64) {
	BitmapOp(bitAndOp, left, right, lOffset, rOffset, out, outOffset, length)
}

func BitmapOr(left, right []byte, lOffset, rOffset int64, out []byte, outOffset int64, length int64) {
	BitmapOp(bitOrOp, left, right, lOffset, rOffset, out, outOffset, length)
}

func BitmapAndAlloc(mem memory.Allocator, left, right []byte, lOffset, rOffset int64, length, outOffset int64) *memory.Buffer {
	return BitmapOpAlloc(mem, bitAndOp, left, right, lOffset, rOffset, length, outOffset)
}

func BitmapOrAlloc(mem memory.Allocator, left, right []byte, lOffset, rOffset int64, length, outOffset int64) *memory.Buffer {
	return BitmapOpAlloc(mem, bitOrOp, left, right, lOffset, rOffset, length, outOffset)
}

func BitmapAndNot(left, right []byte, lOffset, rOffset int64, out []byte, outOffset int64, length int64) {
	BitmapOp(bitAndNotOp, left, right, lOffset, rOffset, out, outOffset, length)
}

func BitmapAndNotAlloc(mem memory.Allocator, left, right []byte, lOffset, rOffset int64, length, outOffset int64) *memory.Buffer {
	return BitmapOpAlloc(mem, bitAndNotOp, left, right, lOffset, rOffset, length, outOffset)
}

func BitmapXor(left, right []byte, lOffset, rOffset int64, out []byte, outOffset int64, length int64) {
	BitmapOp(bitXorOp, left, right, lOffset, rOffset, out, outOffset, length)
}

func BitmapXorAlloc(mem memory.Allocator, left, right []byte, lOffset, rOffset int64, length, outOffset int64) *memory.Buffer {
	return BitmapOpAlloc(mem, bitXorOp, left, right, lOffset, rOffset, length, outOffset)
}

func BitmapEquals(left, right []byte, lOffset, rOffset int64, length int64) bool {
	if lOffset%8 == 0 && rOffset%8 == 0 {
		// byte aligned, fast path, can use bytes.Equal (memcmp)
		byteLen := length / 8
		lStart := lOffset / 8
		rStart := rOffset / 8
		if !bytes.Equal(left[lStart:lStart+byteLen], right[rStart:rStart+byteLen]) {
			return false
		}

		// check trailing bits
		for i := (length / 8) * 8; i < length; i++ {
			if BitIsSet(left, int(lOffset+i)) != BitIsSet(right, int(rOffset+i)) {
				return false
			}
		}
		return true
	}

	lrdr := NewBitmapWordReader(left, int(lOffset), int(length))
	rrdr := NewBitmapWordReader(right, int(rOffset), int(length))

	nwords := lrdr.Words()
	for nwords > 0 {
		nwords--
		if lrdr.NextWord() != rrdr.NextWord() {
			return false
		}
	}

	nbytes := lrdr.TrailingBytes()
	for nbytes > 0 {
		nbytes--
		lbt, _ := lrdr.NextTrailingByte()
		rbt, _ := rrdr.NextTrailingByte()
		if lbt != rbt {
			return false
		}
	}
	return true
}

// OptionalBitIndexer is a convenience wrapper for getting bits from
// a bitmap which may or may not be nil.
type OptionalBitIndexer struct {
	Bitmap []byte
	Offset int
}

func (b *OptionalBitIndexer) GetBit(i int) bool {
	return b.Bitmap == nil || BitIsSet(b.Bitmap, b.Offset+i)
}

type Bitmap struct {
	Data        []byte
	Offset, Len int64
}

func bitLength(bitmaps []Bitmap) (int64, error) {
	for _, b := range bitmaps[1:] {
		if b.Len != bitmaps[0].Len {
			return -1, errors.New("bitmaps must be same length")
		}
	}
	return bitmaps[0].Len, nil
}

func runVisitWordsAndWriteLoop(bitLen int64, rdrs []*BitmapWordReader, wrs []*BitmapWordWriter, visitor func(in, out []uint64)) {
	const bitWidth int64 = int64(uint64SizeBits)

	visited := make([]uint64, len(rdrs))
	output := make([]uint64, len(wrs))

	// every reader will have same number of words, since they are same
	// length'ed. This will be inefficient in some cases. When there's
	// offsets beyond the Word boundary, every word would have to be
	// created from 2 adjoining words
	nwords := int64(rdrs[0].Words())
	bitLen -= nwords * bitWidth
	for nwords > 0 {
		nwords--
		for i := range visited {
			visited[i] = rdrs[i].NextWord()
		}
		visitor(visited, output)
		for i := range output {
			wrs[i].PutNextWord(output[i])
		}
	}

	// every reader will have the same number of trailing bytes, because
	// we already confirmed they have the same length. Because
	// offsets beyond the Word boundary can cause adjoining words, the
	// tailing portion could be more than one word remaining full/partial
	// words to write.
	if bitLen == 0 {
		return
	}

	// convert the word visitor to a bytevisitor
	byteVisitor := func(in, out []byte) {
		for i, w := range in {
			visited[i] = uint64(w)
		}
		visitor(visited, output)
		for i, w := range output {
			out[i] = byte(w)
		}
	}

	visitedBytes := make([]byte, len(rdrs))
	outputBytes := make([]byte, len(wrs))
	nbytes := rdrs[0].trailingBytes
	for nbytes > 0 {
		nbytes--
		memory.Set(visitedBytes, 0)
		memory.Set(outputBytes, 0)

		var validBits int
		for i := range rdrs {
			visitedBytes[i], validBits = rdrs[i].NextTrailingByte()
		}
		byteVisitor(visitedBytes, outputBytes)
		for i, w := range outputBytes {
			wrs[i].PutNextTrailingByte(w, validBits)
		}
	}
}

// VisitWordsAndWrite visits words of bits from each input bitmap and
// collects outputs to a slice of output Bitmaps.
//
// All bitmaps must have identical lengths. The first bit in a visited
// bitmap may be offset within the first visited word, but words will
// otherwise contain densely packed bits loaded from the bitmap. That
// offset within the first word is returned.
//
// NOTE: this function is efficient on 3+ sufficiently large bitmaps.
// It also has a large prolog/epilog overhead and should be used
// carefully in other cases. For 2 or fewer bitmaps, and/or smaller
// bitmaps, try BitmapReader and or other utilities.
func VisitWordsAndWrite(args []Bitmap, out []Bitmap, visitor func(in, out []uint64)) error {
	bitLen, err := bitLength(args)
	if err != nil {
		return err
	}

	rdrs, wrs := make([]*BitmapWordReader, len(args)), make([]*BitmapWordWriter, len(out))
	for i, in := range args {
		rdrs[i] = NewBitmapWordReader(in.Data, int(in.Offset), int(in.Len))
	}
	for i, o := range out {
		wrs[i] = NewBitmapWordWriter(o.Data, int(o.Offset), int(o.Len))
	}
	runVisitWordsAndWriteLoop(bitLen, rdrs, wrs, visitor)
	return nil
}
