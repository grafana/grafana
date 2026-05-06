//  Copyright (c) 2022 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package geojson

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"strings"

	index "github.com/blevesearch/bleve_index_api"

	"github.com/blevesearch/geo/s2"
)

// s2Serializable is an optional interface for implementations
// supporting custom serialisation of data based out of s2's
// encode method.
type s2Serializable interface {
	// Marshal implementation should encode the shape using the
	// s2's encode methods with appropriate prefix bytes to
	// identify the type of the contents.
	Marshal() ([]byte, error)
}

const (
	PointType              = "point"
	MultiPointType         = "multipoint"
	LineStringType         = "linestring"
	MultiLineStringType    = "multilinestring"
	PolygonType            = "polygon"
	MultiPolygonType       = "multipolygon"
	GeometryCollectionType = "geometrycollection"
	CircleType             = "circle"
	EnvelopeType           = "envelope"
)

// These are the byte prefixes for identifying the
// shape contained within the doc values byte slice
// while decoding the contents during the query
// filtering phase.
const (
	PointTypePrefix              = byte(1)
	MultiPointTypePrefix         = byte(2)
	LineStringTypePrefix         = byte(3)
	MultiLineStringTypePrefix    = byte(4)
	PolygonTypePrefix            = byte(5)
	MultiPolygonTypePrefix       = byte(6)
	GeometryCollectionTypePrefix = byte(7)
	CircleTypePrefix             = byte(8)
	EnvelopeTypePrefix           = byte(9)
)

// compositeShape is an optional interface for the
// composite geoJSON shapes which is composed of
// multiple spatial shapes within it. Composite shapes
// like multipoint, multilinestring, multipolygon and
// geometrycollection shapes are supposed to implement
// this interface.
type compositeShape interface {
	// Members implementation returns the
	// geoJSON shapes composed within the shape.
	Members() []index.GeoJSON
}

// --------------------------------------------------------
// Point represents the geoJSON point type and it
// implements the index.GeoJSON interface.
type Point struct {
	Typ      string    `json:"type"`
	Vertices []float64 `json:"coordinates"`
	s2point  *s2.Point
}

func (p *Point) Type() string {
	return strings.ToLower(p.Typ)
}

func (p *Point) Value() ([]byte, error) {
	return jsoniter.Marshal(p)
}

func NewGeoJsonPoint(v []float64) index.GeoJSON {
	rv := &Point{Typ: PointType, Vertices: v}
	rv.init()
	return rv
}

func (p *Point) init() {
	if p.s2point == nil {
		s2point := s2.PointFromLatLng(s2.LatLngFromDegrees(
			p.Vertices[1], p.Vertices[0]))
		p.s2point = &s2point
	}
}

func (p *Point) Marshal() ([]byte, error) {
	p.init()

	var b bytes.Buffer
	b.Grow(32)
	w := bufio.NewWriter(&b)
	err := p.s2point.Encode(w)
	if err != nil {
		return nil, err
	}

	w.Flush()
	return append([]byte{PointTypePrefix}, b.Bytes()...), nil
}

func (p *Point) Intersects(other index.GeoJSON) (bool, error) {
	p.init()
	s2cell := s2.CellFromPoint(*p.s2point)

	return checkCellIntersectsShape(&s2cell, p, other)
}

func (p *Point) Contains(other index.GeoJSON) (bool, error) {
	p.init()
	s2cell := s2.CellFromPoint(*p.s2point)

	return checkCellContainsShape([]*s2.Cell{&s2cell}, other)
}

func (p *Point) Coordinates() []float64 {
	return p.Vertices
}

// --------------------------------------------------------
// MultiPoint represents the geoJSON multipoint type and it
// implements the index.GeoJSON interface as well as the
// compositeShap interface.
type MultiPoint struct {
	Typ      string      `json:"type"`
	Vertices [][]float64 `json:"coordinates"`
	s2points []*s2.Point
}

func NewGeoJsonMultiPoint(v [][]float64) index.GeoJSON {
	rv := &MultiPoint{Typ: MultiPointType, Vertices: v}
	rv.init()
	return rv
}

func (mp *MultiPoint) init() {
	if mp.s2points == nil {
		mp.s2points = make([]*s2.Point, len(mp.Vertices))
		for i, point := range mp.Vertices {
			s2point := s2.PointFromLatLng(s2.LatLngFromDegrees(
				point[1], point[0]))
			mp.s2points[i] = &s2point
		}
	}
}

func (p *MultiPoint) Marshal() ([]byte, error) {
	p.init()

	var b bytes.Buffer
	b.Grow(64)
	w := bufio.NewWriter(&b)

	// first write the number of points.
	count := int32(len(p.s2points))
	err := binary.Write(w, binary.BigEndian, count)
	if err != nil {
		return nil, err
	}
	// write the points.
	for _, s2point := range p.s2points {
		err := s2point.Encode(w)
		if err != nil {
			return nil, err
		}
	}

	w.Flush()
	return append([]byte{MultiPointTypePrefix}, b.Bytes()...), nil
}

func (p *MultiPoint) Type() string {
	return strings.ToLower(p.Typ)
}

func (mp *MultiPoint) Value() ([]byte, error) {
	return jsoniter.Marshal(mp)
}

func (p *MultiPoint) Intersects(other index.GeoJSON) (bool, error) {
	p.init()

	for _, s2point := range p.s2points {
		cell := s2.CellFromPoint(*s2point)
		rv, err := checkCellIntersectsShape(&cell, p, other)
		if rv && err == nil {
			return rv, nil
		}
	}

	return false, nil
}

func (p *MultiPoint) Contains(other index.GeoJSON) (bool, error) {
	p.init()
	s2cells := make([]*s2.Cell, 0, len(p.s2points))

	for _, s2point := range p.s2points {
		cell := s2.CellFromPoint(*s2point)
		s2cells = append(s2cells, &cell)
	}

	return checkCellContainsShape(s2cells, other)
}

