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
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/blevesearch/bleve/v2/analysis/datetime/timestamp/microseconds"
	"github.com/blevesearch/bleve/v2/analysis/datetime/timestamp/milliseconds"
	"github.com/blevesearch/bleve/v2/analysis/datetime/timestamp/nanoseconds"
	"github.com/blevesearch/bleve/v2/analysis/datetime/timestamp/seconds"
	"github.com/blevesearch/bleve/v2/document"
	"github.com/blevesearch/bleve/v2/index/scorch"
	"github.com/blevesearch/bleve/v2/index/upsidedown"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/registry"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/collector"
	"github.com/blevesearch/bleve/v2/search/facet"
	"github.com/blevesearch/bleve/v2/search/highlight"
	"github.com/blevesearch/bleve/v2/search/query"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
	"github.com/blevesearch/geo/s2"
)

type indexImpl struct {
	path  string
	name  string
	meta  *indexMeta
	i     index.Index
	m     mapping.IndexMapping
	mutex sync.RWMutex
	open  bool
	stats *IndexStat
}

const storePath = "store"

const (
	SearchQueryStartCallbackKey search.ContextKey = "_search_query_start_callback_key"
	SearchQueryEndCallbackKey   search.ContextKey = "_search_query_end_callback_key"
)

type (
	SearchQueryStartCallbackFn func(size uint64) error
	SearchQueryEndCallbackFn   func(size uint64) error
)

func indexStorePath(path string) string {
	return path + string(os.PathSeparator) + storePath
}

func newIndexUsing(path string, mapping mapping.IndexMapping, indexType string, kvstore string, kvconfig map[string]interface{}) (*indexImpl, error) {
	// first validate the mapping
	err := mapping.Validate()
	if err != nil {
		return nil, err
	}

	if kvconfig == nil {
		kvconfig = map[string]interface{}{}
	}

	if kvstore == "" {
		return nil, fmt.Errorf("bleve not configured for file based indexing")
	}

	rv := indexImpl{
		path: path,
		name: path,
		m:    mapping,
		meta: newIndexMeta(indexType, kvstore, kvconfig),
	}
	rv.stats = &IndexStat{i: &rv}
	// at this point there is hope that we can be successful, so save index meta
	if path != "" {
		err = rv.meta.Save(path)
		if err != nil {
			return nil, err
		}
		kvconfig["create_if_missing"] = true
		kvconfig["error_if_exists"] = true
		kvconfig["path"] = indexStorePath(path)
	} else {
		kvconfig["path"] = ""
	}

	// open the index
	indexTypeConstructor := registry.IndexTypeConstructorByName(rv.meta.IndexType)
	if indexTypeConstructor == nil {
		return nil, ErrorUnknownIndexType
	}

	rv.i, err = indexTypeConstructor(rv.meta.Storage, kvconfig, Config.analysisQueue)
	if err != nil {
		return nil, err
	}
	err = rv.i.Open()
	if err != nil {
		return nil, err
	}
	defer func(rv *indexImpl) {
		if !rv.open {
			rv.i.Close()
		}
	}(&rv)

	// now persist the mapping
	mappingBytes, err := util.MarshalJSON(mapping)
	if err != nil {
		return nil, err
	}
	err = rv.i.SetInternal(util.MappingInternalKey, mappingBytes)
	if err != nil {
		return nil, err
	}

	// mark the index as open
	rv.mutex.Lock()
	defer rv.mutex.Unlock()
	rv.open = true
	indexStats.Register(&rv)
	return &rv, nil
}

