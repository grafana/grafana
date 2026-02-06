// Copyright 2022 Dolthub, Inc.
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

package types

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
)

// OkResult is a representation of the OK packet MySQL sends for non-select queries such as UPDATE, INSERT, etc. It
// can be returned as the only element in the row for a Node that doesn't select anything.
// See https://dev.mysql.com/doc/internals/en/packet-OK_Packet.html
type OkResult struct {
	Info         fmt.Stringer // Human-readable status string for extra status info, echoed verbatim to clients.
	RowsAffected uint64       // Number of rows affected by this operation
	InsertID     uint64       // Inserted ID, if any, or -1 if not
}

// OkResultColumnName should be used as the schema column name for Nodes that return an OkResult
const OkResultColumnName = "__ok_result__"

// OkResultColumnType should be used as the schema column type for Nodes that return an OkResult
var OkResultColumnType = Int64

// OkResultSchema should be used as the schema of Nodes that return an OkResult
var OkResultSchema = sql.Schema{
	{
		Name: OkResultColumnName,
		Type: OkResultColumnType,
	},
}

func IsOkResultSchema(schema sql.Schema) bool {
	return len(schema) == 1 && schema[0] == OkResultSchema[0]
}

// NewOkResult returns a new OkResult with the given number of rows affected.
func NewOkResult(rowsAffected int) OkResult {
	return OkResult{RowsAffected: uint64(rowsAffected)}
}

// IsOkResult returns whether the given row represents an OkResult.
func IsOkResult(row sql.Row) bool {
	if len(row) == 1 {
		if _, ok := row[0].(OkResult); ok {
			return true
		}
	}
	return false
}

// GetOkResult extracts the OkResult from the row given
func GetOkResult(row sql.Row) OkResult {
	return row[0].(OkResult)
}
