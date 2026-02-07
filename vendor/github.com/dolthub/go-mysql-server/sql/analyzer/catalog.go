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

package analyzer

import (
	"fmt"
	"strings"
	"sync"

	"github.com/dolthub/go-mysql-server/internal/similartext"
	"github.com/dolthub/go-mysql-server/memory"
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/binlogreplication"
	"github.com/dolthub/go-mysql-server/sql/expression/function"
	"github.com/dolthub/go-mysql-server/sql/information_schema"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
)

type Catalog struct {
	InfoSchema    sql.Database
	StatsProvider sql.StatsProvider
	DbProvider    sql.DatabaseProvider
	AuthHandler   sql.AuthorizationHandler

	// BinlogReplicaController holds an optional controller that receives forwarded binlog
	// replication messages (e.g. "start replica").
	BinlogReplicaController binlogreplication.BinlogReplicaController
	// BinlogPrimaryController holds an optional controller that receives forwarded binlog
	// replication messages (e.g. "show replicas") and commands (e.g. COM_REGISTER_REPLICA).
	BinlogPrimaryController binlogreplication.BinlogPrimaryController

	MySQLDb          *mysql_db.MySQLDb
	builtInFunctions function.Registry

	locks sessionLocks
	mu    sync.RWMutex
}

func (c *Catalog) DropDbStats(ctx *sql.Context, db string, flush bool) error {
	return c.StatsProvider.DropDbStats(ctx, db, flush)
}

var _ sql.Catalog = (*Catalog)(nil)
var _ binlogreplication.BinlogReplicaCatalog = (*Catalog)(nil)
var _ binlogreplication.BinlogPrimaryCatalog = (*Catalog)(nil)

type tableLocks map[string]struct{}

type dbLocks map[string]tableLocks

type sessionLocks map[uint32]dbLocks

// NewCatalog returns a new empty Catalog with the given provider
func NewCatalog(provider sql.DatabaseProvider) *Catalog {
	c := &Catalog{
		MySQLDb:          mysql_db.CreateEmptyMySQLDb(),
		InfoSchema:       information_schema.NewInformationSchemaDatabase(),
		DbProvider:       provider,
		builtInFunctions: function.NewRegistry(),
		StatsProvider:    memory.NewStatsProv(),
		locks:            make(sessionLocks),
	}
	c.AuthHandler = sql.GetAuthorizationHandlerFactory().CreateHandler(c)
	return c
}

func (c *Catalog) HasBinlogReplicaController() bool {
	return c.BinlogReplicaController != nil
}

func (c *Catalog) GetBinlogReplicaController() binlogreplication.BinlogReplicaController {
	return c.BinlogReplicaController
}

func (c *Catalog) HasBinlogPrimaryController() bool {
	return c.BinlogPrimaryController != nil
}

func (c *Catalog) GetBinlogPrimaryController() binlogreplication.BinlogPrimaryController {
	return c.BinlogPrimaryController
}

func (c *Catalog) WithTableFunctions(fns ...sql.TableFunction) (sql.TableFunctionProvider, error) {
	if tfp, ok := c.DbProvider.(sql.TableFunctionProvider); !ok {
		return nil, fmt.Errorf("catalog does not implement sql.TableFunctionProvider")
	} else {
		ret := *c
		newProv, err := tfp.WithTableFunctions(fns...)
		if err != nil {
			return nil, err
		}
		ret.DbProvider = newProv.(sql.DatabaseProvider)
		return &ret, nil
	}
}

func (c *Catalog) AllDatabases(ctx *sql.Context) []sql.Database {
	var dbs []sql.Database
	dbs = append(dbs, c.InfoSchema)

	if c.MySQLDb.Enabled() {
		dbs = append(dbs, mysql_db.NewPrivilegedDatabaseProvider(c.MySQLDb, c.DbProvider, c.AuthHandler).AllDatabases(ctx)...)
	} else {
		dbs = append(dbs, c.DbProvider.AllDatabases(ctx)...)
	}

	return dbs
}

