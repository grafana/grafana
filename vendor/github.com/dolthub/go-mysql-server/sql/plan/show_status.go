// Copyright 2021 Dolthub, Inc.
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

package plan

import (
	"sort"

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const ShowStatusVariableCol = "Variable_name"
const ShowStatusValueCol = "Value"

// ShowStatus implements the SHOW STATUS MySQL command.
type ShowStatus struct {
	isGlobal bool
}

var _ sql.Node = (*ShowStatus)(nil)
var _ sql.CollationCoercible = (*ShowStatus)(nil)

// NewShowStatus returns a new ShowStatus reference.
func NewShowStatus(isGlobal bool) *ShowStatus {
	return &ShowStatus{isGlobal: isGlobal}
}

// Resolved implements sql.Node interface.
func (s *ShowStatus) Resolved() bool {
	return true
}

// IsReadOnly implements sql.Node interface.
func (s *ShowStatus) IsReadOnly() bool {
	return true
}

// String implements sql.Node interface.
func (s *ShowStatus) String() string {
	return "SHOW STATUS"
}

// Schema implements sql.Node interface.
func (s *ShowStatus) Schema() sql.Schema {
	return sql.Schema{
		{
			Name: ShowStatusVariableCol,
			// MySQL stores session/global variables under special tables
			// performance_schema.session_table and performance_schema.global_table with case-insensitive collation
			// We currently don't have these tables, so we modify the schema to emulate the case-insensitive LIKE behavior
			Type:     types.MustCreateString(sqltypes.VarChar, 64, sql.Collation_utf8mb4_0900_ai_ci),
			Default:  nil,
			Nullable: false,
		},
		{
			Name:     ShowStatusValueCol,
			Type:     types.MustCreateStringWithDefaults(sqltypes.VarChar, 2048),
			Default:  nil,
			Nullable: false,
		},
	}
}

// Children implements sql.Node interface.
func (s *ShowStatus) Children() []sql.Node {
	return nil
}

// RowIter implements sql.Node interface.
func (s *ShowStatus) RowIter(ctx *sql.Context, _ sql.Row) (sql.RowIter, error) {
	// Session scope has visibility into both GLOBAL and SESSION variables.
	// Global scope has visibility only into GLOBAL variables.
	vars := sql.StatusVariables.NewGlobalMap()
	if !s.isGlobal {
		// Variables with both GLOBAL and SESSION scope are overridden by SESSION scope.
		sessVars := ctx.Session.GetAllStatusVariables(ctx)
		for name, v := range sessVars {
			vars[name] = v
		}
	}

	names := make([]string, 0, len(vars))
	for name := range vars {
		names = append(names, name)
	}
	sort.Strings(names)

	rows := make([]sql.Row, len(names))
	for i, name := range names {
		rows[i] = sql.Row{name, vars[name].Value()}
	}
	return sql.RowsToRowIter(rows...), nil
}

// WithChildren implements sql.Node interface.
func (s *ShowStatus) WithChildren(node ...sql.Node) (sql.Node, error) {
	return NewShowStatus(s.isGlobal), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowStatus) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
