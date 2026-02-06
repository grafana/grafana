// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// GetRulesForBranch gets all the repository rules that apply to the specified branch.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#get-rules-for-a-branch
//
//meta:operation GET /repos/{owner}/{repo}/rules/branches/{branch}
func (s *RepositoriesService) GetRulesForBranch(ctx context.Context, owner, repo, branch string, opts *ListOptions) (*BranchRules, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rules/branches/%v", owner, repo, branch)

	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var rules *BranchRules
	resp, err := s.client.Do(ctx, req, &rules)
	if err != nil {
		return nil, resp, err
	}

	return rules, resp, nil
}

// RepositoryListRulesetsOptions specifies optional parameters to the
// RepositoriesService.GetAllRulesets method.
type RepositoryListRulesetsOptions struct {
	// IncludesParents indicates whether to include rulesets configured at the organization or enterprise level that apply to the repository.
	IncludesParents *bool `url:"includes_parents,omitempty"`
	ListOptions
}

// GetAllRulesets gets all the repository rulesets for the specified repository.
// By default, this endpoint will include rulesets configured at the organization or enterprise level that apply to the repository.
// To exclude those rulesets, set the `RepositoryListRulesetsOptions.IncludesParents` parameter to `false`.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#get-all-repository-rulesets
//
//meta:operation GET /repos/{owner}/{repo}/rulesets
func (s *RepositoriesService) GetAllRulesets(ctx context.Context, owner, repo string, opts *RepositoryListRulesetsOptions) ([]*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rulesets", owner, repo)

	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var ruleset []*RepositoryRuleset
	resp, err := s.client.Do(ctx, req, &ruleset)
	if err != nil {
		return nil, resp, err
	}

	return ruleset, resp, nil
}

// CreateRuleset creates a repository ruleset for the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#create-a-repository-ruleset
//
//meta:operation POST /repos/{owner}/{repo}/rulesets
func (s *RepositoriesService) CreateRuleset(ctx context.Context, owner, repo string, ruleset RepositoryRuleset) (*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rulesets", owner, repo)

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

// GetRuleset gets a repository ruleset for the specified repository.
// If includesParents is true, rulesets configured at the organization or enterprise level that apply to the repository will be returned.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#get-a-repository-ruleset
//
//meta:operation GET /repos/{owner}/{repo}/rulesets/{ruleset_id}
func (s *RepositoriesService) GetRuleset(ctx context.Context, owner, repo string, rulesetID int64, includesParents bool) (*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rulesets/%v?includes_parents=%v", owner, repo, rulesetID, includesParents)

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

// UpdateRuleset updates a repository ruleset for the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#update-a-repository-ruleset
//
//meta:operation PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}
func (s *RepositoriesService) UpdateRuleset(ctx context.Context, owner, repo string, rulesetID int64, ruleset RepositoryRuleset) (*RepositoryRuleset, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rulesets/%v", owner, repo, rulesetID)

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

// DeleteRuleset deletes a repository ruleset for the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#delete-a-repository-ruleset
//
//meta:operation DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}
func (s *RepositoriesService) DeleteRuleset(ctx context.Context, owner, repo string, rulesetID int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rulesets/%v", owner, repo, rulesetID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
