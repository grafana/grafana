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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// AsWKB is a function that converts a spatial type into WKB format (alias for AsBinary)
type AsWKB struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*AsWKB)(nil)
var _ sql.CollationCoercible = (*AsWKB)(nil)

// NewAsWKB creates a new point expression.
func NewAsWKB(e sql.Expression) sql.Expression {
	return &AsWKB{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (a *AsWKB) FunctionName() string {
	return "st_aswkb"
}

// Description implements sql.FunctionExpression
func (a *AsWKB) Description() string {
	return "returns binary representation of given spatial type."
}

// IsNullable implements the sql.Expression interface.
func (a *AsWKB) IsNullable() bool {
	return a.Child.IsNullable()
}

// Type implements the sql.Expression interface.
func (a *AsWKB) Type() sql.Type {
	return types.LongBlob
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*AsWKB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (a *AsWKB) String() string {
	return fmt.Sprintf("%s(%s)", a.FunctionName(), a.Child.String())
}

// WithChildren implements the Expression interface.
func (a *AsWKB) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(children), 1)
	}
	return NewAsWKB(children[0]), nil
}

// Eval implements the sql.Expression interface.
func (a *AsWKB) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := a.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	switch v := val.(type) {
	case types.GeometryValue:
		if v.GetSRID() == types.GeoSpatialSRID {
			v = v.Swap()
		}
		return v.Serialize()[types.SRIDSize:], nil
	default:
		return nil, sql.ErrInvalidGISData.New(a.FunctionName())
	}
}

// GeomFromWKB is a function that returns a geometry type from a WKB byte array
type GeomFromWKB struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*GeomFromWKB)(nil)
var _ sql.CollationCoercible = (*GeomFromWKB)(nil)

// NewGeomFromWKB creates a new geometry expression.
func NewGeomFromWKB(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_GEOMFROMWKB", "1, 2, or 3", len(args))
	}
	return &GeomFromWKB{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (g *GeomFromWKB) FunctionName() string {
	return "st_geomfromwkb"
}

// Description implements sql.FunctionExpression
func (g *GeomFromWKB) Description() string {
	return "returns a new geometry from a WKB string."
}

// Type implements the sql.Expression interface.
func (g *GeomFromWKB) Type() sql.Type {
	return types.PointType{} // TODO: replace with generic geometry type
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*GeomFromWKB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (g *GeomFromWKB) String() string {
	var args = make([]string, len(g.ChildExpressions))
	for i, arg := range g.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", g.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (g *GeomFromWKB) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewGeomFromWKB(children...)
}

// ParseAxisOrder takes in a key, value string and determines the order of the xy coords
func ParseAxisOrder(s string) (bool, error) {
	s = strings.ToLower(s)
	s = strings.TrimSpace(s)
	switch s {
	case "axis-order=long-lat":
		return true, nil
	case "axis-order=lat-long", "axis-order=srid-defined":
		return false, nil
	default:
		return false, sql.ErrInvalidArgument.New()
	}
}

// EvalGeomFromWKB takes in arguments for the ST_FROMWKB functions, and parses them to their corresponding geometry type
func EvalGeomFromWKB(ctx *sql.Context, row sql.Row, exprs []sql.Expression, expectedGeomType int) (interface{}, error) {
	val, err := exprs[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	buf, ok := val.([]byte)
	if !ok {
		return nil, sql.ErrInvalidGISData.New()
	}

	isBig, geomType, err := types.DeserializeWKBHeader(buf)
	if err != nil {
		return nil, err
	}
	buf = buf[types.WKBHeaderSize:]

	if expectedGeomType != types.WKBUnknown && int(geomType) != expectedGeomType {
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
		if err = types.ValidateSRID(int(s.(int64)), "st_geomfromwkb"); err != nil {
			return nil, err
		}
		srid = uint32(s.(int64))
	}

	var geom types.GeometryValue
	switch geomType {
	case types.WKBPointID:
		geom, _, err = types.DeserializePoint(buf, isBig, srid)
	case types.WKBLineID:
		geom, _, err = types.DeserializeLine(buf, isBig, srid)
	case types.WKBPolyID:
		geom, _, err = types.DeserializePoly(buf, isBig, srid)
	case types.WKBMultiPointID:
		geom, _, err = types.DeserializeMPoint(buf, isBig, srid)
	case types.WKBMultiLineID:
		geom, _, err = types.DeserializeMLine(buf, isBig, srid)
	case types.WKBMultiPolyID:
		geom, _, err = types.DeserializeMPoly(buf, isBig, srid)
	case types.WKBGeomCollID:
		geom, _, err = types.DeserializeGeomColl(buf, isBig, srid)
	default:
		return nil, sql.ErrInvalidGISData.New()
	}
	if err != nil {
		return nil, err
	}

	order := false
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
			return nil, sql.ErrInvalidArgument.New()
		}
	}
	if order {
		geom = geom.Swap()
	}

	return geom, nil
}

// Eval implements the sql.Expression interface.
func (g *GeomFromWKB) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	geom, err := EvalGeomFromWKB(ctx, row, g.ChildExpressions, types.WKBUnknown)
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(g.FunctionName())
	}
	return geom, err
}

