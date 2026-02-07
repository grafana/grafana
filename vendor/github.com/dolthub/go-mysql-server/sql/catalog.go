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

package sql

type Catalog interface {
	DatabaseProvider
	FunctionProvider
	TableFunctionProvider
	ExternalStoredProcedureProvider
	StatsProvider

	// CreateDatabase creates a new database, or returns an error if the operation isn't supported or fails.
	CreateDatabase(ctx *Context, dbName string, collation CollationID) error

	// RemoveDatabase removes the  database named, or returns an error if the operation isn't supported or fails.
	RemoveDatabase(ctx *Context, dbName string) error

	// Table returns the table with the name given in the db with the name given
	Table(ctx *Context, dbName, tableName string) (Table, Database, error)

	// DatabaseTable returns the table with the name given in the db given
	DatabaseTable(ctx *Context, db Database, tableName string) (Table, Database, error)

	// TableAsOf returns the table with the name given in the db with the name given, as of the given marker
	TableAsOf(ctx *Context, dbName, tableName string, asOf interface{}) (Table, Database, error)

	// DatabaseTableAsOf returns the table with the name given in the db given, as of the given marker
	DatabaseTableAsOf(ctx *Context, db Database, tableName string, asOf interface{}) (Table, Database, error)

	// LockTable locks the table named
	LockTable(ctx *Context, table string)

	// UnlockTables unlocks all tables locked by the session id given
	UnlockTables(ctx *Context, id uint32) error

	// AuthorizationHandler returns the AuthorizationHandler that is used by the catalog.
	AuthorizationHandler() AuthorizationHandler
}

// CatalogTable is a Table that depends on a Catalog.
type CatalogTable interface {
	Table

	// AssignCatalog assigns a Catalog to the table.
	AssignCatalog(cat Catalog) Table
}
