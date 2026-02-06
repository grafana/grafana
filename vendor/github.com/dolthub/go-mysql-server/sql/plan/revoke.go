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
	"strings"

	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

// Revoke represents the statement REVOKE [privilege...] ON [item] FROM [user...].
type Revoke struct {
	MySQLDb           sql.Database
	PrivilegeLevel    PrivilegeLevel
	Privileges        []Privilege
	Users             []UserName
	ObjectType        ObjectType
	IgnoreUnknownUser bool
}

var _ sql.Node = (*Revoke)(nil)
var _ sql.Databaser = (*Revoke)(nil)
var _ sql.CollationCoercible = (*Revoke)(nil)
var _ sql.AuthorizationCheckerNode = (*Revoke)(nil)

// Schema implements the interface sql.Node.
func (n *Revoke) Schema() sql.Schema {
	return types.OkResultSchema
}

func (n *Revoke) IsReadOnly() bool {
	return false
}

// String implements the interface sql.Node.
func (n *Revoke) String() string {
	users := make([]string, len(n.Users))
	for i, user := range n.Users {
		users[i] = user.String("")
	}
	return fmt.Sprintf("Revoke(On: %s, From: %s)", n.PrivilegeLevel.String(), strings.Join(users, ", "))
}

// Database implements the interface sql.Databaser.
func (n *Revoke) Database() sql.Database {
	return n.MySQLDb
}

// WithDatabase implements the interface sql.Databaser.
func (n *Revoke) WithDatabase(db sql.Database) (sql.Node, error) {
	nn := *n
	nn.MySQLDb = db
	return &nn, nil
}

// Resolved implements the interface sql.Node.
func (n *Revoke) Resolved() bool {
	_, ok := n.MySQLDb.(sql.UnresolvedDatabase)
	return !ok
}

// Children implements the interface sql.Node.
func (n *Revoke) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (n *Revoke) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}
	return n, nil
}

