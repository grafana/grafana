// Copyright 2023 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !linux

package libc // import "modernc.org/libc"

import (
	"fmt"
	"unsafe"
)

// Byte loads are atomic on this CPU.
func a_load_8(addr uintptr) uint32 {
	return uint32(*(*byte)(unsafe.Pointer(addr)))
}

// int16 loads are atomic on this CPU when properly aligned.
func a_load_16(addr uintptr) uint32 {
	if addr&1 != 0 {
		panic(fmt.Errorf("unaligned atomic 16 bit access at %#0x", addr))
	}

	return uint32(*(*uint16)(unsafe.Pointer(addr)))
}

// Byte sores are atomic on this CPU.
func a_store_8(addr uintptr, b byte) {
	*(*byte)(unsafe.Pointer(addr)) = b
}

// int16 stores are atomic on this CPU when properly aligned.
func a_store_16(addr uintptr, n uint16) {
	if addr&1 != 0 {
		panic(fmt.Errorf("unaligned atomic 16 bit access at %#0x", addr))
	}

	*(*uint16)(unsafe.Pointer(addr)) = n
}