// CreateDatabase creates a new Database and adds it to the catalog.
func (c *Catalog) CreateDatabase(ctx *sql.Context, dbName string, collation sql.CollationID) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if collatedDbProvider, ok := c.DbProvider.(sql.CollatedDatabaseProvider); ok {
		// If the database provider supports creation with a collation, then we call that function directly
		return collatedDbProvider.CreateCollatedDatabase(ctx, dbName, collation)
	} else if mut, ok := c.DbProvider.(sql.MutableDatabaseProvider); ok {
		err := mut.CreateDatabase(ctx, dbName)
		if err != nil {
			return err
		}
		// It's possible that the db provider doesn't support creation with a collation, in which case we create the
		// database and then set the collation. If the database doesn't support collations at all, then we ignore the
		// provided collation rather than erroring.
		if db, err := c.Database(ctx, dbName); err == nil {
			if collatedDb, ok := db.(sql.CollatedDatabase); ok {
				return collatedDb.SetCollation(ctx, collation)
			}
		}
		return nil
	} else {
		return sql.ErrImmutableDatabaseProvider.New()
	}
}

// RemoveDatabase removes a database from the catalog.
func (c *Catalog) RemoveDatabase(ctx *sql.Context, dbName string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	mut, ok := c.DbProvider.(sql.MutableDatabaseProvider)
	if !ok {
		return sql.ErrImmutableDatabaseProvider.New()
	}
	if strings.EqualFold(dbName, "information_schema") || (c.MySQLDb.Enabled() && strings.EqualFold(dbName, "mysql")) {
		return fmt.Errorf("unable to drop database: %s", dbName)
	}
	return mut.DropDatabase(ctx, dbName)
}

func (c *Catalog) HasDatabase(ctx *sql.Context, db string) bool {
	db = strings.ToLower(db)
	if db == "information_schema" {
		return true
	} else if c.MySQLDb.Enabled() {
		return mysql_db.NewPrivilegedDatabaseProvider(c.MySQLDb, c.DbProvider, c.AuthHandler).HasDatabase(ctx, db)
	} else {
		return c.DbProvider.HasDatabase(ctx, db)
	}
}

// Database returns the database with the given name.
func (c *Catalog) Database(ctx *sql.Context, db string) (sql.Database, error) {
	if strings.ToLower(db) == "information_schema" {
		return c.InfoSchema, nil
	} else if c.MySQLDb.Enabled() {
		return mysql_db.NewPrivilegedDatabaseProvider(c.MySQLDb, c.DbProvider, c.AuthHandler).Database(ctx, db)
	} else {
		return c.DbProvider.Database(ctx, db)
	}
}

// LockTable adds a lock for the given table and session client. It is assumed
// the database is the current database in use.
func (c *Catalog) LockTable(ctx *sql.Context, table string) {
	id := ctx.ID()
	db := ctx.GetCurrentDatabase()

	c.mu.Lock()
	defer c.mu.Unlock()

	if _, ok := c.locks[id]; !ok {
		c.locks[id] = make(dbLocks)
	}

	if _, ok := c.locks[id][db]; !ok {
		c.locks[id][db] = make(tableLocks)
	}

	c.locks[id][db][table] = struct{}{}
}

// UnlockTables unlocks all tables for which the given session client has a
// lock.
func (c *Catalog) UnlockTables(ctx *sql.Context, id uint32) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var errors []string
	for db, tables := range c.locks[id] {
		for t := range tables {
			database, err := c.DbProvider.Database(ctx, db)
			if err != nil {
				return err
			}

			table, _, err := database.GetTableInsensitive(ctx, t)
			if err == nil {
				if lockable, ok := table.(sql.Lockable); ok {
					if e := lockable.Unlock(ctx, id); e != nil {
						errors = append(errors, e.Error())
					}
				}
			} else {
				errors = append(errors, err.Error())
			}
		}
	}

	delete(c.locks, id)
	if len(errors) > 0 {
		return fmt.Errorf("error unlocking tables for %d: %s", id, strings.Join(errors, ", "))
	}

	return nil
}

// Table returns the table in the given database with the given name.
func (c *Catalog) Table(ctx *sql.Context, dbName, tableName string) (sql.Table, sql.Database, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	db, err := c.Database(ctx, dbName)
	if err != nil {
		return nil, nil, err
	}

	return c.DatabaseTable(ctx, db, tableName)
}

