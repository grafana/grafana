//  Copyright (c) 2014 Couchbase, Inc.
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

package collector

import (
	"context"
	"reflect"
	"strconv"
	"time"

	"github.com/blevesearch/bleve/v2/numeric"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeTopNCollector int

func init() {
	var coll TopNCollector
	reflectStaticSizeTopNCollector = int(reflect.TypeOf(coll).Size())
}

type collectorStore interface {
	// Add the document, and if the new store size exceeds the provided size
	// the last element is removed and returned.  If the size has not been
	// exceeded, nil is returned.
	AddNotExceedingSize(doc *search.DocumentMatch, size int) *search.DocumentMatch

	Final(skip int, fixup collectorFixup) (search.DocumentMatchCollection, error)

	// Provide access the internal heap implementation
	Internal() search.DocumentMatchCollection
}

// PreAllocSizeSkipCap will cap preallocation to this amount when
// size+skip exceeds this value
var PreAllocSizeSkipCap = 1000

type collectorCompare func(i, j *search.DocumentMatch) int

type collectorFixup func(d *search.DocumentMatch) error

// TopNCollector collects the top N hits, optionally skipping some results
type TopNCollector struct {
	size          int
	skip          int
	total         uint64
	bytesRead     uint64
	maxScore      float64
	took          time.Duration
	sort          search.SortOrder
	results       search.DocumentMatchCollection
	facetsBuilder *search.FacetsBuilder

	store collectorStore

	needDocIds    bool
	neededFields  []string
	cachedScoring []bool
	cachedDesc    []bool

	lowestMatchOutsideResults *search.DocumentMatch
	updateFieldVisitor        index.DocValueVisitor
	dvReader                  index.DocValueReader
	searchAfter               *search.DocumentMatch

	knnHits             map[string]*search.DocumentMatch
	computeNewScoreExpl search.ScoreExplCorrectionCallbackFunc
}

// CheckDoneEvery controls how frequently we check the context deadline
const CheckDoneEvery = uint64(1024)

// NewTopNCollector builds a collector to find the top 'size' hits
// skipping over the first 'skip' hits
// ordering hits by the provided sort order
func NewTopNCollector(size int, skip int, sort search.SortOrder) *TopNCollector {
	return newTopNCollector(size, skip, sort)
}

// NewTopNCollectorAfter builds a collector to find the top 'size' hits
// skipping over the first 'skip' hits
// ordering hits by the provided sort order
func NewTopNCollectorAfter(size int, sort search.SortOrder, after []string) *TopNCollector {
	rv := newTopNCollector(size, 0, sort)
	rv.searchAfter = createSearchAfterDocument(sort, after)
	return rv
}

func newTopNCollector(size int, skip int, sort search.SortOrder) *TopNCollector {
	hc := &TopNCollector{size: size, skip: skip, sort: sort}

	hc.store = getOptimalCollectorStore(size, skip, func(i, j *search.DocumentMatch) int {
		return hc.sort.Compare(hc.cachedScoring, hc.cachedDesc, i, j)
	})

	// these lookups traverse an interface, so do once up-front
	if sort.RequiresDocID() {
		hc.needDocIds = true
	}
	hc.neededFields = sort.RequiredFields()
	hc.cachedScoring = sort.CacheIsScore()
	hc.cachedDesc = sort.CacheDescending()

	return hc
}

// Creates a dummy document to compare with for pagination.
func createSearchAfterDocument(sort search.SortOrder, after []string) *search.DocumentMatch {
	encodedAfter := make([]string, len(after))
	for i, ss := range sort {
		encodedAfter[i] = encodeSearchAfter(ss, after[i])
	}

	rv := &search.DocumentMatch{
		Sort: encodedAfter,
	}
	for pos, ss := range sort {
		if ss.RequiresDocID() {
			rv.ID = after[pos]
		}
		if ss.RequiresScoring() {
			if score, err := strconv.ParseFloat(after[pos], 64); err == nil {
				rv.Score = score
			}
		}
	}
	return rv
}

// encodeSearchAfter applies prefix-coding to SearchAfter
// if required to enable pagination on numeric, datetime,
// and geo fields
func encodeSearchAfter(ss search.SearchSort, after string) string {
	encodeFloat := func() string {
		f64, _ := strconv.ParseFloat(after, 64) // error checking in SearchRequest.Validate
		i64 := numeric.Float64ToInt64(f64)
		return string(numeric.MustNewPrefixCodedInt64(i64, 0))
	}

	encodeDate := func() string {
		t, _ := time.Parse(time.RFC3339Nano, after) // error checking in SearchRequest.Validate
		i64 := t.UnixNano()
		return string(numeric.MustNewPrefixCodedInt64(i64, 0))
	}

	switch ss := ss.(type) {
	case *search.SortGeoDistance:
		return encodeFloat()
	case *search.SortField:
		switch ss.Type {
		case search.SortFieldAsNumber:
			return encodeFloat()
		case search.SortFieldAsDate:
			return encodeDate()
		default:
			// For SortFieldAsString and SortFieldAuto
			// NOTE: SortFieldAuto is used if you set Sort with a string
			// or if the type of the field is not set in the object
			// in the Sort slice. We cannot perform type inference in
			// this case, so we return the original string, even if
			// its actually numeric or date.
			return after
		}
	default:
		// For SortDocID and SortScore
		return after
	}
}

// Filter document matches based on the SearchAfter field in the SearchRequest.
func FilterHitsBySearchAfter(hits []*search.DocumentMatch, sort search.SortOrder, after []string) []*search.DocumentMatch {
	if len(hits) == 0 {
		return hits
	}
	// create a search after document
	searchAfter := createSearchAfterDocument(sort, after)
	// filter the hits
	idx := 0
	cachedScoring := sort.CacheIsScore()
	cachedDesc := sort.CacheDescending()
	for _, hit := range hits {
		if sort.Compare(cachedScoring, cachedDesc, hit, searchAfter) > 0 {
			hits[idx] = hit
			idx++
		}
	}
	return hits[:idx]
}

func getOptimalCollectorStore(size, skip int, comparator collectorCompare) collectorStore {
	// pre-allocate space on the store to avoid reslicing
	// unless the size + skip is too large, then cap it
	// everything should still work, just reslices as necessary
	backingSize := size + skip + 1
	if size+skip > PreAllocSizeSkipCap {
		backingSize = PreAllocSizeSkipCap + 1
	}

	if size+skip > 10 {
		return newStoreHeap(backingSize, comparator)
	} else {
		return newStoreSlice(backingSize, comparator)
	}
}

func (hc *TopNCollector) Size() int {
	sizeInBytes := reflectStaticSizeTopNCollector + size.SizeOfPtr

	if hc.facetsBuilder != nil {
		sizeInBytes += hc.facetsBuilder.Size()
	}

	for _, entry := range hc.neededFields {
		sizeInBytes += len(entry) + size.SizeOfString
	}

	sizeInBytes += len(hc.cachedScoring) + len(hc.cachedDesc)

	return sizeInBytes
}

// Collect goes to the index to find the matching documents
func (hc *TopNCollector) Collect(ctx context.Context, searcher search.Searcher, reader index.IndexReader) error {
	startTime := time.Now()
	var err error
	var next *search.DocumentMatch

	// pre-allocate enough space in the DocumentMatchPool
	// unless the size + skip is too large, then cap it
	// everything should still work, just allocates DocumentMatches on demand
	backingSize := hc.size + hc.skip + 1
	if hc.size+hc.skip > PreAllocSizeSkipCap {
		backingSize = PreAllocSizeSkipCap + 1
	}
	searchContext := &search.SearchContext{
		DocumentMatchPool: search.NewDocumentMatchPool(backingSize+searcher.DocumentMatchPoolSize(), len(hc.sort)),
		Collector:         hc,
		IndexReader:       reader,
	}

	hc.dvReader, err = reader.DocValueReader(hc.neededFields)
	if err != nil {
		return err
	}

	hc.updateFieldVisitor = func(field string, term []byte) {
		if hc.facetsBuilder != nil {
			hc.facetsBuilder.UpdateVisitor(field, term)
		}
		hc.sort.UpdateVisitor(field, term)
	}

	dmHandlerMaker := MakeTopNDocumentMatchHandler
	if cv := ctx.Value(search.MakeDocumentMatchHandlerKey); cv != nil {
		dmHandlerMaker = cv.(search.MakeDocumentMatchHandler)
	}
	// use the application given builder for making the custom document match
	// handler and perform callbacks/invocations on the newly made handler.
	dmHandler, loadID, err := dmHandlerMaker(searchContext)
	if err != nil {
		return err
	}

	hc.needDocIds = hc.needDocIds || loadID
	select {
	case <-ctx.Done():
		search.RecordSearchCost(ctx, search.AbortM, 0)
		return ctx.Err()
	default:
		next, err = searcher.Next(searchContext)
	}
	for err == nil && next != nil {
		if hc.total%CheckDoneEvery == 0 {
			select {
			case <-ctx.Done():
				search.RecordSearchCost(ctx, search.AbortM, 0)
				return ctx.Err()
			default:
			}
		}

		err = hc.adjustDocumentMatch(searchContext, reader, next)
		if err != nil {
			break
		}

		err = hc.prepareDocumentMatch(searchContext, reader, next, false)
		if err != nil {
			break
		}

		err = dmHandler(next)
		if err != nil {
			break
		}

		next, err = searcher.Next(searchContext)
	}
	if err != nil {
		return err
	}
	if hc.knnHits != nil {
		// we may have some knn hits left that did not match any of the top N tf-idf hits
		// we need to add them to the collector store to consider them as well.
		for _, knnDoc := range hc.knnHits {
			err = hc.prepareDocumentMatch(searchContext, reader, knnDoc, true)
			if err != nil {
				return err
			}
			err = dmHandler(knnDoc)
			if err != nil {
				return err
			}
		}
	}

	statsCallbackFn := ctx.Value(search.SearchIOStatsCallbackKey)
	if statsCallbackFn != nil {
		// hc.bytesRead corresponds to the
		// total bytes read as part of docValues being read every hit
		// which must be accounted by invoking the callback.
		statsCallbackFn.(search.SearchIOStatsCallbackFunc)(hc.bytesRead)

		search.RecordSearchCost(ctx, search.AddM, hc.bytesRead)
	}

	// help finalize/flush the results in case
	// of custom document match handlers.
	err = dmHandler(nil)
	if err != nil {
		return err
	}

	// compute search duration
	hc.took = time.Since(startTime)

	// finalize actual results
	err = hc.finalizeResults(reader)
	if err != nil {
		return err
	}
	return nil
}

var sortByScoreOpt = []string{"_score"}

func (hc *TopNCollector) adjustDocumentMatch(ctx *search.SearchContext,
	reader index.IndexReader, d *search.DocumentMatch) (err error) {
	if hc.knnHits != nil {
		d.ID, err = reader.ExternalID(d.IndexInternalID)
		if err != nil {
			return err
		}
		if knnHit, ok := hc.knnHits[d.ID]; ok {
			d.Score, d.Expl = hc.computeNewScoreExpl(d, knnHit)
			delete(hc.knnHits, d.ID)
		}
	}
	return nil
}

func (hc *TopNCollector) prepareDocumentMatch(ctx *search.SearchContext,
	reader index.IndexReader, d *search.DocumentMatch, isKnnDoc bool) (err error) {

	// visit field terms for features that require it (sort, facets)
	if !isKnnDoc && len(hc.neededFields) > 0 {
		err = hc.visitFieldTerms(reader, d, hc.updateFieldVisitor)
		if err != nil {
			return err
		}
	} else if isKnnDoc && hc.facetsBuilder != nil {
		// we need to visit the field terms for the knn document
		// only for those fields that are required for faceting
		// and not for sorting. This is because the knn document's
		// sort value is already computed in the knn collector.
		err = hc.visitFieldTerms(reader, d, func(field string, term []byte) {
			if hc.facetsBuilder != nil {
				hc.facetsBuilder.UpdateVisitor(field, term)
			}
		})
		if err != nil {
			return err
		}
	}

	// increment total hits
	hc.total++
	d.HitNumber = hc.total

	// update max score
	if d.Score > hc.maxScore {
		hc.maxScore = d.Score
	}
	// early exit as the document match had its sort value calculated in the knn
	// collector itself
	if isKnnDoc {
		return nil
	}

	// see if we need to load ID (at this early stage, for example to sort on it)
	if hc.needDocIds && d.ID == "" {
		d.ID, err = reader.ExternalID(d.IndexInternalID)
		if err != nil {
			return err
		}
	}

	// compute this hits sort value
	if len(hc.sort) == 1 && hc.cachedScoring[0] {
		d.Sort = sortByScoreOpt
	} else {
		hc.sort.Value(d)
	}

	return nil
}

func MakeTopNDocumentMatchHandler(
	ctx *search.SearchContext) (search.DocumentMatchHandler, bool, error) {
	var hc *TopNCollector
	var ok bool
	if hc, ok = ctx.Collector.(*TopNCollector); ok {
		return func(d *search.DocumentMatch) error {
			if d == nil {
				return nil
			}

			// support search after based pagination,
			// if this hit is <= the search after sort key
			// we should skip it
			if hc.searchAfter != nil {
				// exact sort order matches use hit number to break tie
				// but we want to allow for exact match, so we pretend
				hc.searchAfter.HitNumber = d.HitNumber
				if hc.sort.Compare(hc.cachedScoring, hc.cachedDesc, d, hc.searchAfter) <= 0 {
					ctx.DocumentMatchPool.Put(d)
					return nil
				}
			}

			// optimization, we track lowest sorting hit already removed from heap
			// with this one comparison, we can avoid all heap operations if
			// this hit would have been added and then immediately removed
			if hc.lowestMatchOutsideResults != nil {
				cmp := hc.sort.Compare(hc.cachedScoring, hc.cachedDesc, d,
					hc.lowestMatchOutsideResults)
				if cmp >= 0 {
					// this hit can't possibly be in the result set, so avoid heap ops
					ctx.DocumentMatchPool.Put(d)
					return nil
				}
			}

			removed := hc.store.AddNotExceedingSize(d, hc.size+hc.skip)
			if removed != nil {
				if hc.lowestMatchOutsideResults == nil {
					hc.lowestMatchOutsideResults = removed
				} else {
					cmp := hc.sort.Compare(hc.cachedScoring, hc.cachedDesc,
						removed, hc.lowestMatchOutsideResults)
					if cmp < 0 {
						tmp := hc.lowestMatchOutsideResults
						hc.lowestMatchOutsideResults = removed
						ctx.DocumentMatchPool.Put(tmp)
					}
				}
			}
			return nil
		}, false, nil
	}
	return nil, false, nil
}

// visitFieldTerms is responsible for visiting the field terms of the
// search hit, and passing visited terms to the sort and facet builder
func (hc *TopNCollector) visitFieldTerms(reader index.IndexReader, d *search.DocumentMatch, v index.DocValueVisitor) error {
	if hc.facetsBuilder != nil {
		hc.facetsBuilder.StartDoc()
	}
	if d.ID != "" && d.IndexInternalID == nil {
		// this document may have been sent over as preSearchData and
		// we need to look up the internal id to visit the doc values for it
		var err error
		d.IndexInternalID, err = reader.InternalID(d.ID)
		if err != nil {
			return err
		}
	}

	err := hc.dvReader.VisitDocValues(d.IndexInternalID, v)
	if hc.facetsBuilder != nil {
		hc.facetsBuilder.EndDoc()
	}

	hc.bytesRead += hc.dvReader.BytesRead()

	return err
}

// SetFacetsBuilder registers a facet builder for this collector
func (hc *TopNCollector) SetFacetsBuilder(facetsBuilder *search.FacetsBuilder) {
	hc.facetsBuilder = facetsBuilder
	fieldsRequiredForFaceting := facetsBuilder.RequiredFields()
	// for each of these fields, append only if not already there in hc.neededFields.
	for _, field := range fieldsRequiredForFaceting {
		found := false
		for _, neededField := range hc.neededFields {
			if field == neededField {
				found = true
				break
			}
		}
		if !found {
			hc.neededFields = append(hc.neededFields, field)
		}
	}
}

// finalizeResults starts with the heap containing the final top size+skip
// it now throws away the results to be skipped
// and does final doc id lookup (if necessary)
func (hc *TopNCollector) finalizeResults(r index.IndexReader) error {
	var err error
	hc.results, err = hc.store.Final(hc.skip, func(doc *search.DocumentMatch) error {
		if doc.ID == "" {
			// look up the id since we need it for lookup
			var err error
			doc.ID, err = r.ExternalID(doc.IndexInternalID)
			if err != nil {
				return err
			}
		}
		doc.Complete(nil)
		return nil
	})

	return err
}

// Results returns the collected hits
func (hc *TopNCollector) Results() search.DocumentMatchCollection {
	return hc.results
}

// Total returns the total number of hits
func (hc *TopNCollector) Total() uint64 {
	return hc.total
}

// MaxScore returns the maximum score seen across all the hits
func (hc *TopNCollector) MaxScore() float64 {
	return hc.maxScore
}

// Took returns the time spent collecting hits
func (hc *TopNCollector) Took() time.Duration {
	return hc.took
}

// FacetResults returns the computed facets results
func (hc *TopNCollector) FacetResults() search.FacetResults {
	if hc.facetsBuilder != nil {
		return hc.facetsBuilder.Results()
	}
	return nil
}

func (hc *TopNCollector) SetKNNHits(knnHits search.DocumentMatchCollection, newScoreExplComputer search.ScoreExplCorrectionCallbackFunc) {
	hc.knnHits = make(map[string]*search.DocumentMatch, len(knnHits))
	for _, hit := range knnHits {
		hc.knnHits[hit.ID] = hit
	}
	hc.computeNewScoreExpl = newScoreExplComputer
}
