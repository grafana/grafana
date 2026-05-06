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

import "github.com/apache/arrow-go/v18/arrow/bitutil"

// GenerateBits writes sequential bits to a bitmap. Bits preceding the
// initial start offset are preserved, bits following the bitmap may
// get clobbered.
func GenerateBits(bitmap []byte, start, length int64, g func() bool) {
	if length == 0 {
		return
	}

	cur := bitmap[start/8:]
	mask := bitutil.BitMask[start%8]
	curbyte := cur[0] & bitutil.PrecedingBitmask[start%8]

	for i := int64(0); i < length; i++ {
		bit := g()
		if bit {
			curbyte = curbyte | mask
		}
		mask <<= 1
		if mask == 0 {
			mask = 1
			cur[0] = curbyte
			cur = cur[1:]
			curbyte = 0
		}
	}

	if mask != 1 {
		cur[0] = curbyte
	}
}

// GenerateBitsUnrolled is like GenerateBits but unrolls its main loop for
// higher performance.
//
// See the benchmarks for evidence.
func GenerateBitsUnrolled(bitmap []byte, start, length int64, g func() bool) {
	if length == 0 {
		return
	}

	var (
		curbyte        byte
		cur                   = bitmap[start/8:]
		startBitOffset uint64 = uint64(start % 8)
		mask                  = bitutil.BitMask[startBitOffset]
		remaining             = length
	)

	if mask != 0x01 {
		curbyte = cur[0] & bitutil.PrecedingBitmask[startBitOffset]
		for mask != 0 && remaining > 0 {
			if g() {
				curbyte |= mask
			}
			mask <<= 1
			remaining--
		}
		cur[0] = curbyte
		cur = cur[1:]
	}

	var outResults [8]byte
	for remainingBytes := remaining / 8; remainingBytes > 0; remainingBytes-- {
		for i := 0; i < 8; i++ {
			if g() {
				outResults[i] = 1
			} else {
				outResults[i] = 0
			}
		}
		cur[0] = (outResults[0] | outResults[1]<<1 | outResults[2]<<2 |
			outResults[3]<<3 | outResults[4]<<4 | outResults[5]<<5 |
			outResults[6]<<6 | outResults[7]<<7)
		cur = cur[1:]
	}

	remainingBits := remaining % 8
	if remainingBits > 0 {
		curbyte = 0
		mask = 0x01
		for ; remainingBits > 0; remainingBits-- {
			if g() {
				curbyte |= mask
			}
			mask <<= 1
		}
		cur[0] = curbyte
	}
}
