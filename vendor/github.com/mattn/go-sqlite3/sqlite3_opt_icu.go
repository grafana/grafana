// Copyright (C) 2019 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

//go:build sqlite_icu || icu
// +build sqlite_icu icu

package sqlite3

/*
#cgo LDFLAGS: -licuuc -licui18n
#cgo CFLAGS: -DSQLITE_ENABLE_ICU
#cgo darwin,amd64 CFLAGS:  -I/usr/local/opt/icu4c/include
#cgo darwin,amd64 LDFLAGS: -L/usr/local/opt/icu4c/lib
#cgo darwin,arm64 CFLAGS:  -I/opt/homebrew/opt/icu4c/include
#cgo darwin,arm64 LDFLAGS: -L/opt/homebrew/opt/icu4c/lib
#cgo openbsd LDFLAGS: -lsqlite3
*/
import "C"
