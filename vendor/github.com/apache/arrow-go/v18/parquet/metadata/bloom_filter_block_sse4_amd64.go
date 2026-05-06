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

//go:build !noasm

package metadata

import (
	"unsafe"
)

//go:noescape
func _check_block_sse4(bitset32 unsafe.Pointer, len int, hash uint64) (result bool)

func checkBlockSSE4(bitset32 []uint32, hash uint64) bool {
	return _check_block_sse4(unsafe.Pointer(unsafe.SliceData(bitset32)), len(bitset32), hash)
}

//go:noescape
func _insert_block_sse4(bitset32 unsafe.Pointer, len int, hash uint64)

func insertBlockSSE4(bitset32 []uint32, hash uint64) {
	_insert_block_sse4(unsafe.Pointer(unsafe.SliceData(bitset32)), len(bitset32), hash)
}

//go:noescape
func _insert_bulk_sse4(bitset32 unsafe.Pointer, block_len int, hashes unsafe.Pointer, hash_len int)

func insertBulkSSE4(bitset32 []uint32, hashes []uint64) {
	_insert_bulk_sse4(unsafe.Pointer(unsafe.SliceData(bitset32)), len(bitset32),
		unsafe.Pointer(unsafe.SliceData(hashes)), len(hashes))
}
