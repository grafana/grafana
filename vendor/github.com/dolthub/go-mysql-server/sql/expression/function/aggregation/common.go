// Copyright 2020-2021 Dolthub, Inc.
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

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

var ErrEvalUnsupportedOnAggregation = errors.NewKind("Unimplemented %s.Eval(). The code should have used AggregationBuffer.Eval(ctx).")

// unaryAggBase is the generic embedded class optgen
// uses to codegen single expression aggregate functions.
type unaryAggBase struct {
	expression.UnaryExpression
	typ          sql.Type
	window       *sql.WindowDefinition
	functionName string
	description  string
	id           sql.ColumnId
}

var _ sql.Aggregation = (*unaryAggBase)(nil)
var _ sql.CollationCoercible = (*unaryAggBase)(nil)

func (a *unaryAggBase) NewWindowFunction() (sql.WindowFunction, error) {
	panic("unaryAggBase is a base type, type must implement NewWindowFunction")
}

func (a *unaryAggBase) NewBuffer() (sql.AggregationBuffer, error) {
	panic("unaryAggBase is a base type, type must implement NewWindowFunction")
}

// WithWindow returns a new unaryAggBase to be embedded in wrapping type
func (a *unaryAggBase) WithWindow(window *sql.WindowDefinition) sql.WindowAdaptableExpression {
	na := *a
	na.window = window
	return &na
}

func (a *unaryAggBase) Window() *sql.WindowDefinition {
	return a.window
}

func (a *unaryAggBase) String() string {
	return fmt.Sprintf("%s(%s)", a.functionName, a.Child)
}

func (a *unaryAggBase) Type() sql.Type {
	return a.typ
}

// Id implements the Aggregation interface
func (a *unaryAggBase) Id() sql.ColumnId {
	return a.id
}

// WithId implements the Aggregation interface
func (a *unaryAggBase) WithId(id sql.ColumnId) sql.IdExpression {
	ret := *a
	ret.id = id
	return &ret
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (a *unaryAggBase) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, a.Child)
}

func (a *unaryAggBase) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return nil, ErrEvalUnsupportedOnAggregation.New(a.FunctionName())
}

func (a *unaryAggBase) Children() []sql.Expression {
	children := []sql.Expression{a.Child}
	if a.window != nil {
		children = append(children, a.window.ToExpressions()...)
	}
	return children
}

func (a *unaryAggBase) Resolved() bool {
	if _, ok := a.Child.(*expression.Star); ok {
		return true
	} else if !a.Child.Resolved() {
		return false
	}
	if a.window == nil {
		return true
	}
	return windowResolved(a.window)
}

// WithChildren returns a new unaryAggBase to be embedded in wrapping type
func (a *unaryAggBase) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) < 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(children), 1)
	}

	na := *a
	na.UnaryExpression = expression.UnaryExpression{Child: children[0]}
	if len(children) > 1 && a.window != nil {
		w, err := a.window.FromExpressions(children[1:])
		if err != nil {
			return nil, err
		}
		return na.WithWindow(w), nil
	}
	return &na, nil
}

func (a *unaryAggBase) FunctionName() string {
	return a.functionName
}

func (a *unaryAggBase) Description() string {
	return a.description
}

func windowResolved(w *sql.WindowDefinition) bool {
	return expression.ExpressionsResolved(append(w.OrderBy.ToExpressions(), w.PartitionBy...)...)
}
