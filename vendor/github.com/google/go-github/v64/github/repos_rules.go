// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"fmt"
)

// BypassActor represents the bypass actors from a ruleset.
type BypassActor struct {
	ActorID *int64 `json:"actor_id,omitempty"`
	// Possible values for ActorType are: RepositoryRole, Team, Integration, OrganizationAdmin
	ActorType *string `json:"actor_type,omitempty"`
	// Possible values for BypassMode are: always, pull_request
	BypassMode *string `json:"bypass_mode,omitempty"`
}

// RulesetLink represents a single link object from GitHub ruleset request _links.
type RulesetLink struct {
	HRef *string `json:"href,omitempty"`
}

// RulesetLinks represents the "_links" object in a Ruleset.
type RulesetLinks struct {
	Self *RulesetLink `json:"self,omitempty"`
}

// RulesetRefConditionParameters represents the conditions object for ref_names.
type RulesetRefConditionParameters struct {
	Include []string `json:"include"`
	Exclude []string `json:"exclude"`
}

// RulesetRepositoryNamesConditionParameters represents the conditions object for repository_names.
type RulesetRepositoryNamesConditionParameters struct {
	Include   []string `json:"include"`
	Exclude   []string `json:"exclude"`
	Protected *bool    `json:"protected,omitempty"`
}

// RulesetRepositoryIDsConditionParameters represents the conditions object for repository_ids.
type RulesetRepositoryIDsConditionParameters struct {
	RepositoryIDs []int64 `json:"repository_ids,omitempty"`
}

// RulesetRepositoryPropertyTargetParameters represents a repository_property name and values to be used for targeting.
type RulesetRepositoryPropertyTargetParameters struct {
	Name   string   `json:"name"`
	Values []string `json:"property_values"`
}

// RulesetRepositoryPropertyConditionParameters represents the conditions object for repository_property.
type RulesetRepositoryPropertyConditionParameters struct {
	Include []RulesetRepositoryPropertyTargetParameters `json:"include"`
	Exclude []RulesetRepositoryPropertyTargetParameters `json:"exclude"`
}

// RulesetConditions represents the conditions object in a ruleset.
// Set either RepositoryName or RepositoryID or RepositoryProperty, not more than one.
type RulesetConditions struct {
	RefName            *RulesetRefConditionParameters                `json:"ref_name,omitempty"`
	RepositoryName     *RulesetRepositoryNamesConditionParameters    `json:"repository_name,omitempty"`
	RepositoryID       *RulesetRepositoryIDsConditionParameters      `json:"repository_id,omitempty"`
	RepositoryProperty *RulesetRepositoryPropertyConditionParameters `json:"repository_property,omitempty"`
}

// RulePatternParameters represents the rule pattern parameters.
type RulePatternParameters struct {
	Name *string `json:"name,omitempty"`
	// If Negate is true, the rule will fail if the pattern matches.
	Negate *bool `json:"negate,omitempty"`
	// Possible values for Operator are: starts_with, ends_with, contains, regex
	Operator string `json:"operator"`
	Pattern  string `json:"pattern"`
}

// RuleFileParameters represents a list of file paths.
type RuleFileParameters struct {
	RestrictedFilePaths *[]string `json:"restricted_file_paths"`
}

// UpdateAllowsFetchAndMergeRuleParameters represents the update rule parameters.
type UpdateAllowsFetchAndMergeRuleParameters struct {
	UpdateAllowsFetchAndMerge bool `json:"update_allows_fetch_and_merge"`
}

// RequiredDeploymentEnvironmentsRuleParameters represents the required_deployments rule parameters.
type RequiredDeploymentEnvironmentsRuleParameters struct {
	RequiredDeploymentEnvironments []string `json:"required_deployment_environments"`
}

// PullRequestRuleParameters represents the pull_request rule parameters.
type PullRequestRuleParameters struct {
	DismissStaleReviewsOnPush      bool `json:"dismiss_stale_reviews_on_push"`
	RequireCodeOwnerReview         bool `json:"require_code_owner_review"`
	RequireLastPushApproval        bool `json:"require_last_push_approval"`
	RequiredApprovingReviewCount   int  `json:"required_approving_review_count"`
	RequiredReviewThreadResolution bool `json:"required_review_thread_resolution"`
}

