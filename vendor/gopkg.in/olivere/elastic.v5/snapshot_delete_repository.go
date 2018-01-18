// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// SnapshotDeleteRepositoryService deletes a snapshot repository.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.3/modules-snapshots.html
// for details.
type SnapshotDeleteRepositoryService struct {
	client        *Client
	pretty        bool
	repository    []string
	masterTimeout string
	timeout       string
}

// NewSnapshotDeleteRepositoryService creates a new SnapshotDeleteRepositoryService.
func NewSnapshotDeleteRepositoryService(client *Client) *SnapshotDeleteRepositoryService {
	return &SnapshotDeleteRepositoryService{
		client:     client,
		repository: make([]string, 0),
	}
}

// Repository is the list of repository names.
func (s *SnapshotDeleteRepositoryService) Repository(repositories ...string) *SnapshotDeleteRepositoryService {
	s.repository = append(s.repository, repositories...)
	return s
}

// MasterTimeout specifies an explicit operation timeout for connection to master node.
func (s *SnapshotDeleteRepositoryService) MasterTimeout(masterTimeout string) *SnapshotDeleteRepositoryService {
	s.masterTimeout = masterTimeout
	return s
}

// Timeout is an explicit operation timeout.
func (s *SnapshotDeleteRepositoryService) Timeout(timeout string) *SnapshotDeleteRepositoryService {
	s.timeout = timeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *SnapshotDeleteRepositoryService) Pretty(pretty bool) *SnapshotDeleteRepositoryService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *SnapshotDeleteRepositoryService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_snapshot/{repository}", map[string]string{
		"repository": strings.Join(s.repository, ","),
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
func (s *SnapshotDeleteRepositoryService) Validate() error {
	var invalid []string
	if len(s.repository) == 0 {
		invalid = append(invalid, "Repository")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *SnapshotDeleteRepositoryService) Do(ctx context.Context) (*SnapshotDeleteRepositoryResponse, error) {
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
	ret := new(SnapshotDeleteRepositoryResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// SnapshotDeleteRepositoryResponse is the response of SnapshotDeleteRepositoryService.Do.
type SnapshotDeleteRepositoryResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
