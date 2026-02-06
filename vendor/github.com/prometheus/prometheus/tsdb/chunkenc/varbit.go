// Copyright 2021 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package chunkenc

import (
	"fmt"
	"math/bits"
)

// putVarbitInt writes an int64 using varbit encoding with a bit bucketing
// optimized for the dod's observed in histogram buckets, plus a few additional
// buckets for large numbers.
//
// For optimal space utilization, each branch didn't need to support any values
// of any of the prior branches. So we could expand the range of each branch. Do
// more with fewer bits. It would come at the price of more expensive encoding
// and decoding (cutting out and later adding back that center-piece we
// skip). With the distributions of values we see in practice, we would reduce
// the size by around 1%. A more detailed study would be needed for precise
// values, but it's appears quite certain that we would end up far below 10%,
// which would maybe convince us to invest the increased coding/decoding cost.
func putVarbitInt(b *bstream, val int64) {
	switch {
	case val == 0: // Precisely 0, needs 1 bit.
		b.writeBit(zero)
	case bitRange(val, 3): // -3 <= val <= 4, needs 5 bits.
		b.writeBits(0b10, 2)
		b.writeBits(uint64(val), 3)
	case bitRange(val, 6): // -31 <= val <= 32, 9 bits.
		b.writeBits(0b110, 3)
		b.writeBits(uint64(val), 6)
	case bitRange(val, 9): // -255 <= val <= 256, 13 bits.
		b.writeBits(0b1110, 4)
		b.writeBits(uint64(val), 9)
	case bitRange(val, 12): // -2047 <= val <= 2048, 17 bits.
		b.writeBits(0b11110, 5)
		b.writeBits(uint64(val), 12)
	case bitRange(val, 18): // -131071 <= val <= 131072, 3 bytes.
		b.writeBits(0b111110, 6)
		b.writeBits(uint64(val), 18)
	case bitRange(val, 25): // -16777215 <= val <= 16777216, 4 bytes.
		b.writeBits(0b1111110, 7)
		b.writeBits(uint64(val), 25)
	case bitRange(val, 56): // -36028797018963967 <= val <= 36028797018963968, 8 bytes.
		b.writeBits(0b11111110, 8)
		b.writeBits(uint64(val), 56)
	default:
		b.writeBits(0b11111111, 8) // Worst case, needs 9 bytes.
		b.writeBits(uint64(val), 64)
	}
}

// readVarbitInt reads an int64 encoded with putVarbitInt.
func readVarbitInt(b *bstreamReader) (int64, error) {
	var d byte
	for i := 0; i < 8; i++ {
		d <<= 1
		bit, err := b.readBitFast()
		if err != nil {
			bit, err = b.readBit()
		}
		if err != nil {
			return 0, err
		}
		if bit == zero {
			break
		}
		d |= 1
	}

	var val int64
	var sz uint8

	switch d {
	case 0b0:
		// val == 0
	case 0b10:
		sz = 3
	case 0b110:
		sz = 6
	case 0b1110:
		sz = 9
	case 0b11110:
		sz = 12
	case 0b111110:
		sz = 18
	case 0b1111110:
		sz = 25
	case 0b11111110:
		sz = 56
	case 0b11111111:
		// Do not use fast because it's very unlikely it will succeed.
		bits, err := b.readBits(64)
		if err != nil {
			return 0, err
		}

		val = int64(bits)
	default:
		return 0, fmt.Errorf("invalid bit pattern %b", d)
	}

	if sz != 0 {
		bits, err := b.readBitsFast(sz)
		if err != nil {
			bits, err = b.readBits(sz)
		}
		if err != nil {
			return 0, err
		}
		if bits > (1 << (sz - 1)) {
			// Or something.
			bits -= (1 << sz)
		}
		val = int64(bits)
	}

	return val, nil
}

func bitRangeUint(x uint64, nbits int) bool {
	return bits.LeadingZeros64(x) >= 64-nbits
}

// putVarbitUint writes a uint64 using varbit encoding. It uses the same bit
// buckets as putVarbitInt.
func putVarbitUint(b *bstream, val uint64) {
	switch {
	case val == 0: // Precisely 0, needs 1 bit.
		b.writeBit(zero)
	case bitRangeUint(val, 3): // val <= 7, needs 5 bits.
		b.writeBits(0b10, 2)
		b.writeBits(val, 3)
	case bitRangeUint(val, 6): // val <= 63, 9 bits.
		b.writeBits(0b110, 3)
		b.writeBits(val, 6)
	case bitRangeUint(val, 9): // val <= 511, 13 bits.
		b.writeBits(0b1110, 4)
		b.writeBits(val, 9)
	case bitRangeUint(val, 12): // val <= 4095, 17 bits.
		b.writeBits(0b11110, 5)
		b.writeBits(val, 12)
	case bitRangeUint(val, 18): // val <= 262143, 3 bytes.
		b.writeBits(0b111110, 6)
		b.writeBits(val, 18)
	case bitRangeUint(val, 25): // val <= 33554431, 4 bytes.
		b.writeBits(0b1111110, 7)
		b.writeBits(val, 25)
	case bitRangeUint(val, 56): // val <= 72057594037927935, 8 bytes.
		b.writeBits(0b11111110, 8)
		b.writeBits(val, 56)
	default:
		b.writeBits(0b11111111, 8) // Worst case, needs 9 bytes.
		b.writeBits(val, 64)
	}
}

// readVarbitUint reads a uint64 encoded with putVarbitUint.
func readVarbitUint(b *bstreamReader) (uint64, error) {
	var d byte
	for i := 0; i < 8; i++ {
		d <<= 1
		bit, err := b.readBitFast()
		if err != nil {
			bit, err = b.readBit()
		}
		if err != nil {
			return 0, err
		}
		if bit == zero {
			break
		}
		d |= 1
	}

	var (
		bits uint64
		sz   uint8
		err  error
	)

	switch d {
	case 0b0:
		// val == 0
	case 0b10:
		sz = 3
	case 0b110:
		sz = 6
	case 0b1110:
		sz = 9
	case 0b11110:
		sz = 12
	case 0b111110:
		sz = 18
	case 0b1111110:
		sz = 25
	case 0b11111110:
		sz = 56
	case 0b11111111:
		// Do not use fast because it's very unlikely it will succeed.
		bits, err = b.readBits(64)
		if err != nil {
			return 0, err
		}
	default:
		return 0, fmt.Errorf("invalid bit pattern %b", d)
	}

	if sz != 0 {
		bits, err = b.readBitsFast(sz)
		if err != nil {
			bits, err = b.readBits(sz)
		}
		if err != nil {
			return 0, err
		}
	}

	return bits, nil
}
