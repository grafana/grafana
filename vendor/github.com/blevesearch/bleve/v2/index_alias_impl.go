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

package bleve

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/collector"
	"github.com/blevesearch/bleve/v2/search/query"
	index "github.com/blevesearch/bleve_index_api"
)

type indexAliasImpl struct {
	name    string
	indexes []Index
	mutex   sync.RWMutex
	open    bool
	// if all the indexes in that alias have the same mapping
	// then the user can set the mapping here to avoid
	// checking the mapping of each index in the alias
	mapping mapping.IndexMapping
}

// NewIndexAlias creates a new IndexAlias over the provided
// Index objects.
func NewIndexAlias(indexes ...Index) *indexAliasImpl {
	return &indexAliasImpl{
		name:    "alias",
		indexes: indexes,
		open:    true,
	}
}

// VisitIndexes invokes the visit callback on every
// indexes included in the index alias.
func (i *indexAliasImpl) VisitIndexes(visit func(Index)) {
	i.mutex.RLock()
	for _, idx := range i.indexes {
		visit(idx)
	}
	i.mutex.RUnlock()
}

func (i *indexAliasImpl) isAliasToSingleIndex() error {
	if len(i.indexes) < 1 {
		return ErrorAliasEmpty
	} else if len(i.indexes) > 1 {
		return ErrorAliasMulti
	}
	return nil
}

func (i *indexAliasImpl) Index(id string, data interface{}) error {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return err
	}

	return i.indexes[0].Index(id, data)
}

func (i *indexAliasImpl) IndexSynonym(id string, collection string, definition *SynonymDefinition) error {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return err
	}

	if si, ok := i.indexes[0].(SynonymIndex); ok {
		return si.IndexSynonym(id, collection, definition)
	}
	return ErrorSynonymSearchNotSupported
}

func (i *indexAliasImpl) Delete(id string) error {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return err
	}

	return i.indexes[0].Delete(id)
}

func (i *indexAliasImpl) Batch(b *Batch) error {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return err
	}

	return i.indexes[0].Batch(b)
}

func (i *indexAliasImpl) Document(id string) (index.Document, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return nil, err
	}

	return i.indexes[0].Document(id)
}

func (i *indexAliasImpl) DocCount() (uint64, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	rv := uint64(0)

	if !i.open {
		return 0, ErrorIndexClosed
	}

	for _, index := range i.indexes {
		otherCount, err := index.DocCount()
		if err == nil {
			rv += otherCount
		}
		// tolerate errors to produce partial counts
	}

	return rv, nil
}

func (i *indexAliasImpl) Search(req *SearchRequest) (*SearchResult, error) {
	return i.SearchInContext(context.Background(), req)
}

