// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// CodesOfConductService provides access to code-of-conduct-related functions in the GitHub API.
type CodesOfConductService service

// CodeOfConduct represents a code of conduct.
type CodeOfConduct struct {
	Name *string `json:"name,omitempty"`
	Key  *string `json:"key,omitempty"`
	URL  *string `json:"url,omitempty"`
	Body *string `json:"body,omitempty"`
}

func (c *CodeOfConduct) String() string {
	return Stringify(c)
}

// List returns all codes of conduct.
//
// GitHub API docs: https://docs.github.com/rest/codes-of-conduct/codes-of-conduct#get-all-codes-of-conduct
//
//meta:operation GET /codes_of_conduct
func (s *CodesOfConductService) List(ctx context.Context) ([]*CodeOfConduct, *Response, error) {
	req, err := s.client.NewRequest("GET", "codes_of_conduct", nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeCodesOfConductPreview)

	var cs []*CodeOfConduct
	resp, err := s.client.Do(ctx, req, &cs)
	if err != nil {
		return nil, resp, err
	}

	return cs, resp, nil
}

// ListCodesOfConduct returns all codes of conduct.
//
// Deprecated: Use CodesOfConductService.List instead
func (c *Client) ListCodesOfConduct(ctx context.Context) ([]*CodeOfConduct, *Response, error) {
	return c.CodesOfConduct.List(ctx)
}

// Get returns an individual code of conduct.
//
// GitHub API docs: https://docs.github.com/rest/codes-of-conduct/codes-of-conduct#get-a-code-of-conduct
//
//meta:operation GET /codes_of_conduct/{key}
func (s *CodesOfConductService) Get(ctx context.Context, key string) (*CodeOfConduct, *Response, error) {
	u := fmt.Sprintf("codes_of_conduct/%s", key)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeCodesOfConductPreview)

	coc := new(CodeOfConduct)
	resp, err := s.client.Do(ctx, req, coc)
	if err != nil {
		return nil, resp, err
	}

	return coc, resp, nil
}

// GetCodeOfConduct returns an individual code of conduct.
//
// Deprecated: Use CodesOfConductService.Get instead
func (c *Client) GetCodeOfConduct(ctx context.Context, key string) (*CodeOfConduct, *Response, error) {
	return c.CodesOfConduct.Get(ctx, key)
}
