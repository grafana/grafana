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

// CountService is a convenient service for determining the
// number of documents in an index. Use SearchService with
// a SearchType of count for counting with queries etc.
type CountService struct {
	client                 *Client
	pretty                 bool
	index                  []string
	typ                    []string
	allowNoIndices         *bool
	analyzeWildcard        *bool
	analyzer               string
	defaultOperator        string
	df                     string
	expandWildcards        string
	ignoreUnavailable      *bool
	lenient                *bool
	lowercaseExpandedTerms *bool
	minScore               interface{}
	preference             string
	q                      string
	query                  Query
	routing                string
	bodyJson               interface{}
	bodyString             string
}

// NewCountService creates a new CountService.
func NewCountService(client *Client) *CountService {
	return &CountService{
		client: client,
	}
}

// Index sets the names of the indices to restrict the results.
func (s *CountService) Index(index ...string) *CountService {
	if s.index == nil {
		s.index = make([]string, 0)
	}
	s.index = append(s.index, index...)
	return s
}

// Type sets the types to use to restrict the results.
func (s *CountService) Type(typ ...string) *CountService {
	if s.typ == nil {
		s.typ = make([]string, 0)
	}
	s.typ = append(s.typ, typ...)
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices. (This includes "_all" string
// or when no indices have been specified).
func (s *CountService) AllowNoIndices(allowNoIndices bool) *CountService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// AnalyzeWildcard specifies whether wildcard and prefix queries should be
// analyzed (default: false).
func (s *CountService) AnalyzeWildcard(analyzeWildcard bool) *CountService {
	s.analyzeWildcard = &analyzeWildcard
	return s
}

// Analyzer specifies the analyzer to use for the query string.
func (s *CountService) Analyzer(analyzer string) *CountService {
	s.analyzer = analyzer
	return s
}

// DefaultOperator specifies the default operator for query string query (AND or OR).
func (s *CountService) DefaultOperator(defaultOperator string) *CountService {
	s.defaultOperator = defaultOperator
	return s
}

// Df specifies the field to use as default where no field prefix is given
// in the query string.
func (s *CountService) Df(df string) *CountService {
	s.df = df
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both.
func (s *CountService) ExpandWildcards(expandWildcards string) *CountService {
	s.expandWildcards = expandWildcards
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should be
// ignored when unavailable (missing or closed).
func (s *CountService) IgnoreUnavailable(ignoreUnavailable bool) *CountService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// Lenient specifies whether format-based query failures (such as
// providing text to a numeric field) should be ignored.
func (s *CountService) Lenient(lenient bool) *CountService {
	s.lenient = &lenient
	return s
}

// LowercaseExpandedTerms specifies whether query terms should be lowercased.
func (s *CountService) LowercaseExpandedTerms(lowercaseExpandedTerms bool) *CountService {
	s.lowercaseExpandedTerms = &lowercaseExpandedTerms
	return s
}

// MinScore indicates to include only documents with a specific `_score`
// value in the result.
func (s *CountService) MinScore(minScore interface{}) *CountService {
	s.minScore = minScore
	return s
}

// Preference specifies the node or shard the operation should be
// performed on (default: random).
func (s *CountService) Preference(preference string) *CountService {
	s.preference = preference
	return s
}

// Q in the Lucene query string syntax. You can also use Query to pass
// a Query struct.
func (s *CountService) Q(q string) *CountService {
	s.q = q
	return s
}

// Query specifies the query to pass. You can also pass a query string with Q.
func (s *CountService) Query(query Query) *CountService {
	s.query = query
	return s
}

// Routing specifies the routing value.
func (s *CountService) Routing(routing string) *CountService {
	s.routing = routing
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *CountService) Pretty(pretty bool) *CountService {
	s.pretty = pretty
	return s
}

// BodyJson specifies the query to restrict the results specified with the
// Query DSL (optional). The interface{} will be serialized to a JSON document,
// so use a map[string]interface{}.
func (s *CountService) BodyJson(body interface{}) *CountService {
	s.bodyJson = body
	return s
}

// Body specifies a query to restrict the results specified with
// the Query DSL (optional).
func (s *CountService) BodyString(body string) *CountService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *CountService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	if len(s.index) > 0 && len(s.typ) > 0 {
		path, err = uritemplates.Expand("/{index}/{type}/_count", map[string]string{
			"index": strings.Join(s.index, ","),
			"type":  strings.Join(s.typ, ","),
		})
	} else if len(s.index) > 0 {
		path, err = uritemplates.Expand("/{index}/_count", map[string]string{
			"index": strings.Join(s.index, ","),
		})
	} else if len(s.typ) > 0 {
		path, err = uritemplates.Expand("/_all/{type}/_count", map[string]string{
			"type": strings.Join(s.typ, ","),
		})
	} else {
		path = "/_all/_count"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
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
	if s.defaultOperator != "" {
		params.Set("default_operator", s.defaultOperator)
	}
	if s.df != "" {
		params.Set("df", s.df)
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
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
	if s.minScore != nil {
		params.Set("min_score", fmt.Sprintf("%v", s.minScore))
	}
	if s.preference != "" {
		params.Set("preference", s.preference)
	}
	if s.q != "" {
		params.Set("q", s.q)
	}
	if s.routing != "" {
		params.Set("routing", s.routing)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *CountService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *CountService) Do() (int64, error) {
	return s.DoC(nil)
}

func (s *CountService) DoC(ctx context.Context) (int64, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return 0, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return 0, err
	}

	// Setup HTTP request body
	var body interface{}
	if s.query != nil {
		src, err := s.query.Source()
		if err != nil {
			return 0, err
		}
		query := make(map[string]interface{})
		query["query"] = src
		body = query
	} else if s.bodyJson != nil {
		body = s.bodyJson
	} else if s.bodyString != "" {
		body = s.bodyString
	}

	// Get HTTP response
	res, err := s.client.PerformRequestC(ctx, "POST", path, params, body)
	if err != nil {
		return 0, err
	}

	// Return result
	ret := new(CountResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return 0, err
	}
	if ret != nil {
		return ret.Count, nil
	}

	return int64(0), nil
}

// CountResponse is the response of using the Count API.
type CountResponse struct {
	Count  int64      `json:"count"`
	Shards shardsInfo `json:"_shards,omitempty"`
}
