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

// IndicesShrinkService allows you to shrink an existing index into a
// new index with fewer primary shards.
//
// For further details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/indices-shrink-index.html.
type IndicesShrinkService struct {
	client              *Client
	pretty              bool
	source              string
	target              string
	masterTimeout       string
	timeout             string
	waitForActiveShards string
	bodyJson            interface{}
	bodyString          string
}

// NewIndicesShrinkService creates a new IndicesShrinkService.
func NewIndicesShrinkService(client *Client) *IndicesShrinkService {
	return &IndicesShrinkService{
		client: client,
	}
}

// Source is the name of the source index to shrink.
func (s *IndicesShrinkService) Source(source string) *IndicesShrinkService {
	s.source = source
	return s
}

// Target is the name of the target index to shrink into.
func (s *IndicesShrinkService) Target(target string) *IndicesShrinkService {
	s.target = target
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *IndicesShrinkService) MasterTimeout(masterTimeout string) *IndicesShrinkService {
	s.masterTimeout = masterTimeout
	return s
}

// Timeout is an explicit operation timeout.
func (s *IndicesShrinkService) Timeout(timeout string) *IndicesShrinkService {
	s.timeout = timeout
	return s
}

// WaitForActiveShards sets the number of active shards to wait for on
// the shrunken index before the operation returns.
func (s *IndicesShrinkService) WaitForActiveShards(waitForActiveShards string) *IndicesShrinkService {
	s.waitForActiveShards = waitForActiveShards
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesShrinkService) Pretty(pretty bool) *IndicesShrinkService {
	s.pretty = pretty
	return s
}

// BodyJson is the configuration for the target index (`settings` and `aliases`)
// defined as a JSON-serializable instance to be sent as the request body.
func (s *IndicesShrinkService) BodyJson(body interface{}) *IndicesShrinkService {
	s.bodyJson = body
	return s
}

// BodyString is the configuration for the target index (`settings` and `aliases`)
// defined as a string to send as the request body.
func (s *IndicesShrinkService) BodyString(body string) *IndicesShrinkService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesShrinkService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/{source}/_shrink/{target}", map[string]string{
		"source": s.source,
		"target": s.target,
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
	if s.waitForActiveShards != "" {
		params.Set("wait_for_active_shards", s.waitForActiveShards)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesShrinkService) Validate() error {
	var invalid []string
	if s.source == "" {
		invalid = append(invalid, "Source")
	}
	if s.target == "" {
		invalid = append(invalid, "Target")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *IndicesShrinkService) Do(ctx context.Context) (*IndicesShrinkResponse, error) {
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
	} else if s.bodyString != "" {
		body = s.bodyString
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, "POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(IndicesShrinkResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IndicesShrinkResponse is the response of IndicesShrinkService.Do.
type IndicesShrinkResponse struct {
	Acknowledged       bool `json:"acknowledged"`
	ShardsAcknowledged bool `json:"shards_acknowledged"`
}
