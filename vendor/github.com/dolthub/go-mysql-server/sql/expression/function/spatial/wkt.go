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
	"strconv"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// AsWKT is a function that converts a spatial type into WKT format (alias for AsText)
type AsWKT struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*AsWKT)(nil)
var _ sql.CollationCoercible = (*AsWKT)(nil)

// NewAsWKT creates a new point expression.
func NewAsWKT(e sql.Expression) sql.Expression {
	return &AsWKT{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (p *AsWKT) FunctionName() string {
	return "st_aswkb"
}

// Description implements sql.FunctionExpression
func (p *AsWKT) Description() string {
	return "returns binary representation of given spatial type."
}

// IsNullable implements the sql.Expression interface.
func (p *AsWKT) IsNullable() bool {
	return p.Child.IsNullable()
}

// Type implements the sql.Expression interface.
func (p *AsWKT) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*AsWKT) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

func (p *AsWKT) String() string {
	return fmt.Sprintf("%s(%s)", p.FunctionName(), p.Child.String())
}

// WithChildren implements the Expression interface.
func (p *AsWKT) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 1)
	}
	return NewAsWKT(children[0]), nil
}

// TODO: these functions could be refactored to be inside the sql.GeometryValue interface

// PointToWKT converts a sql.Point to a string
func PointToWKT(p types.Point, order bool) string {
	x := strconv.FormatFloat(p.X, 'g', -1, 64)
	y := strconv.FormatFloat(p.Y, 'g', -1, 64)
	if order {
		x, y = y, x
	}
	return fmt.Sprintf("%s %s", x, y)
}

// LineToWKT converts a sql.LineString to a string
func LineToWKT(l types.LineString, order bool) string {
	points := make([]string, len(l.Points))
	for i, p := range l.Points {
		points[i] = PointToWKT(p, order)
	}
	return strings.Join(points, ",")
}

// PolygonToWKT converts a sql.Polygon to a string
func PolygonToWKT(p types.Polygon, order bool) string {
	lines := make([]string, len(p.Lines))
	for i, l := range p.Lines {
		lines[i] = "(" + LineToWKT(l, order) + ")"
	}
	return strings.Join(lines, ",")
}

// MultiPointToWKT converts a sql.MultiPoint to a string
func MultiPointToWKT(p types.MultiPoint, order bool) string {
	points := make([]string, len(p.Points))
	for i, p := range p.Points {
		points[i] = PointToWKT(p, order)
	}
	return strings.Join(points, ",")
}

// MultiLineStringToWKT converts a sql.Polygon to a string
func MultiLineStringToWKT(l types.MultiLineString, order bool) string {
	lines := make([]string, len(l.Lines))
	for i, line := range l.Lines {
		lines[i] = "(" + LineToWKT(line, order) + ")"
	}
	return strings.Join(lines, ",")
}

// MultiPolygonToWKT converts a sql.Polygon to a string
func MultiPolygonToWKT(p types.MultiPolygon, order bool) string {
	polys := make([]string, len(p.Polygons))
	for i, poly := range p.Polygons {
		polys[i] = "(" + PolygonToWKT(poly, order) + ")"
	}
	return strings.Join(polys, ",")
}

// GeomCollToWKT converts a sql.Polygon to a string
func GeomCollToWKT(g types.GeomColl, order bool) string {
	geoms := make([]string, len(g.Geoms))
	for i, geom := range g.Geoms {
		switch g := geom.(type) {
		case types.Point:
			geoms[i] = "POINT(" + PointToWKT(g, order) + ")"
		case types.LineString:
			geoms[i] = "LINESTRING(" + LineToWKT(g, order) + ")"
		case types.Polygon:
			geoms[i] = "POLYGON(" + PolygonToWKT(g, order) + ")"
		case types.MultiPoint:
			geoms[i] = "MULTIPOINT(" + MultiPointToWKT(g, order) + ")"
		case types.MultiLineString:
			geoms[i] = "MULTILINESTRING(" + MultiLineStringToWKT(g, order) + ")"
		case types.MultiPolygon:
			geoms[i] = "MULTIPOLYGON(" + MultiPolygonToWKT(g, order) + ")"
		case types.GeomColl:
			geoms[i] = "GEOMETRYCOLLECTION(" + GeomCollToWKT(g, order) + ")"
		}
	}
	return strings.Join(geoms, ",")
}

