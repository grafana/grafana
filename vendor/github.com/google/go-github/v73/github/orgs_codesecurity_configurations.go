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

// CodeSecurityConfiguration represents a code security configuration.
type CodeSecurityConfiguration struct {
	ID                                     *int64                                  `json:"id,omitempty"`
	TargetType                             *string                                 `json:"target_type,omitempty"`
	Name                                   *string                                 `json:"name"`
	Description                            *string                                 `json:"description,omitempty"`
	AdvancedSecurity                       *string                                 `json:"advanced_security,omitempty"`
	DependencyGraph                        *string                                 `json:"dependency_graph,omitempty"`
	DependencyGraphAutosubmitAction        *string                                 `json:"dependency_graph_autosubmit_action,omitempty"`
	DependencyGraphAutosubmitActionOptions *DependencyGraphAutosubmitActionOptions `json:"dependency_graph_autosubmit_action_options,omitempty"`
	DependabotAlerts                       *string                                 `json:"dependabot_alerts,omitempty"`
	DependabotSecurityUpdates              *string                                 `json:"dependabot_security_updates,omitempty"`
	CodeScanningDefaultSetup               *string                                 `json:"code_scanning_default_setup,omitempty"`
	SecretScanning                         *string                                 `json:"secret_scanning,omitempty"`
	SecretScanningPushProtection           *string                                 `json:"secret_scanning_push_protection,omitempty"`
	SecretScanningValidityChecks           *string                                 `json:"secret_scanning_validity_checks,omitempty"`
	SecretScanningNonProviderPatterns      *string                                 `json:"secret_scanning_non_provider_patterns,omitempty"`
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
	DefaultForNewRepos *string                    `json:"default_for_new_repos"`
}

// RepositoryCodeSecurityConfiguration represents a code security configuration for a repository.
type RepositoryCodeSecurityConfiguration struct {
	State         *string                    `json:"state,omitempty"`
	Configuration *CodeSecurityConfiguration `json:"configuration,omitempty"`
}

// GetCodeSecurityConfigurations gets code security configurations for an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-code-security-configurations-for-an-organization
//
//meta:operation GET /orgs/{org}/code-security/configurations
func (s *OrganizationsService) GetCodeSecurityConfigurations(ctx context.Context, org string) ([]*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations", org)

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
func (s *OrganizationsService) CreateCodeSecurityConfiguration(ctx context.Context, org string, c *CodeSecurityConfiguration) (*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations", org)

	req, err := s.client.NewRequest("POST", u, c)
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

// GetDefaultCodeSecurityConfigurations gets default code security configurations for an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-default-code-security-configurations
//
//meta:operation GET /orgs/{org}/code-security/configurations/defaults
func (s *OrganizationsService) GetDefaultCodeSecurityConfigurations(ctx context.Context, org string) ([]*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/defaults", org)

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
func (s *OrganizationsService) GetCodeSecurityConfiguration(ctx context.Context, org string, id int64) (*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v", org, id)

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
func (s *OrganizationsService) UpdateCodeSecurityConfiguration(ctx context.Context, org string, id int64, c *CodeSecurityConfiguration) (*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v", org, id)

	req, err := s.client.NewRequest("PATCH", u, c)
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
func (s *OrganizationsService) DeleteCodeSecurityConfiguration(ctx context.Context, org string, id int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v", org, id)

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

// AttachCodeSecurityConfigurationsToRepositories attaches code security configurations to repositories for an organization.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#attach-a-configuration-to-repositories
//
//meta:operation POST /orgs/{org}/code-security/configurations/{configuration_id}/attach
func (s *OrganizationsService) AttachCodeSecurityConfigurationsToRepositories(ctx context.Context, org string, id int64, scope string, repoIDs []int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v/attach", org, id)
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
func (s *OrganizationsService) SetDefaultCodeSecurityConfiguration(ctx context.Context, org string, id int64, newReposParam string) (*CodeSecurityConfigurationWithDefaultForNewRepos, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v/defaults", org, id)
	type configParam struct {
		DefaultForNewRepos string `json:"default_for_new_repos"`
	}
	req, err := s.client.NewRequest("PUT", u, configParam{DefaultForNewRepos: newReposParam})
	if err != nil {
		return nil, nil, err
	}
	var c *CodeSecurityConfigurationWithDefaultForNewRepos
	resp, err := s.client.Do(ctx, req, &c)
	if err != nil {
		return nil, resp, err
	}
	return c, resp, nil
}

// GetRepositoriesForCodeSecurityConfiguration gets repositories associated with a code security configuration.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-repositories-associated-with-a-code-security-configuration
//
//meta:operation GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories
func (s *OrganizationsService) GetRepositoriesForCodeSecurityConfiguration(ctx context.Context, org string, id int64) ([]*Repository, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-security/configurations/%v/repositories", org, id)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var repositories []*Repository
	resp, err := s.client.Do(ctx, req, &repositories)
	if err != nil {
		return nil, resp, err
	}
	return repositories, resp, nil
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
