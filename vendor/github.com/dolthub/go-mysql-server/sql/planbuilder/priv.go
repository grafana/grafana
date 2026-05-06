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

package planbuilder

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/dolthub/vitess/go/mysql"
	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

func convertAccountName(names ...ast.AccountName) []plan.UserName {
	userNames := make([]plan.UserName, len(names))
	for i, name := range names {
		userNames[i] = plan.UserName{
			Name:    name.Name,
			Host:    name.Host,
			AnyHost: name.AnyHost,
		}
	}
	return userNames
}

func convertPrivilege(privileges ...ast.Privilege) []plan.Privilege {
	planPrivs := make([]plan.Privilege, len(privileges))
	for i, privilege := range privileges {
		var privType plan.PrivilegeType
		var dynamicString string
		switch privilege.Type {
		case ast.PrivilegeType_All:
			privType = plan.PrivilegeType_All
		case ast.PrivilegeType_Alter:
			privType = plan.PrivilegeType_Alter
		case ast.PrivilegeType_AlterRoutine:
			privType = plan.PrivilegeType_AlterRoutine
		case ast.PrivilegeType_Create:
			privType = plan.PrivilegeType_Create
		case ast.PrivilegeType_CreateRole:
			privType = plan.PrivilegeType_CreateRole
		case ast.PrivilegeType_CreateRoutine:
			privType = plan.PrivilegeType_CreateRoutine
		case ast.PrivilegeType_CreateTablespace:
			privType = plan.PrivilegeType_CreateTablespace
		case ast.PrivilegeType_CreateTemporaryTables:
			privType = plan.PrivilegeType_CreateTemporaryTables
		case ast.PrivilegeType_CreateUser:
			privType = plan.PrivilegeType_CreateUser
		case ast.PrivilegeType_CreateView:
			privType = plan.PrivilegeType_CreateView
		case ast.PrivilegeType_Delete:
			privType = plan.PrivilegeType_Delete
		case ast.PrivilegeType_Drop:
			privType = plan.PrivilegeType_Drop
		case ast.PrivilegeType_DropRole:
			privType = plan.PrivilegeType_DropRole
		case ast.PrivilegeType_Event:
			privType = plan.PrivilegeType_Event
		case ast.PrivilegeType_Execute:
			privType = plan.PrivilegeType_Execute
		case ast.PrivilegeType_File:
			privType = plan.PrivilegeType_File
		case ast.PrivilegeType_GrantOption:
			privType = plan.PrivilegeType_GrantOption
		case ast.PrivilegeType_Index:
			privType = plan.PrivilegeType_Index
		case ast.PrivilegeType_Insert:
			privType = plan.PrivilegeType_Insert
		case ast.PrivilegeType_LockTables:
			privType = plan.PrivilegeType_LockTables
		case ast.PrivilegeType_Process:
			privType = plan.PrivilegeType_Process
		case ast.PrivilegeType_References:
			privType = plan.PrivilegeType_References
		case ast.PrivilegeType_Reload:
			privType = plan.PrivilegeType_Reload
		case ast.PrivilegeType_ReplicationClient:
			privType = plan.PrivilegeType_ReplicationClient
		case ast.PrivilegeType_ReplicationSlave:
			privType = plan.PrivilegeType_ReplicationSlave
		case ast.PrivilegeType_Select:
			privType = plan.PrivilegeType_Select
		case ast.PrivilegeType_ShowDatabases:
			privType = plan.PrivilegeType_ShowDatabases
		case ast.PrivilegeType_ShowView:
			privType = plan.PrivilegeType_ShowView
		case ast.PrivilegeType_Shutdown:
			privType = plan.PrivilegeType_Shutdown
		case ast.PrivilegeType_Super:
			privType = plan.PrivilegeType_Super
		case ast.PrivilegeType_Trigger:
			privType = plan.PrivilegeType_Trigger
		case ast.PrivilegeType_Update:
			privType = plan.PrivilegeType_Update
		case ast.PrivilegeType_Usage:
			privType = plan.PrivilegeType_Usage
		case ast.PrivilegeType_Dynamic:
			privType = plan.PrivilegeType_Dynamic
			dynamicString = privilege.DynamicName
		default:
			// all privileges have been implemented, so if we hit the default something bad has happened
			panic("given privilege type parses but is not implemented")
		}
		planPrivs[i] = plan.Privilege{
			Type:    privType,
			Columns: privilege.Columns,
			Dynamic: dynamicString,
		}
	}
	return planPrivs
}