func (i *indexAliasImpl) SearchInContext(ctx context.Context, req *SearchRequest) (*SearchResult, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	if len(i.indexes) < 1 {
		return nil, ErrorAliasEmpty
	}

	if _, ok := ctx.Value(search.PreSearchKey).(bool); ok {
		// since preSearchKey is set, it means that the request
		// is being executed as part of a preSearch, which
		// indicates that this index alias is set as an Index
		// in another alias, so we need to do a preSearch search
		// and NOT a real search
		bm25PreSearch := isBM25Enabled(i.mapping)
		flags := &preSearchFlags{
			knn:      requestHasKNN(req),
			synonyms: !isMatchNoneQuery(req.Query),
			bm25:     bm25PreSearch,
		}
		return preSearchDataSearch(ctx, req, flags, i.indexes...)
	}

	// at this point we know we are doing a real search
	// either after a preSearch is done, or directly
	// on the alias

	// check if request has preSearchData which would indicate that the
	// request has already been preSearched and we can skip the
	// preSearch step now, we call an optional function to
	// redistribute the preSearchData to the individual indexes
	// if necessary
	var preSearchData map[string]map[string]interface{}
	if req.PreSearchData != nil {
		var err error
		preSearchData, err = redistributePreSearchData(req, i.indexes)
		if err != nil {
			return nil, err
		}
	}

	// short circuit the simple case
	if len(i.indexes) == 1 {
		if preSearchData != nil {
			req.PreSearchData = preSearchData[i.indexes[0].Name()]
		}
		return i.indexes[0].SearchInContext(ctx, req)
	}

	// rescorer will be set if score fusion is supposed to happen
	// at this alias (root alias), else will be nil
	var rescorer *rescorer
	if _, ok := ctx.Value(search.ScoreFusionKey).(bool); !ok {
		// new context will be used in internal functions to collect data
		// as suitable for fusion. Rescorer is used for rescoring
		// using fusion algorithms.
		if IsScoreFusionRequested(req) {
			ctx = context.WithValue(ctx, search.ScoreFusionKey, true)
			rescorer = newRescorer(req)
			rescorer.prepareSearchRequest()
			defer rescorer.restoreSearchRequest()
		}
	}

	// at this stage we know we have multiple indexes
	// check if preSearchData needs to be gathered from all indexes
	// before executing the query
	var err error
	// only perform preSearch if
	//  - the request does not already have preSearchData
	//  - the request requires preSearch
	var preSearchDuration time.Duration
	var sr *SearchResult

	// fusionKnnHits stores the KnnHits at the root alias.
	// This is used with score fusion in case there is no need to
	// send the knn hits to the leaf indexes in search phase.
	// Refer to constructPreSearchDataAndFusionKnnHits for more info.
	// This variable is left nil if we have to send the knn hits to leaf
	// indexes again, else contains the knn hits if not required.
	var fusionKnnHits search.DocumentMatchCollection
	flags, err := preSearchRequired(ctx, req, i.mapping)
	if err != nil {
		return nil, err
	}
	if req.PreSearchData == nil && flags != nil {
		searchStart := time.Now()
		preSearchResult, err := preSearch(ctx, req, flags, i.indexes...)
		if err != nil {
			return nil, err
		}

		// check if the preSearch result has any errors and if so
		// return the search result as is without executing the query
		// so that the errors are not lost
		if preSearchResult.Status.Failed > 0 || len(preSearchResult.Status.Errors) > 0 {
			return preSearchResult, nil
		}
		// finalize the preSearch result now
		finalizePreSearchResult(req, flags, preSearchResult)

		// if there are no errors, then merge the data in the preSearch result
		// and construct the preSearchData to be used in the actual search
		// if the request is satisfied by the preSearch result, then we can
		// directly return the preSearch result as the final result
		if requestSatisfiedByPreSearch(req, flags) {
			sr = finalizeSearchResult(ctx, req, preSearchResult, rescorer)
			// no need to run the 2nd phase MultiSearch(..)
		} else {
			preSearchData, fusionKnnHits, err = constructPreSearchDataAndFusionKnnHits(req, flags, preSearchResult, rescorer, i.indexes)
			if err != nil {
				return nil, err
			}
		}
		preSearchDuration = time.Since(searchStart)
	}

	// check if search result was generated as part of preSearch itself
	if sr == nil {
		multiSearchParams := &multiSearchParams{preSearchData, rescorer, fusionKnnHits}
		sr, err = MultiSearch(ctx, req, multiSearchParams, i.indexes...)
		if err != nil {
			return nil, err
		}
	}
	sr.Took += preSearchDuration
	return sr, nil
}

func (i *indexAliasImpl) Fields() ([]string, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return nil, err
	}

	return i.indexes[0].Fields()
}

