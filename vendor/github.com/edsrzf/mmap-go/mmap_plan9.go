// Copyright 2020 Evan Shaw. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mmap

import "syscall"

func mmap(len int, inprot, inflags, fd uintptr, off int64) ([]byte, error) {
	return nil, syscall.EPLAN9
}

func (m MMap) flush() error {
	return syscall.EPLAN9
}

func (m MMap) lock() error {
	return syscall.EPLAN9
}

func (m MMap) unlock() error {
	return syscall.EPLAN9
}

func (m MMap) unmap() error {
	return syscall.EPLAN9
}
