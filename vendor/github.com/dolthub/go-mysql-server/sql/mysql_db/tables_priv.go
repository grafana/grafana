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

package mysql_db

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/in_mem_table"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const tablesPrivTblName = "tables_priv"

var (
	errTablesPrivEntry = fmt.Errorf("the converter for the `tables_priv` table was given an unknown entry")
	errTablesPrivRow   = fmt.Errorf("the converter for the `tables_priv` table was given a row belonging to an unknown schema")

	tablesPrivTblSchema sql.Schema
)

func UserAddTablesRow(ctx *sql.Context, row sql.Row, user *User) (*User, error) {
	if len(row) != len(tablesPrivTblSchema) {
		return nil, errTablesPrivRow
	}

	dbName, ok := row[tablesPrivTblColIndex_Db].(string)
	if !ok {
		return nil, errTablesPrivRow
	}
	tblName, ok := row[tablesPrivTblColIndex_Table_name].(string)
	if !ok {
		return nil, errTablesPrivRow
	}
	tablePrivs, ok := row[tablesPrivTblColIndex_Table_priv].(uint64)
	if !ok {
		return nil, errTablesPrivRow
	}
	tablePrivStrs, err := tablesPrivTblSchema[tablesPrivTblColIndex_Table_priv].Type.(sql.SetType).BitsToString(tablePrivs)
	if err != nil {
		return nil, err
	}

	user = UserCopy(user)

	var privs []sql.PrivilegeType
	for _, val := range strings.Split(tablePrivStrs, ",") {
		switch val {
		case "Select":
			privs = append(privs, sql.PrivilegeType_Select)
		case "Insert":
			privs = append(privs, sql.PrivilegeType_Insert)
		case "Update":
			privs = append(privs, sql.PrivilegeType_Update)
		case "Delete":
			privs = append(privs, sql.PrivilegeType_Delete)
		case "Create":
			privs = append(privs, sql.PrivilegeType_Create)
		case "Drop":
			privs = append(privs, sql.PrivilegeType_Drop)
		case "Grant":
			privs = append(privs, sql.PrivilegeType_GrantOption)
		case "References":
			privs = append(privs, sql.PrivilegeType_References)
		case "Index":
			privs = append(privs, sql.PrivilegeType_Index)
		case "Alter":
			privs = append(privs, sql.PrivilegeType_Alter)
		case "Create View":
			privs = append(privs, sql.PrivilegeType_CreateView)
		case "Show view":
			privs = append(privs, sql.PrivilegeType_ShowView)
		case "Trigger":
			privs = append(privs, sql.PrivilegeType_Trigger)
		case "":
		default:
			return nil, errTablesPrivRow
		}
	}
	user.PrivilegeSet.AddTable(dbName, tblName, privs...)
	return user, nil
}

func UserRemoveTablesRow(ctx *sql.Context, row sql.Row, user *User) (*User, error) {
	if len(row) != len(tablesPrivTblSchema) {
		return nil, errTablesPrivRow
	}

	db, ok := row[tablesPrivTblColIndex_Db].(string)
	if !ok {
		return nil, errTablesPrivRow
	}
	tbl, ok := row[tablesPrivTblColIndex_Table_name].(string)
	if !ok {
		return nil, errTablesPrivRow
	}

	user = UserCopy(user)
	user.PrivilegeSet.ClearTable(db, tbl)
	return user, nil
}

func UserFromTablesRow(ctx *sql.Context, row sql.Row) (*User, error) {
	if len(row) != len(tablesPrivTblSchema) {
		return nil, errTablesPrivRow
	}
	host, ok := row[tablesPrivTblColIndex_Host].(string)
	if !ok {
		return nil, errTablesPrivRow
	}
	user, ok := row[tablesPrivTblColIndex_User].(string)
	if !ok {
		return nil, errTablesPrivRow
	}
	return &User{
		Host: host,
		User: user,
	}, nil
}

