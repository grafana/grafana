// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"

	"golang.org/x/net/context"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

// DeleteService allows to delete a typed JSON document from a specified
// index based on its id.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-delete.html
// for details.
type DeleteService struct {
	client      *Client
	pretty      bool
	id          string
	index       string
	typ         string
	routing     string
	timeout     string
	version     interface{}
	versionType string
	consistency string
	parent      string
	refresh     *bool
	replication string
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

// Replication specifies a replication type.
func (s *DeleteService) Replication(replication string) *DeleteService {
	s.replication = replication
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

// Consistency defines a specific write consistency setting for the operation.
func (s *DeleteService) Consistency(consistency string) *DeleteService {
	s.consistency = consistency
	return s
}

// Parent is the ID of parent document.
func (s *DeleteService) Parent(parent string) *DeleteService {
	s.parent = parent
	return s
}

// Refresh the index after performing the operation.
func (s *DeleteService) Refresh(refresh bool) *DeleteService {
	s.refresh = &refresh
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
	if s.refresh != nil {
		params.Set("refresh", fmt.Sprintf("%v", *s.refresh))
	}
	if s.replication != "" {
		params.Set("replication", s.replication)
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
	if s.consistency != "" {
		params.Set("consistency", s.consistency)
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

// Do executes the operation.
func (s *DeleteService) Do() (*DeleteResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *DeleteService) DoC(ctx context.Context) (*DeleteResponse, error) {
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
	res, err := s.client.PerformRequestC(ctx, "DELETE", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(DeleteResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a delete request.

// DeleteResponse is the outcome of running DeleteService.Do.
type DeleteResponse struct {
	// TODO _shards { total, failed, successful }
	Found   bool   `json:"found"`
	Index   string `json:"_index"`
	Type    string `json:"_type"`
	Id      string `json:"_id"`
	Version int64  `json:"_version"`
}