func convertObjectType(objType ast.GrantObjectType) plan.ObjectType {
	switch objType {
	case ast.GrantObjectType_Any:
		return plan.ObjectType_Any
	case ast.GrantObjectType_Table:
		return plan.ObjectType_Table
	case ast.GrantObjectType_Function:
		return plan.ObjectType_Function
	case ast.GrantObjectType_Procedure:
		return plan.ObjectType_Procedure
	default:
		panic("no other grant object types exist")
	}
}

func convertPrivilegeLevel(privLevel ast.PrivilegeLevel) plan.PrivilegeLevel {
	return plan.PrivilegeLevel{
		Database:     privLevel.Database,
		TableRoutine: privLevel.TableRoutine,
	}
}

func (b *Builder) buildAuthenticatedUser(user ast.AccountWithAuth) plan.AuthenticatedUser {
	authUser := plan.AuthenticatedUser{
		UserName: convertAccountName(user.AccountName)[0],
	}
	if user.Auth1 != nil {
		authUser.Identity = user.Auth1.Identity
		if user.Auth1.Password == "" && user.Auth1.Identity != "" {
			// If an identity has been specified, instead of a password, then use the auth details
			// directly, without an Authentication implementation that would obscure the password.
			authUser.Auth1 = plan.NewOtherAuthentication(user.Auth1.Password, user.Auth1.Plugin, user.Auth1.Identity)
		} else if user.Auth1.Plugin == string(mysql.MysqlNativePassword) {
			authUser.Auth1 = plan.AuthenticationMysqlNativePassword(user.Auth1.Password)
		} else if user.Auth1.Plugin == string(mysql.CachingSha2Password) {
			authUser.Auth1 = plan.NewCachingSha2PasswordAuthentication(user.Auth1.Password)
		} else if len(user.Auth1.Plugin) > 0 {
			authUser.Auth1 = plan.NewOtherAuthentication(user.Auth1.Password, user.Auth1.Plugin, user.Auth1.Identity)
		} else {
			// We default to using the password, even if it's empty
			authUser.Auth1 = plan.NewDefaultAuthentication(user.Auth1.Password)
		}
	}
	// We do not support Auth2, Auth3, or AuthInitial, so error out if they are set, since nothing reads them
	if user.Auth2 != nil || user.Auth3 != nil || user.AuthInitial != nil {
		err := fmt.Errorf(`multi-factor authentication is not yet supported`)
		b.handleErr(err)
	}
	//TODO: figure out how to represent the remaining authentication methods and multi-factor auth

	return authUser
}

