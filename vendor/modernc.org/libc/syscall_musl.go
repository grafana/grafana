// Copyright 2024 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm)

package libc // import "modernc.org/libc"

import (
	"golang.org/x/sys/unix"
	"runtime"
)

func ___syscall_cp(tls *TLS, n, a, b, c, d, e, f long) long {
	r1, _, err := (unix.Syscall6(uintptr(n), uintptr(a), uintptr(b), uintptr(c), uintptr(d), uintptr(e), uintptr(f)))
	if err != 0 {
		return long(-err)
	}

	return long(r1)
}

func X__syscall0(tls *TLS, n long) long {
	switch n {
	case __NR_sched_yield:
		runtime.Gosched()
		return 0
	default:
		r1, _, err := unix.Syscall(uintptr(n), 0, 0, 0)
		if err != 0 {
			return long(-err)
		}

		return long(r1)
	}
}

func X__syscall1(tls *TLS, n, a1 long) long {
	r1, _, err := unix.Syscall(uintptr(n), uintptr(a1), 0, 0)
	if err != 0 {
		return long(-err)
	}

	return long(r1)
}

func X__syscall2(tls *TLS, n, a1, a2 long) long {
	r1, _, err := unix.Syscall(uintptr(n), uintptr(a1), uintptr(a2), 0)
	if err != 0 {
		return long(-err)
	}

	return long(r1)
}

func X__syscall3(tls *TLS, n, a1, a2, a3 long) long {
	r1, _, err := unix.Syscall(uintptr(n), uintptr(a1), uintptr(a2), uintptr(a3))
	if err != 0 {
		return long(-err)
	}

	return long(r1)
}

func X__syscall4(tls *TLS, n, a1, a2, a3, a4 long) long {
	r1, _, err := unix.Syscall6(uintptr(n), uintptr(a1), uintptr(a2), uintptr(a3), uintptr(a4), 0, 0)
	if err != 0 {
		return long(-err)
	}

	return long(r1)
}

func X__syscall5(tls *TLS, n, a1, a2, a3, a4, a5 long) long {
	r1, _, err := unix.Syscall6(uintptr(n), uintptr(a1), uintptr(a2), uintptr(a3), uintptr(a4), uintptr(a5), 0)
	if err != 0 {
		return long(-err)
	}

	return long(r1)
}

func X__syscall6(tls *TLS, n, a1, a2, a3, a4, a5, a6 long) long {
	r1, _, err := unix.Syscall6(uintptr(n), uintptr(a1), uintptr(a2), uintptr(a3), uintptr(a4), uintptr(a5), uintptr(a6))
	if err != 0 {
		return long(-err)
	}

	return long(r1)
}
