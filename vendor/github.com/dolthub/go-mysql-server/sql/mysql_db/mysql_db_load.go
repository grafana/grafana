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
	"time"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/mysql_db/serial"
)

// loadPrivilegeTypes is a helper method that loads privilege types given the length and loading function
// and returns them as a set
func loadPrivilegeTypes(n int, f func(j int) int32) map[sql.PrivilegeType]struct{} {
	privs := make(map[sql.PrivilegeType]struct{}, n)
	for i := 0; i < n; i++ {
		privs[sql.PrivilegeType(f(i))] = struct{}{}
	}
	return privs
}

func loadColumn(serialColumn *serial.PrivilegeSetColumn) *PrivilegeSetColumn {
	return &PrivilegeSetColumn{
		name:  string(serialColumn.Name()),
		privs: loadPrivilegeTypes(serialColumn.PrivsLength(), serialColumn.Privs),
	}
}

func loadTable(serialTable *serial.PrivilegeSetTable) *PrivilegeSetTable {
	columns := make(map[string]PrivilegeSetColumn, serialTable.ColumnsLength())
	for i := 0; i < serialTable.ColumnsLength(); i++ {
		serialColumn := new(serial.PrivilegeSetColumn)
		if !serialTable.Columns(serialColumn, i) {
			continue
		}
		column := loadColumn(serialColumn)
		columns[column.Name()] = *column
	}

	return &PrivilegeSetTable{
		name:    string(serialTable.Name()),
		privs:   loadPrivilegeTypes(serialTable.PrivsLength(), serialTable.Privs),
		columns: columns,
	}
}

func loadRoutine(serialRoutine *serial.PrivilegeSetRoutine) *PrivilegeSetRoutine {
	return &PrivilegeSetRoutine{
		name:   string(serialRoutine.Name()),
		privs:  loadPrivilegeTypes(serialRoutine.PrivsLength(), serialRoutine.Privs),
		isProc: serialRoutine.IsProc(),
	}
}

func loadDatabase(serialDatabase *serial.PrivilegeSetDatabase) *PrivilegeSetDatabase {
	tables := make(map[string]PrivilegeSetTable, serialDatabase.TablesLength())
	for i := 0; i < serialDatabase.TablesLength(); i++ {
		serialTable := new(serial.PrivilegeSetTable)
		if !serialDatabase.Tables(serialTable, i) {
			continue
		}
		table := loadTable(serialTable)
		tables[table.Name()] = *table
	}

	routines := make(map[routineKey]PrivilegeSetRoutine, serialDatabase.RoutinesLength())
	for i := 0; i < serialDatabase.RoutinesLength(); i++ {
		serialRoutine := new(serial.PrivilegeSetRoutine)
		if !serialDatabase.Routines(serialRoutine, i) {
			continue
		}
		routine := loadRoutine(serialRoutine)
		key := routineKey{routine.RoutineName(), routine.isProc}
		routines[key] = *routine
	}

	return &PrivilegeSetDatabase{
		name:     string(serialDatabase.Name()),
		privs:    loadPrivilegeTypes(serialDatabase.PrivsLength(), serialDatabase.Privs),
		tables:   tables,
		routines: routines,
	}
}

func loadPrivilegeSet(serialPrivilegeSet *serial.PrivilegeSet) *PrivilegeSet {
	databases := make(map[string]PrivilegeSetDatabase, serialPrivilegeSet.DatabasesLength())
	for i := 0; i < serialPrivilegeSet.DatabasesLength(); i++ {
		serialDatabase := new(serial.PrivilegeSetDatabase)
		if !serialPrivilegeSet.Databases(serialDatabase, i) {
			continue
		}
		database := loadDatabase(serialDatabase)
		databases[database.Name()] = *database
	}

	globalDynamic := make(map[string]bool)
	for i := 0; i < serialPrivilegeSet.GlobalDynamicLength(); i++ {
		globalDynamic[string(serialPrivilegeSet.GlobalDynamic(i))] = serialPrivilegeSet.GlobalDynamicWgo(i)
	}
	return &PrivilegeSet{
		globalStatic:  loadPrivilegeTypes(serialPrivilegeSet.GlobalStaticLength(), serialPrivilegeSet.GlobalStatic),
		globalDynamic: globalDynamic,
		databases:     databases,
	}
}

func LoadUser(serialUser *serial.User) *User {
	serialPrivilegeSet := new(serial.PrivilegeSet)
	serialUser.PrivilegeSet(serialPrivilegeSet)
	privilegeSet := loadPrivilegeSet(serialPrivilegeSet)
	attributesBuf := serialUser.Attributes()
	attributesVal := string(attributesBuf)
	var attributes *string
	if attributesBuf != nil {
		attributes = &attributesVal
	}

	return &User{
		User:                string(serialUser.User()),
		Host:                string(serialUser.Host()),
		PrivilegeSet:        *privilegeSet,
		Plugin:              string(serialUser.Plugin()),
		AuthString:          string(serialUser.Password()),
		PasswordLastChanged: time.Unix(serialUser.PasswordLastChanged(), 0),
		Locked:              serialUser.Locked(),
		Attributes:          attributes,
		Identity:            string(serialUser.Identity()),
	}
}

func LoadRoleEdge(serialRoleEdge *serial.RoleEdge) *RoleEdge {
	return &RoleEdge{
		FromHost: string(serialRoleEdge.FromHost()),
		FromUser: string(serialRoleEdge.FromUser()),
		ToHost:   string(serialRoleEdge.ToHost()),
		ToUser:   string(serialRoleEdge.ToUser()),
	}
}

func LoadReplicaSourceInfo(serialReplicaSourceInfo *serial.ReplicaSourceInfo) *ReplicaSourceInfo {
	return &ReplicaSourceInfo{
		Host:                 string(serialReplicaSourceInfo.Host()),
		User:                 string(serialReplicaSourceInfo.User()),
		Password:             string(serialReplicaSourceInfo.Password()),
		Port:                 serialReplicaSourceInfo.Port(),
		Uuid:                 string(serialReplicaSourceInfo.Uuid()),
		ConnectRetryInterval: serialReplicaSourceInfo.ConnectRetryInterval(),
		ConnectRetryCount:    serialReplicaSourceInfo.ConnectRetryCount(),
	}
}
