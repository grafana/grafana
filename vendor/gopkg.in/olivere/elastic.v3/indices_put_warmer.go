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

// IndicesPutWarmerService allows to register a warmer.
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-warmers.html.
type IndicesPutWarmerService struct {
	client            *Client
	pretty            bool
	typ               []string
	index             []string
	name              string
	masterTimeout     string
	ignoreUnavailable *bool
	allowNoIndices    *bool
	requestCache      *bool
	expandWildcards   string
	bodyJson          map[string]interface{}
	bodyString        string
}

// NewIndicesPutWarmerService creates a new IndicesPutWarmerService.
func NewIndicesPutWarmerService(client *Client) *IndicesPutWarmerService {
	return &IndicesPutWarmerService{
		client: client,
		index:  make([]string, 0),
		typ:    make([]string, 0),
	}
}

// Index is a list of index names the mapping should be added to
// (supports wildcards); use `_all` or omit to add the mapping on all indices.
func (s *IndicesPutWarmerService) Index(indices ...string) *IndicesPutWarmerService {
	s.index = append(s.index, indices...)
	return s
}

// Type is a list of type names the mapping should be added to
// (supports wildcards); use `_all` or omit to add the mapping on all types.
func (s *IndicesPutWarmerService) Type(typ ...string) *IndicesPutWarmerService {
	s.typ = append(s.typ, typ...)
	return s
}

// Name specifies the name of the warmer (supports wildcards);
// leave empty to get all warmers
func (s *IndicesPutWarmerService) Name(name string) *IndicesPutWarmerService {
	s.name = name
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *IndicesPutWarmerService) MasterTimeout(masterTimeout string) *IndicesPutWarmerService {
	s.masterTimeout = masterTimeout
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should be
// ignored when unavailable (missing or closed).
func (s *IndicesPutWarmerService) IgnoreUnavailable(ignoreUnavailable bool) *IndicesPutWarmerService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices.
// This includes `_all` string or when no indices have been specified.
func (s *IndicesPutWarmerService) AllowNoIndices(allowNoIndices bool) *IndicesPutWarmerService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// RequestCache specifies whether the request to be warmed should use the request cache,
// defaults to index level setting
func (s *IndicesPutWarmerService) RequestCache(requestCache bool) *IndicesPutWarmerService {
	s.requestCache = &requestCache
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both.
func (s *IndicesPutWarmerService) ExpandWildcards(expandWildcards string) *IndicesPutWarmerService {
	s.expandWildcards = expandWildcards
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesPutWarmerService) Pretty(pretty bool) *IndicesPutWarmerService {
	s.pretty = pretty
	return s
}

// BodyJson contains the mapping definition.
func (s *IndicesPutWarmerService) BodyJson(mapping map[string]interface{}) *IndicesPutWarmerService {
	s.bodyJson = mapping
	return s
}

// BodyString is the mapping definition serialized as a string.
func (s *IndicesPutWarmerService) BodyString(mapping string) *IndicesPutWarmerService {
	s.bodyString = mapping
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesPutWarmerService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	if len(s.index) == 0 && len(s.typ) == 0 {
		path, err = uritemplates.Expand("/_warmer/{name}", map[string]string{
			"name": s.name,
		})
	} else if len(s.index) == 0 && len(s.typ) > 0 {
		path, err = uritemplates.Expand("/_all/{type}/_warmer/{name}", map[string]string{
			"type": strings.Join(s.typ, ","),
			"name": s.name,
		})
	} else if len(s.index) > 0 && len(s.typ) == 0 {
		path, err = uritemplates.Expand("/{index}/_warmer/{name}", map[string]string{
			"index": strings.Join(s.index, ","),
			"name":  s.name,
		})
	} else {
		path, err = uritemplates.Expand("/{index}/{type}/_warmer/{name}", map[string]string{
			"index": strings.Join(s.index, ","),
			"type":  strings.Join(s.typ, ","),
			"name":  s.name,
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
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.requestCache != nil {
		params.Set("request_cache", fmt.Sprintf("%v", *s.requestCache))
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesPutWarmerService) Validate() error {
	var invalid []string
	if s.name == "" {
		invalid = append(invalid, "Name")
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
func (s *IndicesPutWarmerService) Do() (*PutWarmerResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *IndicesPutWarmerService) DoC(ctx context.Context) (*PutWarmerResponse, error) {
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
	res, err := s.client.PerformRequestC(ctx, "PUT", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(PutWarmerResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// PutWarmerResponse is the response of IndicesPutWarmerService.Do.
type PutWarmerResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