func openIndexUsing(path string, runtimeConfig map[string]interface{}) (rv *indexImpl, err error) {
	rv = &indexImpl{
		path: path,
		name: path,
	}
	rv.stats = &IndexStat{i: rv}

	rv.meta, err = openIndexMeta(path)
	if err != nil {
		return nil, err
	}

	// backwards compatibility if index type is missing
	if rv.meta.IndexType == "" {
		rv.meta.IndexType = upsidedown.Name
	}

	var um *mapping.IndexMappingImpl
	var umBytes []byte

	storeConfig := rv.meta.Config
	if storeConfig == nil {
		storeConfig = map[string]interface{}{}
	}

	storeConfig["path"] = indexStorePath(path)
	storeConfig["create_if_missing"] = false
	storeConfig["error_if_exists"] = false
	for rck, rcv := range runtimeConfig {
		storeConfig[rck] = rcv
		if rck == "updated_mapping" {
			if val, ok := rcv.(string); ok {
				if len(val) == 0 {
					return nil, fmt.Errorf("updated_mapping is empty")
				}
				umBytes = []byte(val)

				err = util.UnmarshalJSON(umBytes, &um)
				if err != nil {
					return nil, fmt.Errorf("error parsing updated_mapping into JSON: %v\nmapping contents:\n%v", err, rck)
				}
			} else {
				return nil, fmt.Errorf("updated_mapping not of type string")
			}
		}
	}

	// open the index
	indexTypeConstructor := registry.IndexTypeConstructorByName(rv.meta.IndexType)
	if indexTypeConstructor == nil {
		return nil, ErrorUnknownIndexType
	}

	rv.i, err = indexTypeConstructor(rv.meta.Storage, storeConfig, Config.analysisQueue)
	if err != nil {
		return nil, err
	}

	var ui index.UpdateIndex
	if um != nil {
		var ok bool
		ui, ok = rv.i.(index.UpdateIndex)
		if !ok {
			return nil, fmt.Errorf("updated mapping present for unupdatable index")
		}

		// Load the meta data from bolt so that we can read the current index
		// mapping to compare with
		err = ui.OpenMeta()
		if err != nil {
			return nil, err
		}
	} else {
		err = rv.i.Open()
		if err != nil {
			return nil, err
		}
		defer func(rv *indexImpl) {
			if !rv.open {
				rv.i.Close()
			}
		}(rv)
	}

	// now load the mapping
	indexReader, err := rv.i.Reader()
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := indexReader.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	mappingBytes, err := indexReader.GetInternal(util.MappingInternalKey)
	if err != nil {
		return nil, err
	}

	var im *mapping.IndexMappingImpl
	err = util.UnmarshalJSON(mappingBytes, &im)
	if err != nil {
		return nil, fmt.Errorf("error parsing mapping JSON: %v\nmapping contents:\n%s", err, string(mappingBytes))
	}

	// validate the mapping
	err = im.Validate()
	if err != nil {
		// no longer return usable index on error because there
		// is a chance the index is not open at this stage
		return nil, err
	}

	// Validate and update the index with the new mapping
	if um != nil && ui != nil {
		err = um.Validate()
		if err != nil {
			return nil, err
		}

		fieldInfo, err := DeletedFields(im, um)
		if err != nil {
			return nil, err
		}

		err = ui.UpdateFields(fieldInfo, umBytes)
		if err != nil {
			return nil, err
		}
		im = um

		err = rv.i.Open()
		if err != nil {
			return nil, err
		}
		defer func(rv *indexImpl) {
			if !rv.open {
				rv.i.Close()
			}
		}(rv)
	}

	// mark the index as open
	rv.mutex.Lock()
	defer rv.mutex.Unlock()
	rv.open = true

	rv.m = im
	indexStats.Register(rv)
	return rv, err
}

// Advanced returns internal index implementation
func (i *indexImpl) Advanced() (index.Index, error) {
	return i.i, nil
}

// Mapping returns the IndexMapping in use by this
// Index.
func (i *indexImpl) Mapping() mapping.IndexMapping {
	return i.m
}

// Index the object with the specified identifier.
// The IndexMapping for this index will determine
// how the object is indexed.
func (i *indexImpl) Index(id string, data interface{}) (err error) {
	if id == "" {
		return ErrorEmptyID
	}

	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	i.FireIndexEvent()

	doc := document.NewDocument(id)
	err = i.m.MapDocument(doc, data)
	if err != nil {
		return
	}
	err = i.i.Update(doc)
	return
}

// IndexSynonym indexes a synonym definition, with the specified id and belonging to the specified collection.
// Synonym definition defines term relationships for query expansion in searches.
func (i *indexImpl) IndexSynonym(id string, collection string, definition *SynonymDefinition) error {
	if id == "" {
		return ErrorEmptyID
	}

	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	i.FireIndexEvent()

	synMap, ok := i.m.(mapping.SynonymMapping)
	if !ok {
		return ErrorSynonymSearchNotSupported
	}

	if err := definition.Validate(); err != nil {
		return err
	}

	doc := document.NewSynonymDocument(id)
	err := synMap.MapSynonymDocument(doc, collection, definition.Input, definition.Synonyms)
	if err != nil {
		return err
	}
	err = i.i.Update(doc)
	return err
}

// IndexAdvanced takes a document.Document object
// skips the mapping and indexes it.
func (i *indexImpl) IndexAdvanced(doc *document.Document) (err error) {
	if doc.ID() == "" {
		return ErrorEmptyID
	}

	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	err = i.i.Update(doc)
	return
}

// Delete entries for the specified identifier from
// the index.
func (i *indexImpl) Delete(id string) (err error) {
	if id == "" {
		return ErrorEmptyID
	}

	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	err = i.i.Delete(id)
	return
}

// Batch executes multiple Index and Delete
// operations at the same time.  There are often
// significant performance benefits when performing
// operations in a batch.
func (i *indexImpl) Batch(b *Batch) error {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	return i.i.Batch(b.internal)
}

