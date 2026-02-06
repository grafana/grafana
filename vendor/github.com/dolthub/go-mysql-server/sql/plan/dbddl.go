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
	"fmt"

	"github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// CreateDB creates a database in the Catalog.
type CreateDB struct {
	Catalog     sql.Catalog
	DbName      string
	IfNotExists bool
	Collation   sql.CollationID
}

var _ sql.Node = (*CreateDB)(nil)
var _ sql.CollationCoercible = (*CreateDB)(nil)

func (c *CreateDB) Resolved() bool {
	return true
}

func (c *CreateDB) IsReadOnly() bool {
	return false
}

func (c *CreateDB) String() string {
	ifNotExists := ""
	if c.IfNotExists {
		ifNotExists = " if not exists"
	}
	return fmt.Sprintf("%s database%s %v", sqlparser.CreateStr, ifNotExists, c.DbName)
}

func (c *CreateDB) Schema() sql.Schema {
	return types.OkResultSchema
}

func (c *CreateDB) Children() []sql.Node {
	return nil
}

func (c *CreateDB) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(c, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*CreateDB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Database returns the name of the database that will be used.
func (c *CreateDB) Database() string {
	return c.DbName
}

func NewCreateDatabase(dbName string, ifNotExists bool, collation sql.CollationID) *CreateDB {
	return &CreateDB{
		DbName:      dbName,
		IfNotExists: ifNotExists,
		Collation:   collation,
	}
}

// CreateSchema creates a schema in the Catalog using the currently selected database.
type CreateSchema struct {
	*CreateDB
}

var _ sql.Node = (*CreateSchema)(nil)
var _ sql.CollationCoercible = (*CreateSchema)(nil)

func NewCreateSchema(schemaName string, ifNotExists bool, collation sql.CollationID) *CreateSchema {
	return &CreateSchema{
		&CreateDB{
			DbName:      schemaName,
			IfNotExists: ifNotExists,
			Collation:   collation,
		},
	}
}

func (c *CreateSchema) String() string {
	ifNotExists := ""
	if c.IfNotExists {
		ifNotExists = " if not exists"
	}
	return fmt.Sprintf("%s schema%s %v", sqlparser.CreateStr, ifNotExists, c.DbName)
}

func (c *CreateSchema) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(c, children...)
}

// DropDB removes a databases from the Catalog and updates the active database if it gets removed itself.
type DropDB struct {
	Catalog sql.Catalog
	// EventScheduler is used to notify EventSchedulerStatus of database deletion,
	// so the events of this database in the scheduler will be removed.
	Scheduler sql.EventScheduler
	DbName    string
	IfExists  bool
}

var _ sql.Node = (*DropDB)(nil)
var _ sql.CollationCoercible = (*DropDB)(nil)

func (d *DropDB) Resolved() bool {
	return true
}

func (d *DropDB) IsReadOnly() bool {
	return false
}

func (d *DropDB) String() string {
	ifExists := ""
	if d.IfExists {
		ifExists = " if exists"
	}
	return fmt.Sprintf("%s database%s %v", sqlparser.DropStr, ifExists, d.DbName)
}

func (d *DropDB) Schema() sql.Schema {
	return types.OkResultSchema
}

func (d *DropDB) Children() []sql.Node {
	return nil
}

func (d *DropDB) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(d, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DropDB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func NewDropDatabase(dbName string, ifExists bool) *DropDB {
	return &DropDB{
		DbName:   dbName,
		IfExists: ifExists,
	}
}

// AlterDB alters a database from the Catalog.
type AlterDB struct {
	Catalog   sql.Catalog
	dbName    string
	Collation sql.CollationID
}

var _ sql.Node = (*AlterDB)(nil)
var _ sql.CollationCoercible = (*AlterDB)(nil)

// Resolved implements the interface sql.Node.
func (c *AlterDB) Resolved() bool {
	return true
}

func (c *AlterDB) IsReadOnly() bool {
	return false
}

// String implements the interface sql.Node.
func (c *AlterDB) String() string {
	var dbName string
	if len(c.dbName) > 0 {
		dbName = fmt.Sprintf(" %s", c.dbName)
	}
	return fmt.Sprintf("%s database%s collate %s", sqlparser.AlterStr, dbName, c.Collation.Name())
}

// Schema implements the interface sql.Node.
func (c *AlterDB) Schema() sql.Schema {
	return types.OkResultSchema
}

// Children implements the interface sql.Node.
func (c *AlterDB) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (c *AlterDB) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(c, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*AlterDB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Database returns the name of the database that will be used.
func (c *AlterDB) Database(ctx *sql.Context) string {
	if len(c.dbName) == 0 {
		return ctx.GetCurrentDatabase()
	}
	return c.dbName
}

// NewAlterDatabase returns a new AlterDB.
func NewAlterDatabase(dbName string, collation sql.CollationID) *AlterDB {
	return &AlterDB{
		dbName:    dbName,
		Collation: collation,
	}
}

// GetDatabaseCollation returns a database's collation. Also handles when a database does not explicitly support collations.
func GetDatabaseCollation(ctx *sql.Context, db sql.Database) sql.CollationID {
	collatedDb, ok := db.(sql.CollatedDatabase)
	if !ok {
		return sql.Collation_Default
	}
	collation := collatedDb.GetCollation(ctx)
	if collation == sql.Collation_Unspecified {
		return sql.Collation_Default
	}
	return collation
}
