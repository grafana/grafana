// Copyright (C) 2014 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// +build !windows

package sqlite3

/*
#cgo CFLAGS: -I.
#cgo linux LDFLAGS: -ldl
#cgo linux,ppc LDFLAGS: -lpthread
#cgo linux,ppc64 LDFLAGS: -lpthread
#cgo linux,ppc64le LDFLAGS: -lpthread
*/
import "C"
