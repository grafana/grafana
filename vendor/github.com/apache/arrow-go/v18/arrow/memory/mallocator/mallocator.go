// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package mallocator

// #include <stdlib.h>
// #include <string.h>
import "C"

import (
	"sync"
	"sync/atomic"
	"unsafe"
)

func roundToPowerOf2(v, round uintptr) uintptr {
	forceCarry := round - 1
	truncateMask := ^forceCarry
	return (v + forceCarry) & truncateMask
}

// Mallocator is an allocator which defers to libc malloc.
//
// The primary reason to use this is when exporting data across the C Data
// Interface. CGO requires that pointers to Go memory are not stored in C
// memory, which is exactly what the C Data Interface would otherwise
// require. By allocating with Mallocator up front, we can safely export the
// buffers in Arrow arrays without copying buffers or violating CGO rules.
//
// The build tag 'mallocator' will also make this the default allocator.
type Mallocator struct {
	allocatedBytes uint64
	// We want to align allocations, but since we only get/return []byte,
	// we need to remember the "real" address for Free somehow
	realAllocations sync.Map
	alignment       int
}

func NewMallocator() *Mallocator { return &Mallocator{alignment: 64} }

func NewMallocatorWithAlignment(alignment int) *Mallocator {
	if alignment < 1 {
		panic("mallocator: invalid alignment (must be positive)")
	} else if alignment > 1 && (alignment&(alignment-1)) != 0 {
		panic("mallocator: invalid alignment (must be power of 2)")
	}
	return &Mallocator{alignment: alignment}
}

func (alloc *Mallocator) Allocate(size int) []byte {
	// Use calloc to zero-initialize memory.
	// > ...the current implementation may sometimes cause a runtime error if the
	// > contents of the C memory appear to be a Go pointer. Therefore, avoid
	// > passing uninitialized C memory to Go code if the Go code is going to store
	// > pointer values in it. Zero out the memory in C before passing it to Go.
	if size < 0 {
		panic("mallocator: negative size")
	}
	paddedSize := C.size_t(size + alloc.alignment)
	ptr, err := C.calloc(paddedSize, 1)
	if err != nil {
		// under some circumstances and allocation patterns, we can end up in a scenario
		// where for some reason calloc return ENOMEM even though there is definitely memory
		// available for use. So we attempt to fallback to simply doing malloc + memset in
		// this case. If malloc returns a nil pointer, then we know we're out of memory
		// and will surface the error.
		if ptr = C.malloc(paddedSize); ptr == nil {
			panic(err)
		}
		C.memset(ptr, 0, paddedSize)
	} else if ptr == nil {
		panic("mallocator: out of memory")
	}

	buf := unsafe.Slice((*byte)(ptr), paddedSize)
	aligned := roundToPowerOf2(uintptr(ptr), uintptr(alloc.alignment))
	alloc.realAllocations.Store(aligned, uintptr(ptr))
	atomic.AddUint64(&alloc.allocatedBytes, uint64(size))

	if uintptr(ptr) != aligned {
		shift := aligned - uintptr(ptr)
		return buf[shift : uintptr(size)+shift : uintptr(size)+shift]
	}
	return buf[:size:size]
}

func (alloc *Mallocator) Free(b []byte) {
	sz := len(b)
	ptr := getPtr(b)
	realAddr, loaded := alloc.realAllocations.LoadAndDelete(uintptr(ptr))
	if !loaded {
		// double-free?
		return
	}
	realPtr := unsafe.Pointer(realAddr.(uintptr))
	C.free(realPtr)
	// Subtract sh.Len via two's complement (since atomic doesn't offer subtract)
	atomic.AddUint64(&alloc.allocatedBytes, ^(uint64(sz) - 1))
}

func (alloc *Mallocator) Reallocate(size int, b []byte) []byte {
	if size < 0 {
		panic("mallocator: negative size")
	}

	if cap(b) >= size {
		diff := size - len(b)
		atomic.AddUint64(&alloc.allocatedBytes, uint64(diff))
		return b[:size]
	}
	newBuf := alloc.Allocate(size)
	copy(newBuf, b)
	alloc.Free(b)
	return newBuf
}

func (alloc *Mallocator) AllocatedBytes() int64 {
	return int64(alloc.allocatedBytes)
}

// Duplicate interface to avoid circular import
type TestingT interface {
	Errorf(format string, args ...interface{})
	Helper()
}

func (alloc *Mallocator) AssertSize(t TestingT, sz int) {
	cur := alloc.AllocatedBytes()
	if int64(sz) != cur {
		t.Helper()
		t.Errorf("invalid memory size exp=%d, got=%d", sz, cur)
	}
}
