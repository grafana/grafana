// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// RunnerGroup represents a self-hosted runner group configured in an organization.
type RunnerGroup struct {
	ID                           *int64   `json:"id,omitempty"`
	Name                         *string  `json:"name,omitempty"`
	Visibility                   *string  `json:"visibility,omitempty"`
	Default                      *bool    `json:"default,omitempty"`
	SelectedRepositoriesURL      *string  `json:"selected_repositories_url,omitempty"`
	RunnersURL                   *string  `json:"runners_url,omitempty"`
	Inherited                    *bool    `json:"inherited,omitempty"`
	AllowsPublicRepositories     *bool    `json:"allows_public_repositories,omitempty"`
	RestrictedToWorkflows        *bool    `json:"restricted_to_workflows,omitempty"`
	SelectedWorkflows            []string `json:"selected_workflows,omitempty"`
	WorkflowRestrictionsReadOnly *bool    `json:"workflow_restrictions_read_only,omitempty"`
}

// RunnerGroups represents a collection of self-hosted runner groups configured for an organization.
type RunnerGroups struct {
	TotalCount   int            `json:"total_count"`
	RunnerGroups []*RunnerGroup `json:"runner_groups"`
}

// CreateRunnerGroupRequest represents a request to create a Runner group for an organization.
type CreateRunnerGroupRequest struct {
	Name       *string `json:"name,omitempty"`
	Visibility *string `json:"visibility,omitempty"`
	// List of repository IDs that can access the runner group.
	SelectedRepositoryIDs []int64 `json:"selected_repository_ids,omitempty"`
	// Runners represent a list of runner IDs to add to the runner group.
	Runners []int64 `json:"runners,omitempty"`
	// If set to True, public repos can use this runner group
	AllowsPublicRepositories *bool `json:"allows_public_repositories,omitempty"`
	// If true, the runner group will be restricted to running only the workflows specified in the SelectedWorkflows slice.
	RestrictedToWorkflows *bool `json:"restricted_to_workflows,omitempty"`
	// List of workflows the runner group should be allowed to run. This setting will be ignored unless RestrictedToWorkflows is set to true.
	SelectedWorkflows []string `json:"selected_workflows,omitempty"`
}

// UpdateRunnerGroupRequest represents a request to update a Runner group for an organization.
type UpdateRunnerGroupRequest struct {
	Name                     *string  `json:"name,omitempty"`
	Visibility               *string  `json:"visibility,omitempty"`
	AllowsPublicRepositories *bool    `json:"allows_public_repositories,omitempty"`
	RestrictedToWorkflows    *bool    `json:"restricted_to_workflows,omitempty"`
	SelectedWorkflows        []string `json:"selected_workflows,omitempty"`
}

// SetRepoAccessRunnerGroupRequest represents a request to replace the list of repositories
// that can access a self-hosted runner group configured in an organization.
type SetRepoAccessRunnerGroupRequest struct {
	// Updated list of repository IDs that should be given access to the runner group.
	SelectedRepositoryIDs []int64 `json:"selected_repository_ids"`
}

// SetRunnerGroupRunnersRequest represents a request to replace the list of
// self-hosted runners that are part of an organization runner group.
type SetRunnerGroupRunnersRequest struct {
	// Updated list of runner IDs that should be given access to the runner group.
	Runners []int64 `json:"runners"`
}

// ListOrgRunnerGroupOptions extend ListOptions to have the optional parameters VisibleToRepository.
type ListOrgRunnerGroupOptions struct {
	ListOptions

	// Only return runner groups that are allowed to be used by this repository.
	VisibleToRepository string `url:"visible_to_repository,omitempty"`
}

// ListOrganizationRunnerGroups lists all self-hosted runner groups configured in an organization.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#list-self-hosted-runner-groups-for-an-organization
//
//meta:operation GET /orgs/{org}/actions/runner-groups
func (s *ActionsService) ListOrganizationRunnerGroups(ctx context.Context, org string, opts *ListOrgRunnerGroupOptions) (*RunnerGroups, *Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	groups := &RunnerGroups{}
	resp, err := s.client.Do(ctx, req, &groups)
	if err != nil {
		return nil, resp, err
	}

	return groups, resp, nil
}

// GetOrganizationRunnerGroup gets a specific self-hosted runner group for an organization using its RunnerGroup ID.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#get-a-self-hosted-runner-group-for-an-organization
//
//meta:operation GET /orgs/{org}/actions/runner-groups/{runner_group_id}
func (s *ActionsService) GetOrganizationRunnerGroup(ctx context.Context, org string, groupID int64) (*RunnerGroup, *Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v", org, groupID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	runnerGroup := new(RunnerGroup)
	resp, err := s.client.Do(ctx, req, runnerGroup)
	if err != nil {
		return nil, resp, err
	}

	return runnerGroup, resp, nil
}