// CheckAuth implements the interface sql.AuthorizationCheckerNode.
func (n *Revoke) CheckAuth(ctx *sql.Context, opChecker sql.PrivilegedOperationChecker) bool {
	subject := sql.PrivilegeCheckSubject{Database: "mysql"}
	if opChecker.UserHasPrivileges(ctx,
		sql.NewPrivilegedOperation(subject, sql.PrivilegeType_Update)) {
		return true
	}
	if n.PrivilegeLevel.Database == "*" && n.PrivilegeLevel.TableRoutine == "*" {
		if n.Privileges[0].Type == PrivilegeType_All {
			return opChecker.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{},
				sql.PrivilegeType_Select,
				sql.PrivilegeType_Insert,
				sql.PrivilegeType_Update,
				sql.PrivilegeType_Delete,
				sql.PrivilegeType_Create,
				sql.PrivilegeType_Drop,
				sql.PrivilegeType_Reload,
				sql.PrivilegeType_Shutdown,
				sql.PrivilegeType_Process,
				sql.PrivilegeType_File,
				sql.PrivilegeType_References,
				sql.PrivilegeType_Index,
				sql.PrivilegeType_Alter,
				sql.PrivilegeType_ShowDB,
				sql.PrivilegeType_Super,
				sql.PrivilegeType_CreateTempTable,
				sql.PrivilegeType_LockTables,
				sql.PrivilegeType_Execute,
				sql.PrivilegeType_ReplicationSlave,
				sql.PrivilegeType_ReplicationClient,
				sql.PrivilegeType_CreateView,
				sql.PrivilegeType_ShowView,
				sql.PrivilegeType_CreateRoutine,
				sql.PrivilegeType_AlterRoutine,
				sql.PrivilegeType_CreateUser,
				sql.PrivilegeType_Event,
				sql.PrivilegeType_Trigger,
				sql.PrivilegeType_CreateTablespace,
				sql.PrivilegeType_CreateRole,
				sql.PrivilegeType_DropRole,
				sql.PrivilegeType_GrantOption,
			))
		}
		return opChecker.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{},
			convertToSqlPrivilegeType(true, n.Privileges...)...))
	} else if n.PrivilegeLevel.Database != "*" && n.PrivilegeLevel.TableRoutine == "*" {
		database := n.PrivilegeLevel.Database
		if database == "" {
			database = ctx.GetCurrentDatabase()
		}
		subject = sql.PrivilegeCheckSubject{Database: database}

		if n.Privileges[0].Type == PrivilegeType_All {
			return opChecker.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(subject,
				sql.PrivilegeType_Alter,
				sql.PrivilegeType_AlterRoutine,
				sql.PrivilegeType_Create,
				sql.PrivilegeType_CreateRoutine,
				sql.PrivilegeType_CreateTempTable,
				sql.PrivilegeType_CreateView,
				sql.PrivilegeType_Delete,
				sql.PrivilegeType_Drop,
				sql.PrivilegeType_Event,
				sql.PrivilegeType_Execute,
				sql.PrivilegeType_Index,
				sql.PrivilegeType_Insert,
				sql.PrivilegeType_LockTables,
				sql.PrivilegeType_References,
				sql.PrivilegeType_Select,
				sql.PrivilegeType_ShowView,
				sql.PrivilegeType_Trigger,
				sql.PrivilegeType_Update,
				sql.PrivilegeType_GrantOption,
			))
		}
		return opChecker.UserHasPrivileges(ctx, sql.NewPrivilegedOperation(subject,
			convertToSqlPrivilegeType(true, n.Privileges...)...))
	} else {
		//TODO: add column checks
		subject = sql.PrivilegeCheckSubject{
			Database: n.PrivilegeLevel.Database,
			Table:    n.PrivilegeLevel.TableRoutine,
		}

		if n.Privileges[0].Type == PrivilegeType_All {
			return opChecker.UserHasPrivileges(ctx,
				sql.NewPrivilegedOperation(subject,
					sql.PrivilegeType_Alter,
					sql.PrivilegeType_Create,
					sql.PrivilegeType_CreateView,
					sql.PrivilegeType_Delete,
					sql.PrivilegeType_Drop,
					sql.PrivilegeType_Index,
					sql.PrivilegeType_Insert,
					sql.PrivilegeType_References,
					sql.PrivilegeType_Select,
					sql.PrivilegeType_ShowView,
					sql.PrivilegeType_Trigger,
					sql.PrivilegeType_Update,
					sql.PrivilegeType_GrantOption,
				))
		}
		return opChecker.UserHasPrivileges(ctx,
			sql.NewPrivilegedOperation(subject,
				convertToSqlPrivilegeType(true, n.Privileges...)...))
	}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Revoke) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// HandleGlobalPrivileges handles removing global privileges from a user.
