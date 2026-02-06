// Copyright 2022-2023 Dolthub, Inc.
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

// PrivilegedOperation represents an operation that requires privileges to execute.
type PrivilegedOperation struct {
	Database          string
	Table             string
	Column            string
	Routine           string
	DynamicPrivileges []string
	StaticPrivileges  []PrivilegeType
	IsProcedure       bool // true if the routine is a procedure, false if it's a function
}

// PrivilegeCheckSubject is a struct that contains the entity information for an access check. It's specifically what
// is being accessed - but not what operation is being attempted.
type PrivilegeCheckSubject struct {
	Database    string
	Table       string
	Column      string
	Routine     string
	IsProcedure bool // true if the routine is a procedure, false if it's a function
}

// NewPrivilegedOperation returns a new PrivilegedOperation with the given parameters.
func NewPrivilegedOperation(subject PrivilegeCheckSubject, privs ...PrivilegeType) PrivilegedOperation {
	return PrivilegedOperation{
		Database:         subject.Database,
		Table:            subject.Table,
		Column:           subject.Column,
		Routine:          subject.Routine,
		IsProcedure:      subject.IsProcedure,
		StaticPrivileges: privs,
	}
}

// NewDynamicPrivilegedOperation returns a new PrivilegedOperation for the specified dynamic privileges. Dynamic
// privileges may only be applied globally, so you cannot specify a database, table, or column.
func NewDynamicPrivilegedOperation(privs ...string) PrivilegedOperation {
	return PrivilegedOperation{
		DynamicPrivileges: privs,
	}
}

// PrivilegedOperationChecker contains the necessary data to check whether the operation should succeed based on the
// privileges contained by the user. The user is retrieved from the context, along with their active roles.
type PrivilegedOperationChecker interface {
	// UserHasPrivileges fetches the User, and returns whether they have the desired privileges necessary to perform the
	// privileged operation(s). This takes into account the active roles, which are set in the context, therefore both
	// the user and the active roles are pulled from the context. This method is sufficient for all MySQL behaviors.
	// The one exception, currently, is for stored procedures and functions, which have a more fine-grained permission
	// due to Dolt's use of the AdminOnly flag in procedure definitions.
	UserHasPrivileges(ctx *Context, operations ...PrivilegedOperation) bool
	// RoutineAdminCheck fetches the User from the context, and specifically evaluates, the permission check
	// assuming the operation is for a stored procedure or function. This allows us to have more fine grain control over
	// permissions for stored procedures (many of which are critical to Dolt). This method specifically checks exists
	// for the use of AdminOnly procedures which require more fine-grained access control. For procedures which are
	// not AdminOnly, then |UserHasPrivileges| should be used instead.
	RoutineAdminCheck(ctx *Context, operations ...PrivilegedOperation) bool
}

// PrivilegeSet is a set containing privileges. Integrators should not implement this interface.
type PrivilegeSet interface {
	// Has returns whether the given global privilege(s) exists.
	Has(privileges ...PrivilegeType) bool
	// HasPrivileges returns whether this PrivilegeSet has any privileges at any level.
	HasPrivileges() bool
	// Count returns the number of global privileges.
	Count() int
	// Database returns the set of privileges for the given database. Returns an empty set if the database does not exist.
	Database(dbName string) PrivilegeSetDatabase
	// GetDatabases returns all databases.
	GetDatabases() []PrivilegeSetDatabase
	// Equals returns whether the given set of privileges is equivalent to the calling set.
	Equals(otherPs PrivilegeSet) bool
	// ToSlice returns all of the global privileges contained as a sorted slice.
	ToSlice() []PrivilegeType
}

