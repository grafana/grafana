// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"

	"net/http"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// DeleteService allows to delete a typed JSON document from a specified
// index based on its id.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/docs-delete.html
// for details.
type DeleteService struct {
	client              *Client
	pretty              bool
	id                  string
	index               string
	typ                 string
	routing             string
	timeout             string
	version             interface{}
	versionType         string
	waitForActiveShards string
	parent              string
	refresh             string
}

// NewDeleteService creates a new DeleteService.
func NewDeleteService(client *Client) *DeleteService {
	return &DeleteService{
		client: client,
	}
}

// Type is the type of the document.
func (s *DeleteService) Type(typ string) *DeleteService {
	s.typ = typ
	return s
}

// Id is the document ID.
func (s *DeleteService) Id(id string) *DeleteService {
	s.id = id
	return s
}

// Index is the name of the index.
func (s *DeleteService) Index(index string) *DeleteService {
	s.index = index
	return s
}

// Routing is a specific routing value.
func (s *DeleteService) Routing(routing string) *DeleteService {
	s.routing = routing
	return s
}

// Timeout is an explicit operation timeout.
func (s *DeleteService) Timeout(timeout string) *DeleteService {
	s.timeout = timeout
	return s
}

// Version is an explicit version number for concurrency control.
func (s *DeleteService) Version(version interface{}) *DeleteService {
	s.version = version
	return s
}

// VersionType is a specific version type.
func (s *DeleteService) VersionType(versionType string) *DeleteService {
	s.versionType = versionType
	return s
}

// WaitForActiveShards sets the number of shard copies that must be active
// before proceeding with the delete operation. Defaults to 1, meaning the
// primary shard only. Set to `all` for all shard copies, otherwise set to
// any non-negative value less than or equal to the total number of copies
// for the shard (number of replicas + 1).
func (s *DeleteService) WaitForActiveShards(waitForActiveShards string) *DeleteService {
	s.waitForActiveShards = waitForActiveShards
	return s
}

// Parent is the ID of parent document.
func (s *DeleteService) Parent(parent string) *DeleteService {
	s.parent = parent
	return s
}

// Refresh the index after performing the operation.
func (s *DeleteService) Refresh(refresh string) *DeleteService {
	s.refresh = refresh
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *DeleteService) Pretty(pretty bool) *DeleteService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *DeleteService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/{index}/{type}/{id}", map[string]string{
		"index": s.index,
		"type":  s.typ,
		"id":    s.id,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.refresh != "" {
		params.Set("refresh", s.refresh)
	}
	if s.routing != "" {
		params.Set("routing", s.routing)
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.version != nil {
		params.Set("version", fmt.Sprintf("%v", s.version))
	}
	if s.versionType != "" {
		params.Set("version_type", s.versionType)
	}
	if s.waitForActiveShards != "" {
		params.Set("wait_for_active_shards", s.waitForActiveShards)
	}
	if s.parent != "" {
		params.Set("parent", s.parent)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *DeleteService) Validate() error {
	var invalid []string
	if s.typ == "" {
		invalid = append(invalid, "Type")
	}
	if s.id == "" {
		invalid = append(invalid, "Id")
	}
	if s.index == "" {
		invalid = append(invalid, "Index")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation. If the document is not found (404), Elasticsearch will
// still return a response. This response is serialized and returned as well. In other
// words, for HTTP status code 404, both an error and a response might be returned.
func (s *DeleteService) Do(ctx context.Context) (*DeleteResponse, error) {
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
	res, err := s.client.PerformRequest(ctx, "DELETE", path, params, nil, http.StatusNotFound)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(DeleteResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}

	// If we have a 404, we return both a result and an error, just like ES does
	if res.StatusCode == http.StatusNotFound {
		return ret, &Error{Status: http.StatusNotFound}
	}

	return ret, nil
}

// -- Result of a delete request.

// DeleteResponse is the outcome of running DeleteService.Do.
type DeleteResponse struct {
	Index         string      `json:"_index"`
	Type          string      `json:"_type"`
	Id            string      `json:"_id"`
	Version       int64       `json:"_version"`
	Shards        *shardsInfo `json:"_shards"`
	Result        string      `json:"result,omitempty"`
	ForcedRefresh bool        `json:"forced_refresh,omitempty"`
	Found         bool        `json:"found"`
}
