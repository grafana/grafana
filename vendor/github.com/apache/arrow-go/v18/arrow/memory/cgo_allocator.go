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

//go:build cgo && ccalloc
// +build cgo,ccalloc

package memory

import (
	"runtime"

	cga "github.com/apache/arrow-go/v18/arrow/memory/internal/cgoalloc"
)

// CgoArrowAllocator is an allocator which exposes the C++ memory pool class
// from the Arrow C++ Library as an allocator for memory buffers to use in Go.
// The build tag 'ccalloc' must be used in order to include it as it requires
// linking against the arrow library.
//
// The primary reason to use this would be as an allocator when dealing with
// exporting data across the cdata interface in order to ensure that the memory
// is allocated safely on the C side so it can be held on the CGO side beyond
// the context of a single function call. If the memory in use isn't allocated
// on the C side, then it is not safe for any pointers to data to be held outside
// of Go beyond the context of a single Cgo function call as it will be invisible
// to the Go garbage collector and could potentially get moved without being updated.
//
// As an alternative, if the arrow C++ libraries aren't available, remember that
// Allocator is an interface, so anything which can allocate data using C/C++ can
// be exposed and then used to meet the Allocator interface if wanting to export data
// across the Cgo interfaces.
type CgoArrowAllocator struct {
	pool cga.CGOMemPool
}

// Allocate does what it says on the tin, allocates a chunk of memory using the underlying
// memory pool, however CGO calls are 'relatively' expensive, which means doing tons of
// small allocations can end up being expensive and potentially slower than just using
// go memory. This means that preallocating via reserve becomes much more important when
// using this allocator.
//
// Future development TODO: look into converting this more into a slab style allocator
// which amortizes the cost of smaller allocations by allocating bigger chunks of memory
// and passes them out.
func (alloc *CgoArrowAllocator) Allocate(size int) []byte {
	b := cga.CgoPoolAlloc(alloc.pool, size)
	return b
}

func (alloc *CgoArrowAllocator) Free(b []byte) {
	cga.CgoPoolFree(alloc.pool, b)
}

func (alloc *CgoArrowAllocator) Reallocate(size int, b []byte) []byte {
	oldSize := len(b)
	out := cga.CgoPoolRealloc(alloc.pool, size, b)

	if size > oldSize {
		// zero initialize the slice like go would do normally
		// C won't zero initialize the memory.
		Set(out[oldSize:], 0)
	}
	return out
}

// AllocatedBytes returns the current total of bytes that have been allocated by
// the memory pool on the C++ side.
func (alloc *CgoArrowAllocator) AllocatedBytes() int64 {
	return cga.CgoPoolCurBytes(alloc.pool)
}

// AssertSize can be used for testing to ensure and check that there are no memory
// leaks using the allocator.
func (alloc *CgoArrowAllocator) AssertSize(t TestingT, sz int) {
	cur := alloc.AllocatedBytes()
	if int64(sz) != cur {
		t.Helper()
		t.Errorf("invalid memory size exp=%d, got=%d", sz, cur)
	}
}

// NewCgoArrowAllocator creates a new allocator which is backed by the C++ Arrow
// memory pool object which could potentially be using jemalloc or mimalloc or
// otherwise as its backend. Memory allocated by this is invisible to the Go
// garbage collector, and as such care should be taken to avoid any memory leaks.
//
// A finalizer is set on the allocator so when the allocator object itself is eventually
// cleaned up by the garbage collector, it will delete the associated C++ memory pool
// object. If the build tag 'cclog' is added, then the memory pool will output a log line
// for every time memory is allocated, freed or reallocated.
func NewCgoArrowAllocator() *CgoArrowAllocator {
	alloc := &CgoArrowAllocator{pool: cga.NewCgoArrowAllocator(enableLogging)}
	runtime.SetFinalizer(alloc, func(a *CgoArrowAllocator) { cga.ReleaseCGOMemPool(a.pool) })
	return alloc
}
