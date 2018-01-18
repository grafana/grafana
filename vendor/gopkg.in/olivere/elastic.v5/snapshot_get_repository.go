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

// SnapshotGetRepositoryService reads a snapshot repository.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.3/modules-snapshots.html
// for details.
type SnapshotGetRepositoryService struct {
	client        *Client
	pretty        bool
	repository    []string
	local         *bool
	masterTimeout string
}

// NewSnapshotGetRepositoryService creates a new SnapshotGetRepositoryService.
func NewSnapshotGetRepositoryService(client *Client) *SnapshotGetRepositoryService {
	return &SnapshotGetRepositoryService{
		client:     client,
		repository: make([]string, 0),
	}
}

// Repository is the list of repository names.
func (s *SnapshotGetRepositoryService) Repository(repositories ...string) *SnapshotGetRepositoryService {
	s.repository = append(s.repository, repositories...)
	return s
}

// Local indicates whether to return local information, i.e. do not retrieve the state from master node (default: false).
func (s *SnapshotGetRepositoryService) Local(local bool) *SnapshotGetRepositoryService {
	s.local = &local
	return s
}

// MasterTimeout specifies an explicit operation timeout for connection to master node.
func (s *SnapshotGetRepositoryService) MasterTimeout(masterTimeout string) *SnapshotGetRepositoryService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *SnapshotGetRepositoryService) Pretty(pretty bool) *SnapshotGetRepositoryService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *SnapshotGetRepositoryService) buildURL() (string, url.Values, error) {
	// Build URL
	var err error
	var path string
	if len(s.repository) > 0 {
		path, err = uritemplates.Expand("/_snapshot/{repository}", map[string]string{
			"repository": strings.Join(s.repository, ","),
		})
	} else {
		path = "/_snapshot"
	}
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
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *SnapshotGetRepositoryService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *SnapshotGetRepositoryService) Do(ctx context.Context) (SnapshotGetRepositoryResponse, error) {
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
	var ret SnapshotGetRepositoryResponse
	if err := json.Unmarshal(res.Body, &ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// SnapshotGetRepositoryResponse is the response of SnapshotGetRepositoryService.Do.
type SnapshotGetRepositoryResponse map[string]*SnapshotRepositoryMetaData

// SnapshotRepositoryMetaData contains all information about
// a single snapshot repository.
type SnapshotRepositoryMetaData struct {
	Type     string                 `json:"type"`
	Settings map[string]interface{} `json:"settings,omitempty"`
}
