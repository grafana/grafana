// Copyright 2011 The Snappy-Go Authors. All rights reserved.
// Copyright (c) 2019 Klaus Post. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package s2 implements the S2 compression format.
//
// S2 is an extension of Snappy. Similar to Snappy S2 is aimed for high throughput,
// which is why it features concurrent compression for bigger payloads.
//
// Decoding is compatible with Snappy compressed content,
// but content compressed with S2 cannot be decompressed by Snappy.
//
// For more information on Snappy/S2 differences see README in: https://github.com/klauspost/compress/tree/master/s2
//
// There are actually two S2 formats: block and stream. They are related,
// but different: trying to decompress block-compressed data as a S2 stream
// will fail, and vice versa. The block format is the Decode and Encode
// functions and the stream format is the Reader and Writer types.
//
// A "better" compression option is available. This will trade some compression
// speed
//
// The block format, the more common case, is used when the complete size (the
// number of bytes) of the original data is known upfront, at the time
// compression starts. The stream format, also known as the framing format, is
// for when that isn't always true.
//
// Blocks to not offer much data protection, so it is up to you to
// add data validation of decompressed blocks.
//
// Streams perform CRC validation of the decompressed data.
// Stream compression will also be performed on multiple CPU cores concurrently
// significantly improving throughput.
package s2

import (
	"bytes"
	"hash/crc32"

	"github.com/klauspost/compress/internal/race"
)

/*
Each encoded block begins with the varint-encoded length of the decoded data,
followed by a sequence of chunks. Chunks begin and end on byte boundaries. The
first byte of each chunk is broken into its 2 least and 6 most significant bits
called l and m: l ranges in [0, 4) and m ranges in [0, 64). l is the chunk tag.
Zero means a literal tag. All other values mean a copy tag.

For literal tags:
  - If m < 60, the next 1 + m bytes are literal bytes.
  - Otherwise, let n be the little-endian unsigned integer denoted by the next
    m - 59 bytes. The next 1 + n bytes after that are literal bytes.

For copy tags, length bytes are copied from offset bytes ago, in the style of
Lempel-Ziv compression algorithms. In particular:
  - For l == 1, the offset ranges in [0, 1<<11) and the length in [4, 12).
    The length is 4 + the low 3 bits of m. The high 3 bits of m form bits 8-10
    of the offset. The next byte is bits 0-7 of the offset.
  - For l == 2, the offset ranges in [0, 1<<16) and the length in [1, 65).
    The length is 1 + m. The offset is the little-endian unsigned integer
    denoted by the next 2 bytes.
  - For l == 3, the offset ranges in [0, 1<<32) and the length in
    [1, 65). The length is 1 + m. The offset is the little-endian unsigned
    integer denoted by the next 4 bytes.
*/
const (
	tagLiteral = 0x00
	tagCopy1   = 0x01
	tagCopy2   = 0x02
	tagCopy4   = 0x03
)

const (
	checksumSize     = 4
	chunkHeaderSize  = 4
	magicChunk       = "\xff\x06\x00\x00" + magicBody
	magicChunkSnappy = "\xff\x06\x00\x00" + magicBodySnappy
	magicBodySnappy  = "sNaPpY"
	magicBody        = "S2sTwO"

	// maxBlockSize is the maximum size of the input to encodeBlock.
	//
	// For the framing format (Writer type instead of Encode function),
	// this is the maximum uncompressed size of a block.
	maxBlockSize = 4 << 20

	// minBlockSize is the minimum size of block setting when creating a writer.
	minBlockSize = 4 << 10

	skippableFrameHeader = 4
	maxChunkSize         = 1<<24 - 1 // 16777215

	// Default block size
	defaultBlockSize = 1 << 20

	// maxSnappyBlockSize is the maximum snappy block size.
	maxSnappyBlockSize = 1 << 16

	obufHeaderLen = checksumSize + chunkHeaderSize
)

const (
	chunkTypeCompressedData   = 0x00
	chunkTypeUncompressedData = 0x01
	ChunkTypeIndex            = 0x99
	chunkTypePadding          = 0xfe
	chunkTypeStreamIdentifier = 0xff
)

var (
	crcTable              = crc32.MakeTable(crc32.Castagnoli)
	magicChunkSnappyBytes = []byte(magicChunkSnappy) // Can be passed to functions where it escapes.
	magicChunkBytes       = []byte(magicChunk)       // Can be passed to functions where it escapes.
)

// crc implements the checksum specified in section 3 of
// https://github.com/google/snappy/blob/master/framing_format.txt
func crc(b []byte) uint32 {
	race.ReadSlice(b)

	c := crc32.Update(0, crcTable, b)
	return c>>15 | c<<17 + 0xa282ead8
}

// literalExtraSize returns the extra size of encoding n literals.
// n should be >= 0 and <= math.MaxUint32.
func literalExtraSize(n int64) int64 {
	if n == 0 {
		return 0
	}
	switch {
	case n < 60:
		return 1
	case n < 1<<8:
		return 2
	case n < 1<<16:
		return 3
	case n < 1<<24:
		return 4
	default:
		return 5
	}
}

type byter interface {
	Bytes() []byte
}

var _ byter = &bytes.Buffer{}
