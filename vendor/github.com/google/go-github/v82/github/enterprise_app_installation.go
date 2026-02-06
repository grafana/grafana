// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// InstallableOrganization represents an organization in an enterprise in which a GitHub app can be installed.
type InstallableOrganization struct {
	ID                        int64   `json:"id"`
	Login                     string  `json:"login"`
	AccessibleRepositoriesURL *string `json:"accessible_repositories_url,omitempty"`
}

// AccessibleRepository represents a repository that can be made accessible to a GitHub app.
type AccessibleRepository struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
}

// InstallAppRequest represents the request to install a GitHub app on an enterprise-owned organization.
type InstallAppRequest struct {
	// The Client ID of the GitHub App to install.
	ClientID string `json:"client_id"`
	// The selection of repositories that the GitHub app can access.
	// Can be one of: all, selected, none
	RepositorySelection string `json:"repository_selection"`
	// A list of repository names that the GitHub App can access, if the repository_selection is set to selected.
	Repositories []string `json:"repositories,omitempty"`
}

// ListAppInstallableOrganizations lists the organizations in an enterprise that are installable for an app.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/organization-installations#get-enterprise-owned-organizations-that-can-have-github-apps-installed
//
//meta:operation GET /enterprises/{enterprise}/apps/installable_organizations
func (s *EnterpriseService) ListAppInstallableOrganizations(ctx context.Context, enterprise string, opts *ListOptions) ([]*InstallableOrganization, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/apps/installable_organizations", enterprise)

	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var orgs []*InstallableOrganization
	resp, err := s.client.Do(ctx, req, &orgs)
	if err != nil {
		return nil, resp, err
	}

	return orgs, resp, nil
}

// ListAppAccessibleOrganizationRepositories lists the repositories accessible to an app in an enterprise-owned organization.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/organization-installations#get-repositories-belonging-to-an-enterprise-owned-organization
//
//meta:operation GET /enterprises/{enterprise}/apps/installable_organizations/{org}/accessible_repositories
func (s *EnterpriseService) ListAppAccessibleOrganizationRepositories(ctx context.Context, enterprise, org string, opts *ListOptions) ([]*AccessibleRepository, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/apps/installable_organizations/%v/accessible_repositories", enterprise, org)

	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var repos []*AccessibleRepository
	resp, err := s.client.Do(ctx, req, &repos)
	if err != nil {
		return nil, resp, err
	}

	return repos, resp, nil
}

// ListAppInstallations lists the GitHub app installations associated with the given enterprise-owned organization.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/organization-installations#list-github-apps-installed-on-an-enterprise-owned-organization
//
//meta:operation GET /enterprises/{enterprise}/apps/organizations/{org}/installations
func (s *EnterpriseService) ListAppInstallations(ctx context.Context, enterprise, org string, opts *ListOptions) ([]*Installation, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/apps/organizations/%v/installations", enterprise, org)

	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var installation []*Installation
	resp, err := s.client.Do(ctx, req, &installation)
	if err != nil {
		return nil, resp, err
	}

	return installation, resp, nil
}

// InstallApp installs any valid GitHub app on the specified organization owned by the enterprise.
// If the app is already installed on the organization, and is suspended, it will be unsuspended. If the app has a pending installation request, they will all be approved.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/organization-installations#install-a-github-app-on-an-enterprise-owned-organization
//
//meta:operation POST /enterprises/{enterprise}/apps/organizations/{org}/installations
func (s *EnterpriseService) InstallApp(ctx context.Context, enterprise, org string, request InstallAppRequest) (*Installation, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/apps/organizations/%v/installations", enterprise, org)
	req, err := s.client.NewRequest("POST", u, request)
	if err != nil {
		return nil, nil, err
	}

	var installation *Installation
	resp, err := s.client.Do(ctx, req, &installation)
	if err != nil {
		return nil, resp, err
	}

	return installation, resp, nil
}

// UninstallApp uninstalls a GitHub app from an organization. Any app installed on the organization can be removed.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/organization-installations#uninstall-a-github-app-from-an-enterprise-owned-organization
//
//meta:operation DELETE /enterprises/{enterprise}/apps/organizations/{org}/installations/{installation_id}
func (s *EnterpriseService) UninstallApp(ctx context.Context, enterprise, org string, installationID int64) (*Response, error) {
	u := fmt.Sprintf("enterprises/%v/apps/organizations/%v/installations/%v", enterprise, org, installationID)
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
