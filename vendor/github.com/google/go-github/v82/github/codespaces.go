// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// CodespacesService handles communication with the Codespaces related
// methods of the GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/
type CodespacesService service

// Codespace represents a codespace.
//
// GitHub API docs: https://docs.github.com/rest/codespaces
type Codespace struct {
	ID                             *int64                        `json:"id,omitempty"`
	Name                           *string                       `json:"name,omitempty"`
	DisplayName                    *string                       `json:"display_name,omitempty"`
	EnvironmentID                  *string                       `json:"environment_id,omitempty"`
	Owner                          *User                         `json:"owner,omitempty"`
	BillableOwner                  *User                         `json:"billable_owner,omitempty"`
	Repository                     *Repository                   `json:"repository,omitempty"`
	Machine                        *CodespacesMachine            `json:"machine,omitempty"`
	DevcontainerPath               *string                       `json:"devcontainer_path,omitempty"`
	Prebuild                       *bool                         `json:"prebuild,omitempty"`
	CreatedAt                      *Timestamp                    `json:"created_at,omitempty"`
	UpdatedAt                      *Timestamp                    `json:"updated_at,omitempty"`
	LastUsedAt                     *Timestamp                    `json:"last_used_at,omitempty"`
	State                          *string                       `json:"state,omitempty"`
	URL                            *string                       `json:"url,omitempty"`
	GitStatus                      *CodespacesGitStatus          `json:"git_status,omitempty"`
	Location                       *string                       `json:"location,omitempty"`
	IdleTimeoutMinutes             *int                          `json:"idle_timeout_minutes,omitempty"`
	WebURL                         *string                       `json:"web_url,omitempty"`
	MachinesURL                    *string                       `json:"machines_url,omitempty"`
	StartURL                       *string                       `json:"start_url,omitempty"`
	StopURL                        *string                       `json:"stop_url,omitempty"`
	PullsURL                       *string                       `json:"pulls_url,omitempty"`
	RecentFolders                  []string                      `json:"recent_folders,omitempty"`
	RuntimeConstraints             *CodespacesRuntimeConstraints `json:"runtime_constraints,omitempty"`
	PendingOperation               *bool                         `json:"pending_operation,omitempty"`
	PendingOperationDisabledReason *string                       `json:"pending_operation_disabled_reason,omitempty"`
	IdleTimeoutNotice              *string                       `json:"idle_timeout_notice,omitempty"`
	RetentionPeriodMinutes         *int                          `json:"retention_period_minutes,omitempty"`
	RetentionExpiresAt             *Timestamp                    `json:"retention_expires_at,omitempty"`
	LastKnownStopNotice            *string                       `json:"last_known_stop_notice,omitempty"`
}

// CodespacesGitStatus represents the git status of a codespace.
type CodespacesGitStatus struct {
	Ahead                 *int    `json:"ahead,omitempty"`
	Behind                *int    `json:"behind,omitempty"`
	HasUnpushedChanges    *bool   `json:"has_unpushed_changes,omitempty"`
	HasUncommittedChanges *bool   `json:"has_uncommitted_changes,omitempty"`
	Ref                   *string `json:"ref,omitempty"`
}

// CodespacesMachine represents the machine type of a codespace.
type CodespacesMachine struct {
	Name                 *string `json:"name,omitempty"`
	DisplayName          *string `json:"display_name,omitempty"`
	OperatingSystem      *string `json:"operating_system,omitempty"`
	StorageInBytes       *int64  `json:"storage_in_bytes,omitempty"`
	MemoryInBytes        *int64  `json:"memory_in_bytes,omitempty"`
	CPUs                 *int    `json:"cpus,omitempty"`
	PrebuildAvailability *string `json:"prebuild_availability,omitempty"`
}

// CodespacesRuntimeConstraints represents the runtime constraints of a codespace.
type CodespacesRuntimeConstraints struct {
	AllowedPortPrivacySettings []string `json:"allowed_port_privacy_settings,omitempty"`
}

// ListCodespaces represents the response from the list codespaces endpoints.
type ListCodespaces struct {
	TotalCount *int         `json:"total_count,omitempty"`
	Codespaces []*Codespace `json:"codespaces"`
}

