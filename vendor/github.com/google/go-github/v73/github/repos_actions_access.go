// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// RepositoryActionsAccessLevel represents the repository actions access level.
//
// GitHub API docs: https://docs.github.com/rest/actions/permissions#set-the-level-of-access-for-workflows-outside-of-the-repository
type RepositoryActionsAccessLevel struct {
	// AccessLevel specifies the level of access that workflows outside of the repository have
	// to actions and reusable workflows within the repository.
	// Possible values are: "none", "organization" "enterprise".
	AccessLevel *string `json:"access_level,omitempty"`
}

// GetActionsAccessLevel gets the level of access that workflows outside of the repository have
// to actions and reusable workflows in the repository.
//
// GitHub API docs: https://docs.github.com/rest/actions/permissions#get-the-level-of-access-for-workflows-outside-of-the-repository
//
//meta:operation GET /repos/{owner}/{repo}/actions/permissions/access
func (s *RepositoriesService) GetActionsAccessLevel(ctx context.Context, owner, repo string) (*RepositoryActionsAccessLevel, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/permissions/access", owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	raal := new(RepositoryActionsAccessLevel)
	resp, err := s.client.Do(ctx, req, raal)
	if err != nil {
		return nil, resp, err
	}

	return raal, resp, nil
}

// EditActionsAccessLevel sets the level of access that workflows outside of the repository have
// to actions and reusable workflows in the repository.
//
// GitHub API docs: https://docs.github.com/rest/actions/permissions#set-the-level-of-access-for-workflows-outside-of-the-repository
//
//meta:operation PUT /repos/{owner}/{repo}/actions/permissions/access
func (s *RepositoriesService) EditActionsAccessLevel(ctx context.Context, owner, repo string, repositoryActionsAccessLevel RepositoryActionsAccessLevel) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/permissions/access", owner, repo)
	req, err := s.client.NewRequest("PUT", u, repositoryActionsAccessLevel)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
