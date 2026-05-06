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

package plan

import (
	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/binlogreplication"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ShowBinlogStatus is the plan node for the "SHOW BINARY LOG STATUS" statement.
// https://dev.mysql.com/doc/refman/8.3/en/show-binary-log-status.html
type ShowBinlogStatus struct {
	PrimaryController binlogreplication.BinlogPrimaryController
}

var _ sql.Node = (*ShowBinlogStatus)(nil)
var _ sql.CollationCoercible = (*ShowBinlogStatus)(nil)
var _ BinlogPrimaryControllerCommand = (*ShowBinlogStatus)(nil)

func NewShowBinlogStatus() *ShowBinlogStatus {
	return &ShowBinlogStatus{}
}

// WithBinlogPrimaryController implements the BinlogPrimaryControllerCommand interface.
func (s *ShowBinlogStatus) WithBinlogPrimaryController(controller binlogreplication.BinlogPrimaryController) sql.Node {
	nc := *s
	nc.PrimaryController = controller
	return &nc
}

func (s *ShowBinlogStatus) Resolved() bool {
	return true
}

func (s *ShowBinlogStatus) String() string {
	return "SHOW BINARY LOG STATUS"
}

func (s *ShowBinlogStatus) Schema() sql.Schema {
	return sql.Schema{
		{Name: "File", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 255), Default: nil, Nullable: false},
		{Name: "Position", Type: types.Int64, Default: nil, Nullable: false},
		{Name: "Binlog_Do_DB", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 255), Default: nil, Nullable: false},
		{Name: "Binlog_Ignore_DB", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 255), Default: nil, Nullable: false},
		{Name: "Executed_Gtid_Set", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 255), Default: nil, Nullable: false},
	}
}

func (s *ShowBinlogStatus) Children() []sql.Node {
	return nil
}

func (s *ShowBinlogStatus) IsReadOnly() bool {
	return true
}

func (s *ShowBinlogStatus) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 0)
	}

	newNode := *s
	return &newNode, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowBinlogStatus) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
