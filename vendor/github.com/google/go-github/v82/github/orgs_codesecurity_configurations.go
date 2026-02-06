// Copyright 2024 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
	"net/http"
)

// DependencyGraphAutosubmitActionOptions represents the options for the DependencyGraphAutosubmitAction.
type DependencyGraphAutosubmitActionOptions struct {
	LabeledRunners *bool `json:"labeled_runners,omitempty"`
}

// CodeScanningOptions represents the options for the Security Configuration code scanning feature.
type CodeScanningOptions struct {
	AllowAdvanced *bool `json:"allow_advanced,omitempty"`
}

// CodeScanningDefaultSetupOptions represents the feature options for the code scanning default options.
type CodeScanningDefaultSetupOptions struct {
	RunnerType  string  `json:"runner_type"`
	RunnerLabel *string `json:"runner_label,omitempty"`
}

// RepositoryAttachment represents a repository attachment to a code security configuration.
type RepositoryAttachment struct {
	Status     *string     `json:"status"`
	Repository *Repository `json:"repository"`
}

// SecretScanningDelegatedBypassOptions represents the feature options for the secret scanning delegated bypass.
type SecretScanningDelegatedBypassOptions struct {
	Reviewers []*BypassReviewer `json:"reviewers,omitzero"`
}

// BypassReviewer represents the bypass reviewers for the delegated bypass of a code security configuration.
// SecurityConfigurationID is added by GitHub in responses.
type BypassReviewer struct {
	ReviewerID              int64  `json:"reviewer_id"`
	ReviewerType            string `json:"reviewer_type"`
	SecurityConfigurationID *int64 `json:"security_configuration_id,omitempty"`
}

// CodeSecurityConfiguration represents a code security configuration.
type CodeSecurityConfiguration struct {
	ID                                     *int64                                  `json:"id,omitempty"`
	TargetType                             *string                                 `json:"target_type,omitempty"`
	Name                                   string                                  `json:"name"`
	Description                            string                                  `json:"description"`
	AdvancedSecurity                       *string                                 `json:"advanced_security,omitempty"`
	DependencyGraph                        *string                                 `json:"dependency_graph,omitempty"`
	DependencyGraphAutosubmitAction        *string                                 `json:"dependency_graph_autosubmit_action,omitempty"`
	DependencyGraphAutosubmitActionOptions *DependencyGraphAutosubmitActionOptions `json:"dependency_graph_autosubmit_action_options,omitempty"`
	DependabotAlerts                       *string                                 `json:"dependabot_alerts,omitempty"`
	DependabotSecurityUpdates              *string                                 `json:"dependabot_security_updates,omitempty"`
	CodeScanningDefaultSetup               *string                                 `json:"code_scanning_default_setup,omitempty"`
	CodeScanningDefaultSetupOptions        *CodeScanningDefaultSetupOptions        `json:"code_scanning_default_setup_options,omitempty"`
	CodeScanningDelegatedAlertDismissal    *string                                 `json:"code_scanning_delegated_alert_dismissal,omitempty"`
	CodeScanningOptions                    *CodeScanningOptions                    `json:"code_scanning_options,omitempty"`
	CodeSecurity                           *string                                 `json:"code_security,omitempty"`
	SecretScanning                         *string                                 `json:"secret_scanning,omitempty"`
	SecretScanningPushProtection           *string                                 `json:"secret_scanning_push_protection,omitempty"`
	SecretScanningDelegatedBypass          *string                                 `json:"secret_scanning_delegated_bypass,omitempty"`
	SecretScanningDelegatedBypassOptions   *SecretScanningDelegatedBypassOptions   `json:"secret_scanning_delegated_bypass_options,omitempty"`
	SecretScanningValidityChecks           *string                                 `json:"secret_scanning_validity_checks,omitempty"`
	SecretScanningNonProviderPatterns      *string                                 `json:"secret_scanning_non_provider_patterns,omitempty"`
	SecretScanningGenericSecrets           *string                                 `json:"secret_scanning_generic_secrets,omitempty"`
	SecretScanningDelegatedAlertDismissal  *string                                 `json:"secret_scanning_delegated_alert_dismissal,omitempty"`
	SecretProtection                       *string                                 `json:"secret_protection,omitempty"`
	PrivateVulnerabilityReporting          *string                                 `json:"private_vulnerability_reporting,omitempty"`
	Enforcement                            *string                                 `json:"enforcement,omitempty"`
	URL                                    *string                                 `json:"url,omitempty"`
	HTMLURL                                *string                                 `json:"html_url,omitempty"`
	CreatedAt                              *Timestamp                              `json:"created_at,omitempty"`
	UpdatedAt                              *Timestamp                              `json:"updated_at,omitempty"`
}

// CodeSecurityConfigurationWithDefaultForNewRepos represents a code security configuration with default for new repos param.
type CodeSecurityConfigurationWithDefaultForNewRepos struct {
	Configuration      *CodeSecurityConfiguration `json:"configuration"`
	DefaultForNewRepos *string                    `json:"default_for_new_repos,omitempty"`
}

