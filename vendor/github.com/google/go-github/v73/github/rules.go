// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"encoding/json"
	"reflect"
)

// RulesetTarget represents a GitHub ruleset target.
type RulesetTarget string

// This is the set of GitHub ruleset targets.
const (
	RulesetTargetBranch RulesetTarget = "branch"
	RulesetTargetTag    RulesetTarget = "tag"
	RulesetTargetPush   RulesetTarget = "push"
)

// RulesetSourceType represents a GitHub ruleset source type.
type RulesetSourceType string

// This is the set of GitHub ruleset source types.
const (
	RulesetSourceTypeRepository   RulesetSourceType = "Repository"
	RulesetSourceTypeOrganization RulesetSourceType = "Organization"
	RulesetSourceTypeEnterprise   RulesetSourceType = "Enterprise"
)

// RulesetEnforcement represents a GitHub ruleset enforcement.
type RulesetEnforcement string

// This is the set of GitHub ruleset enforcements.
const (
	RulesetEnforcementDisabled RulesetEnforcement = "disabled"
	RulesetEnforcementActive   RulesetEnforcement = "active"
	RulesetEnforcementEvaluate RulesetEnforcement = "evaluate"
)

// BypassActorType represents a GitHub ruleset bypass actor type.
type BypassActorType string

// This is the set of GitHub ruleset bypass actor types.
const (
	BypassActorTypeIntegration       BypassActorType = "Integration"
	BypassActorTypeOrganizationAdmin BypassActorType = "OrganizationAdmin"
	BypassActorTypeRepositoryRole    BypassActorType = "RepositoryRole"
	BypassActorTypeTeam              BypassActorType = "Team"
	BypassActorTypeDeployKey         BypassActorType = "DeployKey"
)

// BypassMode represents a GitHub ruleset bypass mode.
type BypassMode string

// This is the set of GitHub ruleset bypass modes.
const (
	BypassModeAlways      BypassMode = "always"
	BypassModePullRequest BypassMode = "pull_request"
	BypassModeNever       BypassMode = "never"
)

// RepositoryRuleType represents a GitHub ruleset rule type.
type RepositoryRuleType string

// This is the set of GitHub ruleset rule types.
const (
	RulesetRuleTypeCreation                 RepositoryRuleType = "creation"
	RulesetRuleTypeUpdate                   RepositoryRuleType = "update"
	RulesetRuleTypeDeletion                 RepositoryRuleType = "deletion"
	RulesetRuleTypeRequiredLinearHistory    RepositoryRuleType = "required_linear_history"
	RulesetRuleTypeMergeQueue               RepositoryRuleType = "merge_queue"
	RulesetRuleTypeRequiredDeployments      RepositoryRuleType = "required_deployments"
	RulesetRuleTypeRequiredSignatures       RepositoryRuleType = "required_signatures"
	RulesetRuleTypePullRequest              RepositoryRuleType = "pull_request"
	RulesetRuleTypeRequiredStatusChecks     RepositoryRuleType = "required_status_checks"
	RulesetRuleTypeNonFastForward           RepositoryRuleType = "non_fast_forward"
	RulesetRuleTypeCommitMessagePattern     RepositoryRuleType = "commit_message_pattern"
	RulesetRuleTypeCommitAuthorEmailPattern RepositoryRuleType = "commit_author_email_pattern"
	RulesetRuleTypeCommitterEmailPattern    RepositoryRuleType = "committer_email_pattern"
	RulesetRuleTypeBranchNamePattern        RepositoryRuleType = "branch_name_pattern"
	RulesetRuleTypeTagNamePattern           RepositoryRuleType = "tag_name_pattern"
	RulesetRuleTypeFilePathRestriction      RepositoryRuleType = "file_path_restriction"
	RulesetRuleTypeMaxFilePathLength        RepositoryRuleType = "max_file_path_length"
	RulesetRuleTypeFileExtensionRestriction RepositoryRuleType = "file_extension_restriction"
	RulesetRuleTypeMaxFileSize              RepositoryRuleType = "max_file_size"
	RulesetRuleTypeWorkflows                RepositoryRuleType = "workflows"
	RulesetRuleTypeCodeScanning             RepositoryRuleType = "code_scanning"
)

// MergeGroupingStrategy models a GitHub merge grouping strategy.
type MergeGroupingStrategy string

// This is the set of GitHub merge grouping strategies.
const (
	MergeGroupingStrategyAllGreen  MergeGroupingStrategy = "ALLGREEN"
	MergeGroupingStrategyHeadGreen MergeGroupingStrategy = "HEADGREEN"
)