func (p *MultiPoint) Coordinates() [][]float64 {
	return p.Vertices
}

func (p *MultiPoint) Members() []index.GeoJSON {
	if len(p.Vertices) > 0 && len(p.s2points) == 0 {
		points := make([]index.GeoJSON, len(p.Vertices))
		for pos, vertices := range p.Vertices {
			points[pos] = NewGeoJsonPoint(vertices)
		}
		return points
	}

	points := make([]index.GeoJSON, len(p.s2points))
	for pos, point := range p.s2points {
		points[pos] = &Point{s2point: point}
	}
	return points
}

// --------------------------------------------------------
// LineString represents the geoJSON linestring type and it
// implements the index.GeoJSON interface.
type LineString struct {
	Typ      string      `json:"type"`
	Vertices [][]float64 `json:"coordinates"`
	pl       *s2.Polyline
}

func NewGeoJsonLinestring(points [][]float64) index.GeoJSON {
	rv := &LineString{Typ: LineStringType, Vertices: points}
	rv.init()
	return rv
}

func (ls *LineString) init() {
	if ls.pl == nil {
		latlngs := make([]s2.LatLng, len(ls.Vertices))
		for i, vertex := range ls.Vertices {
			latlngs[i] = s2.LatLngFromDegrees(vertex[1], vertex[0])
		}
		ls.pl = s2.PolylineFromLatLngs(latlngs)
	}
}

func (ls *LineString) Type() string {
	return strings.ToLower(ls.Typ)
}

func (ls *LineString) Value() ([]byte, error) {
	return jsoniter.Marshal(ls)
}

func (ls *LineString) Marshal() ([]byte, error) {
	ls.init()

	var b bytes.Buffer
	b.Grow(50)
	w := bufio.NewWriter(&b)
	err := ls.pl.Encode(w)
	if err != nil {
		return nil, err
	}

	w.Flush()
	return append([]byte{LineStringTypePrefix}, b.Bytes()...), nil
}

func (ls *LineString) Intersects(other index.GeoJSON) (bool, error) {
	ls.init()

	return checkLineStringsIntersectsShape([]*s2.Polyline{ls.pl}, ls, other)
}

func (ls *LineString) Contains(other index.GeoJSON) (bool, error) {
	return checkLineStringsContainsShape([]*s2.Polyline{ls.pl}, other)
}

func (ls *LineString) Coordinates() [][]float64 {
	return ls.Vertices
}

// --------------------------------------------------------
// MultiLineString represents the geoJSON multilinestring type
// and it implements the index.GeoJSON interface as well as the
// compositeShap interface.
type MultiLineString struct {
	Typ      string        `json:"type"`
	Vertices [][][]float64 `json:"coordinates"`
	pls      []*s2.Polyline
}

func NewGeoJsonMultilinestring(points [][][]float64) index.GeoJSON {
	rv := &MultiLineString{Typ: MultiLineStringType, Vertices: points}
	rv.init()
	return rv
}

func (mls *MultiLineString) init() {
	if mls.pls == nil {
		mls.pls = s2PolylinesFromCoordinates(mls.Vertices)
	}
}

func (mls *MultiLineString) Type() string {
	return strings.ToLower(mls.Typ)
}

func (mls *MultiLineString) Value() ([]byte, error) {
	return jsoniter.Marshal(mls)
}

func (mls *MultiLineString) Marshal() ([]byte, error) {
	mls.init()

	var b bytes.Buffer
	b.Grow(256)
	w := bufio.NewWriter(&b)

	// first write the number of linestrings.
	count := int32(len(mls.pls))
	err := binary.Write(w, binary.BigEndian, count)
	if err != nil {
		return nil, err
	}
	// write the lines.
	for _, ls := range mls.pls {
		err := ls.Encode(w)
		if err != nil {
			return nil, err
		}
	}

	w.Flush()
	return append([]byte{MultiLineStringTypePrefix}, b.Bytes()...), nil
}

func (p *MultiLineString) Intersects(other index.GeoJSON) (bool, error) {
	p.init()
	return checkLineStringsIntersectsShape(p.pls, p, other)
}

func (p *MultiLineString) Contains(other index.GeoJSON) (bool, error) {
	return checkLineStringsContainsShape(p.pls, other)
}

func (p *MultiLineString) Coordinates() [][][]float64 {
	return p.Vertices
}

func (p *MultiLineString) Members() []index.GeoJSON {
	if len(p.Vertices) > 0 && len(p.pls) == 0 {
		lines := make([]index.GeoJSON, len(p.Vertices))
		for pos, vertices := range p.Vertices {
			lines[pos] = NewGeoJsonLinestring(vertices)
		}
		return lines
	}

	lines := make([]index.GeoJSON, len(p.pls))
	for pos, pl := range p.pls {
		lines[pos] = &LineString{pl: pl}
	}
	return lines
}

// --------------------------------------------------------
// Polygon represents the geoJSON polygon type
// and it implements the index.GeoJSON interface.
type Polygon struct {
	Typ      string        `json:"type"`
	Vertices [][][]float64 `json:"coordinates"`
	s2pgn    *s2.Polygon
}

func NewGeoJsonPolygon(points [][][]float64) index.GeoJSON {
	rv := &Polygon{Typ: PolygonType, Vertices: points}
	rv.init()
	return rv
}

func (p *Polygon) init() {
	if p.s2pgn == nil {
		p.s2pgn = s2PolygonFromCoordinates(p.Vertices)
	}
}

func (p *Polygon) Type() string {
	return strings.ToLower(p.Typ)
}

func (p *Polygon) Value() ([]byte, error) {
	return jsoniter.Marshal(p)
}

func (p *Polygon) Marshal() ([]byte, error) {
	p.init()

	var b bytes.Buffer
	b.Grow(128)
	w := bufio.NewWriter(&b)
	err := p.s2pgn.Encode(w)
	if err != nil {
		return nil, err
	}

	w.Flush()
	return append([]byte{PolygonTypePrefix}, b.Bytes()...), nil
}

