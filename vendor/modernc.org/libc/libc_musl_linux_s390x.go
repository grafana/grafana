// Copyright 2023 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"unsafe"

	"golang.org/x/sys/unix"
)

type long = int64

type ulong = uint64

// RawMem represents the biggest byte array the runtime can handle
type RawMem [1<<50 - 1]byte

func Xfesetround(tls *TLS, r int32) (r1 int32) {
	if __ccgo_strace {
		trc("tls=%v r=%v, (%v:)", tls, r, origin(2))
		defer func() { trc("-> %v", r1) }()
	}
	return X__fesetround(tls, r)
}

func Xmmap(tls *TLS, start uintptr, len1 Tsize_t, prot int32, flags int32, fd int32, off Toff_t) (r uintptr) {
	if __ccgo_strace {
		trc("tls=%v start=%v len1=%v prot=%v flags=%v fd=%v off=%v, (%v:)", tls, start, len1, prot, flags, fd, off, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return ___mmap(tls, start, len1, prot, flags, fd, off)
}

func ___mmap(tls *TLS, start uintptr, len1 Tsize_t, prot int32, flags int32, fd int32, off Toff_t) (r uintptr) {
	if __ccgo_strace {
		trc("tls=%v start=%v len1=%v prot=%v flags=%v fd=%v off=%v, (%v:)", tls, start, len1, prot, flags, fd, off, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	// https://github.com/golang/go/blob/7d822af4500831d131562f17dcf53374469d823e/src/syscall/syscall_linux_s390x.go#L77
	args := [6]uintptr{start, uintptr(len1), uintptr(prot), uintptr(flags), uintptr(fd), uintptr(off)}
	data, _, err := unix.Syscall(unix.SYS_MMAP, uintptr(unsafe.Pointer(&args[0])), 0, 0)
	if err != 0 {
		tls.setErrno(int32(err))
		return ^uintptr(0) // (void*)-1
	}

	return data
}
