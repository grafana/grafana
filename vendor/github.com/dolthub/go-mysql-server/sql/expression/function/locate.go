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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Locate returns the position of the first occurrence of a substring in a string.
// If the substring is not found within the original string, this function returns 0.
// This function performs a case-insensitive search.
type Locate struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*Locate)(nil)
var _ sql.CollationCoercible = (*Locate)(nil)

// NewLocate returns a new Locate function.
func NewLocate(exprs ...sql.Expression) (sql.Expression, error) {
	if len(exprs) < 2 || len(exprs) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("LOCATE", "2 or 3", len(exprs))
	}

	return &Locate{expression.NaryExpression{ChildExpressions: exprs}}, nil
}

// FunctionName implements sql.FunctionExpression
func (l *Locate) FunctionName() string {
	return "locate"
}

// Description implements sql.FunctionExpression
func (l *Locate) Description() string {
	return "returns the position of the first occurrence of a substring in a string."
}

// WithChildren implements the Expression interface.
func (l *Locate) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) < 2 || len(children) > 3 {
		return nil, sql.ErrInvalidChildrenNumber.New(l, len(children), 2)
	}

	return &Locate{expression.NaryExpression{ChildExpressions: children}}, nil
}

// Type implements the sql.Expression interface.
func (l *Locate) Type() sql.Type { return types.Int32 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Locate) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (l *Locate) String() string {
	switch len(l.ChildExpressions) {
	case 2:
		return fmt.Sprintf("%s(%s,%s)", l.FunctionName(), l.ChildExpressions[0], l.ChildExpressions[1])
	case 3:
		return fmt.Sprintf("%s(%s,%s,%s)", l.FunctionName(), l.ChildExpressions[0], l.ChildExpressions[1], l.ChildExpressions[2])
	}
	return ""
}

func (l *Locate) DebugString() string {
	switch len(l.ChildExpressions) {
	case 2:
		return fmt.Sprintf("%s(%s,%s)", l.FunctionName(), sql.DebugString(l.ChildExpressions[0]), sql.DebugString(l.ChildExpressions[1]))
	case 3:
		return fmt.Sprintf("%s(%s,%s,%s)", l.FunctionName(), sql.DebugString(l.ChildExpressions[0]), sql.DebugString(l.ChildExpressions[1]), sql.DebugString(l.ChildExpressions[2]))
	}
	return ""
}

// Eval implements the sql.Expression interface.
func (l *Locate) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if len(l.ChildExpressions) < 2 || len(l.ChildExpressions) > 3 {
		return nil, nil
	}

	substrVal, err := l.ChildExpressions[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if substrVal == nil {
		return nil, nil
	}

	substrVal, _, err = types.LongText.Convert(ctx, substrVal)
	if err != nil {
		return nil, err
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	substrVal, err = sql.UnwrapAny(ctx, substrVal)
	if err != nil {
		return nil, err
	}

	substr, ok := substrVal.(string)
	if !ok {
		return nil, sql.ErrInvalidArgumentDetails.New("locate", "substring must be a string")
	}

	strVal, err := l.ChildExpressions[1].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if strVal == nil {
		return nil, nil
	}

	strVal, _, err = types.LongText.Convert(ctx, strVal)
	if err != nil {
		return nil, err
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	strVal, err = sql.UnwrapAny(ctx, strVal)
	if err != nil {
		return nil, err
	}

	str, ok := strVal.(string)
	if !ok {
		return nil, sql.ErrInvalidArgumentDetails.New("locate", "string must be a string")
	}

	position := 1

	if len(l.ChildExpressions) == 3 {
		posVal, err := l.ChildExpressions[2].Eval(ctx, row)
		if err != nil {
			return nil, err
		}

		if posVal != nil {
			posInt, _, err := types.Int32.Convert(ctx, posVal)
			if err != nil {
				return nil, sql.ErrInvalidArgumentDetails.New("locate", "start must be an integer")
			}
			position = int(posInt.(int32))
		}
	}

	// Edge cases that cannot be handled by strings.Index.
	switch {
	// Position 0 doesn't exist.
	case position == 0 || (len(str) > 0 && position > len(str)):
		return int32(0), nil
	// Locate("", "") returns 1 if start is 1.
	case len(substr) == 0 && len(str) == 0:
		if position == 1 {
			return int32(1), nil
		}
		return int32(0), nil
	}

	res := strings.Index(strings.ToLower(str[position-1:]), strings.ToLower(substr))
	if res == -1 {
		return int32(0), nil
	}
	return int32(res + position), nil
}
