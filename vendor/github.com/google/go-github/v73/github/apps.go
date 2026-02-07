// Copyright 2016 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// AppsService provides access to the installation related functions
// in the GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/apps/
type AppsService service

// App represents a GitHub App.
type App struct {
	ID                 *int64                   `json:"id,omitempty"`
	Slug               *string                  `json:"slug,omitempty"`
	NodeID             *string                  `json:"node_id,omitempty"`
	Owner              *User                    `json:"owner,omitempty"`
	Name               *string                  `json:"name,omitempty"`
	Description        *string                  `json:"description,omitempty"`
	ExternalURL        *string                  `json:"external_url,omitempty"`
	HTMLURL            *string                  `json:"html_url,omitempty"`
	CreatedAt          *Timestamp               `json:"created_at,omitempty"`
	UpdatedAt          *Timestamp               `json:"updated_at,omitempty"`
	Permissions        *InstallationPermissions `json:"permissions,omitempty"`
	Events             []string                 `json:"events,omitempty"`
	InstallationsCount *int                     `json:"installations_count,omitempty"`
}

// InstallationToken represents an installation token.
type InstallationToken struct {
	Token        *string                  `json:"token,omitempty"`
	ExpiresAt    *Timestamp               `json:"expires_at,omitempty"`
	Permissions  *InstallationPermissions `json:"permissions,omitempty"`
	Repositories []*Repository            `json:"repositories,omitempty"`
}

// InstallationTokenOptions allow restricting a token's access to specific repositories.
type InstallationTokenOptions struct {
	// The IDs of the repositories that the installation token can access.
	// Providing repository IDs restricts the access of an installation token to specific repositories.
	RepositoryIDs []int64 `json:"repository_ids,omitempty"`

	// The names of the repositories that the installation token can access.
	// Providing repository names restricts the access of an installation token to specific repositories.
	Repositories []string `json:"repositories,omitempty"`

	// The permissions granted to the access token.
	// The permissions object includes the permission names and their access type.
	Permissions *InstallationPermissions `json:"permissions,omitempty"`
}

type InstallationTokenListRepoOptions struct {
	// The IDs of the repositories that the installation token can access.
	// Providing repository IDs restricts the access of an installation token to specific repositories.
	RepositoryIDs []int64 `json:"repository_ids"`

	// The names of the repositories that the installation token can access.
	// Providing repository names restricts the access of an installation token to specific repositories.
	Repositories []string `json:"repositories,omitempty"`

	// The permissions granted to the access token.
	// The permissions object includes the permission names and their access type.
	Permissions *InstallationPermissions `json:"permissions,omitempty"`
}