// ListInRepo lists codespaces for a user in a repository.
//
// Lists the codespaces associated with a specified repository and the authenticated user.
// You must authenticate using an access token with the codespace scope to use this endpoint.
// GitHub Apps must have read access to the codespaces repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#list-codespaces-in-a-repository-for-the-authenticated-user
//
//meta:operation GET /repos/{owner}/{repo}/codespaces
func (s *CodespacesService) ListInRepo(ctx context.Context, owner, repo string, opts *ListOptions) (*ListCodespaces, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codespaces", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var codespaces *ListCodespaces
	resp, err := s.client.Do(ctx, req, &codespaces)
	if err != nil {
		return nil, resp, err
	}

	return codespaces, resp, nil
}

// ListCodespacesOptions represents the options for listing codespaces for a user.
type ListCodespacesOptions struct {
	ListOptions
	RepositoryID int64 `url:"repository_id,omitempty"`
}

// List lists codespaces for an authenticated user.
//
// Lists the authenticated user's codespaces.
// You must authenticate using an access token with the codespace scope to use this endpoint.
// GitHub Apps must have read access to the codespaces repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#list-codespaces-for-the-authenticated-user
//
//meta:operation GET /user/codespaces
func (s *CodespacesService) List(ctx context.Context, opts *ListCodespacesOptions) (*ListCodespaces, *Response, error) {
	u := "user/codespaces"
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var codespaces *ListCodespaces
	resp, err := s.client.Do(ctx, req, &codespaces)
	if err != nil {
		return nil, resp, err
	}

	return codespaces, resp, nil
}

// CreateCodespaceOptions represents options for the creation of a codespace in a repository.
type CreateCodespaceOptions struct {
	Ref *string `json:"ref,omitempty"`
	// Geo represents the geographic area for this codespace.
	// If not specified, the value is assigned by IP.
	// This property replaces location, which is being deprecated.
	// Geo can be one of: `EuropeWest`, `SoutheastAsia`, `UsEast`, `UsWest`.
	Geo                        *string `json:"geo,omitempty"`
	ClientIP                   *string `json:"client_ip,omitempty"`
	Machine                    *string `json:"machine,omitempty"`
	DevcontainerPath           *string `json:"devcontainer_path,omitempty"`
	MultiRepoPermissionsOptOut *bool   `json:"multi_repo_permissions_opt_out,omitempty"`
	WorkingDirectory           *string `json:"working_directory,omitempty"`
	IdleTimeoutMinutes         *int    `json:"idle_timeout_minutes,omitempty"`
	DisplayName                *string `json:"display_name,omitempty"`
	// RetentionPeriodMinutes represents the duration in minutes after codespace has gone idle in which it will be deleted.
	// Must be integer minutes between 0 and 43200 (30 days).
	RetentionPeriodMinutes *int    `json:"retention_period_minutes,omitempty"`
	Location               *string `json:"location,omitempty"`
}

// DevContainer represents a devcontainer configuration in a repository.
type DevContainer struct {
	Path        string  `json:"path"`
	Name        *string `json:"name,omitempty"`
	DisplayName *string `json:"display_name,omitempty"`
}

// DevContainerConfigurations represents a list of devcontainer configurations in a repository.
type DevContainerConfigurations struct {
	Devcontainers []*DevContainer `json:"devcontainers"`
	TotalCount    int64           `json:"total_count"`
}

// CodespaceDefaults represents default settings for a Codespace.
type CodespaceDefaults struct {
	Location         string  `json:"location"`
	DevcontainerPath *string `json:"devcontainer_path,omitempty"`
}

// CodespaceDefaultAttributes represents the default attributes for codespaces created by the user with the repository.
type CodespaceDefaultAttributes struct {
	BillableOwner *User              `json:"billable_owner"`
	Defaults      *CodespaceDefaults `json:"defaults"`
}

// CodespaceGetDefaultAttributesOptions represents options for getting default attributes for a codespace.
type CodespaceGetDefaultAttributesOptions struct {
	// Ref represents the branch or commit to check for a default devcontainer path. If not specified, the default branch will be checked.
	Ref *string `url:"ref,omitempty"`
	// ClientIP represents an alternative IP for default location auto-detection, such as when proxying a request.
	ClientIP *string `url:"client_ip,omitempty"`
}

