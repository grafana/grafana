// Copyright (C) 2022 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

//go:build sqlite_math_functions
// +build sqlite_math_functions

package sqlite3

/*
#cgo CFLAGS: -DSQLITE_ENABLE_MATH_FUNCTIONS
#cgo LDFLAGS: -lm
*/
import "C"