// RepositoryCodeSecurityConfiguration represents a code security configuration for a repository.
type RepositoryCodeSecurityConfiguration struct {
	State         *string                    `json:"state,omitempty"`
	Configuration *CodeSecurityConfiguration `json:"configuration,omitempty"`
}

// ListOrgCodeSecurityConfigurationOptions specifies optional parameters to get security configurations for orgs.
//
// Note: Pagination is powered by before/after cursor-style pagination. After the initial call,
// inspect the returned *Response. Use resp.After as the opts.After value to request
// the next page, and resp.Before as the opts.Before value to request the previous
// page. Set either Before or After for a request; if both are
// supplied GitHub API will return an error. PerPage controls the number of items
// per page (max 100 per GitHub API docs).
type ListOrgCodeSecurityConfigurationOptions struct {
	// A cursor, as given in the Link header. If specified, the query only searches for security configurations before this cursor.
	Before *string `url:"before,omitempty"`

	// A cursor, as given in the Link header. If specified, the query only searches for security configurations after this cursor.
	After *string `url:"after,omitempty"`

	// For paginated result sets, the number of results to include per page.
	PerPage *int `url:"per_page,omitempty"`

	// The target type of the code security configurations to get.
	//
	// `target_type` defaults to all, can be one of `global`, `all`
	TargetType *string `url:"target_type,omitempty"`
}

// ListCodeSecurityConfigurationRepositoriesOptions specifies optional parameters to list repositories for security configurations for orgs and enterprises.
//
// Note: Pagination is powered by before/after cursor-style pagination. After the initial call,
// inspect the returned *Response. Use resp.After as the opts.After value to request
// the next page, and resp.Before as the opts.Before value to request the previous
// page. Set either Before or After for a request; if both are
// supplied GitHub API will return an error. PerPage controls the number of items
// per page (max 100 per GitHub API docs).
type ListCodeSecurityConfigurationRepositoriesOptions struct {
	// A cursor, as given in the Link header. If specified, the query only searches for repositories before this cursor.
	Before *string `url:"before,omitempty"`

	// A cursor, as given in the Link header. If specified, the query only searches for repositories after this cursor.
	After *string `url:"after,omitempty"`

	// For paginated result sets, the number of results to include per page.
	PerPage *int `url:"per_page,omitempty"`

	// A comma-separated list of statuses. If specified, only repositories with these attachment statuses will be returned.
	//
	// `status` defaults to all, can be one of `all`, `attached`, `attaching`, `removed`, `enforced`, `failed`, `updating`, `removed_by_enterprise` and also `detached` but only for the org endpoint.
	Status *string `url:"status,omitempty"`
}

// ListCodeSecurityConfigurations gets code security configurations for an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-code-security-configurations-for-an-organization
//
//meta:operation GET /orgs/{org}/code-security/configurations
func (s *OrganizationsService) ListCodeSecurityConfigurations(ctx context.Context, org string, opts *ListOrgCodeSecurityConfigurationOptions) ([]*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var configurations []*CodeSecurityConfiguration
	resp, err := s.client.Do(ctx, req, &configurations)
	if err != nil {
		return nil, resp, err
	}
	return configurations, resp, nil
}

// CreateCodeSecurityConfiguration creates a code security configuration for an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#create-a-code-security-configuration
//
//meta:operation POST /orgs/{org}/code-security/configurations
func (s *OrganizationsService) CreateCodeSecurityConfiguration(ctx context.Context, org string, config CodeSecurityConfiguration) (*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations", org)

	req, err := s.client.NewRequest("POST", u, config)
	if err != nil {
		return nil, nil, err
	}

	var configuration *CodeSecurityConfiguration
	resp, err := s.client.Do(ctx, req, &configuration)
	if err != nil {
		return nil, resp, err
	}
	return configuration, resp, nil
}

// ListDefaultCodeSecurityConfigurations gets default code security configurations for an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-default-code-security-configurations
//
//meta:operation GET /orgs/{org}/code-security/configurations/defaults
func (s *OrganizationsService) ListDefaultCodeSecurityConfigurations(ctx context.Context, org string) ([]*CodeSecurityConfigurationWithDefaultForNewRepos, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/defaults", org)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var configurations []*CodeSecurityConfigurationWithDefaultForNewRepos
	resp, err := s.client.Do(ctx, req, &configurations)
	if err != nil {
		return nil, resp, err
	}
	return configurations, resp, nil
}

// DetachCodeSecurityConfigurationsFromRepositories detaches code security configuration from an organization's repositories.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#detach-configurations-from-repositories
//
//meta:operation DELETE /orgs/{org}/code-security/configurations/detach
func (s *OrganizationsService) DetachCodeSecurityConfigurationsFromRepositories(ctx context.Context, org string, repoIDs []int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/detach", org)
	type selectedRepoIDs struct {
		SelectedIDs []int64 `json:"selected_repository_ids"`
	}
	req, err := s.client.NewRequest("DELETE", u, selectedRepoIDs{SelectedIDs: repoIDs})
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}
	return resp, nil
}

