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
	"bytes"
	"context"
	"encoding/binary"
	"math"
	"reflect"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

// GeometryType represents the GEOMETRY type.
// https://dev.mysql.com/doc/refman/8.0/en/gis-class-geometry.html
// The type of the returned value is one of the following (each implements GeometryValue): Point, Polygon, LineString.
type GeometryType struct {
	SRID        uint32
	DefinedSRID bool
}

// GeometryValue is the value type returned from GeometryType, which is an interface over the following types:
// Point, Polygon, LineString, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection.
type GeometryValue interface {
	implementsGeometryValue()
	GetSRID() uint32
	SetSRID(srid uint32) GeometryValue
	Serialize() []byte
	WriteData(buf []byte) int
	Swap() GeometryValue
	BBox() (float64, float64, float64, float64)
}

var _ sql.Type = GeometryType{}
var _ sql.SpatialColumnType = GeometryType{}
var _ sql.CollationCoercible = GeometryType{}

var (
	ErrNotGeometry = errors.NewKind("Value of type %T is not a geometry")

	geometryValueType = reflect.TypeOf((*GeometryValue)(nil)).Elem()
)

const (
	CartesianSRID  = uint32(0)
	GeoSpatialSRID = uint32(4326)
)

const (
	SRIDSize       = 4
	EndianSize     = 1
	TypeSize       = 4
	EWKBHeaderSize = SRIDSize + EndianSize + TypeSize
	WKBHeaderSize  = EndianSize + TypeSize

	PointSize             = 16
	CountSize             = 4
	GeometryMaxByteLength = 4*(1024*1024*1024) - 1
)

// Type IDs
const (
	WKBUnknown = iota
	WKBPointID
	WKBLineID
	WKBPolyID
	WKBMultiPointID
	WKBMultiLineID
	WKBMultiPolyID
	WKBGeomCollID
)

// isLinearRing checks if a LineString is a linear ring
func isLinearRing(line LineString) bool {
	// Get number of points
	numPoints := len(line.Points)
	// Check length of LineString (must be 0 or 4+) points
	if numPoints != 0 && numPoints < 4 {
		return false
	}
	// Check if it is closed (first and last point are the same)
	if line.Points[0] != line.Points[numPoints-1] {
		return false
	}
	return true
}

// DeserializeEWKBHeader parses the header portion of a byte array in EWKB format to extract endianness and type
func DeserializeEWKBHeader(buf []byte) (srid uint32, bigEndian bool, typ uint32, err error) {
	// Must be right length
	if len(buf) < EWKBHeaderSize {
		return 0, false, 0, sql.ErrInvalidGISData.New("DeserializeEWKBHeader")
	}
	srid = binary.LittleEndian.Uint32(buf) // First 4 bytes is SRID always in little endian
	buf = buf[SRIDSize:]                   // Shift pointer over
	bigEndian = buf[0] == 0                // Next byte is endianness
	buf = buf[EndianSize:]                 // Shift pointer over
	if bigEndian {                         // Next 4 bytes is type
		typ = binary.BigEndian.Uint32(buf)
	} else {
		typ = binary.LittleEndian.Uint32(buf)
	}

	return
}

// DeserializeWKBHeader parses the header potion of a byte array in WKB format
// There is no SRID
func DeserializeWKBHeader(buf []byte) (bigEndian bool, typ uint32, err error) {
	// Must be right length
	if len(buf) < (EndianSize + TypeSize) {
		return false, 0, sql.ErrInvalidGISData.New("DeserializeWKBHeader")
	}

	bigEndian = buf[0] == 0 // First byte is byte order
	buf = buf[EndianSize:]  // Shift pointer over
	if bigEndian {          // Next 4 bytes is geometry type
		typ = binary.BigEndian.Uint32(buf)
	} else {
		typ = binary.LittleEndian.Uint32(buf)
	}

	return
}

// DeserializePoint parses the data portion of a byte array in WKB format to a Point object
func DeserializePoint(buf []byte, isBig bool, srid uint32) (Point, int, error) {
	// Must be 16 bytes (2 floats)
	if len(buf) != PointSize {
		return Point{}, 0, sql.ErrInvalidGISData.New("DeserializePoint")
	}

	// Read floats x and y
	var x, y float64
	if isBig {
		x = math.Float64frombits(binary.BigEndian.Uint64(buf[:8]))
		y = math.Float64frombits(binary.BigEndian.Uint64(buf[8:]))
	} else {
		x = math.Float64frombits(binary.LittleEndian.Uint64(buf[:8]))
		y = math.Float64frombits(binary.LittleEndian.Uint64(buf[8:]))
	}

	return Point{SRID: srid, X: x, Y: y}, PointSize, nil
}

