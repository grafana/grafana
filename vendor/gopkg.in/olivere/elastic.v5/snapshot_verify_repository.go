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

// SnapshotVerifyRepositoryService verifies a snapshop repository.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.3/modules-snapshots.html
// for details.
type SnapshotVerifyRepositoryService struct {
	client        *Client
	pretty        bool
	repository    string
	masterTimeout string
	timeout       string
}

// NewSnapshotVerifyRepositoryService creates a new SnapshotVerifyRepositoryService.
func NewSnapshotVerifyRepositoryService(client *Client) *SnapshotVerifyRepositoryService {
	return &SnapshotVerifyRepositoryService{
		client: client,
	}
}

// Repository specifies the repository name.
func (s *SnapshotVerifyRepositoryService) Repository(repository string) *SnapshotVerifyRepositoryService {
	s.repository = repository
	return s
}

// MasterTimeout is the explicit operation timeout for connection to master node.
func (s *SnapshotVerifyRepositoryService) MasterTimeout(masterTimeout string) *SnapshotVerifyRepositoryService {
	s.masterTimeout = masterTimeout
	return s
}

// Timeout is an explicit operation timeout.
func (s *SnapshotVerifyRepositoryService) Timeout(timeout string) *SnapshotVerifyRepositoryService {
	s.timeout = timeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *SnapshotVerifyRepositoryService) Pretty(pretty bool) *SnapshotVerifyRepositoryService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *SnapshotVerifyRepositoryService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_snapshot/{repository}/_verify", map[string]string{
		"repository": s.repository,
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
func (s *SnapshotVerifyRepositoryService) Validate() error {
	var invalid []string
	if s.repository == "" {
		invalid = append(invalid, "Repository")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *SnapshotVerifyRepositoryService) Do(ctx context.Context) (*SnapshotVerifyRepositoryResponse, error) {
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
	res, err := s.client.PerformRequest(ctx, "POST", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(SnapshotVerifyRepositoryResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// SnapshotVerifyRepositoryResponse is the response of SnapshotVerifyRepositoryService.Do.
type SnapshotVerifyRepositoryResponse struct {
	Nodes map[string]*SnapshotVerifyRepositoryNode `json:"nodes"`
}

type SnapshotVerifyRepositoryNode struct {
	Name string `json:"name"`
}
