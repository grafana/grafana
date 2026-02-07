// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
	"net/http"
)

// ListEnterpriseCodeSecurityConfigurationOptions specifies optional parameters to get security configurations for enterprises.
//
// Note: Pagination is powered by before/after cursor-style pagination. After the initial call,
// inspect the returned *Response. Use resp.After as the opts.After value to request
// the next page, and resp.Before as the opts.Before value to request the previous
// page. Set either Before or After for a request; if both are
// supplied GitHub API will return an error. PerPage controls the number of items
// per page (max 100 per GitHub API docs).
type ListEnterpriseCodeSecurityConfigurationOptions struct {
	// A cursor, as given in the Link header. If specified, the query only searches for security configurations before this cursor.
	Before *string `url:"before,omitempty"`

	// A cursor, as given in the Link header. If specified, the query only searches for security configurations after this cursor.
	After *string `url:"after,omitempty"`

	// For paginated result sets, the number of results to include per page.
	PerPage *int `url:"per_page,omitempty"`
}

// ListCodeSecurityConfigurations lists all code security configurations available in an enterprise.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-code-security-configurations-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/code-security/configurations
func (s *EnterpriseService) ListCodeSecurityConfigurations(ctx context.Context, enterprise string, opts *ListEnterpriseCodeSecurityConfigurationOptions) ([]*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/code-security/configurations", enterprise)
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

// CreateCodeSecurityConfiguration creates a code security configuration in an enterprise.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#create-a-code-security-configuration-for-an-enterprise
//
//meta:operation POST /enterprises/{enterprise}/code-security/configurations
func (s *EnterpriseService) CreateCodeSecurityConfiguration(ctx context.Context, enterprise string, config CodeSecurityConfiguration) (*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/code-security/configurations", enterprise)

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

// ListDefaultCodeSecurityConfigurations lists the default code security configurations for an enterprise.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-default-code-security-configurations-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/code-security/configurations/defaults
func (s *EnterpriseService) ListDefaultCodeSecurityConfigurations(ctx context.Context, enterprise string) ([]*CodeSecurityConfigurationWithDefaultForNewRepos, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/code-security/configurations/defaults", enterprise)

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

// GetCodeSecurityConfiguration gets a code security configuration available in an enterprise.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#retrieve-a-code-security-configuration-of-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/code-security/configurations/{configuration_id}
func (s *EnterpriseService) GetCodeSecurityConfiguration(ctx context.Context, enterprise string, configurationID int64) (*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/code-security/configurations/%v", enterprise, configurationID)

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

// UpdateCodeSecurityConfiguration updates a code security configuration in an enterprise.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#update-a-custom-code-security-configuration-for-an-enterprise
//
//meta:operation PATCH /enterprises/{enterprise}/code-security/configurations/{configuration_id}
func (s *EnterpriseService) UpdateCodeSecurityConfiguration(ctx context.Context, enterprise string, configurationID int64, config CodeSecurityConfiguration) (*CodeSecurityConfiguration, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/code-security/configurations/%v", enterprise, configurationID)

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

// DeleteCodeSecurityConfiguration deletes a code security configuration from an enterprise.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#delete-a-code-security-configuration-for-an-enterprise
//
//meta:operation DELETE /enterprises/{enterprise}/code-security/configurations/{configuration_id}
func (s *EnterpriseService) DeleteCodeSecurityConfiguration(ctx context.Context, enterprise string, configurationID int64) (*Response, error) {
	u := fmt.Sprintf("enterprises/%v/code-security/configurations/%v", enterprise, configurationID)

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

// AttachCodeSecurityConfigurationToRepositories attaches an enterprise code security configuration to repositories.
// `scope` is the type of repositories to attach the configuration to.
// Can be one of: `all`, `all_without_configurations`.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#attach-an-enterprise-configuration-to-repositories
//
//meta:operation POST /enterprises/{enterprise}/code-security/configurations/{configuration_id}/attach
func (s *EnterpriseService) AttachCodeSecurityConfigurationToRepositories(ctx context.Context, enterprise string, configurationID int64, scope string) (*Response, error) {
	u := fmt.Sprintf("enterprises/%v/code-security/configurations/%v/attach", enterprise, configurationID)
	type scopeType struct {
		Scope string `json:"scope"`
	}

	req, err := s.client.NewRequest("POST", u, scopeType{Scope: scope})
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(ctx, req, nil)
	if err != nil && resp.StatusCode != http.StatusAccepted { // StatusAccepted(202) is the expected status code as job is queued for processing
		return resp, err
	}
	return resp, nil
}

// SetDefaultCodeSecurityConfiguration sets a code security configuration as a default for an enterprise.
// `defaultForNewRepos` specifies which types of repository this security configuration should be applied to by default.
// Can be one of: `all`, `none`, `private_and_internal`, `public`.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#set-a-code-security-configuration-as-a-default-for-an-enterprise
//
//meta:operation PUT /enterprises/{enterprise}/code-security/configurations/{configuration_id}/defaults
func (s *EnterpriseService) SetDefaultCodeSecurityConfiguration(ctx context.Context, enterprise string, configurationID int64, defaultForNewRepos string) (*CodeSecurityConfigurationWithDefaultForNewRepos, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/code-security/configurations/%v/defaults", enterprise, configurationID)
	type configParam struct {
		DefaultForNewRepos string `json:"default_for_new_repos"`
	}

	req, err := s.client.NewRequest("PUT", u, configParam{DefaultForNewRepos: defaultForNewRepos})
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

// ListCodeSecurityConfigurationRepositories lists the repositories associated with an enterprise code security configuration.
//
// GitHub API docs: https://docs.github.com/rest/code-security/configurations#get-repositories-associated-with-an-enterprise-code-security-configuration
//
//meta:operation GET /enterprises/{enterprise}/code-security/configurations/{configuration_id}/repositories
func (s *EnterpriseService) ListCodeSecurityConfigurationRepositories(ctx context.Context, enterprise string, configurationID int64, opts *ListCodeSecurityConfigurationRepositoriesOptions) ([]*RepositoryAttachment, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/code-security/configurations/%v/repositories", enterprise, configurationID)
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