// GetCodeSecurityConfiguration gets a code security configuration available in an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-a-code-security-configuration
//
//meta:operation GET /orgs/{org}/code-security/configurations/{configuration_id}
func (s *OrganizationsService) GetCodeSecurityConfiguration(ctx context.Context, org string, configurationID int64) (*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v", org, configurationID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var configuration *CodeSecurityConfiguration
	resp, err := s.client.Do(ctx, req, &configuration)
	if err != nil {
		return nil, resp, err
	}
	return configuration, resp, nil
}

// UpdateCodeSecurityConfiguration updates a code security configuration for an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#update-a-code-security-configuration
//
//meta:operation PATCH /orgs/{org}/code-security/configurations/{configuration_id}
func (s *OrganizationsService) UpdateCodeSecurityConfiguration(ctx context.Context, org string, configurationID int64, config CodeSecurityConfiguration) (*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v", org, configurationID)

	req, err := s.client.NewRequest("PATCH", u, config)
	if err != nil {
		return nil, nil, err
	}

	var configuration *CodeSecurityConfiguration
	resp, err := s.client.Do(ctx, req, &configuration)
	if err != nil {
		return nil, resp, err
	}
	return configuration, resp, nil
}

// DeleteCodeSecurityConfiguration deletes a code security configuration for an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#delete-a-code-security-configuration
//
//meta:operation DELETE /orgs/{org}/code-security/configurations/{configuration_id}
func (s *OrganizationsService) DeleteCodeSecurityConfiguration(ctx context.Context, org string, configurationID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v", org, configurationID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}
	return resp, nil
}

// AttachCodeSecurityConfigurationToRepositories attaches code security configurations to repositories for an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#attach-a-configuration-to-repositories
//
//meta:operation POST /orgs/{org}/code-security/configurations/{configuration_id}/attach
func (s *OrganizationsService) AttachCodeSecurityConfigurationToRepositories(ctx context.Context, org string, configurationID int64, scope string, repoIDs []int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v/attach", org, configurationID)
	type selectedRepoIDs struct {
		Scope       string  `json:"scope"`
		SelectedIDs []int64 `json:"selected_repository_ids,omitempty"`
	}
	req, err := s.client.NewRequest("POST", u, selectedRepoIDs{Scope: scope, SelectedIDs: repoIDs})
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(ctx, req, nil)
	if err != nil && resp.StatusCode != http.StatusAccepted { // StatusAccepted(202) is the expected status code as job is queued for processing
		return resp, err
	}
	return resp, nil
}

// SetDefaultCodeSecurityConfiguration sets a code security configuration as the default for an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#set-a-code-security-configuration-as-a-default-for-an-organization
//
//meta:operation PUT /orgs/{org}/code-security/configurations/{configuration_id}/defaults
func (s *OrganizationsService) SetDefaultCodeSecurityConfiguration(ctx context.Context, org string, configurationID int64, newReposParam string) (*CodeSecurityConfigurationWithDefaultForNewRepos, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v/defaults", org, configurationID)
	type configParam struct {
		DefaultForNewRepos string `json:"default_for_new_repos"`
	}
	req, err := s.client.NewRequest("PUT", u, configParam{DefaultForNewRepos: newReposParam})
	if err != nil {
		return nil, nil, err
	}
	var config *CodeSecurityConfigurationWithDefaultForNewRepos
	resp, err := s.client.Do(ctx, req, &config)
	if err != nil {
		return nil, resp, err
	}
	return config, resp, nil
}

// ListCodeSecurityConfigurationRepositories gets repositories associated with a code security configuration.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-repositories-associated-with-a-code-security-configuration
//
//meta:operation GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories
func (s *OrganizationsService) ListCodeSecurityConfigurationRepositories(ctx context.Context, org string, configurationID int64, opts *ListCodeSecurityConfigurationRepositoriesOptions) ([]*RepositoryAttachment, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v/repositories", org, configurationID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var attachments []*RepositoryAttachment
	resp, err := s.client.Do(ctx, req, &attachments)
	if err != nil {
		return nil, resp, err
	}

	return attachments, resp, nil
}

// GetCodeSecurityConfigurationForRepository gets code security configuration that manages a repository's code security settings.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-the-code-security-configuration-associated-with-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/code-security-configuration
func (s *OrganizationsService) GetCodeSecurityConfigurationForRepository(ctx context.Context, org, repo string) (*RepositoryCodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-security-configuration", org, repo)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}
	var repoConfig *RepositoryCodeSecurityConfiguration
	resp, err := s.client.Do(ctx, req, &repoConfig)
	if err != nil {
		return nil, resp, err
	}
	return repoConfig, resp, nil
}