func (b *Builder) buildCreateUser(inScope *scope, n *ast.CreateUser) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	authUsers := make([]plan.AuthenticatedUser, len(n.Users))
	for i, user := range n.Users {
		if user.Auth1 != nil && user.Auth1.RandomPassword {
			b.handleErr(fmt.Errorf("random password generation is not currently supported; " +
				"you can request support at https://github.com/dolthub/dolt/issues/new"))
		}
		authUsers[i] = b.buildAuthenticatedUser(user)
	}
	var tlsOptions *plan.TLSOptions
	if n.TLSOptions != nil {
		tlsOptions = &plan.TLSOptions{
			SSL:     n.TLSOptions.SSL,
			X509:    n.TLSOptions.X509,
			Cipher:  n.TLSOptions.Cipher,
			Issuer:  n.TLSOptions.Issuer,
			Subject: n.TLSOptions.Subject,
		}
	}
	var accountLimits *plan.AccountLimits
	if n.AccountLimits != nil {
		var maxQueries *int64
		if n.AccountLimits.MaxQueriesPerHour != nil {
			if val, err := strconv.ParseInt(string(n.AccountLimits.MaxQueriesPerHour.Val), 10, 64); err != nil {
				b.handleErr(err)
			} else {
				maxQueries = &val
			}
		}
		var maxUpdates *int64
		if n.AccountLimits.MaxUpdatesPerHour != nil {
			if val, err := strconv.ParseInt(string(n.AccountLimits.MaxUpdatesPerHour.Val), 10, 64); err != nil {
				b.handleErr(err)
			} else {
				maxUpdates = &val
			}
		}
		var maxConnections *int64
		if n.AccountLimits.MaxConnectionsPerHour != nil {
			if val, err := strconv.ParseInt(string(n.AccountLimits.MaxConnectionsPerHour.Val), 10, 64); err != nil {
				b.handleErr(err)
			} else {
				maxConnections = &val
			}
		}
		var maxUserConnections *int64
		if n.AccountLimits.MaxUserConnections != nil {
			if val, err := strconv.ParseInt(string(n.AccountLimits.MaxUserConnections.Val), 10, 64); err != nil {
				b.handleErr(err)
			} else {
				maxUserConnections = &val
			}
		}
		accountLimits = &plan.AccountLimits{
			MaxQueriesPerHour:     maxQueries,
			MaxUpdatesPerHour:     maxUpdates,
			MaxConnectionsPerHour: maxConnections,
			MaxUserConnections:    maxUserConnections,
		}
	}
	var passwordOptions *plan.PasswordOptions
	if n.PasswordOptions != nil {
		var expirationTime *int64
		if n.PasswordOptions.ExpirationTime != nil {
			if val, err := strconv.ParseInt(string(n.PasswordOptions.ExpirationTime.Val), 10, 64); err != nil {
				b.handleErr(err)
			} else {
				expirationTime = &val
			}
		}
		var history *int64
		if n.PasswordOptions.History != nil {
			if val, err := strconv.ParseInt(string(n.PasswordOptions.History.Val), 10, 64); err != nil {
				b.handleErr(err)
			} else {
				history = &val
			}
		}
		var reuseInterval *int64
		if n.PasswordOptions.ReuseInterval != nil {
			if val, err := strconv.ParseInt(string(n.PasswordOptions.ReuseInterval.Val), 10, 64); err != nil {
				b.handleErr(err)
			} else {
				reuseInterval = &val
			}
		}
		var failedAttempts *int64
		if n.PasswordOptions.FailedAttempts != nil {
			if val, err := strconv.ParseInt(string(n.PasswordOptions.FailedAttempts.Val), 10, 64); err != nil {
				b.handleErr(err)
			} else {
				failedAttempts = &val
			}
		}
		var lockTime *int64
		if n.PasswordOptions.LockTime != nil {
			if val, err := strconv.ParseInt(string(n.PasswordOptions.LockTime.Val), 10, 64); err != nil {
				b.handleErr(err)
			} else {
				lockTime = &val
			}
		}
		passwordOptions = &plan.PasswordOptions{
			RequireCurrentOptional: n.PasswordOptions.RequireCurrentOptional,
			ExpirationTime:         expirationTime,
			History:                history,
			ReuseInterval:          reuseInterval,
			FailedAttempts:         failedAttempts,
			LockTime:               lockTime,
		}
	}
	database := b.resolveDb("mysql")

	outScope.node = &plan.CreateUser{
		IfNotExists:     n.IfNotExists,
		Users:           authUsers,
		DefaultRoles:    convertAccountName(n.DefaultRoles...),
		TLSOptions:      tlsOptions,
		AccountLimits:   accountLimits,
		PasswordOptions: passwordOptions,
		Locked:          n.Locked,
		Attribute:       n.Attribute,
		MySQLDb:         database,
	}
	return outScope
}

