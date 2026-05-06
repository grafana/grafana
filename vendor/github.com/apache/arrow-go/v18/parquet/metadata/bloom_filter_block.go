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

package metadata

var (
	checkHash  func([]uint32, uint64) bool
	checkBulk  func([]uint32, []uint64, []bool)
	insertHash func([]uint32, uint64)
	insertBulk func([]uint32, []uint64)
)

func checkHashGo(bitset32 []uint32, hash uint64) bool {
	bucketIdx := uint32(((hash >> 32) * uint64(len(bitset32)/8)) >> 32)
	key := uint32(hash)

	for i := range bitsSetPerBlock {
		mask := uint32(1) << ((key * salt[i]) >> 27)
		if bitset32[bitsSetPerBlock*bucketIdx+uint32(i)]&mask == 0 {
			return false
		}
	}
	return true
}

func insertHashGo(bitset32 []uint32, hash uint64) {
	bucketIdx := uint32(((hash >> 32) * uint64(len(bitset32)/8)) >> 32)
	key := uint32(hash)

	for i := range bitsSetPerBlock {
		mask := uint32(1) << ((key * salt[i]) >> 27)
		bitset32[bitsSetPerBlock*bucketIdx+uint32(i)] |= mask
	}
}

func insertBulkGo(bitset32 []uint32, hash []uint64) {
	for _, h := range hash {
		insertHash(bitset32, h)
	}
}