func (n *Revoke) HandleGlobalPrivileges(user *mysql_db.User) error {
	for i, priv := range n.Privileges {
		if len(priv.Columns) > 0 {
			return sql.ErrGrantRevokeIllegalPrivilege.New()
		}
		switch priv.Type {
		case PrivilegeType_All:
			// If ALL is present, then no other privileges may be provided.
			// This should be enforced by the parser, so this is a backup check just in case
			if i == 0 && len(n.Privileges) == 1 {
				user.PrivilegeSet.ClearGlobal()
			} else {
				return sql.ErrGrantRevokeIllegalPrivilege.New()
			}
		case PrivilegeType_Alter:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Alter)
		case PrivilegeType_AlterRoutine:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_AlterRoutine)
		case PrivilegeType_Create:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Create)
		case PrivilegeType_CreateRole:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_CreateRole)
		case PrivilegeType_CreateRoutine:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_CreateRoutine)
		case PrivilegeType_CreateTablespace:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_CreateTablespace)
		case PrivilegeType_CreateTemporaryTables:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_CreateTempTable)
		case PrivilegeType_CreateUser:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_CreateUser)
		case PrivilegeType_CreateView:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_CreateView)
		case PrivilegeType_Delete:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Delete)
		case PrivilegeType_Drop:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Drop)
		case PrivilegeType_DropRole:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_DropRole)
		case PrivilegeType_Event:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Event)
		case PrivilegeType_Execute:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Execute)
		case PrivilegeType_File:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_File)
		case PrivilegeType_GrantOption:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_GrantOption)
		case PrivilegeType_Index:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Index)
		case PrivilegeType_Insert:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Insert)
		case PrivilegeType_LockTables:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_LockTables)
		case PrivilegeType_Process:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Process)
		case PrivilegeType_References:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_References)
		case PrivilegeType_Reload:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Reload)
		case PrivilegeType_ReplicationClient:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_ReplicationClient)
		case PrivilegeType_ReplicationSlave:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_ReplicationSlave)
		case PrivilegeType_Select:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Select)
		case PrivilegeType_ShowDatabases:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_ShowDB)
		case PrivilegeType_ShowView:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_ShowView)
		case PrivilegeType_Shutdown:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Shutdown)
		case PrivilegeType_Super:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Super)
		case PrivilegeType_Trigger:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Trigger)
		case PrivilegeType_Update:
			user.PrivilegeSet.RemoveGlobalStatic(sql.PrivilegeType_Update)
		case PrivilegeType_Usage:
			// Usage is equal to no privilege
		case PrivilegeType_Dynamic:
			if !priv.IsValidDynamic() {
				return fmt.Errorf(`REVOKE does not yet support the dynamic privilege: "%s"`, priv.Dynamic)
			}
			user.PrivilegeSet.RemoveGlobalDynamic(priv.Dynamic)
		default:
			return sql.ErrGrantRevokeIllegalPrivilege.New()
		}
	}
	return nil
}

// HandleDatabasePrivileges  handles removing database privileges from a user.
func (n *Revoke) HandleDatabasePrivileges(user *mysql_db.User, dbName string) error {
	for i, priv := range n.Privileges {
		if len(priv.Columns) > 0 {
			return sql.ErrGrantRevokeIllegalPrivilege.New()
		}
		switch priv.Type {
		case PrivilegeType_All:
			// If ALL is present, then no other privileges may be provided.
			// This should be enforced by the parser, so this is a backup check just in case
			if i == 0 && len(n.Privileges) == 1 {
				user.PrivilegeSet.ClearDatabase(dbName)
			} else {
				return sql.ErrGrantRevokeIllegalPrivilege.New()
			}
		case PrivilegeType_Alter:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Alter)
		case PrivilegeType_AlterRoutine:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_AlterRoutine)
		case PrivilegeType_Create:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Create)
		case PrivilegeType_CreateRoutine:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_CreateRoutine)
		case PrivilegeType_CreateTemporaryTables:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_CreateTempTable)
		case PrivilegeType_CreateView:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_CreateView)
		case PrivilegeType_Delete:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Delete)
		case PrivilegeType_Drop:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Drop)
		case PrivilegeType_Event:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Event)
		case PrivilegeType_Execute:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Execute)
		case PrivilegeType_GrantOption:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_GrantOption)
		case PrivilegeType_Index:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Index)
		case PrivilegeType_Insert:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Insert)
		case PrivilegeType_LockTables:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_LockTables)
		case PrivilegeType_References:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_References)
		case PrivilegeType_Select:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Select)
		case PrivilegeType_ShowView:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_ShowView)
		case PrivilegeType_Trigger:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Trigger)
		case PrivilegeType_Update:
			user.PrivilegeSet.RemoveDatabase(dbName, sql.PrivilegeType_Update)
		case PrivilegeType_Usage:
			// Usage is equal to no privilege
		case PrivilegeType_Dynamic:
			return sql.ErrGrantRevokeIllegalPrivilegeWithMessage.New(
				"dynamic privileges may only operate at a global scope")
		default:
			return sql.ErrGrantRevokeIllegalPrivilege.New()
		}
	}
	return nil
}

