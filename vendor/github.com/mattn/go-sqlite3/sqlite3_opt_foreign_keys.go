// Copyright (C) 2019 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
// Copyright (C) 2018 G.J.R. Timmer <gjr.timmer@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// +build sqlite_foreign_keys

package sqlite3

/*
#cgo CFLAGS: -DSQLITE_DEFAULT_FOREIGN_KEYS=1
#cgo LDFLAGS: -lm
*/
import "C"
