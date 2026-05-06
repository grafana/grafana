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
	"math"
	"strings"

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Distance is a function that returns the shortest distance between two geometries
type Distance struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*Distance)(nil)
var _ sql.CollationCoercible = (*Distance)(nil)

// ErrNoUnits is thrown when the specified SRID does not have units
var ErrNoUnits = errors.NewKind("the geometry passed to function st_distance is in SRID %v, which doesn't specify a length unit. Can't convert to '%v'.")

// NewDistance creates a new Distance expression.
func NewDistance(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 2 && len(args) != 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_DISTANCE", "2 or 3", len(args))
	}
	return &Distance{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (d *Distance) FunctionName() string {
	return "st_distance"
}

// Description implements sql.FunctionExpression
func (d *Distance) Description() string {
	return "returns the distance between g1 and g2."
}

// Type implements the sql.Expression interface.
func (d *Distance) Type() sql.Type {
	return types.Float64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Distance) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (d *Distance) String() string {
	var args = make([]string, len(d.ChildExpressions))
	for i, arg := range d.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", d.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (d *Distance) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewDistance(children...)
}

// flattenGeometry recursively "flattens" the geometry value into a map of its points
func flattenGeometry(g types.GeometryValue, points map[types.Point]bool) {
	switch g := g.(type) {
	case types.Point:
		points[g] = true
	case types.LineString:
		for _, p := range g.Points {
			flattenGeometry(p, points)
		}
	case types.Polygon:
		for _, l := range g.Lines {
			flattenGeometry(l, points)
		}
	case types.MultiPoint:
		for _, p := range g.Points {
			flattenGeometry(p, points)
		}
	case types.MultiLineString:
		for _, l := range g.Lines {
			flattenGeometry(l, points)
		}
	case types.MultiPolygon:
		for _, p := range g.Polygons {
			flattenGeometry(p, points)
		}
	case types.GeomColl:
		for _, gg := range g.Geoms {
			flattenGeometry(gg, points)
		}
	}
}

// calcPointDist calculates the distance between two points
// Small Optimization: don't do square root
func calcPointDist(a, b types.Point) float64 {
	dx := b.X - a.X
	dy := b.Y - a.Y
	return math.Sqrt(dx*dx + dy*dy)
}

// calcDist finds the minimum distance from a Point in g1 to a Point g2
func calcDist(g1, g2 types.GeometryValue) interface{} {
	points1, points2 := map[types.Point]bool{}, map[types.Point]bool{}
	flattenGeometry(g1, points1)
	flattenGeometry(g2, points2)

	if len(points1) == 0 || len(points2) == 0 {
		return nil
	}

	minDist := math.MaxFloat64
	for a := range points1 {
		for b := range points2 {
			minDist = math.Min(minDist, calcPointDist(a, b))
		}
	}

	return minDist
}

// Eval implements the sql.Expression interface.
func (d *Distance) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	g1, err := d.ChildExpressions[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	g2, err := d.ChildExpressions[1].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if g1 == nil || g2 == nil {
		return nil, nil
	}

	geom1, ok := g1.(types.GeometryValue)
	if !ok {
		return nil, sql.ErrInvalidGISData.New(d.FunctionName())
	}

	geom2, ok := g2.(types.GeometryValue)
	if !ok {
		return nil, sql.ErrInvalidGISData.New(d.FunctionName())
	}

	srid1 := geom1.GetSRID()
	srid2 := geom2.GetSRID()
	if srid1 != srid2 {
		return nil, sql.ErrDiffSRIDs.New(d.FunctionName(), srid1, srid2)
	}

	if srid1 != types.CartesianSRID {
		return nil, sql.ErrUnsupportedSRID.New(srid1)
	}

	dist := calcDist(geom1, geom2)

	if len(d.ChildExpressions) == 3 {
		if srid1 == types.CartesianSRID {
			return nil, ErrNoUnits.New(srid1)
		}
		// TODO: check valid unit arguments
	}

	return dist, nil
}
