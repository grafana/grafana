// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"
)

// ClearScrollService clears one or more scroll contexts by their ids.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-request-scroll.html#_clear_scroll_api
// for details.
type ClearScrollService struct {
	client   *Client
	pretty   bool
	scrollId []string
}

// NewClearScrollService creates a new ClearScrollService.
func NewClearScrollService(client *Client) *ClearScrollService {
	return &ClearScrollService{
		client:   client,
		scrollId: make([]string, 0),
	}
}

// ScrollId is a list of scroll IDs to clear.
// Use _all to clear all search contexts.
func (s *ClearScrollService) ScrollId(scrollIds ...string) *ClearScrollService {
	s.scrollId = append(s.scrollId, scrollIds...)
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *ClearScrollService) Pretty(pretty bool) *ClearScrollService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *ClearScrollService) buildURL() (string, url.Values, error) {
	// Build URL
	path := "/_search/scroll/"

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *ClearScrollService) Validate() error {
	var invalid []string
	if len(s.scrollId) == 0 {
		invalid = append(invalid, "ScrollId")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *ClearScrollService) Do(ctx context.Context) (*ClearScrollResponse, error) {
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
	body := map[string][]string{
		"scroll_id": s.scrollId,
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, "DELETE", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(ClearScrollResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// ClearScrollResponse is the response of ClearScrollService.Do.
type ClearScrollResponse struct {
}