func (i *indexAliasImpl) FieldDict(field string) (index.FieldDict, error) {
	i.mutex.RLock()

	if !i.open {
		i.mutex.RUnlock()
		return nil, ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	fieldDict, err := i.indexes[0].FieldDict(field)
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	return &indexAliasImplFieldDict{
		index:     i,
		fieldDict: fieldDict,
	}, nil
}

func (i *indexAliasImpl) FieldDictRange(field string, startTerm []byte, endTerm []byte) (index.FieldDict, error) {
	i.mutex.RLock()

	if !i.open {
		i.mutex.RUnlock()
		return nil, ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	fieldDict, err := i.indexes[0].FieldDictRange(field, startTerm, endTerm)
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	return &indexAliasImplFieldDict{
		index:     i,
		fieldDict: fieldDict,
	}, nil
}

func (i *indexAliasImpl) FieldDictPrefix(field string, termPrefix []byte) (index.FieldDict, error) {
	i.mutex.RLock()

	if !i.open {
		i.mutex.RUnlock()
		return nil, ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	fieldDict, err := i.indexes[0].FieldDictPrefix(field, termPrefix)
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	return &indexAliasImplFieldDict{
		index:     i,
		fieldDict: fieldDict,
	}, nil
}

func (i *indexAliasImpl) Close() error {
	i.mutex.Lock()
	defer i.mutex.Unlock()

	i.open = false
	return nil
}

// SetIndexMapping sets the mapping for the alias and must be used
// ONLY when all the indexes in the alias have the same mapping.
// This is to avoid checking the mapping of each index in the alias
// when executing a search request.
func (i *indexAliasImpl) SetIndexMapping(m mapping.IndexMapping) error {
	i.mutex.Lock()
	defer i.mutex.Unlock()
	if !i.open {
		return ErrorIndexClosed
	}
	i.mapping = m
	return nil
}

func (i *indexAliasImpl) Mapping() mapping.IndexMapping {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil
	}

	// if the mapping is already set, return it
	if i.mapping != nil {
		return i.mapping
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return nil
	}

	return i.indexes[0].Mapping()
}

func (i *indexAliasImpl) Stats() *IndexStat {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return nil
	}

	return i.indexes[0].Stats()
}

func (i *indexAliasImpl) StatsMap() map[string]interface{} {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return nil
	}

	return i.indexes[0].StatsMap()
}

func (i *indexAliasImpl) GetInternal(key []byte) ([]byte, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return nil, err
	}

	return i.indexes[0].GetInternal(key)
}

func (i *indexAliasImpl) SetInternal(key, val []byte) error {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return err
	}

	return i.indexes[0].SetInternal(key, val)
}

func (i *indexAliasImpl) DeleteInternal(key []byte) error {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return err
	}

	return i.indexes[0].DeleteInternal(key)
}

func (i *indexAliasImpl) Advanced() (index.Index, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return nil, err
	}

	return i.indexes[0].Advanced()
}

func (i *indexAliasImpl) Add(indexes ...Index) {
	i.mutex.Lock()
	defer i.mutex.Unlock()

	i.indexes = append(i.indexes, indexes...)
}

func (i *indexAliasImpl) removeSingle(index Index) {
	for pos, in := range i.indexes {
		if in == index {
			i.indexes = append(i.indexes[:pos], i.indexes[pos+1:]...)
			break
		}
	}
}

func (i *indexAliasImpl) Remove(indexes ...Index) {
	i.mutex.Lock()
	defer i.mutex.Unlock()

	for _, in := range indexes {
		i.removeSingle(in)
	}
}

func (i *indexAliasImpl) Swap(in, out []Index) {
	i.mutex.Lock()
	defer i.mutex.Unlock()

	// add
	i.indexes = append(i.indexes, in...)

	// delete
	for _, ind := range out {
		i.removeSingle(ind)
	}
}

// createChildSearchRequest creates a separate
// request from the original
// For now, avoid data race on req structure.
// TODO disable highlight/field load on child
// requests, and add code to do this only on
// the actual final results.
// Perhaps that part needs to be optional,
// could be slower in remote usages.
func createChildSearchRequest(req *SearchRequest, preSearchData map[string]interface{}) *SearchRequest {
	return copySearchRequest(req, preSearchData)
}

type asyncSearchResult struct {
	Name   string
	Result *SearchResult
	Err    error
}

// preSearchFlags is a struct to hold flags indicating why preSearch is required
type preSearchFlags struct {
	knn      bool
	synonyms bool
	bm25     bool // needs presearch for this too
}

func isBM25Enabled(m mapping.IndexMapping) bool {
	var rv bool
	if m, ok := m.(*mapping.IndexMappingImpl); ok {
		rv = m.ScoringModel == index.BM25Scoring
	}
	return rv
}

