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

// SnapshotCreateRepositoryService creates a snapshot repository.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.3/modules-snapshots.html
// for details.
type SnapshotCreateRepositoryService struct {
	client        *Client
	pretty        bool
	repository    string
	masterTimeout string
	timeout       string
	verify        *bool
	typ           string
	settings      map[string]interface{}
	bodyJson      interface{}
	bodyString    string
}

// NewSnapshotCreateRepositoryService creates a new SnapshotCreateRepositoryService.
func NewSnapshotCreateRepositoryService(client *Client) *SnapshotCreateRepositoryService {
	return &SnapshotCreateRepositoryService{
		client: client,
	}
}

// Repository is the repository name.
func (s *SnapshotCreateRepositoryService) Repository(repository string) *SnapshotCreateRepositoryService {
	s.repository = repository
	return s
}

// MasterTimeout specifies an explicit operation timeout for connection to master node.
func (s *SnapshotCreateRepositoryService) MasterTimeout(masterTimeout string) *SnapshotCreateRepositoryService {
	s.masterTimeout = masterTimeout
	return s
}

// Timeout is an explicit operation timeout.
func (s *SnapshotCreateRepositoryService) Timeout(timeout string) *SnapshotCreateRepositoryService {
	s.timeout = timeout
	return s
}

// Verify indicates whether to verify the repository after creation.
func (s *SnapshotCreateRepositoryService) Verify(verify bool) *SnapshotCreateRepositoryService {
	s.verify = &verify
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *SnapshotCreateRepositoryService) Pretty(pretty bool) *SnapshotCreateRepositoryService {
	s.pretty = pretty
	return s
}

// Type sets the snapshot repository type, e.g. "fs".
func (s *SnapshotCreateRepositoryService) Type(typ string) *SnapshotCreateRepositoryService {
	s.typ = typ
	return s
}

// Settings sets all settings of the snapshot repository.
func (s *SnapshotCreateRepositoryService) Settings(settings map[string]interface{}) *SnapshotCreateRepositoryService {
	s.settings = settings
	return s
}

// Setting sets a single settings of the snapshot repository.
func (s *SnapshotCreateRepositoryService) Setting(name string, value interface{}) *SnapshotCreateRepositoryService {
	if s.settings == nil {
		s.settings = make(map[string]interface{})
	}
	s.settings[name] = value
	return s
}

// BodyJson is documented as: The repository definition.
func (s *SnapshotCreateRepositoryService) BodyJson(body interface{}) *SnapshotCreateRepositoryService {
	s.bodyJson = body
	return s
}

// BodyString is documented as: The repository definition.
func (s *SnapshotCreateRepositoryService) BodyString(body string) *SnapshotCreateRepositoryService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *SnapshotCreateRepositoryService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_snapshot/{repository}", map[string]string{
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
	if s.verify != nil {
		params.Set("verify", fmt.Sprintf("%v", *s.verify))
	}
	return path, params, nil
}

// buildBody builds the body for the operation.
func (s *SnapshotCreateRepositoryService) buildBody() (interface{}, error) {
	if s.bodyJson != nil {
		return s.bodyJson, nil
	}
	if s.bodyString != "" {
		return s.bodyString, nil
	}

	body := map[string]interface{}{
		"type": s.typ,
	}
	if len(s.settings) > 0 {
		body["settings"] = s.settings
	}
	return body, nil
}

// Validate checks if the operation is valid.
func (s *SnapshotCreateRepositoryService) Validate() error {
	var invalid []string
	if s.repository == "" {
		invalid = append(invalid, "Repository")
	}
	if s.bodyString == "" && s.bodyJson == nil {
		invalid = append(invalid, "BodyJson")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *SnapshotCreateRepositoryService) Do(ctx context.Context) (*SnapshotCreateRepositoryResponse, error) {
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
	body, err := s.buildBody()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, "PUT", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(SnapshotCreateRepositoryResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// SnapshotCreateRepositoryResponse is the response of SnapshotCreateRepositoryService.Do.
type SnapshotCreateRepositoryResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
