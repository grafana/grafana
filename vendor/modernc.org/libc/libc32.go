// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !linux && (arm || 386)

package libc // import "modernc.org/libc"

import (
	"unsafe"

	"modernc.org/libc/limits"
	"modernc.org/libc/sys/types"
)

const (
	heapSize = 1 << 30 // Adjust for your debugging session requirements and system RAM size.
)

type (
	// RawMem represents the biggest byte array the runtime can handle
	RawMem [1<<31 - 1]byte

	// 32-5*4 = 12 bytes left to pad
	stackHeaderPadding struct {
		a uintptr
		b uintptr
		c uintptr
	}
)

type bits []int

func newBits(n int) (r bits)  { return make(bits, (n+31)>>5) }
func (b bits) has(n int) bool { return b != nil && b[n>>5]&(1<<uint(n&31)) != 0 }
func (b bits) set(n int)      { b[n>>5] |= 1 << uint(n&31) }

func Xstrchrnul(tls *TLS, s uintptr, c int32) (r uintptr) {
	return x___strchrnul(tls, s, c)
}

func x___strchrnul(tls *TLS, s uintptr, c int32) (r uintptr) {
	var k types.Size_t
	var w uintptr
	_, _ = k, w
	c = int32(uint8(c))
	if !(c != 0) {
		return s + uintptr(Xstrlen(tls, s))
	}
	for {
		if !(uint32(s)%Uint32FromInt64(4) != 0) {
			break
		}
		if !(*(*int8)(unsafe.Pointer(s)) != 0) || int32(*(*uint8)(unsafe.Pointer(s))) == c {
			return s
		}
		goto _1
	_1:
		s++
	}
	k = uint32(-Int32FromInt32(1)) / Uint32FromInt32(limits.UCHAR_MAX) * uint32(c)
	w = s
	for {
		if !(!((*(*uint32)(unsafe.Pointer(w))-uint32(-Int32FromInt32(1))/Uint32FromInt32(limits.UCHAR_MAX)) & ^*(*uint32)(unsafe.Pointer(w)) & (uint32(-Int32FromInt32(1))/Uint32FromInt32(limits.UCHAR_MAX)*uint32(Int32FromInt32(limits.UCHAR_MAX)/Int32FromInt32(2)+Int32FromInt32(1))) != 0) && !((*(*uint32)(unsafe.Pointer(w))^k-uint32(-Int32FromInt32(1))/Uint32FromInt32(limits.UCHAR_MAX)) & ^(*(*uint32)(unsafe.Pointer(w))^k) & (uint32(-Int32FromInt32(1))/Uint32FromInt32(limits.UCHAR_MAX)*uint32(Int32FromInt32(limits.UCHAR_MAX)/Int32FromInt32(2)+Int32FromInt32(1))) != 0)) {
			break
		}
		goto _2
	_2:
		w += 4
	}
	s = w
	for {
		if !(*(*int8)(unsafe.Pointer(s)) != 0 && int32(*(*uint8)(unsafe.Pointer(s))) != c) {
			break
		}
		goto _3
	_3:
		s++
	}
	return s
}
