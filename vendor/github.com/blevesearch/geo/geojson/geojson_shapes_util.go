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
	"bytes"
	"encoding/binary"
	"fmt"
	"strings"

	index "github.com/blevesearch/bleve_index_api"
	"github.com/blevesearch/geo/s2"
	jsoniterator "github.com/json-iterator/go"
)

var jsoniter = jsoniterator.ConfigCompatibleWithStandardLibrary

type GeoShape struct {
	// Type of the shape
	Type string

	// Coordinates of the shape
	// Used for all shapes except Circles
	Coordinates [][][][]float64

	// Radius of the circle
	Radius string

	// Center of the circle
	Center []float64
}

// FilterGeoShapesOnRelation extracts the shapes in the document, apply
// the `relation` filter and confirms whether the shape in the document
// satisfies the given relation.
func FilterGeoShapesOnRelation(shape index.GeoJSON, targetShapeBytes []byte,
	relation string, reader **bytes.Reader, bufPool *s2.GeoBufferPool) (bool, error) {

	shapeInDoc, err := extractShapesFromBytes(targetShapeBytes, reader, bufPool)
	if err != nil {
		return false, err
	}

	return filterShapes(shape, shapeInDoc, relation)
}

// extractShapesFromBytes unmarshal the bytes to retrieve the
// embedded geojson shape.
func extractShapesFromBytes(targetShapeBytes []byte, r **bytes.Reader, bufPool *s2.GeoBufferPool) (
	index.GeoJSON, error) {
	if (*r) == nil {
		*r = bytes.NewReader(targetShapeBytes[1:])
	} else {
		(*r).Reset(targetShapeBytes[1:])
	}

	switch targetShapeBytes[0] {
	case PointTypePrefix:
		point := &Point{s2point: &s2.Point{}}
		err := point.s2point.Decode(*r)
		if err != nil {
			return nil, err
		}
		return point, nil

	case MultiPointTypePrefix:
		var numPoints int32
		err := binary.Read(*r, binary.BigEndian, &numPoints)
		if err != nil {
			return nil, err
		}
		multipoint := &MultiPoint{
			s2points: make([]*s2.Point, 0, numPoints),
		}
		for i := 0; i < int(numPoints); i++ {
			s2point := s2.Point{}
			err := s2point.Decode((*r))
			if err != nil {
				return nil, err
			}
			multipoint.s2points = append(multipoint.s2points, &s2point)
		}

		return multipoint, nil

	case LineStringTypePrefix:
		ls := &LineString{pl: &s2.Polyline{}}
		err := ls.pl.Decode(*r)
		if err != nil {
			return nil, err
		}
		return ls, nil

	case MultiLineStringTypePrefix:
		var numLineStrings int32
		err := binary.Read(*r, binary.BigEndian, &numLineStrings)
		if err != nil {
			return nil, err
		}

		mls := &MultiLineString{pls: make([]*s2.Polyline, 0, numLineStrings)}

		for i := 0; i < int(numLineStrings); i++ {
			pl := &s2.Polyline{}
			err := pl.Decode(*r)
			if err != nil {
				return nil, err
			}
			mls.pls = append(mls.pls, pl)
		}

		return mls, nil

	case PolygonTypePrefix:
		pgn := &Polygon{s2pgn: &s2.Polygon{BufPool: bufPool}}
		err := pgn.s2pgn.Decode(*r)
		if err != nil {
			return nil, err
		}

		return pgn, nil

	case MultiPolygonTypePrefix:
		var numPolygons int32
		err := binary.Read(*r, binary.BigEndian, &numPolygons)
		if err != nil {
			return nil, err
		}
		mpgns := &MultiPolygon{s2pgns: make([]*s2.Polygon, 0, numPolygons)}
		for i := 0; i < int(numPolygons); i++ {
			pgn := &s2.Polygon{}
			err := pgn.Decode(*r)
			if err != nil {
				return nil, err
			}
			mpgns.s2pgns = append(mpgns.s2pgns, pgn)
		}

		return mpgns, nil

	case GeometryCollectionTypePrefix:
		var numShapes int32
		err := binary.Read(*r, binary.BigEndian, &numShapes)
		if err != nil {
			return nil, err
		}

		lengths := make([]int32, numShapes)
		for i := int32(0); i < numShapes; i++ {
			var length int32
			err := binary.Read(*r, binary.BigEndian, &length)
			if err != nil {
				return nil, err
			}
			lengths[i] = length
		}

		inputBytes := targetShapeBytes[len(targetShapeBytes)-(*r).Len():]
		gc := &GeometryCollection{Shapes: make([]index.GeoJSON, numShapes)}

		for i := int32(0); i < numShapes; i++ {
			shape, err := extractShapesFromBytes(inputBytes[:lengths[i]], r, nil)
			if err != nil {
				return nil, err
			}

			gc.Shapes[i] = shape
			inputBytes = inputBytes[lengths[i]:]
		}

		return gc, nil

	case CircleTypePrefix:
		c := &Circle{s2cap: &s2.Cap{}}
		err := c.s2cap.Decode(*r)
		if err != nil {
			return nil, err
		}

		return c, nil

	case EnvelopeTypePrefix:
		e := &Envelope{r: &s2.Rect{}}
		err := e.r.Decode(*r)
		if err != nil {
			return nil, err
		}

		return e, nil
	}

	return nil, fmt.Errorf("unknown geo shape type: %v", targetShapeBytes[0])
}

