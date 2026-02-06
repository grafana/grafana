// Copyright 2021 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build libc.membrk && !libc.memgrind && !(linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm))

// This is a debug-only version of the memory handling functions. When a
// program is built with -tags=libc.membrk a simple but safe version of malloc
// and friends is used that works like sbrk(2). Additionally free becomes a
// nop.

package libc // import "modernc.org/libc"

import (
	"unsafe"

	"modernc.org/libc/errno"
	"modernc.org/libc/sys/types"
)

const (
	heapAlign = 16
	memgrind  = false
)

var (
	heap     = make([]byte, heapSize)
	heapP    = uintptr(unsafe.Pointer(&heap[heapAlign]))
	heapLast = uintptr(unsafe.Pointer(&heap[heapSize-1]))
)

// void *malloc(size_t size);
func Xmalloc(t *TLS, n types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v n=%v, (%v:)", t, n, origin(2))
	}
	if n == 0 {
		// malloc(0) should return unique pointers
		// (often expected and gnulib replaces malloc if malloc(0) returns 0)
		n = 1
	}

	allocMu.Lock()

	defer allocMu.Unlock()

	n2 := uintptr(n) + uintptrSize // reserve space for recording block size
	p := roundup(heapP, 16)
	if p+uintptr(n2) >= heapLast {
		t.setErrno(errno.ENOMEM)
		return 0
	}

	heapP = p + uintptr(n2)
	*(*uintptr)(unsafe.Pointer(p - uintptrSize)) = uintptr(n)
	return p
}

// void *calloc(size_t nmemb, size_t size);
func Xcalloc(t *TLS, n, size types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v n=%v size=%v, (%v:)", t, n, size, origin(2))
	}
	return Xmalloc(t, n*size)
}

// void *realloc(void *ptr, size_t size);
func Xrealloc(t *TLS, ptr uintptr, size types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v ptr=%v size=%v, (%v:)", t, ptr, size, origin(2))
	}
	switch {
	case ptr != 0 && size != 0:
		p := Xmalloc(t, size)
		sz0 := UsableSize(ptr)
		if p != 0 {
			copy((*RawMem)(unsafe.Pointer(p))[:size:size], (*RawMem)(unsafe.Pointer(ptr))[:sz0:sz0])
		}
		return p
	case ptr == 0 && size != 0:
		return Xmalloc(t, size)
	}
	return 0
}

// void free(void *ptr);

func Xfree(t *TLS, p uintptr) {
	if __ccgo_strace {
		trc("t=%v p=%v, (%v:)", t, p, origin(2))
	}
}

func UsableSize(p uintptr) types.Size_t {
	return types.Size_t(*(*uintptr)(unsafe.Pointer(p - uintptrSize)))
}

type MemAllocatorStat struct {
	Allocs int
	Bytes  int
	Mmaps  int
}

// MemStat no-op for this build tag
func MemStat() MemAllocatorStat {
	return MemAllocatorStat{}
}

// MemAuditStart locks the memory allocator, initializes and enables memory
// auditing. Finaly it unlocks the memory allocator.
//
// Some memory handling errors, like double free or freeing of unallocated
// memory, will panic when memory auditing is enabled.
//
// This memory auditing functionality has to be enabled using the libc.memgrind
// build tag.
//
// It is intended only for debug/test builds. It slows down memory allocation
// routines and it has additional memory costs.
func MemAuditStart() {}

// MemAuditReport locks the memory allocator, reports memory leaks, if any.
// Finally it disables memory auditing and unlocks the memory allocator.
//
// This memory auditing functionality has to be enabled using the libc.memgrind
// build tag.
//
// It is intended only for debug/test builds. It slows down memory allocation
// routines and it has additional memory costs.
func MemAuditReport() error { return nil }
