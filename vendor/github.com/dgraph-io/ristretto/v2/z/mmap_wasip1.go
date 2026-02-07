//go:build wasip1

/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package z

import (
	"os"
	"syscall"
)

func mmap(fd *os.File, writeable bool, size int64) ([]byte, error) {
	return nil, syscall.ENOSYS
}

func munmap(b []byte) error {
	return syscall.ENOSYS
}

func madvise(b []byte, readahead bool) error {
	return syscall.ENOSYS
}

func msync(b []byte) error {
	return syscall.ENOSYS
}