// filterShapes applies the given relation between the query shape
// and the shape in the document.
func filterShapes(shape index.GeoJSON,
	shapeInDoc index.GeoJSON, relation string) (bool, error) {

	if relation == "intersects" {
		return shape.Intersects(shapeInDoc)
	}

	if relation == "contains" {
		return shapeInDoc.Contains(shape)
	}

	if relation == "within" {
		return shape.Contains(shapeInDoc)
	}

	if relation == "disjoint" {
		intersects, err := shape.Intersects(shapeInDoc)
		return !intersects, err
	}

	return false, fmt.Errorf("unknown relation: %s", relation)
}

// ParseGeoJSONShape unmarshals the geojson/circle/envelope shape
// embedded in the given bytes.
func ParseGeoJSONShape(input []byte) (index.GeoJSON, error) {
	var sType string
	var tmp struct {
		Typ string `json:"type"`
	}
	err := jsoniter.Unmarshal(input, &tmp)
	if err != nil {
		return nil, err
	}

	sType = strings.ToLower(tmp.Typ)

	switch sType {
	case PolygonType:
		var rv Polygon
		err := jsoniter.Unmarshal(input, &rv)
		if err != nil {
			return nil, err
		}
		rv.init()
		return &rv, nil

	case MultiPolygonType:
		var rv MultiPolygon
		err := jsoniter.Unmarshal(input, &rv)
		if err != nil {
			return nil, err
		}
		rv.init()
		return &rv, nil

	case PointType:
		var rv Point
		err := jsoniter.Unmarshal(input, &rv)
		if err != nil {
			return nil, err
		}
		rv.init()
		return &rv, nil

	case MultiPointType:
		var rv MultiPoint
		err := jsoniter.Unmarshal(input, &rv)
		if err != nil {
			return nil, err
		}
		rv.init()
		return &rv, nil

	case LineStringType:
		var rv LineString
		err := jsoniter.Unmarshal(input, &rv)
		if err != nil {
			return nil, err
		}
		rv.init()
		return &rv, nil

	case MultiLineStringType:
		var rv MultiLineString
		err := jsoniter.Unmarshal(input, &rv)
		if err != nil {
			return nil, err
		}
		rv.init()
		return &rv, nil

	case GeometryCollectionType:
		var rv GeometryCollection
		err := jsoniter.Unmarshal(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil

	case CircleType:
		var rv Circle
		err := jsoniter.Unmarshal(input, &rv)
		if err != nil {
			return nil, err
		}
		rv.init()
		return &rv, nil

	case EnvelopeType:
		var rv Envelope
		err := jsoniter.Unmarshal(input, &rv)
		if err != nil {
			return nil, err
		}
		rv.init()
		return &rv, nil

	default:
		return nil, fmt.Errorf("unknown shape type: %s", sType)
	}

	return nil, err
}

// NewGeoJsonShape instantiate a geojson shape/circle or
// an envelope from the given coordinates and type.
func NewGeoJsonShape(coordinates [][][][]float64, typ string) (
	index.GeoJSON, []byte, error) {
	if len(coordinates) == 0 {
		return nil, nil, fmt.Errorf("missing coordinates")
	}

	typ = strings.ToLower(typ)

	switch typ {
	case PointType:
		point := NewGeoJsonPoint(coordinates[0][0][0])
		value, err := point.(s2Serializable).Marshal()
		if err != nil {
			return nil, nil, err
		}
		return point, value, nil

	case MultiPointType:
		multipoint := NewGeoJsonMultiPoint(coordinates[0][0])
		value, err := multipoint.(s2Serializable).Marshal()
		if err != nil {
			return nil, nil, err
		}
		return multipoint, value, nil

	case LineStringType:
		linestring := NewGeoJsonLinestring(coordinates[0][0])
		value, err := linestring.(s2Serializable).Marshal()
		if err != nil {
			return nil, nil, err
		}
		return linestring, value, nil

	case MultiLineStringType:
		multilinestring := NewGeoJsonMultilinestring(coordinates[0])
		value, err := multilinestring.(s2Serializable).Marshal()
		if err != nil {
			return nil, nil, err
		}
		return multilinestring, value, nil

	case PolygonType:
		polygon := NewGeoJsonPolygon(coordinates[0])
		value, err := polygon.(s2Serializable).Marshal()
		if err != nil {
			return nil, nil, err
		}
		return polygon, value, nil

	case MultiPolygonType:
		multipolygon := NewGeoJsonMultiPolygon(coordinates)
		value, err := multipolygon.(s2Serializable).Marshal()
		if err != nil {
			return nil, nil, err
		}
		return multipolygon, value, nil

	case EnvelopeType:
		envelope := NewGeoEnvelope(coordinates[0][0])
		value, err := envelope.(s2Serializable).Marshal()
		if err != nil {
			return nil, nil, err
		}
		return envelope, value, nil
	}

	return nil, nil, fmt.Errorf("unknown shape type: %s", typ)
}

// GlueBytes primarily for quicker filtering of docvalues
// during the filtering phase.
var GlueBytes = []byte("##")

// NewGeometryCollection instantiate a geometrycollection
// and prefix the byte contents with certain glue bytes that
// can be used later while filering the doc values.
func NewGeometryCollection(shapes []*GeoShape) (
	index.GeoJSON, []byte, error) {
	for _, shape := range shapes {
		if shape == nil {
			return nil, nil, fmt.Errorf("nil shape")
		}
		if shape.Type == CircleType && shape.Radius == "" && shape.Center == nil {
			return nil, nil, fmt.Errorf("missing radius or center information for some circles")
		}
		if shape.Type != CircleType && shape.Coordinates == nil {
			return nil, nil, fmt.Errorf("missing coordinates for some shapes")
		}
	}

	childShapes := make([]index.GeoJSON, 0, len(shapes))

	for _, shape := range shapes {
		if shape.Type == CircleType {
			circle, _, err := NewGeoCircleShape(shape.Center, shape.Radius)
			if err != nil {
				continue
			}
			childShapes = append(childShapes, circle)
		} else {
			geoShape, _, err := NewGeoJsonShape(shape.Coordinates, shape.Type)
			if err != nil {
				continue
			}
			childShapes = append(childShapes, geoShape)
		}
	}

	var gc GeometryCollection
	gc.Typ = GeometryCollectionType
	gc.Shapes = childShapes
	vbytes, err := gc.Marshal()
	if err != nil {
		return nil, nil, err
	}

	return &gc, vbytes, nil
}

// NewGeoCircleShape instantiate a circle shape and
// prefix the byte contents with certain glue bytes that
// can be used later while filering the doc values.
func NewGeoCircleShape(cp []float64,
	radius string) (*Circle, []byte, error) {
	r, err := ParseDistance(radius)
	if err != nil {
		return nil, nil, err
	}
	rv := &Circle{Typ: CircleType, Vertices: cp,
		Radius:         radius,
		radiusInMeters: r}

	vbytes, err := rv.Marshal()
	if err != nil {
		return nil, nil, err
	}

	return rv, vbytes, nil
}

// ------------------------------------------------------------------------

func (p *Point) IndexTokens(s *s2.RegionTermIndexer) []string {
	p.init()
	terms := s.GetIndexTermsForPoint(*p.s2point, "")
	return StripCoveringTerms(terms)
}

func (p *Point) QueryTokens(s *s2.RegionTermIndexer) []string {
	p.init()
	terms := s.GetQueryTermsForPoint(*p.s2point, "")
	return StripCoveringTerms(terms)
}

// ------------------------------------------------------------------------

func (mp *MultiPoint) IndexTokens(s *s2.RegionTermIndexer) []string {
	mp.init()
	var rv []string
	for _, s2point := range mp.s2points {
		terms := s.GetIndexTermsForPoint(*s2point, "")
		rv = append(rv, terms...)
	}
	return StripCoveringTerms(rv)
}

func (mp *MultiPoint) QueryTokens(s *s2.RegionTermIndexer) []string {
	mp.init()
	var rv []string
	for _, s2point := range mp.s2points {
		terms := s.GetQueryTermsForPoint(*s2point, "")
		rv = append(rv, terms...)
	}

	return StripCoveringTerms(rv)
}

// ------------------------------------------------------------------------

func (ls *LineString) IndexTokens(s *s2.RegionTermIndexer) []string {
	ls.init()
	terms := s.GetIndexTermsForRegion(ls.pl.CapBound(), "")
	return StripCoveringTerms(terms)
}

func (ls *LineString) QueryTokens(s *s2.RegionTermIndexer) []string {
	ls.init()
	terms := s.GetQueryTermsForRegion(ls.pl.CapBound(), "")
	return StripCoveringTerms(terms)
}

// ------------------------------------------------------------------------

func (mls *MultiLineString) IndexTokens(s *s2.RegionTermIndexer) []string {
	mls.init()
	var rv []string
	for _, ls := range mls.pls {
		terms := s.GetIndexTermsForRegion(ls.CapBound(), "")
		rv = append(rv, terms...)
	}

	return StripCoveringTerms(rv)
}

func (mls *MultiLineString) QueryTokens(s *s2.RegionTermIndexer) []string {
	mls.init()

	var rv []string
	for _, ls := range mls.pls {
		terms := s.GetQueryTermsForRegion(ls.CapBound(), "")
		rv = append(rv, terms...)
	}

	return StripCoveringTerms(rv)
}

// ------------------------------------------------------------------------

func (mp *MultiPolygon) IndexTokens(s *s2.RegionTermIndexer) []string {
	mp.init()

	var rv []string
	for _, s2pgn := range mp.s2pgns {
		terms := s.GetIndexTermsForRegion(s2pgn.CapBound(), "")
		rv = append(rv, terms...)
	}

	return StripCoveringTerms(rv)
}

func (mp *MultiPolygon) QueryTokens(s *s2.RegionTermIndexer) []string {
	mp.init()

	var rv []string
	for _, s2pgn := range mp.s2pgns {
		terms := s.GetQueryTermsForRegion(s2pgn.CapBound(), "")
		rv = append(rv, terms...)
	}

	return StripCoveringTerms(rv)
}

// ------------------------------------------------------------------------

func (pgn *Polygon) IndexTokens(s *s2.RegionTermIndexer) []string {
	pgn.init()
	terms := s.GetIndexTermsForRegion(
		pgn.s2pgn.CapBound(), "")
	return StripCoveringTerms(terms)
}

func (pgn *Polygon) QueryTokens(s *s2.RegionTermIndexer) []string {
	pgn.init()
	terms := s.GetQueryTermsForRegion(
		pgn.s2pgn.CapBound(), "")
	return StripCoveringTerms(terms)
}

// ------------------------------------------------------------------------

func (c *Circle) IndexTokens(s *s2.RegionTermIndexer) []string {
	c.init()
	return StripCoveringTerms(s.GetIndexTermsForRegion(c.s2cap.CapBound(), ""))
}

func (c *Circle) QueryTokens(s *s2.RegionTermIndexer) []string {
	c.init()
	return StripCoveringTerms(s.GetQueryTermsForRegion(c.s2cap.CapBound(), ""))
}

// ------------------------------------------------------------------------

func (e *Envelope) IndexTokens(s *s2.RegionTermIndexer) []string {
	e.init()
	return StripCoveringTerms(s.GetIndexTermsForRegion(e.r.CapBound(), ""))
}

func (e *Envelope) QueryTokens(s *s2.RegionTermIndexer) []string {
	e.init()
	return StripCoveringTerms(s.GetQueryTermsForRegion(e.r.CapBound(), ""))
}
