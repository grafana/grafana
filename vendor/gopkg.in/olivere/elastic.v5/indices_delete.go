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

// IndicesDeleteService allows to delete existing indices.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/indices-delete-index.html
// for details.
type IndicesDeleteService struct {
	client        *Client
	pretty        bool
	index         []string
	timeout       string
	masterTimeout string
}

// NewIndicesDeleteService creates and initializes a new IndicesDeleteService.
func NewIndicesDeleteService(client *Client) *IndicesDeleteService {
	return &IndicesDeleteService{
		client: client,
		index:  make([]string, 0),
	}
}

// Index adds the list of indices to delete.
// Use `_all` or `*` string to delete all indices.
func (s *IndicesDeleteService) Index(index []string) *IndicesDeleteService {
	s.index = index
	return s
}

// Timeout is an explicit operation timeout.
func (s *IndicesDeleteService) Timeout(timeout string) *IndicesDeleteService {
	s.timeout = timeout
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *IndicesDeleteService) MasterTimeout(masterTimeout string) *IndicesDeleteService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesDeleteService) Pretty(pretty bool) *IndicesDeleteService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesDeleteService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/{index}", map[string]string{
		"index": strings.Join(s.index, ","),
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
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesDeleteService) Validate() error {
	var invalid []string
	if len(s.index) == 0 {
		invalid = append(invalid, "Index")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *IndicesDeleteService) Do(ctx context.Context) (*IndicesDeleteResponse, error) {
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
	res, err := s.client.PerformRequest(ctx, "DELETE", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(IndicesDeleteResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a delete index request.

// IndicesDeleteResponse is the response of IndicesDeleteService.Do.
type IndicesDeleteResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
