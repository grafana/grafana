// Copyright 2013 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// OrganizationsService provides access to the organization related functions
// in the GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/orgs/
type OrganizationsService service

// Organization represents a GitHub organization account.
type Organization struct {
	Login                       *string    `json:"login,omitempty"`
	ID                          *int64     `json:"id,omitempty"`
	NodeID                      *string    `json:"node_id,omitempty"`
	AvatarURL                   *string    `json:"avatar_url,omitempty"`
	HTMLURL                     *string    `json:"html_url,omitempty"`
	Name                        *string    `json:"name,omitempty"`
	Company                     *string    `json:"company,omitempty"`
	Blog                        *string    `json:"blog,omitempty"`
	Location                    *string    `json:"location,omitempty"`
	Email                       *string    `json:"email,omitempty"`
	TwitterUsername             *string    `json:"twitter_username,omitempty"`
	Description                 *string    `json:"description,omitempty"`
	PublicRepos                 *int       `json:"public_repos,omitempty"`
	PublicGists                 *int       `json:"public_gists,omitempty"`
	Followers                   *int       `json:"followers,omitempty"`
	Following                   *int       `json:"following,omitempty"`
	CreatedAt                   *Timestamp `json:"created_at,omitempty"`
	UpdatedAt                   *Timestamp `json:"updated_at,omitempty"`
	TotalPrivateRepos           *int64     `json:"total_private_repos,omitempty"`
	OwnedPrivateRepos           *int64     `json:"owned_private_repos,omitempty"`
	PrivateGists                *int       `json:"private_gists,omitempty"`
	DiskUsage                   *int       `json:"disk_usage,omitempty"`
	Collaborators               *int       `json:"collaborators,omitempty"`
	BillingEmail                *string    `json:"billing_email,omitempty"`
	Type                        *string    `json:"type,omitempty"`
	Plan                        *Plan      `json:"plan,omitempty"`
	TwoFactorRequirementEnabled *bool      `json:"two_factor_requirement_enabled,omitempty"`
	IsVerified                  *bool      `json:"is_verified,omitempty"`
	HasOrganizationProjects     *bool      `json:"has_organization_projects,omitempty"`
	HasRepositoryProjects       *bool      `json:"has_repository_projects,omitempty"`

	// DefaultRepoPermission can be one of: "read", "write", "admin", or "none". (Default: "read").
	// It is only used in OrganizationsService.Edit.
	DefaultRepoPermission *string `json:"default_repository_permission,omitempty"`
	// DefaultRepoSettings can be one of: "read", "write", "admin", or "none". (Default: "read").
	// It is only used in OrganizationsService.Get.
	DefaultRepoSettings *string `json:"default_repository_settings,omitempty"`

	// MembersCanCreateRepos default value is true and is only used in Organizations.Edit.
	MembersCanCreateRepos *bool `json:"members_can_create_repositories,omitempty"`

	// https://developer.github.com/changes/2019-12-03-internal-visibility-changes/#rest-v3-api
	MembersCanCreatePublicRepos   *bool `json:"members_can_create_public_repositories,omitempty"`
	MembersCanCreatePrivateRepos  *bool `json:"members_can_create_private_repositories,omitempty"`
	MembersCanCreateInternalRepos *bool `json:"members_can_create_internal_repositories,omitempty"`

	// MembersCanForkPrivateRepos toggles whether organization members can fork private organization repositories.
	MembersCanForkPrivateRepos *bool `json:"members_can_fork_private_repositories,omitempty"`

	// MembersAllowedRepositoryCreationType denotes if organization members can create repositories
	// and the type of repositories they can create. Possible values are: "all", "private", or "none".
	//
	// Deprecated: Use MembersCanCreatePublicRepos, MembersCanCreatePrivateRepos, MembersCanCreateInternalRepos
	// instead. The new fields overrides the existing MembersAllowedRepositoryCreationType during 'edit'
	// operation and does not consider 'internal' repositories during 'get' operation
	MembersAllowedRepositoryCreationType *string `json:"members_allowed_repository_creation_type,omitempty"`

	// MembersCanCreatePages toggles whether organization members can create GitHub Pages sites.
	MembersCanCreatePages *bool `json:"members_can_create_pages,omitempty"`
	// MembersCanCreatePublicPages toggles whether organization members can create public GitHub Pages sites.
	MembersCanCreatePublicPages *bool `json:"members_can_create_public_pages,omitempty"`
	// MembersCanCreatePrivatePages toggles whether organization members can create private GitHub Pages sites.
	MembersCanCreatePrivatePages *bool `json:"members_can_create_private_pages,omitempty"`
	// WebCommitSignoffRequire toggles
	WebCommitSignoffRequired *bool `json:"web_commit_signoff_required,omitempty"`
	// AdvancedSecurityAuditLogEnabled toggles whether the advanced security audit log is enabled.
	AdvancedSecurityEnabledForNewRepos *bool `json:"advanced_security_enabled_for_new_repositories,omitempty"`
	// DependabotAlertsEnabled toggles whether dependabot alerts are enabled.
	DependabotAlertsEnabledForNewRepos *bool `json:"dependabot_alerts_enabled_for_new_repositories,omitempty"`
	// DependabotSecurityUpdatesEnabled toggles whether dependabot security updates are enabled.
	DependabotSecurityUpdatesEnabledForNewRepos *bool `json:"dependabot_security_updates_enabled_for_new_repositories,omitempty"`
	// DependabotGraphEnabledForNewRepos toggles whether dependabot graph is enabled on new repositories.
	DependencyGraphEnabledForNewRepos *bool `json:"dependency_graph_enabled_for_new_repositories,omitempty"`
	// SecretScanningEnabled toggles whether secret scanning is enabled on new repositories.
	SecretScanningEnabledForNewRepos *bool `json:"secret_scanning_enabled_for_new_repositories,omitempty"`
	// SecretScanningPushProtectionEnabledForNewRepos toggles whether secret scanning push protection is enabled on new repositories.
	SecretScanningPushProtectionEnabledForNewRepos *bool `json:"secret_scanning_push_protection_enabled_for_new_repositories,omitempty"`
	// SecretScanningValidityChecksEnabled toggles whether secret scanning validity check is enabled.
	SecretScanningValidityChecksEnabled *bool `json:"secret_scanning_validity_checks_enabled,omitempty"`

	// API URLs
	URL              *string `json:"url,omitempty"`
	EventsURL        *string `json:"events_url,omitempty"`
	HooksURL         *string `json:"hooks_url,omitempty"`
	IssuesURL        *string `json:"issues_url,omitempty"`
	MembersURL       *string `json:"members_url,omitempty"`
	PublicMembersURL *string `json:"public_members_url,omitempty"`
	ReposURL         *string `json:"repos_url,omitempty"`
}

