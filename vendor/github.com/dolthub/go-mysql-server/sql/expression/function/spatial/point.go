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
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Point is a function that returns a point type containing values Y and Y.
type Point struct {
	X sql.Expression
	Y sql.Expression
}

var _ sql.FunctionExpression = (*Point)(nil)
var _ sql.CollationCoercible = (*Point)(nil)

// NewPoint creates a new point expression.
func NewPoint(e1, e2 sql.Expression) sql.Expression {
	return &Point{e1, e2}
}

// FunctionName implements sql.FunctionExpression
func (p *Point) FunctionName() string {
	return "point"
}

// Description implements sql.FunctionExpression
func (p *Point) Description() string {
	return "returns a new point."
}

// Children implements the sql.Expression interface.
func (p *Point) Children() []sql.Expression {
	return []sql.Expression{p.X, p.Y}
}

// Resolved implements the sql.Expression interface.
func (p *Point) Resolved() bool {
	return p.X.Resolved() && p.Y.Resolved()
}

// IsNullable implements the sql.Expression interface.
func (p *Point) IsNullable() bool {
	return p.X.IsNullable() || p.Y.IsNullable()
}

// Type implements the sql.Expression interface.
func (p *Point) Type() sql.Type {
	return types.PointType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Point) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (p *Point) String() string {
	return fmt.Sprintf("%s(%s,%s)", p.FunctionName(), p.X.String(), p.Y.String())
}

// WithChildren implements the Expression interface.
func (p *Point) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 2)
	}
	return NewPoint(children[0], children[1]), nil
}

// Eval implements the sql.Expression interface.
func (p *Point) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate X
	x, err := p.X.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if x == nil {
		return nil, nil
	}

	// Convert to float64
	_x, _, err := types.Float64.Convert(ctx, x)
	if err != nil {
		return nil, err
	}

	// Evaluate Y
	y, err := p.Y.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if y == nil {
		return nil, nil
	}

	// Convert to float64
	_y, _, err := types.Float64.Convert(ctx, y)
	if err != nil {
		return nil, err
	}

	return types.Point{X: _x.(float64), Y: _y.(float64)}, nil
}