// PrivilegeSetDatabase is a set containing database-level privileges. Integrators should not implement this interface.
type PrivilegeSetDatabase interface {
	// Name returns the name of the database that this privilege set belongs to.
	Name() string
	// Has returns whether the given database privilege(s) exists.
	Has(privileges ...PrivilegeType) bool
	// HasPrivileges returns whether this database has either database-level privileges, or privileges on a table or
	// column contained within this database.
	HasPrivileges() bool
	// Count returns the number of database privileges.
	Count() int
	// Table returns the set of privileges for the given table. Returns an empty set if the table does not exist.
	Table(tblName string) PrivilegeSetTable
	// GetTables returns all tables.
	GetTables() []PrivilegeSetTable
	// Routine returns the set of privileges for the given routine. Returns an empty set if the routine does not exist.
	Routine(routineName string, isProcedure bool) PrivilegeSetRoutine
	// GetRoutines returns all routines.
	GetRoutines() []PrivilegeSetRoutine
	// Equals returns whether the given set of privileges is equivalent to the calling set.
	Equals(otherPs PrivilegeSetDatabase) bool
	// ToSlice returns all of the database privileges contained as a sorted slice.
	ToSlice() []PrivilegeType
}

// AliasedDatabase is a database that has an alias: a name that is different from the name to be used system
// tables such as information_schema, or the mysql grant tables. This is the case when an integrator supports multiple
// ways to address a single physical database, but all such names should resolve to the same underlying name for
// permission checks.
type AliasedDatabase interface {
	Database

	// AliasedName returns the alias (the underlying name for information_schema, privileges) for this database.
	AliasedName() string
}

// PrivilegeSetTable is a set containing table-level privileges. Integrators should not implement this interface.
type PrivilegeSetTable interface {
	// Name returns the name of the table that this privilege set belongs to.
	Name() string
	// Has returns whether the given table privilege(s) exists.
	Has(privileges ...PrivilegeType) bool
	// HasPrivileges returns whether this table has either table-level privileges, or privileges on a column contained
	// within this table.
	HasPrivileges() bool
	// Count returns the number of table privileges.
	Count() int
	// Column returns the set of privileges for the given column. Returns an empty set if the column does not exist.
	Column(colName string) PrivilegeSetColumn
	// GetColumns returns all columns.
	GetColumns() []PrivilegeSetColumn
	// Equals returns whether the given set of privileges is equivalent to the calling set.
	Equals(otherPs PrivilegeSetTable) bool
	// ToSlice returns all of the table privileges contained as a sorted slice.
	ToSlice() []PrivilegeType
}

// PrivilegeSetColumn is a set containing column privileges. Integrators should not implement this interface.
type PrivilegeSetColumn interface {
	// Name returns the name of the column that this privilege set belongs to.
	Name() string
	// Has returns whether the given column privilege(s) exists.
	Has(privileges ...PrivilegeType) bool
	// Count returns the number of column privileges.
	Count() int
	// Equals returns whether the given set of privileges is equivalent to the calling set.
	Equals(otherPs PrivilegeSetColumn) bool
	// ToSlice returns all of the column privileges contained as a sorted slice.
	ToSlice() []PrivilegeType
}

// PrivilegeSetRoutine is a set containing routine privileges. Routines are either functions or procedures, and permissions
// for them are handled identically.
type PrivilegeSetRoutine interface {
	// RoutineName returns the name of the routine that this privilege set belongs to.
	RoutineName() string
	// RoutineType returns "FUNCTION" or "PROCEDURE".
	RoutineType() string
	// Has returns true if all PrivilegeTypes are present in the PrivilegeSet.
	Has(privileges ...PrivilegeType) bool
	// HasPrivileges returns whether this routine has any privileges.
	HasPrivileges() bool
	// Count returns the number of privileges on the routine
	Count() int
	// Equals returns whether the given set of privileges is equivalent to the calling set.
	Equals(otherPs PrivilegeSetRoutine) bool
	// ToSlice returns all of the routines privileges as a sorted slice.
	ToSlice() []PrivilegeType
}

// PrivilegeType represents a privilege.
type PrivilegeType int

