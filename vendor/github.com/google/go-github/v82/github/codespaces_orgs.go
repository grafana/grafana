// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// CodespacesOrgAccessControlRequest represent request for SetOrgAccessControl.
type CodespacesOrgAccessControlRequest struct {
	// Visibility represent which users can access codespaces in the organization.
	// Can be one of: disabled, selected_members, all_members, all_members_and_outside_collaborators.
	Visibility string `json:"visibility"`
	// SelectedUsernames represent the usernames of the organization members who should have access to codespaces in the organization.
	// Required when visibility is selected_members.
	SelectedUsernames []string `json:"selected_usernames,omitzero"`
}

// ListInOrg lists the codespaces associated to a specified organization.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organizations#list-codespaces-for-the-organization
//
//meta:operation GET /orgs/{org}/codespaces
func (s *CodespacesService) ListInOrg(ctx context.Context, org string, opts *ListOptions) (*ListCodespaces, *Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces", org)
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

// SetOrgAccessControl sets which users can access codespaces in an organization.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organizations#manage-access-control-for-organization-codespaces
//
//meta:operation PUT /orgs/{org}/codespaces/access
func (s *CodespacesService) SetOrgAccessControl(ctx context.Context, org string, request CodespacesOrgAccessControlRequest) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/access", org)
	req, err := s.client.NewRequest("PUT", u, request)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// AddUsersToOrgAccess adds users to Codespaces access for an organization.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organizations#add-users-to-codespaces-access-for-an-organization
//
//meta:operation POST /orgs/{org}/codespaces/access/selected_users
func (s *CodespacesService) AddUsersToOrgAccess(ctx context.Context, org string, usernames []string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/access/selected_users", org)
	req, err := s.client.NewRequest("POST", u, map[string][]string{"selected_usernames": usernames})
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// RemoveUsersFromOrgAccess removes users from Codespaces access for an organization.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organizations#remove-users-from-codespaces-access-for-an-organization
//
//meta:operation DELETE /orgs/{org}/codespaces/access/selected_users
func (s *CodespacesService) RemoveUsersFromOrgAccess(ctx context.Context, org string, usernames []string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/codespaces/access/selected_users", org)
	req, err := s.client.NewRequest("DELETE", u, map[string][]string{"selected_usernames": usernames})
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// ListUserCodespacesInOrg lists the codespaces that a member of an organization has for repositories in that organization.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organizations#list-codespaces-for-a-user-in-organization
//
//meta:operation GET /orgs/{org}/members/{username}/codespaces
func (s *CodespacesService) ListUserCodespacesInOrg(ctx context.Context, org, username string, opts *ListOptions) (*ListCodespaces, *Response, error) {
	u := fmt.Sprintf("orgs/%v/members/%v/codespaces", org, username)
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

// DeleteUserCodespaceInOrg deletes a user's codespace from the organization.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organizations#delete-a-codespace-from-the-organization
//
//meta:operation DELETE /orgs/{org}/members/{username}/codespaces/{codespace_name}
func (s *CodespacesService) DeleteUserCodespaceInOrg(ctx context.Context, org, username, codespaceName string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/members/%v/codespaces/%v", org, username, codespaceName)
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

// StopUserCodespaceInOrg stops a codespace for an organization user.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/organizations#stop-a-codespace-for-an-organization-user
//
//meta:operation POST /orgs/{org}/members/{username}/codespaces/{codespace_name}/stop
func (s *CodespacesService) StopUserCodespaceInOrg(ctx context.Context, org, username, codespaceName string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/members/%v/codespaces/%v/stop", org, username, codespaceName)
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}
