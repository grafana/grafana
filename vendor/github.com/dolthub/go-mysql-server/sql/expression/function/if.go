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
	"github.com/dolthub/go-mysql-server/sql/types"
)

// If function returns the second value if the first is true, the third value otherwise.
type If struct {
	expr    sql.Expression
	ifTrue  sql.Expression
	ifFalse sql.Expression
}

var _ sql.FunctionExpression = (*If)(nil)
var _ sql.CollationCoercible = (*If)(nil)

// FunctionName implements sql.FunctionExpression
func (f *If) FunctionName() string {
	return "if"
}

// Description implements sql.FunctionExpression
func (f *If) Description() string {
	return "if expr evaluates to true, returns ifTrue. Otherwise returns ifFalse."
}

func (f *If) Resolved() bool {
	return f.expr.Resolved() && f.ifTrue.Resolved() && f.ifFalse.Resolved()
}

func (f *If) Children() []sql.Expression {
	return []sql.Expression{
		f.expr, f.ifTrue, f.ifFalse,
	}
}

// NewIf returns a new IF UDF
func NewIf(expr, ifTrue, ifFalse sql.Expression) sql.Expression {
	return &If{
		expr:    expr,
		ifTrue:  ifTrue,
		ifFalse: ifFalse,
	}
}

// Eval implements the Expression interface.
func (f *If) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	e, err := f.expr.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	var asBool bool
	if e == nil {
		asBool = false
	} else {
		asBool, err = sql.ConvertToBool(ctx, e)
		if err != nil {
			return nil, err
		}
	}

	var eval interface{}
	if asBool {
		eval, err = f.ifTrue.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
	} else {
		eval, err = f.ifFalse.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
	}
	if ret, _, err := f.Type().Convert(ctx, eval); err == nil {
		return ret, nil
	}
	return eval, err
}

// Type implements the Expression interface.
func (f *If) Type() sql.Type {
	return types.GeneralizeTypes(f.ifTrue.Type(), f.ifFalse.Type())
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (f *If) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	// We would need to evaluate the condition to return the correct result here, so we'll copy
	// Type and just return the true result
	return sql.GetCoercibility(ctx, f.ifTrue)
}

// IsNullable implements the Expression interface.
func (f *If) IsNullable() bool {
	return f.ifTrue.IsNullable()
}

func (f *If) String() string {
	return fmt.Sprintf("%s(%s,%s,%s)", f.FunctionName(), f.expr, f.ifTrue, f.ifFalse)
}

// WithChildren implements the Expression interface.
func (f *If) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 3 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 3)
	}
	return NewIf(children[0], children[1], children[2]), nil
}
