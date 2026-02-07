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

package sql

import (
	"fmt"
)

// ColumnDefaultValue is an expression representing the default value of a column. May represent both a default literal
// and a default expression. A nil pointer of this type represents an implicit default value and is thus valid, so all
// method calls will return without error.
type ColumnDefaultValue struct {
	// Expression is the expression representing this default value
	Expr Expression
	// OutType converts the output of the expression into this type, when not nil
	OutType Type
	// Literal indicates whether the default value is a Literal value or expression
	Literal bool
	// ReturnNil indicates whether a nil value from the default value expression is returned as null or an error
	ReturnNil bool
	// Parenthesized indicates whether the value was specified in parens or not; this is typically the opposite of the Literal field,
	// but they can both be false in the case of now/current_timestamp for datetimes and timestamps.
	Parenthesized bool
	// TODO: we need a generated marker here so we can tell them apart during analysis, maybe?
}

var _ Expression = (*ColumnDefaultValue)(nil)
var _ CollationCoercible = (*ColumnDefaultValue)(nil)

// NewColumnDefaultValue returns a new ColumnDefaultValue expression.
func NewColumnDefaultValue(expr Expression, outType Type, representsLiteral bool, parenthesized bool, mayReturnNil bool) (*ColumnDefaultValue, error) {
	return &ColumnDefaultValue{
		Expr:          expr,
		OutType:       outType,
		Literal:       representsLiteral,
		ReturnNil:     mayReturnNil,
		Parenthesized: parenthesized,
	}, nil
}

// NewUnresolvedColumnDefaultValue returns a column default
func NewUnresolvedColumnDefaultValue(expr string) *ColumnDefaultValue {
	return &ColumnDefaultValue{
		Expr: &UnresolvedColumnDefault{ExprString: expr},
	}
}

// Children implements sql.Expression
func (e *ColumnDefaultValue) Children() []Expression {
	if e == nil {
		return nil
	}
	return []Expression{e.Expr}
}

// Eval implements sql.Expression
func (e *ColumnDefaultValue) Eval(ctx *Context, r Row) (interface{}, error) {
	if e == nil {
		return nil, nil
	}

	val, err := e.Expr.Eval(ctx, r)
	if err != nil {
		return nil, err
	}

	if val == nil && !e.ReturnNil {
		return nil, ErrColumnDefaultReturnedNull.New()
	}

	if e.OutType != nil {
		var inRange ConvertInRange
		if roundType, isRoundType := e.OutType.(RoundingNumberType); isRoundType {
			val, inRange, err = roundType.ConvertRound(ctx, val)
		} else {
			val, inRange, err = e.OutType.Convert(ctx, val)
		}
		if err != nil {
			return nil, ErrIncompatibleDefaultType.New()
		}
		if !inRange {
			return nil, ErrValueOutOfRange.New(val, e.OutType)
		}
	}

	return val, nil
}

// IsLiteral returns whether this expression represents a literal default value (otherwise it's an expression default value).
func (e *ColumnDefaultValue) IsLiteral() bool {
	if e == nil {
		return true // we return the literal nil, hence true
	}
	return e.Literal
}

// IsParenthesized returns whether this column default was specified in parentheses, using the expression default value form.
// It is almost always the opposite of IsLiteral, but there is one edge case where matching MySQL's behavior require that
// we can distinguish between a non-literal value in parens and a non-literal value not in parens. The edge case is using
// now/current_timestamp as a column default; now/current_timestamp can be specified without parens for datetime/timestamp
// fields, but it must be enclosed in parens to be used as the default for other types.
func (e *ColumnDefaultValue) IsParenthesized() bool {
	if e == nil {
		return false // we return the literal nil, hence false
	}
	return e.Parenthesized
}

// IsNullable implements sql.Expression
func (e *ColumnDefaultValue) IsNullable() bool {
	if e == nil {
		return true
	}
	if !e.ReturnNil {
		return false
	}
	return e.Expr.IsNullable()
}

// Resolved implements sql.Expression
func (e *ColumnDefaultValue) Resolved() bool {
	if e == nil {
		return true
	}
	if e.OutType == nil {
		return false
	}
	return e.Expr.Resolved()
}

