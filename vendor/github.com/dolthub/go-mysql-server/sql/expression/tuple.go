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

package expression

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	types2 "github.com/dolthub/go-mysql-server/sql/types"
)

// Tuple is a fixed-size collection of expressions.
// A tuple of size 1 is treated as the expression itself.
type Tuple []sql.Expression

// NewTuple creates a new Tuple expression.
func NewTuple(exprs ...sql.Expression) Tuple {
	return Tuple(exprs)
}

// Eval implements the Expression interface.
func (t Tuple) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if len(t) == 1 {
		return t[0].Eval(ctx, row)
	}

	var result = make([]interface{}, len(t))
	for i, e := range t {
		v, err := e.Eval(ctx, row)
		if err != nil {
			return nil, err
		}

		result[i] = v
	}

	return result, nil
}

// IsNullable implements the Expression interface.
func (t Tuple) IsNullable() bool {
	if len(t) == 1 {
		return t[0].IsNullable()
	}

	return false
}

func (t Tuple) String() string {
	var exprs = make([]string, len(t))
	for i, e := range t {
		exprs[i] = e.String()
	}
	return fmt.Sprintf("(%s)", strings.Join(exprs, ", "))
}

func (t Tuple) DebugString() string {
	var exprs = make([]string, len(t))
	for i, e := range t {
		exprs[i] = sql.DebugString(e)
	}
	return fmt.Sprintf("TUPLE(%s)", strings.Join(exprs, ", "))
}

// Resolved implements the Expression interface.
func (t Tuple) Resolved() bool {
	for _, e := range t {
		if !e.Resolved() {
			return false
		}
	}

	return true
}

// Type implements the Expression interface.
func (t Tuple) Type() sql.Type {
	if len(t) == 1 {
		return t[0].Type()
	}

	types := make([]sql.Type, len(t))
	for i, e := range t {
		types[i] = e.Type()
	}

	return types2.CreateTuple(types...)
}

// WithChildren implements the Expression interface.
func (t Tuple) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != len(t) {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), len(t))
	}
	return NewTuple(children...), nil
}

// Children implements the Expression interface.
func (t Tuple) Children() []sql.Expression {
	return t
}
