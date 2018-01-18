// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// IngestGetPipelineService returns pipelines based on ID.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/get-pipeline-api.html
// for documentation.
type IngestGetPipelineService struct {
	client        *Client
	pretty        bool
	id            []string
	masterTimeout string
}

// NewIngestGetPipelineService creates a new IngestGetPipelineService.
func NewIngestGetPipelineService(client *Client) *IngestGetPipelineService {
	return &IngestGetPipelineService{
		client: client,
	}
}

// Id is a list of pipeline ids. Wildcards supported.
func (s *IngestGetPipelineService) Id(id ...string) *IngestGetPipelineService {
	s.id = append(s.id, id...)
	return s
}

// MasterTimeout is an explicit operation timeout for connection to master node.
func (s *IngestGetPipelineService) MasterTimeout(masterTimeout string) *IngestGetPipelineService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IngestGetPipelineService) Pretty(pretty bool) *IngestGetPipelineService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IngestGetPipelineService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	// Build URL
	if len(s.id) > 0 {
		path, err = uritemplates.Expand("/_ingest/pipeline/{id}", map[string]string{
			"id": strings.Join(s.id, ","),
		})
	} else {
		path = "/_ingest/pipeline"
	}
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
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IngestGetPipelineService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *IngestGetPipelineService) Do(ctx context.Context) (IngestGetPipelineResponse, error) {
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
	res, err := s.client.PerformRequest(ctx, "GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	var ret IngestGetPipelineResponse
	if err := json.Unmarshal(res.Body, &ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IngestGetPipelineResponse is the response of IngestGetPipelineService.Do.
type IngestGetPipelineResponse map[string]*IngestGetPipeline

type IngestGetPipeline struct {
	ID     string                 `json:"id"`
	Config map[string]interface{} `json:"config"`
}