// RuleRequiredStatusChecks represents the RequiredStatusChecks for the RequiredStatusChecksRuleParameters object.
type RuleRequiredStatusChecks struct {
	Context       string `json:"context"`
	IntegrationID *int64 `json:"integration_id,omitempty"`
}

// RequiredStatusChecksRuleParameters represents the required_status_checks rule parameters.
type RequiredStatusChecksRuleParameters struct {
	RequiredStatusChecks             []RuleRequiredStatusChecks `json:"required_status_checks"`
	StrictRequiredStatusChecksPolicy bool                       `json:"strict_required_status_checks_policy"`
}

// RuleRequiredWorkflow represents the Workflow for the RequireWorkflowsRuleParameters object.
type RuleRequiredWorkflow struct {
	Path         string  `json:"path"`
	Ref          *string `json:"ref,omitempty"`
	RepositoryID *int64  `json:"repository_id,omitempty"`
	Sha          *string `json:"sha,omitempty"`
}

// RequiredWorkflowsRuleParameters represents the workflows rule parameters.
type RequiredWorkflowsRuleParameters struct {
	RequiredWorkflows []*RuleRequiredWorkflow `json:"workflows"`
}

// RepositoryRule represents a GitHub Rule.
type RepositoryRule struct {
	Type              string           `json:"type"`
	Parameters        *json.RawMessage `json:"parameters,omitempty"`
	RulesetSourceType string           `json:"ruleset_source_type"`
	RulesetSource     string           `json:"ruleset_source"`
	RulesetID         int64            `json:"ruleset_id"`
}

// UnmarshalJSON implements the json.Unmarshaler interface.
// This helps us handle the fact that RepositoryRule parameter field can be of numerous types.
func (r *RepositoryRule) UnmarshalJSON(data []byte) error {
	type rule RepositoryRule
	var RepositoryRule rule
	if err := json.Unmarshal(data, &RepositoryRule); err != nil {
		return err
	}

	r.RulesetID = RepositoryRule.RulesetID
	r.RulesetSourceType = RepositoryRule.RulesetSourceType
	r.RulesetSource = RepositoryRule.RulesetSource
	r.Type = RepositoryRule.Type

	switch RepositoryRule.Type {
	case "creation", "deletion", "merge_queue", "non_fast_forward", "required_linear_history", "required_signatures":
		r.Parameters = nil
	case "update":
		if RepositoryRule.Parameters == nil {
			r.Parameters = nil
			return nil
		}
		params := UpdateAllowsFetchAndMergeRuleParameters{}
		if err := json.Unmarshal(*RepositoryRule.Parameters, &params); err != nil {
			return err
		}

		bytes, _ := json.Marshal(params)
		rawParams := json.RawMessage(bytes)

		r.Parameters = &rawParams

	case "required_deployments":
		params := RequiredDeploymentEnvironmentsRuleParameters{}
		if err := json.Unmarshal(*RepositoryRule.Parameters, &params); err != nil {
			return err
		}

		bytes, _ := json.Marshal(params)
		rawParams := json.RawMessage(bytes)

		r.Parameters = &rawParams
	case "commit_message_pattern", "commit_author_email_pattern", "committer_email_pattern", "branch_name_pattern", "tag_name_pattern":
		params := RulePatternParameters{}
		if err := json.Unmarshal(*RepositoryRule.Parameters, &params); err != nil {
			return err
		}

		bytes, _ := json.Marshal(params)
		rawParams := json.RawMessage(bytes)

		r.Parameters = &rawParams
	case "pull_request":
		params := PullRequestRuleParameters{}
		if err := json.Unmarshal(*RepositoryRule.Parameters, &params); err != nil {
			return err
		}

		bytes, _ := json.Marshal(params)
		rawParams := json.RawMessage(bytes)

		r.Parameters = &rawParams
	case "required_status_checks":
		params := RequiredStatusChecksRuleParameters{}
		if err := json.Unmarshal(*RepositoryRule.Parameters, &params); err != nil {
			return err
		}

		bytes, _ := json.Marshal(params)
		rawParams := json.RawMessage(bytes)

		r.Parameters = &rawParams
	case "workflows":
		params := RequiredWorkflowsRuleParameters{}
		if err := json.Unmarshal(*RepositoryRule.Parameters, &params); err != nil {
			return err
		}

		bytes, _ := json.Marshal(params)
		rawParams := json.RawMessage(bytes)

		r.Parameters = &rawParams
	case "file_path_restriction":
		params := RuleFileParameters{}
		if err := json.Unmarshal(*RepositoryRule.Parameters, &params); err != nil {
			return err
		}
		bytes, _ := json.Marshal(params)
		rawParams := json.RawMessage(bytes)

		r.Parameters = &rawParams
	default:
		r.Type = ""
		r.Parameters = nil
		return fmt.Errorf("RepositoryRule.Type %q is not yet implemented, unable to unmarshal (%#v)", RepositoryRule.Type, RepositoryRule)
	}

	return nil
}