// PullRequestMergeMethod is used in PullRequestRuleParameters,
// where the GitHub API expects lowercase merge method values: "merge", "rebase", "squash".
//
// NOTE: GitHub's API inconsistently uses different casing for the same logical values
// across different rules.
//
// TODO: Unify with MergeQueueMergeMethod once the GitHub API uses consistent casing.
type PullRequestMergeMethod string

const (
	PullRequestMergeMethodMerge  PullRequestMergeMethod = "merge"
	PullRequestMergeMethodRebase PullRequestMergeMethod = "rebase"
	PullRequestMergeMethodSquash PullRequestMergeMethod = "squash"
)

// MergeQueueMergeMethod is used in MergeQueueRuleParameters,
// where the GitHub API expects uppercase merge method values: "MERGE", "REBASE", "SQUASH".
//
// NOTE: This type exists alongside PullRequestMergeMethod solely due to API casing inconsistencies.
// It enforces the correct usage by API context.
//
// TODO: Unify with PullRequestMergeMethod once the GitHub API uses consistent casing.
type MergeQueueMergeMethod string

const (
	MergeQueueMergeMethodMerge  MergeQueueMergeMethod = "MERGE"
	MergeQueueMergeMethodRebase MergeQueueMergeMethod = "REBASE"
	MergeQueueMergeMethodSquash MergeQueueMergeMethod = "SQUASH"
)

// PatternRuleOperator models a GitHub pattern rule operator.
type PatternRuleOperator string

// This is the set of GitHub pattern rule operators.
const (
	PatternRuleOperatorStartsWith PatternRuleOperator = "starts_with"
	PatternRuleOperatorEndsWith   PatternRuleOperator = "ends_with"
	PatternRuleOperatorContains   PatternRuleOperator = "contains"
	PatternRuleOperatorRegex      PatternRuleOperator = "regex"
)

// CodeScanningAlertsThreshold models a GitHub code scanning alerts threshold.
type CodeScanningAlertsThreshold string

// This is the set of GitHub code scanning alerts thresholds.
const (
	CodeScanningAlertsThresholdNone              CodeScanningAlertsThreshold = "none"
	CodeScanningAlertsThresholdErrors            CodeScanningAlertsThreshold = "errors"
	CodeScanningAlertsThresholdErrorsAndWarnings CodeScanningAlertsThreshold = "errors_and_warnings"
	CodeScanningAlertsThresholdAll               CodeScanningAlertsThreshold = "all"
)

// CodeScanningSecurityAlertsThreshold models a GitHub code scanning security alerts threshold.
type CodeScanningSecurityAlertsThreshold string

// This is the set of GitHub code scanning security alerts thresholds.
const (
	CodeScanningSecurityAlertsThresholdNone           CodeScanningSecurityAlertsThreshold = "none"
	CodeScanningSecurityAlertsThresholdCritical       CodeScanningSecurityAlertsThreshold = "critical"
	CodeScanningSecurityAlertsThresholdHighOrHigher   CodeScanningSecurityAlertsThreshold = "high_or_higher"
	CodeScanningSecurityAlertsThresholdMediumOrHigher CodeScanningSecurityAlertsThreshold = "medium_or_higher"
	CodeScanningSecurityAlertsThresholdAll            CodeScanningSecurityAlertsThreshold = "all"
)

// RepositoryRuleset represents a GitHub ruleset object.
type RepositoryRuleset struct {
	ID                   *int64                       `json:"id,omitempty"`
	Name                 string                       `json:"name"`
	Target               *RulesetTarget               `json:"target,omitempty"`
	SourceType           *RulesetSourceType           `json:"source_type,omitempty"`
	Source               string                       `json:"source"`
	Enforcement          RulesetEnforcement           `json:"enforcement"`
	BypassActors         []*BypassActor               `json:"bypass_actors,omitempty"`
	CurrentUserCanBypass *BypassMode                  `json:"current_user_can_bypass,omitempty"`
	NodeID               *string                      `json:"node_id,omitempty"`
	Links                *RepositoryRulesetLinks      `json:"_links,omitempty"`
	Conditions           *RepositoryRulesetConditions `json:"conditions,omitempty"`
	Rules                *RepositoryRulesetRules      `json:"rules,omitempty"`
	UpdatedAt            *Timestamp                   `json:"updated_at,omitempty"`
	CreatedAt            *Timestamp                   `json:"created_at,omitempty"`
}

// BypassActor represents the bypass actors from a ruleset.
type BypassActor struct {
	ActorID    *int64           `json:"actor_id,omitempty"`
	ActorType  *BypassActorType `json:"actor_type,omitempty"`
	BypassMode *BypassMode      `json:"bypass_mode,omitempty"`
}

