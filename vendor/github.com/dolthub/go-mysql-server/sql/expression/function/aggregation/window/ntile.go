// Copyright 2025 Dolthub, Inc.
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

package window

import (
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression/function/aggregation"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type NTile struct {
	bucketExpr sql.Expression
	window     *sql.WindowDefinition
	pos        uint64
	count      uint64
	bucketSize uint64
	id         sql.ColumnId
}

var _ sql.FunctionExpression = (*NTile)(nil)
var _ sql.WindowAggregation = (*NTile)(nil)
var _ sql.WindowAdaptableExpression = (*NTile)(nil)
var _ sql.CollationCoercible = (*NTile)(nil)

func NewNTile(expr sql.Expression) sql.Expression {
	return &NTile{
		bucketExpr: expr,
	}
}

// Id implements sql.IdExpression
func (n *NTile) Id() sql.ColumnId {
	return n.id
}

// WithId implements sql.IdExpression
func (n *NTile) WithId(id sql.ColumnId) sql.IdExpression {
	ret := *n
	ret.id = id
	return &ret
}

// Description implements sql.FunctionExpression
func (n *NTile) Description() string {
	return "returns percentage rank value."
}

// Window implements sql.WindowExpression
func (n *NTile) Window() *sql.WindowDefinition {
	return n.window
}

func (n *NTile) Resolved() bool {
	return windowResolved(n.window)
}

func (n *NTile) String() string {
	sb := strings.Builder{}
	sb.WriteString("ntile()")
	if n.window != nil {
		sb.WriteString(" ")
		sb.WriteString(n.window.String())
	}
	return sb.String()
}

func (n *NTile) DebugString() string {
	sb := strings.Builder{}
	sb.WriteString("ntile()")
	if n.window != nil {
		sb.WriteString(" ")
		sb.WriteString(sql.DebugString(n.window))
	}
	return sb.String()
}

// FunctionName implements sql.FunctionExpression
func (n *NTile) FunctionName() string {
	return "NTILE"
}

// Type implements sql.Expression
func (n *NTile) Type() sql.Type {
	return types.Float64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*NTile) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements sql.Expression
func (n *NTile) IsNullable() bool {
	return false
}

// Eval implements sql.Expression
func (n *NTile) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return nil, sql.ErrWindowUnsupported.New(n.FunctionName())
}

// Children implements sql.Expression
func (n *NTile) Children() []sql.Expression {
	return n.window.ToExpressions()
}

// WithChildren implements sql.Expression
func (n *NTile) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	window, err := n.window.FromExpressions(children)
	if err != nil {
		return nil, err
	}

	return n.WithWindow(window), nil
}

// WithWindow implements sql.WindowAggregation
func (n *NTile) WithWindow(window *sql.WindowDefinition) sql.WindowAdaptableExpression {
	nr := *n
	nr.window = window
	return &nr
}

func (n *NTile) NewWindowFunction() (sql.WindowFunction, error) {
	return aggregation.NewNTile(n.bucketExpr), nil
}
