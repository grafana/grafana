// Copyright 2023 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build libc.membrk && !libc.memgrind && linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm)

// This is a debug-only version of the memory handling functions. When a
// program is built with -tags=libc.membrk a simple but safe version of malloc
// and friends is used that works like sbrk(2). Additionally free becomes a
// nop.

// The fixed heap is initially filled with random bytes from a full cycle PRNG,
// program startup time is substantially prolonged.

package libc // import "modernc.org/libc"

import (
	"fmt"
	"math"
	"math/bits"
	"runtime"
	"strings"
	"time"
	"unsafe"

	"modernc.org/mathutil"
)

const (
	isMemBrk = true

	heapSize = 1 << 30
)

var (
	brkIndex    uintptr
	heap        [heapSize]byte
	heapP       uintptr
	heap0       uintptr
	heapRecords []heapRecord
	heapUsable  = map[uintptr]Tsize_t{}
	heapFree    = map[uintptr]struct{}{}
	rng         *mathutil.FC32
)

type heapRecord struct {
	p  uintptr
	pc uintptr
}

func (r *heapRecord) String() string {
	return fmt.Sprintf("[p=%#0x usable=%v pc=%s]", r.p, Xmalloc_usable_size(nil, r.p), pc2origin(r.pc))
}

func init() {
	if roundup(heapGuard, heapAlign) != heapGuard {
		panic("internal error")
	}

	heap0 = uintptr(unsafe.Pointer(&heap[0]))
	heapP = roundup(heap0, heapAlign)
	var err error
	if rng, err = mathutil.NewFC32(math.MinInt32, math.MaxInt32, true); err != nil {
		panic(err)
	}

	rng.Seed(time.Now().UnixNano())
	for i := range heap {
		heap[i] = byte(rng.Next())
	}
}

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

func malloc0(tls *TLS, pc uintptr, n0 Tsize_t, zero bool) (r uintptr) {
	usable := roundup(uintptr(n0), heapAlign)
	rq := usable + 2*heapGuard
	if brkIndex+rq > uintptr(len(heap)) {
		tls.setErrno(ENOMEM)
		return 0
	}

	r, brkIndex = heapP+brkIndex, brkIndex+rq
	heapRecords = append(heapRecords, heapRecord{p: r, pc: pc})
	r += heapGuard
	heapUsable[r] = Tsize_t(usable)
	if zero {
		n := uintptr(n0)
		for i := uintptr(0); i < n; i++ {
			*(*byte)(unsafe.Pointer(r + i)) = 0
		}
	}
	return r
}

func Xmalloc(tls *TLS, n Tsize_t) (r uintptr) {
	if __ccgo_strace {
		trc("tls=%v n=%v, (%v:)", tls, n, origin(2))
		defer func() { trc("-> %v", r) }()
	}

	if n > math.MaxInt {
		tls.setErrno(ENOMEM)
		return 0
	}

	if n == 0 {
		// malloc(0) should return unique pointers
		// (often expected and gnulib replaces malloc if malloc(0) returns 0)
		n = 1
	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	pc, _, _, _ := runtime.Caller(1)
	return malloc0(tls, pc, n, false)
}

func Xcalloc(tls *TLS, m Tsize_t, n Tsize_t) (r uintptr) {
	if __ccgo_strace {
		trc("tls=%v m=%v n=%v, (%v:)", tls, m, n, origin(2))
		defer func() { trc("-> %v", r) }()
	}

	hi, rq := bits.Mul(uint(m), uint(n))
	if hi != 0 || rq > math.MaxInt {
		tls.setErrno(ENOMEM)
		return 0
	}

	if rq == 0 {
		rq = 1
	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	pc, _, _, _ := runtime.Caller(1)
	return malloc0(tls, pc, Tsize_t(rq), true)
}

func Xrealloc(tls *TLS, p uintptr, n Tsize_t) (r uintptr) {
	if __ccgo_strace {
		trc("tls=%v p=%v n=%v, (%v:)", tls, p, n, origin(2))
		defer func() { trc("-> %v", r) }()
	}

	if n == 0 {
		Xfree(tls, p)
		return 0
	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	pc, _, _, _ := runtime.Caller(1)
	if p == 0 {
		return malloc0(tls, pc, n, false)
	}

	usable := heapUsable[p]
	if usable == 0 {
		panic(todo("realloc of unallocated memory: %#0x", p))
	}

	if usable >= n { // in place
		return p
	}

	// malloc
	r = malloc0(tls, pc, n, false)
	copy(unsafe.Slice((*byte)(unsafe.Pointer(r)), usable), unsafe.Slice((*byte)(unsafe.Pointer(p)), usable))
	Xfree(tls, p)
	return r
}

func Xfree(tls *TLS, p uintptr) {
	if __ccgo_strace {
		trc("tls=%v p=%v, (%v:)", tls, p, origin(2))
	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	if p == 0 {
		return
	}

	if _, ok := heapUsable[p]; !ok {
		panic(todo("free of unallocated memory: %#0x", p))
	}

	if _, ok := heapFree[p]; ok {
		panic(todo("double free: %#0x", p))
	}

	heapFree[p] = struct{}{}
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

	return heapUsable[p]
}

func MemAudit() (r []*MemAuditError) {
	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	a := heapRecords
	auditP := heap0
	rng.Seek(0)
	for _, v := range a {
		heapP := v.p
		mallocP := heapP + heapGuard
		usable := heapUsable[mallocP]
		for ; auditP < mallocP; auditP++ {
			if g, e := *(*byte)(unsafe.Pointer(auditP)), byte(rng.Next()); g != e {
				r = append(r, &MemAuditError{Caller: pc2origin(v.pc), Message: fmt.Sprintf("guard area before %#0x, %v is corrupted at %#0x, got %#02x, expected %#02x", mallocP, usable, auditP, g, e)})
			}
		}
		for i := 0; Tsize_t(i) < usable; i++ {
			rng.Next()
		}
		auditP = mallocP + uintptr(usable)
		z := roundup(auditP, heapAlign)
		z += heapGuard
		for ; auditP < z; auditP++ {
			if g, e := *(*byte)(unsafe.Pointer(auditP)), byte(rng.Next()); g != e {
				r = append(r, &MemAuditError{Caller: pc2origin(v.pc), Message: fmt.Sprintf("guard area after %#0x, %v is corrupted at %#0x, got %#02x, expected %#02x", mallocP, usable, auditP, g, e)})
			}
		}
	}
	z := heap0 + uintptr(len(heap))
	for ; auditP < z; auditP++ {
		if g, e := *(*byte)(unsafe.Pointer(auditP)), byte(rng.Next()); g != e {
			r = append(r, &MemAuditError{Caller: "-", Message: fmt.Sprintf("guard area after used heap is corrupted at %#0x, got %#02x, expected %#02x", auditP, g, e)})
			return r // Report only the first fail
		}
	}
	return r
}

func UsableSize(p uintptr) Tsize_t {
	if p == 0 {
		return 0
	}

	allocatorMu.Lock()

	defer allocatorMu.Unlock()

	return heapUsable[p]
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
