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

// Dimension is a function that converts a spatial type into WKT format (alias for AsText)
type Dimension struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*Dimension)(nil)
var _ sql.CollationCoercible = (*Dimension)(nil)

// NewDimension creates a new point expression.
func NewDimension(e sql.Expression) sql.Expression {
	return &Dimension{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (p *Dimension) FunctionName() string {
	return "st_dimension"
}

// Description implements sql.FunctionExpression
func (p *Dimension) Description() string {
	return "returns the dimension of the geometry given."
}

// IsNullable implements the sql.Expression interface.
func (p *Dimension) IsNullable() bool {
	return p.Child.IsNullable()
}

// Type implements the sql.Expression interface.
func (p *Dimension) Type() sql.Type {
	return types.Int32
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Dimension) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (p *Dimension) String() string {
	return fmt.Sprintf("%s(%s)", p.FunctionName(), p.Child.String())
}

// WithChildren implements the Expression interface.
func (p *Dimension) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 1)
	}
	return NewDimension(children[0]), nil
}

func FindDimension(g types.GeometryValue) interface{} {
	switch v := g.(type) {
	case types.Point, types.MultiPoint:
		return 0
	case types.LineString, types.MultiLineString:
		return 1
	case types.Polygon, types.MultiPolygon:
		return 2
	case types.GeomColl:
		if len(v.Geoms) == 0 {
			return nil
		}
		maxDim := 0
		for _, geom := range v.Geoms {
			dim := FindDimension(geom)
			if dim == nil {
				return nil
			}
			if dim.(int) > maxDim {
				maxDim = dim.(int)
			}
		}
		return maxDim
	default:
		return nil
	}
}

// Eval implements the sql.Expression interface.
func (p *Dimension) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate child
	val, err := p.Child.Eval(ctx, row)
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
		return FindDimension(v), nil
	default:
		return nil, sql.ErrInvalidGISData.New("ST_DIMENSION")
	}
}
