// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// Environment represents a single environment in a repository.
type Environment struct {
	Owner                  *string         `json:"owner,omitempty"`
	Repo                   *string         `json:"repo,omitempty"`
	EnvironmentName        *string         `json:"environment_name,omitempty"`
	WaitTimer              *int            `json:"wait_timer,omitempty"`
	Reviewers              []*EnvReviewers `json:"reviewers,omitempty"`
	DeploymentBranchPolicy *BranchPolicy   `json:"deployment_branch_policy,omitempty"`
	// Return/response only values
	ID              *int64            `json:"id,omitempty"`
	NodeID          *string           `json:"node_id,omitempty"`
	Name            *string           `json:"name,omitempty"`
	URL             *string           `json:"url,omitempty"`
	HTMLURL         *string           `json:"html_url,omitempty"`
	CreatedAt       *Timestamp        `json:"created_at,omitempty"`
	UpdatedAt       *Timestamp        `json:"updated_at,omitempty"`
	CanAdminsBypass *bool             `json:"can_admins_bypass,omitempty"`
	ProtectionRules []*ProtectionRule `json:"protection_rules,omitempty"`
}

// EnvReviewers represents a single environment reviewer entry.
type EnvReviewers struct {
	Type *string `json:"type,omitempty"`
	ID   *int64  `json:"id,omitempty"`
}

// BranchPolicy represents the options for whether a branch deployment policy is applied to this environment.
type BranchPolicy struct {
	ProtectedBranches    *bool `json:"protected_branches,omitempty"`
	CustomBranchPolicies *bool `json:"custom_branch_policies,omitempty"`
}

// EnvResponse represents the slightly different format of response that comes back when you list an environment.
type EnvResponse struct {
	TotalCount   *int           `json:"total_count,omitempty"`
	Environments []*Environment `json:"environments,omitempty"`
}

// ProtectionRule represents a single protection rule applied to the environment.
type ProtectionRule struct {
	ID                *int64              `json:"id,omitempty"`
	NodeID            *string             `json:"node_id,omitempty"`
	PreventSelfReview *bool               `json:"prevent_self_review,omitempty"`
	Type              *string             `json:"type,omitempty"`
	WaitTimer         *int                `json:"wait_timer,omitempty"`
	Reviewers         []*RequiredReviewer `json:"reviewers,omitempty"`
}

// RequiredReviewer represents a required reviewer.
type RequiredReviewer struct {
	Type     *string     `json:"type,omitempty"`
	Reviewer interface{} `json:"reviewer,omitempty"`
}

// EnvironmentListOptions specifies the optional parameters to the
// RepositoriesService.ListEnvironments method.
type EnvironmentListOptions struct {
	ListOptions
}

// UnmarshalJSON implements the json.Unmarshaler interface.
// This helps us handle the fact that RequiredReviewer can have either a User or Team type reviewer field.
func (r *RequiredReviewer) UnmarshalJSON(data []byte) error {
	type aliasReviewer RequiredReviewer
	var reviewer aliasReviewer
	if err := json.Unmarshal(data, &reviewer); err != nil {
		return err
	}

	r.Type = reviewer.Type

	switch *reviewer.Type {
	case "User":
		reviewer.Reviewer = &User{}
		if err := json.Unmarshal(data, &reviewer); err != nil {
			return err
		}
		r.Reviewer = reviewer.Reviewer
	case "Team":
		reviewer.Reviewer = &Team{}
		if err := json.Unmarshal(data, &reviewer); err != nil {
			return err
		}
		r.Reviewer = reviewer.Reviewer
	default:
		r.Type = nil
		r.Reviewer = nil
		return fmt.Errorf("reviewer.Type is %T, not a string of 'User' or 'Team', unable to unmarshal", reviewer.Type)
	}

	return nil
}

// ListEnvironments lists all environments for a repository.
//
// GitHub API docs: https://docs.github.com/rest/deployments/environments#list-environments
//
//meta:operation GET /repos/{owner}/{repo}/environments
func (s *RepositoriesService) ListEnvironments(ctx context.Context, owner, repo string, opts *EnvironmentListOptions) (*EnvResponse, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/environments", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var list *EnvResponse
	resp, err := s.client.Do(ctx, req, &list)
	if err != nil {
		return nil, resp, err
	}
	return list, resp, nil
}