// NewMergeQueueRule creates a rule to only allow merges via a merge queue.
func NewMergeQueueRule() (rule *RepositoryRule) {
	return &RepositoryRule{
		Type: "merge_queue",
	}
}

// NewCreationRule creates a rule to only allow users with bypass permission to create matching refs.
func NewCreationRule() (rule *RepositoryRule) {
	return &RepositoryRule{
		Type: "creation",
	}
}

// NewUpdateRule creates a rule to only allow users with bypass permission to update matching refs.
func NewUpdateRule(params *UpdateAllowsFetchAndMergeRuleParameters) (rule *RepositoryRule) {
	if params != nil {
		bytes, _ := json.Marshal(params)

		rawParams := json.RawMessage(bytes)

		return &RepositoryRule{
			Type:       "update",
			Parameters: &rawParams,
		}
	}
	return &RepositoryRule{
		Type: "update",
	}
}

// NewDeletionRule creates a rule to only allow users with bypass permissions to delete matching refs.
func NewDeletionRule() (rule *RepositoryRule) {
	return &RepositoryRule{
		Type: "deletion",
	}
}

// NewRequiredLinearHistoryRule creates a rule to prevent merge commits from being pushed to matching branches.
func NewRequiredLinearHistoryRule() (rule *RepositoryRule) {
	return &RepositoryRule{
		Type: "required_linear_history",
	}
}

// NewRequiredDeploymentsRule creates a rule to require environments to be successfully deployed before they can be merged into the matching branches.
func NewRequiredDeploymentsRule(params *RequiredDeploymentEnvironmentsRuleParameters) (rule *RepositoryRule) {
	bytes, _ := json.Marshal(params)

	rawParams := json.RawMessage(bytes)

	return &RepositoryRule{
		Type:       "required_deployments",
		Parameters: &rawParams,
	}
}

// NewRequiredSignaturesRule creates a rule a to require commits pushed to matching branches to have verified signatures.
func NewRequiredSignaturesRule() (rule *RepositoryRule) {
	return &RepositoryRule{
		Type: "required_signatures",
	}
}

// NewPullRequestRule creates a rule to require all commits be made to a non-target branch and submitted via a pull request before they can be merged.
func NewPullRequestRule(params *PullRequestRuleParameters) (rule *RepositoryRule) {
	bytes, _ := json.Marshal(params)

	rawParams := json.RawMessage(bytes)

	return &RepositoryRule{
		Type:       "pull_request",
		Parameters: &rawParams,
	}
}

// NewRequiredStatusChecksRule creates a rule to require which status checks must pass before branches can be merged into a branch rule.
func NewRequiredStatusChecksRule(params *RequiredStatusChecksRuleParameters) (rule *RepositoryRule) {
	bytes, _ := json.Marshal(params)

	rawParams := json.RawMessage(bytes)

	return &RepositoryRule{
		Type:       "required_status_checks",
		Parameters: &rawParams,
	}
}

// NewNonFastForwardRule creates a rule as part to prevent users with push access from force pushing to matching branches.
func NewNonFastForwardRule() (rule *RepositoryRule) {
	return &RepositoryRule{
		Type: "non_fast_forward",
	}
}