// preSearchRequired checks if preSearch is required and returns the presearch flags struct
// indicating which preSearch is required
func preSearchRequired(ctx context.Context, req *SearchRequest, m mapping.IndexMapping) (*preSearchFlags, error) {
	// Check for KNN query
	knn := requestHasKNN(req)
	var synonyms bool
	if !isMatchNoneQuery(req.Query) {
		// Check if synonyms are defined in the mapping
		if sm, ok := m.(mapping.SynonymMapping); ok && sm.SynonymCount() > 0 {
			// check if any of the fields queried have a synonym source
			// in the index mapping, to prevent unnecessary preSearch
			fs, err := query.ExtractFields(req.Query, m, nil)
			if err != nil {
				return nil, err
			}
			for field := range fs {
				if sm.SynonymSourceForPath(field) != "" {
					synonyms = true
					break
				}
			}
		}
	}
	var bm25 bool
	if !isMatchNoneQuery(req.Query) {
		if ctx != nil {
			if searchType := ctx.Value(search.SearchTypeKey); searchType != nil {
				if searchType.(string) == search.GlobalScoring {
					bm25 = isBM25Enabled(m)
				}
			}
		}
	}

	if knn || synonyms || bm25 {
		return &preSearchFlags{
			knn:      knn,
			synonyms: synonyms,
			bm25:     bm25,
		}, nil
	}
	return nil, nil
}

func preSearch(ctx context.Context, req *SearchRequest, flags *preSearchFlags, indexes ...Index) (*SearchResult, error) {
	// create a dummy request with a match none query
	// since we only care about the preSearchData in PreSearch
	dummyQuery := req.Query
	if !flags.bm25 && !flags.synonyms {
		// create a dummy request with a match none query
		// since we only care about the preSearchData in PreSearch
		dummyQuery = query.NewMatchNoneQuery()
	}
	dummyRequest := &SearchRequest{
		Query: dummyQuery,
	}
	newCtx := context.WithValue(ctx, search.PreSearchKey, true)
	if flags.knn {
		addKnnToDummyRequest(dummyRequest, req)
	}
	return preSearchDataSearch(newCtx, dummyRequest, flags, indexes...)
}

// if the request is satisfied by just the preSearch result,
// finalize the result and return it directly without
// performing multi search
func finalizeSearchResult(ctx context.Context, req *SearchRequest, preSearchResult *SearchResult, rescorer *rescorer) *SearchResult {
	if preSearchResult == nil {
		return nil
	}

	// global values across all hits irrespective of pagination settings
	preSearchResult.Total = uint64(preSearchResult.Hits.Len())
	maxScore := float64(0)
	for i, hit := range preSearchResult.Hits {
		// since we are now using the preSearch result as the final result
		// we can discard the indexNames from the hits as they are no longer
		// relevant.
		hit.IndexNames = nil
		if hit.Score > maxScore {
			maxScore = hit.Score
		}
		hit.HitNumber = uint64(i)
	}
	preSearchResult.MaxScore = maxScore
	// now apply pagination settings
	var reverseQueryExecution bool
	if req.SearchBefore != nil {
		reverseQueryExecution = true
		req.Sort.Reverse()
		req.SearchAfter = req.SearchBefore
	}
	if req.SearchAfter != nil {
		preSearchResult.Hits = collector.FilterHitsBySearchAfter(preSearchResult.Hits, req.Sort, req.SearchAfter)
	}

	if rescorer != nil {
		// rescore takes ftsHits and knnHits as first and second argument respectively
		// since this is pure knn, set ftsHits to nil. preSearchResult.Hits contains knn results
		preSearchResult.Hits, preSearchResult.Total, preSearchResult.MaxScore = rescorer.rescore(nil, preSearchResult.Hits)
		rescorer.restoreSearchRequest()
	}

	preSearchResult.Hits = hitsInCurrentPage(req, preSearchResult.Hits)

	if reverseQueryExecution {
		// reverse the sort back to the original
		req.Sort.Reverse()
		// resort using the original order
		mhs := newSearchHitSorter(req.Sort, preSearchResult.Hits)
		req.SortFunc()(mhs)
		req.SearchAfter = nil
	}

	if req.Explain {
		preSearchResult.Request = req
	}
	return preSearchResult
}

func requestSatisfiedByPreSearch(req *SearchRequest, flags *preSearchFlags) bool {
	if flags == nil {
		return false
	}
	// if the synonyms presearch flag is set the request can never be satisfied by
	// the preSearch result as synonyms are not part of the preSearch result
	if flags.synonyms {
		return false
	}
	if flags.knn && isKNNrequestSatisfiedByPreSearch(req) {
		return true
	}
	return false
}