func (b *Builder) buildRenameUser(inScope *scope, n *ast.RenameUser) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	oldNames := make([]plan.UserName, len(n.Accounts))
	newNames := make([]plan.UserName, len(n.Accounts))
	for i, account := range n.Accounts {
		oldNames[i] = convertAccountName(account.From)[0]
		newNames[i] = convertAccountName(account.To)[0]
	}
	outScope = inScope.push()
	outScope.node = plan.NewRenameUser(oldNames, newNames)
	return outScope
}

func (b *Builder) buildGrantPrivilege(inScope *scope, n *ast.GrantPrivilege) (outScope *scope) {
	outScope = inScope.push()
	var gau *plan.GrantUserAssumption
	if n.As != nil {
		gauType := plan.GrantUserAssumptionType_Default
		switch n.As.Type {
		case ast.GrantUserAssumptionType_None:
			gauType = plan.GrantUserAssumptionType_None
		case ast.GrantUserAssumptionType_All:
			gauType = plan.GrantUserAssumptionType_All
		case ast.GrantUserAssumptionType_AllExcept:
			gauType = plan.GrantUserAssumptionType_AllExcept
		case ast.GrantUserAssumptionType_Roles:
			gauType = plan.GrantUserAssumptionType_Roles
		}
		gau = &plan.GrantUserAssumption{
			Type:  gauType,
			User:  convertAccountName(n.As.User)[0],
			Roles: convertAccountName(n.As.Roles...),
		}
	}
	granter := b.ctx.Session.Client().User
	level := convertPrivilegeLevel(n.PrivilegeLevel)
	if strings.ToLower(level.Database) == sql.InformationSchemaDatabaseName {
		err := sql.ErrDatabaseAccessDeniedForUser.New(granter, level.Database)
		b.handleErr(err)
	}

	outScope.node = &plan.Grant{
		Privileges:      convertPrivilege(n.Privileges...),
		ObjectType:      convertObjectType(n.ObjectType),
		PrivilegeLevel:  level,
		Users:           convertAccountName(n.To...),
		WithGrantOption: n.WithGrantOption,
		As:              gau,
		MySQLDb:         b.resolveDb("mysql"),
		Catalog:         b.cat,
	}
	n.Auth.Extra = outScope.node
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}

	return outScope
}

func (b *Builder) buildShowGrants(inScope *scope, n *ast.ShowGrants) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	var currentUser bool
	var user *plan.UserName
	if n.For != nil {
		currentUser = false
		user = &convertAccountName(*n.For)[0]
	} else {
		currentUser = true
		client := b.ctx.Session.Client()
		user = &plan.UserName{
			Name:    client.User,
			Host:    client.Address,
			AnyHost: client.Address == "%",
		}
	}
	outScope = inScope.push()
	outScope.node = &plan.ShowGrants{
		CurrentUser: currentUser,
		For:         user,
		Using:       convertAccountName(n.Using...),
		MySQLDb:     b.resolveDb("mysql"),
	}
	return
}

func (b *Builder) buildFlush(inScope *scope, f *ast.Flush) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, f.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	var writesToBinlog = true
	switch strings.ToLower(f.Type) {
	case "no_write_to_binlog", "local":
		//writesToBinlog = false
		err := fmt.Errorf("%s not supported", f.Type)
		b.handleErr(err)
	}

	// MySQL docs: https://dev.mysql.com/doc/refman/8.0/en/flush.html
	// Some opts should be no-ops, but we should support others, so have those be errors
	opt := strings.ToLower(f.Option.Name)
	if strings.HasPrefix(opt, "relay logs for channel") {
		err := fmt.Errorf("%s not supported", f.Option.Name)
		b.handleErr(err)
	}
	switch opt {
	case "privileges":
		node, _ := plan.NewFlushPrivileges(writesToBinlog).WithDatabase(b.resolveDb("mysql"))
		outScope.node = node
	case "binary logs", "engine logs", "table", "tables":
		node := plan.Nothing{}
		outScope.node = node
	case "error logs", "relay logs", "general logs", "slow logs", "status":
		err := fmt.Errorf("%s not supported", f.Option.Name)
		b.handleErr(err)
	default:
		err := fmt.Errorf("%s not supported", f.Option.Name)
		b.handleErr(err)
	}
	return outScope
}

