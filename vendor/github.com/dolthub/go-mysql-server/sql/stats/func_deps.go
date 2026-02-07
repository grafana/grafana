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

package stats

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
)

func IndexFds(tableName string, sch sql.Schema, idx sql.Index) (*sql.FuncDepSet, sql.ColSet, error) {
	var idxCols sql.ColSet
	pref := fmt.Sprintf("%s.", tableName)
	for _, col := range idx.ColumnExpressionTypes() {
		colName := strings.TrimPrefix(strings.ToLower(col.Expression), pref)
		i := sch.IndexOfColName(colName)
		if i < 0 {
			return nil, idxCols, fmt.Errorf("column not found on table during stats building: %s", colName)
		}
		idxCols.Add(sql.ColumnId(i + 1))
	}

	var all sql.ColSet
	var notNull sql.ColSet
	for i, col := range sch {
		all.Add(sql.ColumnId(i + 1))
		if !col.Nullable {
			notNull.Add(sql.ColumnId(i + 1))
		}
	}

	strict := true
	for i, hasNext := idxCols.Next(1); hasNext; i, hasNext = idxCols.Next(i + 1) {
		if !notNull.Contains(i) {
			strict = false
		}
	}

	var strictKeys []sql.ColSet
	var laxKeys []sql.ColSet
	if !idx.IsUnique() {
		// not an FD
	} else if strict {
		strictKeys = append(strictKeys, idxCols)
	} else {
		laxKeys = append(laxKeys, idxCols)
	}
	return sql.NewTablescanFDs(all, strictKeys, laxKeys, notNull), idxCols, nil
}
