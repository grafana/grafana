// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// AutolinkOptions specifies parameters for RepositoriesService.AddAutolink method.
type AutolinkOptions struct {
	KeyPrefix      *string `json:"key_prefix,omitempty"`
	URLTemplate    *string `json:"url_template,omitempty"`
	IsAlphanumeric *bool   `json:"is_alphanumeric,omitempty"`
}

// Autolink represents autolinks to external resources like JIRA issues and Zendesk tickets.
type Autolink struct {
	ID             *int64  `json:"id,omitempty"`
	KeyPrefix      *string `json:"key_prefix,omitempty"`
	URLTemplate    *string `json:"url_template,omitempty"`
	IsAlphanumeric *bool   `json:"is_alphanumeric,omitempty"`
}

// ListAutolinks returns a list of autolinks configured for the given repository.
// Information about autolinks are only available to repository administrators.
//
// GitHub API docs: https://docs.github.com/rest/repos/autolinks#get-all-autolinks-of-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/autolinks
func (s *RepositoriesService) ListAutolinks(ctx context.Context, owner, repo string, opts *ListOptions) ([]*Autolink, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/autolinks", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var autolinks []*Autolink
	resp, err := s.client.Do(ctx, req, &autolinks)
	if err != nil {
		return nil, resp, err
	}

	return autolinks, resp, nil
}

// AddAutolink creates an autolink reference for a repository.
// Users with admin access to the repository can create an autolink.
//
// GitHub API docs: https://docs.github.com/rest/repos/autolinks#create-an-autolink-reference-for-a-repository
//
//meta:operation POST /repos/{owner}/{repo}/autolinks
func (s *RepositoriesService) AddAutolink(ctx context.Context, owner, repo string, opts *AutolinkOptions) (*Autolink, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/autolinks", owner, repo)
	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	al := new(Autolink)
	resp, err := s.client.Do(ctx, req, al)
	if err != nil {
		return nil, resp, err
	}
	return al, resp, nil
}

// GetAutolink returns a single autolink reference by ID that was configured for the given repository.
// Information about autolinks are only available to repository administrators.
//
// GitHub API docs: https://docs.github.com/rest/repos/autolinks#get-an-autolink-reference-of-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/autolinks/{autolink_id}
func (s *RepositoriesService) GetAutolink(ctx context.Context, owner, repo string, id int64) (*Autolink, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/autolinks/%v", owner, repo, id)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var autolink *Autolink
	resp, err := s.client.Do(ctx, req, &autolink)
	if err != nil {
		return nil, resp, err
	}

	return autolink, resp, nil
}

// DeleteAutolink deletes a single autolink reference by ID that was configured for the given repository.
// Information about autolinks are only available to repository administrators.
//
// GitHub API docs: https://docs.github.com/rest/repos/autolinks#delete-an-autolink-reference-from-a-repository
//
//meta:operation DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}
func (s *RepositoriesService) DeleteAutolink(ctx context.Context, owner, repo string, id int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/autolinks/%v", owner, repo, id)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}
	return s.client.Do(ctx, req, nil)
}
