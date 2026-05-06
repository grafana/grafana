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

package bitutils

import (
	"encoding/binary"
	"math/bits"

	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/internal/utils"
)

// IsMultipleOf64 returns whether v is a multiple of 64.
func IsMultipleOf64(v int64) bool { return v&63 == 0 }

// LeastSignificantBitMask returns a bit mask to return the least significant
// bits for a value starting from the bit index passed in. ie: if you want a
// mask for the 4 least significant bits, you call LeastSignificantBitMask(4)
func LeastSignificantBitMask(index int64) uint64 {
	return (uint64(1) << index) - 1
}

// SetBitRun describes a run of contiguous set bits in a bitmap with Pos being
// the starting position of the run and Length being the number of bits.
type SetBitRun struct {
	Pos    int64
	Length int64
}

// AtEnd returns true if this bit run is the end of the set by checking
// that the length is 0.
func (s SetBitRun) AtEnd() bool {
	return s.Length == 0
}

// Equal returns whether rhs is the same run as s
func (s SetBitRun) Equal(rhs SetBitRun) bool {
	return s.Pos == rhs.Pos && s.Length == rhs.Length
}

// SetBitRunReader is an interface for reading groups of contiguous set bits
// from a bitmap. The interface allows us to create different reader implementations
// that share the same interface easily such as a reverse set reader.
type SetBitRunReader interface {
	// NextRun will return the next run of contiguous set bits in the bitmap
	NextRun() SetBitRun
	// Reset allows re-using the reader by providing a new bitmap, offset and length. The arguments
	// match the New function for the reader being used.
	Reset([]byte, int64, int64)
	// VisitSetBitRuns calls visitFn for each set in a loop starting from the current position
	// it's roughly equivalent to simply looping, calling NextRun and calling visitFn on the run
	// for each run.
	VisitSetBitRuns(visitFn VisitFn) error
}

type baseSetBitRunReader struct {
	bitmap     []byte
	pos        int64
	length     int64
	remaining  int64
	curWord    uint64
	curNumBits int32
	reversed   bool

	firstBit uint64
}

// NewSetBitRunReader returns a SetBitRunReader for the bitmap starting at startOffset which will read
// numvalues bits.
func NewSetBitRunReader(validBits []byte, startOffset, numValues int64) SetBitRunReader {
	return newBaseSetBitRunReader(validBits, startOffset, numValues, false)
}

// NewReverseSetBitRunReader returns a SetBitRunReader like NewSetBitRunReader, except it will
// return runs starting from the end of the bitmap until it reaches startOffset rather than starting
// at startOffset and reading from there. The SetBitRuns will still operate the same, so Pos
// will still be the position of the "left-most" bit of the run or the "start" of the run. It
// just returns runs starting from the end instead of starting from the beginning.
func NewReverseSetBitRunReader(validBits []byte, startOffset, numValues int64) SetBitRunReader {
	return newBaseSetBitRunReader(validBits, startOffset, numValues, true)
}

func newBaseSetBitRunReader(bitmap []byte, startOffset, length int64, reverse bool) *baseSetBitRunReader {
	ret := &baseSetBitRunReader{reversed: reverse}
	ret.Reset(bitmap, startOffset, length)
	return ret
}

func (br *baseSetBitRunReader) Reset(bitmap []byte, startOffset, length int64) {
	br.bitmap = bitmap
	br.length = length
	br.remaining = length
	br.curNumBits = 0
	br.curWord = 0

	if !br.reversed {
		br.pos = startOffset / 8
		br.firstBit = 1

		bitOffset := int8(startOffset % 8)
		if length > 0 && bitOffset != 0 {
			br.curNumBits = int32(utils.Min(int(length), int(8-bitOffset)))
			br.curWord = br.loadPartial(bitOffset, int64(br.curNumBits))
		}
		return
	}

	br.pos = (startOffset + length) / 8
	br.firstBit = uint64(0x8000000000000000)
	endBitOffset := int8((startOffset + length) % 8)
	if length > 0 && endBitOffset != 0 {
		br.pos++
		br.curNumBits = int32(utils.Min(int(length), int(endBitOffset)))
		br.curWord = br.loadPartial(8-endBitOffset, int64(br.curNumBits))
	}
}

func (br *baseSetBitRunReader) consumeBits(word uint64, nbits int32) uint64 {
	if br.reversed {
		return word << nbits
	}
	return word >> nbits
}

func (br *baseSetBitRunReader) countFirstZeros(word uint64) int32 {
	if br.reversed {
		return int32(bits.LeadingZeros64(word))
	}
	return int32(bits.TrailingZeros64(word))
}

func (br *baseSetBitRunReader) loadPartial(bitOffset int8, numBits int64) uint64 {
	var word [8]byte
	nbytes := bitutil.BytesForBits(numBits)
	if br.reversed {
		br.pos -= nbytes
		copy(word[8-nbytes:], br.bitmap[br.pos:br.pos+nbytes])
		return (binary.LittleEndian.Uint64(word[:]) << bitOffset) &^ LeastSignificantBitMask(64-numBits)
	}

	copy(word[:], br.bitmap[br.pos:br.pos+nbytes])
	br.pos += nbytes
	return (binary.LittleEndian.Uint64(word[:]) >> bitOffset) & LeastSignificantBitMask(numBits)
}

func (br *baseSetBitRunReader) findCurrentRun() SetBitRun {
	nzeros := br.countFirstZeros(br.curWord)
	if nzeros >= br.curNumBits {
		br.remaining -= int64(br.curNumBits)
		br.curWord = 0
		br.curNumBits = 0
		return SetBitRun{0, 0}
	}

	br.curWord = br.consumeBits(br.curWord, nzeros)
	br.curNumBits -= nzeros
	br.remaining -= int64(nzeros)
	pos := br.position()

	numOnes := br.countFirstZeros(^br.curWord)
	br.curWord = br.consumeBits(br.curWord, numOnes)
	br.curNumBits -= numOnes
	br.remaining -= int64(numOnes)
	return SetBitRun{pos, int64(numOnes)}
}

