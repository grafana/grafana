//  Copyright (c) 2017 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package vellum

func deltaAddr(base, trans uint64) uint64 {
	// transition dest of 0 is special case
	if trans == 0 {
		return 0
	}
	return base - trans
}

const packOutMask = 1<<4 - 1

func encodePackSize(transSize, outSize int) byte {
	var rv byte
	rv = byte(transSize << 4)
	rv |= byte(outSize)
	return rv
}

func decodePackSize(pack byte) (transSize int, packSize int) {
	transSize = int(pack >> 4)
	packSize = int(pack & packOutMask)
	return
}

const maxNumTrans = 1<<6 - 1

func encodeNumTrans(n int) byte {
	if n <= maxNumTrans {
		return byte(n)
	}
	return 0
}

func readPackedUint(data []byte) (rv uint64) {
	for i := range data {
		shifted := uint64(data[i]) << uint(i*8)
		rv |= shifted
	}
	return
}
