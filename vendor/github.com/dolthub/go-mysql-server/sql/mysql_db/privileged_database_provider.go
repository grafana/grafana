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
	"strings"
	"time"

	"github.com/dolthub/go-mysql-server/sql/fulltext"

	"github.com/dolthub/go-mysql-server/sql"
)

// PrivilegedDatabaseProvider is a wrapper around a normal sql.DatabaseProvider that takes a context's client's
// privileges into consideration when returning a sql.Database. In addition, any returned databases are wrapped with
// PrivilegedDatabase.
type PrivilegedDatabaseProvider struct {
	grantTables *MySQLDb
	provider    sql.DatabaseProvider
	authHandler sql.AuthorizationHandler
}

var _ sql.DatabaseProvider = PrivilegedDatabaseProvider{}

// NewPrivilegedDatabaseProvider returns a new PrivilegedDatabaseProvider. As a sql.DatabaseProvider may be added to an
// analyzer when Grant Tables are disabled (and Grant Tables may be enabled or disabled at any time), a new
// PrivilegedDatabaseProvider is returned whenever the sql.DatabaseProvider is needed (as long as Grant Tables are
// enabled) rather than wrapping a sql.DatabaseProvider when it is provided to the analyzer.
func NewPrivilegedDatabaseProvider(grantTables *MySQLDb, p sql.DatabaseProvider, authHandler sql.AuthorizationHandler) sql.DatabaseProvider {
	return PrivilegedDatabaseProvider{
		grantTables: grantTables,
		provider:    p,
		authHandler: authHandler,
	}
}

// Database implements the interface sql.DatabaseProvider.
func (pdp PrivilegedDatabaseProvider) Database(ctx *sql.Context, name string) (sql.Database, error) {
	if strings.ToLower(name) == "mysql" {
		return pdp.grantTables, nil
	}

	db, providerErr := pdp.provider.Database(ctx, name)
	if sql.ErrDatabaseNotFound.Is(providerErr) {
		// continue to priv check below, which will deny access or return not found as appropriate, before returning this
		// original not found error
	} else if providerErr != nil {
		return nil, providerErr
	}

	checkName := name
	if adb, ok := db.(sql.AliasedDatabase); ok {
		checkName = adb.AliasedName()
	}

	privSet := pdp.grantTables.UserActivePrivilegeSet(ctx)
	// If the user has no global static privileges or database-relevant privileges then the database is not accessible.
	if privSet.Count() == 0 && !privSet.Database(checkName).HasPrivileges() {
		return nil, sql.ErrDatabaseAccessDeniedForUser.New(pdp.usernameFromCtx(ctx), checkName)
	}

	if providerErr != nil {
		return nil, providerErr
	}

	return NewPrivilegedDatabase(pdp.grantTables, db, pdp.authHandler), nil
}

// HasDatabase implements the interface sql.DatabaseProvider.
func (pdp PrivilegedDatabaseProvider) HasDatabase(ctx *sql.Context, name string) bool {
	if strings.EqualFold(name, "mysql") {
		return true
	}

	db, err := pdp.provider.Database(ctx, name)
	if sql.ErrDatabaseNotFound.Is(err) {
		// continue to check below, which will deny access or return not found as appropriate
	} else if err != nil {
		return false
	}

	if adb, ok := db.(sql.AliasedDatabase); ok {
		name = adb.AliasedName()
	}

	privSet := pdp.grantTables.UserActivePrivilegeSet(ctx)
	// If the user has no global static privileges or database-relevant privileges then the database is not accessible.
	if privSet.Count() == 0 && !privSet.Database(name).HasPrivileges() {
		return false
	}

	return pdp.provider.HasDatabase(ctx, name)
}

// AllDatabases implements the interface sql.DatabaseProvider.
func (pdp PrivilegedDatabaseProvider) AllDatabases(ctx *sql.Context) []sql.Database {
	privilegeSet := pdp.grantTables.UserActivePrivilegeSet(ctx)
	privilegeSetCount := privilegeSet.Count()

	var databasesWithAccess []sql.Database
	allDatabases := pdp.provider.AllDatabases(ctx)
	for _, db := range allDatabases {
		// If the user has any global static privileges or database-relevant privileges then the database is accessible
		checkName := db.Name()

		if adb, ok := db.(sql.AliasedDatabase); ok {
			checkName = adb.AliasedName()
		}

		if privilegeSetCount > 0 || privilegeSet.Database(checkName).HasPrivileges() {
			databasesWithAccess = append(databasesWithAccess, NewPrivilegedDatabase(pdp.grantTables, db, pdp.authHandler))
		}
	}
	return databasesWithAccess
}

