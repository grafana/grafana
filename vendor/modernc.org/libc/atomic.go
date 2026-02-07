// Copyright 2024 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm)

package libc // import "modernc.org/libc"

import (
	"math"
	mbits "math/bits"
	"sync/atomic"
	"unsafe"
)

func a_store_8(addr uintptr, val int8) int8 {
	*(*int8)(unsafe.Pointer(addr)) = val
	return val
}

func a_load_8(addr uintptr) (val int8) {
	return *(*int8)(unsafe.Pointer(addr))
}

func a_load_16(addr uintptr) (val int16) {
	if addr&1 != 0 {
		panic("unaligned atomic access")
	}

	return *(*int16)(unsafe.Pointer(addr))
}

func a_store_16(addr uintptr, val uint16) {
	if addr&1 != 0 {
		panic("unaligned atomic access")
	}

	*(*uint16)(unsafe.Pointer(addr)) = val
}

// static inline int a_ctz_64(uint64_t x)
func _a_ctz_64(tls *TLS, x uint64) int32 {
	return int32(mbits.TrailingZeros64(x))
}

func AtomicAddFloat32(addr *float32, delta float32) (new float32) {
	v := AtomicLoadFloat32(addr) + delta
	AtomicStoreFloat32(addr, v)
	return v
}

func AtomicLoadFloat32(addr *float32) (val float32) {
	return math.Float32frombits(atomic.LoadUint32((*uint32)(unsafe.Pointer(addr))))
}

func AtomicStoreFloat32(addr *float32, val float32) {
	atomic.StoreUint32((*uint32)(unsafe.Pointer(addr)), math.Float32bits(val))
}

func AtomicAddFloat64(addr *float64, delta float64) (new float64) {
	v := AtomicLoadFloat64(addr) + delta
	AtomicStoreFloat64(addr, v)
	return v
}

func AtomicLoadFloat64(addr *float64) (val float64) {
	return math.Float64frombits(atomic.LoadUint64((*uint64)(unsafe.Pointer(addr))))
}

func AtomicStoreFloat64(addr *float64, val float64) {
	atomic.StoreUint64((*uint64)(unsafe.Pointer(addr)), math.Float64bits(val))
}

func AtomicAddInt32(addr *int32, delta int32) (new int32) { return atomic.AddInt32(addr, delta) }

func AtomicAddInt64(addr *int64, delta int64) (new int64) { return atomic.AddInt64(addr, delta) }

func AtomicAddUint32(addr *uint32, delta uint32) (new uint32) { return atomic.AddUint32(addr, delta) }

func AtomicAddUint64(addr *uint64, delta uint64) (new uint64) { return atomic.AddUint64(addr, delta) }

func AtomicAddUintptr(addr *uintptr, delta uintptr) (new uintptr) {
	return atomic.AddUintptr(addr, delta)

}

func AtomicLoadInt32(addr *int32) (val int32) { return atomic.LoadInt32(addr) }

func AtomicLoadInt64(addr *int64) (val int64) { return atomic.LoadInt64(addr) }

func AtomicLoadUint32(addr *uint32) (val uint32) { return atomic.LoadUint32(addr) }

func AtomicLoadUint64(addr *uint64) (val uint64) { return atomic.LoadUint64(addr) }

func AtomicLoadUintptr(addr *uintptr) (val uintptr) { return atomic.LoadUintptr(addr) }

func AtomicStoreInt32(addr *int32, val int32) { atomic.StoreInt32(addr, val) }

func AtomicStoreUint32(addr *uint32, val uint32) { atomic.StoreUint32(addr, val) }

func AtomicStoreUint64(addr *uint64, val uint64) { atomic.StoreUint64(addr, val) }

func AtomicStoreUintptr(addr *uintptr, val uintptr) { atomic.StoreUintptr(addr, val) }

func AtomicStoreInt64(addr *int64, val int64) { atomic.StoreInt64(addr, val) }