// NewCommitMessagePatternRule creates a rule to restrict commit message patterns being pushed to matching branches.
func NewCommitMessagePatternRule(params *RulePatternParameters) (rule *RepositoryRule) {
	bytes, _ := json.Marshal(params)

	rawParams := json.RawMessage(bytes)

	return &RepositoryRule{
		Type:       "commit_message_pattern",
		Parameters: &rawParams,
	}
}

// NewCommitAuthorEmailPatternRule creates a rule to restrict commits with author email patterns being merged into matching branches.
func NewCommitAuthorEmailPatternRule(params *RulePatternParameters) (rule *RepositoryRule) {
	bytes, _ := json.Marshal(params)

	rawParams := json.RawMessage(bytes)

	return &RepositoryRule{
		Type:       "commit_author_email_pattern",
		Parameters: &rawParams,
	}
}

// NewCommitterEmailPatternRule creates a rule to restrict commits with committer email patterns being merged into matching branches.
func NewCommitterEmailPatternRule(params *RulePatternParameters) (rule *RepositoryRule) {
	bytes, _ := json.Marshal(params)

	rawParams := json.RawMessage(bytes)

	return &RepositoryRule{
		Type:       "committer_email_pattern",
		Parameters: &rawParams,
	}
}

// NewBranchNamePatternRule creates a rule to restrict branch patterns from being merged into matching branches.
func NewBranchNamePatternRule(params *RulePatternParameters) (rule *RepositoryRule) {
	bytes, _ := json.Marshal(params)

	rawParams := json.RawMessage(bytes)

	return &RepositoryRule{
		Type:       "branch_name_pattern",
		Parameters: &rawParams,
	}
}

// NewTagNamePatternRule creates a rule to restrict tag patterns contained in non-target branches from being merged into matching branches.
func NewTagNamePatternRule(params *RulePatternParameters) (rule *RepositoryRule) {
	bytes, _ := json.Marshal(params)

	rawParams := json.RawMessage(bytes)

	return &RepositoryRule{
		Type:       "tag_name_pattern",
		Parameters: &rawParams,
	}
}

// NewRequiredWorkflowsRule creates a rule to require which status checks must pass before branches can be merged into a branch rule.
func NewRequiredWorkflowsRule(params *RequiredWorkflowsRuleParameters) (rule *RepositoryRule) {
	bytes, _ := json.Marshal(params)

	rawParams := json.RawMessage(bytes)

	return &RepositoryRule{
		Type:       "workflows",
		Parameters: &rawParams,
	}
}

// NewFilePathRestrictionRule creates a rule to restrict file paths from being pushed to.
func NewFilePathRestrictionRule(params *RuleFileParameters) (rule *RepositoryRule) {
	bytes, _ := json.Marshal(params)

	rawParams := json.RawMessage(bytes)

	return &RepositoryRule{
		Type:       "file_path_restriction",
		Parameters: &rawParams,
	}
}

// Ruleset represents a GitHub ruleset object.
type Ruleset struct {
	ID   *int64 `json:"id,omitempty"`
	Name string `json:"name"`
	// Possible values for Target are branch, tag
	Target *string `json:"target,omitempty"`
	// Possible values for SourceType are: Repository, Organization
	SourceType *string `json:"source_type,omitempty"`
	Source     string  `json:"source"`
	// Possible values for Enforcement are: disabled, active, evaluate
	Enforcement  string             `json:"enforcement"`
	BypassActors []*BypassActor     `json:"bypass_actors,omitempty"`
	NodeID       *string            `json:"node_id,omitempty"`
	Links        *RulesetLinks      `json:"_links,omitempty"`
	Conditions   *RulesetConditions `json:"conditions,omitempty"`
	Rules        []*RepositoryRule  `json:"rules,omitempty"`
}

// rulesetNoOmitBypassActors represents a GitHub ruleset object. The struct does not omit bypassActors if the field is nil or an empty array is passed.
type rulesetNoOmitBypassActors struct {
	ID   *int64 `json:"id,omitempty"`
	Name string `json:"name"`
	// Possible values for Target are branch, tag
	Target *string `json:"target,omitempty"`
	// Possible values for SourceType are: Repository, Organization
	SourceType *string `json:"source_type,omitempty"`
	Source     string  `json:"source"`
	// Possible values for Enforcement are: disabled, active, evaluate
	Enforcement  string             `json:"enforcement"`
	BypassActors []*BypassActor     `json:"bypass_actors"`
	NodeID       *string            `json:"node_id,omitempty"`
	Links        *RulesetLinks      `json:"_links,omitempty"`
	Conditions   *RulesetConditions `json:"conditions,omitempty"`
	Rules        []*RepositoryRule  `json:"rules,omitempty"`
}

