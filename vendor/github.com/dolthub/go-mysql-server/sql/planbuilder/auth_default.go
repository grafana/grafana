// Copyright 2024 Dolthub, Inc.
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

package planbuilder

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/dolthub/vitess/go/mysql"
	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
)

// defaultAuthorizationQueryState contains query-specific state for defaultAuthorizationHandler.
type defaultAuthorizationQueryState struct {
	privSet mysql_db.PrivilegeSet
	err     error
	db      *mysql_db.MySQLDb
	user    *mysql_db.User
	enabled bool
}

var _ sql.AuthorizationQueryState = defaultAuthorizationQueryState{}

// AuthorizationQueryStateImpl implements the AuthorizationQueryState interface.
func (state defaultAuthorizationQueryState) Error() error {
	return state.err
}

// AuthorizationQueryStateImpl implements the AuthorizationQueryState interface.
func (defaultAuthorizationQueryState) AuthorizationQueryStateImpl() {}

// defaultAuthorizationHandlerFactory is the AuthorizationHandlerFactory for defaultAuthorizationHandler.
type defaultAuthorizationHandlerFactory struct{}

var _ sql.AuthorizationHandlerFactory = defaultAuthorizationHandlerFactory{}

// CreateHandler implements the AuthorizationHandlerFactory interface.
func (defaultAuthorizationHandlerFactory) CreateHandler(cat sql.Catalog) sql.AuthorizationHandler {
	return defaultAuthorizationHandler{
		cat: cat,
	}
}

// defaultAuthorizationHandler handles authorization for ASTs that were generated directly by the Vitess SQL parser.
type defaultAuthorizationHandler struct {
	cat sql.Catalog
}

var _ sql.AuthorizationHandler = defaultAuthorizationHandler{}

// NewQueryState implements the AuthorizationHandler interface.
func (h defaultAuthorizationHandler) NewQueryState(ctx *sql.Context) sql.AuthorizationQueryState {
	db, err := h.cat.Database(ctx, "mysql")
	if err != nil {
		// If we can't load the MySQL database, then we'll assume that it's been disabled
		return defaultAuthorizationQueryState{
			enabled: false,
		}
	}
	mysqlDb, ok := db.(*mysql_db.MySQLDb)
	if !ok {
		// If we can't load the MySQL database, then we'll assume that it's been disabled
		return defaultAuthorizationQueryState{
			enabled: false,
		}
	}
	var user *mysql_db.User
	var privSet mysql_db.PrivilegeSet
	enabled := mysqlDb.Enabled()
	if enabled {
		client := ctx.Session.Client()
		user = func() *mysql_db.User {
			rd := mysqlDb.Reader()
			defer rd.Close()
			return mysqlDb.GetUser(rd, client.User, client.Address, false)
		}()
		if user == nil {
			return defaultAuthorizationQueryState{
				err: mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%s'", client.User),
			}
		}
		privSet = mysqlDb.UserActivePrivilegeSet(ctx)
	}
	return defaultAuthorizationQueryState{
		enabled: enabled,
		db:      mysqlDb,
		user:    user,
		privSet: privSet,
		err:     nil,
	}
}

