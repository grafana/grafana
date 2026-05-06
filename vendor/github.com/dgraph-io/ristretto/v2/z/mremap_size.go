//go:build linux && !arm64 && !arm && !js
// +build linux,!arm64,!arm,!js

/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package z

import (
	"fmt"
	"reflect"
	"unsafe"

	"golang.org/x/sys/unix"
)

// mremap is a Linux-specific system call to remap pages in memory. This can be used in place of munmap + mmap.
func mremap(data []byte, size int) ([]byte, error) {
	//nolint:lll
	// taken from <https://github.com/torvalds/linux/blob/f8394f232b1eab649ce2df5c5f15b0e528c92091/include/uapi/linux/mman.h#L8>
	const MREMAP_MAYMOVE = 0x1

	header := (*reflect.SliceHeader)(unsafe.Pointer(&data))
	mmapAddr, mmapSize, errno := unix.Syscall6(
		unix.SYS_MREMAP,
		header.Data,
		uintptr(header.Len),
		uintptr(size),
		uintptr(MREMAP_MAYMOVE),
		0,
		0,
	)
	if errno != 0 {
		return nil, errno
	}
	if mmapSize != uintptr(size) {
		return nil, fmt.Errorf("mremap size mismatch: requested: %d got: %d", size, mmapSize)
	}

	header.Data = mmapAddr
	header.Cap = size
	header.Len = size
	return data, nil
}
