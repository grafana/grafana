// Copyright (C) 2019 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// +build windows

package sqlite3

/*
#cgo CFLAGS: -I.
#cgo CFLAGS: -fno-stack-check
#cgo CFLAGS: -fno-stack-protector
#cgo CFLAGS: -mno-stack-arg-probe
#cgo LDFLAGS: -lmingwex -lmingw32
#cgo windows,386 CFLAGS: -D_USE_32BIT_TIME_T
*/
import "C"
