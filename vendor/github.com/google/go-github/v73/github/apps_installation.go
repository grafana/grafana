// Copyright 2016 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
	"strings"
)

// ListRepositories represents the response from the list repos endpoints.
type ListRepositories struct {
	TotalCount   *int          `json:"total_count,omitempty"`
	Repositories []*Repository `json:"repositories"`
}

// ListRepos lists the repositories that are accessible to the authenticated installation.
//
// GitHub API docs: https://docs.github.com/rest/apps/installations#list-repositories-accessible-to-the-app-installation
//
//meta:operation GET /installation/repositories
func (s *AppsService) ListRepos(ctx context.Context, opts *ListOptions) (*ListRepositories, *Response, error) {
	u, err := addOptions("installation/repositories", opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	acceptHeaders := []string{
		mediaTypeTopicsPreview,
		mediaTypeRepositoryVisibilityPreview,
		mediaTypeRepositoryTemplatePreview,
	}
	req.Header.Set("Accept", strings.Join(acceptHeaders, ", "))

	var r *ListRepositories

	resp, err := s.client.Do(ctx, req, &r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// ListUserRepos lists repositories that are accessible
// to the authenticated user for an installation.
//
// GitHub API docs: https://docs.github.com/rest/apps/installations#list-repositories-accessible-to-the-user-access-token
//
//meta:operation GET /user/installations/{installation_id}/repositories
func (s *AppsService) ListUserRepos(ctx context.Context, id int64, opts *ListOptions) (*ListRepositories, *Response, error) {
	u := fmt.Sprintf("user/installations/%v/repositories", id)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	acceptHeaders := []string{
		mediaTypeTopicsPreview,
		mediaTypeRepositoryVisibilityPreview,
		mediaTypeRepositoryTemplatePreview,
	}
	req.Header.Set("Accept", strings.Join(acceptHeaders, ", "))

	var r *ListRepositories
	resp, err := s.client.Do(ctx, req, &r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// AddRepository adds a single repository to an installation.
//
// GitHub API docs: https://docs.github.com/rest/apps/installations#add-a-repository-to-an-app-installation
//
//meta:operation PUT /user/installations/{installation_id}/repositories/{repository_id}
func (s *AppsService) AddRepository(ctx context.Context, instID, repoID int64) (*Repository, *Response, error) {
	u := fmt.Sprintf("user/installations/%v/repositories/%v", instID, repoID)
	req, err := s.client.NewRequest("PUT", u, nil)
	if err != nil {
		return nil, nil, err
	}

	r := new(Repository)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// RemoveRepository removes a single repository from an installation.
//
// GitHub API docs: https://docs.github.com/rest/apps/installations#remove-a-repository-from-an-app-installation
//
//meta:operation DELETE /user/installations/{installation_id}/repositories/{repository_id}
func (s *AppsService) RemoveRepository(ctx context.Context, instID, repoID int64) (*Response, error) {
	u := fmt.Sprintf("user/installations/%v/repositories/%v", instID, repoID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RevokeInstallationToken revokes an installation token.
//
// GitHub API docs: https://docs.github.com/rest/apps/installations#revoke-an-installation-access-token
//
//meta:operation DELETE /installation/token
func (s *AppsService) RevokeInstallationToken(ctx context.Context) (*Response, error) {
	u := "installation/token"
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