func constructSynonymPreSearchData(rv map[string]map[string]interface{}, sr *SearchResult, indexes []Index) map[string]map[string]interface{} {
	for _, index := range indexes {
		rv[index.Name()][search.SynonymPreSearchDataKey] = sr.SynonymResult
	}
	return rv
}

func constructBM25PreSearchData(rv map[string]map[string]interface{}, sr *SearchResult, indexes []Index) map[string]map[string]interface{} {
	bmStats := sr.BM25Stats
	if bmStats != nil {
		for _, index := range indexes {
			rv[index.Name()][search.BM25PreSearchDataKey] = &search.BM25Stats{
				DocCount:         bmStats.DocCount,
				FieldCardinality: bmStats.FieldCardinality,
			}
		}
	}
	return rv
}

func constructPreSearchData(req *SearchRequest, flags *preSearchFlags,
	preSearchResult *SearchResult, indexes []Index,
) (map[string]map[string]interface{}, error) {
	if flags == nil || preSearchResult == nil {
		return nil, fmt.Errorf("invalid input, flags: %v, preSearchResult: %v", flags, preSearchResult)
	}
	mergedOut := make(map[string]map[string]interface{}, len(indexes))
	for _, index := range indexes {
		mergedOut[index.Name()] = make(map[string]interface{})
	}
	var err error
	if flags.knn {
		mergedOut, err = constructKnnPreSearchData(mergedOut, preSearchResult, indexes)
		if err != nil {
			return nil, err
		}
	}
	if flags.synonyms {
		mergedOut = constructSynonymPreSearchData(mergedOut, preSearchResult, indexes)
	}
	if flags.bm25 {
		mergedOut = constructBM25PreSearchData(mergedOut, preSearchResult, indexes)
	}
	return mergedOut, nil
}

// Constructs the presearch data if required during the search phase.
// Also if we need to store knn hits at alias.
// If we need to store knn hits at alias: returns all the knn hits
// If we should send it to leaf indexes: includes in presearch data
func constructPreSearchDataAndFusionKnnHits(req *SearchRequest, flags *preSearchFlags,
	preSearchResult *SearchResult, rescorer *rescorer, indexes []Index,
) (map[string]map[string]interface{}, search.DocumentMatchCollection, error) {
	var fusionknnhits search.DocumentMatchCollection

	// Checks if we need to send the KNN hits to the indexes in the
	// search phase. If there is score fusion enabled, we do not
	// send the KNN hits to the indexes.
	if rescorer != nil && flags.knn {
		fusionknnhits = preSearchResult.Hits
		preSearchResult.Hits = nil
	}

	preSearchData, err := constructPreSearchData(req, flags, preSearchResult, indexes)
	if err != nil {
		return nil, nil, err
	}

	return preSearchData, fusionknnhits, nil
}

func preSearchDataSearch(ctx context.Context, req *SearchRequest, flags *preSearchFlags, indexes ...Index) (*SearchResult, error) {
	asyncResults := make(chan *asyncSearchResult, len(indexes))
	// run search on each index in separate go routine
	var waitGroup sync.WaitGroup
	searchChildIndex := func(in Index, childReq *SearchRequest) {
		rv := asyncSearchResult{Name: in.Name()}
		rv.Result, rv.Err = in.SearchInContext(ctx, childReq)
		asyncResults <- &rv
		waitGroup.Done()
	}
	waitGroup.Add(len(indexes))
	for _, in := range indexes {
		go searchChildIndex(in, createChildSearchRequest(req, nil))
	}
	// on another go routine, close after finished
	go func() {
		waitGroup.Wait()
		close(asyncResults)
	}()
	// the final search result to be returned after combining the preSearch results
	var sr *SearchResult
	// the preSearch result processor
	var prp preSearchResultProcessor
	// error map
	indexErrors := make(map[string]error)
	for asr := range asyncResults {
		if asr.Err == nil {
			// a valid preSearch result
			if prp == nil {
				// first valid preSearch result
				// create a new preSearch result processor
				prp = createPreSearchResultProcessor(req, flags)
			}
			prp.add(asr.Result, asr.Name)
			if sr == nil {
				// first result
				sr = &SearchResult{
					Status: asr.Result.Status,
					Cost:   asr.Result.Cost,
				}
			} else {
				// merge with previous
				sr.Status.Merge(asr.Result.Status)
				sr.Cost += asr.Result.Cost
			}
		} else {
			indexErrors[asr.Name] = asr.Err
		}
	}
	// handle case where no results were successful
	if sr == nil {
		sr = &SearchResult{
			Status: &SearchStatus{
				Errors: make(map[string]error),
			},
		}
	}
	// in preSearch, partial results are not allowed as it can lead to
	// the real search giving incorrect results, and hence the search
	// result is not populated with any of the processed data from
	// the preSearch result processor if there are any errors
	// or the preSearch result status has any failures
	if len(indexErrors) > 0 || sr.Status.Failed > 0 {
		if sr.Status.Errors == nil {
			sr.Status.Errors = make(map[string]error)
		}
		for indexName, indexErr := range indexErrors {
			sr.Status.Errors[indexName] = indexErr
			sr.Status.Total++
		}
		// At this point, all errors have been recorded—either from the preSearch phase
		// (via status.Merge) or from individual index search failures (indexErrors).
		// Since partial results are not allowed, mark the entire request as failed.
		sr.Status.Successful = 0
		sr.Status.Failed = sr.Status.Total
	} else {
		prp.finalize(sr)
	}
	return sr, nil
}

