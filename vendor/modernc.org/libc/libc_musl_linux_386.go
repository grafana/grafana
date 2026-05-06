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

// RawMem represents the biggest byte array the runtime can handle
type RawMem [1<<31 - 1]byte

func a_crash()

func _a_crash(tls *TLS) {
	a_crash()
}

func a_cas(p uintptr, t, s int32) int32

func _a_cas(tls *TLS, p uintptr, test, s int32) int32 {
	return a_cas(p, test, s)
}

func _a_store(tls *TLS, p uintptr, v int32) {
	atomic.StoreInt32((*int32)(unsafe.Pointer(p)), v)
}

func _a_clz_32(tls *TLS, x uint32) int32 {
	return int32(bits.LeadingZeros32(x))
}

func _a_ctz_32(tls *TLS, x uint32) int32 {
	return X__builtin_ctz(tls, x)
}

func a_or(p uintptr, v int32)

func _a_or(tls *TLS, p uintptr, v int32) {
	a_or(p, v)
}

func _a_swap(tls *TLS, p uintptr, v int32) int32 {
	return atomic.SwapInt32((*int32)(unsafe.Pointer(p)), v)
}
