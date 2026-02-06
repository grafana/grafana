// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// ActionsVariable represents a repository action variable.
type ActionsVariable struct {
	Name       string     `json:"name"`
	Value      string     `json:"value"`
	CreatedAt  *Timestamp `json:"created_at,omitempty"`
	UpdatedAt  *Timestamp `json:"updated_at,omitempty"`
	Visibility *string    `json:"visibility,omitempty"`
	// Used by ListOrgVariables and GetOrgVariables
	SelectedRepositoriesURL *string `json:"selected_repositories_url,omitempty"`
	// Used by UpdateOrgVariable and CreateOrgVariable
	SelectedRepositoryIDs *SelectedRepoIDs `json:"selected_repository_ids,omitempty"`
}

// ActionsVariables represents one item from the ListVariables response.
type ActionsVariables struct {
	TotalCount int                `json:"total_count"`
	Variables  []*ActionsVariable `json:"variables"`
}

func (s *ActionsService) listVariables(ctx context.Context, url string, opts *ListOptions) (*ActionsVariables, *Response, error) {
	u, err := addOptions(url, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	variables := new(ActionsVariables)
	resp, err := s.client.Do(ctx, req, &variables)
	if err != nil {
		return nil, resp, err
	}

	return variables, resp, nil
}

// ListRepoVariables lists all variables available in a repository.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#list-repository-variables
//
//meta:operation GET /repos/{owner}/{repo}/actions/variables
func (s *ActionsService) ListRepoVariables(ctx context.Context, owner, repo string, opts *ListOptions) (*ActionsVariables, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/variables", owner, repo)
	return s.listVariables(ctx, url, opts)
}

// ListRepoOrgVariables lists all organization variables available in a repository.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#list-repository-organization-variables
//
//meta:operation GET /repos/{owner}/{repo}/actions/organization-variables
func (s *ActionsService) ListRepoOrgVariables(ctx context.Context, owner, repo string, opts *ListOptions) (*ActionsVariables, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/organization-variables", owner, repo)
	return s.listVariables(ctx, url, opts)
}

// ListOrgVariables lists all variables available in an organization.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#list-organization-variables
//
//meta:operation GET /orgs/{org}/actions/variables
func (s *ActionsService) ListOrgVariables(ctx context.Context, org string, opts *ListOptions) (*ActionsVariables, *Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/variables", org)
	return s.listVariables(ctx, url, opts)
}

// ListEnvVariables lists all variables available in an environment.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#list-environment-variables
//
//meta:operation GET /repos/{owner}/{repo}/environments/{environment_name}/variables
func (s *ActionsService) ListEnvVariables(ctx context.Context, owner, repo, env string, opts *ListOptions) (*ActionsVariables, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/environments/%v/variables", owner, repo, env)
	return s.listVariables(ctx, url, opts)
}

func (s *ActionsService) getVariable(ctx context.Context, url string) (*ActionsVariable, *Response, error) {
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	variable := new(ActionsVariable)
	resp, err := s.client.Do(ctx, req, variable)
	if err != nil {
		return nil, resp, err
	}

	return variable, resp, nil
}

// GetRepoVariable gets a single repository variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#get-a-repository-variable
//
//meta:operation GET /repos/{owner}/{repo}/actions/variables/{name}
func (s *ActionsService) GetRepoVariable(ctx context.Context, owner, repo, name string) (*ActionsVariable, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/variables/%v", owner, repo, name)
	return s.getVariable(ctx, url)
}

// GetOrgVariable gets a single organization variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#get-an-organization-variable
//
//meta:operation GET /orgs/{org}/actions/variables/{name}
func (s *ActionsService) GetOrgVariable(ctx context.Context, org, name string) (*ActionsVariable, *Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/variables/%v", org, name)
	return s.getVariable(ctx, url)
}

// GetEnvVariable gets a single environment variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#get-an-environment-variable
//
//meta:operation GET /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}
func (s *ActionsService) GetEnvVariable(ctx context.Context, owner, repo, env, variableName string) (*ActionsVariable, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/environments/%v/variables/%v", owner, repo, env, variableName)
	return s.getVariable(ctx, url)
}

func (s *ActionsService) postVariable(ctx context.Context, url string, variable *ActionsVariable) (*Response, error) {
	req, err := s.client.NewRequest("POST", url, variable)
	if err != nil {
		return nil, err
	}
	return s.client.Do(ctx, req, nil)
}

// CreateRepoVariable creates a repository variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#create-a-repository-variable
//
//meta:operation POST /repos/{owner}/{repo}/actions/variables
func (s *ActionsService) CreateRepoVariable(ctx context.Context, owner, repo string, variable *ActionsVariable) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/variables", owner, repo)
	return s.postVariable(ctx, url, variable)
}

// CreateOrgVariable creates an organization variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#create-an-organization-variable
//
//meta:operation POST /orgs/{org}/actions/variables
func (s *ActionsService) CreateOrgVariable(ctx context.Context, org string, variable *ActionsVariable) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/variables", org)
	return s.postVariable(ctx, url, variable)
}

// CreateEnvVariable creates an environment variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#create-an-environment-variable
//
//meta:operation POST /repos/{owner}/{repo}/environments/{environment_name}/variables
func (s *ActionsService) CreateEnvVariable(ctx context.Context, owner, repo, env string, variable *ActionsVariable) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/environments/%v/variables", owner, repo, env)
	return s.postVariable(ctx, url, variable)
}