// redistributePreSearchData redistributes the preSearchData sent in the search request to an index alias
// which would happen in the case of an alias tree and depending on the level of the tree, the preSearchData
// needs to be redistributed to the indexes at that level
func redistributePreSearchData(req *SearchRequest, indexes []Index) (map[string]map[string]interface{}, error) {
	rv := make(map[string]map[string]interface{}, len(indexes))
	for _, index := range indexes {
		rv[index.Name()] = make(map[string]interface{})
	}
	if knnHits, ok := req.PreSearchData[search.KnnPreSearchDataKey].([]*search.DocumentMatch); ok {
		// the preSearchData for KNN is a list of DocumentMatch objects
		// that need to be redistributed to the right index.
		// This is used only in the case of an alias tree, where the indexes
		// are at the leaves of the tree, and the master alias is at the root.
		// At each level of the tree, the preSearchData needs to be redistributed
		// to the indexes/aliases at that level. Because the preSearchData is
		// specific to each final index at the leaf.
		segregatedKnnHits, err := validateAndDistributeKNNHits(knnHits, indexes)
		if err != nil {
			return nil, err
		}
		for _, index := range indexes {
			rv[index.Name()][search.KnnPreSearchDataKey] = segregatedKnnHits[index.Name()]
		}
	}
	if fts, ok := req.PreSearchData[search.SynonymPreSearchDataKey].(search.FieldTermSynonymMap); ok {
		for _, index := range indexes {
			rv[index.Name()][search.SynonymPreSearchDataKey] = fts
		}
	}

	if bm25Data, ok := req.PreSearchData[search.BM25PreSearchDataKey].(*search.BM25Stats); ok {
		for _, index := range indexes {
			rv[index.Name()][search.BM25PreSearchDataKey] = bm25Data
		}
	}
	return rv, nil
}

// finalizePreSearchResult finalizes the preSearch result by applying the finalization steps
// specific to the preSearch flags
func finalizePreSearchResult(req *SearchRequest, flags *preSearchFlags, preSearchResult *SearchResult) {
	// if flags is nil then return
	if flags == nil {
		return
	}
	if flags.knn {
		preSearchResult.Hits = finalizeKNNResults(req, preSearchResult.Hits)
	}
}

// hitsInCurrentPage returns the hits in the current page
// using the From and Size parameters in the request
func hitsInCurrentPage(req *SearchRequest, hits []*search.DocumentMatch) []*search.DocumentMatch {
	sortFunc := req.SortFunc()
	// sort all hits with the requested order
	if len(req.Sort) > 0 {
		sorter := newSearchHitSorter(req.Sort, hits)
		sortFunc(sorter)
	}
	// now skip over the correct From
	if req.From > 0 && len(hits) > req.From {
		hits = hits[req.From:]
	} else if req.From > 0 {
		hits = search.DocumentMatchCollection{}
	}
	// now trim to the correct size
	if req.Size > 0 && len(hits) > req.Size {
		hits = hits[0:req.Size]
	}
	return hits
}

