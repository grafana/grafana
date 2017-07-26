// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// IndicesStatsService provides stats on various metrics of one or more
// indices. See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/indices-stats.html.
type IndicesStatsService struct {
	client           *Client
	pretty           bool
	metric           []string
	index            []string
	level            string
	types            []string
	completionFields []string
	fielddataFields  []string
	fields           []string
	groups           []string
	human            *bool
}

// NewIndicesStatsService creates a new IndicesStatsService.
func NewIndicesStatsService(client *Client) *IndicesStatsService {
	return &IndicesStatsService{
		client:           client,
		index:            make([]string, 0),
		metric:           make([]string, 0),
		completionFields: make([]string, 0),
		fielddataFields:  make([]string, 0),
		fields:           make([]string, 0),
		groups:           make([]string, 0),
		types:            make([]string, 0),
	}
}

// Metric limits the information returned the specific metrics. Options are:
// docs, store, indexing, get, search, completion, fielddata, flush, merge,
// query_cache, refresh, suggest, and warmer.
func (s *IndicesStatsService) Metric(metric ...string) *IndicesStatsService {
	s.metric = append(s.metric, metric...)
	return s
}

// Index is the list of index names; use `_all` or empty string to perform
// the operation on all indices.
func (s *IndicesStatsService) Index(indices ...string) *IndicesStatsService {
	s.index = append(s.index, indices...)
	return s
}

// Type is a list of document types for the `indexing` index metric.
func (s *IndicesStatsService) Type(types ...string) *IndicesStatsService {
	s.types = append(s.types, types...)
	return s
}

// Level returns stats aggregated at cluster, index or shard level.
func (s *IndicesStatsService) Level(level string) *IndicesStatsService {
	s.level = level
	return s
}

// CompletionFields is a list of fields for `fielddata` and `suggest`
// index metric (supports wildcards).
func (s *IndicesStatsService) CompletionFields(completionFields ...string) *IndicesStatsService {
	s.completionFields = append(s.completionFields, completionFields...)
	return s
}

// FielddataFields is a list of fields for `fielddata` index metric (supports wildcards).
func (s *IndicesStatsService) FielddataFields(fielddataFields ...string) *IndicesStatsService {
	s.fielddataFields = append(s.fielddataFields, fielddataFields...)
	return s
}

// Fields is a list of fields for `fielddata` and `completion` index metric
// (supports wildcards).
func (s *IndicesStatsService) Fields(fields ...string) *IndicesStatsService {
	s.fields = append(s.fields, fields...)
	return s
}

// Groups is a list of search groups for `search` index metric.
func (s *IndicesStatsService) Groups(groups ...string) *IndicesStatsService {
	s.groups = append(s.groups, groups...)
	return s
}

