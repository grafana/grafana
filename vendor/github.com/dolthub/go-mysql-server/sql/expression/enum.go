// Copyright 2024 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
package expression

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// EnumToString is an expression that converts an enum value to a string.
type EnumToString struct {
	Enum sql.Expression
}

var _ sql.Expression = (*EnumToString)(nil)
var _ sql.CollationCoercible = (*EnumToString)(nil)

func NewEnumToString(enum sql.Expression) *EnumToString {
	return &EnumToString{Enum: enum}
}

// Type implements the sql.Expression interface.
func (e *EnumToString) Type() sql.Type {
	return types.Text
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (e *EnumToString) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return e.Type().CollationCoercibility(ctx)
}

// IsNullable implements the sql.Expression interface.
func (e *EnumToString) IsNullable() bool {
	return e.Enum.IsNullable()
}

// Resolved implements the sql.Expression interface.
func (e *EnumToString) Resolved() bool {
	return e.Enum.Resolved()
}

// Children implements the sql.Expression interface.
func (e *EnumToString) Children() []sql.Expression {
	return []sql.Expression{e.Enum}
}

// Eval implements the sql.Expression interface.
func (e *EnumToString) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span("expression.EnumToString")
	defer span.End()

	val, err := e.Enum.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if val == nil {
		return nil, nil
	}

	enumType := e.Enum.Type().(types.EnumType)
	var str string
	val, err = sql.UnwrapAny(ctx, val)
	if err != nil {
		return nil, err
	}
	switch v := val.(type) {
	case uint16:
		str, _ = enumType.At(int(v))
	case string:
		str = v
	default:
		return nil, sql.ErrInvalidType.New(val, types.Text)
	}
	return str, nil
}

// WithChildren implements the Expression interface.
func (e *EnumToString) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(e, len(children), 1)
	}

	return NewEnumToString(children[0]), nil
}

// String implements the sql.Expression interface.
func (e *EnumToString) String() string {
	return e.Enum.String()
}

// DebugString implements the sql.Expression interface.
func (e *EnumToString) DebugString() string {
	return sql.DebugString(e.Enum)
}