// Eval implements the sql.Expression interface.
func (p *AsWKT) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate child
	val, err := p.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	var geomType string
	var data string
	switch v := val.(type) {
	case types.Point:
		geomType = "POINT"
		data = PointToWKT(v, v.SRID == types.GeoSpatialSRID)
	case types.LineString:
		geomType = "LINESTRING"
		data = LineToWKT(v, v.SRID == types.GeoSpatialSRID)
	case types.Polygon:
		geomType = "POLYGON"
		data = PolygonToWKT(v, v.SRID == types.GeoSpatialSRID)
	case types.MultiPoint:
		geomType = "MULTIPOINT"
		data = MultiPointToWKT(v, v.SRID == types.GeoSpatialSRID)
	case types.MultiLineString:
		geomType = "MULTILINESTRING"
		data = MultiLineStringToWKT(v, v.SRID == types.GeoSpatialSRID)
	case types.MultiPolygon:
		geomType = "MULTIPOLYGON"
		data = MultiPolygonToWKT(v, v.SRID == types.GeoSpatialSRID)
	case types.GeomColl:
		geomType = "GEOMETRYCOLLECTION"
		data = GeomCollToWKT(v, v.SRID == types.GeoSpatialSRID)
	default:
		return nil, sql.ErrInvalidGISData.New(p.FunctionName())
	}

	return fmt.Sprintf("%s(%s)", geomType, data), nil
}

// GeomFromText is a function that returns a point type from a WKT string
type GeomFromText struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*GeomFromText)(nil)
var _ sql.CollationCoercible = (*GeomFromText)(nil)