// RepositoryRulesetLinks represents the "_links" object in a Ruleset.
type RepositoryRulesetLinks struct {
	Self *RepositoryRulesetLink `json:"self,omitempty"`
	HTML *RepositoryRulesetLink `json:"html,omitempty"`
}

// RepositoryRulesetLink represents a single link object from GitHub ruleset request _links.
type RepositoryRulesetLink struct {
	HRef *string `json:"href,omitempty"`
}

// RepositoryRulesetConditions represents the conditions object in a ruleset.
// Set either RepositoryName or RepositoryID or RepositoryProperty, not more than one.
type RepositoryRulesetConditions struct {
	RefName            *RepositoryRulesetRefConditionParameters                `json:"ref_name,omitempty"`
	RepositoryID       *RepositoryRulesetRepositoryIDsConditionParameters      `json:"repository_id,omitempty"`
	RepositoryName     *RepositoryRulesetRepositoryNamesConditionParameters    `json:"repository_name,omitempty"`
	RepositoryProperty *RepositoryRulesetRepositoryPropertyConditionParameters `json:"repository_property,omitempty"`
	OrganizationID     *RepositoryRulesetOrganizationIDsConditionParameters    `json:"organization_id,omitempty"`
	OrganizationName   *RepositoryRulesetOrganizationNamesConditionParameters  `json:"organization_name,omitempty"`
}

// RepositoryRulesetRefConditionParameters represents the conditions object for ref_names.
type RepositoryRulesetRefConditionParameters struct {
	Include []string `json:"include"`
	Exclude []string `json:"exclude"`
}

// RepositoryRulesetRepositoryIDsConditionParameters represents the conditions object for repository_id.
type RepositoryRulesetRepositoryIDsConditionParameters struct {
	RepositoryIDs []int64 `json:"repository_ids,omitempty"`
}

// RepositoryRulesetRepositoryNamesConditionParameters represents the conditions object for repository_name.
type RepositoryRulesetRepositoryNamesConditionParameters struct {
	Include   []string `json:"include"`
	Exclude   []string `json:"exclude"`
	Protected *bool    `json:"protected,omitempty"`
}

// RepositoryRulesetRepositoryPropertyConditionParameters represents the conditions object for repository_property.
type RepositoryRulesetRepositoryPropertyConditionParameters struct {
	Include []*RepositoryRulesetRepositoryPropertyTargetParameters `json:"include"`
	Exclude []*RepositoryRulesetRepositoryPropertyTargetParameters `json:"exclude"`
}

// RepositoryRulesetRepositoryPropertyTargetParameters represents a repository_property name and values to be used for targeting.
type RepositoryRulesetRepositoryPropertyTargetParameters struct {
	Name           string   `json:"name"`
	PropertyValues []string `json:"property_values"`
	Source         *string  `json:"source,omitempty"`
}

// RepositoryRulesetOrganizationIDsConditionParameters represents the conditions object for organization_id.
type RepositoryRulesetOrganizationIDsConditionParameters struct {
	OrganizationIDs []int64 `json:"organization_ids,omitempty"`
}

// RepositoryRulesetOrganizationNamesConditionParameters represents the conditions object for organization_name.
type RepositoryRulesetOrganizationNamesConditionParameters struct {
	Include []string `json:"include"`
	Exclude []string `json:"exclude"`
}

// RepositoryRule represents a GitHub ruleset rule object.
type RepositoryRule struct {
	Type       RepositoryRuleType `json:"type"`
	Parameters any                `json:"parameters,omitempty"`
}

// RepositoryRulesetRules represents a GitHub ruleset rules object.
// This type doesn't have JSON annotations as it uses custom marshaling.
type RepositoryRulesetRules struct {
	Creation                 *EmptyRuleParameters
	Update                   *UpdateRuleParameters
	Deletion                 *EmptyRuleParameters
	RequiredLinearHistory    *EmptyRuleParameters
	MergeQueue               *MergeQueueRuleParameters
	RequiredDeployments      *RequiredDeploymentsRuleParameters
	RequiredSignatures       *EmptyRuleParameters
	PullRequest              *PullRequestRuleParameters
	RequiredStatusChecks     *RequiredStatusChecksRuleParameters
	NonFastForward           *EmptyRuleParameters
	CommitMessagePattern     *PatternRuleParameters
	CommitAuthorEmailPattern *PatternRuleParameters
	CommitterEmailPattern    *PatternRuleParameters
	BranchNamePattern        *PatternRuleParameters
	TagNamePattern           *PatternRuleParameters
	FilePathRestriction      *FilePathRestrictionRuleParameters
	MaxFilePathLength        *MaxFilePathLengthRuleParameters
	FileExtensionRestriction *FileExtensionRestrictionRuleParameters
	MaxFileSize              *MaxFileSizeRuleParameters
	Workflows                *WorkflowsRuleParameters
	CodeScanning             *CodeScanningRuleParameters
}

