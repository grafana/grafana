// Copyright 2022 Dolthub, Inc.
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

package types

import (
	"context"
	"math"
	"reflect"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

// PolygonType represents the POLYGON type.
// https://dev.mysql.com/doc/refman/8.0/en/gis-class-polygon.html
// The type of the returned value is Polygon.
type PolygonType struct {
	SRID        uint32
	DefinedSRID bool
}

// Polygon is the value type returned from PolygonType. Implements GeometryValue.
type Polygon struct {
	Lines []LineString
	SRID  uint32
}

var _ sql.Type = PolygonType{}
var _ sql.SpatialColumnType = PolygonType{}
var _ sql.CollationCoercible = PolygonType{}
var _ GeometryValue = Polygon{}

var (
	ErrNotPolygon = errors.NewKind("value of type %T is not a polygon")

	polygonValueType = reflect.TypeOf(Polygon{})
)

// Compare implements Type interface.
func (t PolygonType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	return GeometryType{}.Compare(ctx, a, b)
}

// Convert implements Type interface.
func (t PolygonType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	switch buf := v.(type) {
	case nil:
		return nil, sql.InRange, nil
	case []byte:
		poly, _, err := GeometryType{}.Convert(ctx, buf)
		if sql.ErrInvalidGISData.Is(err) {
			return nil, sql.OutOfRange, sql.ErrInvalidGISData.New("PolygonType.Convert")
		} else if err != nil {
			return poly, sql.OutOfRange, err
		}
		return poly, sql.InRange, nil
	case string:
		return t.Convert(ctx, []byte(buf))
	case Polygon:
		if err := t.MatchSRID(buf); err != nil {
			return nil, sql.OutOfRange, err
		}
		return buf, sql.InRange, nil
	default:
		return nil, sql.OutOfRange, sql.ErrSpatialTypeConversion.New()
	}
}

// Equals implements the Type interface.
func (t PolygonType) Equals(otherType sql.Type) bool {
	_, ok := otherType.(PolygonType)
	return ok
}

// MaxTextResponseByteLength implements the Type interface
func (t PolygonType) MaxTextResponseByteLength(*sql.Context) uint32 {
	return GeometryMaxByteLength
}

// Promote implements the Type interface.
func (t PolygonType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t PolygonType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, nil
	}

	buf := v.(Polygon).Serialize()

	return sqltypes.MakeTrusted(sqltypes.Geometry, buf), nil
}

// String implements Type interface.
func (t PolygonType) String() string {
	return "polygon"
}

// Type implements Type interface.
func (t PolygonType) Type() query.Type {
	return sqltypes.Geometry
}

// ValueType implements Type interface.
func (t PolygonType) ValueType() reflect.Type {
	return polygonValueType
}

// Zero implements Type interface.
func (t PolygonType) Zero() interface{} {
	return Polygon{Lines: []LineString{{Points: []Point{{}, {}, {}, {}}}}}
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (PolygonType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// GetSpatialTypeSRID implements SpatialColumnType interface.
func (t PolygonType) GetSpatialTypeSRID() (uint32, bool) {
	return t.SRID, t.DefinedSRID
}

// SetSRID implements SpatialColumnType interface.
func (t PolygonType) SetSRID(v uint32) sql.Type {
	t.SRID = v
	t.DefinedSRID = true
	return t
}

// MatchSRID implements SpatialColumnType interface
func (t PolygonType) MatchSRID(v interface{}) error {
	val, ok := v.(Polygon)
	if !ok {
		return ErrNotPolygon.New(v)
	}
	if !t.DefinedSRID {
		return nil
	} else if t.SRID == val.SRID {
		return nil
	}
	return sql.ErrNotMatchingSRID.New(val.SRID, t.SRID)
}

// implementsGeometryValue implements GeometryValue interface.
func (p Polygon) implementsGeometryValue() {}

// GetSRID implements GeometryValue interface.
func (p Polygon) GetSRID() uint32 {
	return p.SRID
}

// SetSRID implements GeometryValue interface.
func (p Polygon) SetSRID(srid uint32) GeometryValue {
	lines := make([]LineString, len(p.Lines))
	for i, l := range p.Lines {
		lines[i] = l.SetSRID(srid).(LineString)
	}
	return Polygon{
		SRID:  srid,
		Lines: lines,
	}
}

// Serialize implements GeometryValue interface.
func (p Polygon) Serialize() (buf []byte) {
	var numPoints int
	for _, l := range p.Lines {
		numPoints += len(l.Points)
	}
	buf = AllocateGeoTypeBuffer(numPoints, len(p.Lines)+1, 0)
	WriteEWKBHeader(buf, p.SRID, WKBPolyID)
	p.WriteData(buf[EWKBHeaderSize:])
	return
}

// WriteData implements GeometryValue interface.
func (p Polygon) WriteData(buf []byte) int {
	WriteCount(buf, uint32(len(p.Lines)))
	buf = buf[CountSize:]
	count := CountSize
	for _, l := range p.Lines {
		c := l.WriteData(buf)
		buf = buf[c:]
		count += c
	}
	return count
}

// Swap implements GeometryValue interface.
// TODO: possible in place?
func (p Polygon) Swap() GeometryValue {
	lines := make([]LineString, len(p.Lines))
	for i, l := range p.Lines {
		lines[i] = l.Swap().(LineString)
	}
	return Polygon{
		SRID:  p.SRID,
		Lines: lines,
	}
}

// BBox implements GeometryValue interface.
func (p Polygon) BBox() (float64, float64, float64, float64) {
	minX, minY, maxX, maxY := math.MaxFloat64, math.MaxFloat64, -math.MaxFloat64, -math.MaxFloat64
	for _, l := range p.Lines {
		lMinX, lMinY, lMaxX, lMaxY := l.BBox()
		minX = math.Min(minX, lMinX)
		minY = math.Min(minY, lMinY)
		maxX = math.Max(maxX, lMaxX)
		maxY = math.Max(maxY, lMaxY)
	}
	return minX, minY, maxX, maxY
}
