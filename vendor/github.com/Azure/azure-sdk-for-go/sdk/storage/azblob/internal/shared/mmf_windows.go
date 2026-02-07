//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package shared

import (
	"fmt"
	"os"
	"reflect"
	"syscall"
	"unsafe"
)

// Mmb is a memory mapped buffer
type Mmb []byte

// NewMMB creates a new memory mapped buffer with the specified size
func NewMMB(size int64) (Mmb, error) {
	const InvalidHandleValue = ^uintptr(0) // -1

	prot, access := uint32(syscall.PAGE_READWRITE), uint32(syscall.FILE_MAP_WRITE)
	hMMF, err := syscall.CreateFileMapping(syscall.Handle(InvalidHandleValue), nil, prot, uint32(size>>32), uint32(size&0xffffffff), nil)
	if err != nil {
		return nil, os.NewSyscallError("CreateFileMapping", err)
	}
	defer func() {
		_ = syscall.CloseHandle(hMMF)
	}()

	addr, err := syscall.MapViewOfFile(hMMF, access, 0, 0, uintptr(size))
	if err != nil {
		return nil, os.NewSyscallError("MapViewOfFile", err)
	}

	m := Mmb{}
	h := (*reflect.SliceHeader)(unsafe.Pointer(&m))
	h.Data = addr
	h.Len = int(size)
	h.Cap = h.Len
	return m, nil
}

// Delete cleans up the memory mapped buffer
func (m *Mmb) Delete() {
	addr := uintptr(unsafe.Pointer(&(([]byte)(*m)[0])))
	*m = Mmb{}
	err := syscall.UnmapViewOfFile(addr)
	if err != nil {
		// if we get here, there is likely memory corruption.
		// please open an issue https://github.com/Azure/azure-sdk-for-go/issues
		panic(fmt.Sprintf("UnmapViewOfFile error: %v", err))
	}
}