// DeserializeLine parses the data portion of a byte array in WKB format to a LineString object
func DeserializeLine(buf []byte, isBig bool, srid uint32) (LineString, int, error) {
	// Must be at least CountSize and two points
	if len(buf) < (CountSize + PointSize + PointSize) {
		return LineString{}, 0, sql.ErrInvalidGISData.New("DeserializeLine")
	}

	// Read number of points
	points := make([]Point, readCount(buf, isBig))
	buf = buf[CountSize:]

	// Read points
	var err error
	for i := range points {
		points[i], _, err = DeserializePoint(buf[:PointSize], isBig, srid)
		if err != nil {
			return LineString{}, 0, sql.ErrInvalidGISData.New("DeserializeLine")
		}
		buf = buf[PointSize:]
	}

	return LineString{SRID: srid, Points: points}, CountSize + PointSize*len(points), nil
}

// DeserializePoly parses the data portion of a byte array in WKB format to a Polygon object
func DeserializePoly(buf []byte, isBig bool, srid uint32) (Polygon, int, error) {
	// Must be at least count, count, and four points
	if len(buf) < (CountSize + CountSize + 4*PointSize) {
		return Polygon{}, 0, sql.ErrInvalidGISData.New("DeserializePoly")
	}

	// Read number of lines
	lines := make([]LineString, readCount(buf, isBig))
	buf = buf[CountSize:]
	count := CountSize

	// Read lines
	var err error
	var c int
	for i := range lines {
		lines[i], c, err = DeserializeLine(buf, isBig, srid)
		if err != nil {
			return Polygon{}, 0, sql.ErrInvalidGISData.New("DeserializePoly")
		}
		buf = buf[c:]
		count += c
	}

	return Polygon{SRID: srid, Lines: lines}, count, nil
}

func readCount(buf []byte, isBig bool) uint32 {
	if isBig {
		return binary.BigEndian.Uint32(buf)
	}
	return binary.LittleEndian.Uint32(buf)
}

// DeserializeMPoint parses the data portion of a byte array in WKB format to a MultiPoint object
func DeserializeMPoint(buf []byte, isBig bool, srid uint32) (MultiPoint, int, error) {
	// Must contain at count, wkb header, and one point
	if len(buf) < (CountSize + WKBHeaderSize + PointSize) {
		return MultiPoint{}, 0, sql.ErrInvalidGISData.New("DeserializeMPoint")
	}

	// Read number of points in MultiPoint
	points := make([]Point, readCount(buf, isBig))
	buf = buf[CountSize:]
	for i := range points {
		// WKBHeaders are inside MultiGeometry Types
		isBig, typ, err := DeserializeWKBHeader(buf)
		if err != nil {
			return MultiPoint{}, 0, err
		}
		if typ != WKBPointID {
			return MultiPoint{}, 0, sql.ErrInvalidGISData.New("DeserializeMPoint")
		}
		buf = buf[WKBHeaderSize:]
		// Read point data
		points[i], _, err = DeserializePoint(buf[:PointSize], isBig, srid)
		if err != nil {
			return MultiPoint{}, 0, err
		}
		buf = buf[PointSize:]
	}

	return MultiPoint{SRID: srid, Points: points}, CountSize + (WKBHeaderSize+PointSize)*len(points), nil
}

// DeserializeMLine parses the data portion of a byte array in WKB format to a MultiLineString object
func DeserializeMLine(buf []byte, isBig bool, srid uint32) (MultiLineString, int, error) {
	// Must contain at least length, wkb header, length, and two points
	if len(buf) < (CountSize + WKBHeaderSize + CountSize + 2*PointSize) {
		return MultiLineString{}, 0, sql.ErrInvalidGISData.New("MultiLineString")
	}

	// Read number of lines
	lines := make([]LineString, readCount(buf, isBig))
	buf = buf[CountSize:]
	count := CountSize
	var c int
	for i := range lines {
		isBig, typ, err := DeserializeWKBHeader(buf)
		if typ != WKBLineID {
			return MultiLineString{}, 0, sql.ErrInvalidGISData.New("DeserializeMLine")
		}
		buf = buf[WKBHeaderSize:]

		lines[i], c, err = DeserializeLine(buf, isBig, srid)
		if err != nil {
			return MultiLineString{}, 0, sql.ErrInvalidGISData.New("DeserializeMLine")
		}

		buf = buf[c:]
		count += WKBHeaderSize + c
	}

	return MultiLineString{SRID: srid, Lines: lines}, count, nil
}

