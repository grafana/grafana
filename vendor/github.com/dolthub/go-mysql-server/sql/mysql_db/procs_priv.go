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
	"strings"
	"sync"
	"time"

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/in_mem_table"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const procsPrivTblName = "procs_priv"

var procsPrivTblSchema = buildProcsPrivSchema()

func NewUserProcsIndexedSetTable(set in_mem_table.IndexedSet[*User], lock, rlock sync.Locker) *in_mem_table.MultiIndexedSetTable[*User] {
	table := in_mem_table.NewMultiIndexedSetTable[*User](
		procsPrivTblName,
		procsPrivTblSchema,
		sql.Collation_utf8mb3_bin,
		set,
		in_mem_table.MultiValueOps[*User]{
			ToRows:    UserToProcsPrivRows,
			FromRow:   UserFromProcsPrivRow,
			AddRow:    UserAddProcsPrivRow,
			DeleteRow: UserRemoveProcsPrivRow,
		},
		lock,
		rlock,
	)
	return table
}

func newEmptyRow(ctx *sql.Context) sql.Row {
	row := make(sql.Row, len(procsPrivTblSchema))
	var err error
	for i, col := range procsPrivTblSchema {
		row[i], err = col.Default.Eval(ctx, nil)
		if err != nil {
			panic(err) // Schema is static. New rows should never fail.
		}
	}
	return row
}

func UserToProcsPrivRows(ctx *sql.Context, user *User) ([]sql.Row, error) {

	var ans []sql.Row
	for _, dbSet := range user.PrivilegeSet.GetDatabases() {
		for _, routineSet := range dbSet.GetRoutines() {
			if routineSet.Count() == 0 {
				continue
			}
			row := newEmptyRow(ctx)

			row[procsPrivTblColIndex_Host] = user.Host
			row[procsPrivTblColIndex_Db] = dbSet.Name()
			row[procsPrivTblColIndex_User] = user.User
			row[procsPrivTblColIndex_RoutineName] = routineSet.RoutineName()
			row[procsPrivTblColIndex_RoutineType] = routineSet.RoutineType()

			var privs []string
			for _, priv := range routineSet.ToSlice() {
				switch priv {
				case sql.PrivilegeType_Execute:
					privs = append(privs, "Execute")
				case sql.PrivilegeType_GrantOption:
					privs = append(privs, "Grant") // MySQL prints just "Grant", and not "Grant Option"
				case sql.PrivilegeType_AlterRoutine:
					privs = append(privs, "Alter Routine")
				}
			}
			privsStr := strings.Join(privs, ",")
			row[procsPrivTblColIndex_ProcPriv] = privsStr

			ans = append(ans, row)
		}
	}

	return ans, nil
}

func UserFromProcsPrivRow(ctx *sql.Context, row sql.Row) (*User, error) {
	panic("implement me") // Currently inaccessible code path.
}

func UserAddProcsPrivRow(ctx *sql.Context, row sql.Row, user *User) (*User, error) {
	panic("implement me") // Currently inaccessible code path.
}

func UserRemoveProcsPrivRow(ctx *sql.Context, row sql.Row, user *User) (*User, error) {
	panic("implement me") // Currently inaccessible code path.
}

