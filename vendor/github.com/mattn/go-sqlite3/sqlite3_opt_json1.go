// Copyright (C) 2014 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// +build sqlite_json sqlite_json1 json1

package sqlite3

/*
#cgo CFLAGS: -DSQLITE_ENABLE_JSON1
*/
import "C"
