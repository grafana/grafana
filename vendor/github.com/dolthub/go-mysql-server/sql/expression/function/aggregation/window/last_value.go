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

package window

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql/transform"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function/aggregation"
)

type LastValue struct {
	window *sql.WindowDefinition
	expression.UnaryExpression
	pos int
	id  sql.ColumnId
}

var _ sql.FunctionExpression = (*LastValue)(nil)
var _ sql.WindowAggregation = (*LastValue)(nil)
var _ sql.WindowAdaptableExpression = (*LastValue)(nil)
var _ sql.CollationCoercible = (*LastValue)(nil)

func NewLastValue(e sql.Expression) sql.Expression {
	return &LastValue{window: nil, UnaryExpression: expression.UnaryExpression{Child: e}}
}

// Id implements sql.IdExpression
func (f *LastValue) Id() sql.ColumnId {
	return f.id
}

// WithId implements sql.IdExpression
func (f *LastValue) WithId(id sql.ColumnId) sql.IdExpression {
	ret := *f
	ret.id = id
	return &ret
}

// Description implements sql.FunctionExpression
func (f *LastValue) Description() string {
	return "returns value of argument from last row of window frame."
}

// Window implements sql.WindowExpression
func (f *LastValue) Window() *sql.WindowDefinition {
	return f.window
}

// IsNullable implements sql.Expression
func (f *LastValue) Resolved() bool {
	return windowResolved(f.window)
}

func (f *LastValue) String() string {
	sb := strings.Builder{}
	sb.WriteString(fmt.Sprintf("last_value(%s)", f.Child.String()))
	if f.window != nil {
		sb.WriteString(" ")
		sb.WriteString(f.window.String())
	}
	return sb.String()
}

func (f *LastValue) DebugString() string {
	sb := strings.Builder{}
	sb.WriteString(fmt.Sprintf("last_value(%s)", f.Child.String()))
	if f.window != nil {
		sb.WriteString(" ")
		sb.WriteString(sql.DebugString(f.window))
	}
	return sb.String()
}

// FunctionName implements sql.FunctionExpression
func (f *LastValue) FunctionName() string {
	return "LAST_VALUE"
}

// Type implements sql.Expression
func (f *LastValue) Type() sql.Type {
	return f.Child.Type()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (f *LastValue) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, f.Child)
}

// IsNullable implements sql.Expression
func (f *LastValue) IsNullable() bool {
	return false
}

// Eval implements sql.Expression
func (f *LastValue) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return nil, sql.ErrWindowUnsupported.New(f.FunctionName())
}

// Children implements sql.Expression
func (f *LastValue) Children() []sql.Expression {
	if f == nil {
		return nil
	}
	return append(f.window.ToExpressions(), f.Child)
}

// WithChildren implements sql.Expression
func (f *LastValue) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) < 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 2)
	}

	nf := *f
	window, err := f.window.FromExpressions(children[:len(children)-1])
	if err != nil {
		return nil, err
	}

	nf.Child = children[len(children)-1]
	nf.window = window

	return &nf, nil
}

// WithWindow implements sql.WindowAggregation
func (f *LastValue) WithWindow(window *sql.WindowDefinition) sql.WindowAdaptableExpression {
	nr := *f
	nr.window = window
	return &nr
}

func (f *LastValue) NewWindowFunction() (sql.WindowFunction, error) {
	c, err := transform.Clone(f.Child)
	if err != nil {
		return nil, err
	}
	return aggregation.NewLastAgg(c).WithWindow(f.window)
}
