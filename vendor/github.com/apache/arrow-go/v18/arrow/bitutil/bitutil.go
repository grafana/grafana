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
	"math"
	"math/bits"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow/memory"
)

var (
	BitMask        = [8]byte{1, 2, 4, 8, 16, 32, 64, 128}
	FlippedBitMask = [8]byte{254, 253, 251, 247, 239, 223, 191, 127}
)

// IsMultipleOf8 returns whether v is a multiple of 8.
func IsMultipleOf8(v int64) bool { return v&7 == 0 }

// IsMultipleOf64 returns whether v is a multiple of 64
func IsMultipleOf64(v int64) bool { return v&63 == 0 }

func BytesForBits(bits int64) int64 { return (bits + 7) >> 3 }

// NextPowerOf2 rounds x to the next power of two.
func NextPowerOf2(x int) int { return 1 << uint(bits.Len(uint(x))) }

// CeilByte rounds size to the next multiple of 8.
func CeilByte(size int) int { return (size + 7) &^ 7 }

// CeilByte64 rounds size to the next multiple of 8.
func CeilByte64(size int64) int64 { return (size + 7) &^ 7 }

// BitIsSet returns true if the bit at index i in buf is set (1).
func BitIsSet(buf []byte, i int) bool { return (buf[uint(i)/8] & BitMask[byte(i)%8]) != 0 }

// BitIsNotSet returns true if the bit at index i in buf is not set (0).
func BitIsNotSet(buf []byte, i int) bool { return (buf[uint(i)/8] & BitMask[byte(i)%8]) == 0 }

// SetBit sets the bit at index i in buf to 1.
func SetBit(buf []byte, i int) { buf[uint(i)/8] |= BitMask[byte(i)%8] }

// ClearBit sets the bit at index i in buf to 0.
func ClearBit(buf []byte, i int) { buf[uint(i)/8] &= FlippedBitMask[byte(i)%8] }

// SetBitTo sets the bit at index i in buf to val.
func SetBitTo(buf []byte, i int, val bool) {
	if val {
		SetBit(buf, i)
	} else {
		ClearBit(buf, i)
	}
}

// CountSetBits counts the number of 1's in buf up to n bits.
func CountSetBits(buf []byte, offset, n int) int {
	if offset > 0 {
		return countSetBitsWithOffset(buf, offset, n)
	}

	count := 0

	uint64Bytes := n / uint64SizeBits * 8
	for _, v := range bytesToUint64(buf[:uint64Bytes]) {
		count += bits.OnesCount64(v)
	}

	for _, v := range buf[uint64Bytes : n/8] {
		count += bits.OnesCount8(v)
	}

	// tail bits
	for i := n &^ 0x7; i < n; i++ {
		if BitIsSet(buf, i) {
			count++
		}
	}

	return count
}

func countSetBitsWithOffset(buf []byte, offset, n int) int {
	count := 0

	beg := offset
	begU8 := roundUp(beg, uint64SizeBits)

	init := min(n, begU8-beg)
	for i := offset; i < beg+init; i++ {
		if BitIsSet(buf, i) {
			count++
		}
	}

	begU64 := BytesForBits(int64(beg + init))
	return count + CountSetBits(buf[begU64:], 0, n-init)
}

func roundUp(v, f int) int {
	return (v + (f - 1)) / f * f
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

const (
	uint64SizeBytes = int(unsafe.Sizeof(uint64(0)))
	uint64SizeBits  = uint64SizeBytes * 8
)

var (
	// PrecedingBitmask is a convenience set of values as bitmasks for checking
	// prefix bits of a byte
	PrecedingBitmask = [8]byte{0, 1, 3, 7, 15, 31, 63, 127}
	// TrailingBitmask is the bitwise complement version of kPrecedingBitmask
	TrailingBitmask = [8]byte{255, 254, 252, 248, 240, 224, 192, 128}
)

// SetBitsTo is a convenience function to quickly set or unset all the bits
// in a bitmap starting at startOffset for length bits.
func SetBitsTo(bits []byte, startOffset, length int64, areSet bool) {
	if length == 0 {
		return
	}

	beg := startOffset
	end := startOffset + length
	var fill uint8 = 0
	if areSet {
		fill = math.MaxUint8
	}

	byteBeg := beg / 8
	byteEnd := end/8 + 1

	// don't modify bits before the startOffset by using this mask
	firstByteMask := PrecedingBitmask[beg%8]
	// don't modify bits past the length by using this mask
	lastByteMask := TrailingBitmask[end%8]

	if byteEnd == byteBeg+1 {
		// set bits within a single byte
		onlyByteMask := firstByteMask
		if end%8 != 0 {
			onlyByteMask = firstByteMask | lastByteMask
		}

		bits[byteBeg] &= onlyByteMask
		bits[byteBeg] |= fill &^ onlyByteMask
		return
	}

	// set/clear trailing bits of first byte
	bits[byteBeg] &= firstByteMask
	bits[byteBeg] |= fill &^ firstByteMask

	if byteEnd-byteBeg > 2 {
		memory.Set(bits[byteBeg+1:byteEnd-1], fill)
	}

	if end%8 == 0 {
		return
	}

	bits[byteEnd-1] &= lastByteMask
	bits[byteEnd-1] |= fill &^ lastByteMask
}
