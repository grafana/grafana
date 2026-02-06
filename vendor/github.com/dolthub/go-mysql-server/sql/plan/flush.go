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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// FlushPrivileges reads privileges from mysql tables and registers any unregistered privileges found.
type FlushPrivileges struct {
	MysqlDb        sql.Database
	writesToBinlog bool
}

var _ sql.Node = (*FlushPrivileges)(nil)
var _ sql.CollationCoercible = (*FlushPrivileges)(nil)
var _ sql.Databaser = (*FlushPrivileges)(nil)

// NewFlushPrivileges creates a new FlushPrivileges node.
func NewFlushPrivileges(ft bool) *FlushPrivileges {
	return &FlushPrivileges{
		writesToBinlog: ft,
		MysqlDb:        sql.UnresolvedDatabase("mysql"),
	}
}

// RowIter implements the interface sql.Node.
func (f *FlushPrivileges) RowIter(ctx *sql.Context, _ sql.Row) (sql.RowIter, error) {
	gts, ok := f.MysqlDb.(*mysql_db.MySQLDb)
	if !ok {
		return nil, sql.ErrDatabaseNotFound.New("mysql")
	}
	editor := gts.Editor()
	defer editor.Close()
	err := gts.Persist(ctx, editor)
	if err != nil {
		return nil, err
	}
	return sql.RowsToRowIter(sql.Row{types.NewOkResult(0)}), nil
}

// String implements the interface sql.Node.
func (*FlushPrivileges) String() string { return "FLUSH PRIVILEGES" }

// WithChildren implements the interface sql.Node.
func (f *FlushPrivileges) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 0)
	}

	return f, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*FlushPrivileges) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Semantically there is no reason to run this in a read-only context, so we say it is not read only.
func (*FlushPrivileges) IsReadOnly() bool {
	return false
}

// Resolved implements the interface sql.Node.
func (f *FlushPrivileges) Resolved() bool {
	_, ok := f.MysqlDb.(sql.UnresolvedDatabase)
	return !ok
}

// Children implements the sql.Node interface.
func (*FlushPrivileges) Children() []sql.Node { return nil }

// Schema implements the sql.Node interface.
func (*FlushPrivileges) Schema() sql.Schema { return types.OkResultSchema }

// Database implements the sql.Databaser interface.
func (f *FlushPrivileges) Database() sql.Database {
	return f.MysqlDb
}

// WithDatabase implements the sql.Databaser interface.
func (f *FlushPrivileges) WithDatabase(db sql.Database) (sql.Node, error) {
	fp := *f
	fp.MysqlDb = db
	return &fp, nil
}