// DeleteOrganizationRunnerGroup deletes a self-hosted runner group from an organization.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#delete-a-self-hosted-runner-group-from-an-organization
//
//meta:operation DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}
func (s *ActionsService) DeleteOrganizationRunnerGroup(ctx context.Context, org string, groupID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v", org, groupID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// CreateOrganizationRunnerGroup creates a new self-hosted runner group for an organization.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#create-a-self-hosted-runner-group-for-an-organization
//
//meta:operation POST /orgs/{org}/actions/runner-groups
func (s *ActionsService) CreateOrganizationRunnerGroup(ctx context.Context, org string, createReq CreateRunnerGroupRequest) (*RunnerGroup, *Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups", org)
	req, err := s.client.NewRequest("POST", u, createReq)
	if err != nil {
		return nil, nil, err
	}

	runnerGroup := new(RunnerGroup)
	resp, err := s.client.Do(ctx, req, runnerGroup)
	if err != nil {
		return nil, resp, err
	}

	return runnerGroup, resp, nil
}

// UpdateOrganizationRunnerGroup updates a self-hosted runner group for an organization.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#update-a-self-hosted-runner-group-for-an-organization
//
//meta:operation PATCH /orgs/{org}/actions/runner-groups/{runner_group_id}
func (s *ActionsService) UpdateOrganizationRunnerGroup(ctx context.Context, org string, groupID int64, updateReq UpdateRunnerGroupRequest) (*RunnerGroup, *Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v", org, groupID)
	req, err := s.client.NewRequest("PATCH", u, updateReq)
	if err != nil {
		return nil, nil, err
	}

	runnerGroup := new(RunnerGroup)
	resp, err := s.client.Do(ctx, req, runnerGroup)
	if err != nil {
		return nil, resp, err
	}

	return runnerGroup, resp, nil
}

// ListRepositoryAccessRunnerGroup lists the repositories with access to a self-hosted runner group configured in an organization.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#list-repository-access-to-a-self-hosted-runner-group-in-an-organization
//
//meta:operation GET /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories
func (s *ActionsService) ListRepositoryAccessRunnerGroup(ctx context.Context, org string, groupID int64, opts *ListOptions) (*ListRepositories, *Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v/repositories", org, groupID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	repos := &ListRepositories{}
	resp, err := s.client.Do(ctx, req, &repos)
	if err != nil {
		return nil, resp, err
	}

	return repos, resp, nil
}

// SetRepositoryAccessRunnerGroup replaces the list of repositories that have access to a self-hosted runner group configured in an organization
// with a new List of repositories.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#set-repository-access-for-a-self-hosted-runner-group-in-an-organization
//
//meta:operation PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories
func (s *ActionsService) SetRepositoryAccessRunnerGroup(ctx context.Context, org string, groupID int64, ids SetRepoAccessRunnerGroupRequest) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v/repositories", org, groupID)

	req, err := s.client.NewRequest("PUT", u, ids)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// AddRepositoryAccessRunnerGroup adds a repository to the list of selected repositories that can access a self-hosted runner group.
// The runner group must have visibility set to 'selected'.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#add-repository-access-to-a-self-hosted-runner-group-in-an-organization
//
//meta:operation PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}
func (s *ActionsService) AddRepositoryAccessRunnerGroup(ctx context.Context, org string, groupID, repoID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v/repositories/%v", org, groupID, repoID)

	req, err := s.client.NewRequest("PUT", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RemoveRepositoryAccessRunnerGroup removes a repository from the list of selected repositories that can access a self-hosted runner group.
// The runner group must have visibility set to 'selected'.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#remove-repository-access-to-a-self-hosted-runner-group-in-an-organization
//
//meta:operation DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}
func (s *ActionsService) RemoveRepositoryAccessRunnerGroup(ctx context.Context, org string, groupID, repoID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v/repositories/%v", org, groupID, repoID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// ListRunnerGroupRunners lists self-hosted runners that are in a specific organization group.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#list-self-hosted-runners-in-a-group-for-an-organization
//
//meta:operation GET /orgs/{org}/actions/runner-groups/{runner_group_id}/runners
func (s *ActionsService) ListRunnerGroupRunners(ctx context.Context, org string, groupID int64, opts *ListOptions) (*Runners, *Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v/runners", org, groupID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	runners := &Runners{}
	resp, err := s.client.Do(ctx, req, &runners)
	if err != nil {
		return nil, resp, err
	}

	return runners, resp, nil
}

// SetRunnerGroupRunners replaces the list of self-hosted runners that are part of an organization runner group
// with a new list of runners.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#set-self-hosted-runners-in-a-group-for-an-organization
//
//meta:operation PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/runners
func (s *ActionsService) SetRunnerGroupRunners(ctx context.Context, org string, groupID int64, ids SetRunnerGroupRunnersRequest) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v/runners", org, groupID)

	req, err := s.client.NewRequest("PUT", u, ids)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// AddRunnerGroupRunners adds a self-hosted runner to a runner group configured in an organization.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#add-a-self-hosted-runner-to-a-group-for-an-organization
//
//meta:operation PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/runners/{runner_id}
func (s *ActionsService) AddRunnerGroupRunners(ctx context.Context, org string, groupID, runnerID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v/runners/%v", org, groupID, runnerID)

	req, err := s.client.NewRequest("PUT", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RemoveRunnerGroupRunners removes a self-hosted runner from a group configured in an organization.
// The runner is then returned to the default group.
//
// GitHub API docs: https://docs.github.com/rest/actions/self-hosted-runner-groups#remove-a-self-hosted-runner-from-a-group-for-an-organization
//
//meta:operation DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}/runners/{runner_id}
func (s *ActionsService) RemoveRunnerGroupRunners(ctx context.Context, org string, groupID, runnerID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/runner-groups/%v/runners/%v", org, groupID, runnerID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