// BranchRules represents the rules active for a GitHub repository branch.
// This type doesn't have JSON annotations as it uses custom marshaling.
type BranchRules struct {
	Creation                 []*BranchRuleMetadata
	Update                   []*UpdateBranchRule
	Deletion                 []*BranchRuleMetadata
	RequiredLinearHistory    []*BranchRuleMetadata
	MergeQueue               []*MergeQueueBranchRule
	RequiredDeployments      []*RequiredDeploymentsBranchRule
	RequiredSignatures       []*BranchRuleMetadata
	PullRequest              []*PullRequestBranchRule
	RequiredStatusChecks     []*RequiredStatusChecksBranchRule
	NonFastForward           []*BranchRuleMetadata
	CommitMessagePattern     []*PatternBranchRule
	CommitAuthorEmailPattern []*PatternBranchRule
	CommitterEmailPattern    []*PatternBranchRule
	BranchNamePattern        []*PatternBranchRule
	TagNamePattern           []*PatternBranchRule
	FilePathRestriction      []*FilePathRestrictionBranchRule
	MaxFilePathLength        []*MaxFilePathLengthBranchRule
	FileExtensionRestriction []*FileExtensionRestrictionBranchRule
	MaxFileSize              []*MaxFileSizeBranchRule
	Workflows                []*WorkflowsBranchRule
	CodeScanning             []*CodeScanningBranchRule
}

// BranchRuleMetadata represents the metadata for a branch rule.
type BranchRuleMetadata struct {
	RulesetSourceType RulesetSourceType `json:"ruleset_source_type"`
	RulesetSource     string            `json:"ruleset_source"`
	RulesetID         int64             `json:"ruleset_id"`
}

// UpdateBranchRule represents an update branch rule.
type UpdateBranchRule struct {
	BranchRuleMetadata
	Parameters UpdateRuleParameters `json:"parameters"`
}

// MergeQueueBranchRule represents a merge queue branch rule.
type MergeQueueBranchRule struct {
	BranchRuleMetadata
	Parameters MergeQueueRuleParameters `json:"parameters"`
}

// RequiredDeploymentsBranchRule represents a required deployments branch rule.
type RequiredDeploymentsBranchRule struct {
	BranchRuleMetadata
	Parameters RequiredDeploymentsRuleParameters `json:"parameters"`
}

// PullRequestBranchRule represents a pull request branch rule.
type PullRequestBranchRule struct {
	BranchRuleMetadata
	Parameters PullRequestRuleParameters `json:"parameters"`
}

// RequiredStatusChecksBranchRule represents a required status checks branch rule.
type RequiredStatusChecksBranchRule struct {
	BranchRuleMetadata
	Parameters RequiredStatusChecksRuleParameters `json:"parameters"`
}

// PatternBranchRule represents a pattern branch rule.
type PatternBranchRule struct {
	BranchRuleMetadata
	Parameters PatternRuleParameters `json:"parameters"`
}

// FilePathRestrictionBranchRule represents a file path restriction branch rule.
type FilePathRestrictionBranchRule struct {
	BranchRuleMetadata
	Parameters FilePathRestrictionRuleParameters `json:"parameters"`
}

// MaxFilePathLengthBranchRule represents a max file path length branch rule.
type MaxFilePathLengthBranchRule struct {
	BranchRuleMetadata
	Parameters MaxFilePathLengthRuleParameters `json:"parameters"`
}

// FileExtensionRestrictionBranchRule represents a file extension restriction branch rule.
type FileExtensionRestrictionBranchRule struct {
	BranchRuleMetadata
	Parameters FileExtensionRestrictionRuleParameters `json:"parameters"`
}

// MaxFileSizeBranchRule represents a max file size branch rule.
type MaxFileSizeBranchRule struct {
	BranchRuleMetadata
	Parameters MaxFileSizeRuleParameters `json:"parameters"`
}

// WorkflowsBranchRule represents a workflows branch rule.
type WorkflowsBranchRule struct {
	BranchRuleMetadata
	Parameters WorkflowsRuleParameters `json:"parameters"`
}

// CodeScanningBranchRule represents a code scanning branch rule.
type CodeScanningBranchRule struct {
	BranchRuleMetadata
	Parameters CodeScanningRuleParameters `json:"parameters"`
}

