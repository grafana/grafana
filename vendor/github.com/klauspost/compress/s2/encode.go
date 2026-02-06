// Copyright 2011 The Snappy-Go Authors. All rights reserved.
// Copyright (c) 2019 Klaus Post. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package s2

import (
	"encoding/binary"
	"math"
	"math/bits"
	"sync"

	"github.com/klauspost/compress/internal/race"
)

// Encode returns the encoded form of src. The returned slice may be a sub-
// slice of dst if dst was large enough to hold the entire encoded block.
// Otherwise, a newly allocated slice will be returned.
//
// The dst and src must not overlap. It is valid to pass a nil dst.
//
// The blocks will require the same amount of memory to decode as encoding,
// and does not make for concurrent decoding.
// Also note that blocks do not contain CRC information, so corruption may be undetected.
//
// If you need to encode larger amounts of data, consider using
// the streaming interface which gives all of these features.
func Encode(dst, src []byte) []byte {
	if n := MaxEncodedLen(len(src)); n < 0 {
		panic(ErrTooLarge)
	} else if cap(dst) < n {
		dst = make([]byte, n)
	} else {
		dst = dst[:n]
	}

	// The block starts with the varint-encoded length of the decompressed bytes.
	d := binary.PutUvarint(dst, uint64(len(src)))

	if len(src) == 0 {
		return dst[:d]
	}
	if len(src) < minNonLiteralBlockSize {
		d += emitLiteral(dst[d:], src)
		return dst[:d]
	}
	n := encodeBlock(dst[d:], src)
	if n > 0 {
		d += n
		return dst[:d]
	}
	// Not compressible
	d += emitLiteral(dst[d:], src)
	return dst[:d]
}

var estblockPool [2]sync.Pool