// HandleAuth implements the AuthorizationHandler interface.
func (h defaultAuthorizationHandler) HandleAuth(ctx *sql.Context, aqs sql.AuthorizationQueryState, auth ast.AuthInformation) error {
	if aqs == nil {
		aqs = h.NewQueryState(ctx)
	}
	state := aqs.(defaultAuthorizationQueryState)
	if state.err != nil || !state.enabled {
		return state.err
	}

	var err error
	hasPrivileges := true
	var privilegeTypes []sql.PrivilegeType
	switch auth.AuthType {
	case ast.AuthType_IGNORE:
		// This means that authorization is being handled elsewhere (such as a child or parent), and should be ignored here
		return nil
	case ast.AuthType_ALTER:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Alter}
	case ast.AuthType_ALTER_ROUTINE:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_AlterRoutine}
	case ast.AuthType_ALTER_USER:
		hasPrivileges = state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{Database: "mysql"}, sql.PrivilegeType_Update)) ||
			state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{}, sql.PrivilegeType_CreateUser)) ||
			state.user.User == auth.TargetNames[0]
	case ast.AuthType_CALL:
		hasPrivileges, err = h.call(ctx, state, auth)
		if err != nil {
			return err
		}
	case ast.AuthType_CREATE:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Create}
	case ast.AuthType_CREATE_ROLE:
		hasPrivileges = state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{}, sql.PrivilegeType_CreateRole)) ||
			state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{}, sql.PrivilegeType_CreateUser))
	case ast.AuthType_CREATE_ROUTINE:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_CreateRoutine}
	case ast.AuthType_CREATE_TEMP:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_CreateTempTable}
	case ast.AuthType_CREATE_USER:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_CreateUser}
	case ast.AuthType_CREATE_VIEW:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_CreateView}
	case ast.AuthType_DELETE:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Delete}
	case ast.AuthType_DROP:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Drop}
	case ast.AuthType_DROP_ROLE:
		hasPrivileges = state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{}, sql.PrivilegeType_DropRole)) ||
			state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{}, sql.PrivilegeType_CreateUser))
	case ast.AuthType_EVENT:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Event}
	case ast.AuthType_FILE:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_File}
	case ast.AuthType_FOREIGN_KEY:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_References}
	case ast.AuthType_GRANT_PRIVILEGE:
		hasPrivileges = h.grantAndRevoke(ctx, state, auth)
	case ast.AuthType_GRANT_PROXY:
		hasPrivileges = h.grantAndRevoke(ctx, state, auth)
	case ast.AuthType_GRANT_ROLE:
		hasPrivileges = h.grantAndRevoke(ctx, state, auth)
	case ast.AuthType_INDEX:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Index}
	case ast.AuthType_INSERT:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Insert}
	case ast.AuthType_LOCK:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Select, sql.PrivilegeType_LockTables}
	case ast.AuthType_PROCESS:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Process}
	case ast.AuthType_RELOAD:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Reload}
	case ast.AuthType_RENAME:
		hasPrivileges, err = h.renameTables(ctx, state, auth)
		if err != nil {
			return err
		}
	case ast.AuthType_REPLACE:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Insert, sql.PrivilegeType_Delete}
	case ast.AuthType_REPLICATION:
		hasPrivileges = state.db.UserHasPrivileges(ctx, sql.NewDynamicPrivilegedOperation("replication_slave_admin"))
	case ast.AuthType_REPLICATION_CLIENT:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_ReplicationClient}
	case ast.AuthType_REVOKE_ALL:
		hasPrivileges = h.grantAndRevoke(ctx, state, auth)
	case ast.AuthType_REVOKE_PRIVILEGE:
		hasPrivileges = h.grantAndRevoke(ctx, state, auth)
	case ast.AuthType_REVOKE_PROXY:
		hasPrivileges = h.grantAndRevoke(ctx, state, auth)
	case ast.AuthType_REVOKE_ROLE:
		hasPrivileges = h.grantAndRevoke(ctx, state, auth)
	case ast.AuthType_SELECT:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Select}
	case ast.AuthType_SHOW:
		// This a placeholder for some of the SHOW commands, as we don't yet know what permissions they should have
	case ast.AuthType_SHOW_CREATE_PROCEDURE:
		subject := sql.PrivilegeCheckSubject{
			Database: h.authDatabaseName(ctx, auth.TargetNames[0]),
		}
		hasPrivileges = state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{}, sql.PrivilegeType_Select)) ||
			state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(subject, sql.PrivilegeType_CreateRoutine)) ||
			state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(subject, sql.PrivilegeType_AlterRoutine)) ||
			state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(subject, sql.PrivilegeType_Execute))
	case ast.AuthType_SUPER:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Super}
	case ast.AuthType_TRIGGER:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Trigger}
	case ast.AuthType_UPDATE:
		privilegeTypes = []sql.PrivilegeType{sql.PrivilegeType_Update}
	case ast.AuthType_VISIBLE:
		hasPrivileges, err = h.visible(ctx, state, &auth)
		if err != nil {
			return err
		}
	default:
		if len(auth.AuthType) == 0 {
			return fmt.Errorf("AuthType is empty")
		} else {
			return fmt.Errorf("AuthType not handled: `%s`", auth.AuthType)
		}
	}

	switch auth.TargetType {
	case ast.AuthTargetType_Ignore:
		// This means that the AuthType did not need a TargetType, so we can safely ignore it
	case ast.AuthTargetType_DatabaseIdentifiers:
		for i := 0; i < len(auth.TargetNames) && hasPrivileges; i++ {
			dbName := auth.TargetNames[i]
			if strings.EqualFold(dbName, "information_schema") {
				continue
			}
			if err = h.authCheckDatabaseTableNames(ctx, state, dbName, ""); err != nil {
				return err
			}
			subject := sql.PrivilegeCheckSubject{
				Database: h.authDatabaseName(ctx, dbName),
			}
			hasPrivileges = state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(subject, privilegeTypes...))
		}
	case ast.AuthTargetType_Global:
		hasPrivileges = state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{}, privilegeTypes...)) && hasPrivileges
	case ast.AuthTargetType_MultipleTableIdentifiers:
		for i := 0; i < len(auth.TargetNames) && hasPrivileges; i += 2 {
			dbName := auth.TargetNames[i]
			tableName := auth.TargetNames[i+1]
			if strings.EqualFold(dbName, "information_schema") {
				continue
			}
			if err = h.authCheckDatabaseTableNames(ctx, state, dbName, tableName); err != nil {
				return err
			}
			subject := sql.PrivilegeCheckSubject{
				Database: h.authDatabaseName(ctx, dbName),
				Table:    tableName,
			}
			hasPrivileges = state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(subject, privilegeTypes...))
		}
	case ast.AuthTargetType_SingleTableIdentifier:
		dbName := auth.TargetNames[0]
		tableName := auth.TargetNames[1]
		if strings.EqualFold(dbName, "information_schema") {
			return nil
		}
		if err = h.authCheckDatabaseTableNames(ctx, state, dbName, tableName); err != nil {
			return err
		}
		subject := sql.PrivilegeCheckSubject{
			Database: h.authDatabaseName(ctx, dbName),
			Table:    tableName,
		}
		hasPrivileges = state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(subject, privilegeTypes...)) && hasPrivileges
	case ast.AuthTargetType_TableColumn:
		dbName := auth.TargetNames[0]
		tableName := auth.TargetNames[1]
		colName := auth.TargetNames[2]
		if strings.EqualFold(dbName, "information_schema") {
			return nil
		}
		if err = h.authCheckDatabaseTableNames(ctx, state, dbName, tableName); err != nil {
			return err
		}
		subject := sql.PrivilegeCheckSubject{
			Database: h.authDatabaseName(ctx, dbName),
			Table:    tableName,
			Column:   colName,
		}
		hasPrivileges = state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(subject, privilegeTypes...)) && hasPrivileges
	case ast.AuthTargetType_TODO:
		// This is similar to IGNORE, except we're meant to replace this at some point
	default:
		if len(auth.TargetType) == 0 {
			return fmt.Errorf("TargetType is unexpectedly empty")
		} else {
			return fmt.Errorf("TargetType not handled: `%s`", auth.TargetType)
		}
	}

	if !hasPrivileges {
		return sql.ErrPrivilegeCheckFailed.New(state.user.UserHostToString("'"))
	}
	return nil
}

