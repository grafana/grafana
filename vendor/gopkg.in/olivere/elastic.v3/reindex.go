// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"

	"golang.org/x/net/context"
)

// ReindexService is a method to copy documents from one index to another.
// It was introduced in Elasticsearch 2.3.0.
//
// Notice that Elastic already had a Reindexer service that pre-dated
// the Reindex API. Use that if you're on an earlier version of Elasticsearch.
//
// It is documented at https://www.elastic.co/guide/en/elasticsearch/plugins/master/plugins-reindex.html.
type ReindexService struct {
	client            *Client
	pretty            bool
	consistency       string
	refresh           *bool
	timeout           string
	waitForCompletion *bool
	bodyJson          interface{}
	bodyString        string
	source            *ReindexSource
	destination       *ReindexDestination
	conflicts         string
	size              *int
	script            *Script
}

// NewReindexService creates a new ReindexService.
func NewReindexService(client *Client) *ReindexService {
	return &ReindexService{
		client: client,
	}
}

// Consistency specifies an explicit write consistency setting for the operation.
func (s *ReindexService) Consistency(consistency string) *ReindexService {
	s.consistency = consistency
	return s
}

// Refresh indicates whether Elasticsearch should refresh the effected indexes
// immediately.
func (s *ReindexService) Refresh(refresh bool) *ReindexService {
	s.refresh = &refresh
	return s
}

// Timeout is the time each individual bulk request should wait for shards
// that are unavailable.
func (s *ReindexService) Timeout(timeout string) *ReindexService {
	s.timeout = timeout
	return s
}

// WaitForCompletion indicates whether Elasticsearch should block until the
// reindex is complete.
func (s *ReindexService) WaitForCompletion(waitForCompletion bool) *ReindexService {
	s.waitForCompletion = &waitForCompletion
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *ReindexService) Pretty(pretty bool) *ReindexService {
	s.pretty = pretty
	return s
}

// Source specifies the source of the reindexing process.
func (s *ReindexService) Source(source *ReindexSource) *ReindexService {
	s.source = source
	return s
}

// SourceIndex specifies the source index of the reindexing process.
func (s *ReindexService) SourceIndex(index string) *ReindexService {
	if s.source == nil {
		s.source = NewReindexSource()
	}
	s.source = s.source.Index(index)
	return s
}

// Destination specifies the destination of the reindexing process.
func (s *ReindexService) Destination(destination *ReindexDestination) *ReindexService {
	s.destination = destination
	return s
}

// DestinationIndex specifies the destination index of the reindexing process.
func (s *ReindexService) DestinationIndex(index string) *ReindexService {
	if s.destination == nil {
		s.destination = NewReindexDestination()
	}
	s.destination = s.destination.Index(index)
	return s
}

// DestinationIndexAndType specifies both the destination index and type
// of the reindexing process.
func (s *ReindexService) DestinationIndexAndType(index, typ string) *ReindexService {
	if s.destination == nil {
		s.destination = NewReindexDestination()
	}
	s.destination = s.destination.Index(index)
	s.destination = s.destination.Type(typ)
	return s
}

// Conflicts indicates what to do when the process detects version conflicts.
// Possible values are "proceed" and "abort".
func (s *ReindexService) Conflicts(conflicts string) *ReindexService {
	s.conflicts = conflicts
	return s
}

// AbortOnVersionConflict aborts the request on version conflicts.
// It is an alias to setting Conflicts("abort").
func (s *ReindexService) AbortOnVersionConflict() *ReindexService {
	s.conflicts = "abort"
	return s
}

// ProceedOnVersionConflict aborts the request on version conflicts.
// It is an alias to setting Conflicts("proceed").
func (s *ReindexService) ProceedOnVersionConflict() *ReindexService {
	s.conflicts = "proceed"
	return s
}

// Size sets an upper limit for the number of processed documents.
func (s *ReindexService) Size(size int) *ReindexService {
	s.size = &size
	return s
}

// Script allows for modification of the documents as they are reindexed
// from source to destination.
func (s *ReindexService) Script(script *Script) *ReindexService {
	s.script = script
	return s
}

// BodyJson specifies e.g. the query to restrict the results specified with the
// Query DSL (optional). The interface{} will be serialized to a JSON document,
// so use a map[string]interface{}.
func (s *ReindexService) BodyJson(body interface{}) *ReindexService {
	s.bodyJson = body
	return s
}