func UserToTablesRows(ctx *sql.Context, user *User) ([]sql.Row, error) {
	newRow := func() (sql.Row, error) {
		row := make(sql.Row, len(tablesPrivTblSchema))
		var err error
		for i, col := range tablesPrivTblSchema {
			row[i], err = col.Default.Eval(ctx, nil)
			if err != nil {
				return nil, err // Should never happen, schema is static
			}
		}
		return row, nil
	}

	var rows []sql.Row
	for _, dbSet := range user.PrivilegeSet.GetDatabases() {
		for _, tblSet := range dbSet.GetTables() {
			if tblSet.Count() == 0 {
				continue
			}
			row, err := newRow()
			if err != nil {
				return nil, err
			}

			row[tablesPrivTblColIndex_User] = user.User
			row[tablesPrivTblColIndex_Host] = user.Host
			row[tablesPrivTblColIndex_Db] = dbSet.Name()
			row[tablesPrivTblColIndex_Table_name] = tblSet.Name()

			var privs []string
			for _, priv := range tblSet.ToSlice() {
				switch priv {
				case sql.PrivilegeType_Select:
					privs = append(privs, "Select")
				case sql.PrivilegeType_Insert:
					privs = append(privs, "Insert")
				case sql.PrivilegeType_Update:
					privs = append(privs, "Update")
				case sql.PrivilegeType_Delete:
					privs = append(privs, "Delete")
				case sql.PrivilegeType_Create:
					privs = append(privs, "Create")
				case sql.PrivilegeType_Drop:
					privs = append(privs, "Drop")
				case sql.PrivilegeType_GrantOption:
					privs = append(privs, "Grant")
				case sql.PrivilegeType_References:
					privs = append(privs, "References")
				case sql.PrivilegeType_Index:
					privs = append(privs, "Index")
				case sql.PrivilegeType_Alter:
					privs = append(privs, "Alter")
				case sql.PrivilegeType_CreateView:
					privs = append(privs, "Create View")
				case sql.PrivilegeType_ShowView:
					privs = append(privs, "Show view")
				case sql.PrivilegeType_Trigger:
					privs = append(privs, "Trigger")
				}
			}
			formattedSet, _, err := tablesPrivTblSchema[tablesPrivTblColIndex_Table_priv].Type.Convert(ctx, strings.Join(privs, ","))
			if err != nil {
				return nil, err
			}
			row[tablesPrivTblColIndex_Table_priv] = formattedSet.(uint64)
			rows = append(rows, row)
		}
	}

	return rows, nil
}

func NewUserTablesIndexedSetTable(set in_mem_table.IndexedSet[*User], lock, rlock sync.Locker) *in_mem_table.MultiIndexedSetTable[*User] {
	table := in_mem_table.NewMultiIndexedSetTable[*User](
		tablesPrivTblName,
		tablesPrivTblSchema,
		sql.Collation_utf8mb3_bin,
		set,
		in_mem_table.MultiValueOps[*User]{
			ToRows:    UserToTablesRows,
			FromRow:   UserFromTablesRow,
			AddRow:    UserAddTablesRow,
			DeleteRow: UserRemoveTablesRow,
		},
		lock,
		rlock,
	)
	return table
}

