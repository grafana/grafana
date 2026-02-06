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
	"strconv"
	"strings"

	index "github.com/blevesearch/bleve_index_api"
	"github.com/blevesearch/geo/s1"
	"github.com/blevesearch/geo/s2"
)

// ------------------------------------------------------------------------

// project the point to all of the linestrings and check if
// any of the projections are equal to the point.
func polylineIntersectsPoint(pls []*s2.Polyline,
	point *s2.Point) bool {
	for _, pl := range pls {
		closest, _ := pl.Project(*point)
		if closest.ApproxEqual(*point) {
			return true
		}
	}

	return false
}

// check if any of the polyline vertices lie inside or
// on the boundary of any of the polygons. Then check if
// any of the polylines intersect with any of the edges of
// the polygons
func polylineIntersectsPolygons(pls []*s2.Polyline,
	s2pgns []*s2.Polygon) bool {
	idx := s2.NewShapeIndex()
	for _, pgn := range s2pgns {
		idx.Add(pgn)
	}

	containsQuery := s2.NewContainsPointQuery(idx, s2.VertexModelClosed)
	for _, pl := range pls {
		for _, point := range *pl {

			// Precheck points within the bounds of the polygon
			// and for small polygons, check if the point is contained
			for _, s2pgn := range s2pgns {
				if !s2pgn.PointWithinBound(point) {
					continue
				}

				if small, inside := s2pgn.SmallPolygonContainsPoint(point); small {
					if inside {
						return true
					}
				}
			}

			if containsQuery.Contains(point) {
				return true
			}
		}
	}

	for _, pl := range pls {
		for _, s2pgn := range s2pgns {
			for i := 0; i < s2pgn.NumEdges(); i++ {
				edgeB := s2pgn.Edge(i)
				latLng1 := s2.LatLngFromPoint(edgeB.V0)
				latLng2 := s2.LatLngFromPoint(edgeB.V1)
				pl2 := s2.PolylineFromLatLngs([]s2.LatLng{latLng1, latLng2})

				if pl.Intersects(pl2) {
					return true
				}
			}
		}
	}

	return false
}

// check if the point is contained within the polygon.
// polygon contains point will consider vertices to be outside
// so we create a shape index and query it instead
// s2.VertexModelClosed will not consider points on the edges, so
// behaviour there is arbitrary
func polygonsIntersectsPoint(s2pgns []*s2.Polygon,
	point *s2.Point) bool {
	idx := s2.NewShapeIndex()
	for _, pgn := range s2pgns {
		if !pgn.PointWithinBound(*point) {
			continue
		}

		// We don't early exit here because the point may be contained
		// on the vertices of the polygon, which is not considered
		if small, inside := pgn.SmallPolygonContainsPoint(*point); small {
			if inside {
				return true
			}
		}

		idx.Add(pgn)
	}

	if idx.Len() == 0 {
		return false
	}

	return s2.NewContainsPointQuery(idx, s2.VertexModelClosed).Contains(*point)
}

func geometryCollectionIntersectsShape(gc *GeometryCollection,
	shapeIn index.GeoJSON) bool {
	for _, shape := range gc.Members() {
		intersects, err := shapeIn.Intersects(shape)
		if err == nil && intersects {
			return true
		}
	}
	return false
}

func polygonsContainsLineStrings(s2pgns []*s2.Polygon,
	pls []*s2.Polyline) bool {
	linesWithIn := make(map[int]struct{})
	checker := s2.NewCrossingEdgeQuery(s2.NewShapeIndex())
nextLine:
	for lineIndex, pl := range pls {
		for i := 0; i < len(*pl)-1; i++ {
			start := (*pl)[i]
			end := (*pl)[i+1]

			for _, s2pgn := range s2pgns {
				containsStart := s2pgn.ContainsPoint(start)
				containsEnd := s2pgn.ContainsPoint(end)
				if containsStart && containsEnd {
					crossings := checker.Crossings(start, end, s2pgn, s2.CrossingTypeInterior)
					if len(crossings) > 0 {
						continue nextLine
					}
					linesWithIn[lineIndex] = struct{}{}
					continue nextLine
				} else {
					for _, loop := range s2pgn.Loops() {
						for i := 0; i < loop.NumVertices(); i++ {
							if !containsStart && start.ApproxEqual(loop.Vertex(i)) {
								containsStart = true
							} else if !containsEnd && end.ApproxEqual(loop.Vertex(i)) {
								containsEnd = true
							}
							if containsStart && containsEnd {
								linesWithIn[lineIndex] = struct{}{}
								continue nextLine
							}
						}
					}
				}
			}
		}
	}

	return len(pls) == len(linesWithIn)
}

func rectangleIntersectsWithPolygons(s2rect *s2.Rect,
	s2pgns []*s2.Polygon) bool {
	s2pgnFromRect := s2PolygonFromS2Rectangle(s2rect)
	for _, s2pgn := range s2pgns {
		if s2pgn.Intersects(s2pgnFromRect) {
			return true
		}
	}

	return false
}

func rectangleIntersectsWithLineStrings(s2rect *s2.Rect,
	polylines []*s2.Polyline) bool {
	s2pgnFromRect := s2PolygonFromS2Rectangle(s2rect)
	return polylineIntersectsPolygons(polylines, []*s2.Polygon{s2pgnFromRect})
}