// Extra parameters for MultiSearch
type multiSearchParams struct {
	preSearchData map[string]map[string]interface{}
	rescorer      *rescorer
	fusionKnnHits search.DocumentMatchCollection
}

// MultiSearch executes a SearchRequest across multiple Index objects,
// then merges the results.  The indexes must honor any ctx deadline.
func MultiSearch(ctx context.Context, req *SearchRequest, params *multiSearchParams, indexes ...Index) (*SearchResult, error) {
	searchStart := time.Now()
	asyncResults := make(chan *asyncSearchResult, len(indexes))

	var reverseQueryExecution bool
	if req.SearchBefore != nil {
		reverseQueryExecution = true
		req.Sort.Reverse()
		req.SearchAfter = req.SearchBefore
		req.SearchBefore = nil
	}

	// run search on each index in separate go routine
	var waitGroup sync.WaitGroup

	searchChildIndex := func(in Index, childReq *SearchRequest) {
		rv := asyncSearchResult{Name: in.Name()}
		rv.Result, rv.Err = in.SearchInContext(ctx, childReq)
		asyncResults <- &rv
		waitGroup.Done()
	}

	waitGroup.Add(len(indexes))
	for _, in := range indexes {
		var payload map[string]interface{}
		if params.preSearchData != nil {
			payload = params.preSearchData[in.Name()]
		}
		go searchChildIndex(in, createChildSearchRequest(req, payload))
	}

	// on another go routine, close after finished
	go func() {
		waitGroup.Wait()
		close(asyncResults)
	}()

	var sr *SearchResult
	indexErrors := make(map[string]error)

	for asr := range asyncResults {
		if asr.Err == nil {
			if sr == nil {
				// first result
				sr = asr.Result
			} else {
				// merge with previous
				sr.Merge(asr.Result)
			}
		} else {
			indexErrors[asr.Name] = asr.Err
		}
	}

	// merge just concatenated all the hits
	// now lets clean it up

	// handle case where no results were successful
	if sr == nil {
		sr = &SearchResult{
			Status: &SearchStatus{
				Errors: make(map[string]error),
			},
		}
	}

	if params.rescorer != nil {
		sr.Hits, sr.Total, sr.MaxScore = params.rescorer.rescore(sr.Hits, params.fusionKnnHits)
		params.rescorer.restoreSearchRequest()
	}

	sr.Hits = hitsInCurrentPage(req, sr.Hits)

	// fix up facets
	for name, fr := range req.Facets {
		sr.Facets.Fixup(name, fr.Size)
	}

	if reverseQueryExecution {
		// reverse the sort back to the original
		req.Sort.Reverse()
		// resort using the original order
		mhs := newSearchHitSorter(req.Sort, sr.Hits)
		req.SortFunc()(mhs)
		// reset request
		req.SearchBefore = req.SearchAfter
		req.SearchAfter = nil
	}

	// fix up original request
	if req.Explain {
		sr.Request = req
	}
	searchDuration := time.Since(searchStart)
	sr.Took = searchDuration

	// fix up errors
	if len(indexErrors) > 0 {
		if sr.Status.Errors == nil {
			sr.Status.Errors = make(map[string]error)
		}
		for indexName, indexErr := range indexErrors {
			sr.Status.Errors[indexName] = indexErr
			sr.Status.Total++
			sr.Status.Failed++
		}
	}

	return sr, nil
}

func (i *indexAliasImpl) NewBatch() *Batch {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil
	}

	err := i.isAliasToSingleIndex()
	if err != nil {
		return nil
	}

	return i.indexes[0].NewBatch()
}

func (i *indexAliasImpl) Name() string {
	return i.name
}

func (i *indexAliasImpl) SetName(name string) {
	i.name = name
}

type indexAliasImplFieldDict struct {
	index     *indexAliasImpl
	fieldDict index.FieldDict
}

func (f *indexAliasImplFieldDict) BytesRead() uint64 {
	return f.fieldDict.BytesRead()
}

func (f *indexAliasImplFieldDict) Next() (*index.DictEntry, error) {
	return f.fieldDict.Next()
}

func (f *indexAliasImplFieldDict) Close() error {
	defer f.index.mutex.RUnlock()
	return f.fieldDict.Close()
}

func (f *indexAliasImplFieldDict) Cardinality() int {
	return f.fieldDict.Cardinality()
}