// GetEnvironment get a single environment for a repository.
//
// GitHub API docs: https://docs.github.com/rest/deployments/environments#get-an-environment
//
//meta:operation GET /repos/{owner}/{repo}/environments/{environment_name}
func (s *RepositoriesService) GetEnvironment(ctx context.Context, owner, repo, name string) (*Environment, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/environments/%s", owner, repo, name)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var env *Environment
	resp, err := s.client.Do(ctx, req, &env)
	if err != nil {
		return nil, resp, err
	}
	return env, resp, nil
}

// MarshalJSON implements the json.Marshaler interface.
// As the only way to clear a WaitTimer is to set it to 0, a missing WaitTimer object should default to 0, not null.
// As the default value for CanAdminsBypass is true, a nil value here marshals to true.
func (c *CreateUpdateEnvironment) MarshalJSON() ([]byte, error) {
	type Alias CreateUpdateEnvironment
	if c.WaitTimer == nil {
		c.WaitTimer = Int(0)
	}
	if c.CanAdminsBypass == nil {
		c.CanAdminsBypass = Bool(true)
	}
	return json.Marshal(&struct {
		*Alias
	}{
		Alias: (*Alias)(c),
	})
}

// CreateUpdateEnvironment represents the fields required for the create/update operation
// following the Create/Update release example.
// See https://github.com/google/go-github/issues/992 for more information.
// Removed omitempty here as the API expects null values for reviewers and deployment_branch_policy to clear them.
type CreateUpdateEnvironment struct {
	WaitTimer              *int            `json:"wait_timer"`
	Reviewers              []*EnvReviewers `json:"reviewers"`
	CanAdminsBypass        *bool           `json:"can_admins_bypass"`
	DeploymentBranchPolicy *BranchPolicy   `json:"deployment_branch_policy"`
	PreventSelfReview      *bool           `json:"prevent_self_review,omitempty"`
}

// createUpdateEnvironmentNoEnterprise represents the fields accepted for Pro/Teams private repos.
// Ref: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment
// See https://github.com/google/go-github/issues/2602 for more information.
type createUpdateEnvironmentNoEnterprise struct {
	DeploymentBranchPolicy *BranchPolicy `json:"deployment_branch_policy"`
}

// CreateUpdateEnvironment create or update a new environment for a repository.
//
// GitHub API docs: https://docs.github.com/rest/deployments/environments#create-or-update-an-environment
//
//meta:operation PUT /repos/{owner}/{repo}/environments/{environment_name}
func (s *RepositoriesService) CreateUpdateEnvironment(ctx context.Context, owner, repo, name string, environment *CreateUpdateEnvironment) (*Environment, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/environments/%s", owner, repo, name)

	req, err := s.client.NewRequest("PUT", u, environment)
	if err != nil {
		return nil, nil, err
	}

	e := new(Environment)
	resp, err := s.client.Do(ctx, req, e)
	if err != nil {
		// The API returns 422 when the pricing plan doesn't support all the fields sent.
		// This path will be executed for Pro/Teams private repos.
		// For public repos, regardless of the pricing plan, all fields supported.
		// For Free plan private repos the returned error code is 404.
		// We are checking that the user didn't try to send a value for unsupported fields,
		// and return an error if they did.
		if resp != nil && resp.StatusCode == http.StatusUnprocessableEntity && environment != nil && len(environment.Reviewers) == 0 && environment.GetWaitTimer() == 0 {
			return s.createNewEnvNoEnterprise(ctx, u, environment)
		}
		return nil, resp, err
	}
	return e, resp, nil
}

// createNewEnvNoEnterprise is an internal function for cases where the original call returned 422.
// Currently only the `deployment_branch_policy` parameter is supported for Pro/Team private repos.
func (s *RepositoriesService) createNewEnvNoEnterprise(ctx context.Context, u string, environment *CreateUpdateEnvironment) (*Environment, *Response, error) {
	req, err := s.client.NewRequest("PUT", u, &createUpdateEnvironmentNoEnterprise{
		DeploymentBranchPolicy: environment.DeploymentBranchPolicy,
	})
	if err != nil {
		return nil, nil, err
	}

	e := new(Environment)
	resp, err := s.client.Do(ctx, req, e)
	if err != nil {
		return nil, resp, err
	}
	return e, resp, nil
}

// DeleteEnvironment delete an environment from a repository.
//
// GitHub API docs: https://docs.github.com/rest/deployments/environments#delete-an-environment
//
//meta:operation DELETE /repos/{owner}/{repo}/environments/{environment_name}
func (s *RepositoriesService) DeleteEnvironment(ctx context.Context, owner, repo, name string) (*Response, error) {
	u := fmt.Sprintf("repos/%s/%s/environments/%s", owner, repo, name)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}
	return s.client.Do(ctx, req, nil)
}
