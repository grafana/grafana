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

type filterFunc func(key []byte) bool

var GeoBitsShift1 = geo.GeoBits << 1
var GeoBitsShift1Minus1 = GeoBitsShift1 - 1

func NewGeoBoundingBoxSearcher(indexReader search.Reader, minLon, minLat,
	maxLon, maxLat float64, field string, boost float64, scorer search.Scorer,
	compScorer search.CompositeScorer, options search.SearcherOptions,
	checkBoundaries bool, precisionStep uint) (
	search.Searcher, error) {
	// track list of opened searchers, for cleanup on early exit
	var openedSearchers []search.Searcher
	cleanupOpenedSearchers := func() {
		for _, s := range openedSearchers {
			_ = s.Close()
		}
	}

	// do math to produce list of terms needed for this search
	onBoundaryTerms, notOnBoundaryTerms, err := ComputeGeoRange(0, GeoBitsShift1Minus1,
		minLon, minLat, maxLon, maxLat, checkBoundaries, indexReader, field, precisionStep)
	if err != nil {
		return nil, err
	}

	var onBoundarySearcher search.Searcher
	dvReader, err := indexReader.DocumentValueReader([]string{field})
	if err != nil {
		return nil, err
	}

	if len(onBoundaryTerms) > 0 {
		rawOnBoundarySearcher, err := NewMultiTermSearcherBytes(indexReader,
			onBoundaryTerms, field, boost, scorer, compScorer, options, false)
		if err != nil {
			return nil, err
		}
		// add filter to check points near the boundary
		onBoundarySearcher = NewFilteringSearcher(rawOnBoundarySearcher,
			buildRectFilter(dvReader, minLon, minLat, maxLon, maxLat))
		openedSearchers = append(openedSearchers, onBoundarySearcher)
	}

	var notOnBoundarySearcher search.Searcher
	if len(notOnBoundaryTerms) > 0 {
		var err error
		notOnBoundarySearcher, err = NewMultiTermSearcherBytes(indexReader,
			notOnBoundaryTerms, field, boost, scorer, compScorer, options, false)
		if err != nil {
			cleanupOpenedSearchers()
			return nil, err
		}
		openedSearchers = append(openedSearchers, notOnBoundarySearcher)
	}

	if onBoundarySearcher != nil && notOnBoundarySearcher != nil {
		rv, err := NewDisjunctionSearcher(indexReader,
			[]search.Searcher{
				onBoundarySearcher,
				notOnBoundarySearcher,
			},
			0, similarity.NewCompositeSumScorer(), options)
		if err != nil {
			cleanupOpenedSearchers()
			return nil, err
		}
		return rv, nil
	} else if onBoundarySearcher != nil {
		return onBoundarySearcher, nil
	} else if notOnBoundarySearcher != nil {
		return notOnBoundarySearcher, nil
	}

	return NewMatchNoneSearcher(indexReader, options)
}

func ComputeGeoRange(term uint64, shift uint,
	sminLon, sminLat, smaxLon, smaxLat float64, checkBoundaries bool,
	indexReader search.Reader, field string, precisionStep uint) (
	onBoundary, notOnBoundary [][]byte, err error) {
	var geoMaxShift = precisionStep * 4
	var geoDetailLevel = ((geo.GeoBits << 1) - geoMaxShift) / 2

	isIndexed, closeF, err := buildIsIndexedFunc(indexReader, field)
	if closeF != nil {
		defer func() {
			cerr := closeF()
			if cerr != nil {
				err = cerr
			}
		}()
	}

	grc := &geoRangeCompute{
		preAllocBytesLen: 32,
		preAllocBytes:    make([]byte, 32),
		sminLon:          sminLon,
		sminLat:          sminLat,
		smaxLon:          smaxLon,
		smaxLat:          smaxLat,
		checkBoundaries:  checkBoundaries,
		isIndexed:        isIndexed,
		geoDetailLevel:   geoDetailLevel,
		precisionStep:    precisionStep,
	}

	grc.computeGeoRange(term, shift)

	return grc.onBoundary, grc.notOnBoundary, nil
}

