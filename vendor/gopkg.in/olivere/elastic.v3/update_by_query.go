// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"
	"strings"

	"golang.org/x/net/context"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

// UpdateByQueryService is documented at https://www.elastic.co/guide/en/elasticsearch/plugins/master/plugins-reindex.html.
type UpdateByQueryService struct {
	client                 *Client
	pretty                 bool
	index                  []string
	typ                    []string
	xSource                []string
	xSourceExclude         []string
	xSourceInclude         []string
	allowNoIndices         *bool
	analyzeWildcard        *bool
	analyzer               string
	conflicts              string
	consistency            string
	defaultOperator        string
	df                     string
	expandWildcards        string
	explain                *bool
	fielddataFields        []string
	fields                 []string
	from                   *int
	ignoreUnavailable      *bool
	lenient                *bool
	lowercaseExpandedTerms *bool
	preference             string
	q                      string
	refresh                *bool
	requestCache           *bool
	routing                []string
	scroll                 string
	scrollSize             *int
	searchTimeout          string
	searchType             string
	size                   *int
	sort                   []string
	stats                  []string
	suggestField           string
	suggestMode            string
	suggestSize            *int
	suggestText            string
	terminateAfter         *int
	timeout                string
	trackScores            *bool
	version                *bool
	versionType            *bool
	waitForCompletion      *bool
	script                 *Script
	query                  Query
	bodyJson               interface{}
	bodyString             string
}

// NewUpdateByQueryService creates a new UpdateByQueryService.
func NewUpdateByQueryService(client *Client) *UpdateByQueryService {
	return &UpdateByQueryService{
		client:          client,
		xSource:         make([]string, 0),
		xSourceExclude:  make([]string, 0),
		xSourceInclude:  make([]string, 0),
		fielddataFields: make([]string, 0),
		fields:          make([]string, 0),
		routing:         make([]string, 0),
		sort:            make([]string, 0),
		stats:           make([]string, 0),
	}
}

// Type is a list of document types to search; leave empty to perform
// the operation on all types.
func (s *UpdateByQueryService) Type(typ ...string) *UpdateByQueryService {
	s.typ = append(s.typ, typ...)
	return s
}

// Index is a list of index names to search; use `_all` or empty string to
// perform the operation on all indices.
func (s *UpdateByQueryService) Index(index ...string) *UpdateByQueryService {
	s.index = append(s.index, index...)
	return s
}

// XSource is true or false to return the _source field or not,
// or a list of fields to return.
func (s *UpdateByQueryService) XSource(xSource ...string) *UpdateByQueryService {
	s.xSource = append(s.xSource, xSource...)
	return s
}

// XSourceExclude represents a list of fields to exclude from the returned _source field.
func (s *UpdateByQueryService) XSourceExclude(xSourceExclude ...string) *UpdateByQueryService {
	s.xSourceExclude = append(s.xSourceExclude, xSourceExclude...)
	return s
}

