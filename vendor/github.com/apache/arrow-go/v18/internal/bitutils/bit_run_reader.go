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
	"fmt"
	"math/bits"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/internal/utils"
)

// BitRun represents a run of bits with the same value of length Len
// with Set representing if the group of bits were 1 or 0.
type BitRun struct {
	Len int64
	Set bool
}

// BitRunReader is an interface that is usable by multiple callers to provide
// multiple types of bit run readers such as a reverse reader and so on.
//
// It's a convenience interface for counting contiguous set/unset bits in a bitmap.
// In places where BitBlockCounter can be used, then it would be preferred to use that
// as it would be faster than using BitRunReader.
type BitRunReader interface {
	NextRun() BitRun
}

func (b BitRun) String() string {
	return fmt.Sprintf("{Length: %d, set=%t}", b.Len, b.Set)
}

type bitRunReader struct {
	bitmap       []byte
	pos          int64
	length       int64
	word         uint64
	curRunBitSet bool
}

// NewBitRunReader returns a reader for the given bitmap, offset and length that
// grabs runs of the same value bit at a time for easy iteration.
func NewBitRunReader(bitmap []byte, offset int64, length int64) BitRunReader {
	ret := &bitRunReader{
		bitmap: bitmap[offset/8:],
		pos:    offset % 8,
		length: (offset % 8) + length,
	}

	if length == 0 {
		return ret
	}

	ret.curRunBitSet = bitutil.BitIsNotSet(bitmap, int(offset))
	bitsRemaining := length + ret.pos
	ret.loadWord(bitsRemaining)
	ret.word = ret.word &^ LeastSignificantBitMask(ret.pos)
	return ret
}

// NextRun returns a new BitRun containing the number of contiguous bits with the
// same value. Len == 0 indicates the end of the bitmap.
func (b *bitRunReader) NextRun() BitRun {
	if b.pos >= b.length {
		return BitRun{0, false}
	}

	// This implementation relies on a efficient implementations of
	// CountTrailingZeros and assumes that runs are more often then
	// not.  The logic is to incrementally find the next bit change
	// from the current position.  This is done by zeroing all
	// bits in word_ up to position_ and using the TrailingZeroCount
	// to find the index of the next set bit.

	// The runs alternate on each call, so flip the bit.
	b.curRunBitSet = !b.curRunBitSet

	start := b.pos
	startOffset := start & 63

	// Invert the word for proper use of CountTrailingZeros and
	// clear bits so CountTrailingZeros can do it magic.
	b.word = ^b.word &^ LeastSignificantBitMask(startOffset)

	// Go  forward until the next change from unset to set.
	newbits := int64(bits.TrailingZeros64(b.word)) - startOffset
	b.pos += newbits

	if IsMultipleOf64(b.pos) && b.pos < b.length {
		b.advanceUntilChange()
	}
	return BitRun{b.pos - start, b.curRunBitSet}
}

func (b *bitRunReader) advanceUntilChange() {
	newbits := int64(0)
	for {
		b.bitmap = b.bitmap[arrow.Uint64SizeBytes:]
		b.loadNextWord()
		newbits = int64(bits.TrailingZeros64(b.word))
		b.pos += newbits
		if !IsMultipleOf64(b.pos) || b.pos >= b.length || newbits <= 0 {
			break
		}
	}
}

func (b *bitRunReader) loadNextWord() {
	b.loadWord(b.length - b.pos)
}

func (b *bitRunReader) loadWord(bitsRemaining int64) {
	b.word = 0
	if bitsRemaining >= 64 {
		b.word = binary.LittleEndian.Uint64(b.bitmap)
	} else {
		nbytes := bitutil.BytesForBits(bitsRemaining)
		wordptr := (*(*[8]byte)(unsafe.Pointer(&b.word)))[:]
		copy(wordptr, b.bitmap[:nbytes])

		bitutil.SetBitTo(wordptr, int(bitsRemaining), bitutil.BitIsNotSet(wordptr, int(bitsRemaining-1)))
		// reset the value to little endian for big endian architectures
		b.word = utils.ToLEUint64(b.word)
	}

	// Two cases:
	//   1. For unset, CountTrailingZeros works naturally so we don't
	//   invert the word.
	//   2. Otherwise invert so we can use CountTrailingZeros.
	if b.curRunBitSet {
		b.word = ^b.word
	}
}