// EmptyRuleParameters represents the parameters for a rule with no options.
type EmptyRuleParameters struct{}

// UpdateRuleParameters represents the update rule parameters.
type UpdateRuleParameters struct {
	UpdateAllowsFetchAndMerge bool `json:"update_allows_fetch_and_merge,omitempty"`
}

// MergeQueueRuleParameters represents the merge_queue rule parameters.
type MergeQueueRuleParameters struct {
	CheckResponseTimeoutMinutes  int                   `json:"check_response_timeout_minutes"`
	GroupingStrategy             MergeGroupingStrategy `json:"grouping_strategy"`
	MaxEntriesToBuild            int                   `json:"max_entries_to_build"`
	MaxEntriesToMerge            int                   `json:"max_entries_to_merge"`
	MergeMethod                  MergeQueueMergeMethod `json:"merge_method"`
	MinEntriesToMerge            int                   `json:"min_entries_to_merge"`
	MinEntriesToMergeWaitMinutes int                   `json:"min_entries_to_merge_wait_minutes"`
}

// RequiredDeploymentsRuleParameters represents the required deployments rule parameters.
type RequiredDeploymentsRuleParameters struct {
	RequiredDeploymentEnvironments []string `json:"required_deployment_environments"`
}

// PullRequestRuleParameters represents the pull_request rule parameters.
type PullRequestRuleParameters struct {
	AllowedMergeMethods               []PullRequestMergeMethod `json:"allowed_merge_methods"`
	AutomaticCopilotCodeReviewEnabled *bool                    `json:"automatic_copilot_code_review_enabled,omitempty"`
	DismissStaleReviewsOnPush         bool                     `json:"dismiss_stale_reviews_on_push"`
	RequireCodeOwnerReview            bool                     `json:"require_code_owner_review"`
	RequireLastPushApproval           bool                     `json:"require_last_push_approval"`
	RequiredApprovingReviewCount      int                      `json:"required_approving_review_count"`
	RequiredReviewThreadResolution    bool                     `json:"required_review_thread_resolution"`
}

// RequiredStatusChecksRuleParameters represents the required status checks rule parameters.
type RequiredStatusChecksRuleParameters struct {
	DoNotEnforceOnCreate             *bool              `json:"do_not_enforce_on_create,omitempty"`
	RequiredStatusChecks             []*RuleStatusCheck `json:"required_status_checks"`
	StrictRequiredStatusChecksPolicy bool               `json:"strict_required_status_checks_policy"`
}

// RuleStatusCheck represents a status checks for the required status checks rule parameters.
type RuleStatusCheck struct {
	Context       string `json:"context"`
	IntegrationID *int64 `json:"integration_id,omitempty"`
}

// PatternRuleParameters represents the parameters for a pattern rule.
type PatternRuleParameters struct {
	Name *string `json:"name,omitempty"`
	// If Negate is true, the rule will fail if the pattern matches.
	Negate   *bool               `json:"negate,omitempty"`
	Operator PatternRuleOperator `json:"operator"`
	Pattern  string              `json:"pattern"`
}

// FilePathRestrictionRuleParameters represents the file path restriction rule parameters.
type FilePathRestrictionRuleParameters struct {
	RestrictedFilePaths []string `json:"restricted_file_paths"`
}

// MaxFilePathLengthRuleParameters represents the max file path length rule parameters.
type MaxFilePathLengthRuleParameters struct {
	MaxFilePathLength int `json:"max_file_path_length"`
}

// FileExtensionRestrictionRuleParameters represents the file extension restriction rule parameters.
type FileExtensionRestrictionRuleParameters struct {
	RestrictedFileExtensions []string `json:"restricted_file_extensions"`
}

// MaxFileSizeRuleParameters represents the max file size rule parameters.
type MaxFileSizeRuleParameters struct {
	MaxFileSize int64 `json:"max_file_size"`
}

// WorkflowsRuleParameters represents the workflows rule parameters.
type WorkflowsRuleParameters struct {
	DoNotEnforceOnCreate *bool           `json:"do_not_enforce_on_create,omitempty"`
	Workflows            []*RuleWorkflow `json:"workflows"`
}

// RuleWorkflow represents a Workflow for the workflows rule parameters.
type RuleWorkflow struct {
	Path         string  `json:"path"`
	Ref          *string `json:"ref,omitempty"`
	RepositoryID *int64  `json:"repository_id,omitempty"`
	SHA          *string `json:"sha,omitempty"`
}

// CodeScanningRuleParameters represents the code scanning rule parameters.
type CodeScanningRuleParameters struct {
	CodeScanningTools []*RuleCodeScanningTool `json:"code_scanning_tools"`
}

