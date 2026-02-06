// Copyright 2018 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build !go1.9
// +build !go1.9

package s2

// This file is for the bit manipulation code pre-Go 1.9.

// findMSBSetNonZero64 returns the index (between 0 and 63) of the most
// significant set bit. Passing zero to this function returns zero.
func findMSBSetNonZero64(x uint64) int {
	val := []uint64{0x2, 0xC, 0xF0, 0xFF00, 0xFFFF0000, 0xFFFFFFFF00000000}
	shift := []uint64{1, 2, 4, 8, 16, 32}
	var msbPos uint64
	for i := 5; i >= 0; i-- {
		if x&val[i] != 0 {
			x >>= shift[i]
			msbPos |= shift[i]
		}
	}
	return int(msbPos)
}

const deBruijn64 = 0x03f79d71b4ca8b09
const digitMask = uint64(1<<64 - 1)

var deBruijn64Lookup = []byte{
	0, 1, 56, 2, 57, 49, 28, 3, 61, 58, 42, 50, 38, 29, 17, 4,
	62, 47, 59, 36, 45, 43, 51, 22, 53, 39, 33, 30, 24, 18, 12, 5,
	63, 55, 48, 27, 60, 41, 37, 16, 46, 35, 44, 21, 52, 32, 23, 11,
	54, 26, 40, 15, 34, 20, 31, 10, 25, 14, 19, 9, 13, 8, 7, 6,
}

// findLSBSetNonZero64 returns the index (between 0 and 63) of the least
// significant set bit. Passing zero to this function returns zero.
//
// This code comes from trailingZeroBits in https://golang.org/src/math/big/nat.go
// which references (Knuth, volume 4, section 7.3.1).
func findLSBSetNonZero64(x uint64) int {
	return int(deBruijn64Lookup[((x&-x)*(deBruijn64&digitMask))>>58])
}
