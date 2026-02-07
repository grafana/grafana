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

package encoding

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"math/bits"

	"github.com/apache/arrow-go/v18/arrow/bitutil"
	shared_utils "github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/utils"
)

// LevelEncoder is for handling the encoding of Definition and Repetition levels
// to parquet files.
type LevelEncoder struct {
	bitWidth int
	rleLen   int
	encoding format.Encoding
	rle      *utils.RleEncoder
	bit      *utils.BitWriter
}

// LevelEncodingMaxBufferSize estimates the max number of bytes needed to encode data with the
// specified encoding given the max level and number of buffered values provided.
func LevelEncodingMaxBufferSize(encoding parquet.Encoding, maxLvl int16, nbuffered int) int {
	bitWidth := bits.Len64(uint64(maxLvl))
	nbytes := 0
	switch encoding {
	case parquet.Encodings.RLE:
		nbytes = utils.MaxRLEBufferSize(bitWidth, nbuffered) + utils.MinRLEBufferSize(bitWidth)
	case parquet.Encodings.BitPacked:
		nbytes = int(bitutil.BytesForBits(int64(nbuffered * bitWidth)))
	default:
		panic("parquet: unknown encoding type for levels")
	}
	return nbytes
}

// Reset resets the encoder allowing it to be reused and updating the maxlevel to the new
// specified value.
func (l *LevelEncoder) Reset(maxLvl int16) {
	l.bitWidth = bits.Len64(uint64(maxLvl))
	switch l.encoding {
	case format.Encoding_RLE:
		l.rle.Clear()
		l.rle.BitWidth = l.bitWidth
	case format.Encoding_BIT_PACKED:
		l.bit.Clear()
	default:
		panic("parquet: unknown encoding type")
	}
}

// Init is called to set up the desired encoding type, max level and underlying writer for a
// level encoder to control where the resulting encoded buffer will end up.
func (l *LevelEncoder) Init(encoding parquet.Encoding, maxLvl int16, w utils.WriterAtWithLen) {
	l.bitWidth = bits.Len64(uint64(maxLvl))
	l.encoding = format.Encoding(encoding)
	switch l.encoding {
	case format.Encoding_RLE:
		l.rle = utils.NewRleEncoder(w, l.bitWidth)
	case format.Encoding_BIT_PACKED:
		l.bit = utils.NewBitWriter(w)
	default:
		panic("parquet: unknown encoding type for levels")
	}
}

// EncodeNoFlush encodes the provided levels in the encoder, but doesn't flush
// the buffer and return it yet, appending these encoded values. Returns the number
// of values encoded and any error encountered or nil. If err is not nil, nencoded
// will be the number of values encoded before the error was encountered
func (l *LevelEncoder) EncodeNoFlush(lvls []int16) (nencoded int, err error) {
	if l.rle == nil && l.bit == nil {
		panic("parquet: level encoders are not initialized")
	}

	switch l.encoding {
	case format.Encoding_RLE:
		for _, level := range lvls {
			if err = l.rle.Put(uint64(level)); err != nil {
				return
			}
			nencoded++
		}
	default:
		for _, level := range lvls {
			if err = l.bit.WriteValue(uint64(level), uint(l.bitWidth)); err != nil {
				return
			}
			nencoded++
		}
	}
	return
}

// Flush flushes out any encoded data to the underlying writer.
func (l *LevelEncoder) Flush() {
	if l.rle == nil && l.bit == nil {
		panic("parquet: level encoders are not initialized")
	}

	switch l.encoding {
	case format.Encoding_RLE:
		l.rleLen = l.rle.Flush()
	default:
		l.bit.Flush(false)
	}
}

// Encode encodes the slice of definition or repetition levels based on
// the currently configured encoding type and returns the number of
// values that were encoded.
func (l *LevelEncoder) Encode(lvls []int16) (nencoded int, err error) {
	if l.rle == nil && l.bit == nil {
		panic("parquet: level encoders are not initialized")
	}

	switch l.encoding {
	case format.Encoding_RLE:
		defer func() { l.rleLen = l.rle.Flush() }()
		for _, level := range lvls {
			if err = l.rle.Put(uint64(level)); err != nil {
				return
			}
			nencoded++
		}

	default:
		defer l.bit.Flush(false)
		for _, level := range lvls {
			if err = l.bit.WriteValue(uint64(level), uint(l.bitWidth)); err != nil {
				return
			}
			nencoded++
		}
	}
	return
}