// NewGeomFromText creates a new point expression.
func NewGeomFromText(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_GEOMFROMTEXT", "1, 2, or 3", len(args))
	}
	return &GeomFromText{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (g *GeomFromText) FunctionName() string {
	return "st_geomfromtext"
}

// Description implements sql.FunctionExpression
func (g *GeomFromText) Description() string {
	return "returns a new point from a WKT string."
}

// Type implements the sql.Expression interface.
func (g *GeomFromText) Type() sql.Type {
	// TODO: return type is determined after Eval, use Geometry for now?
	return types.GeometryType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*GeomFromText) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (g *GeomFromText) String() string {
	var args = make([]string, len(g.ChildExpressions))
	for i, arg := range g.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", g.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (g *GeomFromText) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewGeomFromText(children...)
}

func TrimWKTData(s string) (string, int, error) {
	// Must start with open parenthesis
	if s[0] != '(' {
		return "", 0, sql.ErrInvalidGISData.New()
	}

	// Read until all parentheses are closed
	var count, end int
	for count, end = 1, 1; end < len(s) && count != 0; end++ {
		switch s[end] {
		case '(':
			count++
		case ')':
			count--
		}
	}
	if count != 0 {
		return "", 0, sql.ErrInvalidGISData.New()
	}

	// Remove parentheses, extract data, and trim
	data := s[1 : end-1]
	data = strings.TrimSpace(data)

	return data, end, nil
}

// ParseWKTHeader should extract the type and data from the geometry string
// `end` is used to detect extra characters after a valid geometry
func ParseWKTHeader(s string) (string, string, int, error) {
	// Read until first open parenthesis
	start := strings.Index(s, "(")

	// Bad if no parenthesis found
	if start == -1 {
		return "", "", 0, sql.ErrInvalidGISData.New()
	}

	// Get Geometry Type
	geomType := s[:start]
	geomType = strings.TrimSpace(geomType)
	geomType = strings.ToLower(geomType)

	data, end, err := TrimWKTData(s[start:])
	if err != nil {
		return "", "", 0, err
	}

	return geomType, data, start + end, nil
}

// WKTToPoint expects a string like this "1.2 3.4"
func WKTToPoint(s string, srid uint32, order bool) (types.Point, error) {
	if len(s) == 0 {
		return types.Point{}, sql.ErrInvalidGISData.New()
	}

	// Get everything between spaces
	args := strings.Fields(s)
	if len(args) != 2 {
		return types.Point{}, sql.ErrInvalidGISData.New()
	}

	x, err := strconv.ParseFloat(args[0], 64)
	if err != nil {
		return types.Point{}, sql.ErrInvalidGISData.New()
	}

	y, err := strconv.ParseFloat(args[1], 64)
	if err != nil {
		return types.Point{}, sql.ErrInvalidGISData.New()
	}

	if order {
		x, y = y, x
	}

	return types.Point{SRID: srid, X: x, Y: y}, nil
}

// WKTToLine expects a string like "1.2 3.4, 5.6 7.8, ..."
func WKTToLine(s string, srid uint32, order bool) (types.LineString, error) {
	if len(s) == 0 {
		return types.LineString{}, sql.ErrInvalidGISData.New()
	}

	pointStrs := strings.Split(s, ",")
	var points = make([]types.Point, len(pointStrs))
	var err error
	for i, ps := range pointStrs {
		ps = strings.TrimSpace(ps)
		if points[i], err = WKTToPoint(ps, srid, order); err != nil {
			return types.LineString{}, sql.ErrInvalidGISData.New()
		}
	}

	// Create LineString object
	return types.LineString{SRID: srid, Points: points}, nil
}

// WKTToPoly Expects a string like "(1 2, 3 4), (5 6, 7 8), ..."
func WKTToPoly(s string, srid uint32, order bool) (types.Polygon, error) {
	var lines []types.LineString
	for {
		// Get first linestring
		lineStr, end, err := TrimWKTData(s)
		if err != nil {
			return types.Polygon{}, err
		}

		// Parse line
		line, err := WKTToLine(lineStr, srid, order)
		if err != nil {
			return types.Polygon{}, sql.ErrInvalidGISData.New()
		}
		if !isLinearRing(line) {
			return types.Polygon{}, sql.ErrInvalidGISData.New()
		}
		lines = append(lines, line)

		// Prepare next string
		s = s[end:]
		s = strings.TrimSpace(s)

		// Reached end
		if len(s) == 0 {
			break
		}

		// LineStrings must be comma-separated
		if s[0] != ',' {
			return types.Polygon{}, sql.ErrInvalidGISData.New()
		}

		// Drop leading comma
		s = s[1:]
		s = strings.TrimSpace(s)
	}

	return types.Polygon{SRID: srid, Lines: lines}, nil
}

// WKTToMPoint expects a string like "1.2 3.4, 5.6 7.8, ..."
func WKTToMPoint(s string, srid uint32, order bool) (types.MultiPoint, error) {
	if len(s) == 0 {
		return types.MultiPoint{}, sql.ErrInvalidGISData.New()
	}

	pointStrs := strings.Split(s, ",")
	var points = make([]types.Point, len(pointStrs))
	var err error
	for i, ps := range pointStrs {
		ps = strings.TrimSpace(ps)
		if points[i], err = WKTToPoint(ps, srid, order); err != nil {
			return types.MultiPoint{}, sql.ErrInvalidGISData.New()
		}
	}

	return types.MultiPoint{SRID: srid, Points: points}, nil
}

// WKTToMLine Expects a string like "(1 2, 3 4), (5 6, 7 8), ..."
func WKTToMLine(s string, srid uint32, order bool) (types.MultiLineString, error) {
	var lines []types.LineString
	for {
		// Get first linestring
		lineStr, end, err := TrimWKTData(s)
		if err != nil {
			return types.MultiLineString{}, err
		}

		// Parse line
		line, err := WKTToLine(lineStr, srid, order)
		if err != nil {
			return types.MultiLineString{}, sql.ErrInvalidGISData.New()
		}
		lines = append(lines, line)

		// Prepare next string
		s = s[end:]
		s = strings.TrimSpace(s)

		// Reached end
		if len(s) == 0 {
			break
		}

		// LineStrings must be comma-separated
		if s[0] != ',' {
			return types.MultiLineString{}, sql.ErrInvalidGISData.New()
		}

		// Drop leading comma
		s = s[1:]
		s = strings.TrimSpace(s)
	}

	return types.MultiLineString{SRID: srid, Lines: lines}, nil
}

// WKTToMPoly Expects a string like "((1 2, 3 4), (5 6, 7 8), ...), ..."
func WKTToMPoly(s string, srid uint32, order bool) (types.MultiPolygon, error) {
	var polys []types.Polygon
	for {
		// Get first polygon
		polyStr, end, err := TrimWKTData(s)
		if err != nil {
			return types.MultiPolygon{}, err
		}

		// Parse poly
		poly, err := WKTToPoly(polyStr, srid, order)
		if err != nil {
			return types.MultiPolygon{}, sql.ErrInvalidGISData.New()
		}
		polys = append(polys, poly)

		// Prepare next string
		s = s[end:]
		s = strings.TrimSpace(s)

		// Reached end
		if len(s) == 0 {
			break
		}

		// Polygons must be comma-separated
		if s[0] != ',' {
			return types.MultiPolygon{}, sql.ErrInvalidGISData.New()
		}

		// Drop leading comma
		s = s[1:]
		s = strings.TrimSpace(s)
	}

	return types.MultiPolygon{SRID: srid, Polygons: polys}, nil
}

// WKTToGeomColl Expects a string like "((1 2, 3 4), (5 6, 7 8), ...), ..."
func WKTToGeomColl(s string, srid uint32, order bool) (types.GeomColl, error) {
	// empty geometry collections
	if len(s) == 0 {
		return types.GeomColl{SRID: srid, Geoms: []types.GeometryValue{}}, nil
	}

	var geoms []types.GeometryValue
	for {
		// parse first type
		geomType, data, end, err := ParseWKTHeader(s)
		if err != nil {
			return types.GeomColl{}, sql.ErrInvalidGISData.New()
		}
		var geom types.GeometryValue
		switch geomType {
		case "point":
			geom, err = WKTToPoint(data, srid, order)
		case "linestring":
			geom, err = WKTToLine(data, srid, order)
		case "polygon":
			geom, err = WKTToPoly(data, srid, order)
		case "multipoint":
			geom, err = WKTToMPoint(data, srid, order)
		case "multilinestring":
			geom, err = WKTToMLine(data, srid, order)
		case "multipolygon":
			geom, err = WKTToMPoly(data, srid, order)
		case "geometrycollection":
			geom, err = WKTToGeomColl(data, srid, order)
		default:
			return types.GeomColl{}, sql.ErrInvalidGISData.New()
		}
		geoms = append(geoms, geom)

		// Prepare next string
		s = s[end:]
		s = strings.TrimSpace(s)

		// Reached end
		if len(s) == 0 {
			break
		}

		// Geometries must be comma-separated
		if s[0] != ',' {
			return types.GeomColl{}, sql.ErrInvalidGISData.New()
		}

		// Drop leading comma
		s = s[1:]
		s = strings.TrimSpace(s)
	}

	return types.GeomColl{SRID: srid, Geoms: geoms}, nil
}

// WKTToGeom expects a string in WKT format, and converts it to a geometry type
func WKTToGeom(ctx *sql.Context, row sql.Row, exprs []sql.Expression, expectedGeomType string) (types.GeometryValue, error) {
	val, err := exprs[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	s, ok := val.(string)
	if !ok {
		return nil, sql.ErrInvalidGISData.New()
	}

	s = strings.TrimSpace(s)
	geomType, data, end, err := ParseWKTHeader(s)
	if err != nil || end != len(s) { // detect extra characters
		return nil, err
	}

	if expectedGeomType != "" && geomType != expectedGeomType {
		return nil, sql.ErrInvalidGISData.New()
	}

	srid := uint32(0)
	if len(exprs) >= 2 {
		s, err := exprs[1].Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		if s == nil {
			return nil, nil
		}
		s, _, err = types.Int64.Convert(ctx, s)
		if err != nil {
			return nil, err
		}
		if err = types.ValidateSRID(int(s.(int64)), "st_geomfromtext"); err != nil {
			return nil, err
		}
		srid = uint32(s.(int64))
	}

	order := srid == types.GeoSpatialSRID
	if len(exprs) == 3 {
		o, err := exprs[2].Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		if o == nil {
			return nil, nil
		}
		order, err = ParseAxisOrder(o.(string))
		if err != nil {
			return nil, err
		}
	}

	switch geomType {
	case "point":
		return WKTToPoint(data, srid, order)
	case "linestring":
		return WKTToLine(data, srid, order)
	case "polygon":
		return WKTToPoly(data, srid, order)
	case "multipoint":
		return WKTToMPoint(data, srid, order)
	case "multilinestring":
		return WKTToMLine(data, srid, order)
	case "multipolygon":
		return WKTToMPoly(data, srid, order)
	case "geometrycollection":
		return WKTToGeomColl(data, srid, order)
	default:
		return nil, sql.ErrInvalidGISData.New()
	}
}

// Eval implements the sql.Expression interface.
func (g *GeomFromText) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	geom, err := WKTToGeom(ctx, row, g.ChildExpressions, "")
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(g.FunctionName())
	}
	return geom, err
}

