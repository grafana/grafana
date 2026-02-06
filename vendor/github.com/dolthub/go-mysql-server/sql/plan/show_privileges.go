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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ShowPrivileges represents the statement SHOW PRIVILEGES.
type ShowPrivileges struct{}

var _ sql.Node = (*ShowPrivileges)(nil)
var _ sql.CollationCoercible = (*ShowPrivileges)(nil)

// NewShowPrivileges returns a new ShowPrivileges node.
func NewShowPrivileges() *ShowPrivileges {
	return &ShowPrivileges{}
}

// Schema implements the interface sql.Node.
func (n *ShowPrivileges) Schema() sql.Schema {
	return sql.Schema{
		&sql.Column{Name: "Privilege", Type: types.LongText},
		&sql.Column{Name: "Context", Type: types.LongText},
		&sql.Column{Name: "Comment", Type: types.LongText},
	}
}

// String implements the interface sql.Node.
func (n *ShowPrivileges) String() string {
	return "SHOW PRIVILEGES"
}

// Resolved implements the interface sql.Node.
func (n *ShowPrivileges) Resolved() bool {
	return true
}

func (n *ShowPrivileges) IsReadOnly() bool {
	return true
}

// Children implements the interface sql.Node.
func (n *ShowPrivileges) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (n *ShowPrivileges) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(n, len(children), 0)
	}
	return n, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowPrivileges) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// RowIter implements the interface sql.Node.
func (n *ShowPrivileges) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(
		sql.Row{"Alter", "Tables", "To alter the table"},
		sql.Row{"Alter routine", "Functions,Procedures", "To alter or drop stored functions/procedures"},
		sql.Row{"Create", "Databases,Tables,Indexes", "To create new databases and tables"},
		sql.Row{"Create routine", "Databases", "To use CREATE FUNCTION/PROCEDURE"},
		sql.Row{"Create role", "Server Admin", "To create new roles"},
		sql.Row{"Create temporary tables", "Databases", "To use CREATE TEMPORARY TABLE"},
		sql.Row{"Create view", "Tables", "To create new views"},
		sql.Row{"Create user", "Server Admin", "To create new users"},
		sql.Row{"Delete", "Tables", "To delete existing rows"},
		sql.Row{"Drop", "Databases,Tables", "To drop databases, tables, and views"},
		sql.Row{"Drop role", "Server Admin", "To drop roles"},
		sql.Row{"Event", "Server Admin", "To create, alter, drop and execute events"},
		sql.Row{"Execute", "Functions,Procedures", "To execute stored routines"},
		sql.Row{"File", "File access on server", "To read and write files on the server"},
		sql.Row{"Grant option", "Databases,Tables,Functions,Procedures", "To give to other users those privileges you possess"},
		sql.Row{"Index", "Tables", "To create or drop indexes"},
		sql.Row{"Insert", "Tables", "To insert data into tables"},
		sql.Row{"Lock tables", "Databases", "To use LOCK TABLES (together with SELECT privilege)"},
		sql.Row{"Process", "Server Admin", "To view the plain text of currently executing queries"},
		sql.Row{"Proxy", "Server Admin", "To make proxy user possible"},
		sql.Row{"References", "Databases,Tables", "To have references on tables"},
		sql.Row{"Reload", "Server Admin", "To reload or refresh tables, logs and privileges"},
		sql.Row{"Replication client", "Server Admin", "To ask where the slave or master servers are"},
		sql.Row{"Replication slave", "Server Admin", "To read binary log events from the master"},
		sql.Row{"Select", "Tables", "To retrieve rows from table"},
		sql.Row{"Show databases", "Server Admin", "To see all databases with SHOW DATABASES"},
		sql.Row{"Show view", "Tables", "To see views with SHOW CREATE VIEW"},
		sql.Row{"Shutdown", "Server Admin", "To shut down the server"},
		sql.Row{"Super", "Server Admin", "To use KILL thread, SET GLOBAL, CHANGE MASTER, etc."},
		sql.Row{"Trigger", "Tables", "To use triggers"},
		sql.Row{"Create tablespace", "Server Admin", "To create/alter/drop tablespaces"},
		sql.Row{"Update", "Tables", "To update existing rows"},
		sql.Row{"Usage", "Server Admin", "No privileges - allow connect only"},
		sql.Row{"ENCRYPTION_KEY_ADMIN", "Server Admin", ""},
		sql.Row{"INNODB_REDO_LOG_ARCHIVE", "Server Admin", ""},
		sql.Row{"REPLICATION_APPLIER", "Server Admin", ""},
		sql.Row{"INNODB_REDO_LOG_ENABLE", "Server Admin", ""},
		sql.Row{"SET_USER_ID", "Server Admin", ""},
		sql.Row{"SERVICE_CONNECTION_ADMIN", "Server Admin", ""},
		sql.Row{"GROUP_REPLICATION_ADMIN", "Server Admin", ""},
		sql.Row{"AUDIT_ABORT_EXEMPT", "Server Admin", ""},
		sql.Row{"GROUP_REPLICATION_STREAM", "Server Admin", ""},
		sql.Row{"CLONE_ADMIN", "Server Admin", ""},
		sql.Row{"SYSTEM_USER", "Server Admin", ""},
		sql.Row{"AUTHENTICATION_POLICY_ADMIN", "Server Admin", ""},
		sql.Row{"SHOW_ROUTINE", "Server Admin", ""},
		sql.Row{"BACKUP_ADMIN", "Server Admin", ""},
		sql.Row{"CONNECTION_ADMIN", "Server Admin", ""},
		sql.Row{"PERSIST_RO_VARIABLES_ADMIN", "Server Admin", ""},
		sql.Row{"RESOURCE_GROUP_ADMIN", "Server Admin", ""},
		sql.Row{"SESSION_VARIABLES_ADMIN", "Server Admin", ""},
		sql.Row{"SYSTEM_VARIABLES_ADMIN", "Server Admin", ""},
		sql.Row{"APPLICATION_PASSWORD_ADMIN", "Server Admin", ""},
		sql.Row{"FLUSH_OPTIMIZER_COSTS", "Server Admin", ""},
		sql.Row{"AUDIT_ADMIN", "Server Admin", ""},
		sql.Row{"BINLOG_ADMIN", "Server Admin", ""},
		sql.Row{"BINLOG_ENCRYPTION_ADMIN", "Server Admin", ""},
		sql.Row{"FLUSH_STATUS", "Server Admin", ""},
		sql.Row{"FLUSH_TABLES", "Server Admin", ""},
		sql.Row{"FLUSH_USER_RESOURCES", "Server Admin", ""},
		sql.Row{"XA_RECOVER_ADMIN", "Server Admin", ""},
		sql.Row{"PASSWORDLESS_USER_ADMIN", "Server Admin", ""},
		sql.Row{"TABLE_ENCRYPTION_ADMIN", "Server Admin", ""},
		sql.Row{"ROLE_ADMIN", "Server Admin", ""},
		sql.Row{"REPLICATION_SLAVE_ADMIN", "Server Admin", ""},
		sql.Row{"RESOURCE_GROUP_USER", "Server Admin", ""},
	), nil
}