// usernameFromCtx returns the username from the context, properly formatted for returned errors.
func (pdp PrivilegedDatabaseProvider) usernameFromCtx(ctx *sql.Context) string {
	client := ctx.Session.Client()
	return User{User: client.User, Host: client.Address}.UserHostToString("'")
}

// PrivilegedDatabase is a wrapper around a normal sql.Database that takes a context's client's privileges into
// consideration when returning a sql.Table.
type PrivilegedDatabase struct {
	grantTables *MySQLDb
	db          sql.Database
	authHandler sql.AuthorizationHandler
	//TODO: this should also handle views as the relevant privilege exists
}

var _ sql.Database = PrivilegedDatabase{}
var _ sql.VersionedDatabase = PrivilegedDatabase{}
var _ sql.TableCreator = PrivilegedDatabase{}
var _ sql.TableDropper = PrivilegedDatabase{}
var _ sql.TableRenamer = PrivilegedDatabase{}
var _ sql.TriggerDatabase = PrivilegedDatabase{}
var _ sql.StoredProcedureDatabase = PrivilegedDatabase{}
var _ sql.EventDatabase = PrivilegedDatabase{}
var _ sql.TableCopierDatabase = PrivilegedDatabase{}
var _ sql.ReadOnlyDatabase = PrivilegedDatabase{}
var _ sql.TemporaryTableDatabase = PrivilegedDatabase{}
var _ sql.CollatedDatabase = PrivilegedDatabase{}
var _ sql.ViewDatabase = PrivilegedDatabase{}
var _ fulltext.Database = PrivilegedDatabase{}

// NewPrivilegedDatabase returns a new PrivilegedDatabase.
func NewPrivilegedDatabase(grantTables *MySQLDb, db sql.Database, authHandler sql.AuthorizationHandler) sql.Database {
	return PrivilegedDatabase{
		grantTables: grantTables,
		db:          db,
		authHandler: authHandler,
	}
}

// Name implements the interface sql.Database.
func (pdb PrivilegedDatabase) Name() string {
	return pdb.db.Name()
}

// GetTableInsensitive implements the interface sql.Database.
func (pdb PrivilegedDatabase) GetTableInsensitive(ctx *sql.Context, tblName string) (sql.Table, bool, error) {
	checkName := pdb.db.Name()
	if adb, ok := pdb.db.(sql.AliasedDatabase); ok {
		checkName = adb.AliasedName()
	}
	if err := pdb.authHandler.CheckTable(ctx, nil, checkName, "", tblName); err != nil {
		return nil, false, err
	}
	return pdb.db.GetTableInsensitive(ctx, tblName)
}

// GetTableNames implements the interface sql.Database.
func (pdb PrivilegedDatabase) GetTableNames(ctx *sql.Context) ([]string, error) {
	checkName := pdb.db.Name()
	if adb, ok := pdb.db.(sql.AliasedDatabase); ok {
		checkName = adb.AliasedName()
	}
	tblNames, err := pdb.db.GetTableNames(ctx)
	if err != nil {
		return nil, err
	}
	var tablesWithAccess []string
	for _, tblName := range tblNames {
		if err = pdb.authHandler.CheckTable(ctx, nil, checkName, "", tblName); err == nil {
			tablesWithAccess = append(tablesWithAccess, tblName)
		}
	}
	return tablesWithAccess, nil
}

// GetTableInsensitiveAsOf returns a new sql.VersionedDatabase.
func (pdb PrivilegedDatabase) GetTableInsensitiveAsOf(ctx *sql.Context, tblName string, asOf interface{}) (sql.Table, bool, error) {
	db, ok := pdb.db.(sql.VersionedDatabase)
	if !ok {
		return nil, false, sql.ErrAsOfNotSupported.New(pdb.db.Name())
	}
	checkName := pdb.db.Name()
	if adb, ok := pdb.db.(sql.AliasedDatabase); ok {
		checkName = adb.AliasedName()
	}
	if err := pdb.authHandler.CheckTable(ctx, nil, checkName, "", tblName); err != nil {
		return nil, false, err
	}
	return db.GetTableInsensitiveAsOf(ctx, tblName, asOf)
}

