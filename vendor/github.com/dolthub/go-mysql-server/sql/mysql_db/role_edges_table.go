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
	"sync"

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/in_mem_table"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const roleEdgesTblName = "role_edges"

var (
	errRoleEdgePkEntry = fmt.Errorf("the primary key for the `role_edges` table was given an unknown entry")
	errRoleEdgePkRow   = fmt.Errorf("the primary key for the `role_edges` table was given a row belonging to an unknown schema")
	errRoleEdgeFkEntry = fmt.Errorf("the `from` secondary key for the `role_edges` table was given an unknown entry")
	errRoleEdgeFkRow   = fmt.Errorf("the `from` secondary key for the `role_edges` table was given a row belonging to an unknown schema")
	errRoleEdgeTkEntry = fmt.Errorf("the `to` secondary key for the `role_edges` table was given an unknown entry")
	errRoleEdgeTkRow   = fmt.Errorf("the `to` secondary key for the `role_edges` table was given a row belonging to an unknown schema")

	roleEdgesTblSchema sql.Schema
)

// RoleEdgesPrimaryKey is a key that represents the primary key for the "role_edges" Grant Table.
type RoleEdgesPrimaryKey struct {
	FromHost string
	FromUser string
	ToHost   string
	ToUser   string
}

// RoleEdgesFromKey is a secondary key that represents the "from" columns on the "role_edges" Grant Table.
type RoleEdgesFromKey struct {
	FromHost string
	FromUser string
}

// RoleEdgesToKey is a secondary key that represents the "to" columns on the "role_edges" Grant Table.
type RoleEdgesToKey struct {
	ToHost string
	ToUser string
}

type RoleEdgePrimaryKeyer struct{}
type RoleEdgeToKeyer struct{}
type RoleEdgeFromKeyer struct{}

var _ in_mem_table.Keyer[*RoleEdge] = RoleEdgePrimaryKeyer{}
var _ in_mem_table.Keyer[*RoleEdge] = RoleEdgeToKeyer{}
var _ in_mem_table.Keyer[*RoleEdge] = RoleEdgeFromKeyer{}

func (RoleEdgePrimaryKeyer) GetKey(r *RoleEdge) any {
	return RoleEdgesPrimaryKey{
		FromHost: r.FromHost,
		FromUser: r.FromUser,
		ToHost:   r.ToHost,
		ToUser:   r.ToUser,
	}
}

func (RoleEdgeToKeyer) GetKey(r *RoleEdge) any {
	return RoleEdgesToKey{
		ToHost: r.ToHost,
		ToUser: r.ToUser,
	}
}

func (RoleEdgeFromKeyer) GetKey(r *RoleEdge) any {
	return RoleEdgesFromKey{
		FromHost: r.FromHost,
		FromUser: r.FromUser,
	}
}

func NewRoleEdgesIndexedSetTable(lock, rlock sync.Locker) *in_mem_table.IndexedSetTable[*RoleEdge] {
	set := in_mem_table.NewIndexedSet[*RoleEdge](
		RoleEdgeEquals,
		[]in_mem_table.Keyer[*RoleEdge]{
			RoleEdgePrimaryKeyer{},
			RoleEdgeToKeyer{},
			RoleEdgeFromKeyer{},
		},
	)
	table := in_mem_table.NewIndexedSetTable[*RoleEdge](
		roleEdgesTblName,
		roleEdgesTblSchema,
		sql.Collation_utf8mb3_bin,
		set,
		RoleEdgeOps,
		lock,
		rlock,
	)
	return table
}

// init creates the schema for the "role_edges" Grant Table.
func init() {
	// Types
	char32_utf8_bin := types.MustCreateString(sqltypes.Char, 32, sql.Collation_utf8_bin)
	char255_ascii_general_ci := types.MustCreateString(sqltypes.Char, 255, sql.Collation_ascii_general_ci)
	enum_N_Y_utf8_general_ci := types.MustCreateEnumType([]string{"N", "Y"}, sql.Collation_utf8_general_ci)

	// Column Templates
	char32_utf8_bin_not_null_default_empty := &sql.Column{
		Type:     char32_utf8_bin,
		Default:  mustDefault(expression.NewLiteral("", char32_utf8_bin), char32_utf8_bin, true, false),
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

	roleEdgesTblSchema = sql.Schema{
		columnTemplate("FROM_HOST", roleEdgesTblName, true, char255_ascii_general_ci_not_null_default_empty),
		columnTemplate("FROM_USER", roleEdgesTblName, true, char32_utf8_bin_not_null_default_empty),
		columnTemplate("TO_HOST", roleEdgesTblName, true, char255_ascii_general_ci_not_null_default_empty),
		columnTemplate("TO_USER", roleEdgesTblName, true, char32_utf8_bin_not_null_default_empty),
		columnTemplate("WITH_ADMIN_OPTION", roleEdgesTblName, false, enum_N_Y_utf8_general_ci_not_null_default_N),
	}
}

// These represent the column indexes of the "role_edges" Grant Table.
const (
	roleEdgesTblColIndex_FROM_HOST int = iota
	roleEdgesTblColIndex_FROM_USER
	roleEdgesTblColIndex_TO_HOST
	roleEdgesTblColIndex_TO_USER
	roleEdgesTblColIndex_WITH_ADMIN_OPTION
)
