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
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/vitess/go/vt/sqlparser"
)

// PrepareQuery is a node that prepares the query
type PrepareQuery struct {
	Child    sql.Node
	PrepStmt *sqlparser.Prepare
	Name     string
}

var _ sql.Node = (*PrepareQuery)(nil)
var _ sql.CollationCoercible = (*PrepareQuery)(nil)

// NewPrepareQuery creates a new PrepareQuery node.
func NewPrepareQuery(name string, child sql.Node, prepStmt *sqlparser.Prepare) *PrepareQuery {
	return &PrepareQuery{
		Name:     name,
		Child:    child,
		PrepStmt: prepStmt,
	}
}

// Schema implements the Node interface.
func (p *PrepareQuery) Schema() sql.Schema {
	return types.OkResultSchema
}

func (p *PrepareQuery) IsReadOnly() bool {
	return true
}

// PrepareInfo is the Info for OKResults returned by Update nodes.
type PrepareInfo struct {
}

// String implements fmt.Stringer
func (pi PrepareInfo) String() string {
	return "Statement prepared"
}

// RowIter implements the Node interface.
func (p *PrepareQuery) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.NewRow(types.OkResult{RowsAffected: 0, Info: PrepareInfo{}})), nil
}

func (p *PrepareQuery) Resolved() bool {
	return true
}

// Children implements the Node interface.
func (p *PrepareQuery) Children() []sql.Node {
	return nil // TODO: maybe just make it Opaque instead?
}

// WithChildren implements the Node interface.
func (p *PrepareQuery) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) > 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 0)
	}
	return p, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*PrepareQuery) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (p *PrepareQuery) String() string {
	return fmt.Sprintf("Prepare(%s)", p.Child.String())
}

// ExecuteQuery is a node that prepares the query
type ExecuteQuery struct {
	Name     string
	BindVars []sql.Expression
}

var _ sql.Node = (*ExecuteQuery)(nil)
var _ sql.CollationCoercible = (*ExecuteQuery)(nil)

// NewExecuteQuery executes a prepared statement
func NewExecuteQuery(name string, bindVars ...sql.Expression) *ExecuteQuery {
	return &ExecuteQuery{Name: name, BindVars: bindVars}
}

// Schema implements the Node interface.
func (p *ExecuteQuery) Schema() sql.Schema {
	panic("ExecuteQuery methods shouldn't be used")
}

// RowIter implements the Node interface.
func (p *ExecuteQuery) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	panic("ExecuteQuery methods shouldn't be used")
}

func (p *ExecuteQuery) Resolved() bool {
	panic("ExecuteQuery methods shouldn't be used")
}

func (p *ExecuteQuery) IsReadOnly() bool {
	panic("ExecuteQuery methods shouldn't be used")
}

// Children implements the Node interface.
func (p *ExecuteQuery) Children() []sql.Node {
	panic("ExecuteQuery methods shouldn't be used")
}

// WithChildren implements the Node interface.
func (p *ExecuteQuery) WithChildren(children ...sql.Node) (sql.Node, error) {
	panic("ExecuteQuery methods shouldn't be used")
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ExecuteQuery) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (p *ExecuteQuery) String() string {
	panic("ExecuteQuery methods shouldn't be used")
}

// DeallocateQuery is a node that prepares the query
type DeallocateQuery struct {
	Name string
}

var _ sql.Node = (*DeallocateQuery)(nil)
var _ sql.CollationCoercible = (*DeallocateQuery)(nil)

// NewDeallocateQuery executes a prepared statement
func NewDeallocateQuery(name string) *DeallocateQuery {
	return &DeallocateQuery{Name: name}
}

// Schema implements the Node interface.
func (p *DeallocateQuery) Schema() sql.Schema {
	return types.OkResultSchema
}

// RowIter implements the Node interface.
func (p *DeallocateQuery) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(sql.NewRow(types.OkResult{})), nil
}

func (p *DeallocateQuery) Resolved() bool {
	return true
}

func (p *DeallocateQuery) IsReadOnly() bool {
	return true
}

// Children implements the Node interface.
func (p *DeallocateQuery) Children() []sql.Node {
	return nil
}

// WithChildren implements the Node interface.
func (p *DeallocateQuery) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) > 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 0)
	}
	return p, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DeallocateQuery) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (p *DeallocateQuery) String() string {
	return fmt.Sprintf("Deallocate(%s)", p.Name)
}