// GetTableNamesAsOf returns a new sql.VersionedDatabase.
func (pdb PrivilegedDatabase) GetTableNamesAsOf(ctx *sql.Context, asOf interface{}) ([]string, error) {
	db, ok := pdb.db.(sql.VersionedDatabase)
	if !ok {
		return nil, nil
	}
	checkName := pdb.db.Name()
	if adb, ok := pdb.db.(sql.AliasedDatabase); ok {
		checkName = adb.AliasedName()
	}
	tblNames, err := db.GetTableNamesAsOf(ctx, asOf)
	if err != nil {
		return nil, err
	}
	var tablesWithAccess []string
	for _, tblName := range tblNames {
		if err = pdb.authHandler.CheckTable(ctx, nil, checkName, "", tblName); err == nil {
			tablesWithAccess = append(tablesWithAccess, tblName)
		}
	}
	return tablesWithAccess, nil
}

// CreateTable implements the interface sql.TableCreator.
func (pdb PrivilegedDatabase) CreateTable(ctx *sql.Context, name string, schema sql.PrimaryKeySchema, collation sql.CollationID, comment string) error {
	if db, ok := pdb.db.(sql.TableCreator); ok {
		return db.CreateTable(ctx, name, schema, collation, comment)
	}
	return sql.ErrCreateTableNotSupported.New(pdb.db.Name())
}

// DropTable implements the interface sql.TableDropper.
func (pdb PrivilegedDatabase) DropTable(ctx *sql.Context, name string) error {
	if db, ok := pdb.db.(sql.TableDropper); ok {
		return db.DropTable(ctx, name)
	}
	return sql.ErrDropTableNotSupported.New(pdb.db.Name())
}

// CreateFulltextTableNames implements the interface fulltext.Database.
func (pdb PrivilegedDatabase) CreateFulltextTableNames(ctx *sql.Context, parentTable string, parentIndexName string) (fulltext.IndexTableNames, error) {
	if db, ok := pdb.db.(fulltext.Database); ok {
		return db.CreateFulltextTableNames(ctx, parentTable, parentIndexName)
	}
	return fulltext.IndexTableNames{}, sql.ErrFullTextDatabaseNotSupported.New()
}

// RenameTable implements the interface sql.TableRenamer.
func (pdb PrivilegedDatabase) RenameTable(ctx *sql.Context, oldName, newName string) error {
	if db, ok := pdb.db.(sql.TableRenamer); ok {
		return db.RenameTable(ctx, oldName, newName)
	}
	return sql.ErrRenameTableNotSupported.New(pdb.db.Name())
}

// GetTriggers implements the interface sql.TriggerDatabase.
func (pdb PrivilegedDatabase) GetTriggers(ctx *sql.Context) ([]sql.TriggerDefinition, error) {
	if db, ok := pdb.db.(sql.TriggerDatabase); ok {
		return db.GetTriggers(ctx)
	}
	return nil, sql.ErrTriggersNotSupported.New(pdb.db.Name())
}

// CreateTrigger implements the interface sql.TriggerDatabase.
func (pdb PrivilegedDatabase) CreateTrigger(ctx *sql.Context, definition sql.TriggerDefinition) error {
	if db, ok := pdb.db.(sql.TriggerDatabase); ok {
		return db.CreateTrigger(ctx, definition)
	}
	return sql.ErrTriggersNotSupported.New(pdb.db.Name())
}

// DropTrigger implements the interface sql.TriggerDatabase.
func (pdb PrivilegedDatabase) DropTrigger(ctx *sql.Context, name string) error {
	if db, ok := pdb.db.(sql.TriggerDatabase); ok {
		return db.DropTrigger(ctx, name)
	}
	return sql.ErrTriggersNotSupported.New(pdb.db.Name())
}

