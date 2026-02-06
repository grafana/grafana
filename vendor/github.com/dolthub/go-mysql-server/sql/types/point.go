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
	"encoding/binary"
	"math"
	"reflect"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"

	"github.com/dolthub/go-mysql-server/sql"
)

// PointType represents the POINT type.
// https://dev.mysql.com/doc/refman/8.0/en/gis-class-point.html
// The type of the returned value is Point.
type PointType struct {
	SRID        uint32
	DefinedSRID bool
}

// Point is the value type returned from PointType. Implements GeometryValue.
type Point struct {
	SRID uint32
	X    float64
	Y    float64
}

var _ sql.Type = PointType{}
var _ sql.SpatialColumnType = PointType{}
var _ sql.CollationCoercible = PointType{}
var _ GeometryValue = Point{}

var (
	pointValueType = reflect.TypeOf(Point{})
)

// Compare implements Type interface.
func (t PointType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	return GeometryType{}.Compare(ctx, a, b)
}

// Convert implements Type interface.
func (t PointType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	// Allow null
	if v == nil {
		return nil, sql.InRange, nil
	}
	// Handle conversions
	switch val := v.(type) {
	case []byte:
		// Parse header
		srid, isBig, geomType, err := DeserializeEWKBHeader(val)
		if err != nil {
			return nil, sql.OutOfRange, err
		}
		// Throw error if not marked as point
		if geomType != WKBPointID {
			return nil, sql.OutOfRange, sql.ErrInvalidGISData.New("PointType.Convert")
		}
		// Parse data section
		point, _, err := DeserializePoint(val[EWKBHeaderSize:], isBig, srid)
		if err != nil {
			return nil, sql.OutOfRange, err
		}
		return point, sql.InRange, nil
	case string:
		return t.Convert(ctx, []byte(val))
	case Point:
		if err := t.MatchSRID(val); err != nil {
			return nil, sql.OutOfRange, err
		}
		return val, sql.InRange, nil
	default:
		return nil, sql.OutOfRange, sql.ErrSpatialTypeConversion.New()
	}
}

// Equals implements the Type interface.
func (t PointType) Equals(otherType sql.Type) bool {
	_, ok := otherType.(PointType)
	return ok
}

// MaxTextResponseByteLength implements the Type interface
func (t PointType) MaxTextResponseByteLength(*sql.Context) uint32 {
	return GeometryMaxByteLength
}

// Promote implements the Type interface.
func (t PointType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t PointType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, nil
	}

	buf := v.(Point).Serialize()

	return sqltypes.MakeTrusted(sqltypes.Geometry, buf), nil
}

// String implements Type interface.
func (t PointType) String() string {
	return "point"
}

// Type implements Type interface.
func (t PointType) Type() query.Type {
	return sqltypes.Geometry
}

// Zero implements Type interface.
func (t PointType) Zero() interface{} {
	return Point{X: 0.0, Y: 0.0}
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (PointType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// ValueType implements Type interface.
func (t PointType) ValueType() reflect.Type {
	return pointValueType
}

// GetSpatialTypeSRID implements SpatialColumnType interface.
func (t PointType) GetSpatialTypeSRID() (uint32, bool) {
	return t.SRID, t.DefinedSRID
}

// SetSRID implements SpatialColumnType interface.
func (t PointType) SetSRID(v uint32) sql.Type {
	t.SRID = v
	t.DefinedSRID = true
	return t
}

// MatchSRID implements SpatialColumnType interface
func (t PointType) MatchSRID(v interface{}) error {
	val, ok := v.(Point)
	if !ok {
		return sql.ErrNotPoint.New(v)
	}
	if !t.DefinedSRID {
		return nil
	} else if t.SRID == val.SRID {
		return nil
	}
	return sql.ErrNotMatchingSRID.New(val.SRID, t.SRID)
}

// implementsGeometryValue implements GeometryValue interface.
func (p Point) implementsGeometryValue() {}

// GetSRID implements GeometryValue interface.
func (p Point) GetSRID() uint32 {
	return p.SRID
}

// SetSRID implements GeometryValue interface.
func (p Point) SetSRID(srid uint32) GeometryValue {
	return Point{
		SRID: srid,
		X:    p.X,
		Y:    p.Y,
	}
}

// Serialize implements GeometryValue interface.
func (p Point) Serialize() (buf []byte) {
	buf = AllocateGeoTypeBuffer(1, 0, 0)
	WriteEWKBHeader(buf, p.SRID, WKBPointID)
	p.WriteData(buf[EWKBHeaderSize:])
	return
}

// WriteData implements GeometryValue interface.
func (p Point) WriteData(buf []byte) int {
	binary.LittleEndian.PutUint64(buf, math.Float64bits(p.X))
	buf = buf[PointSize/2:]
	binary.LittleEndian.PutUint64(buf, math.Float64bits(p.Y))
	return PointSize
}

// Swap implements GeometryValue interface.
// TODO: possible in place?
func (p Point) Swap() GeometryValue {
	return Point{
		SRID: p.SRID,
		X:    p.Y,
		Y:    p.X,
	}
}

// BBox implements GeometryValue interface.
func (p Point) BBox() (float64, float64, float64, float64) {
	return p.X, p.Y, p.X, p.Y
}
