// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// CreateRepositoryRuleset creates a repository ruleset for the specified enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/rules#create-an-enterprise-repository-ruleset
//
//meta:operation POST /enterprises/{enterprise}/rulesets
func (s *EnterpriseService) CreateRepositoryRuleset(ctx context.Context, enterprise string, ruleset RepositoryRuleset) (*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/rulesets", enterprise)

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

// GetRepositoryRuleset gets a repository ruleset for the specified enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/rules#get-an-enterprise-repository-ruleset
//
//meta:operation GET /enterprises/{enterprise}/rulesets/{ruleset_id}
func (s *EnterpriseService) GetRepositoryRuleset(ctx context.Context, enterprise string, rulesetID int64) (*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/rulesets/%v", enterprise, rulesetID)

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

// UpdateRepositoryRuleset updates a repository ruleset for the specified enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/rules#update-an-enterprise-repository-ruleset
//
//meta:operation PUT /enterprises/{enterprise}/rulesets/{ruleset_id}
func (s *EnterpriseService) UpdateRepositoryRuleset(ctx context.Context, enterprise string, rulesetID int64, ruleset RepositoryRuleset) (*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/rulesets/%v", enterprise, rulesetID)

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

// UpdateRepositoryRulesetClearBypassActor clears the bypass actors for a repository ruleset for the specified enterprise.
//
// This function is necessary as the UpdateRepositoryRuleset function does not marshal ByPassActor if passed as an empty array.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/rules#update-an-enterprise-repository-ruleset
//
//meta:operation PUT /enterprises/{enterprise}/rulesets/{ruleset_id}
func (s *EnterpriseService) UpdateRepositoryRulesetClearBypassActor(ctx context.Context, enterprise string, rulesetID int64) (*Response, error) {
	u := fmt.Sprintf("enterprises/%v/rulesets/%v", enterprise, rulesetID)

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

// DeleteRepositoryRuleset deletes a repository ruleset from the specified enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/rules#delete-an-enterprise-repository-ruleset
//
//meta:operation DELETE /enterprises/{enterprise}/rulesets/{ruleset_id}
func (s *EnterpriseService) DeleteRepositoryRuleset(ctx context.Context, enterprise string, rulesetID int64) (*Response, error) {
	u := fmt.Sprintf("enterprises/%v/rulesets/%v", enterprise, rulesetID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
