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

// MultiPolygonType represents the MULTIPOLYGON type.
// https://dev.mysql.com/doc/refman/8.0/en/gis-class-multipolygon.html
// The type of the returned value is MultiPolygon.
type MultiPolygonType struct {
	SRID        uint32
	DefinedSRID bool
}

// MultiPolygon is the value type returned from MultiPolygonType. Implements GeometryValue.
type MultiPolygon struct {
	Polygons []Polygon
	SRID     uint32
}

var (
	ErrNotMultiPolygon = errors.NewKind("value of type %T is not a multipolygon")

	multipolygonValueType = reflect.TypeOf(MultiPolygon{})
)

var _ sql.Type = MultiPolygonType{}
var _ sql.SpatialColumnType = MultiPolygonType{}
var _ sql.CollationCoercible = MultiPolygonType{}
var _ GeometryValue = MultiPolygon{}

// Compare implements Type interface.
func (t MultiPolygonType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	return GeometryType{}.Compare(ctx, a, b)
}

// Convert implements Type interface.
func (t MultiPolygonType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	switch buf := v.(type) {
	case nil:
		return nil, sql.InRange, nil
	case []byte:
		mpoly, _, err := GeometryType{}.Convert(ctx, buf)
		if sql.ErrInvalidGISData.Is(err) {
			return nil, sql.OutOfRange, sql.ErrInvalidGISData.New("MultiPolygon.Convert")
		}
		return mpoly, sql.OutOfRange, err
	case string:
		return t.Convert(ctx, []byte(buf))
	case MultiPolygon:
		if err := t.MatchSRID(buf); err != nil {
			return nil, sql.OutOfRange, err
		}
		return buf, sql.InRange, nil
	default:
		return nil, sql.OutOfRange, sql.ErrSpatialTypeConversion.New()
	}
}

// Equals implements the Type interface.
func (t MultiPolygonType) Equals(otherType sql.Type) bool {
	_, ok := otherType.(MultiPolygonType)
	return ok
}

// MaxTextResponseByteLength implements the Type interface
func (t MultiPolygonType) MaxTextResponseByteLength(*sql.Context) uint32 {
	return GeometryMaxByteLength
}

// Promote implements the Type interface.
func (t MultiPolygonType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t MultiPolygonType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, nil
	}

	buf := v.(MultiPolygon).Serialize()

	return sqltypes.MakeTrusted(sqltypes.Geometry, buf), nil
}

// String implements Type interface.
func (t MultiPolygonType) String() string {
	return "multipolygon"
}

// Type implements Type interface.
func (t MultiPolygonType) Type() query.Type {
	return sqltypes.Geometry
}

// ValueType implements Type interface.
func (t MultiPolygonType) ValueType() reflect.Type {
	return multipolygonValueType
}

// Zero implements Type interface.
func (t MultiPolygonType) Zero() interface{} {
	return MultiPolygon{Polygons: []Polygon{PolygonType{}.Zero().(Polygon)}}
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (MultiPolygonType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// GetSpatialTypeSRID implements SpatialColumnType interface.
func (t MultiPolygonType) GetSpatialTypeSRID() (uint32, bool) {
	return t.SRID, t.DefinedSRID
}

// SetSRID implements SpatialColumnType interface.
func (t MultiPolygonType) SetSRID(v uint32) sql.Type {
	t.SRID = v
	t.DefinedSRID = true
	return t
}

// MatchSRID implements SpatialColumnType interface
func (t MultiPolygonType) MatchSRID(v interface{}) error {
	val, ok := v.(MultiPolygon)
	if !ok {
		return ErrNotMultiPolygon.New(v)
	}
	if !t.DefinedSRID {
		return nil
	} else if t.SRID == val.SRID {
		return nil
	}
	return sql.ErrNotMatchingSRID.New(val.SRID, t.SRID)
}

// implementsGeometryValue implements GeometryValue interface.
func (p MultiPolygon) implementsGeometryValue() {}

// GetSRID implements GeometryValue interface.
func (p MultiPolygon) GetSRID() uint32 {
	return p.SRID
}

// SetSRID implements GeometryValue interface.
func (p MultiPolygon) SetSRID(srid uint32) GeometryValue {
	polygons := make([]Polygon, len(p.Polygons))
	for i, p := range p.Polygons {
		polygons[i] = p.SetSRID(srid).(Polygon)
	}
	return MultiPolygon{
		SRID:     srid,
		Polygons: polygons,
	}
}

// Serialize implements GeometryValue interface.
func (p MultiPolygon) Serialize() (buf []byte) {
	var numPoints, numCounts int
	numCounts += len(p.Polygons)
	for _, p := range p.Polygons {
		numCounts += len(p.Lines)
		for _, l := range p.Lines {
			numPoints += len(l.Points)
		}
	}
	buf = AllocateGeoTypeBuffer(numPoints, numCounts+1, len(p.Polygons))
	WriteEWKBHeader(buf, p.SRID, WKBMultiPolyID)
	p.WriteData(buf[EWKBHeaderSize:])
	return
}

// WriteData implements GeometryValue interface.
func (p MultiPolygon) WriteData(buf []byte) int {
	WriteCount(buf, uint32(len(p.Polygons)))
	buf = buf[CountSize:]
	count := CountSize
	for _, p := range p.Polygons {
		WriteWKBHeader(buf, WKBPolyID)
		buf = buf[WKBHeaderSize:]
		c := p.WriteData(buf)
		buf = buf[c:]
		count += WKBHeaderSize + c
	}
	return count
}

// Swap implements GeometryValue interface.
func (p MultiPolygon) Swap() GeometryValue {
	polys := make([]Polygon, len(p.Polygons))
	for i, p := range p.Polygons {
		polys[i] = p.Swap().(Polygon)
	}
	return MultiPolygon{
		SRID:     p.SRID,
		Polygons: polys,
	}
}

// BBox implements GeometryValue interface.
func (p MultiPolygon) BBox() (float64, float64, float64, float64) {
	minX, minY, maxX, maxY := math.MaxFloat64, math.MaxFloat64, -math.MaxFloat64, -math.MaxFloat64
	for _, p := range p.Polygons {
		pMinX, pMinY, pMaxX, pMaxY := p.BBox()
		minX = math.Min(minX, pMinX)
		minY = math.Min(minY, pMinY)
		maxX = math.Max(maxX, pMaxX)
		maxY = math.Max(maxY, pMaxY)
	}
	return minX, minY, maxX, maxY
}