const (
	PrivilegeType_Select PrivilegeType = iota
	PrivilegeType_Insert
	PrivilegeType_Update
	PrivilegeType_Delete
	PrivilegeType_Create
	PrivilegeType_Drop
	PrivilegeType_Reload
	PrivilegeType_Shutdown
	PrivilegeType_Process
	PrivilegeType_File
	PrivilegeType_GrantOption
	PrivilegeType_References
	PrivilegeType_Index
	PrivilegeType_Alter
	PrivilegeType_ShowDB
	PrivilegeType_Super
	PrivilegeType_CreateTempTable
	PrivilegeType_LockTables
	PrivilegeType_Execute
	PrivilegeType_ReplicationSlave
	PrivilegeType_ReplicationClient
	PrivilegeType_CreateView
	PrivilegeType_ShowView
	PrivilegeType_CreateRoutine
	PrivilegeType_AlterRoutine
	PrivilegeType_CreateUser
	PrivilegeType_Event
	PrivilegeType_Trigger
	PrivilegeType_CreateTablespace
	PrivilegeType_CreateRole
	PrivilegeType_DropRole
)

// privilegeTypeStrings are in the same order as the enumerations above, so that it's a simple index access.
var privilegeTypeStrings = []string{
	"SELECT",
	"INSERT",
	"UPDATE",
	"DELETE",
	"CREATE",
	"DROP",
	"RELOAD",
	"SHUTDOWN",
	"PROCESS",
	"FILE",
	"GRANT OPTION",
	"REFERENCES",
	"INDEX",
	"ALTER",
	"SHOW DATABASES",
	"SUPER",
	"CREATE TEMPORARY TABLES",
	"LOCK TABLES",
	"EXECUTE",
	"REPLICATION SLAVE",
	"REPLICATION CLIENT",
	"CREATE VIEW",
	"SHOW VIEW",
	"CREATE ROUTINE",
	"ALTER ROUTINE",
	"CREATE USER",
	"EVENT",
	"TRIGGER",
	"CREATE TABLESPACE",
	"CREATE ROLE",
	"DROP ROLE",
}

// String returns the sql.PrivilegeType as a string, for display in places such as "SHOW GRANTS".
func (pt PrivilegeType) String() string {
	return privilegeTypeStrings[pt]
}

// privilegeTypeStringMap map each string (same ones in privilegeTypeStrings) to their appropriate PrivilegeType.
var privilegeTypeStringMap = map[string]PrivilegeType{
	"SELECT":                  PrivilegeType_Select,
	"INSERT":                  PrivilegeType_Insert,
	"UPDATE":                  PrivilegeType_Update,
	"DELETE":                  PrivilegeType_Delete,
	"CREATE":                  PrivilegeType_Create,
	"DROP":                    PrivilegeType_Drop,
	"RELOAD":                  PrivilegeType_Reload,
	"SHUTDOWN":                PrivilegeType_Shutdown,
	"PROCESS":                 PrivilegeType_Process,
	"FILE":                    PrivilegeType_File,
	"GRANT OPTION":            PrivilegeType_GrantOption,
	"REFERENCES":              PrivilegeType_References,
	"INDEX":                   PrivilegeType_Index,
	"ALTER":                   PrivilegeType_Alter,
	"SHOW DATABASES":          PrivilegeType_ShowDB,
	"SUPER":                   PrivilegeType_Super,
	"CREATE TEMPORARY TABLES": PrivilegeType_CreateTempTable,
	"LOCK TABLES":             PrivilegeType_LockTables,
	"EXECUTE":                 PrivilegeType_Execute,
	"REPLICATION SLAVE":       PrivilegeType_ReplicationSlave,
	"REPLICATION CLIENT":      PrivilegeType_ReplicationClient,
	"CREATE VIEW":             PrivilegeType_CreateView,
	"SHOW VIEW":               PrivilegeType_ShowView,
	"CREATE ROUTINE":          PrivilegeType_CreateRoutine,
	"ALTER ROUTINE":           PrivilegeType_AlterRoutine,
	"CREATE USER":             PrivilegeType_CreateUser,
	"EVENT":                   PrivilegeType_Event,
	"TRIGGER":                 PrivilegeType_Trigger,
	"CREATE TABLESPACE":       PrivilegeType_CreateTablespace,
	"CREATE ROLE":             PrivilegeType_CreateRole,
	"DROP ROLE":               PrivilegeType_DropRole,
}

// PrivilegeTypeFromString returns the matching PrivilegeType for the given string. If there is no match, returns false.
func PrivilegeTypeFromString(privilegeType string) (PrivilegeType, bool) {
	match, ok := privilegeTypeStringMap[privilegeType]
	return match, ok
}
