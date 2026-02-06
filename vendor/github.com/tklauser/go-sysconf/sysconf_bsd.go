// Copyright 2018 Tobias Klauser. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build darwin || dragonfly || freebsd || netbsd || openbsd

package sysconf

import "golang.org/x/sys/unix"

func pathconf(path string, name int) int64 {
	if val, err := unix.Pathconf(path, name); err == nil {
		return int64(val)
	}
	return -1
}

func sysctl32(name string) int64 {
	if val, err := unix.SysctlUint32(name); err == nil {
		return int64(val)
	}
	return -1
}

func sysctl64(name string) int64 {
	if val, err := unix.SysctlUint64(name); err == nil {
		return int64(val)
	}
	return -1
}

func yesno(val int64) int64 {
	if val == 0 {
		return -1
	}
	return val
}
