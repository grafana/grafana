// Copyright 2023 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"math/bits"
	"sync/atomic"
	"unsafe"
)

type long = int32

type ulong = uint32

var (
	___a_barrier_ptr ulong
)

// RawMem represents the biggest byte array the runtime can handle
type RawMem [1<<31 - 1]byte

// void *memcpy(void *dest, const void *src, size_t n);
func Xmemcpy(t *TLS, dest, src uintptr, n Tsize_t) (r uintptr) {
	if __ccgo_strace {
		trc("t=%v src=%v n=%v, (%v:)", t, src, n, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return _memcpy(t, dest, src, n)
}

func _memcpy(t *TLS, dest, src uintptr, n Tsize_t) (r uintptr) {
	if n != 0 {
		copy((*RawMem)(unsafe.Pointer(dest))[:n:n], (*RawMem)(unsafe.Pointer(src))[:n:n])
	}
	return dest
}

func _fetestexcept(t *TLS, _ int32) int32 {
	return 0
}

func _feclearexcept(t *TLS, _ int32) int32 {
	return 0
}

func _a_crash(tls *TLS) {
	panic("crash")
}

var atomicBarrier atomic.Int32

func _a_barrier(tls *TLS) {
	atomicBarrier.Add(1)
}

// static inline int a_sc(volatile int *p, int v)
func _a_sc(*TLS, uintptr, int32) int32 {
	panic(todo(""))
}

// static inline int a_ll(volatile int *p)
func _a_ll(tls *TLS, p uintptr) int32 {
	return atomic.LoadInt32((*int32)(unsafe.Pointer(p)))
}

func _a_clz_32(tls *TLS, x uint32) int32 {
	return int32(bits.LeadingZeros32(x))
}