// DeserializeMPoly parses the data portion of a byte array in WKB format to a MultiPolygon object
func DeserializeMPoly(buf []byte, isBig bool, srid uint32) (MultiPolygon, int, error) {
	// Must contain at least num polys, wkb header, num lines, num lines, and four points
	if len(buf) < (CountSize + WKBHeaderSize + 2*CountSize + 4*PointSize) {
		return MultiPolygon{}, 0, sql.ErrInvalidGISData.New("MultiPolygon")
	}

	// Read number of polygons
	polys := make([]Polygon, readCount(buf, isBig))
	buf = buf[CountSize:]
	count := CountSize
	var c int
	for i := range polys {
		isBig, typ, err := DeserializeWKBHeader(buf)
		if typ != WKBPolyID {
			return MultiPolygon{}, 0, sql.ErrInvalidGISData.New("DeserializeMPoly")
		}

		buf = buf[WKBHeaderSize:]
		polys[i], c, err = DeserializePoly(buf, isBig, srid)
		if err != nil {
			return MultiPolygon{}, 0, sql.ErrInvalidGISData.New("DeserializeMPoly")
		}

		buf = buf[c:]
		count += WKBHeaderSize + c
	}

	return MultiPolygon{SRID: srid, Polygons: polys}, count, nil
}

// DeserializeGeomColl parses the data portion of a byte array in WKB format to a GeometryCollection object
func DeserializeGeomColl(buf []byte, isBig bool, srid uint32) (GeomColl, int, error) {
	// Must be at least CountSize
	if len(buf) < CountSize {
		return GeomColl{}, 0, sql.ErrInvalidGISData.New("DeserializeLine")
	}

	// Read number of geometry objects
	geoms := make([]GeometryValue, readCount(buf, isBig))
	buf = buf[CountSize:]
	count := CountSize

	// Read geometries
	var c int
	for i := range geoms {
		isBig, typ, err := DeserializeWKBHeader(buf)
		if err != nil {
			return GeomColl{}, 0, sql.ErrInvalidGISData.New("GeometryType.Convert")
		}
		buf = buf[WKBHeaderSize:]

		switch typ {
		case WKBPointID:
			geoms[i], c, err = DeserializePoint(buf[:PointSize], isBig, srid)
		case WKBLineID:
			geoms[i], c, err = DeserializeLine(buf, isBig, srid)
		case WKBPolyID:
			geoms[i], c, err = DeserializePoly(buf, isBig, srid)
		case WKBMultiPointID:
			geoms[i], c, err = DeserializeMPoint(buf, isBig, srid)
		case WKBMultiLineID:
			geoms[i], c, err = DeserializeMLine(buf, isBig, srid)
		case WKBMultiPolyID:
			geoms[i], c, err = DeserializeMPoly(buf, isBig, srid)
		case WKBGeomCollID:
			geoms[i], c, err = DeserializeGeomColl(buf, isBig, srid)
		default:
			return GeomColl{}, 0, sql.ErrInvalidGISData.New("GeometryType.Convert")
		}
		if err != nil {
			return GeomColl{}, 0, sql.ErrInvalidGISData.New("GeometryType.Convert")
		}

		buf = buf[c:]
		count += WKBHeaderSize + c
	}

	return GeomColl{SRID: srid, Geoms: geoms}, count, nil
}

// TODO: unexport
func AllocateGeoTypeBuffer(numPoints, numCounts, numWKBHeaders int) []byte {
	return make([]byte, EWKBHeaderSize+PointSize*numPoints+CountSize*numCounts+numWKBHeaders*WKBHeaderSize)
}

// WriteEWKBHeader will write EWKB header to the given buffer
func WriteEWKBHeader(buf []byte, srid, typ uint32) {
	binary.LittleEndian.PutUint32(buf, srid) // always write SRID in little endian
	buf = buf[SRIDSize:]                     // shift
	buf[0] = 1                               // always write in little endian
	buf = buf[EndianSize:]                   // shift
	binary.LittleEndian.PutUint32(buf, typ)  // write geometry type
}

// WriteWKBHeader will write WKB header to the given buffer
func WriteWKBHeader(buf []byte, typ uint32) {
	buf[0] = 1                              // always write in little endian
	buf = buf[EndianSize:]                  // shift
	binary.LittleEndian.PutUint32(buf, typ) // write geometry type
}

// TODO: rename me, unexport
func WriteCount(buf []byte, count uint32) {
	binary.LittleEndian.PutUint32(buf, count)
}

