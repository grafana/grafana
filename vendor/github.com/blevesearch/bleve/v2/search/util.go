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

package search

import (
	"context"

	"github.com/blevesearch/geo/s2"
)

func MergeLocations(locations []FieldTermLocationMap) FieldTermLocationMap {
	rv := locations[0]

	for i := 1; i < len(locations); i++ {
		nextLocations := locations[i]
		for field, termLocationMap := range nextLocations {
			rvTermLocationMap, rvHasField := rv[field]
			if rvHasField {
				rv[field] = MergeTermLocationMaps(rvTermLocationMap, termLocationMap)
			} else {
				rv[field] = termLocationMap
			}
		}
	}

	return rv
}

func MergeTermLocationMaps(rv, other TermLocationMap) TermLocationMap {
	for term, locationMap := range other {
		// for a given term/document there cannot be different locations
		// if they came back from different clauses, overwrite is ok
		rv[term] = locationMap
	}
	return rv
}

func MergeFieldTermLocations(dest []FieldTermLocation, matches []*DocumentMatch) []FieldTermLocation {
	n := len(dest)
	for _, dm := range matches {
		n += len(dm.FieldTermLocations)
	}
	if cap(dest) < n {
		dest = append(make([]FieldTermLocation, 0, n), dest...)
	}

	for _, dm := range matches {
		for _, ftl := range dm.FieldTermLocations {
			dest = append(dest, FieldTermLocation{
				Field: ftl.Field,
				Term:  ftl.Term,
				Location: Location{
					Pos:            ftl.Location.Pos,
					Start:          ftl.Location.Start,
					End:            ftl.Location.End,
					ArrayPositions: append(ArrayPositions(nil), ftl.Location.ArrayPositions...),
				},
			})
		}
	}

	return dest
}

type SearchIOStatsCallbackFunc func(uint64)

// Implementation of SearchIncrementalCostCallbackFn should handle the following messages
//   - add: increment the cost of a search operation
//     (which can be specific to a query type as well)
//   - abort: query was aborted due to a cancel of search's context (for eg),
//     which can be handled differently as well
//   - done: indicates that a search was complete and the tracked cost can be
//     handled safely by the implementation.
type SearchIncrementalCostCallbackFn func(SearchIncrementalCostCallbackMsg,
	SearchQueryType, uint64)

type (
	SearchIncrementalCostCallbackMsg uint
	SearchQueryType                  uint
)

const (
	Term = SearchQueryType(1 << iota)
	Geo
	Numeric
	GenericCost
)

const (
	AddM = SearchIncrementalCostCallbackMsg(1 << iota)
	AbortM
	DoneM
)

// ContextKey is used to identify the context key in the context.Context
type ContextKey string

func (c ContextKey) String() string {
	return string(c)
}

const (
	SearchIncrementalCostKey ContextKey = "_search_incremental_cost_key"
	QueryTypeKey             ContextKey = "_query_type_key"
	FuzzyMatchPhraseKey      ContextKey = "_fuzzy_match_phrase_key"
	IncludeScoreBreakdownKey ContextKey = "_include_score_breakdown_key"

	// PreSearchKey indicates whether to perform a preliminary search to gather necessary
	// information which would be used in the actual search down the line.
	PreSearchKey ContextKey = "_presearch_key"

	// GetScoringModelCallbackKey is used to help the underlying searcher identify
	// which scoring mechanism to use based on index mapping.
	GetScoringModelCallbackKey ContextKey = "_get_scoring_model"

	// SearchIOStatsCallbackKey is used to help the underlying searcher identify
	SearchIOStatsCallbackKey ContextKey = "_search_io_stats_callback_key"

	// GeoBufferPoolCallbackKey ContextKey is used to help the underlying searcher
	GeoBufferPoolCallbackKey ContextKey = "_geo_buffer_pool_callback_key"

	// SearchTypeKey is used to identify type of the search being performed.
	//
	// for consistent scoring in cases an index is partitioned/sharded (using an
	// index alias), GlobalScoring helps in aggregating the necessary stats across
	// all the child bleve indexes (shards/partitions) first before the actual search
	// is performed, such that the scoring involved using these stats would be at a
	// global level.
	SearchTypeKey ContextKey = "_search_type_key"

	// The following keys are used to invoke the callbacks at the start and end stages
	// of optimizing the disjunction/conjunction searcher creation.
	SearcherStartCallbackKey ContextKey = "_searcher_start_callback_key"
	SearcherEndCallbackKey   ContextKey = "_searcher_end_callback_key"

	// FieldTermSynonymMapKey is used to store and transport the synonym definitions data
	// to the actual search phase which would use the synonyms to perform the search.
	FieldTermSynonymMapKey ContextKey = "_field_term_synonym_map_key"

	// BM25StatsKey is used to store and transport the BM25 Data
	// to the actual search phase which would use it to perform the search.
	BM25StatsKey ContextKey = "_bm25_stats_key"

	// ScoreFusionKey is used to communicate whether KNN hits need to be preserved for
	// hybrid search algorithms (like RRF)
	ScoreFusionKey ContextKey = "_fusion_rescoring_key"
)

