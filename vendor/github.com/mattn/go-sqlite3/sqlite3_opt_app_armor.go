// Copyright (C) 2019 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
// Copyright (C) 2018 G.J.R. Timmer <gjr.timmer@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

//go:build !windows && sqlite_app_armor
// +build !windows,sqlite_app_armor

package sqlite3

/*
#cgo CFLAGS: -DSQLITE_ENABLE_API_ARMOR
#cgo LDFLAGS: -lm
*/
import "C"
