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
	RetentionPeriodMinutes *int `json:"retention_period_minutes,omitempty"`
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