// HandleTablePrivileges  handles removing table privileges from a user.
func (n *Revoke) HandleTablePrivileges(user *mysql_db.User, dbName string, tblName string) error {
	for i, priv := range n.Privileges {
		if len(priv.Columns) > 0 {
			return fmt.Errorf("GRANT has not yet implemented column privileges")
		}
		switch priv.Type {
		case PrivilegeType_All:
			// If ALL is present, then no other privileges may be provided.
			// This should be enforced by the parser, so this is a backup check just in case
			if i == 0 && len(n.Privileges) == 1 {
				user.PrivilegeSet.ClearTable(dbName, tblName)
			} else {
				return sql.ErrGrantRevokeIllegalPrivilege.New()
			}
		case PrivilegeType_Alter:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_Alter)
		case PrivilegeType_Create:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_Create)
		case PrivilegeType_CreateView:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_CreateView)
		case PrivilegeType_Delete:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_Delete)
		case PrivilegeType_Drop:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_Drop)
		case PrivilegeType_GrantOption:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_GrantOption)
		case PrivilegeType_Index:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_Index)
		case PrivilegeType_Insert:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_Insert)
		case PrivilegeType_References:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_References)
		case PrivilegeType_Select:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_Select)
		case PrivilegeType_ShowView:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_ShowView)
		case PrivilegeType_Trigger:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_Trigger)
		case PrivilegeType_Update:
			user.PrivilegeSet.RemoveTable(dbName, tblName, sql.PrivilegeType_Update)
		case PrivilegeType_Usage:
			// Usage is equal to no privilege
		case PrivilegeType_Dynamic:
			return sql.ErrGrantRevokeIllegalPrivilegeWithMessage.New(
				"dynamic privileges may only operate at a global scope")
		default:
			return sql.ErrGrantRevokeIllegalPrivilege.New()
		}
	}
	return nil
}

func (n *Revoke) HandleRoutinePrivileges(user *mysql_db.User, dbName string, routineName string, isProcedureType bool) error {
	for _, priv := range n.Privileges {
		switch priv.Type {
		case PrivilegeType_AlterRoutine:
			user.PrivilegeSet.RemoveRoutine(dbName, routineName, isProcedureType, sql.PrivilegeType_AlterRoutine)
		case PrivilegeType_Execute:
			user.PrivilegeSet.RemoveRoutine(dbName, routineName, isProcedureType, sql.PrivilegeType_Execute)
		case PrivilegeType_GrantOption:
			user.PrivilegeSet.RemoveRoutine(dbName, routineName, isProcedureType, sql.PrivilegeType_GrantOption)
		default:
			return sql.ErrGrantRevokeIllegalPrivilege.New()
		}
	}
	return nil
}

// RevokeRole represents the statement REVOKE [role...] FROM [user...].
type RevokeRole struct {
	MySQLDb           sql.Database
	Roles             []UserName
	TargetUsers       []UserName
	IfExists          bool
	IgnoreUnknownUser bool
}

var _ sql.Node = (*RevokeRole)(nil)
var _ sql.Databaser = (*RevokeRole)(nil)
var _ sql.CollationCoercible = (*RevokeRole)(nil)
var _ sql.AuthorizationCheckerNode = (*RevokeRole)(nil)

// NewRevokeRole returns a new RevokeRole node.
func NewRevokeRole(roles []UserName, users []UserName, ifExists, ignoreUnknownUser bool) *RevokeRole {
	return &RevokeRole{
		Roles:             roles,
		TargetUsers:       users,
		IfExists:          ifExists,
		IgnoreUnknownUser: ignoreUnknownUser,
		MySQLDb:           sql.UnresolvedDatabase("mysql"),
	}
}

// Schema implements the interface sql.Node.
func (n *RevokeRole) Schema() sql.Schema {
	return types.OkResultSchema
}

// String implements the interface sql.Node.
func (n *RevokeRole) String() string {
	roles := make([]string, len(n.Roles))
	for i, role := range n.Roles {
		roles[i] = role.String("")
	}
	users := make([]string, len(n.TargetUsers))
	for i, user := range n.TargetUsers {
		users[i] = user.String("")
	}
	return fmt.Sprintf("RevokeRole(Roles: %s, From: %s)", strings.Join(roles, ", "), strings.Join(users, ", "))
}

