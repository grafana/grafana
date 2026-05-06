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

	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// Intersects is a function that returns true if the two geometries intersect
type Intersects struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*Intersects)(nil)
var _ sql.CollationCoercible = (*Intersects)(nil)

// NewIntersects creates a new Intersects expression.
func NewIntersects(g1, g2 sql.Expression) sql.Expression {
	return &Intersects{
		expression.BinaryExpressionStub{
			LeftChild:  g1,
			RightChild: g2,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (i *Intersects) FunctionName() string {
	return "st_intersects"
}

// Description implements sql.FunctionExpression
func (i *Intersects) Description() string {
	return "returns 1 or 0 to indicate whether g1 spatially intersects g2."
}

// Type implements the sql.Expression interface.
func (i *Intersects) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Intersects) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (i *Intersects) String() string {
	return fmt.Sprintf("%s(%s,%s)", i.FunctionName(), i.LeftChild, i.RightChild)
}

func (i *Intersects) DebugString() string {
	return fmt.Sprintf("%s(%s,%s)", i.FunctionName(), sql.DebugString(i.LeftChild), sql.DebugString(i.RightChild))
}

// WithChildren implements the Expression interface.
func (i *Intersects) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 2)
	}
	return NewIntersects(children[0], children[1]), nil
}

// isPointIntersectLine checks if Point p intersects the LineString l
// Note: this will return true if p is a terminal point of l
// Alternatively, we could calculate if dist(ap) + dist(ab) == dist(ap)
func isPointIntersectLine(p types.Point, l types.LineString) bool {
	for i := 1; i < len(l.Points); i++ {
		a, b := l.Points[i-1], l.Points[i]
		if isInBBox(a, b, p) && orientation(a, b, p) == 0 {
			return true
		}
	}
	return false
}

// isPointIntersectPolyBoundary checks if Point p intersects the Polygon boundary
func isPointIntersectPolyBoundary(point types.Point, poly types.Polygon) bool {
	for _, line := range poly.Lines {
		if isPointIntersectLine(point, line) {
			return true
		}
	}
	return false
}

// isPointIntersectPolyInterior checks if a Point p intersects the Polygon Interior
// Point outside the first LineString is not in Polygon Interior
// Point inside the other LineStrings is not in Polygon Interior
// Note: this returns true for Polygon boundaries?
func isPointIntersectPolyInterior(point types.Point, poly types.Polygon) bool {
	if !isPointWithinClosedLineString(point, poly.Lines[0]) {
		return false
	}
	for i := 1; i < len(poly.Lines); i++ {
		if isPointWithinClosedLineString(point, poly.Lines[i]) {
			return false
		}
	}
	return true
}

func isPointIntersects(p types.Point, g types.GeometryValue) bool {
	switch g := g.(type) {
	case types.Point:
		return isPointEqual(p, g)
	case types.LineString:
		return isPointIntersectLine(p, g)
	case types.Polygon:
		return isPointIntersectPolyBoundary(p, g) || isPointIntersectPolyInterior(p, g)
	case types.MultiPoint:
		for _, pp := range g.Points {
			if isPointIntersects(p, pp) {
				return true
			}
		}
	case types.MultiLineString:
		for _, l := range g.Lines {
			if isPointIntersects(p, l) {
				return true
			}
		}
	case types.MultiPolygon:
		for _, pp := range g.Polygons {
			if isPointIntersects(p, pp) {
				return true
			}
		}
	case types.GeomColl:
		for _, gg := range g.Geoms {
			if isPointIntersects(p, gg) {
				return true
			}
		}
	}
	return false
}

// linesIntersect checks if line segment ab intersects line cd
// Edge case for collinear points is to check if they are within the bounding box
// Reference: https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
func linesIntersect(a, b, c, d types.Point) bool {
	abc := orientation(a, b, c)
	abd := orientation(a, b, d)
	cda := orientation(c, d, a)
	cdb := orientation(c, d, b)

	// different orientations mean they intersect
	if (abc != abd) && (cda != cdb) {
		return true
	}

	// if orientation is collinear, check if point is inside segment
	if abc == 0 && isInBBox(a, b, c) {
		return true
	}
	if abd == 0 && isInBBox(a, b, d) {
		return true
	}
	if cda == 0 && isInBBox(c, d, a) {
		return true
	}
	if cdb == 0 && isInBBox(c, d, b) {
		return true
	}

	return false
}

func isLineIntersectLine(l1, l2 types.LineString) bool {
	for i := 1; i < len(l1.Points); i++ {
		for j := 1; j < len(l2.Points); j++ {
			if linesIntersect(l1.Points[i-1], l1.Points[i], l2.Points[j-1], l2.Points[j]) {
				return true
			}
		}
	}
	return false
}