// InstallationPermissions lists the repository and organization permissions for an installation.
//
// Permission names taken from:
//
//	https://docs.github.com/enterprise-server@3.0/rest/apps#create-an-installation-access-token-for-an-app
//	https://docs.github.com/rest/apps#create-an-installation-access-token-for-an-app
type InstallationPermissions struct {
	Actions                                 *string `json:"actions,omitempty"`
	ActionsVariables                        *string `json:"actions_variables,omitempty"`
	Administration                          *string `json:"administration,omitempty"`
	Attestations                            *string `json:"attestations,omitempty"`
	Blocking                                *string `json:"blocking,omitempty"`
	Checks                                  *string `json:"checks,omitempty"`
	Codespaces                              *string `json:"codespaces,omitempty"`
	CodespacesLifecycleAdmin                *string `json:"codespaces_lifecycle_admin,omitempty"`
	CodespacesMetadata                      *string `json:"codespaces_metadata,omitempty"`
	CodespacesSecrets                       *string `json:"codespaces_secrets,omitempty"`
	CodespacesUserSecrets                   *string `json:"codespaces_user_secrets,omitempty"`
	Contents                                *string `json:"contents,omitempty"`
	ContentReferences                       *string `json:"content_references,omitempty"`
	CopilotMessages                         *string `json:"copilot_messages,omitempty"`
	DependabotSecrets                       *string `json:"dependabot_secrets,omitempty"`
	Deployments                             *string `json:"deployments,omitempty"`
	Discussions                             *string `json:"discussions,omitempty"`
	Emails                                  *string `json:"emails,omitempty"`
	Environments                            *string `json:"environments,omitempty"`
	Followers                               *string `json:"followers,omitempty"`
	Gists                                   *string `json:"gists,omitempty"`
	GitSigningSSHPublicKeys                 *string `json:"git_signing_ssh_public_keys,omitempty"`
	GPGKeys                                 *string `json:"gpg_keys,omitempty"`
	InteractionLimits                       *string `json:"interaction_limits,omitempty"`
	Issues                                  *string `json:"issues,omitempty"`
	Keys                                    *string `json:"keys,omitempty"`
	Metadata                                *string `json:"metadata,omitempty"`
	Members                                 *string `json:"members,omitempty"`
	MergeQueues                             *string `json:"merge_queues,omitempty"`
	OrganizationActionsVariables            *string `json:"organization_actions_variables,omitempty"`
	OrganizationAdministration              *string `json:"organization_administration,omitempty"`
	OrganizationAnnouncementBanners         *string `json:"organization_announcement_banners,omitempty"`
	OrganizationAPIInsights                 *string `json:"organization_api_insights,omitempty"`
	OrganizationCodespaces                  *string `json:"organization_codespaces,omitempty"`
	OrganizationCodespacesSecrets           *string `json:"organization_codespaces_secrets,omitempty"`
	OrganizationCodespacesSettings          *string `json:"organization_codespaces_settings,omitempty"`
	OrganizationCopilotSeatManagement       *string `json:"organization_copilot_seat_management,omitempty"`
	OrganizationCustomProperties            *string `json:"organization_custom_properties,omitempty"`
	OrganizationCustomRoles                 *string `json:"organization_custom_roles,omitempty"`
	OrganizationCustomOrgRoles              *string `json:"organization_custom_org_roles,omitempty"`
	OrganizationDependabotSecrets           *string `json:"organization_dependabot_secrets,omitempty"`
	OrganizationEvents                      *string `json:"organization_events,omitempty"`
	OrganizationHooks                       *string `json:"organization_hooks,omitempty"`
	OrganizationKnowledgeBases              *string `json:"organization_knowledge_bases,omitempty"`
	OrganizationPackages                    *string `json:"organization_packages,omitempty"`
	OrganizationPersonalAccessTokens        *string `json:"organization_personal_access_tokens,omitempty"`
	OrganizationPersonalAccessTokenRequests *string `json:"organization_personal_access_token_requests,omitempty"`
	OrganizationPlan                        *string `json:"organization_plan,omitempty"`
	OrganizationPreReceiveHooks             *string `json:"organization_pre_receive_hooks,omitempty"`
	OrganizationProjects                    *string `json:"organization_projects,omitempty"`
	OrganizationSecrets                     *string `json:"organization_secrets,omitempty"`
	OrganizationSelfHostedRunners           *string `json:"organization_self_hosted_runners,omitempty"`
	OrganizationUserBlocking                *string `json:"organization_user_blocking,omitempty"`
	Packages                                *string `json:"packages,omitempty"`
	Pages                                   *string `json:"pages,omitempty"`
	Plan                                    *string `json:"plan,omitempty"`
	Profile                                 *string `json:"profile,omitempty"`
	PullRequests                            *string `json:"pull_requests,omitempty"`
	RepositoryAdvisories                    *string `json:"repository_advisories,omitempty"`
	RepositoryCustomProperties              *string `json:"repository_custom_properties,omitempty"`
	RepositoryHooks                         *string `json:"repository_hooks,omitempty"`
	RepositoryProjects                      *string `json:"repository_projects,omitempty"`
	RepositoryPreReceiveHooks               *string `json:"repository_pre_receive_hooks,omitempty"`
	Secrets                                 *string `json:"secrets,omitempty"`
	SecretScanningAlerts                    *string `json:"secret_scanning_alerts,omitempty"`
	SecurityEvents                          *string `json:"security_events,omitempty"`
	SingleFile                              *string `json:"single_file,omitempty"`
	Starring                                *string `json:"starring,omitempty"`
	Statuses                                *string `json:"statuses,omitempty"`
	TeamDiscussions                         *string `json:"team_discussions,omitempty"`
	UserEvents                              *string `json:"user_events,omitempty"`
	VulnerabilityAlerts                     *string `json:"vulnerability_alerts,omitempty"`
	Watching                                *string `json:"watching,omitempty"`
	Workflows                               *string `json:"workflows,omitempty"`
}

// InstallationRequest represents a pending GitHub App installation request.
type InstallationRequest struct {
	ID        *int64     `json:"id,omitempty"`
	NodeID    *string    `json:"node_id,omitempty"`
	Account   *User      `json:"account,omitempty"`
	Requester *User      `json:"requester,omitempty"`
	CreatedAt *Timestamp `json:"created_at,omitempty"`
}