func buildRectFilter(dvReader segment.DocumentValueReader, minLon, minLat, maxLon, maxLat float64) FilterFunc {
	return func(d *search.DocumentMatch) bool {
		// check geo matches against all numeric type terms indexed
		var lons, lats []float64
		var found bool
		err := dvReader.VisitDocumentValues(d.Number, func(field string, term []byte) {
			// only consider the values which are shifted 0
			prefixCoded := numeric.PrefixCoded(term)
			shift, err := prefixCoded.Shift()
			if err == nil && shift == 0 {
				var i64 int64
				i64, err = prefixCoded.Int64()
				if err == nil {
					lons = append(lons, geo.MortonUnhashLon(uint64(i64)))
					lats = append(lats, geo.MortonUnhashLat(uint64(i64)))
					found = true
				}
			}
		})
		if err == nil && found {
			for i := range lons {
				if geo.BoundingBoxContains(lons[i], lats[i],
					minLon, minLat, maxLon, maxLat) {
					return true
				}
			}
		}
		return false
	}
}

type closeFunc func() error

func buildIsIndexedFunc(indexReader search.Reader, field string) (isIndexed filterFunc, closeF closeFunc, err error) {
	if indexReader != nil {
		var dictLookup segment.DictionaryLookup
		dictLookup, err = indexReader.DictionaryLookup(field)
		if err != nil {
			return nil, nil, err
		}

		isIndexed = func(term []byte) bool {
			found, err2 := dictLookup.Contains(term)
			return err2 == nil && found
		}

		closeF = dictLookup.Close
	} else {
		isIndexed = func([]byte) bool {
			return true
		}
	}
	return isIndexed, closeF, err
}

const maxValidShift = 63

type geoRangeCompute struct {
	preAllocBytesLen                   int
	preAllocBytes                      []byte
	sminLon, sminLat, smaxLon, smaxLat float64
	checkBoundaries                    bool
	onBoundary, notOnBoundary          [][]byte
	isIndexed                          func(term []byte) bool
	geoDetailLevel                     uint
	precisionStep                      uint
}

func (grc *geoRangeCompute) makePrefixCoded(in int64, shift uint) (rv numeric.PrefixCoded) {
	if len(grc.preAllocBytes) == 0 {
		grc.preAllocBytesLen *= 2
		grc.preAllocBytes = make([]byte, grc.preAllocBytesLen)
	}

	rv, grc.preAllocBytes, _ =
		numeric.NewPrefixCodedInt64Prealloc(in, shift, grc.preAllocBytes)

	return rv
}

func (grc *geoRangeCompute) computeGeoRange(term uint64, shift uint) {
	split := term | uint64(1)<<shift
	var upperMax uint64
	if shift < maxValidShift {
		upperMax = term | ((uint64(1) << (shift + 1)) - 1)
	} else {
		upperMax = 0xffffffffffffffff
	}
	lowerMax := split - 1
	grc.relateAndRecurse(term, lowerMax, shift)
	grc.relateAndRecurse(split, upperMax, shift)
}

func (grc *geoRangeCompute) relateAndRecurse(start, end uint64, res uint) {
	minLon := geo.MortonUnhashLon(start)
	minLat := geo.MortonUnhashLat(start)
	maxLon := geo.MortonUnhashLon(end)
	maxLat := geo.MortonUnhashLat(end)

	level := ((geo.GeoBits << 1) - res) >> 1

	within := res%grc.precisionStep == 0 &&
		geo.RectWithin(minLon, minLat, maxLon, maxLat,
			grc.sminLon, grc.sminLat, grc.smaxLon, grc.smaxLat)
	if within || (level == grc.geoDetailLevel &&
		geo.RectIntersects(minLon, minLat, maxLon, maxLat,
			grc.sminLon, grc.sminLat, grc.smaxLon, grc.smaxLat)) {
		codedTerm := grc.makePrefixCoded(int64(start), res)
		if grc.isIndexed(codedTerm) {
			if !within && grc.checkBoundaries {
				grc.onBoundary = append(grc.onBoundary, codedTerm)
			} else {
				grc.notOnBoundary = append(grc.notOnBoundary, codedTerm)
			}
		}
	} else if level < grc.geoDetailLevel &&
		geo.RectIntersects(minLon, minLat, maxLon, maxLat,
			grc.sminLon, grc.sminLat, grc.smaxLon, grc.smaxLat) {
		grc.computeGeoRange(start, res-1)
	}
}