// PointFromWKB is a function that returns a point type from a WKB byte array
type PointFromWKB struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*PointFromWKB)(nil)
var _ sql.CollationCoercible = (*PointFromWKB)(nil)

// NewPointFromWKB creates a new point expression.
func NewPointFromWKB(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_POINTFROMWKB", "1, 2, or 3", len(args))
	}
	return &PointFromWKB{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *PointFromWKB) FunctionName() string {
	return "st_pointfromwkb"
}

// Description implements sql.FunctionExpression
func (p *PointFromWKB) Description() string {
	return "returns a new point from WKB format."
}

// Type implements the sql.Expression interface.
func (p *PointFromWKB) Type() sql.Type {
	return types.PointType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*PointFromWKB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (p *PointFromWKB) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *PointFromWKB) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewPointFromWKB(children...)
}

// Eval implements the sql.Expression interface.
func (p *PointFromWKB) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	point, err := EvalGeomFromWKB(ctx, row, p.ChildExpressions, types.WKBPointID)
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(p.FunctionName())
	}
	return point, err
}

// LineFromWKB is a function that returns a linestring type from a WKB byte array
type LineFromWKB struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*LineFromWKB)(nil)
var _ sql.CollationCoercible = (*LineFromWKB)(nil)

// NewLineFromWKB creates a new point expression.
func NewLineFromWKB(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_LINEFROMWKB", "1 or 2", len(args))
	}
	return &LineFromWKB{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (l *LineFromWKB) FunctionName() string {
	return "st_linefromwkb"
}

// Description implements sql.FunctionExpression
func (l *LineFromWKB) Description() string {
	return "returns a new linestring from WKB format."
}

// Type implements the sql.Expression interface.
func (l *LineFromWKB) Type() sql.Type {
	return types.LineStringType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*LineFromWKB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (l *LineFromWKB) String() string {
	var args = make([]string, len(l.ChildExpressions))
	for i, arg := range l.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", l.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (l *LineFromWKB) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewLineFromWKB(children...)
}

// Eval implements the sql.Expression interface.
func (l *LineFromWKB) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	line, err := EvalGeomFromWKB(ctx, row, l.ChildExpressions, types.WKBLineID)
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(l.FunctionName())
	}
	return line, err
}

// PolyFromWKB is a function that returns a polygon type from a WKB byte array
type PolyFromWKB struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*PolyFromWKB)(nil)
var _ sql.CollationCoercible = (*PolyFromWKB)(nil)

// NewPolyFromWKB creates a new point expression.
func NewPolyFromWKB(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_POLYFROMWKB", "1, 2, or 3", len(args))
	}
	return &PolyFromWKB{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *PolyFromWKB) FunctionName() string {
	return "st_polyfromwkb"
}

// Description implements sql.FunctionExpression
func (p *PolyFromWKB) Description() string {
	return "returns a new polygon from WKB format."
}

// Type implements the sql.Expression interface.
func (p *PolyFromWKB) Type() sql.Type {
	return types.PolygonType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*PolyFromWKB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (p *PolyFromWKB) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *PolyFromWKB) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewPolyFromWKB(children...)
}

// Eval implements the sql.Expression interface.
func (p *PolyFromWKB) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	poly, err := EvalGeomFromWKB(ctx, row, p.ChildExpressions, types.WKBPolyID)
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(p.FunctionName())
	}
	return poly, err
}

// MPointFromWKB is a function that returns a linestring type from a WKB byte array
type MPointFromWKB struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*MPointFromWKB)(nil)
var _ sql.CollationCoercible = (*MPointFromWKB)(nil)

// NewMPointFromWKB creates a new point expression.
func NewMPointFromWKB(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_MPOINTFROMWKB", "1 or 2", len(args))
	}
	return &MPointFromWKB{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *MPointFromWKB) FunctionName() string {
	return "st_mpointfromwkb"
}