// CodespacePullRequestOptions represents options for a CodespacePullRequest.
type CodespacePullRequestOptions struct {
	// PullRequestNumber represents the pull request number.
	PullRequestNumber int64 `json:"pull_request_number"`
	// RepositoryID represents the repository ID for this codespace.
	RepositoryID int64 `json:"repository_id"`
}

// CodespaceCreateForUserOptions represents options for creating a codespace for the authenticated user.
type CodespaceCreateForUserOptions struct {
	PullRequest *CodespacePullRequestOptions `json:"pull_request"`
	// RepositoryID represents the repository ID for this codespace.
	RepositoryID               int64   `json:"repository_id"`
	Ref                        *string `json:"ref,omitempty"`
	Geo                        *string `json:"geo,omitempty"`
	ClientIP                   *string `json:"client_ip,omitempty"`
	RetentionPeriodMinutes     *int    `json:"retention_period_minutes,omitempty"`
	Location                   *string `json:"location,omitempty"`
	Machine                    *string `json:"machine,omitempty"`
	DevcontainerPath           *string `json:"devcontainer_path,omitempty"`
	MultiRepoPermissionsOptOut *bool   `json:"multi_repo_permissions_opt_out,omitempty"`
	WorkingDirectory           *string `json:"working_directory,omitempty"`
	IdleTimeoutMinutes         *int    `json:"idle_timeout_minutes,omitempty"`
	DisplayName                *string `json:"display_name,omitempty"`
}

// UpdateCodespaceOptions represents options for updating a codespace.
type UpdateCodespaceOptions struct {
	// Machine represents a valid machine to transition this codespace to.
	Machine *string `json:"machine,omitempty"`
	// RecentFolders represents the recently opened folders inside the codespace.
	// It is currently used by the clients to determine the folder path to load the codespace in.
	RecentFolders []string `json:"recent_folders,omitempty"`
}

// CodespaceExport represents an export of a codespace.
type CodespaceExport struct {
	// Can be one of: `succeeded`, `failed`, `in_progress`.
	State       *string    `json:"state,omitempty"`
	CompletedAt *Timestamp `json:"completed_at,omitempty"`
	Branch      *string    `json:"branch,omitempty"`
	SHA         *string    `json:"sha,omitempty"`
	ID          *string    `json:"id,omitempty"`
	ExportURL   *string    `json:"export_url,omitempty"`
	HTMLURL     *string    `json:"html_url,omitempty"`
}

// PublishCodespaceOptions represents options for creating a repository from an unpublished codespace.
type PublishCodespaceOptions struct {
	// Name represents the name of the new repository.
	Name *string `json:"name,omitempty"`
	// Private represents whether the new repository is private. Defaults to false.
	Private *bool `json:"private,omitempty"`
}

// CodespacePermissions represents a response indicating whether the permissions defined by a devcontainer have been accepted.
type CodespacePermissions struct {
	Accepted bool `json:"accepted"`
}

// CreateInRepo creates a codespace in a repository.
//
// Creates a codespace owned by the authenticated user in the specified repository.
// You must authenticate using an access token with the codespace scope to use this endpoint.
// GitHub Apps must have write access to the codespaces repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#create-a-codespace-in-a-repository
//
//meta:operation POST /repos/{owner}/{repo}/codespaces
func (s *CodespacesService) CreateInRepo(ctx context.Context, owner, repo string, request *CreateCodespaceOptions) (*Codespace, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codespaces", owner, repo)
	req, err := s.client.NewRequest("POST", u, request)
	if err != nil {
		return nil, nil, err
	}

	var codespace *Codespace
	resp, err := s.client.Do(ctx, req, &codespace)
	if err != nil {
		return nil, resp, err
	}

	return codespace, resp, nil
}

