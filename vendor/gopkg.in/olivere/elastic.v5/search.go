// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"reflect"
	"strings"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// Search for documents in Elasticsearch.
type SearchService struct {
	client            *Client
	searchSource      *SearchSource
	source            interface{}
	pretty            bool
	filterPath        []string
	searchType        string
	index             []string
	typ               []string
	routing           string
	preference        string
	requestCache      *bool
	ignoreUnavailable *bool
	allowNoIndices    *bool
	expandWildcards   string
}

// NewSearchService creates a new service for searching in Elasticsearch.
func NewSearchService(client *Client) *SearchService {
	builder := &SearchService{
		client:       client,
		searchSource: NewSearchSource(),
	}
	return builder
}

// SearchSource sets the search source builder to use with this service.
func (s *SearchService) SearchSource(searchSource *SearchSource) *SearchService {
	s.searchSource = searchSource
	if s.searchSource == nil {
		s.searchSource = NewSearchSource()
	}
	return s
}

// Source allows the user to set the request body manually without using
// any of the structs and interfaces in Elastic.
func (s *SearchService) Source(source interface{}) *SearchService {
	s.source = source
	return s
}

// FilterPath allows reducing the response, a mechanism known as
// response filtering and described here:
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/common-options.html#common-options-response-filtering.
func (s *SearchService) FilterPath(filterPath ...string) *SearchService {
	s.filterPath = append(s.filterPath, filterPath...)
	return s
}

// Index sets the names of the indices to use for search.
func (s *SearchService) Index(index ...string) *SearchService {
	s.index = append(s.index, index...)
	return s
}

// Types adds search restrictions for a list of types.
func (s *SearchService) Type(typ ...string) *SearchService {
	s.typ = append(s.typ, typ...)
	return s
}

// Pretty enables the caller to indent the JSON output.
func (s *SearchService) Pretty(pretty bool) *SearchService {
	s.pretty = pretty
	return s
}

// Timeout sets the timeout to use, e.g. "1s" or "1000ms".
func (s *SearchService) Timeout(timeout string) *SearchService {
	s.searchSource = s.searchSource.Timeout(timeout)
	return s
}

// Profile sets the Profile API flag on the search source.
// When enabled, a search executed by this service will return query
// profiling data.
func (s *SearchService) Profile(profile bool) *SearchService {
	s.searchSource = s.searchSource.Profile(profile)
	return s
}

// Collapse adds field collapsing.
func (s *SearchService) Collapse(collapse *CollapseBuilder) *SearchService {
	s.searchSource = s.searchSource.Collapse(collapse)
	return s
}

// TimeoutInMillis sets the timeout in milliseconds.
func (s *SearchService) TimeoutInMillis(timeoutInMillis int) *SearchService {
	s.searchSource = s.searchSource.TimeoutInMillis(timeoutInMillis)
	return s
}

// SearchType sets the search operation type. Valid values are:
// "query_then_fetch", "query_and_fetch", "dfs_query_then_fetch",
// "dfs_query_and_fetch", "count", "scan".
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-request-search-type.html
// for details.
func (s *SearchService) SearchType(searchType string) *SearchService {
	s.searchType = searchType
	return s
}

// Routing is a list of specific routing values to control the shards
// the search will be executed on.
func (s *SearchService) Routing(routings ...string) *SearchService {
	s.routing = strings.Join(routings, ",")
	return s
}

// Preference sets the preference to execute the search. Defaults to
// randomize across shards ("random"). Can be set to "_local" to prefer
// local shards, "_primary" to execute on primary shards only,
// or a custom value which guarantees that the same order will be used
// across different requests.
func (s *SearchService) Preference(preference string) *SearchService {
	s.preference = preference
	return s
}

// RequestCache indicates whether the cache should be used for this
// request or not, defaults to index level setting.
func (s *SearchService) RequestCache(requestCache bool) *SearchService {
	s.requestCache = &requestCache
	return s
}

// Query sets the query to perform, e.g. MatchAllQuery.
func (s *SearchService) Query(query Query) *SearchService {
	s.searchSource = s.searchSource.Query(query)
	return s
}

// PostFilter will be executed after the query has been executed and
// only affects the search hits, not the aggregations.
// This filter is always executed as the last filtering mechanism.
func (s *SearchService) PostFilter(postFilter Query) *SearchService {
	s.searchSource = s.searchSource.PostFilter(postFilter)
	return s
}

