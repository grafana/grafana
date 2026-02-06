// Copyright 2024 Evan Shaw. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mmap

import "syscall"

func mmap(len int, inprot, inflags, fd uintptr, off int64) ([]byte, error) {
	return nil, syscall.ENOTSUP
}

func (m MMap) flush() error {
	return syscall.ENOTSUP
}

func (m MMap) lock() error {
	return syscall.ENOTSUP
}

func (m MMap) unlock() error {
	return syscall.ENOTSUP
}

func (m MMap) unmap() error {
	return syscall.ENOTSUP
}
