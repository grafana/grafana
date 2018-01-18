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

// IndicesPutTemplateService creates or updates index mappings.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/1.4/indices-templates.html.
type IndicesPutTemplateService struct {
	client        *Client
	pretty        bool
	name          string
	order         interface{}
	create        *bool
	timeout       string
	masterTimeout string
	flatSettings  *bool
	bodyJson      interface{}
	bodyString    string
}

// NewIndicesPutTemplateService creates a new IndicesPutTemplateService.
func NewIndicesPutTemplateService(client *Client) *IndicesPutTemplateService {
	return &IndicesPutTemplateService{
		client: client,
	}
}

// Name is the name of the index template.
func (s *IndicesPutTemplateService) Name(name string) *IndicesPutTemplateService {
	s.name = name
	return s
}

// Timeout is an explicit operation timeout.
func (s *IndicesPutTemplateService) Timeout(timeout string) *IndicesPutTemplateService {
	s.timeout = timeout
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *IndicesPutTemplateService) MasterTimeout(masterTimeout string) *IndicesPutTemplateService {
	s.masterTimeout = masterTimeout
	return s
}

// FlatSettings indicates whether to return settings in flat format (default: false).
func (s *IndicesPutTemplateService) FlatSettings(flatSettings bool) *IndicesPutTemplateService {
	s.flatSettings = &flatSettings
	return s
}

// Order is the order for this template when merging multiple matching ones
// (higher numbers are merged later, overriding the lower numbers).
func (s *IndicesPutTemplateService) Order(order interface{}) *IndicesPutTemplateService {
	s.order = order
	return s
}

// Create indicates whether the index template should only be added if
// new or can also replace an existing one.
func (s *IndicesPutTemplateService) Create(create bool) *IndicesPutTemplateService {
	s.create = &create
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesPutTemplateService) Pretty(pretty bool) *IndicesPutTemplateService {
	s.pretty = pretty
	return s
}

// BodyJson is documented as: The template definition.
func (s *IndicesPutTemplateService) BodyJson(body interface{}) *IndicesPutTemplateService {
	s.bodyJson = body
	return s
}

// BodyString is documented as: The template definition.
func (s *IndicesPutTemplateService) BodyString(body string) *IndicesPutTemplateService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesPutTemplateService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_template/{name}", map[string]string{
		"name": s.name,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.order != nil {
		params.Set("order", fmt.Sprintf("%v", s.order))
	}
	if s.create != nil {
		params.Set("create", fmt.Sprintf("%v", *s.create))
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	if s.flatSettings != nil {
		params.Set("flat_settings", fmt.Sprintf("%v", *s.flatSettings))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesPutTemplateService) Validate() error {
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
func (s *IndicesPutTemplateService) Do() (*IndicesPutTemplateResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *IndicesPutTemplateService) DoC(ctx context.Context) (*IndicesPutTemplateResponse, error) {
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
	ret := new(IndicesPutTemplateResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IndicesPutTemplateResponse is the response of IndicesPutTemplateService.Do.
type IndicesPutTemplateResponse struct {
	Acknowledged bool `json:"acknowledged,omitempty"`
}