// FetchSource indicates whether the response should contain the stored
// _source for every hit.
func (s *SearchService) FetchSource(fetchSource bool) *SearchService {
	s.searchSource = s.searchSource.FetchSource(fetchSource)
	return s
}

// FetchSourceContext indicates how the _source should be fetched.
func (s *SearchService) FetchSourceContext(fetchSourceContext *FetchSourceContext) *SearchService {
	s.searchSource = s.searchSource.FetchSourceContext(fetchSourceContext)
	return s
}

// Highlight adds highlighting to the search.
func (s *SearchService) Highlight(highlight *Highlight) *SearchService {
	s.searchSource = s.searchSource.Highlight(highlight)
	return s
}

// GlobalSuggestText defines the global text to use with all suggesters.
// This avoids repetition.
func (s *SearchService) GlobalSuggestText(globalText string) *SearchService {
	s.searchSource = s.searchSource.GlobalSuggestText(globalText)
	return s
}

// Suggester adds a suggester to the search.
func (s *SearchService) Suggester(suggester Suggester) *SearchService {
	s.searchSource = s.searchSource.Suggester(suggester)
	return s
}

// Aggregation adds an aggreation to perform as part of the search.
func (s *SearchService) Aggregation(name string, aggregation Aggregation) *SearchService {
	s.searchSource = s.searchSource.Aggregation(name, aggregation)
	return s
}

// MinScore sets the minimum score below which docs will be filtered out.
func (s *SearchService) MinScore(minScore float64) *SearchService {
	s.searchSource = s.searchSource.MinScore(minScore)
	return s
}

// From index to start the search from. Defaults to 0.
func (s *SearchService) From(from int) *SearchService {
	s.searchSource = s.searchSource.From(from)
	return s
}

// Size is the number of search hits to return. Defaults to 10.
func (s *SearchService) Size(size int) *SearchService {
	s.searchSource = s.searchSource.Size(size)
	return s
}

// Explain indicates whether each search hit should be returned with
// an explanation of the hit (ranking).
func (s *SearchService) Explain(explain bool) *SearchService {
	s.searchSource = s.searchSource.Explain(explain)
	return s
}

// Version indicates whether each search hit should be returned with
// a version associated to it.
func (s *SearchService) Version(version bool) *SearchService {
	s.searchSource = s.searchSource.Version(version)
	return s
}

// Sort adds a sort order.
func (s *SearchService) Sort(field string, ascending bool) *SearchService {
	s.searchSource = s.searchSource.Sort(field, ascending)
	return s
}

// SortWithInfo adds a sort order.
func (s *SearchService) SortWithInfo(info SortInfo) *SearchService {
	s.searchSource = s.searchSource.SortWithInfo(info)
	return s
}

// SortBy	adds a sort order.
func (s *SearchService) SortBy(sorter ...Sorter) *SearchService {
	s.searchSource = s.searchSource.SortBy(sorter...)
	return s
}

// NoStoredFields indicates that no stored fields should be loaded, resulting in only
// id and type to be returned per field.
func (s *SearchService) NoStoredFields() *SearchService {
	s.searchSource = s.searchSource.NoStoredFields()
	return s
}

// StoredField adds a single field to load and return (note, must be stored) as
// part of the search request. If none are specified, the source of the
// document will be returned.
func (s *SearchService) StoredField(fieldName string) *SearchService {
	s.searchSource = s.searchSource.StoredField(fieldName)
	return s
}

// StoredFields	sets the fields to load and return as part of the search request.
// If none are specified, the source of the document will be returned.
func (s *SearchService) StoredFields(fields ...string) *SearchService {
	s.searchSource = s.searchSource.StoredFields(fields...)
	return s
}

// SearchAfter allows a different form of pagination by using a live cursor,
// using the results of the previous page to help the retrieval of the next.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-request-search-after.html
func (s *SearchService) SearchAfter(sortValues ...interface{}) *SearchService {
	s.searchSource = s.searchSource.SearchAfter(sortValues...)
	return s
}

