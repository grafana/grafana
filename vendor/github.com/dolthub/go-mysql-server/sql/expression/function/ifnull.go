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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// IfNull function returns the specified value IF the expression is NULL, otherwise return the expression.
type IfNull struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*IfNull)(nil)
var _ sql.CollationCoercible = (*IfNull)(nil)

// NewIfNull returns a new IFNULL UDF
func NewIfNull(ex, value sql.Expression) sql.Expression {
	return &IfNull{
		expression.BinaryExpressionStub{
			LeftChild:  ex,
			RightChild: value,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (f *IfNull) FunctionName() string {
	return "ifnull"
}

// Description implements sql.FunctionExpression
func (f *IfNull) Description() string {
	return "if expr1 is not NULL, it returns expr1; otherwise it returns expr2."
}

// Eval implements the Expression interface.
func (f *IfNull) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	t := f.Type()

	left, err := f.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if left != nil {
		if ret, _, err := t.Convert(ctx, left); err == nil {
			return ret, nil
		}
		return left, err
	}

	right, err := f.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if ret, _, err := t.Convert(ctx, right); err == nil {
		return ret, nil
	}
	return right, err
}

// Type implements the Expression interface.
func (f *IfNull) Type() sql.Type {
	return types.GeneralizeTypes(f.LeftChild.Type(), f.RightChild.Type())
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (f *IfNull) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	if types.IsNull(f.LeftChild) {
		if types.IsNull(f.RightChild) {
			return sql.Collation_binary, 6
		}
		return sql.GetCoercibility(ctx, f.RightChild)
	}
	return sql.GetCoercibility(ctx, f.LeftChild)
}

// IsNullable implements the Expression interface.
func (f *IfNull) IsNullable() bool {
	if types.IsNull(f.LeftChild) {
		if types.IsNull(f.RightChild) {
			return true
		}
		return f.RightChild.IsNullable()
	}
	return f.LeftChild.IsNullable()
}

func (f *IfNull) String() string {
	return fmt.Sprintf("ifnull(%s, %s)", f.LeftChild, f.RightChild)
}

// WithChildren implements the Expression interface.
func (f *IfNull) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 2)
	}
	return NewIfNull(children[0], children[1]), nil
}
