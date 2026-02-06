// Copyright 2020-2022 Dolthub, Inc.
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

// Area is a function that returns the Area of a Polygon
type Area struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*Area)(nil)
var _ sql.CollationCoercible = (*Area)(nil)

// NewArea creates a new Area expression.
func NewArea(arg sql.Expression) sql.Expression {
	return &Area{expression.UnaryExpression{Child: arg}}
}

// FunctionName implements sql.FunctionExpression
func (a *Area) FunctionName() string {
	return "st_area"
}

// Description implements sql.FunctionExpression
func (a *Area) Description() string {
	return "returns the area of the given polygon."
}

// Type implements the sql.Expression interface.
func (a *Area) Type() sql.Type {
	return types.Float64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Area) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (a *Area) String() string {
	return fmt.Sprintf("%s(%s)", a.FunctionName(), a.Child)
}

// WithChildren implements the Expression interface.
func (a *Area) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(children), 1)
	}
	return NewArea(children[0]), nil
}

// calculateArea takes a polygon linestring, and finds the area
// this uses the Shoelace formula: https://en.wikipedia.org/wiki/Shoelace_formula
// TODO: if SRID is not cartesian, the area should be geodetic
func calculateArea(l types.LineString) float64 {
	var area float64
	for i := 0; i < len(l.Points)-1; i++ {
		p1 := l.Points[i]
		p2 := l.Points[i+1]
		area += p1.X*p2.Y - p1.Y*p2.X
	}

	if area < 0 {
		area = -area
	}

	return area / 2
}

// Eval implements the sql.Expression interface.
func (a *Area) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate argument
	v, err := a.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return nil if argument is nil
	if v == nil {
		return nil, nil
	}

	// TODO: Multi-Polygons are also valid
	// Only allow polygons
	p, ok := v.(types.Polygon)
	if !ok {
		return nil, sql.ErrInvalidArgument.New(a.FunctionName())
	}
	if p.SRID != types.CartesianSRID {
		return nil, sql.ErrUnsupportedSRID.New(p.SRID)
	}

	var totalArea float64
	for i, l := range p.Lines {
		area := calculateArea(l)
		if i != 0 {
			area = -area
		}
		totalArea += area
	}
	return totalArea, nil
}
