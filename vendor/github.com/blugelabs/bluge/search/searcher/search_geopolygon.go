//  Copyright (c) 2020 Couchbase, Inc.
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

package searcher

import (
	"fmt"
	"math"

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/blugelabs/bluge/numeric"
	"github.com/blugelabs/bluge/numeric/geo"
	"github.com/blugelabs/bluge/search"
)

const minPointsInPolygon = 3

func NewGeoBoundedPolygonSearcher(indexReader search.Reader,
	polygon []geo.Point, field string, boost float64, scorer search.Scorer,
	compScorer search.CompositeScorer, options search.SearcherOptions,
	precisionStep uint) (search.Searcher, error) {
	if len(polygon) < minPointsInPolygon {
		return nil, fmt.Errorf("too few points specified for the polygon boundary")
	}

	// compute the bounding box enclosing the polygon
	topLeftLon, topLeftLat, bottomRightLon, bottomRightLat, err :=
		geo.BoundingRectangleForPolygon(polygon)
	if err != nil {
		return nil, err
	}

	// build a searcher for the bounding box on the polygon
	boxSearcher, err := boxSearcher(indexReader,
		topLeftLon, topLeftLat, bottomRightLon, bottomRightLat,
		field, boost, scorer, compScorer, options, true, precisionStep)
	if err != nil {
		return nil, err
	}

	dvReader, err := indexReader.DocumentValueReader([]string{field})
	if err != nil {
		return nil, err
	}

	// wrap it in a filtering searcher that checks for the polygon inclusivity
	return NewFilteringSearcher(boxSearcher, buildPolygonFilter(dvReader, polygon)), nil
}

const float64EqualityThreshold = 1e-6

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) <= float64EqualityThreshold
}

// buildPolygonFilter returns true if the point lies inside the
// polygon. It is based on the ray-casting technique as referred
// here: https://wrf.ecse.rpi.edu/nikola/pubdetails/pnpoly.html
func buildPolygonFilter(dvReader segment.DocumentValueReader, polygon []geo.Point) FilterFunc {
	return func(d *search.DocumentMatch) bool {
		// check geo matches against all numeric type terms indexed
		var lons, lats []float64
		var found bool

		err := dvReader.VisitDocumentValues(d.Number, func(field string, term []byte) {
			// only consider the values which are shifted 0
			prefixCoded := numeric.PrefixCoded(term)
			shift, err := prefixCoded.Shift()
			if err == nil && shift == 0 {
				i64, err := prefixCoded.Int64()
				if err == nil {
					lons = append(lons, geo.MortonUnhashLon(uint64(i64)))
					lats = append(lats, geo.MortonUnhashLat(uint64(i64)))
					found = true
				}
			}
		})

		// Note: this approach works for points which are strictly inside
		// the polygon. ie it might fail for certain points on the polygon boundaries.
		if err == nil && found {
			nVertices := len(polygon)
			if len(polygon) < minPointsInPolygon {
				return false
			}
			rayIntersectsSegment := func(point, a, b geo.Point) bool {
				return (a.Lat > point.Lat) != (b.Lat > point.Lat) &&
					point.Lon < (b.Lon-a.Lon)*(point.Lat-a.Lat)/(b.Lat-a.Lat)+a.Lon
			}

			for i := range lons {
				pt := geo.Point{Lon: lons[i], Lat: lats[i]}
				inside := rayIntersectsSegment(pt, polygon[len(polygon)-1], polygon[0])
				// check for a direct vertex match
				if almostEqual(polygon[0].Lat, lats[i]) &&
					almostEqual(polygon[0].Lon, lons[i]) {
					return true
				}

				for j := 1; j < nVertices; j++ {
					if almostEqual(polygon[j].Lat, lats[i]) &&
						almostEqual(polygon[j].Lon, lons[i]) {
						return true
					}
					if rayIntersectsSegment(pt, polygon[j-1], polygon[j]) {
						inside = !inside
					}
				}
				if inside {
					return true
				}
			}
		}
		return false
	}
}
