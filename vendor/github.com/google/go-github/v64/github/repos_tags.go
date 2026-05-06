// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// TagProtection represents a repository tag protection.
type TagProtection struct {
	ID      *int64  `json:"id"`
	Pattern *string `json:"pattern"`
}

// tagProtectionRequest represents a request to create tag protection.
type tagProtectionRequest struct {
	// An optional glob pattern to match against when enforcing tag protection.
	Pattern string `json:"pattern"`
}

// ListTagProtection lists tag protection of the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/tags#list-tag-protection-states-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/tags/protection
func (s *RepositoriesService) ListTagProtection(ctx context.Context, owner, repo string) ([]*TagProtection, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/tags/protection", owner, repo)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var tagProtections []*TagProtection
	resp, err := s.client.Do(ctx, req, &tagProtections)
	if err != nil {
		return nil, resp, err
	}

	return tagProtections, resp, nil
}

// CreateTagProtection creates the tag protection of the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/tags#create-a-tag-protection-state-for-a-repository
//
//meta:operation POST /repos/{owner}/{repo}/tags/protection
func (s *RepositoriesService) CreateTagProtection(ctx context.Context, owner, repo, pattern string) (*TagProtection, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/tags/protection", owner, repo)
	r := &tagProtectionRequest{Pattern: pattern}
	req, err := s.client.NewRequest("POST", u, r)
	if err != nil {
		return nil, nil, err
	}

	tagProtection := new(TagProtection)
	resp, err := s.client.Do(ctx, req, tagProtection)
	if err != nil {
		return nil, resp, err
	}

	return tagProtection, resp, nil
}

// DeleteTagProtection deletes a tag protection from the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/tags#delete-a-tag-protection-state-for-a-repository
//
//meta:operation DELETE /repos/{owner}/{repo}/tags/protection/{tag_protection_id}
func (s *RepositoriesService) DeleteTagProtection(ctx context.Context, owner, repo string, tagProtectionID int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/tags/protection/%v", owner, repo, tagProtectionID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
