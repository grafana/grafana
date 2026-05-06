// Copyright (c) 2022+ Klaus Post. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package s2

import (
	"bytes"
	"encoding/binary"
	"sync"
)

const (
	// MinDictSize is the minimum dictionary size when repeat has been read.
	MinDictSize = 16

	// MaxDictSize is the maximum dictionary size when repeat has been read.
	MaxDictSize = 65536

	// MaxDictSrcOffset is the maximum offset where a dictionary entry can start.
	MaxDictSrcOffset = 65535
)

// Dict contains a dictionary that can be used for encoding and decoding s2
type Dict struct {
	dict   []byte
	repeat int // Repeat as index of dict

	fast, better, best sync.Once
	fastTable          *[1 << 14]uint16

	betterTableShort *[1 << 14]uint16
	betterTableLong  *[1 << 17]uint16

	bestTableShort *[1 << 16]uint32
	bestTableLong  *[1 << 19]uint32
}

// NewDict will read a dictionary.
// It will return nil if the dictionary is invalid.
func NewDict(dict []byte) *Dict {
	if len(dict) == 0 {
		return nil
	}
	var d Dict
	// Repeat is the first value of the dict
	r, n := binary.Uvarint(dict)
	if n <= 0 {
		return nil
	}
	dict = dict[n:]
	d.dict = dict
	if cap(d.dict) < len(d.dict)+16 {
		d.dict = append(make([]byte, 0, len(d.dict)+16), d.dict...)
	}
	if len(dict) < MinDictSize || len(dict) > MaxDictSize {
		return nil
	}
	d.repeat = int(r)
	if d.repeat > len(dict) {
		return nil
	}
	return &d
}

// Bytes will return a serialized version of the dictionary.
// The output can be sent to NewDict.
func (d *Dict) Bytes() []byte {
	dst := make([]byte, binary.MaxVarintLen16+len(d.dict))
	return append(dst[:binary.PutUvarint(dst, uint64(d.repeat))], d.dict...)
}

// MakeDict will create a dictionary.
// 'data' must be at least MinDictSize.
// If data is longer than MaxDictSize only the last MaxDictSize bytes will be used.
// If searchStart is set the start repeat value will be set to the last
// match of this content.
// If no matches are found, it will attempt to find shorter matches.
// This content should match the typical start of a block.
// If at least 4 bytes cannot be matched, repeat is set to start of block.
func MakeDict(data []byte, searchStart []byte) *Dict {
	if len(data) == 0 {
		return nil
	}
	if len(data) > MaxDictSize {
		data = data[len(data)-MaxDictSize:]
	}
	var d Dict
	dict := data
	d.dict = dict
	if cap(d.dict) < len(d.dict)+16 {
		d.dict = append(make([]byte, 0, len(d.dict)+16), d.dict...)
	}
	if len(dict) < MinDictSize {
		return nil
	}

	// Find the longest match possible, last entry if multiple.
	for s := len(searchStart); s > 4; s-- {
		if idx := bytes.LastIndex(data, searchStart[:s]); idx >= 0 && idx <= len(data)-8 {
			d.repeat = idx
			break
		}
	}

	return &d
}