// Human indicates whether to return time and byte values in human-readable format..
func (s *IndicesStatsService) Human(human bool) *IndicesStatsService {
	s.human = &human
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesStatsService) Pretty(pretty bool) *IndicesStatsService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesStatsService) buildURL() (string, url.Values, error) {
	var err error
	var path string
	if len(s.index) > 0 && len(s.metric) > 0 {
		path, err = uritemplates.Expand("/{index}/_stats/{metric}", map[string]string{
			"index":  strings.Join(s.index, ","),
			"metric": strings.Join(s.metric, ","),
		})
	} else if len(s.index) > 0 {
		path, err = uritemplates.Expand("/{index}/_stats", map[string]string{
			"index": strings.Join(s.index, ","),
		})
	} else if len(s.metric) > 0 {
		path, err = uritemplates.Expand("/_stats/{metric}", map[string]string{
			"metric": strings.Join(s.metric, ","),
		})
	} else {
		path = "/_stats"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if len(s.groups) > 0 {
		params.Set("groups", strings.Join(s.groups, ","))
	}
	if s.human != nil {
		params.Set("human", fmt.Sprintf("%v", *s.human))
	}
	if s.level != "" {
		params.Set("level", s.level)
	}
	if len(s.types) > 0 {
		params.Set("types", strings.Join(s.types, ","))
	}
	if len(s.completionFields) > 0 {
		params.Set("completion_fields", strings.Join(s.completionFields, ","))
	}
	if len(s.fielddataFields) > 0 {
		params.Set("fielddata_fields", strings.Join(s.fielddataFields, ","))
	}
	if len(s.fields) > 0 {
		params.Set("fields", strings.Join(s.fields, ","))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesStatsService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *IndicesStatsService) Do(ctx context.Context) (*IndicesStatsResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, "GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(IndicesStatsResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IndicesStatsResponse is the response of IndicesStatsService.Do.
type IndicesStatsResponse struct {
	// Shards provides information returned from shards.
	Shards shardsInfo `json:"_shards"`

	// All provides summary stats about all indices.
	All *IndexStats `json:"_all,omitempty"`

	// Indices provides a map into the stats of an index. The key of the
	// map is the index name.
	Indices map[string]*IndexStats `json:"indices,omitempty"`
}

// IndexStats is index stats for a specific index.
type IndexStats struct {
	Primaries *IndexStatsDetails `json:"primaries,omitempty"`
	Total     *IndexStatsDetails `json:"total,omitempty"`
}

type IndexStatsDetails struct {
	Docs        *IndexStatsDocs        `json:"docs,omitempty"`
	Store       *IndexStatsStore       `json:"store,omitempty"`
	Indexing    *IndexStatsIndexing    `json:"indexing,omitempty"`
	Get         *IndexStatsGet         `json:"get,omitempty"`
	Search      *IndexStatsSearch      `json:"search,omitempty"`
	Merges      *IndexStatsMerges      `json:"merges,omitempty"`
	Refresh     *IndexStatsRefresh     `json:"refresh,omitempty"`
	Flush       *IndexStatsFlush       `json:"flush,omitempty"`
	Warmer      *IndexStatsWarmer      `json:"warmer,omitempty"`
	FilterCache *IndexStatsFilterCache `json:"filter_cache,omitempty"`
	IdCache     *IndexStatsIdCache     `json:"id_cache,omitempty"`
	Fielddata   *IndexStatsFielddata   `json:"fielddata,omitempty"`
	Percolate   *IndexStatsPercolate   `json:"percolate,omitempty"`
	Completion  *IndexStatsCompletion  `json:"completion,omitempty"`
	Segments    *IndexStatsSegments    `json:"segments,omitempty"`
	Translog    *IndexStatsTranslog    `json:"translog,omitempty"`
	Suggest     *IndexStatsSuggest     `json:"suggest,omitempty"`
	QueryCache  *IndexStatsQueryCache  `json:"query_cache,omitempty"`
}

type IndexStatsDocs struct {
	Count   int64 `json:"count,omitempty"`
	Deleted int64 `json:"deleted,omitempty"`
}

type IndexStatsStore struct {
	Size                 string `json:"size,omitempty"` // human size, e.g. 119.3mb
	SizeInBytes          int64  `json:"size_in_bytes,omitempty"`
	ThrottleTime         string `json:"throttle_time,omitempty"` // human time, e.g. 0s
	ThrottleTimeInMillis int64  `json:"throttle_time_in_millis,omitempty"`
}

type IndexStatsIndexing struct {
	IndexTotal           int64  `json:"index_total,omitempty"`
	IndexTime            string `json:"index_time,omitempty"`
	IndexTimeInMillis    int64  `json:"index_time_in_millis,omitempty"`
	IndexCurrent         int64  `json:"index_current,omitempty"`
	DeleteTotal          int64  `json:"delete_total,omitempty"`
	DeleteTime           string `json:"delete_time,omitempty"`
	DeleteTimeInMillis   int64  `json:"delete_time_in_millis,omitempty"`
	DeleteCurrent        int64  `json:"delete_current,omitempty"`
	NoopUpdateTotal      int64  `json:"noop_update_total,omitempty"`
	IsThrottled          bool   `json:"is_throttled,omitempty"`
	ThrottleTime         string `json:"throttle_time,omitempty"`
	ThrottleTimeInMillis int64  `json:"throttle_time_in_millis,omitempty"`
}

type IndexStatsGet struct {
	Total               int64  `json:"total,omitempty"`
	GetTime             string `json:"get_time,omitempty"`
	TimeInMillis        int64  `json:"time_in_millis,omitempty"`
	ExistsTotal         int64  `json:"exists_total,omitempty"`
	ExistsTime          string `json:"exists_time,omitempty"`
	ExistsTimeInMillis  int64  `json:"exists_time_in_millis,omitempty"`
	MissingTotal        int64  `json:"missing_total,omitempty"`
	MissingTime         string `json:"missing_time,omitempty"`
	MissingTimeInMillis int64  `json:"missing_time_in_millis,omitempty"`
	Current             int64  `json:"current,omitempty"`
}

type IndexStatsSearch struct {
	OpenContexts      int64  `json:"open_contexts,omitempty"`
	QueryTotal        int64  `json:"query_total,omitempty"`
	QueryTime         string `json:"query_time,omitempty"`
	QueryTimeInMillis int64  `json:"query_time_in_millis,omitempty"`
	QueryCurrent      int64  `json:"query_current,omitempty"`
	FetchTotal        int64  `json:"fetch_total,omitempty"`
	FetchTime         string `json:"fetch_time,omitempty"`
	FetchTimeInMillis int64  `json:"fetch_time_in_millis,omitempty"`
	FetchCurrent      int64  `json:"fetch_current,omitempty"`
}

type IndexStatsMerges struct {
	Current            int64  `json:"current,omitempty"`
	CurrentDocs        int64  `json:"current_docs,omitempty"`
	CurrentSize        string `json:"current_size,omitempty"`
	CurrentSizeInBytes int64  `json:"current_size_in_bytes,omitempty"`
	Total              int64  `json:"total,omitempty"`
	TotalTime          string `json:"total_time,omitempty"`
	TotalTimeInMillis  int64  `json:"total_time_in_millis,omitempty"`
	TotalDocs          int64  `json:"total_docs,omitempty"`
	TotalSize          string `json:"total_size,omitempty"`
	TotalSizeInBytes   int64  `json:"total_size_in_bytes,omitempty"`
}

type IndexStatsRefresh struct {
	Total             int64  `json:"total,omitempty"`
	TotalTime         string `json:"total_time,omitempty"`
	TotalTimeInMillis int64  `json:"total_time_in_millis,omitempty"`
}

type IndexStatsFlush struct {
	Total             int64  `json:"total,omitempty"`
	TotalTime         string `json:"total_time,omitempty"`
	TotalTimeInMillis int64  `json:"total_time_in_millis,omitempty"`
}

type IndexStatsWarmer struct {
	Current           int64  `json:"current,omitempty"`
	Total             int64  `json:"total,omitempty"`
	TotalTime         string `json:"total_time,omitempty"`
	TotalTimeInMillis int64  `json:"total_time_in_millis,omitempty"`
}

type IndexStatsFilterCache struct {
	MemorySize        string `json:"memory_size,omitempty"`
	MemorySizeInBytes int64  `json:"memory_size_in_bytes,omitempty"`
	Evictions         int64  `json:"evictions,omitempty"`
}

type IndexStatsIdCache struct {
	MemorySize        string `json:"memory_size,omitempty"`
	MemorySizeInBytes int64  `json:"memory_size_in_bytes,omitempty"`
}

type IndexStatsFielddata struct {
	MemorySize        string `json:"memory_size,omitempty"`
	MemorySizeInBytes int64  `json:"memory_size_in_bytes,omitempty"`
	Evictions         int64  `json:"evictions,omitempty"`
}

type IndexStatsPercolate struct {
	Total             int64  `json:"total,omitempty"`
	GetTime           string `json:"get_time,omitempty"`
	TimeInMillis      int64  `json:"time_in_millis,omitempty"`
	Current           int64  `json:"current,omitempty"`
	MemorySize        string `json:"memory_size,omitempty"`
	MemorySizeInBytes int64  `json:"memory_size_in_bytes,omitempty"`
	Queries           int64  `json:"queries,omitempty"`
}

type IndexStatsCompletion struct {
	Size        string `json:"size,omitempty"`
	SizeInBytes int64  `json:"size_in_bytes,omitempty"`
}

type IndexStatsSegments struct {
	Count                       int64  `json:"count,omitempty"`
	Memory                      string `json:"memory,omitempty"`
	MemoryInBytes               int64  `json:"memory_in_bytes,omitempty"`
	IndexWriterMemory           string `json:"index_writer_memory,omitempty"`
	IndexWriterMemoryInBytes    int64  `json:"index_writer_memory_in_bytes,omitempty"`
	IndexWriterMaxMemory        string `json:"index_writer_max_memory,omitempty"`
	IndexWriterMaxMemoryInBytes int64  `json:"index_writer_max_memory_in_bytes,omitempty"`
	VersionMapMemory            string `json:"version_map_memory,omitempty"`
	VersionMapMemoryInBytes     int64  `json:"version_map_memory_in_bytes,omitempty"`
	FixedBitSetMemory           string `json:"fixed_bit_set,omitempty"`
	FixedBitSetMemoryInBytes    int64  `json:"fixed_bit_set_memory_in_bytes,omitempty"`
}

type IndexStatsTranslog struct {
	Operations  int64  `json:"operations,omitempty"`
	Size        string `json:"size,omitempty"`
	SizeInBytes int64  `json:"size_in_bytes,omitempty"`
}

type IndexStatsSuggest struct {
	Total        int64  `json:"total,omitempty"`
	Time         string `json:"time,omitempty"`
	TimeInMillis int64  `json:"time_in_millis,omitempty"`
	Current      int64  `json:"current,omitempty"`
}

type IndexStatsQueryCache struct {
	MemorySize        string `json:"memory_size,omitempty"`
	MemorySizeInBytes int64  `json:"memory_size_in_bytes,omitempty"`
	Evictions         int64  `json:"evictions,omitempty"`
	HitCount          int64  `json:"hit_count,omitempty"`
	MissCount         int64  `json:"miss_count,omitempty"`
}