// TableSchema returns the table in the given database with the given name, in the given schema name
func (c *Catalog) TableSchema(ctx *sql.Context, dbName, schemaName, tableName string) (sql.Table, sql.Database, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	db, err := c.Database(ctx, dbName)
	if err != nil {
		return nil, nil, err
	}

	if schemaName != "" {
		sdb, ok := db.(sql.SchemaDatabase)
		if !ok {
			return nil, nil, sql.ErrDatabaseSchemasNotSupported.New(db.Name())
		}

		db, ok, err = sdb.GetSchema(ctx, schemaName)
		if err != nil {
			return nil, nil, err
		}
		if !ok {
			return nil, nil, sql.ErrDatabaseSchemaNotFound.New(schemaName)
		}
	}

	return c.DatabaseTable(ctx, db, tableName)
}

func (c *Catalog) DatabaseTable(ctx *sql.Context, db sql.Database, tableName string) (sql.Table, sql.Database, error) {
	_, ok := db.(sql.UnresolvedDatabase)
	if ok {
		return c.Table(ctx, db.Name(), tableName)
	}

	tbl, ok, err := db.GetTableInsensitive(ctx, tableName)
	if err != nil {
		return nil, nil, err
	} else if !ok {
		return nil, nil, suggestSimilarTables(db, ctx, tableName)
	}

	return tbl, db, nil
}

// TableAsOf returns the table in the given database with the given name, as it existed at the time given. The database
// named must support timed queries.
func (c *Catalog) TableAsOf(ctx *sql.Context, dbName, tableName string, asOf interface{}) (sql.Table, sql.Database, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	db, err := c.Database(ctx, dbName)
	if err != nil {
		return nil, nil, err
	}

	return c.DatabaseTableAsOf(ctx, db, tableName, asOf)
}

func (c *Catalog) DatabaseTableAsOf(ctx *sql.Context, db sql.Database, tableName string, asOf interface{}) (sql.Table, sql.Database, error) {
	_, ok := db.(sql.UnresolvedDatabase)
	if ok {
		return c.TableAsOf(ctx, db.Name(), tableName, asOf)
	}

	versionedDb, ok := db.(sql.VersionedDatabase)
	if !ok {
		return nil, nil, sql.ErrAsOfNotSupported.New(db.Name())
	}

	tbl, ok, err := versionedDb.GetTableInsensitiveAsOf(ctx, tableName, asOf)

	if err != nil {
		return nil, nil, err
	} else if !ok {
		return nil, nil, suggestSimilarTablesAsOf(versionedDb, ctx, tableName, asOf)
	}

	return tbl, versionedDb, nil
}

// RegisterFunction registers the functions given, adding them to the built-in functions.
// Integrators with custom functions should typically use the FunctionProvider interface instead.
func (c *Catalog) RegisterFunction(ctx *sql.Context, fns ...sql.Function) {
	for _, fn := range fns {
		err := c.builtInFunctions.Register(fn)
		if err != nil {
			panic(err)
		}
	}
}

// ExternalFunctionProvider is a function provider that may be set by an integrator for cases that the DatabaseProvider
// does not implement the necessary function provider logic (and we need more than the built-in functions). This is used
// by Catalog to check for functions if it is non-nil.
var ExternalFunctionProvider sql.FunctionProvider

// Function returns the function with the name given, or false if it doesn't exist.
func (c *Catalog) Function(ctx *sql.Context, name string) (sql.Function, bool) {
	if ExternalFunctionProvider != nil {
		f, ok := ExternalFunctionProvider.Function(ctx, name)
		if ok {
			return f, true
		}
	}
	if fp, ok := c.DbProvider.(sql.FunctionProvider); ok {
		f, ok := fp.Function(ctx, name)
		if ok {
			return f, true
		}
	}

	return c.builtInFunctions.Function(ctx, name)
}

// ExternalStoredProcedure implements sql.ExternalStoredProcedureProvider
func (c *Catalog) ExternalStoredProcedure(ctx *sql.Context, name string, numOfParams int) (*sql.ExternalStoredProcedureDetails, error) {
	if espp, ok := c.DbProvider.(sql.ExternalStoredProcedureProvider); ok {
		esp, err := espp.ExternalStoredProcedure(ctx, name, numOfParams)
		if err != nil {
			return nil, err
		} else if esp != nil {
			return esp, nil
		}
	}

	return nil, nil
}