// RuleCodeScanningTool represents a single code scanning tool for the code scanning parameters.
type RuleCodeScanningTool struct {
	AlertsThreshold         CodeScanningAlertsThreshold         `json:"alerts_threshold"`
	SecurityAlertsThreshold CodeScanningSecurityAlertsThreshold `json:"security_alerts_threshold"`
	Tool                    string                              `json:"tool"`
}

// repositoryRulesetRuleWrapper is a helper type to marshal & unmarshal a ruleset rule.
type repositoryRulesetRuleWrapper struct {
	Type       RepositoryRuleType `json:"type"`
	Parameters json.RawMessage    `json:"parameters,omitempty"`
}

// MarshalJSON is a custom JSON marshaler for RulesetRules.
func (r *RepositoryRulesetRules) MarshalJSON() ([]byte, error) {
	// The RepositoryRulesetRules type marshals to between 1 and 21 rules.
	// If new rules are added to RepositoryRulesetRules the capacity below needs increasing
	rawRules := make([]json.RawMessage, 0, 21)

	if r.Creation != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeCreation, r.Creation)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.Update != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeUpdate, r.Update)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.Deletion != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeDeletion, r.Deletion)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.RequiredLinearHistory != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeRequiredLinearHistory, r.RequiredLinearHistory)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.MergeQueue != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeMergeQueue, r.MergeQueue)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.RequiredDeployments != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeRequiredDeployments, r.RequiredDeployments)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.RequiredSignatures != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeRequiredSignatures, r.RequiredSignatures)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.PullRequest != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypePullRequest, r.PullRequest)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.RequiredStatusChecks != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeRequiredStatusChecks, r.RequiredStatusChecks)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.NonFastForward != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeNonFastForward, r.NonFastForward)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.CommitMessagePattern != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeCommitMessagePattern, r.CommitMessagePattern)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.CommitAuthorEmailPattern != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeCommitAuthorEmailPattern, r.CommitAuthorEmailPattern)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.CommitterEmailPattern != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeCommitterEmailPattern, r.CommitterEmailPattern)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.BranchNamePattern != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeBranchNamePattern, r.BranchNamePattern)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.TagNamePattern != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeTagNamePattern, r.TagNamePattern)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.FilePathRestriction != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeFilePathRestriction, r.FilePathRestriction)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.MaxFilePathLength != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeMaxFilePathLength, r.MaxFilePathLength)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.FileExtensionRestriction != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeFileExtensionRestriction, r.FileExtensionRestriction)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.MaxFileSize != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeMaxFileSize, r.MaxFileSize)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.Workflows != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeWorkflows, r.Workflows)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	if r.CodeScanning != nil {
		bytes, err := marshalRepositoryRulesetRule(RulesetRuleTypeCodeScanning, r.CodeScanning)
		if err != nil {
			return nil, err
		}
		rawRules = append(rawRules, json.RawMessage(bytes))
	}

	return json.Marshal(rawRules)
}

// marshalRepositoryRulesetRule is a helper function to marshal a ruleset rule.
//
// TODO: Benchmark the code that uses reflection.
// TODO: Use a generator here instead of reflection if there is a significant performance hit.
func marshalRepositoryRulesetRule[T any](t RepositoryRuleType, params T) ([]byte, error) {
	paramsType := reflect.TypeFor[T]()

	if paramsType.Kind() == reflect.Pointer && (reflect.ValueOf(params).IsNil() || reflect.ValueOf(params).Elem().IsZero()) {
		return json.Marshal(repositoryRulesetRuleWrapper{Type: t})
	}

	bytes, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}

	return json.Marshal(repositoryRulesetRuleWrapper{Type: t, Parameters: json.RawMessage(bytes)})
}