// -----------------------------------------------------------------------------

func (i *indexAliasImpl) TermFrequencies(field string, limit int, descending bool) (
	[]index.TermFreq, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	if len(i.indexes) < 1 {
		return nil, ErrorAliasEmpty
	}

	// short circuit the simple case
	if len(i.indexes) == 1 {
		if idx, ok := i.indexes[0].(InsightsIndex); ok {
			return idx.TermFrequencies(field, limit, descending)
		}
		return nil, nil
	}

	// run search on each index in separate go routine
	var waitGroup sync.WaitGroup
	asyncResults := make(chan []index.TermFreq, len(i.indexes))

	searchChildIndex := func(in Index, field string, limit int, descending bool) {
		var rv []index.TermFreq
		if idx, ok := in.(InsightsIndex); ok {
			// over sample for higher accuracy
			rv, _ = idx.TermFrequencies(field, limit*5, descending)
		}
		asyncResults <- rv
		waitGroup.Done()
	}

	waitGroup.Add(len(i.indexes))
	for _, in := range i.indexes {
		go searchChildIndex(in, field, limit, descending)
	}

	// on another go routine, close after finished
	go func() {
		waitGroup.Wait()
		close(asyncResults)
	}()

	rvTermFreqsMap := make(map[string]uint64)
	for asr := range asyncResults {
		for _, entry := range asr {
			rvTermFreqsMap[entry.Term] += entry.Frequency
		}
	}

	rvTermFreqs := make([]index.TermFreq, 0, len(rvTermFreqsMap))
	for term, freq := range rvTermFreqsMap {
		rvTermFreqs = append(rvTermFreqs, index.TermFreq{
			Term:      term,
			Frequency: freq,
		})
	}

	sort.Slice(rvTermFreqs, func(i, j int) bool {
		if rvTermFreqs[i].Frequency == rvTermFreqs[j].Frequency {
			// If frequencies are equal, sort by term lexicographically
			return rvTermFreqs[i].Term < rvTermFreqs[j].Term
		}
		if descending {
			return rvTermFreqs[i].Frequency > rvTermFreqs[j].Frequency
		}
		return rvTermFreqs[i].Frequency < rvTermFreqs[j].Frequency
	})

	if limit > len(rvTermFreqs) {
		limit = len(rvTermFreqs)
	}

	return rvTermFreqs[:limit], nil
}

func (i *indexAliasImpl) CentroidCardinalities(field string, limit int, descending bool) (
	[]index.CentroidCardinality, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	if len(i.indexes) < 1 {
		return nil, ErrorAliasEmpty
	}

	// short circuit the simple case
	if len(i.indexes) == 1 {
		if idx, ok := i.indexes[0].(InsightsIndex); ok {
			return idx.CentroidCardinalities(field, limit, descending)
		}
		return nil, nil
	}

	// run search on each index in separate go routine
	var waitGroup sync.WaitGroup
	asyncResults := make(chan []index.CentroidCardinality, len(i.indexes))

	searchChildIndex := func(in Index, field string, limit int, descending bool) {
		var rv []index.CentroidCardinality
		if idx, ok := in.(InsightsIndex); ok {
			rv, _ = idx.CentroidCardinalities(field, limit, descending)
		}
		asyncResults <- rv
		waitGroup.Done()
	}

	waitGroup.Add(len(i.indexes))
	for _, in := range i.indexes {
		go searchChildIndex(in, field, limit, descending)
	}

	// on another go routine, close after finished
	go func() {
		waitGroup.Wait()
		close(asyncResults)
	}()

	rvCentroidCardinalities := make([]index.CentroidCardinality, 0, limit*len(i.indexes))
	for asr := range asyncResults {
		rvCentroidCardinalities = append(rvCentroidCardinalities, asr...)
	}

	sort.Slice(rvCentroidCardinalities, func(i, j int) bool {
		if descending {
			return rvCentroidCardinalities[i].Cardinality > rvCentroidCardinalities[j].Cardinality
		} else {
			return rvCentroidCardinalities[i].Cardinality < rvCentroidCardinalities[j].Cardinality
		}
	})

	if limit > len(rvCentroidCardinalities) {
		limit = len(rvCentroidCardinalities)
	}

	return rvCentroidCardinalities[:limit], nil
}