// OrganizationInstallations represents GitHub app installations for an organization.
type OrganizationInstallations struct {
	TotalCount    *int            `json:"total_count,omitempty"`
	Installations []*Installation `json:"installations,omitempty"`
}

func (o Organization) String() string {
	return Stringify(o)
}

// Plan represents the payment plan for an account. See plans at https://github.com/plans.
type Plan struct {
	Name          *string `json:"name,omitempty"`
	Space         *int    `json:"space,omitempty"`
	Collaborators *int    `json:"collaborators,omitempty"`
	PrivateRepos  *int64  `json:"private_repos,omitempty"`
	FilledSeats   *int    `json:"filled_seats,omitempty"`
	Seats         *int    `json:"seats,omitempty"`
}

func (p Plan) String() string {
	return Stringify(p)
}

// OrganizationsListOptions specifies the optional parameters to the
// OrganizationsService.ListAll method.
type OrganizationsListOptions struct {
	// Since filters Organizations by ID.
	Since int64 `url:"since,omitempty"`

	// Note: Pagination is powered exclusively by the Since parameter,
	// ListOptions.Page has no effect.
	// ListOptions.PerPage controls an undocumented GitHub API parameter.
	ListOptions
}

// ListAll lists all organizations, in the order that they were created on GitHub.
//
// Note: Pagination is powered exclusively by the since parameter. To continue
// listing the next set of organizations, use the ID of the last-returned organization
// as the opts.Since parameter for the next call.
//
// GitHub API docs: https://docs.github.com/rest/orgs/orgs#list-organizations
//
//meta:operation GET /organizations
func (s *OrganizationsService) ListAll(ctx context.Context, opts *OrganizationsListOptions) ([]*Organization, *Response, error) {
	u, err := addOptions("organizations", opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	orgs := []*Organization{}
	resp, err := s.client.Do(ctx, req, &orgs)
	if err != nil {
		return nil, resp, err
	}
	return orgs, resp, nil
}

// List the organizations for a user. Passing the empty string will list
// organizations for the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/orgs/orgs#list-organizations-for-a-user
// GitHub API docs: https://docs.github.com/rest/orgs/orgs#list-organizations-for-the-authenticated-user
//
//meta:operation GET /user/orgs
//meta:operation GET /users/{username}/orgs
func (s *OrganizationsService) List(ctx context.Context, user string, opts *ListOptions) ([]*Organization, *Response, error) {
	var u string
	if user != "" {
		u = fmt.Sprintf("users/%v/orgs", user)
	} else {
		u = "user/orgs"
	}
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var orgs []*Organization
	resp, err := s.client.Do(ctx, req, &orgs)
	if err != nil {
		return nil, resp, err
	}

	return orgs, resp, nil
}

// Get fetches an organization by name.
//
// GitHub API docs: https://docs.github.com/rest/orgs/orgs#get-an-organization
//
//meta:operation GET /orgs/{org}
func (s *OrganizationsService) Get(ctx context.Context, org string) (*Organization, *Response, error) {
	u := fmt.Sprintf("orgs/%v", org)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeMemberAllowedRepoCreationTypePreview)

	organization := new(Organization)
	resp, err := s.client.Do(ctx, req, organization)
	if err != nil {
		return nil, resp, err
	}

	return organization, resp, nil
}