// Compare implements Type interface.
func (t GeometryType) Compare(s context.Context, a interface{}, b interface{}) (int, error) {
	if hasNulls, res := CompareNulls(a, b); hasNulls {
		return res, nil
	}

	aa, ok := a.(GeometryValue)
	if !ok {
		return 0, ErrNotGeometry.New(a)
	}

	bb, ok := b.(GeometryValue)
	if !ok {
		return 0, ErrNotGeometry.New(b)
	}

	return bytes.Compare(aa.Serialize(), bb.Serialize()), nil
}

// Convert implements Type interface.
func (t GeometryType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	if v == nil {
		return nil, sql.InRange, nil
	}
	switch val := v.(type) {
	case []byte:
		srid, isBig, geomType, err := DeserializeEWKBHeader(val)
		if err != nil {
			return nil, sql.OutOfRange, err
		}
		val = val[EWKBHeaderSize:]

		var geom interface{}
		switch geomType {
		case WKBPointID:
			geom, _, err = DeserializePoint(val, isBig, srid)
		case WKBLineID:
			geom, _, err = DeserializeLine(val, isBig, srid)
		case WKBPolyID:
			geom, _, err = DeserializePoly(val, isBig, srid)
		case WKBMultiPointID:
			geom, _, err = DeserializeMPoint(val, isBig, srid)
		case WKBMultiLineID:
			geom, _, err = DeserializeMLine(val, isBig, srid)
		case WKBMultiPolyID:
			geom, _, err = DeserializeMPoly(val, isBig, srid)
		case WKBGeomCollID:
			geom, _, err = DeserializeGeomColl(val, isBig, srid)
		default:
			return nil, sql.OutOfRange, sql.ErrInvalidGISData.New("GeometryType.Convert")
		}
		if err != nil {
			return nil, sql.OutOfRange, err
		}
		return geom, sql.InRange, nil
	case string:
		return t.Convert(ctx, []byte(val))
	case GeometryValue:
		if err := t.MatchSRID(val); err != nil {
			return nil, sql.OutOfRange, err
		}
		return val, sql.InRange, nil
	default:
		return nil, sql.OutOfRange, sql.ErrSpatialTypeConversion.New()
	}
}

// Equals implements the Type interface.
func (t GeometryType) Equals(otherType sql.Type) (ok bool) {
	_, ok = otherType.(GeometryType)
	return
}

// MaxTextResponseByteLength implements the Type interface
func (t GeometryType) MaxTextResponseByteLength(*sql.Context) uint32 {
	return GeometryMaxByteLength
}

// Promote implements the Type interface.
func (t GeometryType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t GeometryType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, nil
	}

	buf := v.(GeometryValue).Serialize()

	return sqltypes.MakeTrusted(sqltypes.Geometry, buf), nil
}

// String implements Type interface.
func (t GeometryType) String() string {
	return "geometry"
}

// Type implements Type interface.
func (t GeometryType) Type() query.Type {
	return sqltypes.Geometry
}

// ValueType implements Type interface.
func (t GeometryType) ValueType() reflect.Type {
	return geometryValueType
}

// Zero implements Type interface.
func (t GeometryType) Zero() interface{} {
	// MySQL throws an error for INSERT IGNORE, UPDATE IGNORE, etc. if the geometry type cannot be parsed:
	// ERROR 1416 (22003): Cannot get geometry object from data you send to the GEOMETRY field
	// So, we don't implement a zero type for this function.
	return nil
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (GeometryType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// GetSpatialTypeSRID implements SpatialColumnType interface.
func (t GeometryType) GetSpatialTypeSRID() (uint32, bool) {
	return t.SRID, t.DefinedSRID
}

// SetSRID implements SpatialColumnType interface.
func (t GeometryType) SetSRID(v uint32) sql.Type {
	t.SRID = v
	t.DefinedSRID = true
	return t
}

// MatchSRID implements SpatialColumnType interface
func (t GeometryType) MatchSRID(v interface{}) error {
	if !t.DefinedSRID {
		return nil
	}
	// if matched with SRID value of row value
	var srid uint32
	switch val := v.(type) {
	case GeometryValue:
		srid = val.GetSRID()
	default:
		return ErrNotGeometry.New(v)
	}
	if t.SRID == srid {
		return nil
	}
	return sql.ErrNotMatchingSRID.New(srid, t.SRID)
}

func ValidateSRID(srid int, funcName string) error {
	if srid < 0 || srid > math.MaxUint32 {
		return sql.ErrInvalidSRID.New(funcName)
	}
	if _, ok := SupportedSRIDs[uint32(srid)]; !ok {
		return sql.ErrNoSRID.New(srid)
	}

	return nil
}
