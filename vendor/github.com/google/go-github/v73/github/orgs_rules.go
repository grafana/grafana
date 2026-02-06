// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// GetAllRepositoryRulesets gets all the repository rulesets for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#get-all-organization-repository-rulesets
//
//meta:operation GET /orgs/{org}/rulesets
func (s *OrganizationsService) GetAllRepositoryRulesets(ctx context.Context, org string, opts *ListOptions) ([]*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets", org)

	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var rulesets []*RepositoryRuleset
	resp, err := s.client.Do(ctx, req, &rulesets)
	if err != nil {
		return nil, resp, err
	}

	return rulesets, resp, nil
}

// CreateRepositoryRuleset creates a repository ruleset for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#create-an-organization-repository-ruleset
//
//meta:operation POST /orgs/{org}/rulesets
func (s *OrganizationsService) CreateRepositoryRuleset(ctx context.Context, org string, ruleset RepositoryRuleset) (*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets", org)

	req, err := s.client.NewRequest("POST", u, ruleset)
	if err != nil {
		return nil, nil, err
	}

	var rs *RepositoryRuleset
	resp, err := s.client.Do(ctx, req, &rs)
	if err != nil {
		return nil, resp, err
	}

	return rs, resp, nil
}

// GetRepositoryRuleset gets a repository ruleset for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#get-an-organization-repository-ruleset
//
//meta:operation GET /orgs/{org}/rulesets/{ruleset_id}
func (s *OrganizationsService) GetRepositoryRuleset(ctx context.Context, org string, rulesetID int64) (*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets/%v", org, rulesetID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var ruleset *RepositoryRuleset
	resp, err := s.client.Do(ctx, req, &ruleset)
	if err != nil {
		return nil, resp, err
	}

	return ruleset, resp, nil
}

// UpdateRepositoryRuleset updates a repository ruleset for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#update-an-organization-repository-ruleset
//
//meta:operation PUT /orgs/{org}/rulesets/{ruleset_id}
func (s *OrganizationsService) UpdateRepositoryRuleset(ctx context.Context, org string, rulesetID int64, ruleset RepositoryRuleset) (*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets/%v", org, rulesetID)

	req, err := s.client.NewRequest("PUT", u, ruleset)
	if err != nil {
		return nil, nil, err
	}

	var rs *RepositoryRuleset
	resp, err := s.client.Do(ctx, req, &rs)
	if err != nil {
		return nil, resp, err
	}

	return rs, resp, nil
}

// UpdateRepositoryRulesetClearBypassActor clears the bypass actors for a repository ruleset for the specified organization.
//
// This function is necessary as the UpdateRepositoryRuleset function does not marshal ByPassActor if passed as an empty array.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#update-an-organization-repository-ruleset
//
//meta:operation PUT /orgs/{org}/rulesets/{ruleset_id}
func (s *OrganizationsService) UpdateRepositoryRulesetClearBypassActor(ctx context.Context, org string, rulesetID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets/%v", org, rulesetID)

	rsClearBypassActor := rulesetClearBypassActors{}

	req, err := s.client.NewRequest("PUT", u, rsClearBypassActor)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// DeleteRepositoryRuleset deletes a repository ruleset from the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#delete-an-organization-repository-ruleset
//
//meta:operation DELETE /orgs/{org}/rulesets/{ruleset_id}
func (s *OrganizationsService) DeleteRepositoryRuleset(ctx context.Context, org string, rulesetID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets/%v", org, rulesetID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