// HandleAuthNode implements the AuthorizationHandler interface.
func (h defaultAuthorizationHandler) HandleAuthNode(ctx *sql.Context, aqs sql.AuthorizationQueryState, node sql.AuthorizationCheckerNode) error {
	if aqs == nil {
		aqs = h.NewQueryState(ctx)
	}
	state := aqs.(defaultAuthorizationQueryState)
	if state.err != nil || !state.enabled {
		return state.err
	}
	if !node.CheckAuth(ctx, state.db) {
		return sql.ErrPrivilegeCheckFailed.New(state.user.UserHostToString("'"))
	}
	return nil
}

// CheckDatabase implements the AuthorizationHandler interface.
func (h defaultAuthorizationHandler) CheckDatabase(ctx *sql.Context, aqs sql.AuthorizationQueryState, dbName string) error {
	if aqs == nil {
		aqs = h.NewQueryState(ctx)
	}
	state := aqs.(defaultAuthorizationQueryState)
	if state.err != nil || !state.enabled {
		return state.err
	}
	return h.authCheckDatabaseTableNames(ctx, state, dbName, "")
}

// CheckSchema implements the AuthorizationHandler interface.
func (h defaultAuthorizationHandler) CheckSchema(ctx *sql.Context, aqs sql.AuthorizationQueryState, dbName string, schemaName string) error {
	if aqs == nil {
		aqs = h.NewQueryState(ctx)
	}
	state := aqs.(defaultAuthorizationQueryState)
	if state.err != nil || !state.enabled {
		return state.err
	}
	// Since MySQL/Vitess doesn't use schemas, this will just check the database only
	return h.authCheckDatabaseTableNames(ctx, state, dbName, "")
}

