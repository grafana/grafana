// Copyright 2019 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !(linux && arm64)

package sqlite3

import (
	"modernc.org/libc"
)

// Format and write a message to the log if logging is enabled.
func X__ccgo_sqlite3_log(t *libc.TLS, iErrCode int32, zFormat uintptr, va uintptr) { /* sqlite3.c:29405:17: */
	libc.X__ccgo_sqlite3_log(t, iErrCode, zFormat, va)
}

func PatchIssue199() {
	// nop
}