func (br *baseSetBitRunReader) position() int64 {
	if br.reversed {
		return br.remaining
	}
	return br.length - br.remaining
}

func (br *baseSetBitRunReader) adjustRun(run SetBitRun) SetBitRun {
	if br.reversed {
		run.Pos -= run.Length
	}
	return run
}

func (br *baseSetBitRunReader) loadFull() (ret uint64) {
	if br.reversed {
		br.pos -= 8
	}
	ret = binary.LittleEndian.Uint64(br.bitmap[br.pos : br.pos+8])
	if !br.reversed {
		br.pos += 8
	}
	return
}

func (br *baseSetBitRunReader) skipNextZeros() {
	for br.remaining >= 64 {
		br.curWord = br.loadFull()
		nzeros := br.countFirstZeros(br.curWord)
		if nzeros < 64 {
			br.curWord = br.consumeBits(br.curWord, nzeros)
			br.curNumBits = 64 - nzeros
			br.remaining -= int64(nzeros)
			return
		}
		br.remaining -= 64
	}
	// run of zeros continues in last bitmap word
	if br.remaining > 0 {
		br.curWord = br.loadPartial(0, br.remaining)
		br.curNumBits = int32(br.remaining)
		nzeros := int32(utils.Min(int(br.curNumBits), int(br.countFirstZeros(br.curWord))))
		br.curWord = br.consumeBits(br.curWord, nzeros)
		br.curNumBits -= nzeros
		br.remaining -= int64(nzeros)
	}
}

func (br *baseSetBitRunReader) countNextOnes() int64 {
	var length int64
	if ^br.curWord != 0 {
		numOnes := br.countFirstZeros(^br.curWord)
		br.remaining -= int64(numOnes)
		br.curWord = br.consumeBits(br.curWord, numOnes)
		br.curNumBits -= numOnes
		if br.curNumBits != 0 {
			return int64(numOnes)
		}
		length = int64(numOnes)
	} else {
		br.remaining -= 64
		br.curNumBits = 0
		length = 64
	}

	for br.remaining >= 64 {
		br.curWord = br.loadFull()
		numOnes := br.countFirstZeros(^br.curWord)
		length += int64(numOnes)
		br.remaining -= int64(numOnes)
		if numOnes < 64 {
			br.curWord = br.consumeBits(br.curWord, numOnes)
			br.curNumBits = 64 - numOnes
			return length
		}
	}

	if br.remaining > 0 {
		br.curWord = br.loadPartial(0, br.remaining)
		br.curNumBits = int32(br.remaining)
		numOnes := br.countFirstZeros(^br.curWord)
		br.curWord = br.consumeBits(br.curWord, numOnes)
		br.curNumBits -= numOnes
		br.remaining -= int64(numOnes)
		length += int64(numOnes)
	}
	return length
}

func (br *baseSetBitRunReader) NextRun() SetBitRun {
	var (
		pos    int64 = 0
		length int64 = 0
	)

	if br.curNumBits != 0 {
		run := br.findCurrentRun()
		if run.Length != 0 && br.curNumBits != 0 {
			return br.adjustRun(run)
		}
		pos = run.Pos
		length = run.Length
	}

	if length == 0 {
		// we didn't get any ones in curWord, so we can skip any zeros
		// in the following words
		br.skipNextZeros()
		if br.remaining == 0 {
			return SetBitRun{0, 0}
		}
		pos = br.position()
	} else if br.curNumBits == 0 {
		if br.remaining >= 64 {
			br.curWord = br.loadFull()
			br.curNumBits = 64
		} else if br.remaining > 0 {
			br.curWord = br.loadPartial(0, br.remaining)
			br.curNumBits = int32(br.remaining)
		} else {
			return br.adjustRun(SetBitRun{pos, length})
		}
		if (br.curWord & br.firstBit) == 0 {
			return br.adjustRun(SetBitRun{pos, length})
		}
	}

	length += br.countNextOnes()
	return br.adjustRun(SetBitRun{pos, length})
}

// VisitFn is a callback function for visiting runs of contiguous bits
type VisitFn func(pos int64, length int64) error

func (br *baseSetBitRunReader) VisitSetBitRuns(visitFn VisitFn) error {
	for {
		run := br.NextRun()
		if run.Length == 0 {
			break
		}

		if err := visitFn(run.Pos, run.Length); err != nil {
			return err
		}
	}
	return nil
}

// VisitSetBitRuns is just a convenience function for calling NewSetBitRunReader and then VisitSetBitRuns
func VisitSetBitRuns(bitmap []byte, bitmapOffset int64, length int64, visitFn VisitFn) error {
	if bitmap == nil {
		return visitFn(0, length)
	}
	rdr := NewSetBitRunReader(bitmap, bitmapOffset, length)
	for {
		run := rdr.NextRun()
		if run.Length == 0 {
			break
		}

		if err := visitFn(run.Pos, run.Length); err != nil {
			return err
		}
	}
	return nil
}

func VisitSetBitRunsNoErr(bitmap []byte, bitmapOffset int64, length int64, visitFn func(pos, length int64)) {
	if bitmap == nil {
		visitFn(0, length)
		return
	}
	rdr := NewSetBitRunReader(bitmap, bitmapOffset, length)
	for {
		run := rdr.NextRun()
		if run.Length == 0 {
			break
		}
		visitFn(run.Pos, run.Length)
	}
}
