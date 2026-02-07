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

package function

import (
	"fmt"

	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// AbsVal is a function that takes the absolute value of a number
type AbsVal struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*AbsVal)(nil)
var _ sql.CollationCoercible = (*AbsVal)(nil)

// NewAbsVal creates a new AbsVal expression.
func NewAbsVal(e sql.Expression) sql.Expression {
	return &AbsVal{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (t *AbsVal) FunctionName() string {
	return "abs"
}

// Description implements sql.FunctionExpression
func (t *AbsVal) Description() string {
	return "returns the absolute value of an expression."
}

// Eval implements the Expression interface.
func (t *AbsVal) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := t.Child.Eval(ctx, row)

	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	// Fucking Golang
	switch x := val.(type) {
	case uint, uint64, uint32, uint16, uint8:
		return x, nil
	case int:
		if x < 0 {
			return -x, nil
		} else {
			return x, nil
		}
	case int64:
		if x < 0 {
			return -x, nil
		} else {
			return x, nil
		}
	case int32:
		if x < 0 {
			return -x, nil
		} else {
			return x, nil
		}
	case int16:
		if x < 0 {
			return -x, nil
		} else {
			return x, nil
		}
	case int8:
		if x < 0 {
			return -x, nil
		} else {
			return x, nil
		}
	case float64:
		if x < 0 {
			return -x, nil
		} else {
			return x, nil
		}
	case float32:
		if x < 0 {
			return -x, nil
		} else {
			return x, nil
		}
	case decimal.Decimal:
		return x.Abs(), nil
	}

	return nil, nil
}

// String implements the fmt.Stringer interface.
func (t *AbsVal) String() string {
	return fmt.Sprintf("%s(%s)", t.FunctionName(), t.Child.String())
}

func (t *AbsVal) DebugString() string {
	return fmt.Sprintf("%s(%s)", t.FunctionName(), sql.DebugString(t.Child))
}

// IsNullable implements the Expression interface.
func (t *AbsVal) IsNullable() bool {
	return t.Child.IsNullable()
}

// WithChildren implements the Expression interface.
func (t *AbsVal) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 1)
	}
	return NewAbsVal(children[0]), nil
}

// Type implements the Expression interface.
func (t *AbsVal) Type() sql.Type {
	return t.Child.Type()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*AbsVal) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}
