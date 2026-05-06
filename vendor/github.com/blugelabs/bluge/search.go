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

package bluge

import (
	"github.com/blugelabs/bluge/search"
	"github.com/blugelabs/bluge/search/aggregations"
	"github.com/blugelabs/bluge/search/collector"
)

type SearchRequest interface {
	Collector() search.Collector
	Searcher(i search.Reader, config Config) (search.Searcher, error)
	AddAggregation(name string, aggregation search.Aggregation)
	Aggregations() search.Aggregations
}

type SearchOptions struct {
	ExplainScores    bool
	IncludeLocations bool
	Score            string // FIXME go away
}

type BaseSearch struct {
	query        Query
	options      SearchOptions
	aggregations search.Aggregations
}

func (b BaseSearch) Query() Query {
	return b.query
}

func (b BaseSearch) Options() SearchOptions {
	return b.options
}

func (b BaseSearch) Aggregations() search.Aggregations {
	return b.aggregations
}

func (b BaseSearch) Searcher(i search.Reader, config Config) (search.Searcher, error) {
	return b.query.Searcher(i, searchOptionsFromConfig(config, b.options))
}

// TopNSearch is used to search for a fixed number of matches which can be sorted by a custom sort order.
// It also allows for skipping a specified number of matches which can be used to enable pagination.
type TopNSearch struct {
	BaseSearch
	n        int
	from     int
	sort     search.SortOrder
	after    [][]byte
	reversed bool
}

// NewTopNSearch creates a search which will find the matches and return the first N when ordered by the
// specified sort order (default: score descending)
func NewTopNSearch(n int, q Query) *TopNSearch {
	return &TopNSearch{
		BaseSearch: BaseSearch{
			query:        q,
			aggregations: make(search.Aggregations),
		},
		n: n,
		sort: search.SortOrder{
			search.SortBy(search.DocumentScore()).Desc(),
		},
	}
}

var standardAggs = search.Aggregations{
	"count":     aggregations.CountMatches(),
	"max_score": aggregations.MaxStartingAt(search.DocumentScore(), 0),
	"duration":  aggregations.Duration(),
}

// WithStandardAggregations adds the standard aggregations in the search query
// The standard aggregations are:
//   - count (total number of documents that matched the query)
//   - max_score (the highest score of all the matched documents)
//   - duration (time taken performing the search)
func (s *TopNSearch) WithStandardAggregations() *TopNSearch {
	for name, agg := range standardAggs {
		s.AddAggregation(name, agg)
	}
	return s
}

// Size returns the number of matches this search request will return
func (s *TopNSearch) Size() int {
	return s.n
}

// SetFrom sets the number of results to skip
func (s *TopNSearch) SetFrom(from int) *TopNSearch {
	s.from = from
	return s
}

// From returns the number of matches that will be skipped
func (s *TopNSearch) From() int {
	return s.from
}

// After can be used to specify a sort key, any match with a sort key less than this will be skipped
func (s *TopNSearch) After(after [][]byte) *TopNSearch {
	s.after = after
	return s
}

// Before can be used to specify a sort key, any match with a sort key greather than this will be skipped
func (s *TopNSearch) Before(before [][]byte) *TopNSearch {
	s.after = before
	s.reversed = true
	return s
}

// SortBy is a convenience method to specify search result sort order using a simple string slice.
// Strings in the slice are interpreted as the name of a field to sort ascending.
// The following special cases are handled.
//   - the prefix '-' will sort in descending order
//   - the special field '_score' can be used sort by score
func (s *TopNSearch) SortBy(order []string) *TopNSearch {
	s.sort = search.ParseSortOrderStrings(order)
	return s
}

// SortByCustom sets a custom sort order used to sort the matches of the search
func (s *TopNSearch) SortByCustom(order search.SortOrder) *TopNSearch {
	s.sort = order
	return s
}

// SortOrder returns the sort order of the current search
func (s *TopNSearch) SortOrder() search.SortOrder {
	return s.sort
}

// ExplainScores enables the addition of scoring explanation to each match
func (s *TopNSearch) ExplainScores() *TopNSearch {
	s.options.ExplainScores = true
	return s
}

// IncludeLocations enables the addition of match location in the original field
func (s *TopNSearch) IncludeLocations() *TopNSearch {
	s.options.IncludeLocations = true
	return s
}

func (s *TopNSearch) SetScore(mode string) *TopNSearch {
	s.options.Score = mode
	return s
}

func (s *TopNSearch) Collector() search.Collector {
	if s.after != nil {
		collectorSort := s.sort
		if s.reversed {
			// preserve original sort order in the request
			collectorSort = s.sort.Copy()
			collectorSort.Reverse()
		}
		rv := collector.NewTopNCollectorAfter(s.n, collectorSort, s.after, s.reversed)
		return rv
	}
	return collector.NewTopNCollector(s.n, s.from, s.sort)
}

func searchOptionsFromConfig(config Config, options SearchOptions) search.SearcherOptions {
	return search.SearcherOptions{
		SimilarityForField: func(field string) search.Similarity {
			if pfs, ok := config.PerFieldSimilarity[field]; ok {
				return pfs
			}
			return config.DefaultSimilarity
		},
		DefaultSearchField: config.DefaultSearchField,
		DefaultAnalyzer:    config.DefaultSearchAnalyzer,
		Explain:            options.ExplainScores,
		IncludeTermVectors: options.IncludeLocations,
		Score:              options.Score,
	}
}

func (s *TopNSearch) AddAggregation(name string, aggregation search.Aggregation) {
	s.aggregations.Add(name, aggregation)
}

type AllMatches struct {
	BaseSearch
}

func NewAllMatches(q Query) *AllMatches {
	return &AllMatches{
		BaseSearch: BaseSearch{
			query:        q,
			aggregations: make(search.Aggregations),
		},
	}
}

func (s *AllMatches) WithStandardAggregations() *AllMatches {
	for name, agg := range standardAggs {
		s.AddAggregation(name, agg)
	}
	return s
}

func (s *AllMatches) AddAggregation(name string, aggregation search.Aggregation) {
	s.aggregations.Add(name, aggregation)
}

func (s *AllMatches) ExplainScores() *AllMatches {
	s.options.ExplainScores = true
	return s
}

func (s *AllMatches) IncludeLocations() *AllMatches {
	s.options.IncludeLocations = true
	return s
}

func (s *AllMatches) Collector() search.Collector {
	return collector.NewAllCollector()
}

func (s *TopNSearch) AllMatches(i search.Reader, config Config) (search.Searcher, error) {
	return s.query.Searcher(i, search.SearcherOptions{
		DefaultSearchField: config.DefaultSearchField,
		Explain:            s.options.ExplainScores,
		IncludeTermVectors: s.options.IncludeLocations,
	})
}

// memNeededForSearch is a helper function that returns an estimate of RAM
// needed to execute a search request.
func memNeededForSearch(
	searcher search.Searcher,
	coll search.Collector) uint64 {
	numDocMatches := coll.BackingSize() + searcher.DocumentMatchPoolSize()

	estimate := 0

	// overhead, size in bytes from collector
	estimate += coll.Size()

	// pre-allocing DocumentMatchPool
	estimate += searchContextEmptySize + numDocMatches*documentMatchEmptySize

	// searcher overhead
	estimate += searcher.Size()

	// overhead from results, lowestMatchOutsideResults
	estimate += (numDocMatches + 1) * documentMatchEmptySize

	return uint64(estimate)
}
