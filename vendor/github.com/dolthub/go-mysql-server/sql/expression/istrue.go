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
	"errors"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// IsTrue is an expression that checks if an expression is true.
type IsTrue struct {
	UnaryExpression
	invert bool
}

var _ sql.Expression = (*IsTrue)(nil)
var _ sql.CollationCoercible = (*IsTrue)(nil)

const IsTrueStr = "IS TRUE"
const IsFalseStr = "IS FALSE"

// NewIsTrue creates a new IsTrue expression.
func NewIsTrue(child sql.Expression) *IsTrue {
	return &IsTrue{UnaryExpression: UnaryExpression{child}}
}

// NewIsFalse creates a new IsTrue expression with its boolean sense inverted (IsFalse, effectively).
func NewIsFalse(child sql.Expression) *IsTrue {
	return &IsTrue{UnaryExpression: UnaryExpression{child}, invert: true}
}

// Type implements the Expression interface.
func (*IsTrue) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*IsTrue) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements the Expression interface.
func (*IsTrue) IsNullable() bool {
	return false
}

// Eval implements the Expression interface.
func (e *IsTrue) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	v, err := e.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	var boolVal interface{}
	if v == nil {
		return false, nil
	}
	boolVal, err = sql.ConvertToBool(ctx, v)
	if err != nil {
		return nil, err
	}

	if e.invert {
		return !boolVal.(bool), nil
	}
	return boolVal, nil
}

func (e *IsTrue) String() string {
	isStr := IsTrueStr
	if e.invert {
		isStr = IsFalseStr
	}
	return e.Child.String() + " " + isStr
}

// WithChildren implements the Expression interface.
func (e *IsTrue) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, errors.New("incorrect number of children")
	}

	if e.invert {
		return NewIsFalse(children[0]), nil
	}
	return NewIsTrue(children[0]), nil
}