// XSourceInclude represents a list of fields to extract and return from the _source field.
func (s *UpdateByQueryService) XSourceInclude(xSourceInclude ...string) *UpdateByQueryService {
	s.xSourceInclude = append(s.xSourceInclude, xSourceInclude...)
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices expression
// resolves into no concrete indices. (This includes `_all` string or when
// no indices have been specified).
func (s *UpdateByQueryService) AllowNoIndices(allowNoIndices bool) *UpdateByQueryService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// AnalyzeWildcard specifies whether wildcard and prefix queries should be
// analyzed (default: false).
func (s *UpdateByQueryService) AnalyzeWildcard(analyzeWildcard bool) *UpdateByQueryService {
	s.analyzeWildcard = &analyzeWildcard
	return s
}

// Analyzer specifies the analyzer to use for the query string.
func (s *UpdateByQueryService) Analyzer(analyzer string) *UpdateByQueryService {
	s.analyzer = analyzer
	return s
}

// Conflicts indicates what to do when the process detects version conflicts.
// Possible values are "proceed" and "abort".
func (s *UpdateByQueryService) Conflicts(conflicts string) *UpdateByQueryService {
	s.conflicts = conflicts
	return s
}

// AbortOnVersionConflict aborts the request on version conflicts.
// It is an alias to setting Conflicts("abort").
func (s *UpdateByQueryService) AbortOnVersionConflict() *UpdateByQueryService {
	s.conflicts = "abort"
	return s
}

// ProceedOnVersionConflict aborts the request on version conflicts.
// It is an alias to setting Conflicts("proceed").
func (s *UpdateByQueryService) ProceedOnVersionConflict() *UpdateByQueryService {
	s.conflicts = "proceed"
	return s
}

// Consistency sets an explicit write consistency setting for the operation.
// Possible values are "one", "quorum", and "all".
func (s *UpdateByQueryService) Consistency(consistency string) *UpdateByQueryService {
	s.consistency = consistency
	return s
}

// DefaultOperator is the default operator for query string query (AND or OR).
func (s *UpdateByQueryService) DefaultOperator(defaultOperator string) *UpdateByQueryService {
	s.defaultOperator = defaultOperator
	return s
}

// Df specifies the field to use as default where no field prefix is given in the query string.
func (s *UpdateByQueryService) Df(df string) *UpdateByQueryService {
	s.df = df
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both.
func (s *UpdateByQueryService) ExpandWildcards(expandWildcards string) *UpdateByQueryService {
	s.expandWildcards = expandWildcards
	return s
}

// Explain specifies whether to return detailed information about score
// computation as part of a hit.
func (s *UpdateByQueryService) Explain(explain bool) *UpdateByQueryService {
	s.explain = &explain
	return s
}

// FielddataFields is a list of fields to return as the field data
// representation of a field for each hit.
func (s *UpdateByQueryService) FielddataFields(fielddataFields ...string) *UpdateByQueryService {
	s.fielddataFields = append(s.fielddataFields, fielddataFields...)
	return s
}

// Fields is a list of fields to return as part of a hit.
func (s *UpdateByQueryService) Fields(fields ...string) *UpdateByQueryService {
	s.fields = append(s.fields, fields...)
	return s
}

// From is the starting offset (default: 0).
func (s *UpdateByQueryService) From(from int) *UpdateByQueryService {
	s.from = &from
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should be
// ignored when unavailable (missing or closed).
func (s *UpdateByQueryService) IgnoreUnavailable(ignoreUnavailable bool) *UpdateByQueryService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// Lenient specifies whether format-based query failures
// (such as providing text to a numeric field) should be ignored.
func (s *UpdateByQueryService) Lenient(lenient bool) *UpdateByQueryService {
	s.lenient = &lenient
	return s
}

// LowercaseExpandedTerms specifies whether query terms should be lowercased.
func (s *UpdateByQueryService) LowercaseExpandedTerms(lowercaseExpandedTerms bool) *UpdateByQueryService {
	s.lowercaseExpandedTerms = &lowercaseExpandedTerms
	return s
}

// Preference specifies the node or shard the operation should be performed on
// (default: random).
func (s *UpdateByQueryService) Preference(preference string) *UpdateByQueryService {
	s.preference = preference
	return s
}

// Query in the Lucene query string syntax.
func (s *UpdateByQueryService) Q(q string) *UpdateByQueryService {
	s.q = q
	return s
}

// Refresh indicates whether the effected indexes should be refreshed.
func (s *UpdateByQueryService) Refresh(refresh bool) *UpdateByQueryService {
	s.refresh = &refresh
	return s
}

// RequestCache specifies if request cache should be used for this request
// or not, defaults to index level setting.
func (s *UpdateByQueryService) RequestCache(requestCache bool) *UpdateByQueryService {
	s.requestCache = &requestCache
	return s
}

// Routing is a list of specific routing values.
func (s *UpdateByQueryService) Routing(routing ...string) *UpdateByQueryService {
	s.routing = append(s.routing, routing...)
	return s
}

// Scroll specifies how long a consistent view of the index should be maintained
// for scrolled search.
func (s *UpdateByQueryService) Scroll(scroll string) *UpdateByQueryService {
	s.scroll = scroll
	return s
}

// ScrollSize is the size on the scroll request powering the update_by_query.
func (s *UpdateByQueryService) ScrollSize(scrollSize int) *UpdateByQueryService {
	s.scrollSize = &scrollSize
	return s
}

// SearchTimeout defines an explicit timeout for each search request.
// Defaults to no timeout.
func (s *UpdateByQueryService) SearchTimeout(searchTimeout string) *UpdateByQueryService {
	s.searchTimeout = searchTimeout
	return s
}

// SearchType is the search operation type. Possible values are
// "query_then_fetch" and "dfs_query_then_fetch".
func (s *UpdateByQueryService) SearchType(searchType string) *UpdateByQueryService {
	s.searchType = searchType
	return s
}

// Size represents the number of hits to return (default: 10).
func (s *UpdateByQueryService) Size(size int) *UpdateByQueryService {
	s.size = &size
	return s
}

// Sort is a list of <field>:<direction> pairs.
func (s *UpdateByQueryService) Sort(sort ...string) *UpdateByQueryService {
	s.sort = append(s.sort, sort...)
	return s
}

// SortByField adds a sort order.
func (s *UpdateByQueryService) SortByField(field string, ascending bool) *UpdateByQueryService {
	if ascending {
		s.sort = append(s.sort, fmt.Sprintf("%s:asc", field))
	} else {
		s.sort = append(s.sort, fmt.Sprintf("%s:desc", field))
	}
	return s
}

// Stats specifies specific tag(s) of the request for logging and statistical purposes.
func (s *UpdateByQueryService) Stats(stats ...string) *UpdateByQueryService {
	s.stats = append(s.stats, stats...)
	return s
}

// SuggestField specifies which field to use for suggestions.
func (s *UpdateByQueryService) SuggestField(suggestField string) *UpdateByQueryService {
	s.suggestField = suggestField
	return s
}

// SuggestMode specifies the suggest mode. Possible values are
// "missing", "popular", and "always".
func (s *UpdateByQueryService) SuggestMode(suggestMode string) *UpdateByQueryService {
	s.suggestMode = suggestMode
	return s
}

// SuggestSize specifies how many suggestions to return in response.
func (s *UpdateByQueryService) SuggestSize(suggestSize int) *UpdateByQueryService {
	s.suggestSize = &suggestSize
	return s
}

// SuggestText specifies the source text for which the suggestions should be returned.
func (s *UpdateByQueryService) SuggestText(suggestText string) *UpdateByQueryService {
	s.suggestText = suggestText
	return s
}

// TerminateAfter indicates the maximum number of documents to collect
// for each shard, upon reaching which the query execution will terminate early.
func (s *UpdateByQueryService) TerminateAfter(terminateAfter int) *UpdateByQueryService {
	s.terminateAfter = &terminateAfter
	return s
}

// Timeout is the time each individual bulk request should wait for shards
// that are unavailable.
func (s *UpdateByQueryService) Timeout(timeout string) *UpdateByQueryService {
	s.timeout = timeout
	return s
}

// TimeoutInMillis sets the timeout in milliseconds.
func (s *UpdateByQueryService) TimeoutInMillis(timeoutInMillis int) *UpdateByQueryService {
	s.timeout = fmt.Sprintf("%dms", timeoutInMillis)
	return s
}

// TrackScores indicates whether to calculate and return scores even if
// they are not used for sorting.
func (s *UpdateByQueryService) TrackScores(trackScores bool) *UpdateByQueryService {
	s.trackScores = &trackScores
	return s
}

// Version specifies whether to return document version as part of a hit.
func (s *UpdateByQueryService) Version(version bool) *UpdateByQueryService {
	s.version = &version
	return s
}

// VersionType indicates if the document increment the version number (internal)
// on hit or not (reindex).
func (s *UpdateByQueryService) VersionType(versionType bool) *UpdateByQueryService {
	s.versionType = &versionType
	return s
}

// WaitForCompletion indicates if the request should block until the reindex is complete.
func (s *UpdateByQueryService) WaitForCompletion(waitForCompletion bool) *UpdateByQueryService {
	s.waitForCompletion = &waitForCompletion
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *UpdateByQueryService) Pretty(pretty bool) *UpdateByQueryService {
	s.pretty = pretty
	return s
}

// Script sets an update script.
func (s *UpdateByQueryService) Script(script *Script) *UpdateByQueryService {
	s.script = script
	return s
}

// Query sets a query definition using the Query DSL.
func (s *UpdateByQueryService) Query(query Query) *UpdateByQueryService {
	s.query = query
	return s
}

// BodyJson specifies e.g. the query to restrict the results specified with the
// Query DSL (optional). The interface{} will be serialized to a JSON document,
// so use a map[string]interface{}.
func (s *UpdateByQueryService) BodyJson(body interface{}) *UpdateByQueryService {
	s.bodyJson = body
	return s
}

// Body specifies e.g. a query to restrict the results specified with
// the Query DSL (optional).
func (s *UpdateByQueryService) BodyString(body string) *UpdateByQueryService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *UpdateByQueryService) buildURL() (string, url.Values, error) {
	// Build URL
	var err error
	var path string
	if len(s.index) > 0 && len(s.typ) > 0 {
		path, err = uritemplates.Expand("/{index}/{type}/_update_by_query", map[string]string{
			"index": strings.Join(s.index, ","),
			"type":  strings.Join(s.typ, ","),
		})
	} else if len(s.index) > 0 && len(s.typ) == 0 {
		path, err = uritemplates.Expand("/{index}/_update_by_query", map[string]string{
			"index": strings.Join(s.index, ","),
		})
	} else if len(s.index) == 0 && len(s.typ) > 0 {
		path, err = uritemplates.Expand("/_all/{type}/_update_by_query", map[string]string{
			"type": strings.Join(s.typ, ","),
		})
	} else {
		path = "/_all/_update_by_query"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if len(s.xSource) > 0 {
		params.Set("_source", strings.Join(s.xSource, ","))
	}
	if len(s.xSourceExclude) > 0 {
		params.Set("_source_exclude", strings.Join(s.xSourceExclude, ","))
	}
	if len(s.xSourceInclude) > 0 {
		params.Set("_source_include", strings.Join(s.xSourceInclude, ","))
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.analyzeWildcard != nil {
		params.Set("analyze_wildcard", fmt.Sprintf("%v", *s.analyzeWildcard))
	}
	if s.analyzer != "" {
		params.Set("analyzer", s.analyzer)
	}
	if s.conflicts != "" {
		params.Set("conflicts", s.conflicts)
	}
	if s.consistency != "" {
		params.Set("consistency", s.consistency)
	}
	if s.defaultOperator != "" {
		params.Set("default_operator", s.defaultOperator)
	}
	if s.df != "" {
		params.Set("df", s.df)
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if s.explain != nil {
		params.Set("explain", fmt.Sprintf("%v", *s.explain))
	}
	if len(s.fielddataFields) > 0 {
		params.Set("fielddata_fields", strings.Join(s.fielddataFields, ","))
	}
	if len(s.fields) > 0 {
		params.Set("fields", strings.Join(s.fields, ","))
	}
	if s.from != nil {
		params.Set("from", fmt.Sprintf("%d", *s.from))
	}
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
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
	if s.refresh != nil {
		params.Set("refresh", fmt.Sprintf("%v", *s.refresh))
	}
	if s.requestCache != nil {
		params.Set("request_cache", fmt.Sprintf("%v", *s.requestCache))
	}
	if len(s.routing) > 0 {
		params.Set("routing", strings.Join(s.routing, ","))
	}
	if s.scroll != "" {
		params.Set("scroll", s.scroll)
	}
	if s.scrollSize != nil {
		params.Set("scroll_size", fmt.Sprintf("%d", *s.scrollSize))
	}
	if s.searchTimeout != "" {
		params.Set("search_timeout", s.searchTimeout)
	}
	if s.searchType != "" {
		params.Set("search_type", s.searchType)
	}
	if s.size != nil {
		params.Set("size", fmt.Sprintf("%d", *s.size))
	}
	if len(s.sort) > 0 {
		params.Set("sort", strings.Join(s.sort, ","))
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
	if s.terminateAfter != nil {
		params.Set("terminate_after", fmt.Sprintf("%v", *s.terminateAfter))
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
	if s.versionType != nil {
		params.Set("version_type", fmt.Sprintf("%v", *s.versionType))
	}
	if s.waitForCompletion != nil {
		params.Set("wait_for_completion", fmt.Sprintf("%v", *s.waitForCompletion))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *UpdateByQueryService) Validate() error {
	return nil
}

// body returns the body part of the document request.
func (s *UpdateByQueryService) body() (interface{}, error) {
	if s.bodyJson != nil {
		return s.bodyJson, nil
	}
	if s.bodyString != "" {
		return s.bodyString, nil
	}

	source := make(map[string]interface{})

	if s.script != nil {
		src, err := s.script.Source()
		if err != nil {
			return nil, err
		}
		source["script"] = src
	}

	if s.query != nil {
		src, err := s.query.Source()
		if err != nil {
			return nil, err
		}
		source["query"] = src
	}

	return source, nil
}

// Do executes the operation.
func (s *UpdateByQueryService) Do() (*UpdateByQueryResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *UpdateByQueryService) DoC(ctx context.Context) (*UpdateByQueryResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Setup HTTP request body
	body, err := s.body()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequestC(ctx, "POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(UpdateByQueryResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// UpdateByQueryResponse is the response of UpdateByQueryService.Do.
type UpdateByQueryResponse struct {
	Took             int64                   `json:"took"`
	TimedOut         bool                    `json:"timed_out"`
	Total            int64                   `json:"total"`
	Updated          int64                   `json:"updated"`
	Created          int64                   `json:"created"`
	Deleted          int64                   `json:"deleted"`
	Batches          int64                   `json:"batches"`
	VersionConflicts int64                   `json:"version_conflicts"`
	Noops            int64                   `json:"noops"`
	Retries          int64                   `json:"retries"`
	Canceled         string                  `json:"canceled"`
	Failures         []shardOperationFailure `json:"failures"`
}
