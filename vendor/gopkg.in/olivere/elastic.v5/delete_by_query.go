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

// DeleteByQueryService deletes documents that match a query.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/docs-delete-by-query.html.
type DeleteByQueryService struct {
	client                 *Client
	index                  []string
	typ                    []string
	query                  Query
	body                   interface{}
	xSource                []string
	xSourceExclude         []string
	xSourceInclude         []string
	analyzer               string
	analyzeWildcard        *bool
	allowNoIndices         *bool
	conflicts              string
	defaultOperator        string
	df                     string
	docvalueFields         []string
	expandWildcards        string
	explain                *bool
	from                   *int
	ignoreUnavailable      *bool
	lenient                *bool
	lowercaseExpandedTerms *bool
	preference             string
	q                      string
	refresh                string
	requestCache           *bool
	requestsPerSecond      *int
	routing                []string
	scroll                 string
	scrollSize             *int
	searchTimeout          string
	searchType             string
	size                   *int
	sort                   []string
	stats                  []string
	storedFields           []string
	suggestField           string
	suggestMode            string
	suggestSize            *int
	suggestText            string
	terminateAfter         *int
	timeout                string
	trackScores            *bool
	version                *bool
	waitForActiveShards    string
	waitForCompletion      *bool
	pretty                 bool
}

// NewDeleteByQueryService creates a new DeleteByQueryService.
// You typically use the client's DeleteByQuery to get a reference to
// the service.
func NewDeleteByQueryService(client *Client) *DeleteByQueryService {
	builder := &DeleteByQueryService{
		client: client,
	}
	return builder
}

// Index sets the indices on which to perform the delete operation.
func (s *DeleteByQueryService) Index(index ...string) *DeleteByQueryService {
	s.index = append(s.index, index...)
	return s
}

// Type limits the delete operation to the given types.
func (s *DeleteByQueryService) Type(typ ...string) *DeleteByQueryService {
	s.typ = append(s.typ, typ...)
	return s
}

// XSource is true or false to return the _source field or not,
// or a list of fields to return.
func (s *DeleteByQueryService) XSource(xSource ...string) *DeleteByQueryService {
	s.xSource = append(s.xSource, xSource...)
	return s
}

// XSourceExclude represents a list of fields to exclude from the returned _source field.
func (s *DeleteByQueryService) XSourceExclude(xSourceExclude ...string) *DeleteByQueryService {
	s.xSourceExclude = append(s.xSourceExclude, xSourceExclude...)
	return s
}

// XSourceInclude represents a list of fields to extract and return from the _source field.
func (s *DeleteByQueryService) XSourceInclude(xSourceInclude ...string) *DeleteByQueryService {
	s.xSourceInclude = append(s.xSourceInclude, xSourceInclude...)
	return s
}

// Analyzer to use for the query string.
func (s *DeleteByQueryService) Analyzer(analyzer string) *DeleteByQueryService {
	s.analyzer = analyzer
	return s
}

