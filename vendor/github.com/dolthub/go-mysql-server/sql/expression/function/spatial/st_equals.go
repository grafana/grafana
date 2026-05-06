// Copyright 2023 Dolthub, Inc.
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

// STEquals is a function that returns the STEquals of a LineString
type STEquals struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*STEquals)(nil)

// NewSTEquals creates a new STEquals expression.
func NewSTEquals(g1, g2 sql.Expression) sql.Expression {
	return &STEquals{
		expression.BinaryExpressionStub{
			LeftChild:  g1,
			RightChild: g2,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (s *STEquals) FunctionName() string {
	return "st_equals"
}

// Description implements sql.FunctionExpression
func (s *STEquals) Description() string {
	return "returns 1 or 0 to indicate whether g1 is spatially equal to g2."
}

// Type implements the sql.Expression interface.
func (s *STEquals) Type() sql.Type {
	return types.Boolean
}

func (s *STEquals) String() string {
	return fmt.Sprintf("ST_EQUALS(%s, %s)", s.LeftChild, s.RightChild)
}

// WithChildren implements the Expression interface.
func (s *STEquals) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 2)
	}
	return NewSTEquals(children[0], children[1]), nil
}

// isEqual checks if the set of types.Points in g1 is spatially equal to g2
// This is equivalent to checking if g1 within g2 and g2 within g1
func isEqual(g1 types.GeometryValue, g2 types.GeometryValue) bool {
	return isWithin(g1, g2) && isWithin(g2, g1)
}

// Eval implements the sql.Expression interface.
func (s *STEquals) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	geom1, err := s.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	geom2, err := s.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	g1, g2, err := validateGeomComp(geom1, geom2, s.FunctionName())
	if err != nil {
		return nil, err
	}
	if g1 == nil || g2 == nil {
		return nil, nil
	}

	// TODO (james): remove this switch block when the other comparisons are implemented
	switch geom1.(type) {
	case types.LineString:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("LineString", s.FunctionName())
	case types.Polygon:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("Polygon", s.FunctionName())
	case types.MultiPoint:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("MultiPoint", s.FunctionName())
	case types.MultiLineString:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("MultiLineString", s.FunctionName())
	case types.MultiPolygon:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("MultiPolygon", s.FunctionName())
	case types.GeomColl:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("GeomColl", s.FunctionName())
	}

	// TODO (james): remove this switch block when the other comparisons are implemented
	switch geom2.(type) {
	case types.LineString:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("LineString", s.FunctionName())
	case types.Polygon:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("Polygon", s.FunctionName())
	case types.MultiPoint:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("MultiPoint", s.FunctionName())
	case types.MultiLineString:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("MultiLineString", s.FunctionName())
	case types.MultiPolygon:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("MultiPolygon", s.FunctionName())
	case types.GeomColl:
		return nil, sql.ErrUnsupportedGISTypeForSpatialFunc.New("GeomColl", s.FunctionName())
	}

	return isEqual(g1, g2), nil
}
