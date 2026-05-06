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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// MakeSet implements the SQL function MAKE_SET() which returns a comma-separated set of strings
// where the corresponding bit in bits is set
type MakeSet struct {
	bits   sql.Expression
	values []sql.Expression
}

var _ sql.FunctionExpression = (*MakeSet)(nil)
var _ sql.CollationCoercible = (*MakeSet)(nil)

// NewMakeSet creates a new MakeSet expression
func NewMakeSet(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("MAKE_SET", "2 or more", len(args))
	}

	return &MakeSet{
		bits:   args[0],
		values: args[1:],
	}, nil
}

// FunctionName implements sql.FunctionExpression
func (m *MakeSet) FunctionName() string {
	return "make_set"
}

// Description implements sql.FunctionExpression
func (m *MakeSet) Description() string {
	return "returns a set string (a string containing substrings separated by , characters) consisting of the strings that have the corresponding bit in bits set."
}

// Children implements the Expression interface
func (m *MakeSet) Children() []sql.Expression {
	children := []sql.Expression{m.bits}
	children = append(children, m.values...)
	return children
}

// Resolved implements the Expression interface
func (m *MakeSet) Resolved() bool {
	for _, child := range m.Children() {
		if !child.Resolved() {
			return false
		}
	}
	return true
}

// IsNullable implements the Expression interface
func (m *MakeSet) IsNullable() bool {
	return m.bits.IsNullable()
}

// Type implements the Expression interface
func (m *MakeSet) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible
func (m *MakeSet) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	// Start with highest coercibility (most coercible)
	collation = sql.Collation_Default
	coercibility = 5

	for _, value := range m.values {
		valueCollation, valueCoercibility := sql.GetCoercibility(ctx, value)
		collation, coercibility = sql.ResolveCoercibility(collation, coercibility, valueCollation, valueCoercibility)
	}

	return collation, coercibility
}

// String implements the Expression interface
func (m *MakeSet) String() string {
	children := m.Children()
	childStrs := make([]string, len(children))
	for i, child := range children {
		childStrs[i] = child.String()
	}
	return fmt.Sprintf("make_set(%s)", strings.Join(childStrs, ", "))
}

// WithChildren implements the Expression interface
func (m *MakeSet) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewMakeSet(children...)
}

// Eval implements the Expression interface
func (m *MakeSet) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	bitsVal, err := m.bits.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if bitsVal == nil {
		return nil, nil
	}

	// Convert bits to uint64
	bitsInt, _, err := types.Uint64.Convert(ctx, bitsVal)
	if err != nil {
		return nil, err
	}
	bits := bitsInt.(uint64)

	var result []string

	// Check each value argument against the corresponding bit
	for i, valueExpr := range m.values {
		// Check if bit i is set
		if (bits & (1 << uint(i))) != 0 {
			val, err := valueExpr.Eval(ctx, row)
			if err != nil {
				return nil, err
			}
			// Skip NULL values
			if val != nil {
				valStr, _, err := types.LongText.Convert(ctx, val)
				if err != nil {
					return nil, err
				}

				// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
				valStr, err = sql.UnwrapAny(ctx, valStr)
				if err != nil {
					return nil, err
				}

				result = append(result, valStr.(string))
			}
		}
	}

	return strings.Join(result, ","), nil
}
