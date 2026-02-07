// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlexp

import (
	"database/sql/driver"
)

var internalDrivers = map[string]driver.Driver{
	"*mssql.MssqlDriver": mssql{},
	"*pq.Driver":         postgresql{},
	"*stdlib.Driver":     postgresql{},
}
