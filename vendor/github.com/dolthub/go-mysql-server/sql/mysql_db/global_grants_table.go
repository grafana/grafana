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

package mysql_db

import (
	"fmt"
	"strings"
	"sync"

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/in_mem_table"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const globalGrantsTblName = "global_grants"

var (
	errGlobalGrantEntry = fmt.Errorf("the converter for the `global_grants` table was given an unknown entry")
	errGlobalGrantRow   = fmt.Errorf("the converter for the `global_grants` table was given a row belonging to an unknown schema")

	globalGrantsTblSchema sql.Schema
)

func UserAddGlobalGrantsRow(ctx *sql.Context, row sql.Row, user *User) (*User, error) {
	if len(row) != len(globalGrantsTblSchema) {
		return nil, errGlobalGrantRow
	}

	privilege, ok := row[globalGrantsTblColIndex_PRIV].(string)
	if !ok {
		return nil, errGlobalGrantRow
	}
	withGrantOption, ok := row[globalGrantsTblColIndex_WITH_GRANT_OPTION].(uint16)
	if !ok {
		return nil, errGlobalGrantRow
	}

	user = UserCopy(user)

	// A value of 1 is equivalent to 'N', a value of 2 is equivalent to 'Y'
	user.PrivilegeSet.AddGlobalDynamic(withGrantOption == 2, privilege)

	return user, nil
}

func UserRemoveGlobalGrantsRow(ctx *sql.Context, row sql.Row, user *User) (*User, error) {
	if len(row) != len(globalGrantsTblSchema) {
		return nil, errGlobalGrantRow
	}

	privilege, ok := row[globalGrantsTblColIndex_PRIV].(string)
	if !ok {
		return nil, errGlobalGrantRow
	}

	//TODO: handle "WITH GRANT OPTION"
	//withGrantOption, ok := row[globalGrantsTblColIndex_WITH_GRANT_OPTION].(uint16)
	//if !ok {
	//	return nil, errGlobalGrantRow
	//}

	user = UserCopy(user)

	user.PrivilegeSet.RemoveGlobalDynamic(privilege)

	return user, nil
}

func UserFromGlobalGrantsRow(ctx *sql.Context, row sql.Row) (*User, error) {
	if len(row) != len(globalGrantsTblSchema) {
		return nil, errGlobalGrantRow
	}
	host, ok := row[globalGrantsTblColIndex_HOST].(string)
	if !ok {
		return nil, errGlobalGrantRow
	}
	user, ok := row[globalGrantsTblColIndex_USER].(string)
	if !ok {
		return nil, errGlobalGrantRow
	}
	return &User{
		Host: host,
		User: user,
	}, nil
}

func UserToGlobalGrantsRows(ctx *sql.Context, user *User) ([]sql.Row, error) {
	var rows []sql.Row
	for dynamicPriv, _ := range user.PrivilegeSet.globalDynamic {
		row := make(sql.Row, len(globalGrantsTblSchema))
		var err error
		for i, col := range globalGrantsTblSchema {
			row[i], err = col.Default.Eval(ctx, nil)
			if err != nil {
				return nil, err // Should never happen, schema is static
			}
		}

		row[globalGrantsTblColIndex_USER] = user.User
		row[globalGrantsTblColIndex_HOST] = user.Host
		row[globalGrantsTblColIndex_PRIV] = strings.ToUpper(dynamicPriv)
		//TODO: handle "WITH GRANT OPTION"
		row[globalGrantsTblColIndex_WITH_GRANT_OPTION] = 2

		rows = append(rows, row)
	}

	return rows, nil
}

func NewUserGlobalGrantsIndexedSetTable(set in_mem_table.IndexedSet[*User], lock, rlock sync.Locker) *in_mem_table.MultiIndexedSetTable[*User] {
	table := in_mem_table.NewMultiIndexedSetTable[*User](
		globalGrantsTblName,
		globalGrantsTblSchema,
		sql.Collation_utf8mb3_bin,
		set,
		in_mem_table.MultiValueOps[*User]{
			ToRows:    UserToGlobalGrantsRows,
			FromRow:   UserFromGlobalGrantsRow,
			AddRow:    UserAddGlobalGrantsRow,
			DeleteRow: UserRemoveGlobalGrantsRow,
		},
		lock,
		rlock,
	)
	return table
}

// init creates the schema for the "global_grants" Grant Table.
func init() {
	// Types
	char32_utf8_bin := types.MustCreateString(sqltypes.Char, 32, sql.Collation_utf8_bin)
	char32_utf8_general_ci := types.MustCreateString(sqltypes.Char, 32, sql.Collation_utf8_general_ci)
	char255_ascii_general_ci := types.MustCreateString(sqltypes.Char, 255, sql.Collation_ascii_general_ci)
	enum_N_Y_utf8_general_ci := types.MustCreateEnumType([]string{"N", "Y"}, sql.Collation_utf8_general_ci)

	// Column Templates
	char32_utf8_bin_not_null_default_empty := &sql.Column{
		Type:     char32_utf8_bin,
		Default:  mustDefault(expression.NewLiteral("", char32_utf8_bin), char32_utf8_bin, true, false),
		Nullable: false,
	}
	char32_utf8_general_ci_not_null_default_empty := &sql.Column{
		Type:     char32_utf8_general_ci,
		Default:  mustDefault(expression.NewLiteral("", char32_utf8_general_ci), char32_utf8_general_ci, true, false),
		Nullable: false,
	}
	char255_ascii_general_ci_not_null_default_empty := &sql.Column{
		Type:     char255_ascii_general_ci,
		Default:  mustDefault(expression.NewLiteral("", char255_ascii_general_ci), char255_ascii_general_ci, true, false),
		Nullable: false,
	}
	enum_N_Y_utf8_general_ci_not_null_default_N := &sql.Column{
		Type:     enum_N_Y_utf8_general_ci,
		Default:  mustDefault(expression.NewLiteral("N", enum_N_Y_utf8_general_ci), enum_N_Y_utf8_general_ci, true, false),
		Nullable: false,
	}

	globalGrantsTblSchema = sql.Schema{
		columnTemplate("USER", globalGrantsTblName, true, char32_utf8_bin_not_null_default_empty),
		columnTemplate("HOST", globalGrantsTblName, true, char255_ascii_general_ci_not_null_default_empty),
		columnTemplate("PRIV", globalGrantsTblName, true, char32_utf8_general_ci_not_null_default_empty),
		columnTemplate("WITH_GRANT_OPTION", globalGrantsTblName, false, enum_N_Y_utf8_general_ci_not_null_default_N),
	}
}

// These represent the column indexes of the "global_grants" Grant Table.
const (
	globalGrantsTblColIndex_USER int = iota
	globalGrantsTblColIndex_HOST
	globalGrantsTblColIndex_PRIV
	globalGrantsTblColIndex_WITH_GRANT_OPTION
)