// Start starts a codespace.
//
// You must authenticate using an access token with the codespace scope to use this endpoint.
// GitHub Apps must have write access to the codespaces_lifecycle_admin repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#start-a-codespace-for-the-authenticated-user
//
//meta:operation POST /user/codespaces/{codespace_name}/start
func (s *CodespacesService) Start(ctx context.Context, codespaceName string) (*Codespace, *Response, error) {
	u := fmt.Sprintf("user/codespaces/%v/start", codespaceName)
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var codespace *Codespace
	resp, err := s.client.Do(ctx, req, &codespace)
	if err != nil {
		return nil, resp, err
	}

	return codespace, resp, nil
}

// Stop stops a codespace.
//
// You must authenticate using an access token with the codespace scope to use this endpoint.
// GitHub Apps must have write access to the codespaces_lifecycle_admin repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#stop-a-codespace-for-the-authenticated-user
//
//meta:operation POST /user/codespaces/{codespace_name}/stop
func (s *CodespacesService) Stop(ctx context.Context, codespaceName string) (*Codespace, *Response, error) {
	u := fmt.Sprintf("user/codespaces/%v/stop", codespaceName)
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var codespace *Codespace
	resp, err := s.client.Do(ctx, req, &codespace)
	if err != nil {
		return nil, resp, err
	}

	return codespace, resp, nil
}

