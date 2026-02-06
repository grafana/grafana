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
	"reflect"
	"strings"

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var ErrDivisionByZero = errors.NewKind("division by zero")

type padType rune

const (
	lPadType padType = 'l'
	rPadType padType = 'r'
)

func NewLeftPad(e ...sql.Expression) (sql.Expression, error) {
	return NewPad(lPadType, e...)
}

func NewRightPad(e ...sql.Expression) (sql.Expression, error) {
	return NewPad(rPadType, e...)
}

// NewPad creates a new Pad expression.
func NewPad(pType padType, args ...sql.Expression) (sql.Expression, error) {
	argLen := len(args)
	if argLen != 3 {
		return nil, sql.ErrInvalidArgumentNumber.New(string(pType)+"pad", "3", argLen)
	}

	return &Pad{args[0], args[1], args[2], pType}, nil
}

// Pad is a function that pads a string with another string.
type Pad struct {
	str     sql.Expression
	length  sql.Expression
	padStr  sql.Expression
	padType padType
}

var _ sql.FunctionExpression = (*Pad)(nil)
var _ sql.CollationCoercible = (*Pad)(nil)

// FunctionName implements sql.FunctionExpression
func (p *Pad) FunctionName() string {
	if p.padType == lPadType {
		return "lpad"
	} else if p.padType == rPadType {
		return "rpad"
	} else {
		panic("unknown name for pad type")
	}
}

// Description implements sql.FunctionExpression
func (p *Pad) Description() string {
	if p.padType == lPadType {
		return "returns the string str, left-padded with the string padstr to a length of len characters."
	} else if p.padType == rPadType {
		return "returns the string str, right-padded with the string padstr to a length of len characters."
	} else {
		panic("unknown description for pad type")
	}
}

// Children implements the Expression interface.
func (p *Pad) Children() []sql.Expression {
	return []sql.Expression{p.str, p.length, p.padStr}
}

// Resolved implements the Expression interface.
func (p *Pad) Resolved() bool {
	return p.str.Resolved() && p.length.Resolved() && (p.padStr.Resolved())
}

// IsNullable implements the Expression interface.
func (p *Pad) IsNullable() bool {
	return p.str.IsNullable() || p.length.IsNullable() || p.padStr.IsNullable()
}

// Type implements the Expression interface.
func (p *Pad) Type() sql.Type { return types.LongText }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (p *Pad) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	leftCollation, leftCoercibility := sql.GetCoercibility(ctx, p.str)
	rightCollation, rightCoercibility := sql.GetCoercibility(ctx, p.padStr)
	return sql.ResolveCoercibility(leftCollation, leftCoercibility, rightCollation, rightCoercibility)
}

func (p *Pad) String() string {
	if p.padType == lPadType {
		return fmt.Sprintf("lpad(%s, %s, %s)", p.str, p.length, p.padStr)
	}
	return fmt.Sprintf("rpad(%s, %s, %s)", p.str, p.length, p.padStr)
}

// WithChildren implements the Expression interface.
func (p *Pad) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewPad(p.padType, children...)
}

// Eval implements the Expression interface.
func (p *Pad) Eval(
	ctx *sql.Context,
	row sql.Row,
) (interface{}, error) {
	str, err := p.str.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if str == nil {
		return nil, nil
	}

	str, _, err = types.LongText.Convert(ctx, str)
	if err != nil {
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(str))
	}

	length, err := p.length.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if length == nil {
		return nil, nil
	}

	length, _, err = types.Int64.Convert(ctx, length)
	if err != nil {
		return nil, err
	}

	padStr, err := p.padStr.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if padStr == nil {
		return nil, nil
	}

	padStr, _, err = types.LongText.Convert(ctx, padStr)
	if err != nil {
		return nil, err
	}

	{
		str, _, err := sql.Unwrap[string](ctx, str)
		if err != nil {
			return nil, err
		}

		padStr, _, err := sql.Unwrap[string](ctx, padStr)
		if err != nil {
			return nil, err
		}

		return padString(str, length.(int64), padStr, p.padType)
	}
}

func padString(str string, length int64, padStr string, padType padType) (string, error) {
	if length <= 0 {
		return "", nil
	}
	if int64(len(str)) >= length {
		return str[:length], nil
	}
	if len(padStr) == 0 {
		return "", nil
	}

	padLen := int(length - int64(len(str)))
	quo, rem, err := divmod(int64(padLen), int64(len(padStr)))
	if err != nil {
		return "", err
	}

	if padType == lPadType {
		result := strings.Repeat(padStr, int(quo)) + padStr[:rem] + str
		return result[:length], nil
	}
	result := str + strings.Repeat(padStr, int(quo)) + padStr[:rem]
	return result[(int64(len(result)) - length):], nil
}

func divmod(a, b int64) (quotient, remainder int64, err error) {
	if b == 0 {
		return 0, 0, ErrDivisionByZero.New()
	}
	quotient = a / b
	remainder = a % b
	return
}
