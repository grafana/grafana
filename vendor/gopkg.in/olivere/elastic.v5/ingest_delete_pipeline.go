// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// IngestDeletePipelineService deletes pipelines by ID.
// It is documented at https://www.elastic.co/guide/en/elasticsearch/reference/5.2/delete-pipeline-api.html.
type IngestDeletePipelineService struct {
	client        *Client
	pretty        bool
	id            string
	masterTimeout string
	timeout       string
}

// NewIngestDeletePipelineService creates a new IngestDeletePipelineService.
func NewIngestDeletePipelineService(client *Client) *IngestDeletePipelineService {
	return &IngestDeletePipelineService{
		client: client,
	}
}

// Id is documented as: Pipeline ID.
func (s *IngestDeletePipelineService) Id(id string) *IngestDeletePipelineService {
	s.id = id
	return s
}

// MasterTimeout is documented as: Explicit operation timeout for connection to master node.
func (s *IngestDeletePipelineService) MasterTimeout(masterTimeout string) *IngestDeletePipelineService {
	s.masterTimeout = masterTimeout
	return s
}

// Timeout is documented as: Explicit operation timeout.
func (s *IngestDeletePipelineService) Timeout(timeout string) *IngestDeletePipelineService {
	s.timeout = timeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IngestDeletePipelineService) Pretty(pretty bool) *IngestDeletePipelineService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IngestDeletePipelineService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_ingest/pipeline/{id}", map[string]string{
		"id": s.id,
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
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IngestDeletePipelineService) Validate() error {
	var invalid []string
	if s.id == "" {
		invalid = append(invalid, "Id")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *IngestDeletePipelineService) Do(ctx context.Context) (*IngestDeletePipelineResponse, error) {
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
	ret := new(IngestDeletePipelineResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IngestDeletePipelineResponse is the response of IngestDeletePipelineService.Do.
type IngestDeletePipelineResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
