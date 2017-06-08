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

// IndicesDeleteWarmerService allows to delete a warmer.
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-warmers.html.
type IndicesDeleteWarmerService struct {
	client        *Client
	pretty        bool
	index         []string
	name          []string
	masterTimeout string
}

// NewIndicesDeleteWarmerService creates a new IndicesDeleteWarmerService.
func NewIndicesDeleteWarmerService(client *Client) *IndicesDeleteWarmerService {
	return &IndicesDeleteWarmerService{
		client: client,
		index:  make([]string, 0),
		name:   make([]string, 0),
	}
}

// Index is a list of index names the mapping should be added to
// (supports wildcards); use `_all` or omit to add the mapping on all indices.
func (s *IndicesDeleteWarmerService) Index(indices ...string) *IndicesDeleteWarmerService {
	s.index = append(s.index, indices...)
	return s
}

// Name is a list of warmer names to delete (supports wildcards);
// use `_all` to delete all warmers in the specified indices.
func (s *IndicesDeleteWarmerService) Name(name ...string) *IndicesDeleteWarmerService {
	s.name = append(s.name, name...)
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *IndicesDeleteWarmerService) MasterTimeout(masterTimeout string) *IndicesDeleteWarmerService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesDeleteWarmerService) Pretty(pretty bool) *IndicesDeleteWarmerService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesDeleteWarmerService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/{index}/_warmer/{name}", map[string]string{
		"index": strings.Join(s.index, ","),
		"name":  strings.Join(s.name, ","),
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	if len(s.name) > 0 {
		params.Set("name", strings.Join(s.name, ","))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesDeleteWarmerService) Validate() error {
	var invalid []string
	if len(s.index) == 0 {
		invalid = append(invalid, "Index")
	}
	if len(s.name) == 0 {
		invalid = append(invalid, "Name")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *IndicesDeleteWarmerService) Do() (*DeleteWarmerResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *IndicesDeleteWarmerService) DoC(ctx context.Context) (*DeleteWarmerResponse, error) {
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
	res, err := s.client.PerformRequestC(ctx, "DELETE", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(DeleteWarmerResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// DeleteWarmerResponse is the response of IndicesDeleteWarmerService.Do.
type DeleteWarmerResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