// Installation represents a GitHub Apps installation.
type Installation struct {
	ID                     *int64                   `json:"id,omitempty"`
	NodeID                 *string                  `json:"node_id,omitempty"`
	AppID                  *int64                   `json:"app_id,omitempty"`
	AppSlug                *string                  `json:"app_slug,omitempty"`
	TargetID               *int64                   `json:"target_id,omitempty"`
	Account                *User                    `json:"account,omitempty"`
	AccessTokensURL        *string                  `json:"access_tokens_url,omitempty"`
	RepositoriesURL        *string                  `json:"repositories_url,omitempty"`
	HTMLURL                *string                  `json:"html_url,omitempty"`
	TargetType             *string                  `json:"target_type,omitempty"`
	SingleFileName         *string                  `json:"single_file_name,omitempty"`
	RepositorySelection    *string                  `json:"repository_selection,omitempty"`
	Events                 []string                 `json:"events,omitempty"`
	SingleFilePaths        []string                 `json:"single_file_paths,omitempty"`
	Permissions            *InstallationPermissions `json:"permissions,omitempty"`
	CreatedAt              *Timestamp               `json:"created_at,omitempty"`
	UpdatedAt              *Timestamp               `json:"updated_at,omitempty"`
	HasMultipleSingleFiles *bool                    `json:"has_multiple_single_files,omitempty"`
	SuspendedBy            *User                    `json:"suspended_by,omitempty"`
	SuspendedAt            *Timestamp               `json:"suspended_at,omitempty"`
}

// Attachment represents a GitHub Apps attachment.
type Attachment struct {
	ID    *int64  `json:"id,omitempty"`
	Title *string `json:"title,omitempty"`
	Body  *string `json:"body,omitempty"`
}

// ContentReference represents a reference to a URL in an issue or pull request.
type ContentReference struct {
	ID        *int64  `json:"id,omitempty"`
	NodeID    *string `json:"node_id,omitempty"`
	Reference *string `json:"reference,omitempty"`
}

func (i Installation) String() string {
	return Stringify(i)
}

