// Copyright (C) 2014 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
// Copyright (C) 2018 G.J.R. Timmer <gjr.timmer@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// +build sqlite_secure_delete_fast

package sqlite3

/*
#cgo CFLAGS: -DSQLITE_SECURE_DELETE=FAST
#cgo LDFLAGS: -lm
*/
import "C"
