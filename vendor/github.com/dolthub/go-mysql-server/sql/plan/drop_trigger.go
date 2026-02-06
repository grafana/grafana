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

	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

type DropTrigger struct {
	Db          sql.Database
	TriggerName string
	IfExists    bool
}

var _ sql.Databaser = (*DropTrigger)(nil)
var _ sql.Node = (*DropTrigger)(nil)
var _ sql.CollationCoercible = (*DropTrigger)(nil)

// NewDropTrigger creates a new NewDropTrigger node for DROP TRIGGER statements.
func NewDropTrigger(db sql.Database, trigger string, ifExists bool) *DropTrigger {
	return &DropTrigger{
		Db:          db,
		IfExists:    ifExists,
		TriggerName: strings.ToLower(trigger),
	}
}

// Resolved implements the sql.Node interface.
func (d *DropTrigger) Resolved() bool {
	_, ok := d.Db.(sql.UnresolvedDatabase)
	return !ok
}

func (d *DropTrigger) IsReadOnly() bool {
	return false
}

// String implements the sql.Node interface.
func (d *DropTrigger) String() string {
	ifExists := ""
	if d.IfExists {
		ifExists = "IF EXISTS "
	}
	return fmt.Sprintf("DROP TRIGGER %s%s", ifExists, d.TriggerName)
}

// Schema implements the sql.Node interface.
func (d *DropTrigger) Schema() sql.Schema {
	return types.OkResultSchema
}

// Children implements the sql.Node interface.
func (d *DropTrigger) Children() []sql.Node {
	return nil
}

// WithChildren implements the sql.Node interface.
func (d *DropTrigger) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(d, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DropTrigger) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Database implements the sql.Databaser interface.
func (d *DropTrigger) Database() sql.Database {
	return d.Db
}

// WithDatabase implements the sql.Databaser interface.
func (d *DropTrigger) WithDatabase(db sql.Database) (sql.Node, error) {
	nd := *d
	nd.Db = db
	return &nd, nil
}
