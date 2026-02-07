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

// MultiPointType represents the MULTIPOINT type.
// https://dev.mysql.com/doc/refman/8.0/en/gis-class-multipoint.html
// The type of the returned value is MultiPoint.
type MultiPointType struct {
	SRID        uint32
	DefinedSRID bool
}

// MultiPoint is the value type returned from MultiPointType. Implements GeometryValue.
type MultiPoint struct {
	Points []Point
	SRID   uint32
}

var _ sql.Type = MultiPointType{}
var _ sql.SpatialColumnType = MultiPointType{}
var _ sql.CollationCoercible = MultiPointType{}
var _ GeometryValue = MultiPoint{}

var (
	ErrNotMultiPoint = errors.NewKind("value of type %T is not a multipoint")

	multiPointValueType = reflect.TypeOf(MultiPoint{})
)

// Compare implements Type interface.
func (t MultiPointType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	return GeometryType{}.Compare(ctx, a, b)
}

// Convert implements Type interface.
func (t MultiPointType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	switch buf := v.(type) {
	case nil:
		return nil, sql.InRange, nil
	case []byte:
		multipoint, _, err := GeometryType{}.Convert(ctx, buf)
		if err != nil {
			return nil, sql.OutOfRange, err
		}
		// TODO: is this even possible?
		if _, ok := multipoint.(MultiPoint); !ok {
			return nil, sql.OutOfRange, sql.ErrInvalidGISData.New("MultiPointType.Convert")
		}
		return multipoint, sql.InRange, nil
	case string:
		return t.Convert(ctx, []byte(buf))
	case MultiPoint:
		if err := t.MatchSRID(buf); err != nil {
			return nil, sql.OutOfRange, err
		}
		return buf, sql.InRange, nil
	default:
		return nil, sql.OutOfRange, sql.ErrSpatialTypeConversion.New()
	}
}

// Equals implements the Type interface.
func (t MultiPointType) Equals(otherType sql.Type) bool {
	_, ok := otherType.(MultiPointType)
	return ok
}

// MaxTextResponseByteLength implements the Type interface
func (t MultiPointType) MaxTextResponseByteLength(*sql.Context) uint32 {
	return GeometryMaxByteLength
}

// Promote implements the Type interface.
func (t MultiPointType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t MultiPointType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, nil
	}

	buf := v.(MultiPoint).Serialize()

	return sqltypes.MakeTrusted(sqltypes.Geometry, buf), nil
}

// String implements Type interface.
func (t MultiPointType) String() string {
	return "multipoint"
}

// Type implements Type interface.
func (t MultiPointType) Type() query.Type {
	return sqltypes.Geometry
}

// ValueType implements Type interface.
func (t MultiPointType) ValueType() reflect.Type {
	return multiPointValueType
}

// Zero implements Type interface.
func (t MultiPointType) Zero() interface{} {
	return MultiPoint{Points: []Point{{}}}
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (MultiPointType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// GetSpatialTypeSRID implements SpatialColumnType interface.
func (t MultiPointType) GetSpatialTypeSRID() (uint32, bool) {
	return t.SRID, t.DefinedSRID
}

// SetSRID implements SpatialColumnType interface.
func (t MultiPointType) SetSRID(v uint32) sql.Type {
	t.SRID = v
	t.DefinedSRID = true
	return t
}

// MatchSRID implements SpatialColumnType interface
func (t MultiPointType) MatchSRID(v interface{}) error {
	val, ok := v.(MultiPoint)
	if !ok {
		return ErrNotMultiPoint.New(v)
	}
	if !t.DefinedSRID {
		return nil
	} else if t.SRID == val.SRID {
		return nil
	}
	return sql.ErrNotMatchingSRID.New(val.SRID, t.SRID)
}

// implementsGeometryValue implements GeometryValue interface.
func (p MultiPoint) implementsGeometryValue() {}

// GetSRID implements GeometryValue interface.
func (p MultiPoint) GetSRID() uint32 {
	return p.SRID
}

// SetSRID implements GeometryValue interface.
func (p MultiPoint) SetSRID(srid uint32) GeometryValue {
	points := make([]Point, len(p.Points))
	for i, point := range p.Points {
		points[i] = point.SetSRID(srid).(Point)
	}
	return MultiPoint{
		SRID:   srid,
		Points: points,
	}
}

// Serialize implements GeometryValue interface.
func (p MultiPoint) Serialize() (buf []byte) {
	buf = AllocateGeoTypeBuffer(len(p.Points), 1, len(p.Points))
	WriteEWKBHeader(buf, p.SRID, WKBMultiPointID)
	p.WriteData(buf[EWKBHeaderSize:])
	return
}

// WriteData implements GeometryValue interface.
func (p MultiPoint) WriteData(buf []byte) int {
	WriteCount(buf, uint32(len(p.Points)))
	buf = buf[CountSize:]
	for _, point := range p.Points {
		WriteWKBHeader(buf, WKBPointID)
		buf = buf[WKBHeaderSize:]
		point.WriteData(buf)
		buf = buf[PointSize:]
	}
	return CountSize + (WKBHeaderSize+PointSize)*len(p.Points)
}

// Swap implements GeometryValue interface.
func (p MultiPoint) Swap() GeometryValue {
	points := make([]Point, len(p.Points))
	for i, point := range p.Points {
		points[i] = point.Swap().(Point)
	}
	return MultiPoint{
		SRID:   p.SRID,
		Points: points,
	}
}

// BBox implements GeometryValue interface.
func (p MultiPoint) BBox() (float64, float64, float64, float64) {
	minX, minY, maxX, maxY := math.MaxFloat64, math.MaxFloat64, -math.MaxFloat64, -math.MaxFloat64
	for _, p := range p.Points {
		pMinX, pMinY, pMaxX, pMaxY := p.BBox()
		minX = math.Min(minX, pMinX)
		minY = math.Min(minY, pMinY)
		maxX = math.Max(maxX, pMaxX)
		maxY = math.Max(maxY, pMaxY)
	}
	return minX, minY, maxX, maxY
}
