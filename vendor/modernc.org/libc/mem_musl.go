// Copyright 2023 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !libc.membrk && !libc.memgrind && linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm)

package libc // import "modernc.org/libc"

import (
	"math"
	mbits "math/bits"

	"modernc.org/memory"
)

const (
	isMemBrk = false
)

func Xmalloc(tls *TLS, n Tsize_t) (r uintptr) {
	if __ccgo_strace {
		trc("tls=%v n=%v, (%v:)", tls, n, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if n > math.MaxInt {
		tls.setErrno(ENOMEM)
		return 0
	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	if n == 0 {
		// malloc(0) should return unique pointers
		// (often expected and gnulib replaces malloc if malloc(0) returns 0)
		n = 1
	}
	var err error
	if r, err = allocator.UintptrMalloc(int(n)); err != nil {
		r = 0
		tls.setErrno(ENOMEM)
	}
	return r
}

func Xcalloc(tls *TLS, m Tsize_t, n Tsize_t) (r uintptr) {
	if __ccgo_strace {
		trc("tls=%v m=%v n=%v, (%v:)", tls, m, n, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	hi, rq := mbits.Mul(uint(m), uint(n))
	if hi != 0 || rq > math.MaxInt {
		tls.setErrno(ENOMEM)
		return 0
	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	if rq == 0 {
		rq = 1
	}

	var err error
	if r, err = allocator.UintptrCalloc(int(rq)); err != nil {
		r = 0
		tls.setErrno(ENOMEM)
	}
	return r
}

func Xrealloc(tls *TLS, p uintptr, n Tsize_t) (r uintptr) {
	if __ccgo_strace {
		trc("tls=%v p=%v n=%v, (%v:)", tls, p, n, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	var err error
	if r, err = allocator.UintptrRealloc(p, int(n)); err != nil {
		r = 0
		tls.setErrno(ENOMEM)
	}
	return r
}

func Xfree(tls *TLS, p uintptr) {
	if __ccgo_strace {
		trc("tls=%v p=%v, (%v:)", tls, p, origin(2))
	}
	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	allocator.UintptrFree(p)
}

func Xmalloc_usable_size(tls *TLS, p uintptr) (r Tsize_t) {
	if __ccgo_strace {
		trc("tls=%v p=%v, (%v:)", tls, p, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if p == 0 {
		return 0
	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	return Tsize_t(memory.UintptrUsableSize(p))
}

func MemAudit() (r []*MemAuditError) {
	return nil
}

func UsableSize(p uintptr) Tsize_t {
	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	return Tsize_t(memory.UintptrUsableSize(p))
}

type MemAllocatorStat struct {
	Allocs int
	Bytes  int
	Mmaps  int
}

// MemStat returns the global memory allocator statistics.
// should be compiled with the memory.counters build tag for the data to be available.
func MemStat() MemAllocatorStat {
	allocatorMu.Lock()
	defer allocatorMu.Unlock()

	return MemAllocatorStat{
		Allocs: allocator.Allocs,
		Bytes:  allocator.Bytes,
		Mmaps:  allocator.Mmaps,
	}
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