func s2PolygonFromCoordinates(coordinates [][][]float64) *s2.Polygon {
	loops := make([]*s2.Loop, 0, len(coordinates))
	for _, loop := range coordinates {
		var points []s2.Point
		if loop[0][0] == loop[len(loop)-1][0] && loop[0][1] == loop[len(loop)-1][1] {
			loop = loop[:len(loop)-1]
		}
		for _, point := range loop {
			p := s2.PointFromLatLng(s2.LatLngFromDegrees(point[1], point[0]))
			points = append(points, p)
		}
		s2loop := s2.LoopFromPoints(points)
		loops = append(loops, s2loop)
	}

	rv := s2.PolygonFromOrientedLoops(loops)
	return rv
}

func s2PolygonFromS2Rectangle(s2rect *s2.Rect) *s2.Polygon {
	loops := make([]*s2.Loop, 0, 1)
	var points []s2.Point
	for j := 0; j < 4; j++ {
		points = append(points, s2.PointFromLatLng(s2rect.Vertex(j%4)))
	}

	loops = append(loops, s2.LoopFromPoints(points))
	return s2.PolygonFromLoops(loops)
}

func DeduplicateTerms(terms []string) []string {
	var rv []string
	hash := make(map[string]struct{}, len(terms))
	for _, term := range terms {
		if _, exists := hash[term]; !exists {
			rv = append(rv, term)
			hash[term] = struct{}{}
		}
	}

	return rv
}

//----------------------------------------------------------------------

var earthRadiusInMeter = 6378137.0

func radiusInMetersToS1Angle(radius float64) s1.Angle {
	return s1.Angle(radius / earthRadiusInMeter)
}

func s2PolylinesFromCoordinates(coordinates [][][]float64) []*s2.Polyline {
	var polylines []*s2.Polyline
	for _, lines := range coordinates {
		var latlngs []s2.LatLng
		for _, line := range lines {
			v := s2.LatLngFromDegrees(line[1], line[0])
			latlngs = append(latlngs, v)
		}
		polylines = append(polylines, s2.PolylineFromLatLngs(latlngs))
	}
	return polylines
}

func s2RectFromBounds(topLeft, bottomRight []float64) *s2.Rect {
	rect := s2.EmptyRect()
	rect = rect.AddPoint(s2.LatLngFromDegrees(topLeft[1], topLeft[0]))
	rect = rect.AddPoint(s2.LatLngFromDegrees(bottomRight[1], bottomRight[0]))
	return &rect
}

func s2Cap(vertices []float64, radiusInMeter float64) *s2.Cap {
	cp := s2.PointFromLatLng(s2.LatLngFromDegrees(vertices[1], vertices[0]))
	angle := radiusInMetersToS1Angle(float64(radiusInMeter))
	cap := s2.CapFromCenterAngle(cp, angle)
	return &cap
}

func StripCoveringTerms(terms []string) []string {
	rv := make([]string, 0, len(terms))
	for _, term := range terms {
		if strings.HasPrefix(term, "$") {
			rv = append(rv, term[1:])
			continue
		}
		rv = append(rv, term)
	}
	return DeduplicateTerms(rv)
}

type distanceUnit struct {
	conv     float64
	suffixes []string
}

var inch = distanceUnit{0.0254, []string{"in", "inch"}}
var yard = distanceUnit{0.9144, []string{"yd", "yards"}}
var feet = distanceUnit{0.3048, []string{"ft", "feet"}}
var kilom = distanceUnit{1000, []string{"km", "kilometers"}}
var nauticalm = distanceUnit{1852.0, []string{"nm", "nauticalmiles"}}
var millim = distanceUnit{0.001, []string{"mm", "millimeters"}}
var centim = distanceUnit{0.01, []string{"cm", "centimeters"}}
var miles = distanceUnit{1609.344, []string{"mi", "miles"}}
var meters = distanceUnit{1, []string{"m", "meters"}}

var distanceUnits = []*distanceUnit{
	&inch, &yard, &feet, &kilom, &nauticalm, &millim, &centim, &miles, &meters,
}

// ParseDistance attempts to parse a distance string and return distance in
// meters.  Example formats supported:
// "5in" "5inch" "7yd" "7yards" "9ft" "9feet" "11km" "11kilometers"
// "3nm" "3nauticalmiles" "13mm" "13millimeters" "15cm" "15centimeters"
// "17mi" "17miles" "19m" "19meters"
// If the unit cannot be determined, the entire string is parsed and the
// unit of meters is assumed.
// If the number portion cannot be parsed, 0 and the parse error are returned.
func ParseDistance(d string) (float64, error) {
	for _, unit := range distanceUnits {
		for _, unitSuffix := range unit.suffixes {
			if strings.HasSuffix(d, unitSuffix) {
				parsedNum, err := strconv.ParseFloat(d[0:len(d)-len(unitSuffix)], 64)
				if err != nil {
					return 0, err
				}
				return parsedNum * unit.conv, nil
			}
		}
	}
	// no unit matched, try assuming meters?
	parsedNum, err := strconv.ParseFloat(d, 64)
	if err != nil {
		return 0, err
	}
	return parsedNum, nil
}
