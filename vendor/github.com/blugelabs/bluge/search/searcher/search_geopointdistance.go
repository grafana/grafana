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
	"github.com/blugelabs/bluge/numeric"
	"github.com/blugelabs/bluge/numeric/geo"
	"github.com/blugelabs/bluge/search"
	"github.com/blugelabs/bluge/search/similarity"
	segment "github.com/blugelabs/bluge_segment_api"
)

func NewGeoPointDistanceSearcher(indexReader search.Reader, centerLon,
	centerLat, dist float64, field string, boost float64, scorer search.Scorer,
	compScorer search.CompositeScorer, options search.SearcherOptions,
	precisionStep uint) (search.Searcher, error) {
	// compute bounding box containing the circle
	topLeftLon, topLeftLat, bottomRightLon, bottomRightLat, err :=
		geo.RectFromPointDistance(centerLon, centerLat, dist)
	if err != nil {
		return nil, err
	}

	// build a searcher for the box
	boxSearcher, err := boxSearcher(indexReader,
		topLeftLon, topLeftLat, bottomRightLon, bottomRightLat,
		field, boost, scorer, compScorer, options, false, precisionStep)
	if err != nil {
		return nil, err
	}

	dvReader, err := indexReader.DocumentValueReader([]string{field})
	if err != nil {
		return nil, err
	}

	// wrap it in a filtering searcher which checks the actual distance
	return NewFilteringSearcher(boxSearcher,
		buildDistFilter(dvReader, centerLon, centerLat, dist)), nil
}

// boxSearcher builds a searcher for the described bounding box
// if the desired box crosses the dateline, it is automatically split into
// two boxes joined through a disjunction searcher
func boxSearcher(indexReader search.Reader,
	topLeftLon, topLeftLat, bottomRightLon, bottomRightLat float64,
	field string, boost float64, scorer search.Scorer, compScorer search.CompositeScorer,
	options search.SearcherOptions, checkBoundaries bool, precisionStep uint) (search.Searcher, error) {
	if bottomRightLon < topLeftLon {
		// cross date line, rewrite as two parts

		leftSearcher, err := NewGeoBoundingBoxSearcher(indexReader,
			-180, bottomRightLat, bottomRightLon, topLeftLat,
			field, boost, scorer, compScorer, options, checkBoundaries, precisionStep)
		if err != nil {
			return nil, err
		}
		rightSearcher, err := NewGeoBoundingBoxSearcher(indexReader,
			topLeftLon, bottomRightLat, 180, topLeftLat, field, boost, scorer, compScorer, options,
			checkBoundaries, precisionStep)
		if err != nil {
			_ = leftSearcher.Close()
			return nil, err
		}

		boxSearcher, err := NewDisjunctionSearcher(indexReader,
			[]search.Searcher{leftSearcher, rightSearcher}, 0, similarity.NewCompositeSumScorer(), options)
		if err != nil {
			_ = leftSearcher.Close()
			_ = rightSearcher.Close()
			return nil, err
		}
		return boxSearcher, nil
	}

	// build geoboundingbox searcher for that bounding box
	boxSearcher, err := NewGeoBoundingBoxSearcher(indexReader,
		topLeftLon, bottomRightLat, bottomRightLon, topLeftLat, field, boost, scorer,
		compScorer, options, checkBoundaries, precisionStep)
	if err != nil {
		return nil, err
	}
	return boxSearcher, nil
}

func buildDistFilter(dvReader segment.DocumentValueReader, centerLon, centerLat, maxDist float64) FilterFunc {
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
		if err == nil && found {
			for i := range lons {
				dist := geo.Haversin(lons[i], lats[i], centerLon, centerLat)
				if dist <= maxDist/1000 {
					return true
				}
			}
		}
		return false
	}
}