// UnmarshalJSON is a custom JSON unmarshaler for RulesetRules.
func (r *RepositoryRulesetRules) UnmarshalJSON(data []byte) error {
	var wrappers []*repositoryRulesetRuleWrapper

	if err := json.Unmarshal(data, &wrappers); err != nil {
		return err
	}

	for _, w := range wrappers {
		switch w.Type {
		case RulesetRuleTypeCreation:
			r.Creation = &EmptyRuleParameters{}
		case RulesetRuleTypeUpdate:
			r.Update = &UpdateRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.Update); err != nil {
					return err
				}
			}
		case RulesetRuleTypeDeletion:
			r.Deletion = &EmptyRuleParameters{}
		case RulesetRuleTypeRequiredLinearHistory:
			r.RequiredLinearHistory = &EmptyRuleParameters{}
		case RulesetRuleTypeMergeQueue:
			r.MergeQueue = &MergeQueueRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.MergeQueue); err != nil {
					return err
				}
			}
		case RulesetRuleTypeRequiredDeployments:
			r.RequiredDeployments = &RequiredDeploymentsRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.RequiredDeployments); err != nil {
					return err
				}
			}
		case RulesetRuleTypeRequiredSignatures:
			r.RequiredSignatures = &EmptyRuleParameters{}
		case RulesetRuleTypePullRequest:
			r.PullRequest = &PullRequestRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.PullRequest); err != nil {
					return err
				}
			}
		case RulesetRuleTypeRequiredStatusChecks:
			r.RequiredStatusChecks = &RequiredStatusChecksRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.RequiredStatusChecks); err != nil {
					return err
				}
			}
		case RulesetRuleTypeNonFastForward:
			r.NonFastForward = &EmptyRuleParameters{}
		case RulesetRuleTypeCommitMessagePattern:
			r.CommitMessagePattern = &PatternRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.CommitMessagePattern); err != nil {
					return err
				}
			}
		case RulesetRuleTypeCommitAuthorEmailPattern:
			r.CommitAuthorEmailPattern = &PatternRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.CommitAuthorEmailPattern); err != nil {
					return err
				}
			}
		case RulesetRuleTypeCommitterEmailPattern:
			r.CommitterEmailPattern = &PatternRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.CommitterEmailPattern); err != nil {
					return err
				}
			}
		case RulesetRuleTypeBranchNamePattern:
			r.BranchNamePattern = &PatternRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.BranchNamePattern); err != nil {
					return err
				}
			}
		case RulesetRuleTypeTagNamePattern:
			r.TagNamePattern = &PatternRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.TagNamePattern); err != nil {
					return err
				}
			}
		case RulesetRuleTypeFilePathRestriction:
			r.FilePathRestriction = &FilePathRestrictionRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.FilePathRestriction); err != nil {
					return err
				}
			}
		case RulesetRuleTypeMaxFilePathLength:
			r.MaxFilePathLength = &MaxFilePathLengthRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.MaxFilePathLength); err != nil {
					return err
				}
			}
		case RulesetRuleTypeFileExtensionRestriction:
			r.FileExtensionRestriction = &FileExtensionRestrictionRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.FileExtensionRestriction); err != nil {
					return err
				}
			}
		case RulesetRuleTypeMaxFileSize:
			r.MaxFileSize = &MaxFileSizeRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.MaxFileSize); err != nil {
					return err
				}
			}
		case RulesetRuleTypeWorkflows:
			r.Workflows = &WorkflowsRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.Workflows); err != nil {
					return err
				}
			}
		case RulesetRuleTypeCodeScanning:
			r.CodeScanning = &CodeScanningRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, r.CodeScanning); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

// branchRuleWrapper is a helper type to unmarshal a branch rule.
type branchRuleWrapper struct {
	Type RepositoryRuleType `json:"type"`
	BranchRuleMetadata
	Parameters json.RawMessage `json:"parameters,omitempty"`
}

