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

package spatial

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// SwapXY is a function that returns a spatial type with their X and Y values swapped
type SwapXY struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*SwapXY)(nil)
var _ sql.CollationCoercible = (*SwapXY)(nil)

// NewSwapXY creates a new point expression.
func NewSwapXY(e sql.Expression) sql.Expression {
	return &SwapXY{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (s *SwapXY) FunctionName() string {
	return "st_swapxy"
}

// Description implements sql.FunctionExpression
func (s *SwapXY) Description() string {
	return "returns the geometry with the x and y values swapped."
}

// IsNullable implements the sql.Expression interface.
func (s *SwapXY) IsNullable() bool {
	return s.Child.IsNullable()
}

// Type implements the sql.Expression interface.
func (s *SwapXY) Type() sql.Type {
	return s.Child.Type()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*SwapXY) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (s *SwapXY) String() string {
	return fmt.Sprintf("%s(%s)", s.FunctionName(), s.Child.String())
}

// WithChildren implements the Expression interface.
func (s *SwapXY) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}
	return NewSwapXY(children[0]), nil
}

// Eval implements the sql.Expression interface.
func (s *SwapXY) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate child
	val, err := s.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return nil if geometry is nil
	if val == nil {
		return nil, nil
	}

	// Expect one of the geometry types
	switch v := val.(type) {
	case types.GeometryValue:
		return v.Swap(), nil
	default:
		return nil, sql.ErrInvalidGISData.New(s.FunctionName())
	}
}
