package brotli

import (
	"encoding/binary"
	"math/bits"
	"runtime"
)

/* Copyright 2010 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Function to find maximal matching prefixes of strings. */
func findMatchLengthWithLimit(s1 []byte, s2 []byte, limit uint) uint {
	var matched uint = 0
	_, _ = s1[limit-1], s2[limit-1] // bounds check
	switch runtime.GOARCH {
	case "amd64", "arm64":
		// Compare 8 bytes at at time.
		for matched+8 <= limit {
			w1 := binary.LittleEndian.Uint64(s1[matched:])
			w2 := binary.LittleEndian.Uint64(s2[matched:])
			if w1 != w2 {
				return matched + uint(bits.TrailingZeros64(w1^w2)>>3)
			}
			matched += 8
		}
	case "386":
		// Compare 4 bytes at at time.
		for matched+4 <= limit {
			w1 := binary.LittleEndian.Uint32(s1[matched:])
			w2 := binary.LittleEndian.Uint32(s2[matched:])
			if w1 != w2 {
				return matched + uint(bits.TrailingZeros32(w1^w2)>>3)
			}
			matched += 4
		}
	}
	for matched < limit && s1[matched] == s2[matched] {
		matched++
	}
	return matched
}
