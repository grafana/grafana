// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"golang.org/x/net/context"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

const (
	FieldStatsClusterLevel = "cluster"
	FieldStatsIndicesLevel = "indices"
)

// FieldStatsService allows finding statistical properties of a field without executing a search,
// but looking up measurements that are natively available in the Lucene index.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/search-field-stats.html
// for details
type FieldStatsService struct {
	client            *Client
	pretty            bool
	level             string
	index             []string
	allowNoIndices    *bool
	expandWildcards   string
	fields            []string
	ignoreUnavailable *bool
	bodyJson          interface{}
	bodyString        string
}

// NewFieldStatsService creates a new FieldStatsService
func NewFieldStatsService(client *Client) *FieldStatsService {
	return &FieldStatsService{
		client: client,
		index:  make([]string, 0),
		fields: make([]string, 0),
	}
}

// Index is a list of index names; use `_all` or empty string to perform
// the operation on all indices.
func (s *FieldStatsService) Index(index ...string) *FieldStatsService {
	s.index = append(s.index, index...)
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices expression
// resolves into no concrete indices.
// (This includes `_all` string or when no indices have been specified).
func (s *FieldStatsService) AllowNoIndices(allowNoIndices bool) *FieldStatsService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both.
func (s *FieldStatsService) ExpandWildcards(expandWildcards string) *FieldStatsService {
	s.expandWildcards = expandWildcards
	return s
}

// Fields is a list of fields for to get field statistics
// for (min value, max value, and more).
func (s *FieldStatsService) Fields(fields ...string) *FieldStatsService {
	s.fields = append(s.fields, fields...)
	return s
}

// IgnoreUnavailable is documented as: Whether specified concrete indices should be ignored when unavailable (missing or closed).
func (s *FieldStatsService) IgnoreUnavailable(ignoreUnavailable bool) *FieldStatsService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// Level sets if stats should be returned on a per index level or on a cluster wide level;
// should be one of 'cluster' or 'indices'; defaults to former
func (s *FieldStatsService) Level(level string) *FieldStatsService {
	s.level = level
	return s
}

// ClusterLevel is a helper that sets Level to "cluster".
func (s *FieldStatsService) ClusterLevel() *FieldStatsService {
	s.level = FieldStatsClusterLevel
	return s
}

// IndicesLevel is a helper that sets Level to "indices".
func (s *FieldStatsService) IndicesLevel() *FieldStatsService {
	s.level = FieldStatsIndicesLevel
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *FieldStatsService) Pretty(pretty bool) *FieldStatsService {
	s.pretty = pretty
	return s
}

// BodyJson is documented as: Field json objects containing the name and optionally a range to filter out indices result, that have results outside the defined bounds.
func (s *FieldStatsService) BodyJson(body interface{}) *FieldStatsService {
	s.bodyJson = body
	return s
}

// BodyString is documented as: Field json objects containing the name and optionally a range to filter out indices result, that have results outside the defined bounds.
func (s *FieldStatsService) BodyString(body string) *FieldStatsService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *FieldStatsService) buildURL() (string, url.Values, error) {
	// Build URL
	var err error
	var path string
	if len(s.index) > 0 {
		path, err = uritemplates.Expand("/{index}/_field_stats", map[string]string{
			"index": strings.Join(s.index, ","),
		})
	} else {
		path = "/_field_stats"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if len(s.fields) > 0 {
		params.Set("fields", strings.Join(s.fields, ","))
	}
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.level != "" {
		params.Set("level", s.level)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *FieldStatsService) Validate() error {
	var invalid []string
	if s.level != "" && (s.level != FieldStatsIndicesLevel && s.level != FieldStatsClusterLevel) {
		invalid = append(invalid, "Level")
	}
	if len(invalid) != 0 {
		return fmt.Errorf("missing or invalid required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *FieldStatsService) Do() (*FieldStatsResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *FieldStatsService) DoC(ctx context.Context) (*FieldStatsResponse, error) {
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
	var body interface{}
	if s.bodyJson != nil {
		body = s.bodyJson
	} else {
		body = s.bodyString
	}

	// Get HTTP response
	res, err := s.client.PerformRequestC(ctx, "POST", path, params, body, http.StatusNotFound)
	if err != nil {
		return nil, err
	}

	// TODO(oe): Is 404 really a valid response here?
	if res.StatusCode == http.StatusNotFound {
		return &FieldStatsResponse{make(map[string]IndexFieldStats)}, nil
	}

	// Return operation response
	ret := new(FieldStatsResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Request --

// FieldStatsRequest can be used to set up the body to be used in the
// Field Stats API.
type FieldStatsRequest struct {
	Fields           []string                          `json:"fields"`
	IndexConstraints map[string]*FieldStatsConstraints `json:"index_constraints,omitempty"`
}

// FieldStatsConstraints is a constraint on a field.
type FieldStatsConstraints struct {
	Min *FieldStatsComparison `json:"min_value,omitempty"`
	Max *FieldStatsComparison `json:"max_value,omitempty"`
}

// FieldStatsComparison contain all comparison operations that can be used
// in FieldStatsConstraints.
type FieldStatsComparison struct {
	Lte interface{} `json:"lte,omitempty"`
	Lt  interface{} `json:"lt,omitempty"`
	Gte interface{} `json:"gte,omitempty"`
	Gt  interface{} `json:"gt,omitempty"`
}

// -- Response --

// FieldStatsResponse is the response body content
type FieldStatsResponse struct {
	Indices map[string]IndexFieldStats `json:"indices,omitempty"`
}

// IndexFieldStats contains field stats for an index
type IndexFieldStats struct {
	Fields map[string]FieldStats `json:"fields,omitempty"`
}

// FieldStats contains stats of an individual  field
type FieldStats struct {
	MaxDoc                int64       `json:"max_doc"`
	DocCount              int64       `json:"doc_count"`
	Density               int64       `json:"density"`
	SumDocFrequeny        int64       `json:"sum_doc_freq"`
	SumTotalTermFrequency int64       `json:"sum_total_term_freq"`
	MinValue              interface{} `json:"min_value"`
	MinValueAsString      string      `json:"min_value_as_string"`
	MaxValue              interface{} `json:"max_value"`
	MaxValueAsString      string      `json:"max_value_as_string"`
}
