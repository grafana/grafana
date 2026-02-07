// Copyright 2023 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !sqlite.dmesg
// +build !sqlite.dmesg

package sqlite // import "modernc.org/sqlite"

const dmesgs = false

func dmesg(s string, args ...interface{}) {}