func (p *Polygon) Intersects(other index.GeoJSON) (bool, error) {
	// make an s2polygon for reuse.
	p.init()

	return checkPolygonIntersectsShape(p.s2pgn, p, other)
}

func (p *Polygon) Contains(other index.GeoJSON) (bool, error) {
	// make an s2polygon for reuse.
	p.init()

	return checkMultiPolygonContainsShape([]*s2.Polygon{p.s2pgn}, p, other)
}

func (p *Polygon) Coordinates() [][][]float64 {
	return p.Vertices
}

// --------------------------------------------------------
// MultiPolygon represents the geoJSON multipolygon type
// and it implements the index.GeoJSON interface as well as the
// compositeShap interface.
type MultiPolygon struct {
	Typ      string          `json:"type"`
	Vertices [][][][]float64 `json:"coordinates"`
	s2pgns   []*s2.Polygon
}

func NewGeoJsonMultiPolygon(points [][][][]float64) index.GeoJSON {
	rv := &MultiPolygon{Typ: MultiPolygonType, Vertices: points}
	rv.init()
	return rv
}

func (p *MultiPolygon) init() {
	if p.s2pgns == nil {
		p.s2pgns = make([]*s2.Polygon, len(p.Vertices))
		for i, vertices := range p.Vertices {
			pgn := s2PolygonFromCoordinates(vertices)
			p.s2pgns[i] = pgn
		}
	}
}

func (p *MultiPolygon) Type() string {
	return strings.ToLower(p.Typ)
}

func (p *MultiPolygon) Value() ([]byte, error) {
	return jsoniter.Marshal(p)
}

func (p *MultiPolygon) Marshal() ([]byte, error) {
	p.init()

	var b bytes.Buffer
	b.Grow(512)
	w := bufio.NewWriter(&b)

	// first write the number of polygons.
	count := int32(len(p.s2pgns))
	err := binary.Write(w, binary.BigEndian, count)
	if err != nil {
		return nil, err
	}
	// write the polygons.
	for _, pgn := range p.s2pgns {
		err := pgn.Encode(w)
		if err != nil {
			return nil, err
		}
	}

	w.Flush()
	return append([]byte{MultiPolygonTypePrefix}, b.Bytes()...), nil
}

func (p *MultiPolygon) Intersects(other index.GeoJSON) (bool, error) {
	p.init()

	for _, pgn := range p.s2pgns {
		rv, err := checkPolygonIntersectsShape(pgn, p, other)
		if rv && err == nil {
			return true, nil
		}
	}

	return false, nil
}

func (p *MultiPolygon) Contains(other index.GeoJSON) (bool, error) {
	p.init()

	return checkMultiPolygonContainsShape(p.s2pgns, p, other)
}

func (p *MultiPolygon) Coordinates() [][][][]float64 {
	return p.Vertices
}

func (p *MultiPolygon) Members() []index.GeoJSON {
	if len(p.Vertices) > 0 && len(p.s2pgns) == 0 {
		polygons := make([]index.GeoJSON, len(p.Vertices))
		for pos, vertices := range p.Vertices {
			polygons[pos] = NewGeoJsonPolygon(vertices)
		}
		return polygons
	}

	polygons := make([]index.GeoJSON, len(p.s2pgns))
	for pos, pgn := range p.s2pgns {
		polygons[pos] = &Polygon{s2pgn: pgn}
	}
	return polygons
}

// --------------------------------------------------------
// GeometryCollection represents the geoJSON geometryCollection type
// and it implements the index.GeoJSON interface as well as the
// compositeShap interface.
type GeometryCollection struct {
	Typ    string          `json:"type"`
	Shapes []index.GeoJSON `json:"geometries"`
}

func (gc *GeometryCollection) Type() string {
	return strings.ToLower(gc.Typ)
}

func (gc *GeometryCollection) Value() ([]byte, error) {
	return jsoniter.Marshal(gc)
}

func (gc *GeometryCollection) Members() []index.GeoJSON {
	shapes := make([]index.GeoJSON, 0, len(gc.Shapes))
	for _, shape := range gc.Shapes {
		if cs, ok := shape.(compositeShape); ok {
			shapes = append(shapes, cs.Members()...)
		} else {
			shapes = append(shapes, shape)
		}
	}
	return shapes
}

func (gc *GeometryCollection) Marshal() ([]byte, error) {
	var b bytes.Buffer
	b.Grow(512)
	w := bufio.NewWriter(&b)

	// first write the number of shapes.
	count := int32(len(gc.Shapes))
	err := binary.Write(w, binary.BigEndian, count)
	if err != nil {
		return nil, err
	}

	var res []byte
	for _, shape := range gc.Shapes {
		if s, ok := shape.(s2Serializable); ok {
			sb, err := s.Marshal()
			if err != nil {
				return nil, err
			}
			// write the length of each shape.
			err = binary.Write(w, binary.BigEndian, int32(len(sb)))
			if err != nil {
				return nil, err
			}
			// track the shape contents.
			res = append(res, sb...)
		}
	}
	w.Flush()

	return append([]byte{GeometryCollectionTypePrefix}, append(b.Bytes(), res...)...), nil
}

func (gc *GeometryCollection) Intersects(other index.GeoJSON) (bool, error) {
	for _, shape := range gc.Members() {

		intersects, err := shape.Intersects(other)
		if intersects && err == nil {
			return true, nil
		}
	}
	return false, nil
}

func (gc *GeometryCollection) Contains(other index.GeoJSON) (bool, error) {
	// handle composite target shapes explicitly
	if cs, ok := other.(compositeShape); ok {
		otherShapes := cs.Members()
		shapesFoundWithIn := make(map[int]struct{})

	nextShape:
		for pos, shapeInDoc := range otherShapes {
			for _, shape := range gc.Members() {
				within, err := shape.Contains(shapeInDoc)
				if within && err == nil {
					shapesFoundWithIn[pos] = struct{}{}
					continue nextShape
				}
			}
		}

		return len(shapesFoundWithIn) == len(otherShapes), nil
	}

	for _, shape := range gc.Members() {
		within, err := shape.Contains(other)
		if within && err == nil {
			return true, nil
		}
	}

	return false, nil
}