// PointFromText is a function that returns a Point type from a WKT string
type PointFromText struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*PointFromText)(nil)
var _ sql.CollationCoercible = (*PointFromText)(nil)

// NewPointFromText creates a new point expression.
func NewPointFromText(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_POINTFROMTEXT", "1, 2, or 3", len(args))
	}
	return &PointFromText{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *PointFromText) FunctionName() string {
	return "st_pointfromtext"
}

// Description implements sql.FunctionExpression
func (p *PointFromText) Description() string {
	return "returns a new point from a WKT string."
}

// Type implements the sql.Expression interface.
func (p *PointFromText) Type() sql.Type {
	return types.PointType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*PointFromText) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (p *PointFromText) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *PointFromText) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewPointFromText(children...)
}

// Eval implements the sql.Expression interface.
func (p *PointFromText) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	point, err := WKTToGeom(ctx, row, p.ChildExpressions, "point")
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(p.FunctionName())
	}
	return point, err
}

// LineFromText is a function that returns a LineString type from a WKT string
type LineFromText struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*LineFromText)(nil)
var _ sql.CollationCoercible = (*LineFromText)(nil)

// NewLineFromText creates a new point expression.
func NewLineFromText(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_LINEFROMTEXT", "1 or 2", len(args))
	}
	return &LineFromText{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (l *LineFromText) FunctionName() string {
	return "st_linefromtext"
}

// Description implements sql.FunctionExpression
func (l *LineFromText) Description() string {
	return "returns a new line from a WKT string."
}

// Type implements the sql.Expression interface.
func (l *LineFromText) Type() sql.Type {
	return types.LineStringType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*LineFromText) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (l *LineFromText) String() string {
	var args = make([]string, len(l.ChildExpressions))
	for i, arg := range l.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", l.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (l *LineFromText) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewLineFromText(children...)
}

// Eval implements the sql.Expression interface.
func (l *LineFromText) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	line, err := WKTToGeom(ctx, row, l.ChildExpressions, "linestring")
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(l.FunctionName())
	}
	return line, err
}