// IgnoreUnavailable indicates whether the specified concrete indices
// should be ignored when unavailable (missing or closed).
func (s *SearchService) IgnoreUnavailable(ignoreUnavailable bool) *SearchService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices. (This includes `_all` string
// or when no indices have been specified).
func (s *SearchService) AllowNoIndices(allowNoIndices bool) *SearchService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both.
func (s *SearchService) ExpandWildcards(expandWildcards string) *SearchService {
	s.expandWildcards = expandWildcards
	return s
}

// buildURL builds the URL for the operation.
func (s *SearchService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	if len(s.index) > 0 && len(s.typ) > 0 {
		path, err = uritemplates.Expand("/{index}/{type}/_search", map[string]string{
			"index": strings.Join(s.index, ","),
			"type":  strings.Join(s.typ, ","),
		})
	} else if len(s.index) > 0 {
		path, err = uritemplates.Expand("/{index}/_search", map[string]string{
			"index": strings.Join(s.index, ","),
		})
	} else if len(s.typ) > 0 {
		path, err = uritemplates.Expand("/_all/{type}/_search", map[string]string{
			"type": strings.Join(s.typ, ","),
		})
	} else {
		path = "/_search"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	if s.searchType != "" {
		params.Set("search_type", s.searchType)
	}
	if s.routing != "" {
		params.Set("routing", s.routing)
	}
	if s.preference != "" {
		params.Set("preference", s.preference)
	}
	if s.requestCache != nil {
		params.Set("request_cache", fmt.Sprintf("%v", *s.requestCache))
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if len(s.filterPath) > 0 {
		params.Set("filter_path", strings.Join(s.filterPath, ","))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *SearchService) Validate() error {
	return nil
}

// Do executes the search and returns a SearchResult.
func (s *SearchService) Do(ctx context.Context) (*SearchResult, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Perform request
	var body interface{}
	if s.source != nil {
		body = s.source
	} else {
		src, err := s.searchSource.Source()
		if err != nil {
			return nil, err
		}
		body = src
	}
	res, err := s.client.PerformRequest(ctx, "POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return search results
	ret := new(SearchResult)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// SearchResult is the result of a search in Elasticsearch.
type SearchResult struct {
	TookInMillis int64          `json:"took"`              // search time in milliseconds
	ScrollId     string         `json:"_scroll_id"`        // only used with Scroll and Scan operations
	Hits         *SearchHits    `json:"hits"`              // the actual search hits
	Suggest      SearchSuggest  `json:"suggest"`           // results from suggesters
	Aggregations Aggregations   `json:"aggregations"`      // results from aggregations
	TimedOut     bool           `json:"timed_out"`         // true if the search timed out
	Error        *ErrorDetails  `json:"error,omitempty"`   // only used in MultiGet
	Profile      *SearchProfile `json:"profile,omitempty"` // profiling results, if optional Profile API was active for this search
	Shards       *shardsInfo    `json:"_shards,omitempty"` // shard information
}

// TotalHits is a convenience function to return the number of hits for
// a search result.
func (r *SearchResult) TotalHits() int64 {
	if r.Hits != nil {
		return r.Hits.TotalHits
	}
	return 0
}

// Each is a utility function to iterate over all hits. It saves you from
// checking for nil values. Notice that Each will ignore errors in
// serializing JSON.
func (r *SearchResult) Each(typ reflect.Type) []interface{} {
	if r.Hits == nil || r.Hits.Hits == nil || len(r.Hits.Hits) == 0 {
		return nil
	}
	var slice []interface{}
	for _, hit := range r.Hits.Hits {
		v := reflect.New(typ).Elem()
		if err := json.Unmarshal(*hit.Source, v.Addr().Interface()); err == nil {
			slice = append(slice, v.Interface())
		}
	}
	return slice
}

// SearchHits specifies the list of search hits.
type SearchHits struct {
	TotalHits int64        `json:"total"`     // total number of hits found
	MaxScore  *float64     `json:"max_score"` // maximum score of all hits
	Hits      []*SearchHit `json:"hits"`      // the actual hits returned
}

// SearchHit is a single hit.
type SearchHit struct {
	Score          *float64                       `json:"_score"`          // computed score
	Index          string                         `json:"_index"`          // index name
	Type           string                         `json:"_type"`           // type meta field
	Id             string                         `json:"_id"`             // external or internal
	Uid            string                         `json:"_uid"`            // uid meta field (see MapperService.java for all meta fields)
	Routing        string                         `json:"_routing"`        // routing meta field
	Parent         string                         `json:"_parent"`         // parent meta field
	Version        *int64                         `json:"_version"`        // version number, when Version is set to true in SearchService
	Sort           []interface{}                  `json:"sort"`            // sort information
	Highlight      SearchHitHighlight             `json:"highlight"`       // highlighter information
	Source         *json.RawMessage               `json:"_source"`         // stored document source
	Fields         map[string]interface{}         `json:"fields"`          // returned (stored) fields
	Explanation    *SearchExplanation             `json:"_explanation"`    // explains how the score was computed
	MatchedQueries []string                       `json:"matched_queries"` // matched queries
	InnerHits      map[string]*SearchHitInnerHits `json:"inner_hits"`      // inner hits with ES >= 1.5.0

	// Shard
	// HighlightFields
	// SortValues
	// MatchedFilters
}

type SearchHitInnerHits struct {
	Hits *SearchHits `json:"hits"`
}

// SearchExplanation explains how the score for a hit was computed.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-request-explain.html.
type SearchExplanation struct {
	Value       float64             `json:"value"`             // e.g. 1.0
	Description string              `json:"description"`       // e.g. "boost" or "ConstantScore(*:*), product of:"
	Details     []SearchExplanation `json:"details,omitempty"` // recursive details
}

// Suggest

// SearchSuggest is a map of suggestions.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-suggesters.html.
type SearchSuggest map[string][]SearchSuggestion

// SearchSuggestion is a single search suggestion.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-suggesters.html.
type SearchSuggestion struct {
	Text    string                   `json:"text"`
	Offset  int                      `json:"offset"`
	Length  int                      `json:"length"`
	Options []SearchSuggestionOption `json:"options"`
}

// SearchSuggestionOption is an option of a SearchSuggestion.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-suggesters.html.
type SearchSuggestionOption struct {
	Text   string           `json:"text"`
	Index  string           `json:"_index"`
	Type   string           `json:"_type"`
	Id     string           `json:"_id"`
	Score  float64          `json:"_score"`
	Source *json.RawMessage `json:"_source"`
}

// SearchProfile is a list of shard profiling data collected during
// query execution in the "profile" section of a SearchResult
type SearchProfile struct {
	Shards []SearchProfileShardResult `json:"shards"`
}

// SearchProfileShardResult returns the profiling data for a single shard
// accessed during the search query or aggregation.
type SearchProfileShardResult struct {
	ID           string                    `json:"id"`
	Searches     []QueryProfileShardResult `json:"searches"`
	Aggregations []ProfileResult           `json:"aggregations"`
}

// QueryProfileShardResult is a container class to hold the profile results
// for a single shard in the request. It comtains a list of query profiles,
// a collector tree and a total rewrite tree.
type QueryProfileShardResult struct {
	Query       []ProfileResult `json:"query,omitempty"`
	RewriteTime int64           `json:"rewrite_time,omitempty"`
	Collector   []interface{}   `json:"collector,omitempty"`
}

// CollectorResult holds the profile timings of the collectors used in the
// search. Children's CollectorResults may be embedded inside of a parent
// CollectorResult.
type CollectorResult struct {
	Name      string            `json:"name,omitempty"`
	Reason    string            `json:"reason,omitempty"`
	Time      string            `json:"time,omitempty"`
	TimeNanos int64             `json:"time_in_nanos,omitempty"`
	Children  []CollectorResult `json:"children,omitempty"`
}

// ProfileResult is the internal representation of a profiled query,
// corresponding to a single node in the query tree.
type ProfileResult struct {
	Type          string           `json:"type"`
	Description   string           `json:"description,omitempty"`
	NodeTime      string           `json:"time,omitempty"`
	NodeTimeNanos int64            `json:"time_in_nanos,omitempty"`
	Breakdown     map[string]int64 `json:"breakdown,omitempty"`
	Children      []ProfileResult  `json:"children,omitempty"`
}

// Aggregations (see search_aggs.go)

// Highlighting

// SearchHitHighlight is the highlight information of a search hit.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-request-highlighting.html
// for a general discussion of highlighting.
type SearchHitHighlight map[string][]string