// Len returns the number of bytes that were written as Run Length encoded
// levels, this is only valid for run length encoding and will panic if using
// deprecated bit packed encoding.
func (l *LevelEncoder) Len() int {
	if l.encoding != format.Encoding_RLE {
		panic("parquet: level encoder, only implemented for RLE")
	}
	return l.rleLen
}

// LevelDecoder handles the decoding of repetition and definition levels from a
// parquet file supporting bit packed and run length encoded values.
type LevelDecoder struct {
	bitWidth  int
	remaining int // the number of values left to be decoded in the input data
	maxLvl    int16
	encoding  format.Encoding
	// only one of the following should ever be set at a time based on the
	// encoding format.
	rle *utils.RleDecoder
	bit *utils.BitReader
}

// SetData sets in the data to be decoded by subsequent calls by specifying the encoding type
// the maximum level (which is what determines the bit width), the number of values expected
// and the raw bytes to decode. Returns the number of bytes expected to be decoded.
func (l *LevelDecoder) SetData(encoding parquet.Encoding, maxLvl int16, nbuffered int, data []byte) (int, error) {
	l.maxLvl = maxLvl
	l.encoding = format.Encoding(encoding)
	l.remaining = nbuffered
	l.bitWidth = bits.Len64(uint64(maxLvl))

	switch encoding {
	case parquet.Encodings.RLE:
		if len(data) < 4 {
			return 0, errors.New("parquet: received invalid levels (corrupt data page?)")
		}

		nbytes := int32(binary.LittleEndian.Uint32(data[:4]))
		if nbytes < 0 || nbytes > int32(len(data)-4) {
			return 0, errors.New("parquet: received invalid number of bytes (corrupt data page?)")
		}

		buf := data[4:]
		if l.rle == nil {
			l.rle = utils.NewRleDecoder(bytes.NewReader(buf), l.bitWidth)
		} else {
			l.rle.Reset(bytes.NewReader(buf), l.bitWidth)
		}
		return int(nbytes) + 4, nil
	case parquet.Encodings.BitPacked:
		nbits, ok := shared_utils.Mul(nbuffered, l.bitWidth)
		if !ok {
			return 0, errors.New("parquet: number of buffered values too large (corrupt data page?)")
		}

		nbytes := bitutil.BytesForBits(int64(nbits))
		if nbytes < 0 || nbytes > int64(len(data)) {
			return 0, errors.New("parquet: received invalid number of bytes (corrupt data page?)")
		}
		if l.bit == nil {
			l.bit = utils.NewBitReader(bytes.NewReader(data))
		} else {
			l.bit.Reset(bytes.NewReader(data))
		}
		return int(nbytes), nil
	default:
		return 0, fmt.Errorf("parquet: unknown encoding type for levels '%s'", encoding)
	}
}

// SetDataV2 is the same as SetData but only for DataPageV2 pages and only supports
// run length encoding.
func (l *LevelDecoder) SetDataV2(nbytes int32, maxLvl int16, nbuffered int, data []byte) error {
	if nbytes < 0 {
		return errors.New("parquet: invalid page header (corrupt data page?)")
	}

	l.maxLvl = maxLvl
	l.encoding = format.Encoding_RLE
	l.remaining = nbuffered
	l.bitWidth = bits.Len64(uint64(maxLvl))

	if l.rle == nil {
		l.rle = utils.NewRleDecoder(bytes.NewReader(data), l.bitWidth)
	} else {
		l.rle.Reset(bytes.NewReader(data), l.bitWidth)
	}
	return nil
}

// Decode decodes the bytes that were set with SetData into the slice of levels
// returning the total number of levels that were decoded and the number of
// values which had a level equal to the max level, indicating how many physical
// values exist to be read.
func (l *LevelDecoder) Decode(levels []int16) (int, int64) {
	var (
		buf          [1024]uint64
		totaldecoded int
		decoded      int
		valsToRead   int64
	)

	n := shared_utils.Min(int64(l.remaining), int64(len(levels)))
	for n > 0 {
		batch := shared_utils.Min(1024, n)
		switch l.encoding {
		case format.Encoding_RLE:
			decoded = l.rle.GetBatch(buf[:batch])
		case format.Encoding_BIT_PACKED:
			decoded, _ = l.bit.GetBatch(uint(l.bitWidth), buf[:batch])
		}
		l.remaining -= decoded
		totaldecoded += decoded
		n -= batch

		for idx, val := range buf[:decoded] {
			lvl := int16(val)
			levels[idx] = lvl
			if lvl == l.maxLvl {
				valsToRead++
			}
		}
		levels = levels[decoded:]
	}

	return totaldecoded, valsToRead
}
