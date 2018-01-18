// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// SnapshotCreateService is documented at https://www.elastic.co/guide/en/elasticsearch/reference/5.x/modules-snapshots.html.
type SnapshotCreateService struct {
	client            *Client
	pretty            bool
	repository        string
	snapshot          string
	masterTimeout     string
	waitForCompletion *bool
	bodyJson          interface{}
	bodyString        string
}

// NewSnapshotCreateService creates a new SnapshotCreateService.
func NewSnapshotCreateService(client *Client) *SnapshotCreateService {
	return &SnapshotCreateService{
		client: client,
	}
}

// Repository is the repository name.
func (s *SnapshotCreateService) Repository(repository string) *SnapshotCreateService {
	s.repository = repository
	return s
}

// Snapshot is the snapshot name.
func (s *SnapshotCreateService) Snapshot(snapshot string) *SnapshotCreateService {
	s.snapshot = snapshot
	return s
}

// MasterTimeout is documented as: Explicit operation timeout for connection to master node.
func (s *SnapshotCreateService) MasterTimeout(masterTimeout string) *SnapshotCreateService {
	s.masterTimeout = masterTimeout
	return s
}

// WaitForCompletion is documented as: Should this request wait until the operation has completed before returning.
func (s *SnapshotCreateService) WaitForCompletion(waitForCompletion bool) *SnapshotCreateService {
	s.waitForCompletion = &waitForCompletion
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *SnapshotCreateService) Pretty(pretty bool) *SnapshotCreateService {
	s.pretty = pretty
	return s
}

// BodyJson is documented as: The snapshot definition.
func (s *SnapshotCreateService) BodyJson(body interface{}) *SnapshotCreateService {
	s.bodyJson = body
	return s
}

// BodyString is documented as: The snapshot definition.
func (s *SnapshotCreateService) BodyString(body string) *SnapshotCreateService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *SnapshotCreateService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_snapshot/{repository}/{snapshot}", map[string]string{
		"snapshot":   s.snapshot,
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
	if s.waitForCompletion != nil {
		params.Set("wait_for_completion", fmt.Sprintf("%v", *s.waitForCompletion))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *SnapshotCreateService) Validate() error {
	var invalid []string
	if s.repository == "" {
		invalid = append(invalid, "Repository")
	}
	if s.snapshot == "" {
		invalid = append(invalid, "Snapshot")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *SnapshotCreateService) Do(ctx context.Context) (*SnapshotCreateResponse, error) {
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
	var body interface{}
	if s.bodyJson != nil {
		body = s.bodyJson
	} else {
		body = s.bodyString
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, "PUT", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(SnapshotCreateResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// SnapshotShardFailure stores information about failures that occurred during shard snapshotting process.
type SnapshotShardFailure struct {
	Index     string `json:"index"`
	IndexUUID string `json:"index_uuid"`
	ShardID   int    `json:"shard_id"`
	Reason    string `json:"reason"`
	NodeID    string `json:"node_id"`
	Status    string `json:"status"`
}

// SnapshotCreateResponse is the response of SnapshotCreateService.Do.
type SnapshotCreateResponse struct {
	// Accepted indicates whether the request was accepted by elasticsearch.
	// It's available when waitForCompletion is false.
	Accepted *bool `json:"accepted"`

	// Snapshot is available when waitForCompletion is true.
	Snapshot *struct {
		Snapshot          string                 `json:"snapshot"`
		UUID              string                 `json:"uuid"`
		VersionID         int                    `json:"version_id"`
		Version           string                 `json:"version"`
		Indices           []string               `json:"indices"`
		State             string                 `json:"state"`
		Reason            string                 `json:"reason"`
		StartTime         time.Time              `json:"start_time"`
		StartTimeInMillis int64                  `json:"start_time_in_millis"`
		EndTime           time.Time              `json:"end_time"`
		EndTimeInMillis   int64                  `json:"end_time_in_millis"`
		DurationInMillis  int64                  `json:"duration_in_millis"`
		Failures          []SnapshotShardFailure `json:"failures"`
		Shards            shardsInfo             `json:"shards"`
	} `json:"snapshot"`
}
