// Copyright 2021 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !libc.membrk && libc.memgrind && linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm)

// This is a debug-only version of the memory handling functions. When a
// program is built with -tags=libc.memgrind the functions MemAuditStart and
// MemAuditReport can be used to check for memory leaks.

package libc // import "modernc.org/libc"

import (
	"fmt"
	"runtime"
	"sort"
	"strings"
	"unsafe"

	"modernc.org/memory"
)

const (
	isMemBrk = false
	memgrind = true
)

type memReportItem struct {
	p, pc uintptr
	s     string
}

func (it *memReportItem) String() string {
	more := it.s
	if more != "" {
		a := strings.Split(more, "\n")
		more = "\n\t\t" + strings.Join(a, "\n\t\t")
	}
	return fmt.Sprintf("\t%s: %#x%s", pc2origin(it.pc), it.p, more)
}

type memReport []memReportItem

func (r memReport) Error() string {
	a := []string{"memory leaks"}
	for _, v := range r {
		a = append(a, v.String())
	}
	return strings.Join(a, "\n")
}

var (
	allocs          map[uintptr]uintptr // addr: caller
	allocsMore      map[uintptr]string
	frees           map[uintptr]uintptr // addr: caller
	memAudit        memReport
	memAuditEnabled bool
)

func pc2origin(pc uintptr) string {
	f := runtime.FuncForPC(pc)
	var fn, fns string
	var fl int
	if f != nil {
		fn, fl = f.FileLine(pc)
		fns = f.Name()
		if x := strings.LastIndex(fns, "."); x > 0 {
			fns = fns[x+1:]
		}
	}
	return fmt.Sprintf("%s:%d:%s", fn, fl, fns)
}

