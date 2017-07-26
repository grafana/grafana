// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// RefreshService explicitly refreshes one or more indices.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/indices-refresh.html.
type RefreshService struct {
	client *Client
	index  []string
	force  *bool
	pretty bool
}

// NewRefreshService creates a new instance of RefreshService.
func NewRefreshService(client *Client) *RefreshService {
	builder := &RefreshService{
		client: client,
	}
	return builder
}

// Index specifies the indices to refresh.
func (s *RefreshService) Index(index ...string) *RefreshService {
	s.index = append(s.index, index...)
	return s
}

// Force forces a refresh.
func (s *RefreshService) Force(force bool) *RefreshService {
	s.force = &force
	return s
}

// Pretty asks Elasticsearch to return indented JSON.
func (s *RefreshService) Pretty(pretty bool) *RefreshService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *RefreshService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	if len(s.index) > 0 {
		path, err = uritemplates.Expand("/{index}/_refresh", map[string]string{
			"index": strings.Join(s.index, ","),
		})
	} else {
		path = "/_refresh"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.force != nil {
		params.Set("force", fmt.Sprintf("%v", *s.force))
	}
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	return path, params, nil
}

// Do executes the request.
func (s *RefreshService) Do(ctx context.Context) (*RefreshResult, error) {
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get response
	res, err := s.client.PerformRequest(ctx, "POST", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(RefreshResult)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a refresh request.

// RefreshResult is the outcome of RefreshService.Do.
type RefreshResult struct {
	Shards shardsInfo `json:"_shards,omitempty"`
}