// Body specifies e.g. a query to restrict the results specified with
// the Query DSL (optional).
func (s *ReindexService) BodyString(body string) *ReindexService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *ReindexService) buildURL() (string, url.Values, error) {
	// Build URL path
	path := "/_reindex"

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.consistency != "" {
		params.Set("consistency", s.consistency)
	}
	if s.refresh != nil {
		params.Set("refresh", fmt.Sprintf("%v", *s.refresh))
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.waitForCompletion != nil {
		params.Set("wait_for_completion", fmt.Sprintf("%v", *s.waitForCompletion))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *ReindexService) Validate() error {
	var invalid []string
	if s.source == nil {
		invalid = append(invalid, "Source")
	} else {
		if len(s.source.indices) == 0 {
			invalid = append(invalid, "Source.Index")
		}
	}
	if s.destination == nil {
		invalid = append(invalid, "Destination")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// body returns the body part of the document request.
func (s *ReindexService) body() (interface{}, error) {
	if s.bodyJson != nil {
		return s.bodyJson, nil
	}
	if s.bodyString != "" {
		return s.bodyString, nil
	}

	body := make(map[string]interface{})

	if s.conflicts != "" {
		body["conflicts"] = s.conflicts
	}
	if s.size != nil {
		body["size"] = *s.size
	}
	if s.script != nil {
		out, err := s.script.Source()
		if err != nil {
			return nil, err
		}
		body["script"] = out
	}

	src, err := s.source.Source()
	if err != nil {
		return nil, err
	}
	body["source"] = src

	dst, err := s.destination.Source()
	if err != nil {
		return nil, err
	}
	body["dest"] = dst

	return body, nil
}

// Do executes the operation.
func (s *ReindexService) Do() (*ReindexResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *ReindexService) DoC(ctx context.Context) (*ReindexResponse, error) {
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
	ret := new(ReindexResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// ReindexResponse is the response of ReindexService.Do.
type ReindexResponse struct {
	Took             interface{}             `json:"took"` // 2.3.0 returns "37.7ms" while 2.2 returns 38 for took
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

// -- Source of Reindex --

// ReindexSource specifies the source of a Reindex process.
type ReindexSource struct {
	searchType   string // default in ES is "query_then_fetch"
	indices      []string
	types        []string
	routing      *string
	preference   *string
	requestCache *bool
	scroll       string
	query        Query
	sorts        []SortInfo
	sorters      []Sorter
	searchSource *SearchSource
}

// NewReindexSource creates a new ReindexSource.
func NewReindexSource() *ReindexSource {
	return &ReindexSource{
		indices: make([]string, 0),
		types:   make([]string, 0),
		sorts:   make([]SortInfo, 0),
		sorters: make([]Sorter, 0),
	}
}

// SearchType is the search operation type. Possible values are
// "query_then_fetch" and "dfs_query_then_fetch".
func (r *ReindexSource) SearchType(searchType string) *ReindexSource {
	r.searchType = searchType
	return r
}

func (r *ReindexSource) SearchTypeDfsQueryThenFetch() *ReindexSource {
	return r.SearchType("dfs_query_then_fetch")
}

func (r *ReindexSource) SearchTypeQueryThenFetch() *ReindexSource {
	return r.SearchType("query_then_fetch")
}

func (r *ReindexSource) Index(indices ...string) *ReindexSource {
	r.indices = append(r.indices, indices...)
	return r
}

func (r *ReindexSource) Type(types ...string) *ReindexSource {
	r.types = append(r.types, types...)
	return r
}

func (r *ReindexSource) Preference(preference string) *ReindexSource {
	r.preference = &preference
	return r
}

func (r *ReindexSource) RequestCache(requestCache bool) *ReindexSource {
	r.requestCache = &requestCache
	return r
}

func (r *ReindexSource) Scroll(scroll string) *ReindexSource {
	r.scroll = scroll
	return r
}

func (r *ReindexSource) Query(query Query) *ReindexSource {
	r.query = query
	return r
}

// Sort adds a sort order.
func (s *ReindexSource) Sort(field string, ascending bool) *ReindexSource {
	s.sorts = append(s.sorts, SortInfo{Field: field, Ascending: ascending})
	return s
}

// SortWithInfo adds a sort order.
func (s *ReindexSource) SortWithInfo(info SortInfo) *ReindexSource {
	s.sorts = append(s.sorts, info)
	return s
}

// SortBy	adds a sort order.
func (s *ReindexSource) SortBy(sorter ...Sorter) *ReindexSource {
	s.sorters = append(s.sorters, sorter...)
	return s
}

// Source returns a serializable JSON request for the request.
func (r *ReindexSource) Source() (interface{}, error) {
	source := make(map[string]interface{})

	if r.query != nil {
		src, err := r.query.Source()
		if err != nil {
			return nil, err
		}
		source["query"] = src
	} else if r.searchSource != nil {
		src, err := r.searchSource.Source()
		if err != nil {
			return nil, err
		}
		source["source"] = src
	}

	if r.searchType != "" {
		source["search_type"] = r.searchType
	}

	switch len(r.indices) {
	case 0:
	case 1:
		source["index"] = r.indices[0]
	default:
		source["index"] = r.indices
	}

	switch len(r.types) {
	case 0:
	case 1:
		source["type"] = r.types[0]
	default:
		source["type"] = r.types
	}

	if r.preference != nil && *r.preference != "" {
		source["preference"] = *r.preference
	}

	if r.requestCache != nil {
		source["request_cache"] = fmt.Sprintf("%v", *r.requestCache)
	}

	if r.scroll != "" {
		source["scroll"] = r.scroll
	}

	if len(r.sorters) > 0 {
		var sortarr []interface{}
		for _, sorter := range r.sorters {
			src, err := sorter.Source()
			if err != nil {
				return nil, err
			}
			sortarr = append(sortarr, src)
		}
		source["sort"] = sortarr
	} else if len(r.sorts) > 0 {
		var sortarr []interface{}
		for _, sort := range r.sorts {
			src, err := sort.Source()
			if err != nil {
				return nil, err
			}
			sortarr = append(sortarr, src)
		}
		source["sort"] = sortarr
	}

	return source, nil
}

// -source Destination of Reindex --

// ReindexDestination is the destination of a Reindex API call.
// It is basically the meta data of a BulkIndexRequest.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/2.3/docs-reindex.html
// fsourcer details.
type ReindexDestination struct {
	index       string
	typ         string
	routing     string
	parent      string
	opType      string
	version     int64  // default is MATCH_ANY
	versionType string // default is "internal"
}

// NewReindexDestination returns a new ReindexDestination.
func NewReindexDestination() *ReindexDestination {
	return &ReindexDestination{}
}

// Index specifies name of the Elasticsearch index to use as the destination
// of a reindexing process.
func (r *ReindexDestination) Index(index string) *ReindexDestination {
	r.index = index
	return r
}

// Type specifies the Elasticsearch type to use for reindexing.
func (r *ReindexDestination) Type(typ string) *ReindexDestination {
	r.typ = typ
	return r
}

// Routing specifies a routing value for the reindexing request.
// It can be "keep", "discard", or start with "=". The latter specifies
// the routing on the bulk request.
func (r *ReindexDestination) Routing(routing string) *ReindexDestination {
	r.routing = routing
	return r
}

// Keep sets the routing on the bulk request sent for each match to the routing
// of the match (the default).
func (r *ReindexDestination) Keep() *ReindexDestination {
	r.routing = "keep"
	return r
}

// Discard sets the routing on the bulk request sent for each match to null.
func (r *ReindexDestination) Discard() *ReindexDestination {
	r.routing = "discard"
	return r
}

// Parent specifies the identifier of the parent document (if available).
func (r *ReindexDestination) Parent(parent string) *ReindexDestination {
	r.parent = parent
	return r
}

// OpType specifies if this request should follow create-only or upsert
// behavior. This follows the OpType of the standard document index API.
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html#operation-type
// for details.
func (r *ReindexDestination) OpType(opType string) *ReindexDestination {
	r.opType = opType
	return r
}

// Version indicates the version of the document as part of an optimistic
// concurrency model.
func (r *ReindexDestination) Version(version int64) *ReindexDestination {
	r.version = version
	return r
}

// VersionType specifies how versions are created.
func (r *ReindexDestination) VersionType(versionType string) *ReindexDestination {
	r.versionType = versionType
	return r
}

// Source returns a serializable JSON request for the request.
func (r *ReindexDestination) Source() (interface{}, error) {
	source := make(map[string]interface{})
	if r.index != "" {
		source["index"] = r.index
	}
	if r.typ != "" {
		source["type"] = r.typ
	}
	if r.routing != "" {
		source["routing"] = r.routing
	}
	if r.opType != "" {
		source["op_type"] = r.opType
	}
	if r.parent != "" {
		source["parent"] = r.parent
	}
	if r.version > 0 {
		source["version"] = r.version
	}
	if r.versionType != "" {
		source["version_type"] = r.versionType
	}
	return source, nil
}