// Delete deletes a codespace.
//
// You must authenticate using an access token with the codespace scope to use this endpoint.
// GitHub Apps must have write access to the codespaces repository permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#delete-a-codespace-for-the-authenticated-user
//
//meta:operation DELETE /user/codespaces/{codespace_name}
func (s *CodespacesService) Delete(ctx context.Context, codespaceName string) (*Response, error) {
	u := fmt.Sprintf("user/codespaces/%v", codespaceName)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// ListDevContainerConfigurations lists devcontainer configurations in a repository for the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#list-devcontainer-configurations-in-a-repository-for-the-authenticated-user
//
//meta:operation GET /repos/{owner}/{repo}/codespaces/devcontainers
func (s *CodespacesService) ListDevContainerConfigurations(ctx context.Context, owner, repo string, opts *ListOptions) (*DevContainerConfigurations, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codespaces/devcontainers", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var devcontainers *DevContainerConfigurations
	resp, err := s.client.Do(ctx, req, &devcontainers)
	if err != nil {
		return nil, resp, err
	}

	return devcontainers, resp, nil
}

// GetDefaultAttributes gets the default attributes for codespaces created by the user with the repository.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#get-default-attributes-for-a-codespace
//
//meta:operation GET /repos/{owner}/{repo}/codespaces/new
func (s *CodespacesService) GetDefaultAttributes(ctx context.Context, owner, repo string, opts *CodespaceGetDefaultAttributesOptions) (*CodespaceDefaultAttributes, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codespaces/new", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var attributes *CodespaceDefaultAttributes
	resp, err := s.client.Do(ctx, req, &attributes)
	if err != nil {
		return nil, resp, err
	}

	return attributes, resp, nil
}

// CheckPermissions checks whether the permissions defined by a given devcontainer configuration have been accepted by the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#check-if-permissions-defined-by-a-devcontainer-have-been-accepted-by-the-authenticated-user
//
//meta:operation GET /repos/{owner}/{repo}/codespaces/permissions_check
func (s *CodespacesService) CheckPermissions(ctx context.Context, owner, repo, ref, devcontainerPath string) (*CodespacePermissions, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codespaces/permissions_check", owner, repo)
	u, err := addOptions(u, &struct {
		Ref              string `url:"ref"`
		DevcontainerPath string `url:"devcontainer_path"`
	}{
		Ref:              ref,
		DevcontainerPath: devcontainerPath,
	})
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var permissions *CodespacePermissions
	resp, err := s.client.Do(ctx, req, &permissions)
	if err != nil {
		return nil, resp, err
	}

	return permissions, resp, nil
}

// CreateFromPullRequest creates a codespace owned by the authenticated user for the specified pull request.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#create-a-codespace-from-a-pull-request
//
//meta:operation POST /repos/{owner}/{repo}/pulls/{pull_number}/codespaces
func (s *CodespacesService) CreateFromPullRequest(ctx context.Context, owner, repo string, pullNumber int, request *CreateCodespaceOptions) (*Codespace, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pulls/%v/codespaces", owner, repo, pullNumber)
	req, err := s.client.NewRequest("POST", u, request)
	if err != nil {
		return nil, nil, err
	}

	var codespace *Codespace
	resp, err := s.client.Do(ctx, req, &codespace)
	if err != nil {
		return nil, resp, err
	}

	return codespace, resp, nil
}

// Create creates a new codespace, owned by the authenticated user.
//
// This method requires either RepositoryId OR a PullRequest but not both.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#create-a-codespace-for-the-authenticated-user
//
//meta:operation POST /user/codespaces
func (s *CodespacesService) Create(ctx context.Context, opts *CodespaceCreateForUserOptions) (*Codespace, *Response, error) {
	u := "user/codespaces"
	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	var codespace *Codespace
	resp, err := s.client.Do(ctx, req, &codespace)
	if err != nil {
		return nil, resp, err
	}

	return codespace, resp, nil
}

// Get gets information about a user's codespace.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#get-a-codespace-for-the-authenticated-user
//
//meta:operation GET /user/codespaces/{codespace_name}
func (s *CodespacesService) Get(ctx context.Context, codespaceName string) (*Codespace, *Response, error) {
	u := fmt.Sprintf("user/codespaces/%v", codespaceName)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var codespace *Codespace
	resp, err := s.client.Do(ctx, req, &codespace)
	if err != nil {
		return nil, resp, err
	}

	return codespace, resp, nil
}

// Update updates a codespace owned by the authenticated user.
//
// Only the codespace's machine type and recent folders can be modified using this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#update-a-codespace-for-the-authenticated-user
//
//meta:operation PATCH /user/codespaces/{codespace_name}
func (s *CodespacesService) Update(ctx context.Context, codespaceName string, opts *UpdateCodespaceOptions) (*Codespace, *Response, error) {
	u := fmt.Sprintf("user/codespaces/%v", codespaceName)
	req, err := s.client.NewRequest("PATCH", u, opts)
	if err != nil {
		return nil, nil, err
	}

	var codespace *Codespace
	resp, err := s.client.Do(ctx, req, &codespace)
	if err != nil {
		return nil, resp, err
	}

	return codespace, resp, nil
}

// ExportCodespace triggers an export of the specified codespace and returns a URL and ID where the status of the export can be monitored.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#export-a-codespace-for-the-authenticated-user
//
//meta:operation POST /user/codespaces/{codespace_name}/exports
func (s *CodespacesService) ExportCodespace(ctx context.Context, codespaceName string) (*CodespaceExport, *Response, error) {
	u := fmt.Sprintf("user/codespaces/%v/exports", codespaceName)
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var codespace *CodespaceExport
	resp, err := s.client.Do(ctx, req, &codespace)
	if err != nil {
		return nil, resp, err
	}

	return codespace, resp, nil
}

// GetLatestCodespaceExport gets information about an export of a codespace.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#get-details-about-a-codespace-export
//
//meta:operation GET /user/codespaces/{codespace_name}/exports/{export_id}
func (s *CodespacesService) GetLatestCodespaceExport(ctx context.Context, codespaceName string) (*CodespaceExport, *Response, error) {
	u := fmt.Sprintf("user/codespaces/%v/exports/latest", codespaceName)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var codespace *CodespaceExport
	resp, err := s.client.Do(ctx, req, &codespace)
	if err != nil {
		return nil, resp, err
	}

	return codespace, resp, nil
}

// Publish publishes an unpublished codespace, creating a new repository and assigning it to the codespace.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/codespaces#create-a-repository-from-an-unpublished-codespace
//
//meta:operation POST /user/codespaces/{codespace_name}/publish
func (s *CodespacesService) Publish(ctx context.Context, codespaceName string, opts *PublishCodespaceOptions) (*Codespace, *Response, error) {
	u := fmt.Sprintf("user/codespaces/%v/publish", codespaceName)
	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	var codespace *Codespace
	resp, err := s.client.Do(ctx, req, &codespace)
	if err != nil {
		return nil, resp, err
	}

	return codespace, resp, nil
}
