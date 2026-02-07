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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type ShowEvents struct {
	db     sql.Database
	Events []sql.EventDefinition
}

var _ sql.Databaser = (*ShowEvents)(nil)
var _ sql.Node = (*ShowEvents)(nil)
var _ sql.CollationCoercible = (*ShowEvents)(nil)

var showEventsSchema = sql.Schema{
	&sql.Column{Name: "Db", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Name", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Definer", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Time zone", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Type", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Execute At", Type: types.Datetime, Nullable: false},
	&sql.Column{Name: "Interval Value", Type: types.Uint64, Nullable: false},
	&sql.Column{Name: "Interval Field", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Starts", Type: types.Datetime, Nullable: false},
	&sql.Column{Name: "Ends", Type: types.Datetime, Nullable: false},
	&sql.Column{Name: "Status", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Originator", Type: types.Uint64, Nullable: false},
	&sql.Column{Name: "character_set_client", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "collation_connection", Type: types.LongText, Nullable: false},
	&sql.Column{Name: "Database Collation", Type: types.LongText, Nullable: false},
}

// NewShowEvents creates a new ShowEvents node for SHOW EVENTS statements.
func NewShowEvents(db sql.Database) *ShowEvents {
	return &ShowEvents{
		db: db,
	}
}

// String implements the sql.Node interface.
func (s *ShowEvents) String() string {
	return "SHOW EVENTS"
}

func (s *ShowEvents) IsReadOnly() bool {
	return true
}

// Resolved implements the sql.Node interface.
func (s *ShowEvents) Resolved() bool {
	_, ok := s.db.(sql.UnresolvedDatabase)
	return !ok
}

// Children implements the sql.Node interface.
func (s *ShowEvents) Children() []sql.Node {
	return nil
}

// Schema implements the sql.Node interface.
func (s *ShowEvents) Schema() sql.Schema {
	return showEventsSchema
}

// RowIter implements the sql.Node interface.
func (s *ShowEvents) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	var rows []sql.Row
	dbName := s.db.Name()

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

	for _, event := range s.Events {
		eventType := "RECURRING"
		var executeAt, intervalVal, intervalField, starts, ends, status interface{}
		e := event.ConvertTimesFromUTCToTz(sql.SystemTimezoneOffset())
		if e.HasExecuteAt {
			eventType = "ONE TIME"
			executeAt = e.ExecuteAt.Format(sql.EventDateSpaceTimeFormat)
		} else {
			interval, err := sql.EventOnScheduleEveryIntervalFromString(e.ExecuteEvery)
			if err != nil {
				return nil, err
			}
			intervalVal, intervalField = interval.GetIntervalValAndField()
			// STARTS will always have defined value
			starts = e.Starts.Format(sql.EventDateSpaceTimeFormat)
			if e.HasEnds {
				ends = e.Ends.Format(sql.EventDateSpaceTimeFormat)
			}
		}

		eventStatus, err := sql.EventStatusFromString(e.Status)
		if err != nil {
			return nil, err
		}
		switch eventStatus {
		case sql.EventStatus_Enable:
			status = "ENABLED"
		case sql.EventStatus_Disable:
			status = "DISABLED"
		case sql.EventStatus_DisableOnSlave:
			status = "SLAVESIDE_DISABLED"
		}

		// TODO: Time zone and Originator are set to default for now.
		rows = append(rows, sql.Row{
			dbName,              // Db
			e.Name,              // Name
			e.Definer,           // Definer
			"SYSTEM",            // Time zone
			eventType,           // Type
			executeAt,           // Execute At
			intervalVal,         // Interval Value
			intervalField,       // Interval Field
			starts,              // Starts
			ends,                // Ends
			status,              // Status
			0,                   // Originator
			characterSetClient,  // character_set_client
			collationConnection, // collation_connection
			collationServer,     // Database Collation
		})
	}

	return sql.RowsToRowIter(rows...), nil
}

// WithChildren implements the sql.Node interface.
func (s *ShowEvents) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(s, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowEvents) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Database implements the sql.Databaser interface.
func (s *ShowEvents) Database() sql.Database {
	return s.db
}

// WithDatabase implements the sql.Databaser interface.
func (s *ShowEvents) WithDatabase(db sql.Database) (sql.Node, error) {
	ns := *s
	ns.db = db
	return &ns, nil
}