// EstimateBlockSize will perform a very fast compression
// without outputting the result and return the compressed output size.
// The function returns -1 if no improvement could be achieved.
// Using actual compression will most often produce better compression than the estimate.
func EstimateBlockSize(src []byte) (d int) {
	if len(src) <= inputMargin || int64(len(src)) > 0xffffffff {
		return -1
	}
	if len(src) <= 1024 {
		const sz, pool = 2048, 0
		tmp, ok := estblockPool[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer estblockPool[pool].Put(tmp)

		d = calcBlockSizeSmall(src, tmp)
	} else {
		const sz, pool = 32768, 1
		tmp, ok := estblockPool[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer estblockPool[pool].Put(tmp)

		d = calcBlockSize(src, tmp)
	}

	if d == 0 {
		return -1
	}
	// Size of the varint encoded block size.
	d += (bits.Len64(uint64(len(src))) + 7) / 7

	if d >= len(src) {
		return -1
	}
	return d
}

// EncodeBetter returns the encoded form of src. The returned slice may be a sub-
// slice of dst if dst was large enough to hold the entire encoded block.
// Otherwise, a newly allocated slice will be returned.
//
// EncodeBetter compresses better than Encode but typically with a
// 10-40% speed decrease on both compression and decompression.
//
// The dst and src must not overlap. It is valid to pass a nil dst.
//
// The blocks will require the same amount of memory to decode as encoding,
// and does not make for concurrent decoding.
// Also note that blocks do not contain CRC information, so corruption may be undetected.
//
// If you need to encode larger amounts of data, consider using
// the streaming interface which gives all of these features.
func EncodeBetter(dst, src []byte) []byte {
	if n := MaxEncodedLen(len(src)); n < 0 {
		panic(ErrTooLarge)
	} else if cap(dst) < n {
		dst = make([]byte, n)
	} else {
		dst = dst[:n]
	}

	// The block starts with the varint-encoded length of the decompressed bytes.
	d := binary.PutUvarint(dst, uint64(len(src)))

	if len(src) == 0 {
		return dst[:d]
	}
	if len(src) < minNonLiteralBlockSize {
		d += emitLiteral(dst[d:], src)
		return dst[:d]
	}
	n := encodeBlockBetter(dst[d:], src)
	if n > 0 {
		d += n
		return dst[:d]
	}
	// Not compressible
	d += emitLiteral(dst[d:], src)
	return dst[:d]
}

// EncodeBest returns the encoded form of src. The returned slice may be a sub-
// slice of dst if dst was large enough to hold the entire encoded block.
// Otherwise, a newly allocated slice will be returned.
//
// EncodeBest compresses as good as reasonably possible but with a
// big speed decrease.
//
// The dst and src must not overlap. It is valid to pass a nil dst.
//
// The blocks will require the same amount of memory to decode as encoding,
// and does not make for concurrent decoding.
// Also note that blocks do not contain CRC information, so corruption may be undetected.
//
// If you need to encode larger amounts of data, consider using
// the streaming interface which gives all of these features.
func EncodeBest(dst, src []byte) []byte {
	if n := MaxEncodedLen(len(src)); n < 0 {
		panic(ErrTooLarge)
	} else if cap(dst) < n {
		dst = make([]byte, n)
	} else {
		dst = dst[:n]
	}

	// The block starts with the varint-encoded length of the decompressed bytes.
	d := binary.PutUvarint(dst, uint64(len(src)))

	if len(src) == 0 {
		return dst[:d]
	}
	if len(src) < minNonLiteralBlockSize {
		d += emitLiteral(dst[d:], src)
		return dst[:d]
	}
	n := encodeBlockBest(dst[d:], src, nil)
	if n > 0 {
		d += n
		return dst[:d]
	}
	// Not compressible
	d += emitLiteral(dst[d:], src)
	return dst[:d]
}

// EncodeSnappy returns the encoded form of src. The returned slice may be a sub-
// slice of dst if dst was large enough to hold the entire encoded block.
// Otherwise, a newly allocated slice will be returned.
//
// The output is Snappy compatible and will likely decompress faster.
//
// The dst and src must not overlap. It is valid to pass a nil dst.
//
// The blocks will require the same amount of memory to decode as encoding,
// and does not make for concurrent decoding.
// Also note that blocks do not contain CRC information, so corruption may be undetected.
//
// If you need to encode larger amounts of data, consider using
// the streaming interface which gives all of these features.
func EncodeSnappy(dst, src []byte) []byte {
	if n := MaxEncodedLen(len(src)); n < 0 {
		panic(ErrTooLarge)
	} else if cap(dst) < n {
		dst = make([]byte, n)
	} else {
		dst = dst[:n]
	}

	// The block starts with the varint-encoded length of the decompressed bytes.
	d := binary.PutUvarint(dst, uint64(len(src)))

	if len(src) == 0 {
		return dst[:d]
	}
	if len(src) < minNonLiteralBlockSize {
		d += emitLiteral(dst[d:], src)
		return dst[:d]
	}

	n := encodeBlockSnappy(dst[d:], src)
	if n > 0 {
		d += n
		return dst[:d]
	}
	// Not compressible
	d += emitLiteral(dst[d:], src)
	return dst[:d]
}

// EncodeSnappyBetter returns the encoded form of src. The returned slice may be a sub-
// slice of dst if dst was large enough to hold the entire encoded block.
// Otherwise, a newly allocated slice will be returned.
//
// The output is Snappy compatible and will likely decompress faster.
//
// The dst and src must not overlap. It is valid to pass a nil dst.
//
// The blocks will require the same amount of memory to decode as encoding,
// and does not make for concurrent decoding.
// Also note that blocks do not contain CRC information, so corruption may be undetected.
//
// If you need to encode larger amounts of data, consider using
// the streaming interface which gives all of these features.
func EncodeSnappyBetter(dst, src []byte) []byte {
	if n := MaxEncodedLen(len(src)); n < 0 {
		panic(ErrTooLarge)
	} else if cap(dst) < n {
		dst = make([]byte, n)
	} else {
		dst = dst[:n]
	}

	// The block starts with the varint-encoded length of the decompressed bytes.
	d := binary.PutUvarint(dst, uint64(len(src)))

	if len(src) == 0 {
		return dst[:d]
	}
	if len(src) < minNonLiteralBlockSize {
		d += emitLiteral(dst[d:], src)
		return dst[:d]
	}

	n := encodeBlockBetterSnappy(dst[d:], src)
	if n > 0 {
		d += n
		return dst[:d]
	}
	// Not compressible
	d += emitLiteral(dst[d:], src)
	return dst[:d]
}

// EncodeSnappyBest returns the encoded form of src. The returned slice may be a sub-
// slice of dst if dst was large enough to hold the entire encoded block.
// Otherwise, a newly allocated slice will be returned.
//
// The output is Snappy compatible and will likely decompress faster.
//
// The dst and src must not overlap. It is valid to pass a nil dst.
//
// The blocks will require the same amount of memory to decode as encoding,
// and does not make for concurrent decoding.
// Also note that blocks do not contain CRC information, so corruption may be undetected.
//
// If you need to encode larger amounts of data, consider using
// the streaming interface which gives all of these features.
func EncodeSnappyBest(dst, src []byte) []byte {
	if n := MaxEncodedLen(len(src)); n < 0 {
		panic(ErrTooLarge)
	} else if cap(dst) < n {
		dst = make([]byte, n)
	} else {
		dst = dst[:n]
	}

	// The block starts with the varint-encoded length of the decompressed bytes.
	d := binary.PutUvarint(dst, uint64(len(src)))

	if len(src) == 0 {
		return dst[:d]
	}
	if len(src) < minNonLiteralBlockSize {
		d += emitLiteral(dst[d:], src)
		return dst[:d]
	}

	n := encodeBlockBestSnappy(dst[d:], src)
	if n > 0 {
		d += n
		return dst[:d]
	}
	// Not compressible
	d += emitLiteral(dst[d:], src)
	return dst[:d]
}

// ConcatBlocks will concatenate the supplied blocks and append them to the supplied destination.
// If the destination is nil or too small, a new will be allocated.
// The blocks are not validated, so garbage in = garbage out.
// dst may not overlap block data.
// Any data in dst is preserved as is, so it will not be considered a block.
func ConcatBlocks(dst []byte, blocks ...[]byte) ([]byte, error) {
	totalSize := uint64(0)
	compSize := 0
	for _, b := range blocks {
		l, hdr, err := decodedLen(b)
		if err != nil {
			return nil, err
		}
		totalSize += uint64(l)
		compSize += len(b) - hdr
	}
	if totalSize == 0 {
		dst = append(dst, 0)
		return dst, nil
	}
	if totalSize > math.MaxUint32 {
		return nil, ErrTooLarge
	}
	var tmp [binary.MaxVarintLen32]byte
	hdrSize := binary.PutUvarint(tmp[:], totalSize)
	wantSize := hdrSize + compSize

	if cap(dst)-len(dst) < wantSize {
		dst = append(make([]byte, 0, wantSize+len(dst)), dst...)
	}
	dst = append(dst, tmp[:hdrSize]...)
	for _, b := range blocks {
		_, hdr, err := decodedLen(b)
		if err != nil {
			return nil, err
		}
		dst = append(dst, b[hdr:]...)
	}
	return dst, nil
}

// inputMargin is the minimum number of extra input bytes to keep, inside
// encodeBlock's inner loop. On some architectures, this margin lets us
// implement a fast path for emitLiteral, where the copy of short (<= 16 byte)
// literals can be implemented as a single load to and store from a 16-byte
// register. That literal's actual length can be as short as 1 byte, so this
// can copy up to 15 bytes too much, but that's OK as subsequent iterations of
// the encoding loop will fix up the copy overrun, and this inputMargin ensures
// that we don't overrun the dst and src buffers.
const inputMargin = 8

// minNonLiteralBlockSize is the minimum size of the input to encodeBlock that
// will be accepted by the encoder.
const minNonLiteralBlockSize = 32

const intReduction = 2 - (1 << (^uint(0) >> 63)) // 1 (32 bits) or 0 (64 bits)

// MaxBlockSize is the maximum value where MaxEncodedLen will return a valid block size.
// Blocks this big are highly discouraged, though.
// Half the size on 32 bit systems.
const MaxBlockSize = (1<<(32-intReduction) - 1) - binary.MaxVarintLen32 - 5

// MaxEncodedLen returns the maximum length of a snappy block, given its
// uncompressed length.
//
// It will return a negative value if srcLen is too large to encode.
// 32 bit platforms will have lower thresholds for rejecting big content.
func MaxEncodedLen(srcLen int) int {
	n := uint64(srcLen)
	if intReduction == 1 {
		// 32 bits
		if n > math.MaxInt32 {
			// Also includes negative.
			return -1
		}
	} else if n > 0xffffffff {
		// 64 bits
		// Also includes negative.
		return -1
	}
	// Size of the varint encoded block size.
	n = n + uint64((bits.Len64(n)+7)/7)

	// Add maximum size of encoding block as literals.
	n += uint64(literalExtraSize(int64(srcLen)))
	if intReduction == 1 {
		// 32 bits
		if n > math.MaxInt32 {
			return -1
		}
	} else if n > 0xffffffff {
		// 64 bits
		// Also includes negative.
		return -1
	}
	return int(n)
}
