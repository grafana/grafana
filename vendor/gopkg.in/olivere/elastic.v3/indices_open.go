// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"

	"golang.org/x/net/context"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

// IndicesOpenService opens an index.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-open-close.html
// for details.
type IndicesOpenService struct {
	client            *Client
	pretty            bool
	index             string
	timeout           string
	masterTimeout     string
	ignoreUnavailable *bool
	allowNoIndices    *bool
	expandWildcards   string
}

// NewIndicesOpenService creates and initializes a new IndicesOpenService.
func NewIndicesOpenService(client *Client) *IndicesOpenService {
	return &IndicesOpenService{client: client}
}

// Index is the name of the index to open.
func (s *IndicesOpenService) Index(index string) *IndicesOpenService {
	s.index = index
	return s
}

// Timeout is an explicit operation timeout.
func (s *IndicesOpenService) Timeout(timeout string) *IndicesOpenService {
	s.timeout = timeout
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *IndicesOpenService) MasterTimeout(masterTimeout string) *IndicesOpenService {
	s.masterTimeout = masterTimeout
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should
// be ignored when unavailable (missing or closed).
func (s *IndicesOpenService) IgnoreUnavailable(ignoreUnavailable bool) *IndicesOpenService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices.
// (This includes `_all` string or when no indices have been specified).
func (s *IndicesOpenService) AllowNoIndices(allowNoIndices bool) *IndicesOpenService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both..
func (s *IndicesOpenService) ExpandWildcards(expandWildcards string) *IndicesOpenService {
	s.expandWildcards = expandWildcards
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesOpenService) Pretty(pretty bool) *IndicesOpenService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesOpenService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/{index}/_open", map[string]string{
		"index": s.index,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
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

	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesOpenService) Validate() error {
	var invalid []string
	if s.index == "" {
		invalid = append(invalid, "Index")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *IndicesOpenService) Do() (*IndicesOpenResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *IndicesOpenService) DoC(ctx context.Context) (*IndicesOpenResponse, error) {
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
	res, err := s.client.PerformRequestC(ctx, "POST", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(IndicesOpenResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IndicesOpenResponse is the response of IndicesOpenService.Do.
type IndicesOpenResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
