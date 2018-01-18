// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"
	"strings"

	"golang.org/x/net/context"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

// PercolateService is documented at http://www.elasticsearch.org/guide/en/elasticsearch/reference/1.4/search-percolate.html.
type PercolateService struct {
	client              *Client
	pretty              bool
	index               string
	typ                 string
	id                  string
	version             interface{}
	versionType         string
	routing             []string
	preference          string
	ignoreUnavailable   *bool
	percolateIndex      string
	percolatePreference string
	percolateRouting    string
	source              string
	allowNoIndices      *bool
	expandWildcards     string
	percolateFormat     string
	percolateType       string
	bodyJson            interface{}
	bodyString          string
}

// NewPercolateService creates a new PercolateService.
func NewPercolateService(client *Client) *PercolateService {
	return &PercolateService{
		client:  client,
		routing: make([]string, 0),
	}
}

// Index is the name of the index of the document being percolated.
func (s *PercolateService) Index(index string) *PercolateService {
	s.index = index
	return s
}

// Type is the type of the document being percolated.
func (s *PercolateService) Type(typ string) *PercolateService {
	s.typ = typ
	return s
}

// Id is to substitute the document in the request body with a
// document that is known by the specified id. On top of the id,
// the index and type parameter will be used to retrieve
// the document from within the cluster.
func (s *PercolateService) Id(id string) *PercolateService {
	s.id = id
	return s
}

// ExpandWildcards indicates whether to expand wildcard expressions
// to concrete indices that are open, closed or both.
func (s *PercolateService) ExpandWildcards(expandWildcards string) *PercolateService {
	s.expandWildcards = expandWildcards
	return s
}

// PercolateFormat indicates whether to return an array of matching
// query IDs instead of objects.
func (s *PercolateService) PercolateFormat(percolateFormat string) *PercolateService {
	s.percolateFormat = percolateFormat
	return s
}

// PercolateType is the type to percolate document into. Defaults to type.
func (s *PercolateService) PercolateType(percolateType string) *PercolateService {
	s.percolateType = percolateType
	return s
}

// PercolateRouting is the routing value to use when percolating
// the existing document.
func (s *PercolateService) PercolateRouting(percolateRouting string) *PercolateService {
	s.percolateRouting = percolateRouting
	return s
}

// Source is the URL-encoded request definition.
func (s *PercolateService) Source(source string) *PercolateService {
	s.source = source
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices.
// (This includes `_all` string or when no indices have been specified).
func (s *PercolateService) AllowNoIndices(allowNoIndices bool) *PercolateService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should
// be ignored when unavailable (missing or closed).
func (s *PercolateService) IgnoreUnavailable(ignoreUnavailable bool) *PercolateService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// PercolateIndex is the index to percolate the document into. Defaults to index.
func (s *PercolateService) PercolateIndex(percolateIndex string) *PercolateService {
	s.percolateIndex = percolateIndex
	return s
}

// PercolatePreference defines which shard to prefer when executing
// the percolate request.
func (s *PercolateService) PercolatePreference(percolatePreference string) *PercolateService {
	s.percolatePreference = percolatePreference
	return s
}

// Version is an explicit version number for concurrency control.
func (s *PercolateService) Version(version interface{}) *PercolateService {
	s.version = version
	return s
}

// VersionType is the specific version type.
func (s *PercolateService) VersionType(versionType string) *PercolateService {
	s.versionType = versionType
	return s
}

// Routing is a list of specific routing values.
func (s *PercolateService) Routing(routing []string) *PercolateService {
	s.routing = routing
	return s
}

// Preference specifies the node or shard the operation should be
// performed on (default: random).
func (s *PercolateService) Preference(preference string) *PercolateService {
	s.preference = preference
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *PercolateService) Pretty(pretty bool) *PercolateService {
	s.pretty = pretty
	return s
}

// Doc wraps the given document into the "doc" key of the body.
func (s *PercolateService) Doc(doc interface{}) *PercolateService {
	return s.BodyJson(map[string]interface{}{"doc": doc})
}

// BodyJson is the percolator request definition using the percolate DSL.
func (s *PercolateService) BodyJson(body interface{}) *PercolateService {
	s.bodyJson = body
	return s
}

// BodyString is the percolator request definition using the percolate DSL.
func (s *PercolateService) BodyString(body string) *PercolateService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *PercolateService) buildURL() (string, url.Values, error) {
	// Build URL
	var path string
	var err error
	if s.id == "" {
		path, err = uritemplates.Expand("/{index}/{type}/_percolate", map[string]string{
			"index": s.index,
			"type":  s.typ,
		})
	} else {
		path, err = uritemplates.Expand("/{index}/{type}/{id}/_percolate", map[string]string{
			"index": s.index,
			"type":  s.typ,
			"id":    s.id,
		})
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.version != nil {
		params.Set("version", fmt.Sprintf("%v", s.version))
	}
	if s.versionType != "" {
		params.Set("version_type", s.versionType)
	}
	if len(s.routing) > 0 {
		params.Set("routing", strings.Join(s.routing, ","))
	}
	if s.preference != "" {
		params.Set("preference", s.preference)
	}
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.percolateIndex != "" {
		params.Set("percolate_index", s.percolateIndex)
	}
	if s.percolatePreference != "" {
		params.Set("percolate_preference", s.percolatePreference)
	}
	if s.percolateRouting != "" {
		params.Set("percolate_routing", s.percolateRouting)
	}
	if s.source != "" {
		params.Set("source", s.source)
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if s.percolateFormat != "" {
		params.Set("percolate_format", s.percolateFormat)
	}
	if s.percolateType != "" {
		params.Set("percolate_type", s.percolateType)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *PercolateService) Validate() error {
	var invalid []string
	if s.index == "" {
		invalid = append(invalid, "Index")
	}
	if s.typ == "" {
		invalid = append(invalid, "Type")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *PercolateService) Do() (*PercolateResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *PercolateService) DoC(ctx context.Context) (*PercolateResponse, error) {
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
	res, err := s.client.PerformRequestC(ctx, "GET", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(PercolateResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// PercolateResponse is the response of PercolateService.Do.
type PercolateResponse struct {
	TookInMillis int64             `json:"took"`  // search time in milliseconds
	Total        int64             `json:"total"` // total matches
	Matches      []*PercolateMatch `json:"matches,omitempty"`
	Aggregations Aggregations      `json:"aggregations,omitempty"` // results from aggregations
}

// PercolateMatch returns a single match in a PercolateResponse.
type PercolateMatch struct {
	Index string  `json:"_index,omitempty"`
	Id    string  `json:"_id"`
	Score float64 `json:"_score,omitempty"`
}