// CheckTable implements the AuthorizationHandler interface.
func (h defaultAuthorizationHandler) CheckTable(ctx *sql.Context, aqs sql.AuthorizationQueryState, dbName string, schemaName string, tableName string) error {
	if aqs == nil {
		aqs = h.NewQueryState(ctx)
	}
	state := aqs.(defaultAuthorizationQueryState)
	if state.err != nil || !state.enabled {
		return state.err
	}
	if len(tableName) == 0 {
		return sql.ErrTableAccessDeniedForUser.New(state.user.UserHostToString("'"), tableName)
	}
	// Since MySQL/Vitess doesn't use schemas, it's ignored
	return h.authCheckDatabaseTableNames(ctx, state, dbName, tableName)
}

// call handles the CALL type.
func (h defaultAuthorizationHandler) call(ctx *sql.Context, state defaultAuthorizationQueryState, auth ast.AuthInformation) (bool, error) {
	if len(auth.TargetNames) != 3 {
		return false, fmt.Errorf("CALL expected 3 TargetNames")
	}
	dbName := h.authDatabaseName(ctx, auth.TargetNames[0])
	procName := auth.TargetNames[1]
	paramCount, err := strconv.Atoi(auth.TargetNames[2])
	if err != nil {
		return false, fmt.Errorf("CALL auth encountered error:\n%s", err.Error())
	}
	if err = h.authCheckDatabaseTableNames(ctx, state, dbName, ""); err != nil {
		return false, err
	}

	// Procedure permissions checking is performed in the same way MySQL does it, with an exception where
	// procedures which are marked as AdminOnly. These procedures are only accessible to users with explicit Execute
	// permissions on the procedure in question.

	adminOnly := false
	if h.cat != nil {
		proc, err := h.cat.ExternalStoredProcedure(ctx, procName, paramCount)
		// Not finding the procedure isn't great - but that's going to surface with a better error later in the
		// query execution. For the permission check, we'll proceed as though the procedure exists, and is not AdminOnly.
		if proc != nil && err == nil && proc.AdminOnly {
			adminOnly = true
		}
	}

	if !adminOnly {
		subject := sql.PrivilegeCheckSubject{
			Database: dbName,
		}
		if state.db.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(subject, sql.PrivilegeType_Execute)) {
			return true, nil
		}
	}

	subject := sql.PrivilegeCheckSubject{
		Database:    dbName,
		Routine:     procName,
		IsProcedure: true,
	}
	return state.db.RoutineAdminCheck(ctx, sql.NewPrivilegedOperation(subject, sql.PrivilegeType_Execute)), nil
}

// grantAndRevoke handles the GRANT and REVOKE types.
func (h defaultAuthorizationHandler) grantAndRevoke(ctx *sql.Context, state defaultAuthorizationQueryState, auth ast.AuthInformation) bool {
	// TODO: move all the logic to functions on the handler, rather than deferring to the nodes, but the nodes will still be inputs
	node, ok := auth.Extra.(sql.AuthorizationCheckerNode)
	if !ok {
		return false
	}
	return node.CheckAuth(ctx, state.db)
}