// Get a single GitHub App. Passing the empty string will get
// the authenticated GitHub App.
//
// Note: appSlug is just the URL-friendly name of your GitHub App.
// You can find this on the settings page for your GitHub App
// (e.g., https://github.com/settings/apps/:app_slug).
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#get-an-app
// GitHub API docs: https://docs.github.com/rest/apps/apps#get-the-authenticated-app
//
//meta:operation GET /app
//meta:operation GET /apps/{app_slug}
func (s *AppsService) Get(ctx context.Context, appSlug string) (*App, *Response, error) {
	var u string
	if appSlug != "" {
		u = fmt.Sprintf("apps/%v", appSlug)
	} else {
		u = "app"
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	app := new(App)
	resp, err := s.client.Do(ctx, req, app)
	if err != nil {
		return nil, resp, err
	}

	return app, resp, nil
}

// ListInstallationRequests lists the pending installation requests that the current GitHub App has.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#list-installation-requests-for-the-authenticated-app
//
//meta:operation GET /app/installation-requests
func (s *AppsService) ListInstallationRequests(ctx context.Context, opts *ListOptions) ([]*InstallationRequest, *Response, error) {
	u, err := addOptions("app/installation-requests", opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var i []*InstallationRequest
	resp, err := s.client.Do(ctx, req, &i)
	if err != nil {
		return nil, resp, err
	}

	return i, resp, nil
}

// ListInstallations lists the installations that the current GitHub App has.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#list-installations-for-the-authenticated-app
//
//meta:operation GET /app/installations
func (s *AppsService) ListInstallations(ctx context.Context, opts *ListOptions) ([]*Installation, *Response, error) {
	u, err := addOptions("app/installations", opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var i []*Installation
	resp, err := s.client.Do(ctx, req, &i)
	if err != nil {
		return nil, resp, err
	}

	return i, resp, nil
}

// GetInstallation returns the specified installation.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#get-an-installation-for-the-authenticated-app
//
//meta:operation GET /app/installations/{installation_id}
func (s *AppsService) GetInstallation(ctx context.Context, id int64) (*Installation, *Response, error) {
	return s.getInstallation(ctx, fmt.Sprintf("app/installations/%v", id))
}

// ListUserInstallations lists installations that are accessible to the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/apps/installations#list-app-installations-accessible-to-the-user-access-token
//
//meta:operation GET /user/installations
func (s *AppsService) ListUserInstallations(ctx context.Context, opts *ListOptions) ([]*Installation, *Response, error) {
	u, err := addOptions("user/installations", opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var i struct {
		Installations []*Installation `json:"installations"`
	}
	resp, err := s.client.Do(ctx, req, &i)
	if err != nil {
		return nil, resp, err
	}

	return i.Installations, resp, nil
}

// SuspendInstallation suspends the specified installation.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#suspend-an-app-installation
//
//meta:operation PUT /app/installations/{installation_id}/suspended
func (s *AppsService) SuspendInstallation(ctx context.Context, id int64) (*Response, error) {
	u := fmt.Sprintf("app/installations/%v/suspended", id)

	req, err := s.client.NewRequest("PUT", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// UnsuspendInstallation unsuspends the specified installation.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#unsuspend-an-app-installation
//
//meta:operation DELETE /app/installations/{installation_id}/suspended
func (s *AppsService) UnsuspendInstallation(ctx context.Context, id int64) (*Response, error) {
	u := fmt.Sprintf("app/installations/%v/suspended", id)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// DeleteInstallation deletes the specified installation.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#delete-an-installation-for-the-authenticated-app
//
//meta:operation DELETE /app/installations/{installation_id}
func (s *AppsService) DeleteInstallation(ctx context.Context, id int64) (*Response, error) {
	u := fmt.Sprintf("app/installations/%v", id)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// CreateInstallationToken creates a new installation token.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#create-an-installation-access-token-for-an-app
//
//meta:operation POST /app/installations/{installation_id}/access_tokens
func (s *AppsService) CreateInstallationToken(ctx context.Context, id int64, opts *InstallationTokenOptions) (*InstallationToken, *Response, error) {
	u := fmt.Sprintf("app/installations/%v/access_tokens", id)

	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	t := new(InstallationToken)
	resp, err := s.client.Do(ctx, req, t)
	if err != nil {
		return nil, resp, err
	}

	return t, resp, nil
}

// CreateInstallationTokenListRepos creates a new installation token with a list of all repositories in an installation which is not possible with CreateInstallationToken.
//
// It differs from CreateInstallationToken by taking InstallationTokenListRepoOptions as a parameter which does not omit RepositoryIDs if that field is nil or an empty array.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#create-an-installation-access-token-for-an-app
//
//meta:operation POST /app/installations/{installation_id}/access_tokens
func (s *AppsService) CreateInstallationTokenListRepos(ctx context.Context, id int64, opts *InstallationTokenListRepoOptions) (*InstallationToken, *Response, error) {
	u := fmt.Sprintf("app/installations/%v/access_tokens", id)

	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	t := new(InstallationToken)
	resp, err := s.client.Do(ctx, req, t)
	if err != nil {
		return nil, resp, err
	}

	return t, resp, nil
}

// CreateAttachment creates a new attachment on user comment containing a url.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.3/rest/reference/apps#create-a-content-attachment
//
//meta:operation POST /repos/{owner}/{repo}/content_references/{content_reference_id}/attachments
func (s *AppsService) CreateAttachment(ctx context.Context, contentReferenceID int64, title, body string) (*Attachment, *Response, error) {
	u := fmt.Sprintf("content_references/%v/attachments", contentReferenceID)
	payload := &Attachment{Title: Ptr(title), Body: Ptr(body)}
	req, err := s.client.NewRequest("POST", u, payload)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	req.Header.Set("Accept", mediaTypeContentAttachmentsPreview)

	m := &Attachment{}
	resp, err := s.client.Do(ctx, req, m)
	if err != nil {
		return nil, resp, err
	}

	return m, resp, nil
}

// FindOrganizationInstallation finds the organization's installation information.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#get-an-organization-installation-for-the-authenticated-app
//
//meta:operation GET /orgs/{org}/installation
func (s *AppsService) FindOrganizationInstallation(ctx context.Context, org string) (*Installation, *Response, error) {
	return s.getInstallation(ctx, fmt.Sprintf("orgs/%v/installation", org))
}

// FindRepositoryInstallation finds the repository's installation information.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#get-a-repository-installation-for-the-authenticated-app
//
//meta:operation GET /repos/{owner}/{repo}/installation
func (s *AppsService) FindRepositoryInstallation(ctx context.Context, owner, repo string) (*Installation, *Response, error) {
	return s.getInstallation(ctx, fmt.Sprintf("repos/%v/%v/installation", owner, repo))
}

// FindRepositoryInstallationByID finds the repository's installation information.
//
// Note: FindRepositoryInstallationByID uses the undocumented GitHub API endpoint "GET /repositories/{repository_id}/installation".
//
//meta:operation GET /repositories/{repository_id}/installation
func (s *AppsService) FindRepositoryInstallationByID(ctx context.Context, id int64) (*Installation, *Response, error) {
	return s.getInstallation(ctx, fmt.Sprintf("repositories/%d/installation", id))
}

// FindUserInstallation finds the user's installation information.
//
// GitHub API docs: https://docs.github.com/rest/apps/apps#get-a-user-installation-for-the-authenticated-app
//
//meta:operation GET /users/{username}/installation
func (s *AppsService) FindUserInstallation(ctx context.Context, user string) (*Installation, *Response, error) {
	return s.getInstallation(ctx, fmt.Sprintf("users/%v/installation", user))
}

func (s *AppsService) getInstallation(ctx context.Context, url string) (*Installation, *Response, error) {
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	i := new(Installation)
	resp, err := s.client.Do(ctx, req, i)
	if err != nil {
		return nil, resp, err
	}

	return i, resp, nil
}