// Document is used to find the values of all the
// stored fields for a document in the index.  These
// stored fields are put back into a Document object
// and returned.
func (i *indexImpl) Document(id string) (doc index.Document, err error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}
	indexReader, err := i.i.Reader()
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := indexReader.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	doc, err = indexReader.Document(id)
	if err != nil {
		return nil, err
	}
	return doc, nil
}

// DocCount returns the number of documents in the
// index.
func (i *indexImpl) DocCount() (count uint64, err error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return 0, ErrorIndexClosed
	}

	// open a reader for this search
	indexReader, err := i.i.Reader()
	if err != nil {
		return 0, fmt.Errorf("error opening index reader %v", err)
	}
	defer func() {
		if cerr := indexReader.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	count, err = indexReader.DocCount()
	return
}

// Search executes a search request operation.
// Returns a SearchResult object or an error.
func (i *indexImpl) Search(req *SearchRequest) (sr *SearchResult, err error) {
	return i.SearchInContext(context.Background(), req)
}

var (
	documentMatchEmptySize int
	searchContextEmptySize int
	facetResultEmptySize   int
	documentEmptySize      int
)

func init() {
	var dm search.DocumentMatch
	documentMatchEmptySize = dm.Size()

	var sc search.SearchContext
	searchContextEmptySize = sc.Size()

	var fr search.FacetResult
	facetResultEmptySize = fr.Size()

	var d document.Document
	documentEmptySize = d.Size()
}

// memNeededForSearch is a helper function that returns an estimate of RAM
// needed to execute a search request.
func memNeededForSearch(req *SearchRequest,
	searcher search.Searcher,
	topnCollector *collector.TopNCollector,
) uint64 {
	backingSize := req.Size + req.From + 1
	if req.Size+req.From > collector.PreAllocSizeSkipCap {
		backingSize = collector.PreAllocSizeSkipCap + 1
	}
	numDocMatches := backingSize + searcher.DocumentMatchPoolSize()

	estimate := 0

	// overhead, size in bytes from collector
	estimate += topnCollector.Size()

	// pre-allocing DocumentMatchPool
	estimate += searchContextEmptySize + numDocMatches*documentMatchEmptySize

	// searcher overhead
	estimate += searcher.Size()

	// overhead from results, lowestMatchOutsideResults
	estimate += (numDocMatches + 1) * documentMatchEmptySize

	// additional overhead from SearchResult
	estimate += reflectStaticSizeSearchResult + reflectStaticSizeSearchStatus

	// overhead from facet results
	if req.Facets != nil {
		estimate += len(req.Facets) * facetResultEmptySize
	}

	// highlighting, store
	if len(req.Fields) > 0 || req.Highlight != nil {
		// Size + From => number of hits
		estimate += (req.Size + req.From) * documentEmptySize
	}

	return uint64(estimate)
}

func (i *indexImpl) preSearch(ctx context.Context, req *SearchRequest, reader index.IndexReader) (*SearchResult, error) {
	var knnHits []*search.DocumentMatch
	var err error
	if requestHasKNN(req) {
		knnHits, err = i.runKnnCollector(ctx, req, reader, true)
		if err != nil {
			return nil, err
		}
	}

	var fts search.FieldTermSynonymMap
	var count uint64
	var fieldCardinality map[string]int
	if !isMatchNoneQuery(req.Query) {
		if synMap, ok := i.m.(mapping.SynonymMapping); ok {
			if synReader, ok := reader.(index.ThesaurusReader); ok {
				fts, err = query.ExtractSynonyms(ctx, synMap, synReader, req.Query, fts)
				if err != nil {
					return nil, err
				}
			}
		}
		if ok := isBM25Enabled(i.m); ok {
			fieldCardinality = make(map[string]int)
			count, err = reader.DocCount()
			if err != nil {
				return nil, err
			}

			fs := make(query.FieldSet)
			fs, err := query.ExtractFields(req.Query, i.m, fs)
			if err != nil {
				return nil, err
			}
			for field := range fs {
				if bm25Reader, ok := reader.(index.BM25Reader); ok {
					fieldCardinality[field], err = bm25Reader.FieldCardinality(field)
					if err != nil {
						return nil, err
					}
				}
			}
		}
	}

	return &SearchResult{
		Status: &SearchStatus{
			Total:      1,
			Successful: 1,
		},
		Hits:          knnHits,
		SynonymResult: fts,
		BM25Stats: &search.BM25Stats{
			DocCount:         float64(count),
			FieldCardinality: fieldCardinality,
		},
	}, nil
}

