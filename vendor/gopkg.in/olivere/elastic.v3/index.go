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

// IndexService adds or updates a typed JSON document in a specified index,
// making it searchable.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html
// for details.
type IndexService struct {
	client      *Client
	pretty      bool
	id          string
	index       string
	typ         string
	parent      string
	replication string
	routing     string
	timeout     string
	timestamp   string
	ttl         string
	version     interface{}
	opType      string
	versionType string
	refresh     *bool
	consistency string
	bodyJson    interface{}
	bodyString  string
}

// NewIndexService creates a new IndexService.
func NewIndexService(client *Client) *IndexService {
	return &IndexService{
		client: client,
	}
}

// Id is the document ID.
func (s *IndexService) Id(id string) *IndexService {
	s.id = id
	return s
}

// Index is the name of the index.
func (s *IndexService) Index(index string) *IndexService {
	s.index = index
	return s
}

// Type is the type of the document.
func (s *IndexService) Type(typ string) *IndexService {
	s.typ = typ
	return s
}

// Consistency is an explicit write consistency setting for the operation.
func (s *IndexService) Consistency(consistency string) *IndexService {
	s.consistency = consistency
	return s
}

// Refresh the index after performing the operation.
func (s *IndexService) Refresh(refresh bool) *IndexService {
	s.refresh = &refresh
	return s
}

// Ttl is an expiration time for the document.
func (s *IndexService) Ttl(ttl string) *IndexService {
	s.ttl = ttl
	return s
}

// TTL is an expiration time for the document (alias for Ttl).
func (s *IndexService) TTL(ttl string) *IndexService {
	s.ttl = ttl
	return s
}

// Version is an explicit version number for concurrency control.
func (s *IndexService) Version(version interface{}) *IndexService {
	s.version = version
	return s
}

// OpType is an explicit operation type, i.e. "create" or "index" (default).
func (s *IndexService) OpType(opType string) *IndexService {
	s.opType = opType
	return s
}

// Parent is the ID of the parent document.
func (s *IndexService) Parent(parent string) *IndexService {
	s.parent = parent
	return s
}

// Replication is a specific replication type.
func (s *IndexService) Replication(replication string) *IndexService {
	s.replication = replication
	return s
}

// Routing is a specific routing value.
func (s *IndexService) Routing(routing string) *IndexService {
	s.routing = routing
	return s
}

// Timeout is an explicit operation timeout.
func (s *IndexService) Timeout(timeout string) *IndexService {
	s.timeout = timeout
	return s
}

// Timestamp is an explicit timestamp for the document.
func (s *IndexService) Timestamp(timestamp string) *IndexService {
	s.timestamp = timestamp
	return s
}

// VersionType is a specific version type.
func (s *IndexService) VersionType(versionType string) *IndexService {
	s.versionType = versionType
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndexService) Pretty(pretty bool) *IndexService {
	s.pretty = pretty
	return s
}

// BodyJson is the document as a serializable JSON interface.
func (s *IndexService) BodyJson(body interface{}) *IndexService {
	s.bodyJson = body
	return s
}

// BodyString is the document encoded as a string.
func (s *IndexService) BodyString(body string) *IndexService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *IndexService) buildURL() (string, string, url.Values, error) {
	var err error
	var method, path string

	if s.id != "" {
		// Create document with manual id
		method = "PUT"
		path, err = uritemplates.Expand("/{index}/{type}/{id}", map[string]string{
			"id":    s.id,
			"index": s.index,
			"type":  s.typ,
		})
	} else {
		// Automatic ID generation
		// See https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html#index-creation
		method = "POST"
		path, err = uritemplates.Expand("/{index}/{type}/", map[string]string{
			"index": s.index,
			"type":  s.typ,
		})
	}
	if err != nil {
		return "", "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.consistency != "" {
		params.Set("consistency", s.consistency)
	}
	if s.refresh != nil {
		params.Set("refresh", fmt.Sprintf("%v", *s.refresh))
	}
	if s.opType != "" {
		params.Set("op_type", s.opType)
	}
	if s.parent != "" {
		params.Set("parent", s.parent)
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
	if s.timestamp != "" {
		params.Set("timestamp", s.timestamp)
	}
	if s.ttl != "" {
		params.Set("ttl", s.ttl)
	}
	if s.version != nil {
		params.Set("version", fmt.Sprintf("%v", s.version))
	}
	if s.versionType != "" {
		params.Set("version_type", s.versionType)
	}
	return method, path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndexService) Validate() error {
	var invalid []string
	if s.index == "" {
		invalid = append(invalid, "Index")
	}
	if s.typ == "" {
		invalid = append(invalid, "Type")
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
func (s *IndexService) Do() (*IndexResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *IndexService) DoC(ctx context.Context) (*IndexResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	method, path, params, err := s.buildURL()
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
	res, err := s.client.PerformRequestC(ctx, method, path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(IndexResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IndexResponse is the result of indexing a document in Elasticsearch.
type IndexResponse struct {
	// TODO _shards { total, failed, successful }
	Index   string `json:"_index"`
	Type    string `json:"_type"`
	Id      string `json:"_id"`
	Version int    `json:"_version"`
	Created bool   `json:"created"`
}