// PolyFromText is a function that returns a Polygon type from a WKT string
type PolyFromText struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*PolyFromText)(nil)
var _ sql.CollationCoercible = (*PolyFromText)(nil)

// NewPolyFromText creates a new polygon expression.
func NewPolyFromText(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_POLYFROMTEXT", "1, 2, or 3", len(args))
	}
	return &PolyFromText{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *PolyFromText) FunctionName() string {
	return "st_polyfromtext"
}

// Description implements sql.FunctionExpression
func (p *PolyFromText) Description() string {
	return "returns a new polygon from a WKT string."
}

// Type implements the sql.Expression interface.
func (p *PolyFromText) Type() sql.Type {
	return types.PolygonType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*PolyFromText) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (p *PolyFromText) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *PolyFromText) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewPolyFromText(children...)
}

// Eval implements the sql.Expression interface.
func (p *PolyFromText) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	poly, err := WKTToGeom(ctx, row, p.ChildExpressions, "polygon")
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(p.FunctionName())
	}
	return poly, err
}

// MultiPoint is a function that returns a MultiPoint type from a WKT string
type MPointFromText struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*MPointFromText)(nil)
var _ sql.CollationCoercible = (*MPointFromText)(nil)

// NewMPointFromText creates a new MultiPoint expression.
func NewMPointFromText(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_MULTIPOINTFROMTEXT", "1 or 2", len(args))
	}
	return &MPointFromText{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *MPointFromText) FunctionName() string {
	return "st_mpointfromtext"
}