// init creates the schema for the "tables_priv" Grant Table.
func init() {
	// Types
	char32_utf8_bin := types.MustCreateString(sqltypes.Char, 32, sql.Collation_utf8_bin)
	char64_utf8_bin := types.MustCreateString(sqltypes.Char, 64, sql.Collation_utf8_bin)
	char255_ascii_general_ci := types.MustCreateString(sqltypes.Char, 255, sql.Collation_ascii_general_ci)
	set_ColumnPrivs_utf8_general_ci := types.MustCreateSetType([]string{"Select", "Insert", "Update", "References"}, sql.Collation_utf8_general_ci)
	set_TablePrivs_utf8_general_ci := types.MustCreateSetType([]string{
		"Select", "Insert", "Update", "Delete", "Create", "Drop", "Grant",
		"References", "Index", "Alter", "Create View", "Show view", "Trigger"}, sql.Collation_utf8_general_ci)
	varchar288_utf8_bin := types.MustCreateString(sqltypes.VarChar, 288, sql.Collation_utf8_bin)

	// Column Templates
	char32_utf8_bin_not_null_default_empty := &sql.Column{
		Type:     char32_utf8_bin,
		Default:  mustDefault(expression.NewLiteral("", char32_utf8_bin), char32_utf8_bin, true, false),
		Nullable: false,
	}
	char64_utf8_bin_not_null_default_empty := &sql.Column{
		Type:     char64_utf8_bin,
		Default:  mustDefault(expression.NewLiteral("", char64_utf8_bin), char64_utf8_bin, true, false),
		Nullable: false,
	}
	char255_ascii_general_ci_not_null_default_empty := &sql.Column{
		Type:     char255_ascii_general_ci,
		Default:  mustDefault(expression.NewLiteral("", char255_ascii_general_ci), char255_ascii_general_ci, true, false),
		Nullable: false,
	}
	set_ColumnPrivs_utf8_general_ci_not_null_default_empty := &sql.Column{
		Type:     set_ColumnPrivs_utf8_general_ci,
		Default:  mustDefault(expression.NewLiteral("", set_ColumnPrivs_utf8_general_ci), set_ColumnPrivs_utf8_general_ci, true, false),
		Nullable: false,
	}
	set_TablePrivs_utf8_general_ci_not_null_default_empty := &sql.Column{
		Type:     set_TablePrivs_utf8_general_ci,
		Default:  mustDefault(expression.NewLiteral("", set_TablePrivs_utf8_general_ci), set_TablePrivs_utf8_general_ci, true, false),
		Nullable: false,
	}
	timestamp_not_null_default_epoch := &sql.Column{
		Type:     types.Timestamp,
		Default:  mustDefault(expression.NewLiteral(time.Unix(1, 0).UTC(), types.Timestamp), types.Timestamp, true, false),
		Nullable: false,
	}
	varchar288_utf8_bin_not_null_default_empty := &sql.Column{
		Type:     varchar288_utf8_bin,
		Default:  mustDefault(expression.NewLiteral("", varchar288_utf8_bin), varchar288_utf8_bin, true, false),
		Nullable: false,
	}

	tablesPrivTblSchema = sql.Schema{
		columnTemplate("Host", tablesPrivTblName, true, char255_ascii_general_ci_not_null_default_empty),
		columnTemplate("Db", tablesPrivTblName, true, char64_utf8_bin_not_null_default_empty),
		columnTemplate("User", tablesPrivTblName, true, char32_utf8_bin_not_null_default_empty),
		columnTemplate("Table_name", tablesPrivTblName, true, char64_utf8_bin_not_null_default_empty),
		columnTemplate("Grantor", tablesPrivTblName, false, varchar288_utf8_bin_not_null_default_empty),
		columnTemplate("Timestamp", tablesPrivTblName, false, timestamp_not_null_default_epoch),
		columnTemplate("Table_priv", tablesPrivTblName, false, set_TablePrivs_utf8_general_ci_not_null_default_empty),
		columnTemplate("Column_priv", tablesPrivTblName, false, set_ColumnPrivs_utf8_general_ci_not_null_default_empty),
	}
}

// These represent the column indexes of the "tables_priv" Grant Table.
const (
	tablesPrivTblColIndex_Host int = iota
	tablesPrivTblColIndex_Db
	tablesPrivTblColIndex_User
	tablesPrivTblColIndex_Table_name
	tablesPrivTblColIndex_Grantor
	tablesPrivTblColIndex_Timestamp
	tablesPrivTblColIndex_Table_priv
	tablesPrivTblColIndex_Column_priv
)
