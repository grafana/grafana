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

// NullIf function compares two expressions and returns NULL if they are equal. Otherwise, the first expression is returned.
type NullIf struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*NullIf)(nil)
var _ sql.CollationCoercible = (*NullIf)(nil)

// NewNullIf returns a new NULLIF UDF
func NewNullIf(ex1, ex2 sql.Expression) sql.Expression {
	return &NullIf{
		expression.BinaryExpressionStub{
			LeftChild:  ex1,
			RightChild: ex2,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (f *NullIf) FunctionName() string {
	return "nullif"
}

// Description implements sql.FunctionExpression
func (f *NullIf) Description() string {
	return "returns NULL if expr1 = expr2 is true, otherwise returns expr1."
}

// Eval implements the Expression interface.
func (f *NullIf) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if types.IsNull(f.LeftChild) && types.IsNull(f.RightChild) {
		return nil, nil
	}

	val, err := expression.NewEquals(f.LeftChild, f.RightChild).Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if b, ok := val.(bool); ok && b {
		return nil, nil
	}

	return f.LeftChild.Eval(ctx, row)
}

// Type implements the Expression interface.
func (f *NullIf) Type() sql.Type {
	if types.IsNull(f.LeftChild) {
		return types.Null
	}

	return f.LeftChild.Type()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (f *NullIf) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	if types.IsNull(f.LeftChild) {
		return sql.Collation_binary, 6
	}
	return sql.GetCoercibility(ctx, f.LeftChild)
}

// IsNullable implements the Expression interface.
func (f *NullIf) IsNullable() bool {
	return true
}

func (f *NullIf) String() string {
	return fmt.Sprintf("%s(%s,%s)", f.FunctionName(), f.LeftChild, f.RightChild)
}

// WithChildren implements the Expression interface.
func (f *NullIf) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 2)
	}
	return NewNullIf(children[0], children[1]), nil
}
