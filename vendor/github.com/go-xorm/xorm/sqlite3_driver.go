// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"github.com/go-xorm/core"
)

// func init() {
// 	core.RegisterDriver("sqlite3", &sqlite3Driver{})
// }

type sqlite3Driver struct {
}

func (p *sqlite3Driver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE, DbName: dataSourceName}, nil
}