func (b *Builder) buildCreateRole(inScope *scope, n *ast.CreateRole) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	outScope.node = &plan.CreateRole{
		IfNotExists: n.IfNotExists,
		Roles:       convertAccountName(n.Roles...),
		MySQLDb:     b.resolveDb("mysql"),
	}
	return
}

func (b *Builder) buildDropRole(inScope *scope, n *ast.DropRole) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	outScope.node = &plan.DropRole{
		IfExists: n.IfExists,
		Roles:    convertAccountName(n.Roles...),
		MySQLDb:  b.resolveDb("mysql"),
	}
	return
}

func (b *Builder) buildDropUser(inScope *scope, n *ast.DropUser) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	outScope.node = &plan.DropUser{
		IfExists: n.IfExists,
		Users:    convertAccountName(n.AccountNames...),
		MySQLDb:  b.resolveDb("mysql"),
	}
	return
}

func (b *Builder) buildGrantRole(inScope *scope, n *ast.GrantRole) (outScope *scope) {
	outScope = inScope.push()
	outScope.node = &plan.GrantRole{
		Roles:           convertAccountName(n.Roles...),
		TargetUsers:     convertAccountName(n.To...),
		WithAdminOption: n.WithAdminOption,
		MySQLDb:         b.resolveDb("mysql"),
	}
	n.Auth.Extra = outScope.node
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	return
}

func (b *Builder) buildGrantProxy(inScope *scope, n *ast.GrantProxy) (outScope *scope) {
	outScope = inScope.push()

	outScope.node = plan.NewGrantProxy(
		convertAccountName(n.On)[0],
		convertAccountName(n.To...),
		n.WithGrantOption,
	)
	n.Auth.Extra = outScope.node
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	return
}

func (b *Builder) buildRevokePrivilege(inScope *scope, n *ast.RevokePrivilege) (outScope *scope) {
	privs := convertPrivilege(n.Privileges...)
	objType := convertObjectType(n.ObjectType)
	level := convertPrivilegeLevel(n.PrivilegeLevel)
	users := convertAccountName(n.From...)
	revoker := b.ctx.Session.Client().User
	if strings.ToLower(level.Database) == sql.InformationSchemaDatabaseName {
		b.handleErr(sql.ErrDatabaseAccessDeniedForUser.New(revoker, level.Database))
	}
	outScope = inScope.push()
	outScope.node = &plan.Revoke{
		Privileges:        privs,
		ObjectType:        objType,
		PrivilegeLevel:    level,
		Users:             users,
		IgnoreUnknownUser: n.IgnoreUnknownUser,
		MySQLDb:           b.resolveDb("mysql"),
	}
	n.Auth.Extra = outScope.node
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	return
}

func (b *Builder) buildRevokeRole(inScope *scope, n *ast.RevokeRole) (outScope *scope) {
	outScope = inScope.push()
	outScope.node = &plan.RevokeRole{
		Roles:             convertAccountName(n.Roles...),
		TargetUsers:       convertAccountName(n.From...),
		IfExists:          n.IfExists,
		IgnoreUnknownUser: n.IgnoreUnknownUser,
		MySQLDb:           b.resolveDb("mysql"),
	}
	n.Auth.Extra = outScope.node
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	return
}

func (b *Builder) buildRevokeProxy(inScope *scope, n *ast.RevokeProxy) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	outScope.node = plan.NewRevokeProxy(convertAccountName(n.On)[0], convertAccountName(n.From...), n.IfExists, n.IgnoreUnknownUser)
	return
}

func (b *Builder) buildShowPrivileges(inScope *scope, n *ast.ShowPrivileges) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	outScope.node = plan.NewShowPrivileges()
	return
}
