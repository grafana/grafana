// Copyright 2017 The Memory Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package memory // import "modernc.org/memory"

import (
	syscall "golang.org/x/sys/windows"
	"os"
)

const (
	_MEM_COMMIT   = 0x1000
	_MEM_RESERVE  = 0x2000
	_MEM_DECOMMIT = 0x4000
	_MEM_RELEASE  = 0x8000

	_PAGE_READWRITE = 0x0004
	_PAGE_NOACCESS  = 0x0001
)

const pageSizeLog = 16

var (
	modkernel32      = syscall.NewLazySystemDLL("kernel32.dll")
	osPageMask       = osPageSize - 1
	osPageSize       = os.Getpagesize()
	procVirtualAlloc = modkernel32.NewProc("VirtualAlloc")
	procVirtualFree  = modkernel32.NewProc("VirtualFree")
)

// pageSize aligned.
func mmap(size int) (uintptr, int, error) {
	size = roundup(size, pageSize)
	addr, _, err := procVirtualAlloc.Call(0, uintptr(size), _MEM_COMMIT|_MEM_RESERVE, _PAGE_READWRITE)
	if err.(syscall.Errno) != 0 || addr == 0 {
		return addr, size, err
	}
	return addr, size, nil
}

func unmap(addr uintptr, size int) error {
	r, _, err := procVirtualFree.Call(addr, 0, _MEM_RELEASE)
	if r == 0 {
		return err
	}

	return nil
}