func (s *ActionsService) patchVariable(ctx context.Context, url string, variable *ActionsVariable) (*Response, error) {
	req, err := s.client.NewRequest("PATCH", url, variable)
	if err != nil {
		return nil, err
	}
	return s.client.Do(ctx, req, nil)
}

// UpdateRepoVariable updates a repository variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#update-a-repository-variable
//
//meta:operation PATCH /repos/{owner}/{repo}/actions/variables/{name}
func (s *ActionsService) UpdateRepoVariable(ctx context.Context, owner, repo string, variable *ActionsVariable) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/variables/%v", owner, repo, variable.Name)
	return s.patchVariable(ctx, url, variable)
}

// UpdateOrgVariable updates an organization variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#update-an-organization-variable
//
//meta:operation PATCH /orgs/{org}/actions/variables/{name}
func (s *ActionsService) UpdateOrgVariable(ctx context.Context, org string, variable *ActionsVariable) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/variables/%v", org, variable.Name)
	return s.patchVariable(ctx, url, variable)
}

// UpdateEnvVariable updates an environment variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#update-an-environment-variable
//
//meta:operation PATCH /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}
func (s *ActionsService) UpdateEnvVariable(ctx context.Context, owner, repo, env string, variable *ActionsVariable) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/environments/%v/variables/%v", owner, repo, env, variable.Name)
	return s.patchVariable(ctx, url, variable)
}

func (s *ActionsService) deleteVariable(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// DeleteRepoVariable deletes a variable in a repository.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#delete-a-repository-variable
//
//meta:operation DELETE /repos/{owner}/{repo}/actions/variables/{name}
func (s *ActionsService) DeleteRepoVariable(ctx context.Context, owner, repo, name string) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/actions/variables/%v", owner, repo, name)
	return s.deleteVariable(ctx, url)
}

// DeleteOrgVariable deletes a variable in an organization.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#delete-an-organization-variable
//
//meta:operation DELETE /orgs/{org}/actions/variables/{name}
func (s *ActionsService) DeleteOrgVariable(ctx context.Context, org, name string) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/variables/%v", org, name)
	return s.deleteVariable(ctx, url)
}

// DeleteEnvVariable deletes a variable in an environment.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#delete-an-environment-variable
//
//meta:operation DELETE /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}
func (s *ActionsService) DeleteEnvVariable(ctx context.Context, owner, repo, env, variableName string) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/environments/%v/variables/%v", owner, repo, env, variableName)
	return s.deleteVariable(ctx, url)
}

func (s *ActionsService) listSelectedReposForVariable(ctx context.Context, url string, opts *ListOptions) (*SelectedReposList, *Response, error) {
	u, err := addOptions(url, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	result := new(SelectedReposList)
	resp, err := s.client.Do(ctx, req, result)
	if err != nil {
		return nil, resp, err
	}

	return result, resp, nil
}

// ListSelectedReposForOrgVariable lists all repositories that have access to a variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#list-selected-repositories-for-an-organization-variable
//
//meta:operation GET /orgs/{org}/actions/variables/{name}/repositories
func (s *ActionsService) ListSelectedReposForOrgVariable(ctx context.Context, org, name string, opts *ListOptions) (*SelectedReposList, *Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/variables/%v/repositories", org, name)
	return s.listSelectedReposForVariable(ctx, url, opts)
}

func (s *ActionsService) setSelectedReposForVariable(ctx context.Context, url string, ids SelectedRepoIDs) (*Response, error) {
	type repoIDs struct {
		SelectedIDs SelectedRepoIDs `json:"selected_repository_ids"`
	}

	req, err := s.client.NewRequest("PUT", url, repoIDs{SelectedIDs: ids})
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// SetSelectedReposForOrgVariable sets the repositories that have access to a variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#set-selected-repositories-for-an-organization-variable
//
//meta:operation PUT /orgs/{org}/actions/variables/{name}/repositories
func (s *ActionsService) SetSelectedReposForOrgVariable(ctx context.Context, org, name string, ids SelectedRepoIDs) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/variables/%v/repositories", org, name)
	return s.setSelectedReposForVariable(ctx, url, ids)
}

func (s *ActionsService) addSelectedRepoToVariable(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest("PUT", url, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// AddSelectedRepoToOrgVariable adds a repository to an organization variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#add-selected-repository-to-an-organization-variable
//
//meta:operation PUT /orgs/{org}/actions/variables/{name}/repositories/{repository_id}
func (s *ActionsService) AddSelectedRepoToOrgVariable(ctx context.Context, org, name string, repo *Repository) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/variables/%v/repositories/%v", org, name, *repo.ID)
	return s.addSelectedRepoToVariable(ctx, url)
}

func (s *ActionsService) removeSelectedRepoFromVariable(ctx context.Context, url string) (*Response, error) {
	req, err := s.client.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RemoveSelectedRepoFromOrgVariable removes a repository from an organization variable.
//
// GitHub API docs: https://docs.github.com/rest/actions/variables#remove-selected-repository-from-an-organization-variable
//
//meta:operation DELETE /orgs/{org}/actions/variables/{name}/repositories/{repository_id}
func (s *ActionsService) RemoveSelectedRepoFromOrgVariable(ctx context.Context, org, name string, repo *Repository) (*Response, error) {
	url := fmt.Sprintf("orgs/%v/actions/variables/%v/repositories/%v", org, name, *repo.ID)
	return s.removeSelectedRepoFromVariable(ctx, url)
}