// GetStoredProcedure implements the interface sql.StoredProcedureDatabase.
func (pdb PrivilegedDatabase) GetStoredProcedure(ctx *sql.Context, name string) (sql.StoredProcedureDetails, bool, error) {
	if db, ok := pdb.db.(sql.StoredProcedureDatabase); ok {
		return db.GetStoredProcedure(ctx, name)
	}
	return sql.StoredProcedureDetails{}, false, sql.ErrStoredProceduresNotSupported.New(pdb.db.Name())
}

// GetStoredProcedures implements the interface sql.StoredProcedureDatabase.
func (pdb PrivilegedDatabase) GetStoredProcedures(ctx *sql.Context) ([]sql.StoredProcedureDetails, error) {
	if db, ok := pdb.db.(sql.StoredProcedureDatabase); ok {
		return db.GetStoredProcedures(ctx)
	}
	return nil, sql.ErrStoredProceduresNotSupported.New(pdb.db.Name())
}

// SaveStoredProcedure implements the interface sql.StoredProcedureDatabase.
func (pdb PrivilegedDatabase) SaveStoredProcedure(ctx *sql.Context, spd sql.StoredProcedureDetails) error {
	if db, ok := pdb.db.(sql.StoredProcedureDatabase); ok {
		return db.SaveStoredProcedure(ctx, spd)
	}
	return sql.ErrStoredProceduresNotSupported.New(pdb.db.Name())
}

// DropStoredProcedure implements the interface sql.StoredProcedureDatabase.
func (pdb PrivilegedDatabase) DropStoredProcedure(ctx *sql.Context, name string) error {
	if db, ok := pdb.db.(sql.StoredProcedureDatabase); ok {
		return db.DropStoredProcedure(ctx, name)
	}
	return sql.ErrStoredProceduresNotSupported.New(pdb.db.Name())
}

// GetEvent implements sql.EventDatabase
func (pdb PrivilegedDatabase) GetEvent(ctx *sql.Context, name string) (sql.EventDefinition, bool, error) {
	if db, ok := pdb.db.(sql.EventDatabase); ok {
		return db.GetEvent(ctx, name)
	}
	return sql.EventDefinition{}, false, sql.ErrEventsNotSupported.New(pdb.db.Name())
}

// GetEvents implements sql.EventDatabase
func (pdb PrivilegedDatabase) GetEvents(ctx *sql.Context) ([]sql.EventDefinition, interface{}, error) {
	if db, ok := pdb.db.(sql.EventDatabase); ok {
		return db.GetEvents(ctx)
	}
	return nil, nil, sql.ErrEventsNotSupported.New(pdb.db.Name())
}

// SaveEvent implements sql.EventDatabase
func (pdb PrivilegedDatabase) SaveEvent(ctx *sql.Context, ed sql.EventDefinition) (bool, error) {
	if db, ok := pdb.db.(sql.EventDatabase); ok {
		return db.SaveEvent(ctx, ed)
	}
	return false, sql.ErrEventsNotSupported.New(pdb.db.Name())
}

// DropEvent implements sql.EventDatabase
func (pdb PrivilegedDatabase) DropEvent(ctx *sql.Context, name string) error {
	if db, ok := pdb.db.(sql.EventDatabase); ok {
		return db.DropEvent(ctx, name)
	}
	return sql.ErrEventsNotSupported.New(pdb.db.Name())
}

// UpdateEvent implements sql.EventDatabase
func (pdb PrivilegedDatabase) UpdateEvent(ctx *sql.Context, originalName string, ed sql.EventDefinition) (bool, error) {
	if db, ok := pdb.db.(sql.EventDatabase); ok {
		return db.UpdateEvent(ctx, originalName, ed)
	}
	return false, sql.ErrEventsNotSupported.New(pdb.db.Name())
}

// NeedsToReloadEvents implements sql.EventDatabase
func (pdb PrivilegedDatabase) NeedsToReloadEvents(ctx *sql.Context, token interface{}) (bool, error) {
	if db, ok := pdb.db.(sql.EventDatabase); ok {
		return db.NeedsToReloadEvents(ctx, token)
	}
	return false, sql.ErrEventsNotSupported.New(pdb.db.Name())
}