// Description implements sql.FunctionExpression
func (p *MPointFromWKB) Description() string {
	return "returns a new multipoint from WKB format."
}

// Type implements the sql.Expression interface.
func (p *MPointFromWKB) Type() sql.Type {
	return types.MultiPointType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*MPointFromWKB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (p *MPointFromWKB) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *MPointFromWKB) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewMPointFromWKB(children...)
}

// Eval implements the sql.Expression interface.
func (p *MPointFromWKB) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	mPoint, err := EvalGeomFromWKB(ctx, row, p.ChildExpressions, types.WKBMultiPointID)
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(p.FunctionName())
	}
	return mPoint, err
}

// MLineFromWKB is a function that returns a polygon type from a WKB byte array
type MLineFromWKB struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*MLineFromWKB)(nil)
var _ sql.CollationCoercible = (*MLineFromWKB)(nil)

// NewMLineFromWKB creates a new point expression.
func NewMLineFromWKB(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_MLINEFROMWKB", "1, 2, or 3", len(args))
	}
	return &MLineFromWKB{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (l *MLineFromWKB) FunctionName() string {
	return "st_mlinefromwkb"
}

// Description implements sql.FunctionExpression
func (l *MLineFromWKB) Description() string {
	return "returns a new polygon from WKB format."
}

// Type implements the sql.Expression interface.
func (l *MLineFromWKB) Type() sql.Type {
	return types.PolygonType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*MLineFromWKB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (l *MLineFromWKB) String() string {
	var args = make([]string, len(l.ChildExpressions))
	for i, arg := range l.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", l.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (l *MLineFromWKB) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewMLineFromWKB(children...)
}

// Eval implements the sql.Expression interface.
func (l *MLineFromWKB) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	mline, err := EvalGeomFromWKB(ctx, row, l.ChildExpressions, types.WKBMultiLineID)
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(l.FunctionName())
	}
	return mline, err
}

// MPolyFromWKB is a function that returns a polygon type from a WKB byte array
type MPolyFromWKB struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*MPolyFromWKB)(nil)
var _ sql.CollationCoercible = (*MPolyFromWKB)(nil)

// NewMPolyFromWKB creates a new multipolygon expression.
func NewMPolyFromWKB(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_MPOLYFROMWKB", "1, 2, or 3", len(args))
	}
	return &MPolyFromWKB{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *MPolyFromWKB) FunctionName() string {
	return "st_mpolyfromwkb"
}

// Description implements sql.FunctionExpression
func (p *MPolyFromWKB) Description() string {
	return "returns a new multipolygon from WKB format."
}

// Type implements the sql.Expression interface.
func (p *MPolyFromWKB) Type() sql.Type {
	return types.MultiPolygonType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*MPolyFromWKB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (p *MPolyFromWKB) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *MPolyFromWKB) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewMPolyFromWKB(children...)
}

// Eval implements the sql.Expression interface.
func (p *MPolyFromWKB) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	mpoly, err := EvalGeomFromWKB(ctx, row, p.ChildExpressions, types.WKBPolyID)
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(p.FunctionName())
	}
	return mpoly, err
}

// GeomCollFromWKB is a function that returns a polygon type from a WKB byte array
type GeomCollFromWKB struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*GeomCollFromWKB)(nil)
var _ sql.CollationCoercible = (*GeomCollFromWKB)(nil)

// NewGeomCollFromWKB creates a new geometrycollection expression.
func NewGeomCollFromWKB(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 || len(args) > 3 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_GEOMCOLLFROMWKB", "1, 2, or 3", len(args))
	}
	return &MPolyFromWKB{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (g *GeomCollFromWKB) FunctionName() string {
	return "st_geomcollfromwkb"
}

// Description implements sql.FunctionExpression
func (g *GeomCollFromWKB) Description() string {
	return "returns a new geometrycollection from WKB format."
}

// Type implements the sql.Expression interface.
func (g *GeomCollFromWKB) Type() sql.Type {
	return types.GeomCollType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*GeomCollFromWKB) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (g *GeomCollFromWKB) String() string {
	var args = make([]string, len(g.ChildExpressions))
	for i, arg := range g.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", g.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (g *GeomCollFromWKB) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewGeomCollFromWKB(children...)
}

// Eval implements the sql.Expression interface.
func (g *GeomCollFromWKB) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	geom, err := EvalGeomFromWKB(ctx, row, g.ChildExpressions, types.WKBGeomCollID)
	if sql.ErrInvalidGISData.Is(err) {
		return nil, sql.ErrInvalidGISData.New(g.FunctionName())
	}
	return geom, err
}
