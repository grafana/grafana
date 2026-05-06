// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// GetAllOrganizationRulesets gets all the rulesets for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#get-all-organization-repository-rulesets
//
//meta:operation GET /orgs/{org}/rulesets
func (s *OrganizationsService) GetAllOrganizationRulesets(ctx context.Context, org string) ([]*Ruleset, *Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets", org)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var rulesets []*Ruleset
	resp, err := s.client.Do(ctx, req, &rulesets)
	if err != nil {
		return nil, resp, err
	}

	return rulesets, resp, nil
}

// CreateOrganizationRuleset creates a ruleset for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#create-an-organization-repository-ruleset
//
//meta:operation POST /orgs/{org}/rulesets
func (s *OrganizationsService) CreateOrganizationRuleset(ctx context.Context, org string, rs *Ruleset) (*Ruleset, *Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets", org)

	req, err := s.client.NewRequest("POST", u, rs)
	if err != nil {
		return nil, nil, err
	}

	var ruleset *Ruleset
	resp, err := s.client.Do(ctx, req, &ruleset)
	if err != nil {
		return nil, resp, err
	}

	return ruleset, resp, nil
}

// GetOrganizationRuleset gets a ruleset from the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#get-an-organization-repository-ruleset
//
//meta:operation GET /orgs/{org}/rulesets/{ruleset_id}
func (s *OrganizationsService) GetOrganizationRuleset(ctx context.Context, org string, rulesetID int64) (*Ruleset, *Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets/%v", org, rulesetID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var ruleset *Ruleset
	resp, err := s.client.Do(ctx, req, &ruleset)
	if err != nil {
		return nil, resp, err
	}

	return ruleset, resp, nil
}

// UpdateOrganizationRuleset updates a ruleset from the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#update-an-organization-repository-ruleset
//
//meta:operation PUT /orgs/{org}/rulesets/{ruleset_id}
func (s *OrganizationsService) UpdateOrganizationRuleset(ctx context.Context, org string, rulesetID int64, rs *Ruleset) (*Ruleset, *Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets/%v", org, rulesetID)

	req, err := s.client.NewRequest("PUT", u, rs)
	if err != nil {
		return nil, nil, err
	}

	var ruleset *Ruleset
	resp, err := s.client.Do(ctx, req, &ruleset)
	if err != nil {
		return nil, resp, err
	}

	return ruleset, resp, nil
}

// DeleteOrganizationRuleset deletes a ruleset from the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/rules#delete-an-organization-repository-ruleset
//
//meta:operation DELETE /orgs/{org}/rulesets/{ruleset_id}
func (s *OrganizationsService) DeleteOrganizationRuleset(ctx context.Context, org string, rulesetID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/rulesets/%v", org, rulesetID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
