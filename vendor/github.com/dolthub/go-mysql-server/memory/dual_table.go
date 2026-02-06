// Copyright 2023 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package memory

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const DualTableName = ""

var DualTableSchema = sql.NewPrimaryKeySchema(sql.Schema{
	{Name: "", Source: DualTableName, Type: types.LongText, Nullable: false},
})

// NewDualTable creates the dual table, which is used by the engine for queries with no tables specified, or the
// `dual` table specified. This table is never supplied by integrators, but always by this stand-in implementation.
func NewDualTable() *Table {
	tbl := NewTable(nil, DualTableName, DualTableSchema, nil)
	tbl.ignoreSessionData = true
	part := []byte{0}
	tbl.data.partitions = map[string][]sql.Row{
		string(part): {{"x"}},
	}
	tbl.data.partitionKeys = [][]byte{part}

	return tbl
}
