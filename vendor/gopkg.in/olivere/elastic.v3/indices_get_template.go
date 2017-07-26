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

// IndicesGetTemplateService returns an index template.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/1.4/indices-templates.html.
type IndicesGetTemplateService struct {
	client       *Client
	pretty       bool
	name         []string
	flatSettings *bool
	local        *bool
}

// NewIndicesGetTemplateService creates a new IndicesGetTemplateService.
func NewIndicesGetTemplateService(client *Client) *IndicesGetTemplateService {
	return &IndicesGetTemplateService{
		client: client,
		name:   make([]string, 0),
	}
}

// Name is the name of the index template.
func (s *IndicesGetTemplateService) Name(name ...string) *IndicesGetTemplateService {
	s.name = append(s.name, name...)
	return s
}

// FlatSettings is returns settings in flat format (default: false).
func (s *IndicesGetTemplateService) FlatSettings(flatSettings bool) *IndicesGetTemplateService {
	s.flatSettings = &flatSettings
	return s
}

// Local indicates whether to return local information, i.e. do not retrieve
// the state from master node (default: false).
func (s *IndicesGetTemplateService) Local(local bool) *IndicesGetTemplateService {
	s.local = &local
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesGetTemplateService) Pretty(pretty bool) *IndicesGetTemplateService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesGetTemplateService) buildURL() (string, url.Values, error) {
	// Build URL
	var err error
	var path string
	if len(s.name) > 0 {
		path, err = uritemplates.Expand("/_template/{name}", map[string]string{
			"name": strings.Join(s.name, ","),
		})
	} else {
		path = "/_template"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.flatSettings != nil {
		params.Set("flat_settings", fmt.Sprintf("%v", *s.flatSettings))
	}
	if s.local != nil {
		params.Set("local", fmt.Sprintf("%v", *s.local))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesGetTemplateService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *IndicesGetTemplateService) Do() (map[string]*IndicesGetTemplateResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *IndicesGetTemplateService) DoC(ctx context.Context) (map[string]*IndicesGetTemplateResponse, error) {
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
	res, err := s.client.PerformRequestC(ctx, "GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	var ret map[string]*IndicesGetTemplateResponse
	if err := s.client.decoder.Decode(res.Body, &ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IndicesGetTemplateResponse is the response of IndicesGetTemplateService.Do.
type IndicesGetTemplateResponse struct {
	Order    int                    `json:"order,omitempty"`
	Template string                 `json:"template,omitempty"`
	Settings map[string]interface{} `json:"settings,omitempty"`
	Mappings map[string]interface{} `json:"mappings,omitempty"`
	Aliases  map[string]interface{} `json:"aliases,omitempty"`
}