// SearchInContext executes a search request operation within the provided
// Context. Returns a SearchResult object or an error.
func (i *indexImpl) SearchInContext(ctx context.Context, req *SearchRequest) (sr *SearchResult, err error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	searchStart := time.Now()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	// open a reader for this search
	indexReader, err := i.i.Reader()
	if err != nil {
		return nil, fmt.Errorf("error opening index reader %v", err)
	}
	defer func() {
		if cerr := indexReader.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	// rescorer will be set if score fusion is supposed to happen
	// at this alias (root alias), else will be nil
	var rescorer *rescorer
	if _, ok := ctx.Value(search.ScoreFusionKey).(bool); !ok {
		// new context will be used in internal functions to collect data
		// as suitable for hybrid search. Rescorer is used for rescoring
		// using fusion algorithms.
		if IsScoreFusionRequested(req) {
			ctx = context.WithValue(ctx, search.ScoreFusionKey, true)
			rescorer = newRescorer(req)
			rescorer.prepareSearchRequest()
			defer rescorer.restoreSearchRequest()
		}
	}

	// ------------------------------------------------------------------------------------------
	// set up additional contexts for any search operation that will proceed from
	// here, such as presearch, collectors etc.

	// Scoring model callback to be used to get scoring model
	scoringModelCallback := func() string {
		if isBM25Enabled(i.m) {
			return index.BM25Scoring
		}
		return index.DefaultScoringModel
	}
	ctx = context.WithValue(ctx, search.GetScoringModelCallbackKey,
		search.GetScoringModelCallbackFn(scoringModelCallback))

	// This callback and variable handles the tracking of bytes read
	//  1. as part of creation of tfr and its Next() calls which is
	//     accounted by invoking this callback when the TFR is closed.
	//  2. the docvalues portion (accounted in collector) and the retrieval
	//     of stored fields bytes (by LoadAndHighlightFields)
	var totalSearchCost uint64
	sendBytesRead := func(bytesRead uint64) {
		totalSearchCost += bytesRead
	}
	// Ensure IO cost accounting and result cost assignment happen on all return paths
	defer func() {
		if sr != nil {
			sr.Cost = totalSearchCost
		}
		if is, ok := indexReader.(*scorch.IndexSnapshot); ok {
			is.UpdateIOStats(totalSearchCost)
		}
		search.RecordSearchCost(ctx, search.DoneM, 0)
	}()

	ctx = context.WithValue(ctx, search.SearchIOStatsCallbackKey, search.SearchIOStatsCallbackFunc(sendBytesRead))

	// Geo buffer pool callback to be used for getting geo buffer pool
	var bufPool *s2.GeoBufferPool
	getBufferPool := func() *s2.GeoBufferPool {
		if bufPool == nil {
			bufPool = s2.NewGeoBufferPool(search.MaxGeoBufPoolSize, search.MinGeoBufPoolSize)
		}

		return bufPool
	}

	ctx = context.WithValue(ctx, search.GeoBufferPoolCallbackKey, search.GeoBufferPoolCallbackFunc(getBufferPool))
	// ------------------------------------------------------------------------------------------

	if _, ok := ctx.Value(search.PreSearchKey).(bool); ok {
		sr, err = i.preSearch(ctx, req, indexReader)
		if err != nil {
			return nil, err
		}
		// increment the search count here itself,
		// since the presearch may already satisfy
		// the search request
		atomic.AddUint64(&i.stats.searches, 1)
		// increment the search time stat here as well,
		// since presearch is part of the overall search
		// operation and should be included in the search
		// time stat
		searchDuration := time.Since(searchStart)
		atomic.AddUint64(&i.stats.searchTime, uint64(searchDuration))

		return sr, nil
	}

	var reverseQueryExecution bool
	if req.SearchBefore != nil {
		reverseQueryExecution = true
		req.Sort.Reverse()
		req.SearchAfter = req.SearchBefore
		req.SearchBefore = nil
	}

	var coll *collector.TopNCollector
	if req.SearchAfter != nil {
		coll = collector.NewTopNCollectorAfter(req.Size, req.Sort, req.SearchAfter)
	} else {
		coll = collector.NewTopNCollector(req.Size, req.From, req.Sort)
	}

	var knnHits []*search.DocumentMatch
	var skipKNNCollector bool

	var fts search.FieldTermSynonymMap
	var skipSynonymCollector bool

	var bm25Stats *search.BM25Stats
	var ok bool
	if req.PreSearchData != nil {
		for k, v := range req.PreSearchData {
			switch k {
			case search.KnnPreSearchDataKey:
				if v != nil {
					knnHits, ok = v.([]*search.DocumentMatch)
					if !ok {
						return nil, fmt.Errorf("knn preSearchData must be of type []*search.DocumentMatch")
					}
					skipKNNCollector = true
				}
			case search.SynonymPreSearchDataKey:
				if v != nil {
					fts, ok = v.(search.FieldTermSynonymMap)
					if !ok {
						return nil, fmt.Errorf("synonym preSearchData must be of type search.FieldTermSynonymMap")
					}
					skipSynonymCollector = true
				}
			case search.BM25PreSearchDataKey:
				if v != nil {
					bm25Stats, ok = v.(*search.BM25Stats)
					if !ok {
						return nil, fmt.Errorf("bm25 preSearchData must be of type *search.BM25Stats")
					}
				}
			}
		}
	}

	_, contextScoreFusionKeyExists := ctx.Value(search.ScoreFusionKey).(bool)

	if !contextScoreFusionKeyExists {
		// if no score fusion, default behaviour
		if !skipKNNCollector && requestHasKNN(req) {
			knnHits, err = i.runKnnCollector(ctx, req, indexReader, false)
			if err != nil {
				return nil, err
			}
		}
	} else {
		// if score fusion, run collect if rescorer is defined
		if rescorer != nil && requestHasKNN(req) {
			knnHits, err = i.runKnnCollector(ctx, req, indexReader, false)
			if err != nil {
				return nil, err
			}
		}
	}

	if !skipSynonymCollector {
		if synMap, ok := i.m.(mapping.SynonymMapping); ok && synMap.SynonymCount() > 0 {
			if synReader, ok := indexReader.(index.ThesaurusReader); ok {
				fts, err = query.ExtractSynonyms(ctx, synMap, synReader, req.Query, fts)
				if err != nil {
					return nil, err
				}
			}
		}
	}

	// if score fusion, no faceting for knn hits is done
	// hence we can skip setting the knn hits in the collector
	if !contextScoreFusionKeyExists {
		setKnnHitsInCollector(knnHits, req, coll)
	}

	if fts != nil {
		if is, ok := indexReader.(*scorch.IndexSnapshot); ok {
			is.UpdateSynonymSearchCount(1)
		}
		ctx = context.WithValue(ctx, search.FieldTermSynonymMapKey, fts)
	}

	// set the bm25Stats (stats important for consistent scoring) in
	// the context object
	if bm25Stats != nil {
		ctx = context.WithValue(ctx, search.BM25StatsKey, bm25Stats)
	}

	searcher, err := req.Query.Searcher(ctx, indexReader, i.m, search.SearcherOptions{
		Explain:            req.Explain,
		IncludeTermVectors: req.IncludeLocations || req.Highlight != nil,
		Score:              req.Score,
	})
	if err != nil {
		return nil, err
	}
	defer func() {
		if serr := searcher.Close(); err == nil && serr != nil {
			err = serr
		}
	}()

	if req.Facets != nil {
		facetsBuilder := search.NewFacetsBuilder(indexReader)
		for facetName, facetRequest := range req.Facets {
			if facetRequest.NumericRanges != nil {
				// build numeric range facet
				facetBuilder := facet.NewNumericFacetBuilder(facetRequest.Field, facetRequest.Size)
				for _, nr := range facetRequest.NumericRanges {
					facetBuilder.AddRange(nr.Name, nr.Min, nr.Max)
				}
				facetsBuilder.Add(facetName, facetBuilder)
			} else if facetRequest.DateTimeRanges != nil {
				// build date range facet
				facetBuilder := facet.NewDateTimeFacetBuilder(facetRequest.Field, facetRequest.Size)
				for _, dr := range facetRequest.DateTimeRanges {
					dateTimeParserName := defaultDateTimeParser
					if dr.DateTimeParser != "" {
						dateTimeParserName = dr.DateTimeParser
					}
					dateTimeParser := i.m.DateTimeParserNamed(dateTimeParserName)
					if dateTimeParser == nil {
						return nil, fmt.Errorf("no date time parser named `%s` registered", dateTimeParserName)
					}
					start, end, err := dr.ParseDates(dateTimeParser)
					if err != nil {
						return nil, fmt.Errorf("ParseDates err: %v, using date time parser named %s", err, dateTimeParserName)
					}
					if start.IsZero() && end.IsZero() {
						return nil, fmt.Errorf("date range query must specify either start, end or both for date range name '%s'", dr.Name)
					}
					facetBuilder.AddRange(dr.Name, start, end)
				}
				facetsBuilder.Add(facetName, facetBuilder)
			} else {
				// build terms facet
				facetBuilder := facet.NewTermsFacetBuilder(facetRequest.Field, facetRequest.Size)

				// Set prefix filter if provided
				if facetRequest.TermPrefix != "" {
					facetBuilder.SetPrefixFilter(facetRequest.TermPrefix)
				}

				// Set regex filter if provided
				if facetRequest.TermPattern != "" {
					// Use cached compiled pattern if available, otherwise compile it now
					if facetRequest.compiledPattern != nil {
						facetBuilder.SetRegexFilter(facetRequest.compiledPattern)
					} else {
						regex, err := regexp.Compile(facetRequest.TermPattern)
						if err != nil {
							return nil, fmt.Errorf("error compiling regex pattern for facet '%s': %v", facetName, err)
						}
						facetBuilder.SetRegexFilter(regex)
					}
				}

				facetsBuilder.Add(facetName, facetBuilder)
			}
		}
		coll.SetFacetsBuilder(facetsBuilder)
	}

	memNeeded := memNeededForSearch(req, searcher, coll)
	if cb := ctx.Value(SearchQueryStartCallbackKey); cb != nil {
		if cbF, ok := cb.(SearchQueryStartCallbackFn); ok {
			err = cbF(memNeeded)
		}
	}
	if err != nil {
		return nil, err
	}

	if cb := ctx.Value(SearchQueryEndCallbackKey); cb != nil {
		if cbF, ok := cb.(SearchQueryEndCallbackFn); ok {
			defer func() {
				_ = cbF(memNeeded)
			}()
		}
	}

	err = coll.Collect(ctx, searcher, indexReader)
	if err != nil {
		return nil, err
	}

	hits := coll.Results()

	var highlighter highlight.Highlighter

	if req.Highlight != nil {
		// get the right highlighter
		highlighter, err = Config.Cache.HighlighterNamed(Config.DefaultHighlighter)
		if err != nil {
			return nil, err
		}
		if req.Highlight.Style != nil {
			highlighter, err = Config.Cache.HighlighterNamed(*req.Highlight.Style)
			if err != nil {
				return nil, err
			}
		}
		if highlighter == nil {
			return nil, fmt.Errorf("no highlighter named `%s` registered", *req.Highlight.Style)
		}
	}

	var storedFieldsCost uint64
	for _, hit := range hits {
		// KNN documents will already have their Index value set as part of the knn collector output
		// so check if the index is empty and set it to the current index name
		if i.name != "" && hit.Index == "" {
			hit.Index = i.name
		}
		err, storedFieldsBytes := LoadAndHighlightFields(hit, req, i.name, indexReader, highlighter)
		if err != nil {
			return nil, err
		}
		storedFieldsCost += storedFieldsBytes
	}

	totalSearchCost += storedFieldsCost
	search.RecordSearchCost(ctx, search.AddM, storedFieldsCost)

	if req.PreSearchData == nil {
		// increment the search count only if this is not a second-phase search
		// (e.g., for Hybrid Search), since the first-phase search already increments it
		atomic.AddUint64(&i.stats.searches, 1)
	}
	// increment the search time stat, as the first-phase search is part of
	// the overall operation; adding second-phase time later keeps it accurate
	searchDuration := time.Since(searchStart)
	atomic.AddUint64(&i.stats.searchTime, uint64(searchDuration))

	if Config.SlowSearchLogThreshold > 0 &&
		searchDuration > Config.SlowSearchLogThreshold {
		logger.Printf("slow search took %s - %v", searchDuration, req)
	}

	if reverseQueryExecution {
		// reverse the sort back to the original
		req.Sort.Reverse()
		// resort using the original order
		mhs := newSearchHitSorter(req.Sort, hits)
		req.SortFunc()(mhs)
		// reset request
		req.SearchBefore = req.SearchAfter
		req.SearchAfter = nil
	}

	rv := &SearchResult{
		Status: &SearchStatus{
			Total:      1,
			Successful: 1,
		},
		Hits:     hits,
		Total:    coll.Total(),
		MaxScore: coll.MaxScore(),
		Took:     searchDuration,
		Facets:   coll.FacetResults(),
	}

	// rescore if fusion flag is set
	if rescorer != nil {
		rv.Hits, rv.Total, rv.MaxScore = rescorer.rescore(rv.Hits, knnHits)
		rescorer.restoreSearchRequest()
		rv.Hits = hitsInCurrentPage(req, rv.Hits)
	}

	if req.Explain {
		rv.Request = req
	}

	return rv, nil
}

func LoadAndHighlightFields(hit *search.DocumentMatch, req *SearchRequest,
	indexName string, r index.IndexReader,
	highlighter highlight.Highlighter,
) (error, uint64) {
	var totalStoredFieldsBytes uint64
	if len(req.Fields) > 0 || highlighter != nil {
		doc, err := r.Document(hit.ID)
		if err == nil && doc != nil {
			if len(req.Fields) > 0 && hit.Fields == nil {
				totalStoredFieldsBytes = doc.StoredFieldsBytes()
				fieldsToLoad := deDuplicate(req.Fields)
				for _, f := range fieldsToLoad {
					doc.VisitFields(func(docF index.Field) {
						if f == "*" || docF.Name() == f {
							var value interface{}
							switch docF := docF.(type) {
							case index.TextField:
								value = docF.Text()
							case index.NumericField:
								num, err := docF.Number()
								if err == nil {
									value = num
								}
							case index.DateTimeField:
								datetime, layout, err := docF.DateTime()
								if err == nil {
									if layout == "" {
										// missing layout means we fallback to
										// the default layout which is RFC3339
										value = datetime.Format(time.RFC3339)
									} else {
										// the layout here can now either be representative
										// of an actual datetime layout or a timestamp
										switch layout {
										case seconds.Name:
											value = strconv.FormatInt(datetime.Unix(), 10)
										case milliseconds.Name:
											value = strconv.FormatInt(datetime.UnixMilli(), 10)
										case microseconds.Name:
											value = strconv.FormatInt(datetime.UnixMicro(), 10)
										case nanoseconds.Name:
											value = strconv.FormatInt(datetime.UnixNano(), 10)
										default:
											// the layout for formatting the date to a string
											// is provided by a datetime parser which is not
											// handling the timestamp case, hence the layout
											// can be directly used to format the date
											value = datetime.Format(layout)
										}
									}
								}
							case index.BooleanField:
								boolean, err := docF.Boolean()
								if err == nil {
									value = boolean
								}
							case index.GeoPointField:
								lon, err := docF.Lon()
								if err == nil {
									lat, err := docF.Lat()
									if err == nil {
										value = []float64{lon, lat}
									}
								}
							case index.GeoShapeField:
								v, err := docF.GeoShape()
								if err == nil {
									value = v
								}
							case index.IPField:
								ip, err := docF.IP()
								if err == nil {
									value = ip.String()
								}
							}

							if value != nil {
								hit.AddFieldValue(docF.Name(), value)
							}
						}
					})
				}
			}
			if highlighter != nil {
				highlightFields := req.Highlight.Fields
				if highlightFields == nil {
					// add all fields with matches
					highlightFields = make([]string, 0, len(hit.Locations))
					for k := range hit.Locations {
						highlightFields = append(highlightFields, k)
					}
				}
				for _, hf := range highlightFields {
					highlighter.BestFragmentsInField(hit, doc, hf, 1)
				}
			}
		} else if doc == nil {
			// unexpected case, a doc ID that was found as a search hit
			// was unable to be found during document lookup
			return ErrorIndexReadInconsistency, 0
		}
	}

	return nil, totalStoredFieldsBytes
}

// Fields returns the name of all the fields this
// Index has operated on.
func (i *indexImpl) Fields() (fields []string, err error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	indexReader, err := i.i.Reader()
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := indexReader.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	fields, err = indexReader.Fields()
	if err != nil {
		return nil, err
	}
	return fields, nil
}

func (i *indexImpl) FieldDict(field string) (index.FieldDict, error) {
	i.mutex.RLock()

	if !i.open {
		i.mutex.RUnlock()
		return nil, ErrorIndexClosed
	}

	indexReader, err := i.i.Reader()
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	fieldDict, err := indexReader.FieldDict(field)
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	return &indexImplFieldDict{
		index:       i,
		indexReader: indexReader,
		fieldDict:   fieldDict,
	}, nil
}

func (i *indexImpl) FieldDictRange(field string, startTerm []byte, endTerm []byte) (index.FieldDict, error) {
	i.mutex.RLock()

	if !i.open {
		i.mutex.RUnlock()
		return nil, ErrorIndexClosed
	}

	indexReader, err := i.i.Reader()
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	fieldDict, err := indexReader.FieldDictRange(field, startTerm, endTerm)
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	return &indexImplFieldDict{
		index:       i,
		indexReader: indexReader,
		fieldDict:   fieldDict,
	}, nil
}

func (i *indexImpl) FieldDictPrefix(field string, termPrefix []byte) (index.FieldDict, error) {
	i.mutex.RLock()

	if !i.open {
		i.mutex.RUnlock()
		return nil, ErrorIndexClosed
	}

	indexReader, err := i.i.Reader()
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	fieldDict, err := indexReader.FieldDictPrefix(field, termPrefix)
	if err != nil {
		i.mutex.RUnlock()
		return nil, err
	}

	return &indexImplFieldDict{
		index:       i,
		indexReader: indexReader,
		fieldDict:   fieldDict,
	}, nil
}

func (i *indexImpl) Close() error {
	i.mutex.Lock()
	defer i.mutex.Unlock()

	indexStats.UnRegister(i)

	i.open = false
	return i.i.Close()
}

func (i *indexImpl) Stats() *IndexStat {
	return i.stats
}

func (i *indexImpl) StatsMap() map[string]interface{} {
	return i.stats.statsMap()
}

func (i *indexImpl) GetInternal(key []byte) (val []byte, err error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	reader, err := i.i.Reader()
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := reader.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	val, err = reader.GetInternal(key)
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (i *indexImpl) SetInternal(key, val []byte) error {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	return i.i.SetInternal(key, val)
}

func (i *indexImpl) DeleteInternal(key []byte) error {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	return i.i.DeleteInternal(key)
}

// NewBatch creates a new empty batch.
func (i *indexImpl) NewBatch() *Batch {
	return &Batch{
		index:    i,
		internal: index.NewBatch(),
	}
}

func (i *indexImpl) Name() string {
	return i.name
}

func (i *indexImpl) SetName(name string) {
	indexStats.UnRegister(i)
	i.name = name
	indexStats.Register(i)
}

type indexImplFieldDict struct {
	index       *indexImpl
	indexReader index.IndexReader
	fieldDict   index.FieldDict
}

func (f *indexImplFieldDict) BytesRead() uint64 {
	return f.fieldDict.BytesRead()
}

func (f *indexImplFieldDict) Next() (*index.DictEntry, error) {
	return f.fieldDict.Next()
}

func (f *indexImplFieldDict) Close() error {
	defer f.index.mutex.RUnlock()
	err := f.fieldDict.Close()
	if err != nil {
		return err
	}
	return f.indexReader.Close()
}

func (f *indexImplFieldDict) Cardinality() int {
	return f.fieldDict.Cardinality()
}

// helper function to remove duplicate entries from slice of strings
func deDuplicate(fields []string) []string {
	if len(fields) == 0 {
		return fields
	}
	entries := make(map[string]struct{})
	ret := []string{}
	for _, entry := range fields {
		if _, exists := entries[entry]; !exists {
			entries[entry] = struct{}{}
			ret = append(ret, entry)
		}
	}
	return ret
}

type searchHitSorter struct {
	hits          search.DocumentMatchCollection
	sort          search.SortOrder
	cachedScoring []bool
	cachedDesc    []bool
}

func newSearchHitSorter(sort search.SortOrder, hits search.DocumentMatchCollection) *searchHitSorter {
	return &searchHitSorter{
		sort:          sort,
		hits:          hits,
		cachedScoring: sort.CacheIsScore(),
		cachedDesc:    sort.CacheDescending(),
	}
}

func (m *searchHitSorter) Len() int      { return len(m.hits) }
func (m *searchHitSorter) Swap(i, j int) { m.hits[i], m.hits[j] = m.hits[j], m.hits[i] }
func (m *searchHitSorter) Less(i, j int) bool {
	c := m.sort.Compare(m.cachedScoring, m.cachedDesc, m.hits[i], m.hits[j])
	return c < 0
}

func (i *indexImpl) CopyTo(d index.Directory) (err error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return ErrorIndexClosed
	}

	copyIndex, ok := i.i.(index.CopyIndex)
	if !ok {
		return fmt.Errorf("index implementation does not support copy reader")
	}

	copyReader := copyIndex.CopyReader()
	if copyReader == nil {
		return fmt.Errorf("index's copyReader is nil")
	}

	defer func() {
		if cerr := copyReader.CloseCopyReader(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	err = copyReader.CopyTo(d)
	if err != nil {
		return fmt.Errorf("error copying index metadata: %v", err)
	}

	// copy the metadata
	return i.meta.CopyTo(d)
}

func (f FileSystemDirectory) GetWriter(filePath string) (io.WriteCloser,
	error,
) {
	dir, file := filepath.Split(filePath)
	if dir != "" {
		err := os.MkdirAll(filepath.Join(string(f), dir), os.ModePerm)
		if err != nil {
			return nil, err
		}
	}

	return os.OpenFile(filepath.Join(string(f), dir, file),
		os.O_RDWR|os.O_CREATE, 0o600)
}

func (i *indexImpl) FireIndexEvent() {
	// get the internal index implementation
	internalIndex, err := i.Advanced()
	if err != nil {
		return
	}
	// check if the internal index implementation supports events
	if internalEventIndex, ok := internalIndex.(index.EventIndex); ok {
		// fire the Index() event
		internalEventIndex.FireIndexEvent()
	}
}

// -----------------------------------------------------------------------------

func (i *indexImpl) TermFrequencies(field string, limit int, descending bool) (
	[]index.TermFreq, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	reader, err := i.i.Reader()
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := reader.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	insightsReader, ok := reader.(index.IndexInsightsReader)
	if !ok {
		return nil, fmt.Errorf("index reader does not support TermFrequencies")
	}

	return insightsReader.TermFrequencies(field, limit, descending)
}

func (i *indexImpl) CentroidCardinalities(field string, limit int, descending bool) (
	[]index.CentroidCardinality, error) {
	i.mutex.RLock()
	defer i.mutex.RUnlock()

	if !i.open {
		return nil, ErrorIndexClosed
	}

	reader, err := i.i.Reader()
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := reader.Close(); err == nil && cerr != nil {
			err = cerr
		}
	}()

	insightsReader, ok := reader.(index.IndexInsightsReader)
	if !ok {
		return nil, fmt.Errorf("index reader does not support CentroidCardinalities")
	}

	centroidCardinalities, err := insightsReader.CentroidCardinalities(field, limit, descending)
	if err != nil {
		return nil, err
	}

	for j := 0; j < len(centroidCardinalities); j++ {
		centroidCardinalities[j].Index = i.name
	}

	return centroidCardinalities, nil
}
