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

package plan

import (
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/binlogreplication"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/vitess/go/sqltypes"
)

// ShowReplicaStatus is the plan node for the "SHOW REPLICA STATUS" statement.
// https://dev.mysql.com/doc/refman/8.0/en/show-replica-status.html
type ShowReplicaStatus struct {
	ReplicaController binlogreplication.BinlogReplicaController
	// useDeprecatedColumnNames is used to determine if the column names returned should be the old
	// and deprecated master/slave column names, or the new source/replica column names.
	useDeprecatedColumnNames bool
}

var _ sql.Node = (*ShowReplicaStatus)(nil)
var _ sql.CollationCoercible = (*ShowReplicaStatus)(nil)
var _ BinlogReplicaControllerCommand = (*ShowReplicaStatus)(nil)

// NewShowReplicaStatus creates a new ShowReplicaStatus node.
func NewShowReplicaStatus() *ShowReplicaStatus {
	return &ShowReplicaStatus{}
}

// NewShowSlaveStatus creates a new ShowReplicaStatus node configured to use the old, deprecated
// column names (i.e. master/slave) instead of the new, renamed columns (i.e. source/replica).
func NewShowSlaveStatus() *ShowReplicaStatus {
	return &ShowReplicaStatus{
		useDeprecatedColumnNames: true,
	}
}

// WithBinlogReplicaController implements the BinlogReplicaControllerCommand interface.
func (s *ShowReplicaStatus) WithBinlogReplicaController(controller binlogreplication.BinlogReplicaController) sql.Node {
	nc := *s
	nc.ReplicaController = controller
	return &nc
}

func (s *ShowReplicaStatus) Resolved() bool {
	return true
}

func (s *ShowReplicaStatus) String() string {
	if s.useDeprecatedColumnNames {
		return "SHOW SLAVE STATUS"
	} else {
		return "SHOW REPLICA STATUS"
	}
}

func (s *ShowReplicaStatus) Schema() sql.Schema {
	sch := sql.Schema{
		{Name: "Replica_IO_State", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_Host", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 255), Default: nil, Nullable: false},
		{Name: "Source_User", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_Port", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Connect_Retry", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_Log_File", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Read_Source_Log_Pos", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Relay_Log_File", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Relay_Log_Pos", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Relay_Source_Log_File", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Replica_IO_Running", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 128), Default: nil, Nullable: false},
		{Name: "Replica_SQL_Running", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 128), Default: nil, Nullable: false},
		{Name: "Replicate_Do_DB", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 128), Default: nil, Nullable: false},
		{Name: "Replicate_Ignore_DB", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 128), Default: nil, Nullable: false},
		{Name: "Replicate_Do_Table", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 256), Default: nil, Nullable: false},
		{Name: "Replicate_Ignore_Table", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 256), Default: nil, Nullable: false},
		{Name: "Replicate_Wild_Do_Table", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 128), Default: nil, Nullable: false},
		{Name: "Replicate_Wild_Ignore_Table", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 128), Default: nil, Nullable: false},
		{Name: "Last_Errno", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Last_Error", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 256), Default: nil, Nullable: false},
		{Name: "Skip_Counter", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Exec_Source_Log_Pos", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Relay_Log_Space", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Until_Condition", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Until_Log_File", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Until_Log_Pos", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_SSL_Allowed", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_SSL_CA_File", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_SSL_CA_Path", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_SSL_Cert", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_SSL_Cipher", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_SSL_CRL_File", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_SSL_CRL_Path", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_SSL_Key", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_SSL_Verify_Server_Cert", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Seconds_Behind_Source", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Last_IO_Errno", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Last_IO_Error", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 256), Default: nil, Nullable: false},
		{Name: "Last_SQL_Errno", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Last_SQL_Error", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 256), Default: nil, Nullable: false},
		{Name: "Replicate_Ignore_Server_Ids", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_Server_Id", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_UUID", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_Info_File", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "SQL_Delay", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "SQL_Remaining_Delay", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Replica_SQL_Running_State", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_Retry_Count", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Source_Bind", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Last_IO_Error_Timestamp", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Last_SQL_Error_Timestamp", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Retrieved_Gtid_Set", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 128), Default: nil, Nullable: false},
		{Name: "Executed_Gtid_Set", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 128), Default: nil, Nullable: false},
		{Name: "Auto_Position", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
		{Name: "Replicate_Rewrite_DB", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 64), Default: nil, Nullable: false},
	}

	if s.useDeprecatedColumnNames {
		for i := range sch {
			sch[i].Name = strings.ReplaceAll(sch[i].Name, "Source", "Master")
			sch[i].Name = strings.ReplaceAll(sch[i].Name, "Replica", "Slave")
		}
	}

	return sch
}

func (s *ShowReplicaStatus) Children() []sql.Node {
	return nil
}

func (s *ShowReplicaStatus) IsReadOnly() bool {
	return true
}

func (s *ShowReplicaStatus) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 0)
	}

	newNode := *s
	return &newNode, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowReplicaStatus) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