// Description implements sql.FunctionExpression
func (p *MPointFromText) Description() string {
	return "returns a new multipoint from a WKT string."
}

// Type implements the sql.Expression interface.
func (p *MPointFromText) Type() sql.Type {
	return types.MultiPointType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*MPointFromText) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (p *MPointFromText) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *MPointFromText) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewMPointFromText(children...)
}

// Eval implements the sql.Expression interface.
func (p *MPointFromText) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	line, err := WKTToGeom(ctx, row, p.ChildExpressions, "multipoint")
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(p.FunctionName())
	}
	return line, err
}

// MLineFromText is a function that returns a MultiLineString type from a WKT string
type MLineFromText struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*MLineFromText)(nil)
var _ sql.CollationCoercible = (*MLineFromText)(nil)

// NewMLineFromText creates a new multilinestring expression.
func NewMLineFromText(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_MLINEFROMTEXT", "1 or 2", len(args))
	}
	return &MLineFromText{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (l *MLineFromText) FunctionName() string {
	return "st_mlinefromtext"
}

// Description implements sql.FunctionExpression
func (l *MLineFromText) Description() string {
	return "returns a new multi line from a WKT string."
}

// Type implements the sql.Expression interface.
func (l *MLineFromText) Type() sql.Type {
	return types.MultiLineStringType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*MLineFromText) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (l *MLineFromText) String() string {
	var args = make([]string, len(l.ChildExpressions))
	for i, arg := range l.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", l.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (l *MLineFromText) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewMLineFromText(children...)
}

// Eval implements the sql.Expression interface.
func (l *MLineFromText) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	mline, err := WKTToGeom(ctx, row, l.ChildExpressions, "multilinestring")
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(l.FunctionName())
	}
	return mline, err
}

// MPolyFromText is a function that returns a MultiPolygon type from a WKT string
type MPolyFromText struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*MPolyFromText)(nil)
var _ sql.CollationCoercible = (*MPolyFromText)(nil)

// NewMPolyFromText creates a new multilinestring expression.
func NewMPolyFromText(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_MPOLYFROMTEXT", "1 or 2", len(args))
	}
	return &MPolyFromText{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *MPolyFromText) FunctionName() string {
	return "st_mpolyfromtext"
}

// Description implements sql.FunctionExpression
func (p *MPolyFromText) Description() string {
	return "returns a new multipolygon from a WKT string."
}

// Type implements the sql.Expression interface.
func (p *MPolyFromText) Type() sql.Type {
	return types.MultiPolygonType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*MPolyFromText) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (p *MPolyFromText) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *MPolyFromText) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewMPolyFromText(children...)
}

// Eval implements the sql.Expression interface.
func (p *MPolyFromText) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	mpoly, err := WKTToGeom(ctx, row, p.ChildExpressions, "multipolygon")
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(p.FunctionName())
	}
	return mpoly, err
}

// GeomCollFromText is a function that returns a MultiPolygon type from a WKT string
type GeomCollFromText struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*GeomCollFromText)(nil)
var _ sql.CollationCoercible = (*GeomCollFromText)(nil)

// NewGeomCollFromText creates a new multilinestring expression.
func NewGeomCollFromText(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_GeomCollFromText", "1 or 2", len(args))
	}
	return &MPolyFromText{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *GeomCollFromText) FunctionName() string {
	return "st_geomcollfromtext"
}

// Description implements sql.FunctionExpression
func (p *GeomCollFromText) Description() string {
	return "returns a new geometry collection from a WKT string."
}

// Type implements the sql.Expression interface.
func (p *GeomCollFromText) Type() sql.Type {
	return types.GeomCollType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*GeomCollFromText) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (p *GeomCollFromText) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *GeomCollFromText) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewGeomFromText(children...)
}

// Eval implements the sql.Expression interface.
func (p *GeomCollFromText) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	geom, err := WKTToGeom(ctx, row, p.ChildExpressions, "geometrycollection")
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(p.FunctionName())
	}
	return geom, err
}
