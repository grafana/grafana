// Copyright 2024 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build unix && !illumos && !(linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm))

package libc // import "modernc.org/libc"

import (
	"unsafe"

	"golang.org/x/sys/unix"
	"modernc.org/libc/errno"
	ctime "modernc.org/libc/time"
)

// int clock_gettime(clockid_t clk_id, struct timespec *tp);
func Xclock_gettime(t *TLS, clk_id int32, tp uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v clk_id=%v tp=%v, (%v:)", t, clk_id, tp, origin(2))
	}
	var ts unix.Timespec
	if err := unix.ClockGettime(clk_id, &ts); err != nil {
		t.setErrno(err)
		trc("FAIL: %v", err)
		return -1
	}

	*(*unix.Timespec)(unsafe.Pointer(tp)) = ts
	return 0
}

func Xgmtime_r(tls *TLS, t uintptr, tm uintptr) (r uintptr) {
	if __ccgo_strace {
		trc("tls=%v t=%v tm=%v, (%v:)", tls, t, tm, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if x___secs_to_tm(tls, int64(*(*time_t)(unsafe.Pointer(t))), tm) < 0 {
		*(*int32)(unsafe.Pointer(X__errno_location(tls))) = int32(errno.EOVERFLOW)
		return uintptr(0)
	}
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_isdst = 0
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_gmtoff = 0
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_zone = uintptr(unsafe.Pointer(&x___utc))
	return tm
}
