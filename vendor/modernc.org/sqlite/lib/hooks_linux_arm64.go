// Copyright 2019 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlite3

import (
	"syscall"
	"unsafe"

	"modernc.org/libc"
)

// Format and write a message to the log if logging is enabled.
func X__ccgo_sqlite3_log(t *libc.TLS, iErrCode int32, zFormat uintptr, va uintptr) { /* sqlite3.c:29405:17: */
	libc.X__ccgo_sqlite3_log(t, iErrCode, zFormat, va)
}

// https://gitlab.com/cznic/sqlite/-/issues/199
//
// We are currently stuck on libc@v1.55.3. Until that is resolved - fix the
// problem at runtime.
func PatchIssue199() {
	p := unsafe.Pointer(&_aSyscall)
	*(*uintptr)(unsafe.Add(p, 608)) = __ccgo_fp(_unixGetpagesizeIssue199)
}

func _unixGetpagesizeIssue199(tls *libc.TLS) (r int32) {
	return int32(syscall.Getpagesize())
}
