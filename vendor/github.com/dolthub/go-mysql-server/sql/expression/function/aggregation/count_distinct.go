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

package aggregation

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

type CountDistinct struct {
	typ    sql.Type
	window *sql.WindowDefinition
	expression.NaryExpression
	id sql.ColumnId
}

var _ sql.FunctionExpression = (*CountDistinct)(nil)
var _ sql.Aggregation = (*CountDistinct)(nil)
var _ sql.WindowAdaptableExpression = (*CountDistinct)(nil)
var _ sql.CollationCoercible = (*CountDistinct)(nil)

func NewCountDistinct(exprs ...sql.Expression) *CountDistinct {
	return &CountDistinct{
		NaryExpression: expression.NaryExpression{ChildExpressions: exprs},
	}
}

// Type implements the Expression interface.
func (a *CountDistinct) Type() sql.Type {
	return types.Int64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*CountDistinct) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements the Expression interface.
func (a *CountDistinct) IsNullable() bool {
	return false
}

// Id implements the Aggregation interface
func (a *CountDistinct) Id() sql.ColumnId {
	return a.id
}

// WithId implements the Aggregation interface
func (a *CountDistinct) WithId(id sql.ColumnId) sql.IdExpression {
	ret := *a
	ret.id = id
	return &ret
}

// Eval implements the Expression interface.
func (a *CountDistinct) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return nil, ErrEvalUnsupportedOnAggregation.New("CountDistinct")
}

// Children implements the Expression interface.
func (a *CountDistinct) Children() []sql.Expression {
	return a.ChildExpressions
}

// WithChildren implements the Expression interface.
func (a *CountDistinct) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewCountDistinct(children...), nil
}

// FunctionName implements the FunctionExpression interface.
func (a *CountDistinct) FunctionName() string {
	return "CountDistinct"
}

// Description implements the FunctionExpression interface.
func (a *CountDistinct) Description() string {
	return "returns the number of distinct values in a result set."
}

// NewBuffer implements the Aggregation interface.
func (a *CountDistinct) NewBuffer() (sql.AggregationBuffer, error) {
	exprs := make([]sql.Expression, len(a.ChildExpressions))
	for i, expr := range a.ChildExpressions {
		child, err := transform.Clone(expr)
		if err != nil {
			return nil, err
		}
		exprs[i] = child
	}
	return NewCountDistinctBuffer(exprs), nil
}

// WithWindow implements the Aggregation interface.
func (a *CountDistinct) WithWindow(window *sql.WindowDefinition) sql.WindowAdaptableExpression {
	na := *a
	na.window = window
	return &na
}

// Window implements the Aggregation interface.
func (a *CountDistinct) Window() *sql.WindowDefinition {
	return a.window
}

// String implements the ValueStats interface.
func (a *CountDistinct) String() string {
	return fmt.Sprintf("COUNTDISTINCT(%s)", a.ChildExpressions)
}

// NewWindowFunction implements the WindowAdaptableExpression interface.
func (a *CountDistinct) NewWindowFunction() (sql.WindowFunction, error) {
	child, err := transform.Clone(a.NaryExpression.ChildExpressions[0])
	if err != nil {
		return nil, err
	}
	return NewCountDistinctAgg(child).WithWindow(a.Window())
}
