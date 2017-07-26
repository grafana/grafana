// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// IndicesExistsTemplateService checks if a given template exists.
// See http://www.elastic.co/guide/en/elasticsearch/reference/5.2/indices-templates.html#indices-templates-exists
// for documentation.
type IndicesExistsTemplateService struct {
	client *Client
	pretty bool
	name   string
	local  *bool
}

// NewIndicesExistsTemplateService creates a new IndicesExistsTemplateService.
func NewIndicesExistsTemplateService(client *Client) *IndicesExistsTemplateService {
	return &IndicesExistsTemplateService{
		client: client,
	}
}

// Name is the name of the template.
func (s *IndicesExistsTemplateService) Name(name string) *IndicesExistsTemplateService {
	s.name = name
	return s
}

// Local indicates whether to return local information, i.e. do not retrieve
// the state from master node (default: false).
func (s *IndicesExistsTemplateService) Local(local bool) *IndicesExistsTemplateService {
	s.local = &local
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesExistsTemplateService) Pretty(pretty bool) *IndicesExistsTemplateService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesExistsTemplateService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_template/{name}", map[string]string{
		"name": s.name,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.local != nil {
		params.Set("local", fmt.Sprintf("%v", *s.local))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesExistsTemplateService) Validate() error {
	var invalid []string
	if s.name == "" {
		invalid = append(invalid, "Name")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *IndicesExistsTemplateService) Do(ctx context.Context) (bool, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return false, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return false, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, "HEAD", path, params, nil, 404)
	if err != nil {
		return false, err
	}

	// Return operation response
	switch res.StatusCode {
	case http.StatusOK:
		return true, nil
	case http.StatusNotFound:
		return false, nil
	default:
		return false, fmt.Errorf("elastic: got HTTP code %d when it should have been either 200 or 404", res.StatusCode)
	}
}
