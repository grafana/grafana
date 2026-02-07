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

//go:build go1.9
// +build go1.9

package s2

// This file is for the bit manipulation code post-Go 1.9.

import "math/bits"

// findMSBSetNonZero64 returns the index (between 0 and 63) of the most
// significant set bit. Passing zero to this function return zero.
func findMSBSetNonZero64(x uint64) int {
	if x == 0 {
		return 0
	}
	return 63 - bits.LeadingZeros64(x)
}

// findLSBSetNonZero64 returns the index (between 0 and 63) of the least
// significant set bit. Passing zero to this function return zero.
func findLSBSetNonZero64(x uint64) int {
	if x == 0 {
		return 0
	}
	return bits.TrailingZeros64(x)
}