// AnalyzeWildcard specifies whether wildcard and prefix queries should be
// analyzed (default: false).
func (s *DeleteByQueryService) AnalyzeWildcard(analyzeWildcard bool) *DeleteByQueryService {
	s.analyzeWildcard = &analyzeWildcard
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices (including the _all string
// or when no indices have been specified).
func (s *DeleteByQueryService) AllowNoIndices(allow bool) *DeleteByQueryService {
	s.allowNoIndices = &allow
	return s
}

// Conflicts indicates what to do when the process detects version conflicts.
// Possible values are "proceed" and "abort".
func (s *DeleteByQueryService) Conflicts(conflicts string) *DeleteByQueryService {
	s.conflicts = conflicts
	return s
}

// AbortOnVersionConflict aborts the request on version conflicts.
// It is an alias to setting Conflicts("abort").
func (s *DeleteByQueryService) AbortOnVersionConflict() *DeleteByQueryService {
	s.conflicts = "abort"
	return s
}

// ProceedOnVersionConflict aborts the request on version conflicts.
// It is an alias to setting Conflicts("proceed").
func (s *DeleteByQueryService) ProceedOnVersionConflict() *DeleteByQueryService {
	s.conflicts = "proceed"
	return s
}

// DefaultOperator for query string query (AND or OR).
func (s *DeleteByQueryService) DefaultOperator(defaultOperator string) *DeleteByQueryService {
	s.defaultOperator = defaultOperator
	return s
}

// DF is the field to use as default where no field prefix is given in the query string.
func (s *DeleteByQueryService) DF(defaultField string) *DeleteByQueryService {
	s.df = defaultField
	return s
}

// DefaultField is the field to use as default where no field prefix is given in the query string.
// It is an alias to the DF func.
func (s *DeleteByQueryService) DefaultField(defaultField string) *DeleteByQueryService {
	s.df = defaultField
	return s
}

// DocvalueFields specifies the list of fields to return as the docvalue representation of a field for each hit.
func (s *DeleteByQueryService) DocvalueFields(docvalueFields ...string) *DeleteByQueryService {
	s.docvalueFields = docvalueFields
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both. It can be "open" or "closed".
func (s *DeleteByQueryService) ExpandWildcards(expand string) *DeleteByQueryService {
	s.expandWildcards = expand
	return s
}

// Explain specifies whether to return detailed information about score
// computation as part of a hit.
func (s *DeleteByQueryService) Explain(explain bool) *DeleteByQueryService {
	s.explain = &explain
	return s
}

// From is the starting offset (default: 0).
func (s *DeleteByQueryService) From(from int) *DeleteByQueryService {
	s.from = &from
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should be
// ignored when unavailable (missing or closed).
func (s *DeleteByQueryService) IgnoreUnavailable(ignore bool) *DeleteByQueryService {
	s.ignoreUnavailable = &ignore
	return s
}

// Lenient specifies whether format-based query failures
// (such as providing text to a numeric field) should be ignored.
func (s *DeleteByQueryService) Lenient(lenient bool) *DeleteByQueryService {
	s.lenient = &lenient
	return s
}

// LowercaseExpandedTerms specifies whether query terms should be lowercased.
func (s *DeleteByQueryService) LowercaseExpandedTerms(lowercaseExpandedTerms bool) *DeleteByQueryService {
	s.lowercaseExpandedTerms = &lowercaseExpandedTerms
	return s
}

// Preference specifies the node or shard the operation should be performed on
// (default: random).
func (s *DeleteByQueryService) Preference(preference string) *DeleteByQueryService {
	s.preference = preference
	return s
}

// Q specifies the query in Lucene query string syntax. You can also use
// Query to programmatically specify the query.
func (s *DeleteByQueryService) Q(query string) *DeleteByQueryService {
	s.q = query
	return s
}

// QueryString is an alias to Q. Notice that you can also use Query to
// programmatically set the query.
func (s *DeleteByQueryService) QueryString(query string) *DeleteByQueryService {
	s.q = query
	return s
}

// Query sets the query programmatically.
func (s *DeleteByQueryService) Query(query Query) *DeleteByQueryService {
	s.query = query
	return s
}

// Refresh indicates whether the effected indexes should be refreshed.
func (s *DeleteByQueryService) Refresh(refresh string) *DeleteByQueryService {
	s.refresh = refresh
	return s
}

// RequestCache specifies if request cache should be used for this request
// or not, defaults to index level setting.
func (s *DeleteByQueryService) RequestCache(requestCache bool) *DeleteByQueryService {
	s.requestCache = &requestCache
	return s
}

// RequestsPerSecond sets the throttle on this request in sub-requests per second.
// -1 means set no throttle as does "unlimited" which is the only non-float this accepts.
func (s *DeleteByQueryService) RequestsPerSecond(requestsPerSecond int) *DeleteByQueryService {
	s.requestsPerSecond = &requestsPerSecond
	return s
}

// Routing is a list of specific routing values.
func (s *DeleteByQueryService) Routing(routing ...string) *DeleteByQueryService {
	s.routing = append(s.routing, routing...)
	return s
}

// Scroll specifies how long a consistent view of the index should be maintained
// for scrolled search.
func (s *DeleteByQueryService) Scroll(scroll string) *DeleteByQueryService {
	s.scroll = scroll
	return s
}

// ScrollSize is the size on the scroll request powering the update_by_query.
func (s *DeleteByQueryService) ScrollSize(scrollSize int) *DeleteByQueryService {
	s.scrollSize = &scrollSize
	return s
}

// SearchTimeout defines an explicit timeout for each search request.
// Defaults to no timeout.
func (s *DeleteByQueryService) SearchTimeout(searchTimeout string) *DeleteByQueryService {
	s.searchTimeout = searchTimeout
	return s
}

// SearchType is the search operation type. Possible values are
// "query_then_fetch" and "dfs_query_then_fetch".
func (s *DeleteByQueryService) SearchType(searchType string) *DeleteByQueryService {
	s.searchType = searchType
	return s
}

// Size represents the number of hits to return (default: 10).
func (s *DeleteByQueryService) Size(size int) *DeleteByQueryService {
	s.size = &size
	return s
}

// Sort is a list of <field>:<direction> pairs.
func (s *DeleteByQueryService) Sort(sort ...string) *DeleteByQueryService {
	s.sort = append(s.sort, sort...)
	return s
}

// SortByField adds a sort order.
func (s *DeleteByQueryService) SortByField(field string, ascending bool) *DeleteByQueryService {
	if ascending {
		s.sort = append(s.sort, fmt.Sprintf("%s:asc", field))
	} else {
		s.sort = append(s.sort, fmt.Sprintf("%s:desc", field))
	}
	return s
}

// Stats specifies specific tag(s) of the request for logging and statistical purposes.
func (s *DeleteByQueryService) Stats(stats ...string) *DeleteByQueryService {
	s.stats = append(s.stats, stats...)
	return s
}

// StoredFields specifies the list of stored fields to return as part of a hit.
func (s *DeleteByQueryService) StoredFields(storedFields ...string) *DeleteByQueryService {
	s.storedFields = storedFields
	return s
}

// SuggestField specifies which field to use for suggestions.
func (s *DeleteByQueryService) SuggestField(suggestField string) *DeleteByQueryService {
	s.suggestField = suggestField
	return s
}

// SuggestMode specifies the suggest mode. Possible values are
// "missing", "popular", and "always".
func (s *DeleteByQueryService) SuggestMode(suggestMode string) *DeleteByQueryService {
	s.suggestMode = suggestMode
	return s
}

// SuggestSize specifies how many suggestions to return in response.
func (s *DeleteByQueryService) SuggestSize(suggestSize int) *DeleteByQueryService {
	s.suggestSize = &suggestSize
	return s
}

// SuggestText specifies the source text for which the suggestions should be returned.
func (s *DeleteByQueryService) SuggestText(suggestText string) *DeleteByQueryService {
	s.suggestText = suggestText
	return s
}

// TerminateAfter indicates the maximum number of documents to collect
// for each shard, upon reaching which the query execution will terminate early.
func (s *DeleteByQueryService) TerminateAfter(terminateAfter int) *DeleteByQueryService {
	s.terminateAfter = &terminateAfter
	return s
}

// Timeout is the time each individual bulk request should wait for shards
// that are unavailable.
func (s *DeleteByQueryService) Timeout(timeout string) *DeleteByQueryService {
	s.timeout = timeout
	return s
}

// TimeoutInMillis sets the timeout in milliseconds.
func (s *DeleteByQueryService) TimeoutInMillis(timeoutInMillis int) *DeleteByQueryService {
	s.timeout = fmt.Sprintf("%dms", timeoutInMillis)
	return s
}

// TrackScores indicates whether to calculate and return scores even if
// they are not used for sorting.
func (s *DeleteByQueryService) TrackScores(trackScores bool) *DeleteByQueryService {
	s.trackScores = &trackScores
	return s
}

// Version specifies whether to return document version as part of a hit.
func (s *DeleteByQueryService) Version(version bool) *DeleteByQueryService {
	s.version = &version
	return s
}

// WaitForActiveShards sets the number of shard copies that must be active before proceeding
// with the update by query operation. Defaults to 1, meaning the primary shard only.
// Set to `all` for all shard copies, otherwise set to any non-negative value less than or equal
// to the total number of copies for the shard (number of replicas + 1).
func (s *DeleteByQueryService) WaitForActiveShards(waitForActiveShards string) *DeleteByQueryService {
	s.waitForActiveShards = waitForActiveShards
	return s
}

// WaitForCompletion indicates if the request should block until the reindex is complete.
func (s *DeleteByQueryService) WaitForCompletion(waitForCompletion bool) *DeleteByQueryService {
	s.waitForCompletion = &waitForCompletion
	return s
}

// Pretty indents the JSON output from Elasticsearch.
func (s *DeleteByQueryService) Pretty(pretty bool) *DeleteByQueryService {
	s.pretty = pretty
	return s
}

// Body specifies the body of the request. It overrides data being specified via SearchService.
func (s *DeleteByQueryService) Body(body string) *DeleteByQueryService {
	s.body = body
	return s
}

// buildURL builds the URL for the operation.
func (s *DeleteByQueryService) buildURL() (string, url.Values, error) {
	// Build URL
	var err error
	var path string
	if len(s.typ) > 0 {
		path, err = uritemplates.Expand("/{index}/{type}/_delete_by_query", map[string]string{
			"index": strings.Join(s.index, ","),
			"type":  strings.Join(s.typ, ","),
		})
	} else {
		path, err = uritemplates.Expand("/{index}/_delete_by_query", map[string]string{
			"index": strings.Join(s.index, ","),
		})
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if len(s.xSource) > 0 {
		params.Set("_source", strings.Join(s.xSource, ","))
	}
	if len(s.xSourceExclude) > 0 {
		params.Set("_source_exclude", strings.Join(s.xSourceExclude, ","))
	}
	if len(s.xSourceInclude) > 0 {
		params.Set("_source_include", strings.Join(s.xSourceInclude, ","))
	}
	if s.analyzer != "" {
		params.Set("analyzer", s.analyzer)
	}
	if s.analyzeWildcard != nil {
		params.Set("analyze_wildcard", fmt.Sprintf("%v", *s.analyzeWildcard))
	}
	if s.defaultOperator != "" {
		params.Set("default_operator", s.defaultOperator)
	}
	if s.df != "" {
		params.Set("df", s.df)
	}
	if s.explain != nil {
		params.Set("explain", fmt.Sprintf("%v", *s.explain))
	}
	if len(s.storedFields) > 0 {
		params.Set("stored_fields", strings.Join(s.storedFields, ","))
	}
	if len(s.docvalueFields) > 0 {
		params.Set("docvalue_fields", strings.Join(s.docvalueFields, ","))
	}
	if s.from != nil {
		params.Set("from", fmt.Sprintf("%d", *s.from))
	}
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.conflicts != "" {
		params.Set("conflicts", s.conflicts)
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if s.lenient != nil {
		params.Set("lenient", fmt.Sprintf("%v", *s.lenient))
	}
	if s.lowercaseExpandedTerms != nil {
		params.Set("lowercase_expanded_terms", fmt.Sprintf("%v", *s.lowercaseExpandedTerms))
	}
	if s.preference != "" {
		params.Set("preference", s.preference)
	}
	if s.q != "" {
		params.Set("q", s.q)
	}
	if len(s.routing) > 0 {
		params.Set("routing", strings.Join(s.routing, ","))
	}
	if s.scroll != "" {
		params.Set("scroll", s.scroll)
	}
	if s.searchType != "" {
		params.Set("search_type", s.searchType)
	}
	if s.searchTimeout != "" {
		params.Set("search_timeout", s.searchTimeout)
	}
	if s.size != nil {
		params.Set("size", fmt.Sprintf("%d", *s.size))
	}
	if len(s.sort) > 0 {
		params.Set("sort", strings.Join(s.sort, ","))
	}
	if s.terminateAfter != nil {
		params.Set("terminate_after", fmt.Sprintf("%v", *s.terminateAfter))
	}
	if len(s.stats) > 0 {
		params.Set("stats", strings.Join(s.stats, ","))
	}
	if s.suggestField != "" {
		params.Set("suggest_field", s.suggestField)
	}
	if s.suggestMode != "" {
		params.Set("suggest_mode", s.suggestMode)
	}
	if s.suggestSize != nil {
		params.Set("suggest_size", fmt.Sprintf("%v", *s.suggestSize))
	}
	if s.suggestText != "" {
		params.Set("suggest_text", s.suggestText)
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.trackScores != nil {
		params.Set("track_scores", fmt.Sprintf("%v", *s.trackScores))
	}
	if s.version != nil {
		params.Set("version", fmt.Sprintf("%v", *s.version))
	}
	if s.requestCache != nil {
		params.Set("request_cache", fmt.Sprintf("%v", *s.requestCache))
	}
	if s.refresh != "" {
		params.Set("refresh", s.refresh)
	}
	if s.waitForActiveShards != "" {
		params.Set("wait_for_active_shards", s.waitForActiveShards)
	}
	if s.scrollSize != nil {
		params.Set("scroll_size", fmt.Sprintf("%d", *s.scrollSize))
	}
	if s.waitForCompletion != nil {
		params.Set("wait_for_completion", fmt.Sprintf("%v", *s.waitForCompletion))
	}
	if s.requestsPerSecond != nil {
		params.Set("requests_per_second", fmt.Sprintf("%v", *s.requestsPerSecond))
	}
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *DeleteByQueryService) Validate() error {
	var invalid []string
	if len(s.index) == 0 {
		invalid = append(invalid, "Index")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the delete-by-query operation.
func (s *DeleteByQueryService) Do(ctx context.Context) (*BulkIndexByScrollResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Set body if there is a query set
	var body interface{}
	if s.body != nil {
		body = s.body
	} else if s.query != nil {
		src, err := s.query.Source()
		if err != nil {
			return nil, err
		}
		body = map[string]interface{}{
			"query": src,
		}
	}

	// Get response
	res, err := s.client.PerformRequest(ctx, "POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(BulkIndexByScrollResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// BulkIndexByScrollResponse is the outcome of executing Do with
// DeleteByQueryService and UpdateByQueryService.
type BulkIndexByScrollResponse struct {
	Took             int64  `json:"took"`
	SliceId          *int64 `json:"slice_id,omitempty"`
	TimedOut         bool   `json:"timed_out"`
	Total            int64  `json:"total"`
	Updated          int64  `json:"updated,omitempty"`
	Created          int64  `json:"created,omitempty"`
	Deleted          int64  `json:"deleted"`
	Batches          int64  `json:"batches"`
	VersionConflicts int64  `json:"version_conflicts"`
	Noops            int64  `json:"noops"`
	Retries          struct {
		Bulk   int64 `json:"bulk"`
		Search int64 `json:"search"`
	} `json:"retries,omitempty"`
	Throttled            string                             `json:"throttled"`
	ThrottledMillis      int64                              `json:"throttled_millis"`
	RequestsPerSecond    float64                            `json:"requests_per_second"`
	Canceled             string                             `json:"canceled,omitempty"`
	ThrottledUntil       string                             `json:"throttled_until"`
	ThrottledUntilMillis int64                              `json:"throttled_until_millis"`
	Failures             []bulkIndexByScrollResponseFailure `json:"failures"`
}

type bulkIndexByScrollResponseFailure struct {
	Index  string `json:"index,omitempty"`
	Type   string `json:"type,omitempty"`
	Id     string `json:"id,omitempty"`
	Status int    `json:"status,omitempty"`
	Shard  int    `json:"shard,omitempty"`
	Node   int    `json:"node,omitempty"`
	// TOOD "cause" contains exception details
	// TOOD "reason" contains exception details
}