// buildProcsPrivSchema builds the schema for the "procs_priv" Grant Table.
// MySQL Table for reference:
//
// mysql> show create table mysql.procs_priv:
//
// CREATE TABLE `procs_priv` (
//
//	 `Host` char(255) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT '',
//	 `Db` char(64) COLLATE utf8mb3_bin NOT NULL DEFAULT '',
//	 `User` char(32) COLLATE utf8mb3_bin NOT NULL DEFAULT '',
//	 `Routine_name` char(64) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '',
//	 `Routine_type` enum('FUNCTION','PROCEDURE') COLLATE utf8mb3_bin NOT NULL,
//	 `Grantor` varchar(288) COLLATE utf8mb3_bin NOT NULL DEFAULT '',
//	 `Proc_priv` set('Execute','Alter Routine','Grant') CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '',
//	 `Timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//	 PRIMARY KEY (`Host`,`User`,`Db`,`Routine_name`,`Routine_type`),
//	 KEY `Grantor` (`Grantor`
//	)
func buildProcsPrivSchema() sql.Schema {
	len255_asciii := types.MustCreateString(sqltypes.Char, 255, sql.Collation_ascii_general_ci)
	len64_utf8_bin := types.MustCreateString(sqltypes.Char, 64, sql.Collation_utf8_bin)
	len64_utf8_gen := types.MustCreateString(sqltypes.Char, 64, sql.Collation_utf8_general_ci)
	len32_utf8 := types.MustCreateString(sqltypes.Char, 32, sql.Collation_utf8_bin)
	routine_types_enum := types.MustCreateEnumType([]string{"FUNCTION", "PROCEDURE"}, sql.Collation_utf8_bin)
	varchar288_utf8 := types.MustCreateString(sqltypes.VarChar, 288, sql.Collation_utf8_bin)
	set_privs := types.MustCreateSetType([]string{"Execute", "Alter Routine", "Grant"}, sql.Collation_utf8_general_ci)

	return sql.Schema{
		columnTemplate("Host", procsPrivTblName, true, &sql.Column{
			Type:     len255_asciii,
			Default:  mustDefault(expression.NewLiteral("", len255_asciii), len255_asciii, true, false),
			Nullable: false}),
		columnTemplate("Db", procsPrivTblName, true, &sql.Column{
			Type:     len64_utf8_bin,
			Default:  mustDefault(expression.NewLiteral("", len64_utf8_bin), len64_utf8_bin, true, false),
			Nullable: false}),
		columnTemplate("User", procsPrivTblName, true, &sql.Column{
			Type:     len32_utf8,
			Default:  mustDefault(expression.NewLiteral("", len32_utf8), len32_utf8, true, false),
			Nullable: false}),
		columnTemplate("Routine_name", procsPrivTblName, true, &sql.Column{
			Type:     len64_utf8_gen,
			Default:  mustDefault(expression.NewLiteral("", len64_utf8_gen), len64_utf8_gen, true, false),
			Nullable: false}),
		columnTemplate("Routine_type", procsPrivTblName, true, &sql.Column{
			Type:     routine_types_enum,
			Default:  mustDefault(expression.NewLiteral("PROCEDURE", routine_types_enum), routine_types_enum, true, false),
			Nullable: false}),
		columnTemplate("Grantor", procsPrivTblName, false, &sql.Column{
			Type:     varchar288_utf8,
			Default:  mustDefault(expression.NewLiteral("", varchar288_utf8), varchar288_utf8, true, false),
			Nullable: false}),
		columnTemplate("Proc_priv", procsPrivTblName, false, &sql.Column{
			Type:     set_privs,
			Default:  mustDefault(expression.NewLiteral("", set_privs), set_privs, true, false),
			Nullable: false}),
		columnTemplate("Timestamp", tablesPrivTblName, false, &sql.Column{
			Type:     types.Timestamp,
			Default:  mustDefault(expression.NewLiteral(time.Unix(1, 0).UTC(), types.Timestamp), types.Timestamp, true, false),
			Nullable: false}),
	}
}

// The column indexes of the "procs_priv" Grant Table.
// https://dev.mysql.com/doc/refman/8.0/en/grant-tables.html#grant-tables-procs-priv
// https://mariadb.com/kb/en/mysqlprocs_priv-table/
const (
	procsPrivTblColIndex_Host int = iota
	procsPrivTblColIndex_Db
	procsPrivTblColIndex_User
	procsPrivTblColIndex_RoutineName
	procsPrivTblColIndex_RoutineType
	procsPrivTblColIndex_Grantor
	procsPrivTblColIndex_ProcPriv
	procsPrivTblColIndex_Timestamp
)