func isLineIntersects(l types.LineString, g types.GeometryValue) bool {
	switch g := g.(type) {
	case types.Point:
		return isPointIntersects(g, l)
	case types.LineString:
		return isLineIntersectLine(l, g)
	case types.Polygon:
		for _, p := range l.Points {
			if isPointIntersects(p, g) {
				return true
			}
		}
		for _, line := range g.Lines {
			if isLineIntersectLine(l, line) {
				return true
			}
		}
	case types.MultiPoint:
		for _, p := range g.Points {
			if isLineIntersects(l, p) {
				return true
			}
		}
	case types.MultiLineString:
		for _, line := range g.Lines {
			if isLineIntersects(l, line) {
				return true
			}
		}
	case types.MultiPolygon:
		for _, p := range g.Polygons {
			if isLineIntersects(l, p) {
				return true
			}
		}
	case types.GeomColl:
		for _, geom := range g.Geoms {
			if isLineIntersects(l, geom) {
				return true
			}
		}
	}
	return false
}

func isPolyIntersects(p types.Polygon, g types.GeometryValue) bool {
	switch g := g.(type) {
	case types.Point:
		return isPointIntersects(g, p)
	case types.LineString:
		return isLineIntersects(g, p)
	case types.Polygon:
		for _, l := range g.Lines {
			for _, point := range l.Points {
				if isPointIntersects(point, p) {
					return true
				}
			}
		}
		for _, l := range p.Lines {
			for _, point := range l.Points {
				if isPointIntersects(point, g) {
					return true
				}
			}
		}
	case types.MultiPoint:
		for _, point := range g.Points {
			if isPolyIntersects(p, point) {
				return true
			}
		}
	case types.MultiLineString:
		for _, l := range g.Lines {
			if isPolyIntersects(p, l) {
				return true
			}
		}
	case types.MultiPolygon:
		for _, poly := range g.Polygons {
			if isPolyIntersects(p, poly) {
				return true
			}
		}
	case types.GeomColl:
		for _, geom := range g.Geoms {
			if isPolyIntersects(p, geom) {
				return true
			}
		}
	}
	return false
}

func isIntersects(g1, g2 types.GeometryValue) bool {
	switch g1 := g1.(type) {
	case types.Point:
		return isPointIntersects(g1, g2)
	case types.LineString:
		return isLineIntersects(g1, g2)
	case types.Polygon:
		return isPolyIntersects(g1, g2)
	case types.MultiPoint:
		for _, p := range g1.Points {
			if isIntersects(p, g2) {
				return true
			}
		}
	case types.MultiLineString:
		for _, l := range g1.Lines {
			if isIntersects(l, g2) {
				return true
			}
		}
	case types.MultiPolygon:
		for _, p := range g1.Polygons {
			if isIntersects(p, g2) {
				return true
			}
		}
	case types.GeomColl:
		for _, g := range g1.Geoms {
			if isIntersects(g, g2) {
				return true
			}
		}
	}
	return false
}

// validateGeomComp validates that variables geom1 and geom2 are comparable geometries.
// 1. Nil values, return nil
// 2. Not a types.GeometryValue, return error
// 3. SRIDs don't match, return error
// 4. Empty GeometryCollection, return nil
func validateGeomComp(geom1, geom2 interface{}, funcName string) (types.GeometryValue, types.GeometryValue, error) {
	if geom1 == nil || geom2 == nil {
		return nil, nil, nil
	}
	g1, ok := geom1.(types.GeometryValue)
	if !ok {
		return nil, nil, sql.ErrInvalidGISData.New(funcName)
	}
	g2, ok := geom2.(types.GeometryValue)
	if !ok {
		return nil, nil, sql.ErrInvalidGISData.New(funcName)
	}
	if g1.GetSRID() != g2.GetSRID() {
		return nil, nil, sql.ErrDiffSRIDs.New(funcName, g1.GetSRID(), g2.GetSRID())
	}
	if gc, ok := g1.(types.GeomColl); ok && countConcreteGeoms(gc) == 0 {
		return nil, nil, nil
	}
	if gc, ok := g2.(types.GeomColl); ok && countConcreteGeoms(gc) == 0 {
		return nil, nil, nil
	}
	return g1, g2, nil
}

// Eval implements the sql.Expression interface.
func (i *Intersects) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	geom1, err := i.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	geom2, err := i.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	g1, g2, err := validateGeomComp(geom1, geom2, i.FunctionName())
	if err != nil {
		return nil, err
	}
	if g1 == nil || g2 == nil {
		return nil, nil
	}
	return isIntersects(g1, g2), nil
}
