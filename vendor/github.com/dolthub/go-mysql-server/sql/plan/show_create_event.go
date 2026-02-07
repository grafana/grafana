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

package plan

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type ShowCreateEvent struct {
	db    sql.Database
	Event sql.EventDefinition
}

var _ sql.Databaser = (*ShowCreateEvent)(nil)
var _ sql.Node = (*ShowCreateEvent)(nil)
var _ sql.CollationCoercible = (*ShowCreateEvent)(nil)

var showCreateEventSchema = sql.Schema{
	&sql.Column{Name: "Event", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "sql_mode", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "time_zone", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Create Event", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "character_set_client", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "collation_connection", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Database Collation", Type: types.LongText, Nullable: false},
}

// NewShowCreateEvent creates a new ShowCreateEvent node for SHOW CREATE EVENT statements.
func NewShowCreateEvent(db sql.Database, event sql.EventDefinition) *ShowCreateEvent {
	return &ShowCreateEvent{
		db:    db,
		Event: event,
	}
}

// String implements the sql.Node interface.
func (s *ShowCreateEvent) String() string {
	return fmt.Sprintf("SHOW CREATE EVENT %s", s.Event.Name)
}

// Resolved implements the sql.Node interface.
func (s *ShowCreateEvent) Resolved() bool {
	_, ok := s.db.(sql.UnresolvedDatabase)
	return !ok
}

func (s *ShowCreateEvent) IsReadOnly() bool {
	return true
}

// Children implements the sql.Node interface.
func (s *ShowCreateEvent) Children() []sql.Node {
	return nil
}

// Schema implements the sql.Node interface.
func (s *ShowCreateEvent) Schema() sql.Schema {
	return showCreateEventSchema
}

// WithChildren implements the sql.Node interface.
func (s *ShowCreateEvent) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(s, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowCreateEvent) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Database implements the sql.Databaser interface.
func (s *ShowCreateEvent) Database() sql.Database {
	return s.db
}

// WithDatabase implements the sql.Databaser interface.
func (s *ShowCreateEvent) WithDatabase(db sql.Database) (sql.Node, error) {
	ns := *s
	ns.db = db
	return &ns, nil
}
