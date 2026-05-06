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

type ShowCreateTrigger struct {
	db          sql.Database
	TriggerName string
}

var _ sql.Databaser = (*ShowCreateTrigger)(nil)
var _ sql.Node = (*ShowCreateTrigger)(nil)
var _ sql.CollationCoercible = (*ShowCreateTrigger)(nil)

var showCreateTriggerSchema = sql.Schema{
	&sql.Column{Name: "Trigger", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "sql_mode", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "SQL Original Statement", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "character_set_client", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "collation_connection", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Database Collation", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Created", Type: types.Datetime, Nullable: false},
}

// NewShowCreateTrigger creates a new ShowCreateTrigger node for SHOW CREATE TRIGGER statements.
func NewShowCreateTrigger(db sql.Database, trigger string) *ShowCreateTrigger {
	return &ShowCreateTrigger{
		db:          db,
		TriggerName: strings.ToLower(trigger),
	}
}

// String implements the sql.Node interface.
func (s *ShowCreateTrigger) String() string {
	return fmt.Sprintf("SHOW CREATE TRIGGER %s", s.TriggerName)
}

// Resolved implements the sql.Node interface.
func (s *ShowCreateTrigger) Resolved() bool {
	_, ok := s.db.(sql.UnresolvedDatabase)
	return !ok
}

func (s *ShowCreateTrigger) IsReadOnly() bool {
	return true
}

// Children implements the sql.Node interface.
func (s *ShowCreateTrigger) Children() []sql.Node {
	return nil
}

// Schema implements the sql.Node interface.
func (s *ShowCreateTrigger) Schema() sql.Schema {
	return showCreateTriggerSchema
}

// WithChildren implements the sql.Node interface.
func (s *ShowCreateTrigger) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(s, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowCreateTrigger) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Database implements the sql.Databaser interface.
func (s *ShowCreateTrigger) Database() sql.Database {
	return s.db
}

// WithDatabase implements the sql.Databaser interface.
func (s *ShowCreateTrigger) WithDatabase(db sql.Database) (sql.Node, error) {
	ns := *s
	ns.db = db
	return &ns, nil
}