// GetRulesForBranch gets all the rules that apply to the specified branch.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#get-rules-for-a-branch
//
//meta:operation GET /repos/{owner}/{repo}/rules/branches/{branch}
func (s *RepositoriesService) GetRulesForBranch(ctx context.Context, owner, repo, branch string) ([]*RepositoryRule, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rules/branches/%v", owner, repo, branch)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var rules []*RepositoryRule
	resp, err := s.client.Do(ctx, req, &rules)
	if err != nil {
		return nil, resp, err
	}

	return rules, resp, nil
}

// GetAllRulesets gets all the rules that apply to the specified repository.
// If includesParents is true, rulesets configured at the organization level that apply to the repository will be returned.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#get-all-repository-rulesets
//
//meta:operation GET /repos/{owner}/{repo}/rulesets
func (s *RepositoriesService) GetAllRulesets(ctx context.Context, owner, repo string, includesParents bool) ([]*Ruleset, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rulesets?includes_parents=%v", owner, repo, includesParents)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var ruleset []*Ruleset
	resp, err := s.client.Do(ctx, req, &ruleset)
	if err != nil {
		return nil, resp, err
	}

	return ruleset, resp, nil
}

// CreateRuleset creates a ruleset for the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#create-a-repository-ruleset
//
//meta:operation POST /repos/{owner}/{repo}/rulesets
func (s *RepositoriesService) CreateRuleset(ctx context.Context, owner, repo string, rs *Ruleset) (*Ruleset, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rulesets", owner, repo)

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

// GetRuleset gets a ruleset for the specified repository.
// If includesParents is true, rulesets configured at the organization level that apply to the repository will be returned.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#get-a-repository-ruleset
//
//meta:operation GET /repos/{owner}/{repo}/rulesets/{ruleset_id}
func (s *RepositoriesService) GetRuleset(ctx context.Context, owner, repo string, rulesetID int64, includesParents bool) (*Ruleset, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rulesets/%v?includes_parents=%v", owner, repo, rulesetID, includesParents)

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

// UpdateRuleset updates a ruleset for the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#update-a-repository-ruleset
//
//meta:operation PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}
func (s *RepositoriesService) UpdateRuleset(ctx context.Context, owner, repo string, rulesetID int64, rs *Ruleset) (*Ruleset, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rulesets/%v", owner, repo, rulesetID)

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

// UpdateRulesetNoBypassActor updates a ruleset for the specified repository.
//
// This function is necessary as the UpdateRuleset function does not marshal ByPassActor if passed as nil or an empty array.
//
// GitHub API docs: https://docs.github.com/rest/repos/rules#update-a-repository-ruleset
//
//meta:operation PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}
func (s *RepositoriesService) UpdateRulesetNoBypassActor(ctx context.Context, owner, repo string, rulesetID int64, rs *Ruleset) (*Ruleset, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/rulesets/%v", owner, repo, rulesetID)

	rsNoBypassActor := &rulesetNoOmitBypassActors{}

	if rs != nil {
		rsNoBypassActor = &rulesetNoOmitBypassActors{
			ID:           rs.ID,
			Name:         rs.Name,
			Target:       rs.Target,
			SourceType:   rs.SourceType,
			Source:       rs.Source,
			Enforcement:  rs.Enforcement,
			BypassActors: rs.BypassActors,
			NodeID:       rs.NodeID,
			Links:        rs.Links,
			Conditions:   rs.Conditions,
			Rules:        rs.Rules,
		}
	}

	req, err := s.client.NewRequest("PUT", u, rsNoBypassActor)
	if err != nil {
		return nil, nil, err
	}

	var ruleSet *Ruleset
	resp, err := s.client.Do(ctx, req, &ruleSet)
	if err != nil {
		return nil, resp, err
	}

	return ruleSet, resp, nil
}

// DeleteRuleset deletes a ruleset for the specified repository.
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