// GetByID fetches an organization.
//
// Note: GetByID uses the undocumented GitHub API endpoint "GET /organizations/{organization_id}".
//
//meta:operation GET /organizations/{organization_id}
func (s *OrganizationsService) GetByID(ctx context.Context, id int64) (*Organization, *Response, error) {
	u := fmt.Sprintf("organizations/%d", id)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	organization := new(Organization)
	resp, err := s.client.Do(ctx, req, organization)
	if err != nil {
		return nil, resp, err
	}

	return organization, resp, nil
}

// Edit an organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/orgs#update-an-organization
//
//meta:operation PATCH /orgs/{org}
func (s *OrganizationsService) Edit(ctx context.Context, name string, org *Organization) (*Organization, *Response, error) {
	u := fmt.Sprintf("orgs/%v", name)
	req, err := s.client.NewRequest("PATCH", u, org)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeMemberAllowedRepoCreationTypePreview)

	o := new(Organization)
	resp, err := s.client.Do(ctx, req, o)
	if err != nil {
		return nil, resp, err
	}

	return o, resp, nil
}

// Delete an organization by name.
//
// GitHub API docs: https://docs.github.com/rest/orgs/orgs#delete-an-organization
//
//meta:operation DELETE /orgs/{org}
func (s *OrganizationsService) Delete(ctx context.Context, org string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v", org)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// ListInstallations lists installations for an organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/orgs#list-app-installations-for-an-organization
//
//meta:operation GET /orgs/{org}/installations
func (s *OrganizationsService) ListInstallations(ctx context.Context, org string, opts *ListOptions) (*OrganizationInstallations, *Response, error) {
	u := fmt.Sprintf("orgs/%v/installations", org)

	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	result := new(OrganizationInstallations)
	resp, err := s.client.Do(ctx, req, result)
	if err != nil {
		return nil, resp, err
	}

	return result, resp, nil
}
