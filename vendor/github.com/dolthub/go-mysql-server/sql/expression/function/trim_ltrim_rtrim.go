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

	"github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type Trim struct {
	str sql.Expression
	pat sql.Expression
	dir string
}

var _ sql.FunctionExpression = (*Trim)(nil)
var _ sql.CollationCoercible = (*Trim)(nil)

func NewTrim(str sql.Expression, pat sql.Expression, dir string) sql.Expression {
	return &Trim{str, pat, dir}
}

// FunctionName implements sql.FunctionExpression
func (t *Trim) FunctionName() string {
	return "trim"
}

// Description implements sql.FunctionExpression
func (t *Trim) Description() string {
	return "remove leading and trailing spaces."
}

// Children implements the Expression interface.
func (t *Trim) Children() []sql.Expression {
	return []sql.Expression{t.str, t.pat}
}

// Eval implements the Expression interface.
func (t *Trim) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate pattern
	pat, err := t.pat.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Convert pat into string and unwrap automatically
	pat, _, err = types.LongText.Convert(ctx, pat)
	if err != nil {
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(pat).String())
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	pat, err = sql.UnwrapAny(ctx, pat)
	if err != nil {
		return nil, err
	}

	// Evaluate string value
	str, err := t.str.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Nil string
	if str == nil {
		return nil, nil
	}

	// Convert str to text type and unwrap automatically
	str, _, err = types.LongText.Convert(ctx, str)
	if err != nil {
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(str).String())
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	str, err = sql.UnwrapAny(ctx, str)
	if err != nil {
		return nil, err
	}

	start := 0
	end := len(str.(string))
	n := len(pat.(string))

	// Empty pattern, do nothing
	if n == 0 {
		return str, nil
	}

	// Trim Leading
	if t.dir == sqlparser.Leading || t.dir == sqlparser.Both {
		for start+n <= end && str.(string)[start:start+n] == pat {
			start += n
		}
	}

	// Trim Trailing
	if t.dir == sqlparser.Trailing || t.dir == sqlparser.Both {
		for start+n <= end && str.(string)[end-n:end] == pat {
			end -= n
		}
	}

	return str.(string)[start:end], nil
}

// IsNullable implements the Expression interface.
func (t Trim) IsNullable() bool {
	return t.str.IsNullable() || t.pat.IsNullable()
}

func (t Trim) String() string {
	if t.dir == sqlparser.Leading {
		return fmt.Sprintf("trim(leading %v from %v)", t.pat, t.str)
	} else if t.dir == sqlparser.Trailing {
		return fmt.Sprintf("trim(trailing %v from %v)", t.pat, t.str)
	} else {
		if t.pat.String() == " " {
			return fmt.Sprintf("trim(%v)", t.str)
		}
		return fmt.Sprintf("trim(both %v from %v)", t.pat, t.str)
	}
}

func (t Trim) Resolved() bool {
	return t.str.Resolved() && t.pat.Resolved() && t.pat.Resolved()
}

func (t Trim) Type() sql.Type { return t.str.Type() }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (t Trim) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	leftCollation, leftCoercibility := sql.GetCoercibility(ctx, t.str)
	rightCollation, rightCoercibility := sql.GetCoercibility(ctx, t.pat)
	return sql.ResolveCoercibility(leftCollation, leftCoercibility, rightCollation, rightCoercibility)
}

func (t Trim) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 2)
	}
	return NewTrim(children[0], children[1], t.dir), nil
}

type LeftTrim struct {
	expression.UnaryExpression
}

func NewLeftTrim(str sql.Expression) sql.Expression {
	return &LeftTrim{expression.UnaryExpression{Child: str}}
}

var _ sql.FunctionExpression = (*LeftTrim)(nil)
var _ sql.CollationCoercible = (*LeftTrim)(nil)

// FunctionName implements sql.FunctionExpression
func (t *LeftTrim) FunctionName() string {
	return "ltrim"
}

// Description implements sql.FunctionExpression
func (t *LeftTrim) Description() string {
	return "returns the string str with leading space characters removed."
}

func (t *LeftTrim) Type() sql.Type { return t.Child.Type() }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (t *LeftTrim) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, t.Child)
}

func (t *LeftTrim) String() string {
	return fmt.Sprintf("ltrim(%s)", t.Child)
}

func (t *LeftTrim) IsNullable() bool {
	return t.Child.IsNullable()
}

func (t *LeftTrim) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 1)
	}
	return NewLeftTrim(children[0]), nil
}

func (t *LeftTrim) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	str, err := t.Child.Eval(ctx, row)
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

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	str, err = sql.UnwrapAny(ctx, str)
	if err != nil {
		return nil, err
	}

	return strings.TrimLeftFunc(str.(string), func(r rune) bool {
		return r == ' '
	}), nil
}

type RightTrim struct {
	expression.UnaryExpression
}

func NewRightTrim(str sql.Expression) sql.Expression {
	return &RightTrim{expression.UnaryExpression{Child: str}}
}

var _ sql.FunctionExpression = (*RightTrim)(nil)
var _ sql.CollationCoercible = (*RightTrim)(nil)

// FunctionName implements sql.FunctionExpression
func (t *RightTrim) FunctionName() string {
	return "rtrim"
}

// Description implements sql.FunctionExpression
func (t *RightTrim) Description() string {
	return "returns the string str with trailing space characters removed."
}

func (t *RightTrim) Type() sql.Type { return t.Child.Type() }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (t *RightTrim) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, t.Child)
}

func (t *RightTrim) String() string {
	return fmt.Sprintf("rtrim(%s)", t.Child)
}

func (t *RightTrim) IsNullable() bool {
	return t.Child.IsNullable()
}

func (t *RightTrim) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 1)
	}
	return NewRightTrim(children[0]), nil
}

func (t *RightTrim) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	str, err := t.Child.Eval(ctx, row)
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

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	str, err = sql.UnwrapAny(ctx, str)
	if err != nil {
		return nil, err
	}

	return strings.TrimRightFunc(str.(string), func(r rune) bool {
		return r == ' '
	}), nil
}