// void *malloc(size_t size);
func Xmalloc(t *TLS, size Tsize_t) uintptr {
	if __ccgo_strace {
		trc("t=%v size=%v, (%v:)", t, size, origin(2))
	}
	if size == 0 {
		// malloc(0) should return unique pointers
		// (often expected and gnulib replaces malloc if malloc(0) returns 0)
		size = 1
	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	p, err := allocator.UintptrCalloc(int(size))
	// 	if dmesgs {
	// 		dmesg("%v: %v -> %#x, %v", origin(1), size, p, err)
	// 	}
	if err != nil {
		t.setErrno(ENOMEM)
		return 0
	}

	if memAuditEnabled {
		pc, _, _, ok := runtime.Caller(1)
		if !ok {
			panic("cannot obtain caller's PC")
		}

		delete(frees, p)
		if pc0, ok := allocs[p]; ok {
			dmesg("%v: malloc returns same address twice, previous call at %v:", pc2origin(pc), pc2origin(pc0))
			panic(fmt.Errorf("%v: malloc returns same address twice, previous call at %v:", pc2origin(pc), pc2origin(pc0)))
		}

		allocs[p] = pc
	}
	return p
}

// void *calloc(size_t nmemb, size_t size);
func Xcalloc(t *TLS, n, size Tsize_t) uintptr {
	if __ccgo_strace {
		trc("t=%v n=%v size=%v, (%v:)", t, n, size, origin(2))
	}
	rq := int(n * size)
	if rq == 0 {
		rq = 1
	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	p, err := allocator.UintptrCalloc(rq)
	// 	if dmesgs {
	// 		dmesg("%v: %v -> %#x, %v", origin(1), n*size, p, err)
	// 	}
	if err != nil {
		t.setErrno(ENOMEM)
		return 0
	}

	if memAuditEnabled {
		pc, _, _, ok := runtime.Caller(1)
		if !ok {
			panic("cannot obtain caller's PC")
		}

		delete(frees, p)
		if pc0, ok := allocs[p]; ok {
			dmesg("%v: calloc returns same address twice, previous call at %v:", pc2origin(pc), pc2origin(pc0))
			panic(fmt.Errorf("%v: calloc returns same address twice, previous call at %v:", pc2origin(pc), pc2origin(pc0)))
		}

		allocs[p] = pc
	}
	return p
}

// void *realloc(void *ptr, size_t size);
func Xrealloc(t *TLS, ptr uintptr, size Tsize_t) uintptr {
	if __ccgo_strace {
		trc("t=%v ptr=%v size=%v, (%v:)", t, ptr, size, origin(2))
	}
	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	var pc uintptr
	if memAuditEnabled {
		var ok bool
		if pc, _, _, ok = runtime.Caller(1); !ok {
			panic("cannot obtain caller's PC")
		}

		if ptr != 0 {
			if pc0, ok := frees[ptr]; ok {
				dmesg("%v: realloc: double free of %#x, previous call at %v:", pc2origin(pc), ptr, pc2origin(pc0))
				panic(fmt.Errorf("%v: realloc: double free of %#x, previous call at %v:", pc2origin(pc), ptr, pc2origin(pc0)))
			}

			if _, ok := allocs[ptr]; !ok {
				dmesg("%v: %v: realloc, free of unallocated memory: %#x", origin(1), pc2origin(pc), ptr)
				panic(fmt.Errorf("%v: realloc, free of unallocated memory: %#x", pc2origin(pc), ptr))
			}

			delete(allocs, ptr)
			delete(allocsMore, ptr)
			frees[ptr] = pc
		}
	}

	p, err := allocator.UintptrRealloc(ptr, int(size))
	// 	if dmesgs {
	// 		dmesg("%v: %#x, %v -> %#x, %v", origin(1), ptr, size, p, err)
	// 	}
	if err != nil {
		t.setErrno(ENOMEM)
		return 0
	}

	if memAuditEnabled && p != 0 {
		delete(frees, p)
		if pc0, ok := allocs[p]; ok {
			dmesg("%v: realloc returns same address twice, previous call at %v:", pc2origin(pc), pc2origin(pc0))
			panic(fmt.Errorf("%v: realloc returns same address twice, previous call at %v:", pc2origin(pc), pc2origin(pc0)))
		}

		allocs[p] = pc
	}
	return p
}

// void free(void *ptr);
func Xfree(t *TLS, p uintptr) {
	if __ccgo_strace {
		trc("t=%v p=%v, (%v:)", t, p, origin(2))
	}
	if p == 0 {
		return
	}

	// 	if dmesgs {
	// 		dmesg("%v: %#x", origin(1), p)
	// 	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	sz := memory.UintptrUsableSize(p)
	if memAuditEnabled {
		pc, _, _, ok := runtime.Caller(1)
		if !ok {
			panic("cannot obtain caller's PC")
		}

		if pc0, ok := frees[p]; ok {
			dmesg("%v: double free of %#x, previous call at %v:", pc2origin(pc), p, pc2origin(pc0))
			panic(fmt.Errorf("%v: double free of %#x, previous call at %v:", pc2origin(pc), p, pc2origin(pc0)))
		}

		if _, ok := allocs[p]; !ok {
			dmesg("%v: free of unallocated memory: %#x", pc2origin(pc), p)
			panic(fmt.Errorf("%v: free of unallocated memory: %#x", pc2origin(pc), p))
		}

		delete(allocs, p)
		delete(allocsMore, p)
		frees[p] = pc
	}

	for i := uintptr(0); i < uintptr(sz); i++ {
		*(*byte)(unsafe.Pointer(p + i)) = 0
	}
	allocator.UintptrFree(p)
}

func UsableSize(p uintptr) Tsize_t {
	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	if memAuditEnabled {
		pc, _, _, ok := runtime.Caller(1)
		if !ok {
			panic("cannot obtain caller's PC")
		}

		if _, ok := allocs[p]; !ok {
			dmesg("%v: usable size of unallocated memory: %#x", pc2origin(pc), p)
			panic(fmt.Errorf("%v: usable size of unallocated memory: %#x", pc2origin(pc), p))
		}
	}

	return Tsize_t(memory.UintptrUsableSize(p))
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

func Xmalloc_usable_size(tls *TLS, p uintptr) (r Tsize_t) {
	return UsableSize(p)
}

// MemAuditStart locks the memory allocator, initializes and enables memory
// auditing. Finally it unlocks the memory allocator.
//
// Some memory handling errors, like double free or freeing of unallocated
// memory, will panic when memory auditing is enabled.
//
// This memory auditing functionality has to be enabled using the libc.memgrind
// build tag.
//
// It is intended only for debug/test builds. It slows down memory allocation
// routines and it has additional memory costs.
func MemAuditStart() {
	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	allocs = map[uintptr]uintptr{} // addr: caller
	allocsMore = map[uintptr]string{}
	frees = map[uintptr]uintptr{} // addr: caller
	memAuditEnabled = true
}

// MemAuditReport locks the memory allocator, reports memory leaks, if any.
// Finally it disables memory auditing and unlocks the memory allocator.
//
// This memory auditing functionality has to be enabled using the libc.memgrind
// build tag.
//
// It is intended only for debug/test builds. It slows down memory allocation
// routines and it has additional memory costs.
func MemAuditReport() (r error) {
	allocatorMu.Lock()

	defer func() {
		allocs = nil
		allocsMore = nil
		frees = nil
		memAuditEnabled = false
		memAudit = nil
		allocatorMu.Unlock()
	}()

	if len(allocs) != 0 {
		for p, pc := range allocs {
			memAudit = append(memAudit, memReportItem{p, pc, allocsMore[p]})
		}
		sort.Slice(memAudit, func(i, j int) bool {
			return memAudit[i].String() < memAudit[j].String()
		})
		return memAudit
	}

	return nil
}

func MemAuditAnnotate(pc uintptr, s string) {
	allocatorMu.Lock()
	allocsMore[pc] = s
	allocatorMu.Unlock()
}

func MemAudit() (r []*MemAuditError) {
	return nil
}