// Database implements the interface sql.Databaser.
func (n *RevokeRole) Database() sql.Database {
	return n.MySQLDb
}

// WithDatabase implements the interface sql.Databaser.
func (n *RevokeRole) WithDatabase(db sql.Database) (sql.Node, error) {
	nn := *n
	nn.MySQLDb = db
	return &nn, nil
}

// Resolved implements the interface sql.Node.
func (n *RevokeRole) Resolved() bool {
	_, ok := n.MySQLDb.(sql.UnresolvedDatabase)
	return !ok
}

func (n *RevokeRole) IsReadOnly() bool {
	return false
}

// Children implements the interface sql.Node.
func (n *RevokeRole) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (n *RevokeRole) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}
	return n, nil
}

// CheckAuth implements the interface sql.AuthorizationCheckerNode.
func (n *RevokeRole) CheckAuth(ctx *sql.Context, opChecker sql.PrivilegedOperationChecker) bool {
	if opChecker.UserHasPrivileges(ctx,
		sql.NewPrivilegedOperation(sql.PrivilegeCheckSubject{}, sql.PrivilegeType_Super)) {
		return true
	}
	//TODO: only active roles may be revoked if the SUPER privilege is not held
	mysqlDb := n.MySQLDb.(*mysql_db.MySQLDb)
	client := ctx.Session.Client()

	reader := mysqlDb.Reader()
	defer reader.Close()

	user := mysqlDb.GetUser(reader, client.User, client.Address, false)
	if user == nil {
		return false
	}
	roleEdges := reader.GetToUserRoleEdges(mysql_db.RoleEdgesToKey{
		ToHost: user.Host,
		ToUser: user.User,
	})
ROLES:
	for _, roleName := range n.Roles {
		role := mysqlDb.GetUser(reader, roleName.Name, roleName.Host, true)
		if role == nil {
			return false
		}
		for _, roleEdge := range roleEdges {
			if roleEdge.FromUser == role.User && roleEdge.FromHost == role.Host && roleEdge.WithAdminOption {
				continue ROLES
			}
		}
		return false
	}
	return true
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*RevokeRole) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// RevokeProxy represents the statement REVOKE PROXY.
type RevokeProxy struct {
	On                UserName
	From              []UserName
	IfExists          bool
	ignoreUnknownUser bool
}

var _ sql.Node = (*RevokeProxy)(nil)
var _ sql.CollationCoercible = (*RevokeProxy)(nil)
var _ sql.AuthorizationCheckerNode = (*RevokeProxy)(nil)

// NewRevokeProxy returns a new RevokeProxy node.
func NewRevokeProxy(on UserName, from []UserName, ifExists, ignoreUnknownUser bool) *RevokeProxy {
	return &RevokeProxy{
		On:                on,
		From:              from,
		IfExists:          ifExists,
		ignoreUnknownUser: ignoreUnknownUser,
	}
}

// Schema implements the interface sql.Node.
func (n *RevokeProxy) Schema() sql.Schema {
	return types.OkResultSchema
}

// String implements the interface sql.Node.
func (n *RevokeProxy) String() string {
	users := make([]string, len(n.From))
	for i, user := range n.From {
		users[i] = user.String("")
	}
	return fmt.Sprintf("RevokeProxy(On: %s, From: %s)", n.On.String(""), strings.Join(users, ", "))
}

// Resolved implements the interface sql.Node.
func (n *RevokeProxy) Resolved() bool {
	return true
}

func (n *RevokeProxy) IsReadOnly() bool {
	return false
}

// Children implements the interface sql.Node.
func (n *RevokeProxy) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (n *RevokeProxy) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}
	return n, nil
}

// CheckAuth implements the interface sql.AuthorizationCheckerNode.
func (n *RevokeProxy) CheckAuth(ctx *sql.Context, opChecker sql.PrivilegedOperationChecker) bool {
	//TODO: add this when proxy support is added
	return true
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*RevokeProxy) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// RowIter implements the interface sql.Node.
func (n *RevokeProxy) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	return nil, fmt.Errorf("not yet implemented")
}