func (pdb PrivilegedDatabase) UpdateLastExecuted(ctx *sql.Context, eventName string, lastExecuted time.Time) error {
	if db, ok := pdb.db.(sql.EventDatabase); ok {
		return db.UpdateLastExecuted(ctx, eventName, lastExecuted)
	}
	return sql.ErrEventsNotSupported.New(pdb.db.Name())
}

// CreateView implements sql.ViewDatabase
func (pdb PrivilegedDatabase) CreateView(ctx *sql.Context, name string, selectStatement, createViewStmt string) error {
	if db, ok := pdb.db.(sql.ViewDatabase); ok {
		return db.CreateView(ctx, name, selectStatement, createViewStmt)
	}
	return sql.ErrViewsNotSupported.New(pdb.db.Name())
}

// DropView implements sql.ViewDatabase
func (pdb PrivilegedDatabase) DropView(ctx *sql.Context, name string) error {
	if db, ok := pdb.db.(sql.ViewDatabase); ok {
		return db.DropView(ctx, name)
	}
	return sql.ErrViewsNotSupported.New(pdb.db.Name())
}

// GetViewDefinition implements sql.ViewDatabase
func (pdb PrivilegedDatabase) GetViewDefinition(ctx *sql.Context, viewName string) (sql.ViewDefinition, bool, error) {
	if db, ok := pdb.db.(sql.ViewDatabase); ok {
		return db.GetViewDefinition(ctx, viewName)
	}
	return sql.ViewDefinition{}, false, sql.ErrViewsNotSupported.New(pdb.db.Name())
}

// AllViews implements sql.ViewDatabase
func (pdb PrivilegedDatabase) AllViews(ctx *sql.Context) ([]sql.ViewDefinition, error) {
	if db, ok := pdb.db.(sql.ViewDatabase); ok {
		return db.AllViews(ctx)
	}
	return nil, sql.ErrViewsNotSupported.New(pdb.db.Name())
}

// CopyTableData implements the interface sql.TableCopierDatabase.
func (pdb PrivilegedDatabase) CopyTableData(ctx *sql.Context, sourceTable string, destinationTable string) (uint64, error) {
	if db, ok := pdb.db.(sql.TableCopierDatabase); ok {
		// Privilege checking is handled in the analyzer
		return db.CopyTableData(ctx, sourceTable, destinationTable)
	}
	return 0, sql.ErrTableCopyingNotSupported.New()
}

// IsReadOnly implements the interface sql.ReadOnlyDatabase.
func (pdb PrivilegedDatabase) IsReadOnly() bool {
	if db, ok := pdb.db.(sql.ReadOnlyDatabase); ok {
		return db.IsReadOnly()
	}
	return false
}

// GetAllTemporaryTables implements the interface sql.TemporaryTableDatabase.
func (pdb PrivilegedDatabase) GetAllTemporaryTables(ctx *sql.Context) ([]sql.Table, error) {
	if db, ok := pdb.db.(sql.TemporaryTableDatabase); ok {
		return db.GetAllTemporaryTables(ctx)
	}
	// All current temp table checks skip if not implemented, same is iterating over an empty slice
	return nil, nil
}

// GetCollation implements the interface sql.CollatedDatabase.
func (pdb PrivilegedDatabase) GetCollation(ctx *sql.Context) sql.CollationID {
	if db, ok := pdb.db.(sql.CollatedDatabase); ok {
		return db.GetCollation(ctx)
	}
	return sql.Collation_Default
}

// SetCollation implements the interface sql.CollatedDatabase.
func (pdb PrivilegedDatabase) SetCollation(ctx *sql.Context, collation sql.CollationID) error {
	if db, ok := pdb.db.(sql.CollatedDatabase); ok {
		return db.SetCollation(ctx, collation)
	}
	return sql.ErrDatabaseCollationsNotSupported.New(pdb.db.Name())
}

// Unwrap returns the wrapped sql.Database.
func (pdb PrivilegedDatabase) Unwrap() sql.Database {
	return pdb.db
}

// usernameFromCtx returns the username from the context, properly formatted for returned errors.
func (pdb PrivilegedDatabase) usernameFromCtx(ctx *sql.Context) string {
	client := ctx.Session.Client()
	return User{User: client.User, Host: client.Address}.UserHostToString("'")
}
