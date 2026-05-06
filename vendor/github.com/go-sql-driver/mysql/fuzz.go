// Go MySQL Driver - A MySQL-Driver for Go's database/sql package.
//
// Copyright 2020 The Go-MySQL-Driver Authors. All rights reserved.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at http://mozilla.org/MPL/2.0/.

//go:build gofuzz
// +build gofuzz

package mysql

import (
	"database/sql"
)

func Fuzz(data []byte) int {
	db, err := sql.Open("mysql", string(data))
	if err != nil {
		return 0
	}
	db.Close()
	return 1
}
