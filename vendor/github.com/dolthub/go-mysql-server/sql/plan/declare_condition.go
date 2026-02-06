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

	"github.com/dolthub/go-mysql-server/sql"
)

// DeclareCondition represents the DECLARE ... CONDITION statement.
type DeclareCondition struct {
	Name          string
	SqlStateValue string
	MysqlErrCode  int64
}

var _ sql.Node = (*DeclareCondition)(nil)
var _ sql.CollationCoercible = (*DeclareCondition)(nil)

// NewDeclareCondition returns a *DeclareCondition node.
func NewDeclareCondition(name string, errCode int64, sqlStateValue string) *DeclareCondition {
	return &DeclareCondition{
		Name:          name,
		MysqlErrCode:  errCode,
		SqlStateValue: sqlStateValue,
	}
}

// Resolved implements the sql.Node interface.
func (d *DeclareCondition) Resolved() bool {
	return true
}

func (d *DeclareCondition) IsReadOnly() bool {
	return true
}

// String implements the sql.Node interface.
func (d *DeclareCondition) String() string {
	val := ""
	if d.SqlStateValue != "" {
		val = fmt.Sprintf("SQLSTATE '%s'", d.SqlStateValue)
	} else {
		val = fmt.Sprintf("%d", d.MysqlErrCode)
	}
	return fmt.Sprintf("DECLARE %s CONDITION FOR %s", d.Name, val)
}

// Schema implements the sql.Node interface.
func (d *DeclareCondition) Schema() sql.Schema {
	return nil
}

// Children implements the sql.Node interface.
func (d *DeclareCondition) Children() []sql.Node {
	return nil
}

// WithChildren implements the sql.Node interface.
func (d *DeclareCondition) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(d, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DeclareCondition) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// RowIter implements the sql.Node interface.
func (d *DeclareCondition) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(), nil
}
