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

//go:build ccalloc
// +build ccalloc

package cgoalloc

// #cgo !windows pkg-config: arrow
// #cgo CXXFLAGS: -std=c++17
// #cgo windows LDFLAGS:  -larrow
// #include "allocator.h"
import "C"
import (
	"unsafe"
)

// CGOMemPool is an alias to the typedef'd uintptr from the allocator.h file
type CGOMemPool = C.ArrowMemoryPool

// CgoPoolAlloc allocates a block of memory of length 'size' using the memory
// pool that is passed in.
func CgoPoolAlloc(pool CGOMemPool, size int) []byte {
	if size == 0 {
		return []byte{}
	}

	var out *C.uint8_t
	C.arrow_pool_allocate(pool, C.int64_t(size), (**C.uint8_t)(unsafe.Pointer(&out)))

	return unsafe.Slice((*byte)(unsafe.Pointer(out)), size)
}

// CgoPoolRealloc calls 'reallocate' on the block of memory passed in which must
// be a slice that was returned by CgoPoolAlloc or CgoPoolRealloc.
func CgoPoolRealloc(pool CGOMemPool, size int, b []byte) []byte {
	if len(b) == 0 {
		return CgoPoolAlloc(pool, size)
	}

	oldSize := C.int64_t(len(b))
	data := (*C.uint8_t)(unsafe.SliceData(b))
	C.arrow_pool_reallocate(pool, oldSize, C.int64_t(size), &data)

	return unsafe.Slice((*byte)(unsafe.Pointer(data)), size)
}

// CgoPoolFree uses the indicated memory pool to free a block of memory. The
// slice passed in *must* be a slice which was returned by CgoPoolAlloc or
// CgoPoolRealloc.
func CgoPoolFree(pool CGOMemPool, b []byte) {
	if len(b) == 0 {
		return
	}

	oldSize := C.int64_t(len(b))
	data := (*C.uint8_t)(unsafe.Pointer(&b[0]))
	C.arrow_pool_free(pool, data, oldSize)
}

// CgoPoolCurBytes returns the current number of bytes allocated by the
// passed in memory pool.
func CgoPoolCurBytes(pool CGOMemPool) int64 {
	return int64(C.arrow_pool_bytes_allocated(pool))
}

// ReleaseCGOMemPool deletes and frees the memory associated with the
// passed in memory pool on the C++ side.
func ReleaseCGOMemPool(pool CGOMemPool) {
	C.arrow_release_pool(pool)
}

// NewCgoArrowAllocator constructs a new memory pool in C++ and returns
// a reference to it which can then be used with the other functions
// here in order to use it.
//
// Optionally if logging is true, a logging proxy will be wrapped around
// the memory pool so that it will output a line every time memory is
// allocated, reallocated or freed along with the size of the allocation.
func NewCgoArrowAllocator(logging bool) CGOMemPool {
	return C.arrow_create_memory_pool(C.bool(logging))
}
