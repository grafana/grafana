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

	"github.com/dolthub/go-mysql-server/sql"
)

// Privilege specifies a privilege to be used in a GRANT or REVOKE statement.
type Privilege struct {
	Dynamic string // PrivilegeType_Dynamic will set this string to the correct lowercased value
	Columns []string
	Type    PrivilegeType
}

// PrivilegeLevel defines the level that a privilege applies to.
type PrivilegeLevel struct {
	Database     string
	TableRoutine string
}

// PrivilegeType is the type of privilege that is being granted or revoked.
type PrivilegeType byte

const (
	PrivilegeType_All PrivilegeType = iota
	PrivilegeType_Alter
	PrivilegeType_AlterRoutine
	PrivilegeType_Create
	PrivilegeType_CreateRole
	PrivilegeType_CreateRoutine
	PrivilegeType_CreateTablespace
	PrivilegeType_CreateTemporaryTables
	PrivilegeType_CreateUser
	PrivilegeType_CreateView
	PrivilegeType_Delete
	PrivilegeType_Drop
	PrivilegeType_DropRole
	PrivilegeType_Event
	PrivilegeType_Execute
	PrivilegeType_File
	PrivilegeType_GrantOption
	PrivilegeType_Index
	PrivilegeType_Insert
	PrivilegeType_LockTables
	PrivilegeType_Process
	PrivilegeType_References
	PrivilegeType_Reload
	PrivilegeType_ReplicationClient
	PrivilegeType_ReplicationSlave
	PrivilegeType_Select
	PrivilegeType_ShowDatabases
	PrivilegeType_ShowView
	PrivilegeType_Shutdown
	PrivilegeType_Super
	PrivilegeType_Trigger
	PrivilegeType_Update
	PrivilegeType_Usage
	PrivilegeType_Dynamic
)

// convertToSqlPrivilegeType converts the privilege types used in plan to those used elsewhere.
func convertToSqlPrivilegeType(addGrant bool, privs ...Privilege) []sql.PrivilegeType {
	// At most we'll have the number of privileges plus the grant privilege
	sqlPrivs := make([]sql.PrivilegeType, 0, len(privs)+1)
	for _, priv := range privs {
		switch priv.Type {
		case PrivilegeType_All:
			// No direct mapping, this should be handled elsewhere
		case PrivilegeType_Alter:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Alter)
		case PrivilegeType_AlterRoutine:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_AlterRoutine)
		case PrivilegeType_Create:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Create)
		case PrivilegeType_CreateRole:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_CreateRole)
		case PrivilegeType_CreateRoutine:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_CreateRoutine)
		case PrivilegeType_CreateTablespace:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_CreateTablespace)
		case PrivilegeType_CreateTemporaryTables:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_CreateTempTable)
		case PrivilegeType_CreateUser:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_CreateUser)
		case PrivilegeType_CreateView:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_CreateView)
		case PrivilegeType_Delete:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Delete)
		case PrivilegeType_Drop:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Drop)
		case PrivilegeType_DropRole:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_DropRole)
		case PrivilegeType_Event:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Event)
		case PrivilegeType_Execute:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Execute)
		case PrivilegeType_File:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_File)
		case PrivilegeType_GrantOption:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_GrantOption)
		case PrivilegeType_Index:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Index)
		case PrivilegeType_Insert:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Insert)
		case PrivilegeType_LockTables:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_LockTables)
		case PrivilegeType_Process:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Process)
		case PrivilegeType_References:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_References)
		case PrivilegeType_Reload:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Reload)
		case PrivilegeType_ReplicationClient:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_ReplicationClient)
		case PrivilegeType_ReplicationSlave:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_ReplicationSlave)
		case PrivilegeType_Select:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Select)
		case PrivilegeType_ShowDatabases:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_ShowDB)
		case PrivilegeType_ShowView:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_ShowView)
		case PrivilegeType_Shutdown:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Shutdown)
		case PrivilegeType_Super:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Super)
		case PrivilegeType_Trigger:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Trigger)
		case PrivilegeType_Update:
			sqlPrivs = append(sqlPrivs, sql.PrivilegeType_Update)
		case PrivilegeType_Usage:
			// Usage is equal to no privilege
		case PrivilegeType_Dynamic:
			//TODO: handle dynamic privileges
		}
	}
	if addGrant {
		sqlPrivs = append(sqlPrivs, sql.PrivilegeType_GrantOption)
	}
	return sqlPrivs
}

// ObjectType represents the object type that the GRANT or REVOKE statement will apply to.
type ObjectType byte

const (
	ObjectType_Any ObjectType = iota
	ObjectType_Table
	ObjectType_Function
	ObjectType_Procedure
)

// GrantUserAssumptionType is the assumption type that the user executing the GRANT statement will use.
type GrantUserAssumptionType byte

const (
	GrantUserAssumptionType_Default GrantUserAssumptionType = iota
	GrantUserAssumptionType_None
	GrantUserAssumptionType_All
	GrantUserAssumptionType_AllExcept
	GrantUserAssumptionType_Roles
)

// GrantUserAssumption represents the target user that the user executing the GRANT statement will assume the identity of.
type GrantUserAssumption struct {
	User  UserName
	Roles []UserName
	Type  GrantUserAssumptionType
}

// String returns the Privilege as a formatted string.
func (p *Privilege) String() string {
	sb := strings.Builder{}
	switch p.Type {
	case PrivilegeType_All:
		sb.WriteString("ALL")
	case PrivilegeType_Insert:
		sb.WriteString("INSERT")
	case PrivilegeType_References:
		sb.WriteString("REFERENCES")
	case PrivilegeType_Select:
		sb.WriteString("SELECT")
	case PrivilegeType_Update:
		sb.WriteString("UPDATE")
	}
	if len(p.Columns) > 0 {
		sb.WriteString(" (")
		for i, col := range p.Columns {
			if i > 0 {
				sb.WriteString(", ")
			}
			sb.WriteString(col)
		}
		sb.WriteString(")")
	}
	return sb.String()
}

// IsValidDynamic returns whether the given dynamic privilege is valid. If the privilege is NOT dynamic, or the dynamic
// privilege is not supported, then this returns false.
func (p *Privilege) IsValidDynamic() bool {
	if p.Type == PrivilegeType_Dynamic {
		switch p.Dynamic {
		case DynamicPrivilege_ReplicationSlaveAdmin, DynamicPrivilege_CloneAdmin:
			return true
		}
	}
	return false
}

// String returns the PrivilegeLevel as a formatted string.
func (p *PrivilegeLevel) String() string {
	if p.Database == "" {
		if p.TableRoutine == "*" {
			return "*"
		} else {
			return fmt.Sprintf("%s", p.TableRoutine)
		}
	} else if p.Database == "*" {
		return "*.*"
	} else if p.TableRoutine == "*" {
		return fmt.Sprintf("%s.*", p.Database)
	} else {
		return fmt.Sprintf("%s.%s", p.Database, p.TableRoutine)
	}
}
