// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
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

// DeleteByQueryService deletes documents that match a query.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/docs-delete-by-query.html.
type DeleteByQueryService struct {
	client            *Client
	indices           []string
	types             []string
	analyzer          string
	consistency       string
	defaultOper       string
	df                string
	ignoreUnavailable *bool
	allowNoIndices    *bool
	expandWildcards   string
	replication       string
	routing           string
	timeout           string
	pretty            bool
	q                 string
	query             Query
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
func (s *DeleteByQueryService) Index(indices ...string) *DeleteByQueryService {
	if s.indices == nil {
		s.indices = make([]string, 0)
	}
	s.indices = append(s.indices, indices...)
	return s
}

// Type limits the delete operation to the given types.
func (s *DeleteByQueryService) Type(types ...string) *DeleteByQueryService {
	if s.types == nil {
		s.types = make([]string, 0)
	}
	s.types = append(s.types, types...)
	return s
}

// Analyzer to use for the query string.
func (s *DeleteByQueryService) Analyzer(analyzer string) *DeleteByQueryService {
	s.analyzer = analyzer
	return s
}

// Consistency represents the specific write consistency setting for the operation.
// It can be one, quorum, or all.
func (s *DeleteByQueryService) Consistency(consistency string) *DeleteByQueryService {
	s.consistency = consistency
	return s
}

// DefaultOperator for query string query (AND or OR).
func (s *DeleteByQueryService) DefaultOperator(defaultOperator string) *DeleteByQueryService {
	s.defaultOper = defaultOperator
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

// IgnoreUnavailable indicates whether specified concrete indices should be
// ignored when unavailable (missing or closed).
func (s *DeleteByQueryService) IgnoreUnavailable(ignore bool) *DeleteByQueryService {
	s.ignoreUnavailable = &ignore
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices (including the _all string
// or when no indices have been specified).
func (s *DeleteByQueryService) AllowNoIndices(allow bool) *DeleteByQueryService {
	s.allowNoIndices = &allow
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both. It can be "open" or "closed".
func (s *DeleteByQueryService) ExpandWildcards(expand string) *DeleteByQueryService {
	s.expandWildcards = expand
	return s
}

// Replication sets a specific replication type (sync or async).
func (s *DeleteByQueryService) Replication(replication string) *DeleteByQueryService {
	s.replication = replication
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

// Routing sets a specific routing value.
func (s *DeleteByQueryService) Routing(routing string) *DeleteByQueryService {
	s.routing = routing
	return s
}

// Timeout sets an explicit operation timeout, e.g. "1s" or "10000ms".
func (s *DeleteByQueryService) Timeout(timeout string) *DeleteByQueryService {
	s.timeout = timeout
	return s
}

// Pretty indents the JSON output from Elasticsearch.
func (s *DeleteByQueryService) Pretty(pretty bool) *DeleteByQueryService {
	s.pretty = pretty
	return s
}

// Query sets the query programmatically.
func (s *DeleteByQueryService) Query(query Query) *DeleteByQueryService {
	s.query = query
	return s
}

// Do executes the delete-by-query operation.
func (s *DeleteByQueryService) Do() (*DeleteByQueryResult, error) {
	return s.DoC(nil)
}

// DoC executes the delete-by-query operation.
func (s *DeleteByQueryService) DoC(ctx context.Context) (*DeleteByQueryResult, error) {
	var err error

	// Build url
	path := "/"

	// Indices part
	var indexPart []string
	for _, index := range s.indices {
		index, err = uritemplates.Expand("{index}", map[string]string{
			"index": index,
		})
		if err != nil {
			return nil, err
		}
		indexPart = append(indexPart, index)
	}
	if len(indexPart) > 0 {
		path += strings.Join(indexPart, ",")
	}

	// Types part
	var typesPart []string
	for _, typ := range s.types {
		typ, err = uritemplates.Expand("{type}", map[string]string{
			"type": typ,
		})
		if err != nil {
			return nil, err
		}
		typesPart = append(typesPart, typ)
	}
	if len(typesPart) > 0 {
		path += "/" + strings.Join(typesPart, ",")
	}

	// Search
	path += "/_query"

	// Parameters
	params := make(url.Values)
	if s.analyzer != "" {
		params.Set("analyzer", s.analyzer)
	}
	if s.consistency != "" {
		params.Set("consistency", s.consistency)
	}
	if s.defaultOper != "" {
		params.Set("default_operator", s.defaultOper)
	}
	if s.df != "" {
		params.Set("df", s.df)
	}
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if s.replication != "" {
		params.Set("replication", s.replication)
	}
	if s.routing != "" {
		params.Set("routing", s.routing)
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	if s.q != "" {
		params.Set("q", s.q)
	}

	// Set body if there is a query set
	var body interface{}
	if s.query != nil {
		src, err := s.query.Source()
		if err != nil {
			return nil, err
		}
		query := make(map[string]interface{})
		query["query"] = src
		body = query
	}

	// Get response
	res, err := s.client.PerformRequestC(ctx, "DELETE", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(DeleteByQueryResult)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// DeleteByQueryResult is the outcome of executing Do with DeleteByQueryService.
type DeleteByQueryResult struct {
	Took     int64                               `json:"took"`
	TimedOut bool                                `json:"timed_out"`
	Indices  map[string]IndexDeleteByQueryResult `json:"_indices"`
	Failures []shardOperationFailure             `json:"failures"`
}

// IndexNames returns the names of the indices the DeleteByQuery touched.
func (res DeleteByQueryResult) IndexNames() []string {
	var indices []string
	for index := range res.Indices {
		indices = append(indices, index)
	}
	return indices
}

// All returns the index delete-by-query result of all indices.
func (res DeleteByQueryResult) All() IndexDeleteByQueryResult {
	all, _ := res.Indices["_all"]
	return all
}

// IndexDeleteByQueryResult is the result of a delete-by-query for a specific
// index.
type IndexDeleteByQueryResult struct {
	// Found documents, matching the query.
	Found int `json:"found"`
	// Deleted documents, successfully, from the given index.
	Deleted int `json:"deleted"`
	// Missing documents when trying to delete them.
	Missing int `json:"missing"`
	// Failed documents to be deleted for the given index.
	Failed int `json:"failed"`
}
