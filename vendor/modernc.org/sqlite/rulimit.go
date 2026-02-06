// Copyright 2021 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build linux || darwin || netbsd || openbsd
// +build linux darwin netbsd openbsd

package sqlite // import "modernc.org/sqlite"

import (
	"golang.org/x/sys/unix"
)

func setMaxOpenFiles(n int64) error {
	var rLimit unix.Rlimit
	rLimit.Max = uint64(n)
	rLimit.Cur = uint64(n)
	return unix.Setrlimit(unix.RLIMIT_NOFILE, &rLimit)
}
