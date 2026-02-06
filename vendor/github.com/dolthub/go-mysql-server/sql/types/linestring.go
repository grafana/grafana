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

	"github.com/dolthub/go-mysql-server/sql"
)

// LineStringType represents the LINESTRING type.
// https://dev.mysql.com/doc/refman/8.0/en/gis-class-linestring.html
// The type of the returned value is LineString.
type LineStringType struct {
	SRID        uint32
	DefinedSRID bool
}

// LineString is the value type returned from LineStringType. Implements GeometryValue.
type LineString struct {
	Points []Point
	SRID   uint32
}

var _ sql.Type = LineStringType{}
var _ sql.SpatialColumnType = LineStringType{}
var _ sql.CollationCoercible = LineStringType{}
var _ GeometryValue = LineString{}

var (
	lineStringValueType = reflect.TypeOf(LineString{})
)

// Compare implements Type interface.
func (t LineStringType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	return GeometryType{}.Compare(ctx, a, b)
}

// Convert implements Type interface.
func (t LineStringType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	switch buf := v.(type) {
	case nil:
		return nil, sql.InRange, nil
	case []byte:
		line, _, err := GeometryType{}.Convert(ctx, buf)
		if sql.ErrInvalidGISData.Is(err) {
			return nil, sql.OutOfRange, sql.ErrInvalidGISData.New("LineStringType.Convert")
		}
		return line, sql.InRange, err
	case string:
		return t.Convert(ctx, []byte(buf))
	case LineString:
		if err := t.MatchSRID(buf); err != nil {
			return nil, sql.OutOfRange, err
		}
		return buf, sql.InRange, nil
	default:
		return nil, sql.OutOfRange, sql.ErrSpatialTypeConversion.New()
	}
}

// Equals implements the Type interface.
func (t LineStringType) Equals(otherType sql.Type) bool {
	_, ok := otherType.(LineStringType)
	return ok
}

// MaxTextResponseByteLength implements the Type interface
func (t LineStringType) MaxTextResponseByteLength(*sql.Context) uint32 {
	return GeometryMaxByteLength
}

// Promote implements the Type interface.
func (t LineStringType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t LineStringType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, nil
	}

	buf := v.(LineString).Serialize()

	return sqltypes.MakeTrusted(sqltypes.Geometry, buf), nil
}

// String implements Type interface.
func (t LineStringType) String() string {
	return "linestring"
}

// Type implements Type interface.
func (t LineStringType) Type() query.Type {
	return sqltypes.Geometry
}

// ValueType implements Type interface.
func (t LineStringType) ValueType() reflect.Type {
	return lineStringValueType
}

// Zero implements Type interface.
func (t LineStringType) Zero() interface{} {
	return LineString{Points: []Point{{}, {}}}
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (LineStringType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// GetSpatialTypeSRID implements SpatialColumnType interface.
func (t LineStringType) GetSpatialTypeSRID() (uint32, bool) {
	return t.SRID, t.DefinedSRID
}

// SetSRID implements SpatialColumnType interface.
func (t LineStringType) SetSRID(v uint32) sql.Type {
	t.SRID = v
	t.DefinedSRID = true
	return t
}

// MatchSRID implements SpatialColumnType interface
func (t LineStringType) MatchSRID(v interface{}) error {
	val, ok := v.(LineString)
	if !ok {
		return sql.ErrNotLineString.New(v)
	}
	if !t.DefinedSRID {
		return nil
	} else if t.SRID == val.SRID {
		return nil
	}
	return sql.ErrNotMatchingSRID.New(val.SRID, t.SRID)
}

// implementsGeometryValue implements GeometryValue interface.
func (l LineString) implementsGeometryValue() {}

// GetSRID implements GeometryValue interface.
func (l LineString) GetSRID() uint32 {
	return l.SRID
}

// SetSRID implements GeometryValue interface.
func (l LineString) SetSRID(srid uint32) GeometryValue {
	points := make([]Point, len(l.Points))
	for i, p := range l.Points {
		points[i] = p.SetSRID(srid).(Point)
	}
	return LineString{
		SRID:   srid,
		Points: points,
	}
}

// Serialize implements GeometryValue interface.
func (l LineString) Serialize() (buf []byte) {
	buf = AllocateGeoTypeBuffer(len(l.Points), 1, 0)
	WriteEWKBHeader(buf, l.SRID, WKBLineID)
	l.WriteData(buf[EWKBHeaderSize:])
	return
}

// WriteData implements GeometryValue interface.
func (l LineString) WriteData(buf []byte) int {
	WriteCount(buf, uint32(len(l.Points)))
	buf = buf[CountSize:]
	for _, p := range l.Points {
		p.WriteData(buf)
		buf = buf[PointSize:]
	}
	return CountSize + PointSize*len(l.Points)
}

// Swap implements GeometryValue interface.
// TODO: possible in place?
func (l LineString) Swap() GeometryValue {
	points := make([]Point, len(l.Points))
	for i, p := range l.Points {
		points[i] = p.Swap().(Point)
	}
	return LineString{
		SRID:   l.SRID,
		Points: points,
	}
}

// BBox implements GeometryValue interface.
func (l LineString) BBox() (float64, float64, float64, float64) {
	minX, minY, maxX, maxY := math.MaxFloat64, math.MaxFloat64, -math.MaxFloat64, -math.MaxFloat64
	for _, p := range l.Points {
		minX = math.Min(minX, p.X)
		minY = math.Min(minY, p.Y)
		maxX = math.Max(maxX, p.X)
		maxY = math.Max(maxY, p.Y)
	}
	return minX, minY, maxX, maxY
}