func (gc *GeometryCollection) UnmarshalJSON(data []byte) error {
	tmp := struct {
		Typ    string            `json:"type"`
		Shapes []json.RawMessage `json:"geometries"`
	}{}

	err := jsoniter.Unmarshal(data, &tmp)
	if err != nil {
		return err
	}
	gc.Typ = tmp.Typ

	for _, shape := range tmp.Shapes {
		var t map[string]interface{}
		err := jsoniter.Unmarshal(shape, &t)
		if err != nil {
			return err
		}

		var typ string

		if val, ok := t["type"]; ok {
			typ = strings.ToLower(val.(string))
		} else {
			continue
		}

		switch typ {
		case PointType:
			var p Point
			err := jsoniter.Unmarshal(shape, &p)
			if err != nil {
				return err
			}
			p.init()
			gc.Shapes = append(gc.Shapes, &p)

		case MultiPointType:
			var mp MultiPoint
			err := jsoniter.Unmarshal(shape, &mp)
			if err != nil {
				return err
			}
			mp.init()
			gc.Shapes = append(gc.Shapes, &mp)

		case LineStringType:
			var ls LineString
			err := jsoniter.Unmarshal(shape, &ls)
			if err != nil {
				return err
			}
			ls.init()
			gc.Shapes = append(gc.Shapes, &ls)

		case MultiLineStringType:
			var mls MultiLineString
			err := jsoniter.Unmarshal(shape, &mls)
			if err != nil {
				return err
			}
			mls.init()
			gc.Shapes = append(gc.Shapes, &mls)

		case PolygonType:
			var pgn Polygon
			err := jsoniter.Unmarshal(shape, &pgn)
			if err != nil {
				return err
			}
			pgn.init()
			gc.Shapes = append(gc.Shapes, &pgn)

		case MultiPolygonType:
			var pgn MultiPolygon
			err := jsoniter.Unmarshal(shape, &pgn)
			if err != nil {
				return err
			}
			pgn.init()
			gc.Shapes = append(gc.Shapes, &pgn)
		}
	}

	return nil
}

// --------------------------------------------------------
// Circle represents a custom circle type and it
// implements the index.GeoJSON interface.
type Circle struct {
	Typ            string    `json:"type"`
	Vertices       []float64 `json:"coordinates"`
	Radius         string    `json:"radius"`
	radiusInMeters float64
	s2cap          *s2.Cap
}

func NewGeoCircle(points []float64,
	radius string) index.GeoJSON {
	r, err := ParseDistance(radius)
	if err != nil {
		return nil
	}

	return &Circle{Typ: CircleType,
		Vertices:       points,
		Radius:         radius,
		radiusInMeters: r}
}

func (c *Circle) Type() string {
	return strings.ToLower(c.Typ)
}

func (c *Circle) Value() ([]byte, error) {
	return jsoniter.Marshal(c)
}

func (c *Circle) init() {
	if c.s2cap == nil {
		c.s2cap = s2Cap(c.Vertices, c.radiusInMeters)
	}
}

func (c *Circle) Marshal() ([]byte, error) {
	c.init()

	var b bytes.Buffer
	b.Grow(40)
	w := bufio.NewWriter(&b)
	err := c.s2cap.Encode(w)
	if err != nil {
		return nil, err
	}

	w.Flush()
	return append([]byte{CircleTypePrefix}, b.Bytes()...), nil
}

func (c *Circle) Intersects(other index.GeoJSON) (bool, error) {
	c.init()

	return checkCircleIntersectsShape(c.s2cap, c, other)
}

func (c *Circle) Contains(other index.GeoJSON) (bool, error) {
	c.init()
	return checkCircleContainsShape(c.s2cap, c, other)
}

func (c *Circle) UnmarshalJSON(data []byte) error {
	tmp := struct {
		Typ      string    `json:"type"`
		Vertices []float64 `json:"coordinates"`
		Radius   string    `json:"radius"`
	}{}

	err := jsoniter.Unmarshal(data, &tmp)
	if err != nil {
		return err
	}
	c.Typ = tmp.Typ
	c.Vertices = tmp.Vertices
	c.Radius = tmp.Radius
	if tmp.Radius != "" {
		c.radiusInMeters, err = ParseDistance(tmp.Radius)
	}

	return err
}

// --------------------------------------------------------
// Envelope represents the  envelope/bounding box type and it
// implements the index.GeoJSON interface.
type Envelope struct {
	Typ      string      `json:"type"`
	Vertices [][]float64 `json:"coordinates"`
	r        *s2.Rect
}

func NewGeoEnvelope(points [][]float64) index.GeoJSON {
	return &Envelope{Vertices: points, Typ: EnvelopeType}
}

func (e *Envelope) Type() string {
	return strings.ToLower(e.Typ)
}

func (e *Envelope) Value() ([]byte, error) {
	return jsoniter.Marshal(e)
}

func (e *Envelope) init() {
	if e.r == nil {
		e.r = s2RectFromBounds(e.Vertices[0], e.Vertices[1])
	}
}

func (e *Envelope) Marshal() ([]byte, error) {
	e.init()

	var b bytes.Buffer
	b.Grow(50)
	w := bufio.NewWriter(&b)
	err := e.r.Encode(w)
	if err != nil {
		return nil, err
	}

	w.Flush()
	return append([]byte{EnvelopeTypePrefix}, b.Bytes()...), nil
}

func (e *Envelope) Intersects(other index.GeoJSON) (bool, error) {
	e.init()

	return checkEnvelopeIntersectsShape(e.r, e, other)
}

func (e *Envelope) Contains(other index.GeoJSON) (bool, error) {
	e.init()

	return checkEnvelopeContainsShape(e.r, e, other)
}

//--------------------------------------------------------