// ExternalStoredProcedures implements sql.ExternalStoredProcedureProvider
func (c *Catalog) ExternalStoredProcedures(ctx *sql.Context, name string) ([]sql.ExternalStoredProcedureDetails, error) {
	if espp, ok := c.DbProvider.(sql.ExternalStoredProcedureProvider); ok {
		esps, err := espp.ExternalStoredProcedures(ctx, name)
		if err != nil {
			return nil, err
		} else if esps != nil {
			return esps, nil
		}
	}

	return nil, nil
}

// TableFunction implements the TableFunctionProvider interface
func (c *Catalog) TableFunction(ctx *sql.Context, name string) (sql.TableFunction, bool) {
	if fp, ok := c.DbProvider.(sql.TableFunctionProvider); ok {
		tf, found := fp.TableFunction(ctx, name)
		if found && tf != nil {
			return tf, true
		}
	}
	return nil, false
}

func (c *Catalog) AnalyzeTable(ctx *sql.Context, table sql.Table, db string) error {
	return c.StatsProvider.AnalyzeTable(ctx, table, db)
}

func (c *Catalog) GetTableStats(ctx *sql.Context, db string, table sql.Table) ([]sql.Statistic, error) {
	return c.StatsProvider.GetTableStats(ctx, db, table)
}

func (c *Catalog) SetStats(ctx *sql.Context, stats sql.Statistic) error {
	return c.StatsProvider.SetStats(ctx, stats)
}

func (c *Catalog) GetStats(ctx *sql.Context, qual sql.StatQualifier, cols []string) (sql.Statistic, bool) {
	return c.StatsProvider.GetStats(ctx, qual, cols)
}

func (c *Catalog) DropStats(ctx *sql.Context, qual sql.StatQualifier, cols []string) error {
	return c.StatsProvider.DropStats(ctx, qual, cols)
}

func (c *Catalog) RowCount(ctx *sql.Context, db string, table sql.Table) (uint64, error) {
	cnt, err := c.StatsProvider.RowCount(ctx, db, table)
	if err == nil && cnt > 0 {
		return cnt, nil
	}
	// fallback to on-table statistics
	st, ok := getStatisticsTable(table, nil)
	if !ok {
		return 0, fmt.Errorf("%T is not a statistics table, no row count available", table)
	}

	cnt, _, err = st.RowCount(ctx)
	return cnt, err
}

func (c *Catalog) DataLength(ctx *sql.Context, db string, table sql.Table) (uint64, error) {
	length, err := c.StatsProvider.DataLength(ctx, db, table)
	if err == nil && length > 0 {
		return length, nil
	}
	// fallback to on-table statistics
	st, ok := getStatisticsTable(table, nil)
	if !ok {
		return 0, fmt.Errorf("%T is not a statistics table, no data length available", table)
	}
	return st.DataLength(ctx)
}

func (c *Catalog) AuthorizationHandler() sql.AuthorizationHandler {
	return c.AuthHandler
}

func getStatisticsTable(table sql.Table, prevTable sql.Table) (sql.StatisticsTable, bool) {
	// Some TableNodes return themselves for UnderlyingTable, so we need to check for that
	if table == prevTable {
		return nil, false
	}
	switch t := table.(type) {
	case sql.StatisticsTable:
		return t, true
	case sql.TableNode:
		return getStatisticsTable(t.UnderlyingTable(), table)
	case sql.TableWrapper:
		return getStatisticsTable(t.Underlying(), table)
	default:
		return nil, false
	}
}

func suggestSimilarTables(db sql.Database, ctx *sql.Context, tableName string) error {
	tableNames, err := db.GetTableNames(ctx)
	if err != nil {
		return err
	}

	similar := similartext.Find(tableNames, tableName)
	return sql.ErrTableNotFound.New(tableName + similar)
}

func suggestSimilarTablesAsOf(db sql.VersionedDatabase, ctx *sql.Context, tableName string, time interface{}) error {
	tableNames, err := db.GetTableNamesAsOf(ctx, time)
	if err != nil {
		return err
	}

	similar := similartext.Find(tableNames, tableName)
	return sql.ErrTableNotFound.New(tableName + similar)
}