func RecordSearchCost(ctx context.Context,
	msg SearchIncrementalCostCallbackMsg, bytes uint64,
) {
	if ctx != nil {
		queryType, ok := ctx.Value(QueryTypeKey).(SearchQueryType)
		if !ok {
			// for the cost of the non query type specific factors such as
			// doc values and stored fields section.
			queryType = GenericCost
		}

		aggCallbackFn := ctx.Value(SearchIncrementalCostKey)
		if aggCallbackFn != nil {
			aggCallbackFn.(SearchIncrementalCostCallbackFn)(msg, queryType, bytes)
		}
	}
}

// Assigning the size of the largest buffer in the pool to 24KB and
// the smallest buffer to 24 bytes. The pools are used to read a
// sequence of vertices which are always 24 bytes each.
const (
	MaxGeoBufPoolSize = 24 * 1024
	MinGeoBufPoolSize = 24
)

type GeoBufferPoolCallbackFunc func() *s2.GeoBufferPool

// *PreSearchDataKey are used to store the data gathered during the presearch phase
// which would be use in the actual search phase.
const (
	KnnPreSearchDataKey     = "_knn_pre_search_data_key"
	SynonymPreSearchDataKey = "_synonym_pre_search_data_key"
	BM25PreSearchDataKey    = "_bm25_pre_search_data_key"
)

const GlobalScoring = "_global_scoring"

type (
	SearcherStartCallbackFn func(size uint64) error
	SearcherEndCallbackFn   func(size uint64) error
)

type GetScoringModelCallbackFn func() string

type ScoreExplCorrectionCallbackFunc func(queryMatch *DocumentMatch, knnMatch *DocumentMatch) (float64, *Explanation)

// field -> term -> synonyms
type FieldTermSynonymMap map[string]map[string][]string

func (f FieldTermSynonymMap) MergeWith(fts FieldTermSynonymMap) {
	for field, termSynonymMap := range fts {
		// Ensure the field exists in the receiver
		if _, exists := f[field]; !exists {
			f[field] = make(map[string][]string)
		}
		for term, synonyms := range termSynonymMap {
			// Append synonyms
			f[field][term] = append(f[field][term], synonyms...)
		}
	}
}

// BM25 specific multipliers which control the scoring of a document.
//
// BM25_b - controls the extent to which doc's field length normalize term frequency part of score
// BM25_k1 - controls the saturation of the score due to term frequency
// the default values are as per elastic search's implementation
//   - https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules-similarity.html#bm25
//   - https://www.elastic.co/blog/practical-bm25-part-3-considerations-for-picking-b-and-k1-in-elasticsearch
var (
	BM25_k1 float64 = 1.2
	BM25_b  float64 = 0.75
)

type BM25Stats struct {
	DocCount         float64        `json:"doc_count"`
	FieldCardinality map[string]int `json:"field_cardinality"`
}
