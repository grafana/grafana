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
	"encoding/json"
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
)

// privilegeSetMarshaler handles marshaling duties to and from JSON for a PrivilegeSet.
type privilegeSetMarshaler struct {
	GlobalStatic []string
	Databases    []privilegeSetMarshalerDatabase
}

// privilegeSetMarshalerDatabase handles marshaling duties to and from JSON for a database in a PrivilegeSet.
type privilegeSetMarshalerDatabase struct {
	Name       string
	Privileges []string
	Tables     []privilegeSetMarshalerTable
}

// privilegeSetMarshalerTable handles marshaling duties to and from JSON for a table in a PrivilegeSet.
type privilegeSetMarshalerTable struct {
	Name       string
	Privileges []string
	Columns    []privilegeSetMarshalerColumn
}

// privilegeSetMarshalerColumn handles marshaling duties to and from JSON for a column in a PrivilegeSet.
type privilegeSetMarshalerColumn struct {
	Name       string
	Privileges []string
}

var _ json.Marshaler = PrivilegeSet{}
var _ json.Unmarshaler = (*PrivilegeSet)(nil)

// MarshalJSON implements the interface json.Marshaler. This is deprecated functionality, as serialization has been
// replaced by flatbuffers.
func (ps PrivilegeSet) MarshalJSON() ([]byte, error) {
	globalStaticPrivs := ps.ToSlice()
	psm := privilegeSetMarshaler{
		GlobalStatic: make([]string, len(globalStaticPrivs)),
		Databases:    make([]privilegeSetMarshalerDatabase, len(ps.databases)),
	}
	for i, globalStaticPriv := range globalStaticPrivs {
		psm.GlobalStatic[i] = globalStaticPriv.String()
	}
	for dbIndex, database := range ps.GetDatabases() {
		dbPrivs := database.ToSlice()
		dbm := privilegeSetMarshalerDatabase{
			Name:       database.Name(),
			Privileges: make([]string, len(dbPrivs)),
			Tables:     make([]privilegeSetMarshalerTable, len(database.(PrivilegeSetDatabase).tables)),
		}
		for i, dbPriv := range dbPrivs {
			dbm.Privileges[i] = dbPriv.String()
		}
		psm.Databases[dbIndex] = dbm

		for tblIndex, table := range database.GetTables() {
			tblPrivs := table.ToSlice()
			tbm := privilegeSetMarshalerTable{
				Name:       table.Name(),
				Privileges: make([]string, len(table.(PrivilegeSetTable).privs)),
				Columns:    make([]privilegeSetMarshalerColumn, len(table.(PrivilegeSetTable).columns)),
			}
			for i, tblPriv := range tblPrivs {
				tbm.Privileges[i] = tblPriv.String()
			}
			dbm.Tables[tblIndex] = tbm

			for colIndex, column := range table.GetColumns() {
				colPrivs := column.ToSlice()
				cbm := privilegeSetMarshalerColumn{
					Name:       column.Name(),
					Privileges: make([]string, len(column.(PrivilegeSetColumn).privs)),
				}
				for i, colPriv := range colPrivs {
					cbm.Privileges[i] = colPriv.String()
				}
				tbm.Columns[colIndex] = cbm
			}
		}
	}

	return json.Marshal(psm)
}

// UnmarshalJSON implements the interface json.Unmarshaler. This is deprecated functionality, as serialization has been
// replaced by flatbuffers.
func (ps *PrivilegeSet) UnmarshalJSON(jsonData []byte) error {
	ps.globalStatic = make(map[sql.PrivilegeType]struct{})
	ps.globalDynamic = make(map[string]bool)
	ps.databases = make(map[string]PrivilegeSetDatabase)
	psm := privilegeSetMarshaler{}
	err := json.Unmarshal(jsonData, &psm)
	if err != nil {
		return err
	}
	for _, privStr := range psm.GlobalStatic {
		priv, ok := sql.PrivilegeTypeFromString(privStr)
		if !ok {
			return fmt.Errorf(`unknown privilege type: "%s"`, priv)
		}
		ps.AddGlobalStatic(priv)
	}
	for _, database := range psm.Databases {
		for _, privStr := range database.Privileges {
			priv, ok := sql.PrivilegeTypeFromString(privStr)
			if !ok {
				return fmt.Errorf(`unknown privilege type: "%s"`, priv)
			}
			ps.AddDatabase(database.Name, priv)
		}

		for _, table := range database.Tables {
			for _, privStr := range table.Privileges {
				priv, ok := sql.PrivilegeTypeFromString(privStr)
				if !ok {
					return fmt.Errorf(`unknown privilege type: "%s"`, priv)
				}
				ps.AddTable(database.Name, table.Name, priv)
			}

			for _, column := range table.Columns {
				for _, privStr := range column.Privileges {
					priv, ok := sql.PrivilegeTypeFromString(privStr)
					if !ok {
						return fmt.Errorf(`unknown privilege type: "%s"`, priv)
					}
					ps.AddColumn(database.Name, table.Name, column.Name, priv)
				}
			}
		}
	}
	return nil
}
