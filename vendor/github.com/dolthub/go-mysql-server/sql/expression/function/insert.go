// Copyright 2020-2024 Dolthub, Inc.
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

// Insert implements the SQL function INSERT() which inserts a substring at a specified position
type Insert struct {
	str    sql.Expression
	pos    sql.Expression
	length sql.Expression
	newStr sql.Expression
}

var _ sql.FunctionExpression = (*Insert)(nil)
var _ sql.CollationCoercible = (*Insert)(nil)

// NewInsert creates a new Insert expression
func NewInsert(str, pos, length, newStr sql.Expression) sql.Expression {
	return &Insert{str, pos, length, newStr}
}

// FunctionName implements sql.FunctionExpression
func (i *Insert) FunctionName() string {
	return "insert"
}

// Description implements sql.FunctionExpression
func (i *Insert) Description() string {
	return "returns the string str, with the substring beginning at position pos and len characters long replaced by the string newstr."
}

// Children implements the Expression interface
func (i *Insert) Children() []sql.Expression {
	return []sql.Expression{i.str, i.pos, i.length, i.newStr}
}

// Resolved implements the Expression interface
func (i *Insert) Resolved() bool {
	return i.str.Resolved() && i.pos.Resolved() && i.length.Resolved() && i.newStr.Resolved()
}

// IsNullable implements the Expression interface
func (i *Insert) IsNullable() bool {
	return i.str.IsNullable() || i.pos.IsNullable() || i.length.IsNullable() || i.newStr.IsNullable()
}

// Type implements the Expression interface
func (i *Insert) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible
func (i *Insert) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	collation, coercibility = sql.GetCoercibility(ctx, i.str)
	otherCollation, otherCoercibility := sql.GetCoercibility(ctx, i.newStr)
	return sql.ResolveCoercibility(collation, coercibility, otherCollation, otherCoercibility)
}

// String implements the Expression interface
func (i *Insert) String() string {
	return fmt.Sprintf("insert(%s, %s, %s, %s)", i.str, i.pos, i.length, i.newStr)
}

// WithChildren implements the Expression interface
func (i *Insert) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 4 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 4)
	}
	return NewInsert(children[0], children[1], children[2], children[3]), nil
}

// Eval implements the Expression interface
func (i *Insert) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	str, err := i.str.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if str == nil {
		return nil, nil
	}

	pos, err := i.pos.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if pos == nil {
		return nil, nil
	}

	length, err := i.length.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if length == nil {
		return nil, nil
	}

	newStr, err := i.newStr.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if newStr == nil {
		return nil, nil
	}

	// Convert all arguments to their expected types
	strVal, _, err := types.LongText.Convert(ctx, str)
	if err != nil {
		return nil, err
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	strVal, err = sql.UnwrapAny(ctx, strVal)
	if err != nil {
		return nil, err
	}

	posVal, _, err := types.Int64.Convert(ctx, pos)
	if err != nil {
		return nil, err
	}

	lengthVal, _, err := types.Int64.Convert(ctx, length)
	if err != nil {
		return nil, err
	}

	newStrVal, _, err := types.LongText.Convert(ctx, newStr)
	if err != nil {
		return nil, err
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	newStrVal, err = sql.UnwrapAny(ctx, newStrVal)
	if err != nil {
		return nil, err
	}

	s := strVal.(string)
	p := posVal.(int64)
	l := lengthVal.(int64)
	n := newStrVal.(string)

	// MySQL uses 1-based indexing for position
	// Handle negative position - return original string
	if p < 1 {
		return s, nil
	}

	// Convert to 0-based indexing
	startIdx := p - 1

	// Handle case where position is beyond string length
	if startIdx >= int64(len(s)) {
		return s, nil
	}

	// Calculate end index
	// For negative length, replace from position to end of string
	var endIdx int64
	if l < 0 {
		endIdx = int64(len(s))
	} else {
		endIdx = startIdx + l
		if endIdx > int64(len(s)) {
			endIdx = int64(len(s))
		}
	}

	// Build the result string
	result := s[:startIdx] + n + s[endIdx:]
	return result, nil
}
