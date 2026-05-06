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
	"encoding/json"
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/in_mem_table"
)

// RoleEdge represents a role to user mapping from the roles_edges Grant Table.
type RoleEdge struct {
	FromHost        string
	FromUser        string
	ToHost          string
	ToUser          string
	WithAdminOption bool
}

func RoleEdgeToRow(ctx *sql.Context, r *RoleEdge) (sql.Row, error) {
	row := make(sql.Row, len(roleEdgesTblSchema))
	row[roleEdgesTblColIndex_FROM_HOST] = r.FromHost
	row[roleEdgesTblColIndex_FROM_USER] = r.FromUser
	row[roleEdgesTblColIndex_TO_HOST] = r.ToHost
	row[roleEdgesTblColIndex_TO_USER] = r.ToUser
	if r.WithAdminOption {
		row[roleEdgesTblColIndex_WITH_ADMIN_OPTION] = uint16(2)
	} else {
		row[roleEdgesTblColIndex_WITH_ADMIN_OPTION] = uint16(1)
	}
	return row, nil
}

func RoleEdgeFromRow(ctx *sql.Context, row sql.Row) (*RoleEdge, error) {
	if err := roleEdgesTblSchema.CheckRow(ctx, row); err != nil {
		return nil, err
	}
	return &RoleEdge{
		FromHost:        row[roleEdgesTblColIndex_FROM_HOST].(string),
		FromUser:        row[roleEdgesTblColIndex_FROM_USER].(string),
		ToHost:          row[roleEdgesTblColIndex_TO_HOST].(string),
		ToUser:          row[roleEdgesTblColIndex_TO_USER].(string),
		WithAdminOption: row[roleEdgesTblColIndex_WITH_ADMIN_OPTION].(uint16) == 2,
	}, nil
}

func RoleEdgeEquals(left, right *RoleEdge) bool {
	return *left == *right
}

var RoleEdgeOps = in_mem_table.ValueOps[*RoleEdge]{
	ToRow:   RoleEdgeToRow,
	FromRow: RoleEdgeFromRow,
	UpdateWithRow: func(ctx *sql.Context, row sql.Row, e *RoleEdge) (*RoleEdge, error) {
		return RoleEdgeFromRow(ctx, row)
	},
}

// FromJson implements the interface in_mem_table.Entry.
func (r *RoleEdge) FromJson(ctx *sql.Context, jsonStr string) (*RoleEdge, error) {
	newRoleEdge := &RoleEdge{}
	if err := json.Unmarshal([]byte(jsonStr), newRoleEdge); err != nil {
		return nil, err
	}
	return newRoleEdge, nil
}

// ToJson implements the interface in_mem_table.Entry.
func (r *RoleEdge) ToJson(ctx *sql.Context) (string, error) {
	jsonData, err := json.Marshal(*r)
	if err != nil {
		return "", err
	}
	return string(jsonData), nil
}

// ToString returns the "TO" user as a formatted string using the quotes given. Using the default root
// account with the backtick as the quote, root@localhost would become `root`@`localhost`. Different quotes are used
// in different places in MySQL. In addition, if the quote is used in a section as part of the name, it is escaped by
// doubling the quote (which also mimics MySQL behavior).
func (r *RoleEdge) ToString(quote string) string {
	return r.stringWithQuote(r.ToUser, r.ToHost, quote)
}

// FromString returns the "FROM" user as a formatted string using the quotes given. Using the default root
// account with the backtick as the quote, root@localhost would become `root`@`localhost`. Different quotes are used
// in different places in MySQL. In addition, if the quote is used in a section as part of the name, it is escaped by
// doubling the quote (which also mimics MySQL behavior).
func (r *RoleEdge) FromString(quote string) string {
	return r.stringWithQuote(r.FromUser, r.FromHost, quote)
}

// stringWithQuote returns the given user as a formatted string using the quotes given. Using the default root
// account with the backtick as the quote, root@localhost would become `root`@`localhost`. Different quotes are used
// in different places in MySQL. In addition, if the quote is used in a section as part of the name, it is escaped by
// doubling the quote (which also mimics MySQL behavior).
func (r *RoleEdge) stringWithQuote(name string, host string, quote string) string {
	replacement := quote + quote
	name = strings.ReplaceAll(name, quote, replacement)
	host = strings.ReplaceAll(host, quote, replacement)
	return fmt.Sprintf("%s%s%s@%s%s%s", quote, name, quote, quote, host, quote)
}
