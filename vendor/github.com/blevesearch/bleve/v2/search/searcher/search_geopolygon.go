//  Copyright (c) 2019 Couchbase, Inc.
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
	"context"
	"fmt"
	"math"

	"github.com/blevesearch/bleve/v2/geo"
	"github.com/blevesearch/bleve/v2/numeric"
	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

func NewGeoBoundedPolygonSearcher(ctx context.Context, indexReader index.IndexReader,
	coordinates []geo.Point, field string, boost float64,
	options search.SearcherOptions) (search.Searcher, error) {
	if len(coordinates) < 3 {
		return nil, fmt.Errorf("Too few points specified for the polygon boundary")
	}

	var rectSearcher search.Searcher
	if sr, ok := indexReader.(index.SpatialIndexPlugin); ok {
		tp, err := sr.GetSpatialAnalyzerPlugin("s2")
		if err == nil {
			terms := tp.GetQueryTokens(geo.NewBoundedPolygon(coordinates))
			rectSearcher, err = NewMultiTermSearcher(ctx, indexReader, terms,
				field, boost, options, false)
			if err != nil {
				return nil, err
			}
		}
	}

	// indexes without the spatial plugin override would get
	// initialized here.
	if rectSearcher == nil {
		// compute the bounding box enclosing the polygon
		topLeftLon, topLeftLat, bottomRightLon, bottomRightLat, err :=
			geo.BoundingRectangleForPolygon(coordinates)
		if err != nil {
			return nil, err
		}

		// build a searcher for the bounding box on the polygon
		rectSearcher, err = boxSearcher(ctx, indexReader,
			topLeftLon, topLeftLat, bottomRightLon, bottomRightLat,
			field, boost, options, true)
		if err != nil {
			return nil, err
		}
	}

	dvReader, err := indexReader.DocValueReader([]string{field})
	if err != nil {
		return nil, err
	}

	// wrap it in a filtering searcher that checks for the polygon inclusivity
	return NewFilteringSearcher(ctx, rectSearcher,
		buildPolygonFilter(ctx, dvReader, field, coordinates)), nil
}

const float64EqualityThreshold = 1e-6

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) <= float64EqualityThreshold
}

// buildPolygonFilter returns true if the point lies inside the
// polygon. It is based on the ray-casting technique as referred
// here: https://wrf.ecse.rpi.edu/nikola/pubdetails/pnpoly.html
func buildPolygonFilter(ctx context.Context, dvReader index.DocValueReader, field string,
	coordinates []geo.Point) FilterFunc {
	return func(sctx *search.SearchContext, d *search.DocumentMatch) bool {
		// check geo matches against all numeric type terms indexed
		var lons, lats []float64
		var found bool

		err := dvReader.VisitDocValues(d.IndexInternalID, func(field string, term []byte) {
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
			bytes := dvReader.BytesRead()
			if bytes > 0 {
				reportIOStats(ctx, bytes)
				search.RecordSearchCost(ctx, search.AddM, bytes)
			}
			nVertices := len(coordinates)
			if len(coordinates) < 3 {
				return false
			}
			rayIntersectsSegment := func(point, a, b geo.Point) bool {
				return (a.Lat > point.Lat) != (b.Lat > point.Lat) &&
					point.Lon < (b.Lon-a.Lon)*(point.Lat-a.Lat)/(b.Lat-a.Lat)+a.Lon
			}

			for i := range lons {
				pt := geo.Point{Lon: lons[i], Lat: lats[i]}
				inside := rayIntersectsSegment(pt, coordinates[len(coordinates)-1], coordinates[0])
				// check for a direct vertex match
				if almostEqual(coordinates[0].Lat, lats[i]) &&
					almostEqual(coordinates[0].Lon, lons[i]) {
					return true
				}

				for j := 1; j < nVertices; j++ {
					if almostEqual(coordinates[j].Lat, lats[i]) &&
						almostEqual(coordinates[j].Lon, lons[i]) {
						return true
					}
					if rayIntersectsSegment(pt, coordinates[j-1], coordinates[j]) {
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
