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

package hashing

import (
	"math/bits"
	"unsafe"

	"github.com/zeebo/xxh3"
)

func hashInt(val uint64, alg uint64) uint64 {
	// Two of xxhash's prime multipliers (which are chosen for their
	// bit dispersion properties)
	var multipliers = [2]uint64{11400714785074694791, 14029467366897019727}
	// Multiplying by the prime number mixes the low bits into the high bits,
	// then byte-swapping (which is a single CPU instruction) allows the
	// combined high and low bits to participate in the initial hash table index.
	return bits.ReverseBytes64(multipliers[alg] * val)
}

func hashFloat32(val float32, alg uint64) uint64 {
	// grab the raw byte pattern of the
	bt := *(*[4]byte)(unsafe.Pointer(&val))
	x := uint64(*(*uint32)(unsafe.Pointer(&bt[0])))
	hx := hashInt(x, alg)
	hy := hashInt(x, alg^1)
	return 4 ^ hx ^ hy
}

func hashFloat64(val float64, alg uint64) uint64 {
	bt := *(*[8]byte)(unsafe.Pointer(&val))
	hx := hashInt(uint64(*(*uint32)(unsafe.Pointer(&bt[4]))), alg)
	hy := hashInt(uint64(*(*uint32)(unsafe.Pointer(&bt[0]))), alg^1)
	return 8 ^ hx ^ hy
}

// prime constants used for slightly increasing the hash quality further
var exprimes = [2]uint64{1609587929392839161, 9650029242287828579}

// for smaller amounts of bytes this is faster than even calling into
// xxh3 to do the Hash, so we specialize in order to get the benefits
// of that performance.
func Hash(b []byte, alg uint64) uint64 {
	n := uint32(len(b))
	if n <= 16 {
		switch {
		case n > 8:
			// 8 < length <= 16
			// apply same principle as above, but as two 64-bit ints
			x := *(*uint64)(unsafe.Pointer(&b[n-8]))
			y := *(*uint64)(unsafe.Pointer(&b[0]))
			hx := hashInt(x, alg)
			hy := hashInt(y, alg^1)
			return uint64(n) ^ hx ^ hy
		case n >= 4:
			// 4 < length <= 8
			// we can read the bytes as two overlapping 32-bit ints, apply different
			// hash functions to each in parallel
			// then xor the results
			x := *(*uint32)(unsafe.Pointer(&b[n-4]))
			y := *(*uint32)(unsafe.Pointer(&b[0]))
			hx := hashInt(uint64(x), alg)
			hy := hashInt(uint64(y), alg^1)
			return uint64(n) ^ hx ^ hy
		case n > 0:
			x := uint32((n << 24) ^ (uint32(b[0]) << 16) ^ (uint32(b[n/2]) << 8) ^ uint32(b[n-1]))
			return hashInt(uint64(x), alg)
		case n == 0:
			return 1
		}
	}

	// increase differentiation enough to improve hash quality
	return xxh3.Hash(b) + exprimes[alg]
}