// renameTables handles the RENAME type.
func (h defaultAuthorizationHandler) renameTables(ctx *sql.Context, state defaultAuthorizationQueryState, auth ast.AuthInformation) (bool, error) {
	// Names are given in groups of 4: from_db, from_table, to_db, to_table
	if len(auth.TargetNames)%4 != 0 {
		return false, fmt.Errorf("expected tables in groups of 4")
	}
	var operations []sql.PrivilegedOperation
	for i := 0; i < len(auth.TargetNames); i += 4 {
		fromSubject := sql.PrivilegeCheckSubject{
			Database: h.authDatabaseName(ctx, auth.TargetNames[i]),
			Table:    auth.TargetNames[i+1],
		}
		toSubject := sql.PrivilegeCheckSubject{
			Database: h.authDatabaseName(ctx, auth.TargetNames[i+2]),
			Table:    auth.TargetNames[i+3],
		}
		operations = append(operations,
			sql.NewPrivilegedOperation(fromSubject, sql.PrivilegeType_Alter, sql.PrivilegeType_Drop),
			sql.NewPrivilegedOperation(toSubject, sql.PrivilegeType_Create, sql.PrivilegeType_Insert))
	}
	return state.db.UserHasPrivileges(ctx, operations...), nil
}

// visible handles the VISIBLE type.
func (h defaultAuthorizationHandler) visible(ctx *sql.Context, state defaultAuthorizationQueryState, auth *ast.AuthInformation) (bool, error) {
	// We clear the TargetType on the AuthInformation so that it's ignored by later steps
	targetType := auth.TargetType
	auth.TargetType = ast.AuthTargetType_Ignore

	switch targetType {
	case ast.AuthTargetType_DatabaseIdentifiers:
		for _, dbName := range auth.TargetNames {
			if err := h.authCheckDatabaseTableNames(ctx, state, dbName, ""); err != nil {
				return false, err
			}
		}
		return true, nil
	case ast.AuthTargetType_TODO:
		return true, nil
	default:
		if len(auth.TargetType) == 0 {
			return false, fmt.Errorf("TargetType is unexpectedly empty")
		} else {
			return false, fmt.Errorf("TargetType not handled: `%s`", auth.TargetType)
		}
	}
}

// authDatabaseName uses the current database from the context if a database is not specified, otherwise it returns the
// given database name.
func (h defaultAuthorizationHandler) authDatabaseName(ctx *sql.Context, dbName string) string {
	if len(dbName) == 0 {
		dbName = ctx.GetCurrentDatabase()
	}
	// Revision databases take the form "dbname/revision", so we must split the revision from the database name
	splitDbName := strings.SplitN(dbName, "/", 2)
	return splitDbName[0]
}

// authCheckDatabaseTableNames errors if the user does not have access to the database or table in any capacity,
// regardless of the command.
func (h defaultAuthorizationHandler) authCheckDatabaseTableNames(ctx *sql.Context, state defaultAuthorizationQueryState, dbName string, tableName string) error {
	if strings.EqualFold(dbName, "information_schema") {
		return nil
	}
	dbName = h.authDatabaseName(ctx, dbName)
	dbSet := state.privSet.Database(dbName)
	// If there are no usable privileges for this database then the table is inaccessible.
	if state.privSet.Count() == 0 && !dbSet.HasPrivileges() {
		return sql.ErrDatabaseAccessDeniedForUser.New(state.user.UserHostToString("'"), dbName)
	}
	if len(tableName) > 0 {
		tblSet := dbSet.Table(tableName)
		// If the user has no global static privileges, database-level privileges, or table-relevant privileges then the
		// table is not accessible.
		if state.privSet.Count() == 0 && dbSet.Count() == 0 && !tblSet.HasPrivileges() {
			return sql.ErrTableAccessDeniedForUser.New(state.user.UserHostToString("'"), tableName)
		}
	}
	return nil
}

// init sets the factory to use to this one by default. If this is changed, it will be from an integrator, and therefore
// this is guaranteed to run before the integrator's init function (if one is used).
func init() {
	sql.SetAuthorizationHandlerFactory(defaultAuthorizationHandlerFactory{})
}