// MakeDictManual will create a dictionary.
// 'data' must be at least MinDictSize and less than or equal to MaxDictSize.
// A manual first repeat index into data must be provided.
// It must be less than len(data)-8.
func MakeDictManual(data []byte, firstIdx uint16) *Dict {
	if len(data) < MinDictSize || int(firstIdx) >= len(data)-8 || len(data) > MaxDictSize {
		return nil
	}
	var d Dict
	dict := data
	d.dict = dict
	if cap(d.dict) < len(d.dict)+16 {
		d.dict = append(make([]byte, 0, len(d.dict)+16), d.dict...)
	}

	d.repeat = int(firstIdx)
	return &d
}

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
func (d *Dict) Encode(dst, src []byte) []byte {
	if n := MaxEncodedLen(len(src)); n < 0 {
		panic(ErrTooLarge)
	} else if cap(dst) < n {
		dst = make([]byte, n)
	} else {
		dst = dst[:n]
	}

	// The block starts with the varint-encoded length of the decompressed bytes.
	dstP := binary.PutUvarint(dst, uint64(len(src)))

	if len(src) == 0 {
		return dst[:dstP]
	}
	if len(src) < minNonLiteralBlockSize {
		dstP += emitLiteral(dst[dstP:], src)
		return dst[:dstP]
	}
	n := encodeBlockDictGo(dst[dstP:], src, d)
	if n > 0 {
		dstP += n
		return dst[:dstP]
	}
	// Not compressible
	dstP += emitLiteral(dst[dstP:], src)
	return dst[:dstP]
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
func (d *Dict) EncodeBetter(dst, src []byte) []byte {
	if n := MaxEncodedLen(len(src)); n < 0 {
		panic(ErrTooLarge)
	} else if len(dst) < n {
		dst = make([]byte, n)
	}

	// The block starts with the varint-encoded length of the decompressed bytes.
	dstP := binary.PutUvarint(dst, uint64(len(src)))

	if len(src) == 0 {
		return dst[:dstP]
	}
	if len(src) < minNonLiteralBlockSize {
		dstP += emitLiteral(dst[dstP:], src)
		return dst[:dstP]
	}
	n := encodeBlockBetterDict(dst[dstP:], src, d)
	if n > 0 {
		dstP += n
		return dst[:dstP]
	}
	// Not compressible
	dstP += emitLiteral(dst[dstP:], src)
	return dst[:dstP]
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
func (d *Dict) EncodeBest(dst, src []byte) []byte {
	if n := MaxEncodedLen(len(src)); n < 0 {
		panic(ErrTooLarge)
	} else if len(dst) < n {
		dst = make([]byte, n)
	}

	// The block starts with the varint-encoded length of the decompressed bytes.
	dstP := binary.PutUvarint(dst, uint64(len(src)))

	if len(src) == 0 {
		return dst[:dstP]
	}
	if len(src) < minNonLiteralBlockSize {
		dstP += emitLiteral(dst[dstP:], src)
		return dst[:dstP]
	}
	n := encodeBlockBest(dst[dstP:], src, d)
	if n > 0 {
		dstP += n
		return dst[:dstP]
	}
	// Not compressible
	dstP += emitLiteral(dst[dstP:], src)
	return dst[:dstP]
}

// Decode returns the decoded form of src. The returned slice may be a sub-
// slice of dst if dst was large enough to hold the entire decoded block.
// Otherwise, a newly allocated slice will be returned.
//
// The dst and src must not overlap. It is valid to pass a nil dst.
func (d *Dict) Decode(dst, src []byte) ([]byte, error) {
	dLen, s, err := decodedLen(src)
	if err != nil {
		return nil, err
	}
	if dLen <= cap(dst) {
		dst = dst[:dLen]
	} else {
		dst = make([]byte, dLen)
	}
	if s2DecodeDict(dst, src[s:], d) != 0 {
		return nil, ErrCorrupt
	}
	return dst, nil
}

func (d *Dict) initFast() {
	d.fast.Do(func() {
		const (
			tableBits    = 14
			maxTableSize = 1 << tableBits
		)

		var table [maxTableSize]uint16
		// We stop so any entry of length 8 can always be read.
		for i := 0; i < len(d.dict)-8-2; i += 3 {
			x0 := load64(d.dict, i)
			h0 := hash6(x0, tableBits)
			h1 := hash6(x0>>8, tableBits)
			h2 := hash6(x0>>16, tableBits)
			table[h0] = uint16(i)
			table[h1] = uint16(i + 1)
			table[h2] = uint16(i + 2)
		}
		d.fastTable = &table
	})
}

func (d *Dict) initBetter() {
	d.better.Do(func() {
		const (
			// Long hash matches.
			lTableBits    = 17
			maxLTableSize = 1 << lTableBits

			// Short hash matches.
			sTableBits    = 14
			maxSTableSize = 1 << sTableBits
		)

		var lTable [maxLTableSize]uint16
		var sTable [maxSTableSize]uint16

		// We stop so any entry of length 8 can always be read.
		for i := 0; i < len(d.dict)-8; i++ {
			cv := load64(d.dict, i)
			lTable[hash7(cv, lTableBits)] = uint16(i)
			sTable[hash4(cv, sTableBits)] = uint16(i)
		}
		d.betterTableShort = &sTable
		d.betterTableLong = &lTable
	})
}

func (d *Dict) initBest() {
	d.best.Do(func() {
		const (
			// Long hash matches.
			lTableBits    = 19
			maxLTableSize = 1 << lTableBits

			// Short hash matches.
			sTableBits    = 16
			maxSTableSize = 1 << sTableBits
		)

		var lTable [maxLTableSize]uint32
		var sTable [maxSTableSize]uint32

		// We stop so any entry of length 8 can always be read.
		for i := 0; i < len(d.dict)-8; i++ {
			cv := load64(d.dict, i)
			hashL := hash8(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL := lTable[hashL]
			candidateS := sTable[hashS]
			lTable[hashL] = uint32(i) | candidateL<<16
			sTable[hashS] = uint32(i) | candidateS<<16
		}
		d.bestTableShort = &sTable
		d.bestTableLong = &lTable
	})
}