// UnmarshalJSON is a custom JSON unmarshaler for BranchRules.
func (r *BranchRules) UnmarshalJSON(data []byte) error {
	var wrappers []*branchRuleWrapper

	if err := json.Unmarshal(data, &wrappers); err != nil {
		return err
	}

	for _, w := range wrappers {
		switch w.Type {
		case RulesetRuleTypeCreation:
			r.Creation = append(r.Creation, &BranchRuleMetadata{RulesetSourceType: w.RulesetSourceType, RulesetSource: w.RulesetSource, RulesetID: w.RulesetID})
		case RulesetRuleTypeUpdate:
			params := &UpdateRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.Update = append(r.Update, &UpdateBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeDeletion:
			r.Deletion = append(r.Deletion, &BranchRuleMetadata{RulesetSourceType: w.RulesetSourceType, RulesetSource: w.RulesetSource, RulesetID: w.RulesetID})
		case RulesetRuleTypeRequiredLinearHistory:
			r.RequiredLinearHistory = append(r.RequiredLinearHistory, &BranchRuleMetadata{RulesetSourceType: w.RulesetSourceType, RulesetSource: w.RulesetSource, RulesetID: w.RulesetID})
		case RulesetRuleTypeMergeQueue:
			params := &MergeQueueRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.MergeQueue = append(r.MergeQueue, &MergeQueueBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeRequiredDeployments:
			params := &RequiredDeploymentsRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.RequiredDeployments = append(r.RequiredDeployments, &RequiredDeploymentsBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeRequiredSignatures:
			r.RequiredSignatures = append(r.RequiredSignatures, &BranchRuleMetadata{RulesetSourceType: w.RulesetSourceType, RulesetSource: w.RulesetSource, RulesetID: w.RulesetID})
		case RulesetRuleTypePullRequest:
			params := &PullRequestRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.PullRequest = append(r.PullRequest, &PullRequestBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeRequiredStatusChecks:
			params := &RequiredStatusChecksRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.RequiredStatusChecks = append(r.RequiredStatusChecks, &RequiredStatusChecksBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeNonFastForward:
			r.NonFastForward = append(r.NonFastForward, &BranchRuleMetadata{RulesetSourceType: w.RulesetSourceType, RulesetSource: w.RulesetSource, RulesetID: w.RulesetID})
		case RulesetRuleTypeCommitMessagePattern:
			params := &PatternRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.CommitMessagePattern = append(r.CommitMessagePattern, &PatternBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeCommitAuthorEmailPattern:
			params := &PatternRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.CommitAuthorEmailPattern = append(r.CommitAuthorEmailPattern, &PatternBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeCommitterEmailPattern:
			params := &PatternRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.CommitterEmailPattern = append(r.CommitterEmailPattern, &PatternBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeBranchNamePattern:
			params := &PatternRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.BranchNamePattern = append(r.BranchNamePattern, &PatternBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeTagNamePattern:
			params := &PatternRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.TagNamePattern = append(r.TagNamePattern, &PatternBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeFilePathRestriction:
			params := &FilePathRestrictionRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.FilePathRestriction = append(r.FilePathRestriction, &FilePathRestrictionBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeMaxFilePathLength:
			params := &MaxFilePathLengthRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.MaxFilePathLength = append(r.MaxFilePathLength, &MaxFilePathLengthBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeFileExtensionRestriction:
			params := &FileExtensionRestrictionRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.FileExtensionRestriction = append(r.FileExtensionRestriction, &FileExtensionRestrictionBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeMaxFileSize:
			params := &MaxFileSizeRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.MaxFileSize = append(r.MaxFileSize, &MaxFileSizeBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeWorkflows:
			params := &WorkflowsRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.Workflows = append(r.Workflows, &WorkflowsBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		case RulesetRuleTypeCodeScanning:
			params := &CodeScanningRuleParameters{}

			if w.Parameters != nil {
				if err := json.Unmarshal(w.Parameters, params); err != nil {
					return err
				}
			}

			r.CodeScanning = append(r.CodeScanning, &CodeScanningBranchRule{BranchRuleMetadata: w.BranchRuleMetadata, Parameters: *params})
		}
	}

	return nil
}

// UnmarshalJSON is a custom JSON unmarshaler for RulesetRule.
func (r *RepositoryRule) UnmarshalJSON(data []byte) error {
	w := repositoryRulesetRuleWrapper{}

	if err := json.Unmarshal(data, &w); err != nil {
		return err
	}

	r.Type = w.Type

	switch r.Type {
	case RulesetRuleTypeCreation:
		r.Parameters = nil
	case RulesetRuleTypeUpdate:
		p := &UpdateRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeDeletion:
		r.Parameters = nil
	case RulesetRuleTypeRequiredLinearHistory:
		r.Parameters = nil
	case RulesetRuleTypeMergeQueue:
		p := &MergeQueueRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeRequiredDeployments:
		p := &RequiredDeploymentsRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeRequiredSignatures:
		r.Parameters = nil
	case RulesetRuleTypePullRequest:
		p := &PullRequestRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeRequiredStatusChecks:
		p := &RequiredStatusChecksRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeNonFastForward:
		r.Parameters = nil
	case RulesetRuleTypeCommitMessagePattern:
		p := &PatternRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeCommitAuthorEmailPattern:
		p := &PatternRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeCommitterEmailPattern:
		p := &PatternRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeBranchNamePattern:
		p := &PatternRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeTagNamePattern:
		p := &PatternRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeFilePathRestriction:
		p := &FilePathRestrictionRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeMaxFilePathLength:
		p := &MaxFilePathLengthRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeFileExtensionRestriction:
		p := &FileExtensionRestrictionRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeMaxFileSize:
		p := &MaxFileSizeRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeWorkflows:
		p := &WorkflowsRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	case RulesetRuleTypeCodeScanning:
		p := &CodeScanningRuleParameters{}

		if w.Parameters != nil {
			if err := json.Unmarshal(w.Parameters, p); err != nil {
				return err
			}
		}

		r.Parameters = p
	}

	return nil
}
