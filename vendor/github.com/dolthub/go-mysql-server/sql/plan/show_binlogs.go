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

// ShowBinlogs is the plan node for the "SHOW BINARY LOGS" statement.
// https://dev.mysql.com/doc/refman/8.4/en/show-binary-logs.html
type ShowBinlogs struct {
	PrimaryController binlogreplication.BinlogPrimaryController
}

var _ sql.Node = (*ShowBinlogs)(nil)
var _ sql.CollationCoercible = (*ShowBinlogs)(nil)
var _ BinlogPrimaryControllerCommand = (*ShowBinlogs)(nil)

func NewShowBinlogs() *ShowBinlogs {
	return &ShowBinlogs{}
}

// WithBinlogPrimaryController implements the BinlogPrimaryControllerCommand interface.
func (s *ShowBinlogs) WithBinlogPrimaryController(controller binlogreplication.BinlogPrimaryController) sql.Node {
	nc := *s
	nc.PrimaryController = controller
	return &nc
}

func (s *ShowBinlogs) Resolved() bool {
	return true
}

func (s *ShowBinlogs) String() string {
	return "SHOW BINARY LOGS"
}

func (s *ShowBinlogs) Schema() sql.Schema {
	return sql.Schema{
		{Name: "Log_name", Type: types.MustCreateString(sqltypes.VarChar, 1020, sql.Collation_utf8mb4_0900_ai_ci), Default: nil, Nullable: false},
		{Name: "File_size", Type: types.Uint64, Default: nil, Nullable: false},
		{Name: "Encrypted", Type: types.MustCreateString(sqltypes.VarChar, 12, sql.Collation_utf8mb4_0900_ai_ci), Default: nil, Nullable: false},
	}
}

func (s *ShowBinlogs) Children() []sql.Node {
	return nil
}

func (s *ShowBinlogs) IsReadOnly() bool {
	return true
}

func (s *ShowBinlogs) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 0)
	}

	newNode := *s
	return &newNode, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ShowBinlogs) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
