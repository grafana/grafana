// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// PutTemplateService creates or updates a search template.
// The documentation can be found at
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-template.html.
type PutTemplateService struct {
	client      *Client
	pretty      bool
	id          string
	opType      string
	version     *int
	versionType string
	bodyJson    interface{}
	bodyString  string
}

// NewPutTemplateService creates a new PutTemplateService.
func NewPutTemplateService(client *Client) *PutTemplateService {
	return &PutTemplateService{
		client: client,
	}
}

// Id is the template ID.
func (s *PutTemplateService) Id(id string) *PutTemplateService {
	s.id = id
	return s
}

// OpType is an explicit operation type.
func (s *PutTemplateService) OpType(opType string) *PutTemplateService {
	s.opType = opType
	return s
}

// Version is an explicit version number for concurrency control.
func (s *PutTemplateService) Version(version int) *PutTemplateService {
	s.version = &version
	return s
}

// VersionType is a specific version type.
func (s *PutTemplateService) VersionType(versionType string) *PutTemplateService {
	s.versionType = versionType
	return s
}

// BodyJson is the document as a JSON serializable object.
func (s *PutTemplateService) BodyJson(body interface{}) *PutTemplateService {
	s.bodyJson = body
	return s
}

// BodyString is the document as a string.
func (s *PutTemplateService) BodyString(body string) *PutTemplateService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *PutTemplateService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_search/template/{id}", map[string]string{
		"id": s.id,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.version != nil {
		params.Set("version", fmt.Sprintf("%d", *s.version))
	}
	if s.versionType != "" {
		params.Set("version_type", s.versionType)
	}
	if s.opType != "" {
		params.Set("op_type", s.opType)
	}

	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *PutTemplateService) Validate() error {
	var invalid []string
	if s.id == "" {
		invalid = append(invalid, "Id")
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
func (s *PutTemplateService) Do(ctx context.Context) (*AcknowledgedResponse, error) {
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
	ret := new(AcknowledgedResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}