// String implements sql.Expression
func (e *ColumnDefaultValue) String() string {
	//TODO: currently (2+2)/2 will, when output as a string, give (2 + 2 / 2), which is clearly wrong
	if e == nil {
		return ""
	}

	str := e.Expr.String()
	if e.Literal {
		return str
	}

	// There's a special case for NOW()
	switch str {
	case "NOW()", "NOW(0)":
		return "CURRENT_TIMESTAMP"
	case "NOW(1)":
		return "CURRENT_TIMESTAMP(1)"
	case "NOW(2)":
		return "CURRENT_TIMESTAMP(2)"
	case "NOW(3)":
		return "CURRENT_TIMESTAMP(3)"
	case "NOW(4)":
		return "CURRENT_TIMESTAMP(4)"
	case "NOW(5)":
		return "CURRENT_TIMESTAMP(5)"
	case "NOW(6)":
		return "CURRENT_TIMESTAMP(6)"
	}

	// Non-literal expressions are enclosed in parentheses
	return fmt.Sprintf("(%s)", str)
}

func (e *ColumnDefaultValue) DebugString() string {
	if e == nil {
		return ""
	}

	if e.Literal {
		return DebugString(e.Expr)
	} else if e.Parenthesized {
		return fmt.Sprintf("parenthesized(%s)", DebugString(e.Expr))
	} else {
		return fmt.Sprintf("(%s)", DebugString(e.Expr))
	}
}

// Type implements sql.Expression
func (e *ColumnDefaultValue) Type() Type {
	if e == nil {
		return nil
	}
	if e.OutType == nil {
		return e.Expr.Type()
	}
	return e.OutType
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (e *ColumnDefaultValue) CollationCoercibility(ctx *Context) (collation CollationID, coercibility byte) {
	if e == nil {
		return Collation_binary, 6
	}
	return GetCoercibility(ctx, e.Expr)
}

// WithChildren implements sql.Expression
func (e *ColumnDefaultValue) WithChildren(children ...Expression) (Expression, error) {
	if e == nil && len(children) == 0 {
		return e, nil
	}
	if len(children) != 1 {
		return nil, ErrInvalidChildrenNumber.New(e, len(children), 1)
	}
	if e == nil {
		isLiteral := len(children[0].Children()) == 0 //impossible to know, best guess
		return NewColumnDefaultValue(children[0], e.OutType, isLiteral, !isLiteral, true)
	} else {
		return NewColumnDefaultValue(children[0], e.OutType, e.Literal, e.Parenthesized, e.ReturnNil)
	}
}

// CheckType validates that the ColumnDefaultValue has the correct type.
func (e *ColumnDefaultValue) CheckType(ctx *Context) error {
	if e.OutType != nil && e.Literal {
		val, err := e.Expr.Eval(ctx, nil)
		if err != nil {
			return err
		}
		if val == nil && !e.ReturnNil {
			return ErrIncompatibleDefaultType.New()
		}
		var inRange ConvertInRange
		if roundType, isRoundType := e.OutType.(RoundingNumberType); isRoundType {
			val, inRange, err = roundType.ConvertRound(ctx, val)
		} else {
			val, inRange, err = e.OutType.Convert(ctx, val)
		}
		if err != nil {
			return ErrIncompatibleDefaultType.Wrap(err)
		}
		if !inRange {
			return ErrIncompatibleDefaultType.Wrap(ErrValueOutOfRange.New(val, e.Expr))
		}
	}
	return nil
}

type UnresolvedColumnDefault struct {
	ExprString string
}

var _ Expression = UnresolvedColumnDefault{}
var _ CollationCoercible = UnresolvedColumnDefault{}

func (u UnresolvedColumnDefault) Resolved() bool {
	return false
}

func (u UnresolvedColumnDefault) String() string {
	return u.ExprString
}

func (u UnresolvedColumnDefault) Type() Type {
	panic("UnresolvedColumnDefault is a placeholder node, but Type() was called")
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (UnresolvedColumnDefault) CollationCoercibility(ctx *Context) (collation CollationID, coercibility byte) {
	return Collation_binary, 7
}

func (u UnresolvedColumnDefault) IsNullable() bool {
	return true
}

func (u UnresolvedColumnDefault) Eval(ctx *Context, row Row) (interface{}, error) {
	panic("UnresolvedColumnDefault is a placeholder node, but Eval() was called")
}

func (u UnresolvedColumnDefault) Children() []Expression {
	return nil
}

func (u UnresolvedColumnDefault) WithChildren(children ...Expression) (Expression, error) {
	if len(children) != 0 {
		return nil, ErrInvalidChildrenNumber.New(u, len(children), 0)
	}
	return u, nil
}
