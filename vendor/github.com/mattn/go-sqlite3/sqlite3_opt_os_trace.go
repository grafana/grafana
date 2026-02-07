// Copyright (C) 2022 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

//go:build sqlite_os_trace
// +build sqlite_os_trace

package sqlite3

/*
#cgo CFLAGS: -DSQLITE_FORCE_OS_TRACE=1
#cgo CFLAGS: -DSQLITE_DEBUG_OS_TRACE=1
*/
import "C"
