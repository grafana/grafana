// Copyright 2020-2021 Dolthub, Inc.
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
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type ShowCreateProcedure struct {
	db                      sql.Database
	ExternalStoredProcedure *sql.ExternalStoredProcedureDetails
	ProcedureName           string
}

var _ sql.Databaser = (*ShowCreateProcedure)(nil)
var _ sql.Node = (*ShowCreateProcedure)(nil)
var _ sql.CollationCoercible = (*ShowCreateProcedure)(nil)

var showCreateProcedureSchema = sql.Schema{
	&sql.Column{Name: "Procedure", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "sql_mode", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Create Procedure", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "character_set_client", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "collation_connection", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Database Collation", Type: types.LongText, Nullable: false},
}

// NewShowCreateProcedure creates a new ShowCreateProcedure node for SHOW CREATE PROCEDURE statements.
func NewShowCreateProcedure(db sql.Database, procedure string) *ShowCreateProcedure {
	return &ShowCreateProcedure{
		db:            db,
		ProcedureName: strings.ToLower(procedure),
	}
}

// String implements the sql.Node interface.
func (s *ShowCreateProcedure) String() string {
	return fmt.Sprintf("SHOW CREATE PROCEDURE %s", s.ProcedureName)
}

// Resolved implements the sql.Node interface.
func (s *ShowCreateProcedure) Resolved() bool {
	_, ok := s.db.(sql.UnresolvedDatabase)
	return !ok
}

func (s *ShowCreateProcedure) IsReadOnly() bool {
	return true
}

// Children implements the sql.Node interface.
func (s *ShowCreateProcedure) Children() []sql.Node {
	return nil
}

// Schema implements the sql.Node interface.
func (s *ShowCreateProcedure) Schema() sql.Schema {
	return showCreateProcedureSchema
}

// RowIter implements the sql.Node interface.
func (s *ShowCreateProcedure) RowIter(ctx *sql.Context, _ sql.Row) (sql.RowIter, error) {
	characterSetClient, err := ctx.GetSessionVariable(ctx, "character_set_client")
	if err != nil {
		return nil, err
	}
	collationConnection, err := ctx.GetSessionVariable(ctx, "collation_connection")
	if err != nil {
		return nil, err
	}
	collationServer, err := ctx.GetSessionVariable(ctx, "collation_server")
	if err != nil {
		return nil, err
	}

	if s.ExternalStoredProcedure != nil {
		// If an external stored procedure has been plugged in by the analyzer, use that
		fakeCreateProcedureStmt := s.ExternalStoredProcedure.FakeCreateProcedureStmt()
		return sql.RowsToRowIter(sql.Row{
			s.ExternalStoredProcedure.Name, // Procedure
			"",                             // sql_mode
			fakeCreateProcedureStmt,        // Create Procedure
			characterSetClient,             // character_set_client
			collationConnection,            // collation_connection
			collationServer,                // Database Collation
		}), nil
	} else {
		// Otherwise, search the StoredProcedureDatabase for a user-created stored procedure
		procedureDb, ok := s.db.(sql.StoredProcedureDatabase)
		if !ok {
			return nil, sql.ErrStoredProceduresNotSupported.New(s.db.Name())
		}
		procedures, err := procedureDb.GetStoredProcedures(ctx)
		if err != nil {
			return nil, err
		}
		for _, procedure := range procedures {
			if strings.ToLower(procedure.Name) == s.ProcedureName {
				return sql.RowsToRowIter(sql.Row{
					procedure.Name,            // Procedure
					"",                        // sql_mode
					procedure.CreateStatement, // Create Procedure
					characterSetClient,        // character_set_client
					collationConnection,       // collation_connection
					collationServer,           // Database Collation
				}), nil
			}
		}
		return nil, sql.ErrStoredProcedureDoesNotExist.New(s.ProcedureName)
	}
}

// WithChildren implements the sql.Node interface.
func (s *ShowCreateProcedure) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(s, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowCreateProcedure) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Database implements the sql.Databaser interface.
func (s *ShowCreateProcedure) Database() sql.Database {
	return s.db
}

// WithDatabase implements the sql.Databaser interface.
func (s *ShowCreateProcedure) WithDatabase(db sql.Database) (sql.Node, error) {
	ns := *s
	ns.db = db
	return &ns, nil
}

// WithExternalStoredProcedure returns a new ShowCreateProcedure node with the specified external stored procedure set
// as the procedure to be shown.
func (s *ShowCreateProcedure) WithExternalStoredProcedure(procedure sql.ExternalStoredProcedureDetails) sql.Node {
	ns := *s
	ns.ExternalStoredProcedure = &procedure
	return &ns
}