// checkCellIntersectsShape checks for intersection between
// the s2cell and the shape in the document.
func checkCellIntersectsShape(cell *s2.Cell, shapeIn,
	other index.GeoJSON) (bool, error) {
	// check if the other shape is a point.
	if p2, ok := other.(*Point); ok {
		s2cell := s2.CellFromPoint(*p2.s2point)

		if cell.IntersectsCell(s2cell) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipoint.
	if p2, ok := other.(*MultiPoint); ok {
		// check the intersection for any point in the array.
		for _, point := range p2.s2points {
			s2cell := s2.CellFromPoint(*point)

			if cell.IntersectsCell(s2cell) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a polygon.
	if p2, ok := other.(*Polygon); ok {

		if p2.s2pgn.IntersectsCell(*cell) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipolygon.
	if p2, ok := other.(*MultiPolygon); ok {
		// check the intersection for any polygon in the collection.
		for _, s2pgn := range p2.s2pgns {

			if s2pgn.IntersectsCell(*cell) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a linestring.
	if p2, ok := other.(*LineString); ok {
		for i := 0; i < p2.pl.NumEdges(); i++ {
			edge := p2.pl.Edge(i)
			start := s2.CellFromPoint(edge.V0)
			end := s2.CellFromPoint(edge.V1)
			if cell.IntersectsCell(start) || cell.IntersectsCell(end) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a multilinestring.
	if p2, ok := other.(*MultiLineString); ok {
		// check the intersection for any linestring in the array.
		for _, pl := range p2.pls {
			for i := 0; i < pl.NumEdges(); i++ {
				edge := pl.Edge(i)
				start := s2.CellFromPoint(edge.V0)
				end := s2.CellFromPoint(edge.V1)
				if cell.IntersectsCell(start) || cell.IntersectsCell(end) {
					return true, nil
				}
			}
		}

		return false, nil
	}

	// check if the other shape is a geometrycollection.
	if gc, ok := other.(*GeometryCollection); ok {
		// check for intersection across every member shape.
		if geometryCollectionIntersectsShape(gc, shapeIn) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a circle.
	if c, ok := other.(*Circle); ok {

		if c.s2cap.IntersectsCell(*cell) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is an envelope.
	if e, ok := other.(*Envelope); ok {

		if e.r.IntersectsCell(*cell) {
			return true, nil
		}

		return false, nil
	}

	return false, fmt.Errorf("unknown geojson type: %s "+
		" found in document", other.Type())
}

// checkCellContainsShape checks whether the given shape in
// in the document is contained with the s2cell.
func checkCellContainsShape(cells []*s2.Cell,
	other index.GeoJSON) (bool, error) {
	// check if the other shape is a point.
	if p2, ok := other.(*Point); ok {
		for _, cell := range cells {

			if cell.ContainsPoint(*p2.s2point) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a multipoint, if so containment is
	// checked for every point in the multipoint with every given cells.
	if p2, ok := other.(*MultiPoint); ok {
		// check the containment for every point in the collection.
		lookup := make(map[int]struct{})
		for _, cell := range cells {
			for pos, point := range p2.s2points {
				if _, done := lookup[pos]; done {
					continue
				}
				// already processed all the points in the multipoint.
				if len(lookup) == len(p2.s2points) {
					return true, nil
				}

				if cell.ContainsPoint(*point) {
					lookup[pos] = struct{}{}
				}
			}
		}

		return len(lookup) == len(p2.s2points), nil
	}

	// as point is a non closed shape, containment isn't feasible
	// for other higher dimensions.
	return false, nil
}

// ------------------------------------------------------------------------

// checkLineStringsIntersectsShape checks whether the given linestrings
// intersects with the shape in the document.
func checkLineStringsIntersectsShape(pls []*s2.Polyline, shapeIn,
	other index.GeoJSON) (bool, error) {
	// check if the other shape is a point.
	if p2, ok := other.(*Point); ok {
		if polylineIntersectsPoint(pls, p2.s2point) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipoint.
	if p2, ok := other.(*MultiPoint); ok {
		// check the intersection for any point in the collection.
		for _, point := range p2.s2points {

			if polylineIntersectsPoint(pls, point) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a polygon.
	if p2, ok := other.(*Polygon); ok {
		if polylineIntersectsPolygons(pls, []*s2.Polygon{p2.s2pgn}) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipolygon.
	if p2, ok := other.(*MultiPolygon); ok {
		// check the intersection for any polygon in the collection.
		if polylineIntersectsPolygons(pls, p2.s2pgns) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a linestring.
	if ls, ok := other.(*LineString); ok {
		for _, pl := range pls {
			if ls.pl.Intersects(pl) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a multilinestring.
	if mls, ok := other.(*MultiLineString); ok {
		for _, ls := range pls {
			for _, docLineString := range mls.pls {
				if ls.Intersects(docLineString) {
					return true, nil
				}
			}
		}

		return false, nil
	}

	if gc, ok := other.(*GeometryCollection); ok {
		// check whether the linestring intersects with any of the
		// shapes Contains a geometrycollection.
		if geometryCollectionIntersectsShape(gc, shapeIn) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a circle.
	if c, ok := other.(*Circle); ok {
		centre := c.s2cap.Center()
		for _, pl := range pls {
			for i := 0; i < pl.NumEdges(); i++ {
				edge := pl.Edge(i)
				distance := s2.DistanceFromSegment(centre, edge.V0, edge.V1)
				return distance <= c.s2cap.Radius(), nil
			}
		}

		return false, nil
	}

	// check if the other shape is a envelope.
	if e, ok := other.(*Envelope); ok {
		res := rectangleIntersectsWithLineStrings(e.r, pls)

		return res, nil
	}

	return false, fmt.Errorf("unknown geojson type: %s "+
		"found in document", other.Type())
}

// checkLineStringsContainsShape checks the containment for
// points and multipoints for the linestring vertices.
func checkLineStringsContainsShape(pls []*s2.Polyline,
	other index.GeoJSON) (bool, error) {
	return false, nil
}

// ------------------------------------------------------------------------

// checkPolygonIntersectsShape checks the intersection between the
// s2 polygon and the other shapes in the documents.
func checkPolygonIntersectsShape(s2pgn *s2.Polygon, shapeIn,
	other index.GeoJSON) (bool, error) {
	// check if the other shape is a point.
	if p2, ok := other.(*Point); ok {

		s2cell := s2.CellFromPoint(*p2.s2point)
		if s2pgn.IntersectsCell(s2cell) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipoint.
	if p2, ok := other.(*MultiPoint); ok {

		for _, s2point := range p2.s2points {
			s2cell := s2.CellFromPoint(*s2point)
			if s2pgn.IntersectsCell(s2cell) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a polygon.
	if p2, ok := other.(*Polygon); ok {

		if s2pgn.Intersects(p2.s2pgn) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipolygon.
	if p2, ok := other.(*MultiPolygon); ok {
		// check the intersection for any polygon in the collection.
		for _, s2pgn1 := range p2.s2pgns {

			if s2pgn.Intersects(s2pgn1) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a linestring.
	if ls, ok := other.(*LineString); ok {

		if polylineIntersectsPolygons([]*s2.Polyline{ls.pl},
			[]*s2.Polygon{s2pgn}) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multilinestring.
	if mls, ok := other.(*MultiLineString); ok {

		if polylineIntersectsPolygons(mls.pls, []*s2.Polygon{s2pgn}) {
			return true, nil
		}

		return false, nil
	}

	if gc, ok := other.(*GeometryCollection); ok {
		// check whether the polygon intersects with any of the
		// member shapes of the geometry collection.
		if geometryCollectionIntersectsShape(gc, shapeIn) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a circle.
	if c, ok := other.(*Circle); ok {
		cp := c.s2cap.Center()
		radius := c.s2cap.Radius()

		projected := s2pgn.Project(&cp)
		distance := projected.Distance(cp)

		return distance <= radius, nil
	}

	// check if the other shape is a envelope.
	if e, ok := other.(*Envelope); ok {

		s2pgnInDoc := s2PolygonFromS2Rectangle(e.r)
		if s2pgn.Intersects(s2pgnInDoc) {
			return true, nil
		}
		return false, nil
	}

	return false, fmt.Errorf("unknown geojson type: %s "+
		" found in document", other.Type())
}

// checkMultiPolygonContainsShape checks whether the given polygons
// collectively contains the shape in the document.
func checkMultiPolygonContainsShape(s2pgns []*s2.Polygon,
	shapeIn, other index.GeoJSON) (bool, error) {
	// check if the other shape is a point.
	if p2, ok := other.(*Point); ok {

		for _, s2pgn := range s2pgns {
			if s2pgn.ContainsPoint(*p2.s2point) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a multipoint.
	if p2, ok := other.(*MultiPoint); ok {
		// check the containment for every point in the collection.
		pointsWithIn := make(map[int]struct{})
	nextPoint:
		for pointIndex, point := range p2.s2points {

			for _, s2pgn := range s2pgns {
				if s2pgn.ContainsPoint(*point) {
					pointsWithIn[pointIndex] = struct{}{}
					continue nextPoint
				} else {
					// double check for containment with the vertices.
					for _, loop := range s2pgn.Loops() {
						for i := 0; i < loop.NumVertices(); i++ {
							if point.ApproxEqual(loop.Vertex(i)) {
								pointsWithIn[pointIndex] = struct{}{}
								continue nextPoint
							}
						}
					}
				}
			}
		}

		return len(p2.s2points) == len(pointsWithIn), nil
	}

	// check if the other shape is a polygon.
	if p2, ok := other.(*Polygon); ok {

		for _, s2pgn := range s2pgns {
			if s2pgn.Contains(p2.s2pgn) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a multipolygon.
	if p2, ok := other.(*MultiPolygon); ok {
		// check the intersection for every polygon in the collection.
		polygonsWithIn := make(map[int]struct{})

	nextPolygon:
		for pgnIndex, pgn := range p2.s2pgns {
			for _, s2pgn := range s2pgns {
				if s2pgn.Contains(pgn) {
					polygonsWithIn[pgnIndex] = struct{}{}
					continue nextPolygon
				}
			}
		}

		return len(p2.s2pgns) == len(polygonsWithIn), nil
	}

	// check if the other shape is a linestring.
	if ls, ok := other.(*LineString); ok {

		if polygonsContainsLineStrings(s2pgns,
			[]*s2.Polyline{ls.pl}) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multilinestring.
	if mls, ok := other.(*MultiLineString); ok {
		// check whether any of the linestring is inside the polygon.
		if polygonsContainsLineStrings(s2pgns, mls.pls) {
			return true, nil
		}

		return false, nil
	}

	if gc, ok := other.(*GeometryCollection); ok {
		shapesWithIn := make(map[int]struct{})
	nextShape:
		for pos, shape := range gc.Members() {
			for _, s2pgn := range s2pgns {
				contains, err := checkMultiPolygonContainsShape(
					[]*s2.Polygon{s2pgn}, shapeIn, shape)
				if err == nil && contains {
					shapesWithIn[pos] = struct{}{}
					continue nextShape
				}
			}
		}
		return len(shapesWithIn) == len(gc.Members()), nil
	}

	// check if the other shape is a circle.
	if c, ok := other.(*Circle); ok {
		cp := c.s2cap.Center()
		radius := c.s2cap.Radius()

		for _, s2pgn := range s2pgns {

			if s2pgn.ContainsPoint(cp) {
				projected := s2pgn.ProjectToBoundary(&cp)
				distance := projected.Distance(cp)
				if distance >= radius {
					return true, nil
				}
			}
		}

		return false, nil
	}

	// check if the other shape is a envelope.
	if e, ok := other.(*Envelope); ok {
		// create a polygon from the rectangle and checks the containment.
		s2pgnInDoc := s2PolygonFromS2Rectangle(e.r)
		for _, s2pgn := range s2pgns {
			if s2pgn.Contains(s2pgnInDoc) {
				return true, nil
			}
		}

		return false, nil
	}

	return false, fmt.Errorf("unknown geojson type: %s"+
		" found in document", other.Type())
}

// ------------------------------------------------------------------------

// checkCircleIntersectsShape checks for intersection of the
// shape in the document with the circle.
func checkCircleIntersectsShape(s2cap *s2.Cap, shapeIn,
	other index.GeoJSON) (bool, error) {
	// check if the other shape is a point.
	if p2, ok := other.(*Point); ok {
		s2cell := s2.CellFromPoint(*p2.s2point)

		if s2cap.IntersectsCell(s2cell) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipoint.
	if p2, ok := other.(*MultiPoint); ok {
		// check the intersection for any point in the collection.
		for _, point := range p2.s2points {
			s2cell := s2.CellFromPoint(*point)

			if s2cap.IntersectsCell(s2cell) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a polygon.
	if p2, ok := other.(*Polygon); ok {
		centerPoint := s2cap.Center()
		projected := p2.s2pgn.Project(&centerPoint)
		distance := projected.Distance(centerPoint)
		return distance <= s2cap.Radius(), nil
	}

	// check if the other shape is a multipolygon.
	if p2, ok := other.(*MultiPolygon); ok {
		// check the intersection for any polygon in the collection.
		for _, s2pgn := range p2.s2pgns {
			centerPoint := s2cap.Center()
			projected := s2pgn.Project(&centerPoint)
			distance := projected.Distance(centerPoint)
			return distance <= s2cap.Radius(), nil
		}

		return false, nil
	}

	// check if the other shape is a linestring.
	if p2, ok := other.(*LineString); ok {
		projected, _ := p2.pl.Project(s2cap.Center())
		distance := projected.Distance(s2cap.Center())
		return distance <= s2cap.Radius(), nil
	}

	// check if the other shape is a multilinestring.
	if p2, ok := other.(*MultiLineString); ok {
		for _, pl := range p2.pls {
			projected, _ := pl.Project(s2cap.Center())
			distance := projected.Distance(s2cap.Center())
			if distance <= s2cap.Radius() {
				return true, nil
			}
		}

		return false, nil
	}

	if gc, ok := other.(*GeometryCollection); ok {
		// check whether the circle intersects with any of the
		// member shapes Contains the geometrycollection.
		if geometryCollectionIntersectsShape(gc, shapeIn) {
			return true, nil
		}
		return false, nil
	}

	// check if the other shape is a circle.
	if c, ok := other.(*Circle); ok {
		if s2cap.Intersects(*c.s2cap) {
			return true, nil
		}
		return false, nil
	}

	// check if the other shape is a envelope.
	if e, ok := other.(*Envelope); ok {

		if e.r.ContainsPoint(s2cap.Center()) {
			return true, nil
		}

		latlngs := []s2.LatLng{e.r.Vertex(0), e.r.Vertex(1),
			e.r.Vertex(2), e.r.Vertex(3), e.r.Vertex(0)}
		pl := s2.PolylineFromLatLngs(latlngs)
		projected, _ := pl.Project(s2cap.Center())
		distance := projected.Distance(s2cap.Center())
		if distance <= s2cap.Radius() {
			return true, nil
		}

		return false, nil
	}

	return false, fmt.Errorf("unknown geojson type: %s"+
		" found in document", other.Type())
}

// checkCircleContainsShape checks for containment of the
// shape in the document with the circle.
func checkCircleContainsShape(s2cap *s2.Cap,
	shapeIn, other index.GeoJSON) (bool, error) {
	// check if the other shape is a point.
	if p2, ok := other.(*Point); ok {

		if s2cap.ContainsPoint(*p2.s2point) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipoint.
	if p2, ok := other.(*MultiPoint); ok {
		// check the intersection for every point in the collection.
		for _, point := range p2.s2points {
			if !s2cap.ContainsPoint(*point) {
				return false, nil
			}
		}

		return true, nil
	}

	// check if the other shape is a polygon.
	if p2, ok := other.(*Polygon); ok {
		for i := 0; i < p2.s2pgn.NumEdges(); i++ {
			edge := p2.s2pgn.Edge(i)
			if !s2cap.ContainsPoint(edge.V0) ||
				!s2cap.ContainsPoint(edge.V1) {
				return false, nil
			}
		}
		return true, nil
	}

	// check if the other shape is a multipolygon.
	if p2, ok := other.(*MultiPolygon); ok {
		// check the containment for every polygon in the collection.
		for _, s2pgn := range p2.s2pgns {
			for i := 0; i < s2pgn.NumEdges(); i++ {
				edge := s2pgn.Edge(i)
				if !s2cap.ContainsPoint(edge.V0) ||
					!s2cap.ContainsPoint(edge.V1) {
					return false, nil
				}
			}
		}

		return true, nil
	}

	// check if the other shape is a linestring.
	if p2, ok := other.(*LineString); ok {
		for i := 0; i < p2.pl.NumEdges(); i++ {
			edge := p2.pl.Edge(i)
			// check whether both the end vertices are inside the circle.
			if s2cap.ContainsPoint(edge.V0) &&
				s2cap.ContainsPoint(edge.V1) {
				return true, nil
			}
		}
		return false, nil
	}

	// check if the other shape is a multilinestring.
	if p2, ok := other.(*MultiLineString); ok {
		for _, pl := range p2.pls {
			for i := 0; i < pl.NumEdges(); i++ {
				edge := pl.Edge(i)
				// check whether both the end vertices are inside the circle.
				if !(s2cap.ContainsPoint(edge.V0) && s2cap.ContainsPoint(edge.V1)) {
					return false, nil
				}
			}
		}
		return true, nil
	}

	if gc, ok := other.(*GeometryCollection); ok {
		for _, shape := range gc.Members() {
			contains, err := shapeIn.Contains(shape)
			if err == nil && !contains {
				return false, nil
			}
		}
		return true, nil
	}

	// check if the other shape is a circle.
	if c, ok := other.(*Circle); ok {

		if s2cap.Contains(*c.s2cap) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a envelope.
	if e, ok := other.(*Envelope); ok {

		for i := 0; i < 4; i++ {
			if !s2cap.ContainsPoint(
				s2.PointFromLatLng(e.r.Vertex(i))) {
				return false, nil
			}
		}

		return true, nil
	}

	return false, fmt.Errorf("unknown geojson type: %s"+
		" found in document", other.Type())
}

// ------------------------------------------------------------------------

// checkEnvelopeIntersectsShape checks whether the given shape in
// the document is intersecting Contains the envelope/rectangle.
func checkEnvelopeIntersectsShape(s2rect *s2.Rect, shapeIn,
	other index.GeoJSON) (bool, error) {
	// check if the other shape is a point.
	if p2, ok := other.(*Point); ok {
		s2cell := s2.CellFromPoint(*p2.s2point)

		if s2rect.IntersectsCell(s2cell) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipoint.
	if p2, ok := other.(*MultiPoint); ok {
		// check the intersection for any point in the collection.
		for _, point := range p2.s2points {
			s2cell := s2.CellFromPoint(*point)

			if s2rect.IntersectsCell(s2cell) {
				return true, nil
			}
		}

		return false, nil
	}

	// check if the other shape is a polygon.
	if pgn, ok := other.(*Polygon); ok {

		if rectangleIntersectsWithPolygons(s2rect,
			[]*s2.Polygon{pgn.s2pgn}) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipolygon.
	if mpgn, ok := other.(*MultiPolygon); ok {
		// check the intersection for any polygon in the collection.
		if rectangleIntersectsWithPolygons(s2rect, mpgn.s2pgns) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a linestring.
	if ls, ok := other.(*LineString); ok {

		if rectangleIntersectsWithLineStrings(s2rect,
			[]*s2.Polyline{ls.pl}) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multilinestring.
	if mls, ok := other.(*MultiLineString); ok {

		if rectangleIntersectsWithLineStrings(s2rect, mls.pls) {
			return true, nil
		}

		return false, nil
	}

	if gc, ok := other.(*GeometryCollection); ok {
		// check for the intersection of every member shape
		// within the geometrycollection.
		if geometryCollectionIntersectsShape(gc, shapeIn) {
			return true, nil
		}
		return false, nil
	}

	// check if the other shape is a circle.
	if c, ok := other.(*Circle); ok {
		s2pgn := s2PolygonFromS2Rectangle(s2rect)
		cp := c.s2cap.Center()
		projected := s2pgn.Project(&cp)
		distance := projected.Distance(cp)
		return distance <= c.s2cap.Radius(), nil
	}

	// check if the other shape is a envelope.
	if e, ok := other.(*Envelope); ok {

		if s2rect.Intersects(*e.r) {
			return true, nil
		}

		return false, nil
	}

	return false, fmt.Errorf("unknown geojson type: %s"+
		" found in document", other.Type())
}

// checkEnvelopeContainsShape checks whether the given shape in
// the document is contained Contains the envelope/rectangle.
func checkEnvelopeContainsShape(s2rect *s2.Rect, shapeIn,
	other index.GeoJSON) (bool, error) {
	// check if the other shape is a point.
	if p2, ok := other.(*Point); ok {
		s2LatLng := s2.LatLngFromPoint(*p2.s2point)

		if s2rect.ContainsLatLng(s2LatLng) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a multipoint.
	if p2, ok := other.(*MultiPoint); ok {
		// check the intersection for any point in the collection.
		for _, point := range p2.s2points {
			s2LatLng := s2.LatLngFromPoint(*point)

			if !s2rect.ContainsLatLng(s2LatLng) {
				return false, nil
			}
		}

		return true, nil
	}

	// check if the other shape is a polygon.
	if p2, ok := other.(*Polygon); ok {
		s2pgnRect := s2PolygonFromS2Rectangle(s2rect)
		return s2pgnRect.Contains(p2.s2pgn), nil
	}

	// check if the other shape is a multipolygon.
	if p2, ok := other.(*MultiPolygon); ok {
		s2pgnRect := s2PolygonFromS2Rectangle(s2rect)

		// check the containment for every polygon in the collection.
		for _, s2pgn := range p2.s2pgns {
			if !s2pgnRect.Contains(s2pgn) {
				return false, nil
			}
		}

		return true, nil
	}

	// check if the other shape is a linestring.
	if p2, ok := other.(*LineString); ok {
		for i := 0; i < p2.pl.NumEdges(); i++ {
			edge := p2.pl.Edge(i)
			if !s2rect.ContainsPoint(edge.V0) ||
				!s2rect.ContainsPoint(edge.V1) {
				return false, nil
			}
		}

		return true, nil
	}

	// check if the other shape is a multilinestring.
	if p2, ok := other.(*MultiLineString); ok {
		for _, pl := range p2.pls {
			for i := 0; i < pl.NumEdges(); i++ {
				edge := pl.Edge(i)
				if !s2rect.ContainsPoint(edge.V0) ||
					!s2rect.ContainsPoint(edge.V1) {
					return false, nil
				}
			}
		}
		return true, nil
	}

	if gc, ok := other.(*GeometryCollection); ok {
		for _, shape := range gc.Members() {
			contains, err := shapeIn.Contains(shape)
			if err == nil && !contains {
				return false, nil
			}
		}
		return true, nil
	}

	// check if the other shape is a circle.
	if c, ok := other.(*Circle); ok {

		if s2rect.Contains(c.s2cap.RectBound()) {
			return true, nil
		}

		return false, nil
	}

	// check if the other shape is a envelope.
	if e, ok := other.(*Envelope); ok {

		if s2rect.Contains(*e.r) {
			return true, nil
		}

		return false, nil
	}

	return false, fmt.Errorf("unknown geojson type: %s"+
		" found in document", other.Type())
}
