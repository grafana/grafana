// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// OrganizationCustomRoles represents custom organization roles available in specified organization.
type OrganizationCustomRoles struct {
	TotalCount      *int              `json:"total_count,omitempty"`
	CustomRepoRoles []*CustomOrgRoles `json:"roles,omitempty"`
}

// CustomOrgRoles represents custom organization role available in specified organization.
type CustomOrgRoles struct {
	ID          *int64        `json:"id,omitempty"`
	Name        *string       `json:"name,omitempty"`
	Description *string       `json:"description,omitempty"`
	Permissions []string      `json:"permissions,omitempty"`
	Org         *Organization `json:"organization,omitempty"`
	CreatedAt   *Timestamp    `json:"created_at,omitempty"`
	UpdatedAt   *Timestamp    `json:"updated_at,omitempty"`
	Source      *string       `json:"source,omitempty"`
	BaseRole    *string       `json:"base_role,omitempty"`
}

// OrganizationCustomRepoRoles represents custom repository roles available in specified organization.
type OrganizationCustomRepoRoles struct {
	TotalCount      *int               `json:"total_count,omitempty"`
	CustomRepoRoles []*CustomRepoRoles `json:"custom_roles,omitempty"`
}

// CustomRepoRoles represents custom repository roles for an organization.
// See https://docs.github.com/enterprise-cloud@latest/organizations/managing-peoples-access-to-your-organization-with-roles/managing-custom-repository-roles-for-an-organization
// for more information.
type CustomRepoRoles struct {
	ID          *int64        `json:"id,omitempty"`
	Name        *string       `json:"name,omitempty"`
	Description *string       `json:"description,omitempty"`
	BaseRole    *string       `json:"base_role,omitempty"`
	Permissions []string      `json:"permissions,omitempty"`
	Org         *Organization `json:"organization,omitempty"`
	CreatedAt   *Timestamp    `json:"created_at,omitempty"`
	UpdatedAt   *Timestamp    `json:"updated_at,omitempty"`
}

// CreateOrUpdateOrgRoleOptions represents options required to create or update a custom organization role.
type CreateOrUpdateOrgRoleOptions struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Permissions []string `json:"permissions"`
}

// CreateOrUpdateCustomRepoRoleOptions represents options required to create or update a custom repository role.
type CreateOrUpdateCustomRepoRoleOptions struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	BaseRole    *string  `json:"base_role,omitempty"`
	Permissions []string `json:"permissions"`
}

// ListRoles lists the custom roles available in this organization.
// In order to see custom roles in an organization, the authenticated user must be an organization owner.
//
// GitHub API docs: https://docs.github.com/rest/orgs/organization-roles#get-all-organization-roles-for-an-organization
//
//meta:operation GET /orgs/{org}/organization-roles
func (s *OrganizationsService) ListRoles(ctx context.Context, org string) (*OrganizationCustomRoles, *Response, error) {
	u := fmt.Sprintf("orgs/%v/organization-roles", org)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	customRepoRoles := new(OrganizationCustomRoles)
	resp, err := s.client.Do(ctx, req, customRepoRoles)
	if err != nil {
		return nil, resp, err
	}

	return customRepoRoles, resp, nil
}

// CreateCustomOrgRole creates a custom role in this organization.
// In order to create custom roles in an organization, the authenticated user must be an organization owner.
//
// GitHub API docs: https://docs.github.com/rest/orgs/organization-roles#create-a-custom-organization-role
//
//meta:operation POST /orgs/{org}/organization-roles
func (s *OrganizationsService) CreateCustomOrgRole(ctx context.Context, org string, opts *CreateOrUpdateOrgRoleOptions) (*CustomOrgRoles, *Response, error) {
	u := fmt.Sprintf("orgs/%v/organization-roles", org)

	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	resultingRole := new(CustomOrgRoles)
	resp, err := s.client.Do(ctx, req, resultingRole)
	if err != nil {
		return nil, resp, err
	}

	return resultingRole, resp, err
}

// UpdateCustomOrgRole updates a custom role in this organization.
// In order to update custom roles in an organization, the authenticated user must be an organization owner.
//
// GitHub API docs: https://docs.github.com/rest/orgs/organization-roles#update-a-custom-organization-role
//
//meta:operation PATCH /orgs/{org}/organization-roles/{role_id}
func (s *OrganizationsService) UpdateCustomOrgRole(ctx context.Context, org string, roleID int64, opts *CreateOrUpdateOrgRoleOptions) (*CustomOrgRoles, *Response, error) {
	u := fmt.Sprintf("orgs/%v/organization-roles/%v", org, roleID)

	req, err := s.client.NewRequest("PATCH", u, opts)
	if err != nil {
		return nil, nil, err
	}

	resultingRole := new(CustomOrgRoles)
	resp, err := s.client.Do(ctx, req, resultingRole)
	if err != nil {
		return nil, resp, err
	}

	return resultingRole, resp, err
}

// DeleteCustomOrgRole deletes an existing custom role in this organization.
// In order to delete custom roles in an organization, the authenticated user must be an organization owner.
//
// GitHub API docs: https://docs.github.com/rest/orgs/organization-roles#delete-a-custom-organization-role
//
//meta:operation DELETE /orgs/{org}/organization-roles/{role_id}
func (s *OrganizationsService) DeleteCustomOrgRole(ctx context.Context, org string, roleID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/organization-roles/%v", org, roleID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	resultingRole := new(CustomOrgRoles)
	resp, err := s.client.Do(ctx, req, resultingRole)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// ListCustomRepoRoles lists the custom repository roles available in this organization.
// In order to see custom repository roles in an organization, the authenticated user must be an organization owner.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/orgs/custom-roles#list-custom-repository-roles-in-an-organization
//
//meta:operation GET /orgs/{org}/custom-repository-roles
func (s *OrganizationsService) ListCustomRepoRoles(ctx context.Context, org string) (*OrganizationCustomRepoRoles, *Response, error) {
	u := fmt.Sprintf("orgs/%v/custom-repository-roles", org)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	customRepoRoles := new(OrganizationCustomRepoRoles)
	resp, err := s.client.Do(ctx, req, customRepoRoles)
	if err != nil {
		return nil, resp, err
	}

	return customRepoRoles, resp, nil
}

// CreateCustomRepoRole creates a custom repository role in this organization.
// In order to create custom repository roles in an organization, the authenticated user must be an organization owner.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/orgs/custom-roles#create-a-custom-repository-role
//
//meta:operation POST /orgs/{org}/custom-repository-roles
func (s *OrganizationsService) CreateCustomRepoRole(ctx context.Context, org string, opts *CreateOrUpdateCustomRepoRoleOptions) (*CustomRepoRoles, *Response, error) {
	u := fmt.Sprintf("orgs/%v/custom-repository-roles", org)

	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	resultingRole := new(CustomRepoRoles)
	resp, err := s.client.Do(ctx, req, resultingRole)
	if err != nil {
		return nil, resp, err
	}

	return resultingRole, resp, err
}

// UpdateCustomRepoRole updates a custom repository role in this organization.
// In order to update custom repository roles in an organization, the authenticated user must be an organization owner.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/orgs/custom-roles#update-a-custom-repository-role
//
//meta:operation PATCH /orgs/{org}/custom-repository-roles/{role_id}
func (s *OrganizationsService) UpdateCustomRepoRole(ctx context.Context, org string, roleID int64, opts *CreateOrUpdateCustomRepoRoleOptions) (*CustomRepoRoles, *Response, error) {
	u := fmt.Sprintf("orgs/%v/custom-repository-roles/%v", org, roleID)

	req, err := s.client.NewRequest("PATCH", u, opts)
	if err != nil {
		return nil, nil, err
	}

	resultingRole := new(CustomRepoRoles)
	resp, err := s.client.Do(ctx, req, resultingRole)
	if err != nil {
		return nil, resp, err
	}

	return resultingRole, resp, err
}

// DeleteCustomRepoRole deletes an existing custom repository role in this organization.
// In order to delete custom repository roles in an organization, the authenticated user must be an organization owner.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/orgs/custom-roles#delete-a-custom-repository-role
//
//meta:operation DELETE /orgs/{org}/custom-repository-roles/{role_id}
func (s *OrganizationsService) DeleteCustomRepoRole(ctx context.Context, org string, roleID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/custom-repository-roles/%v", org, roleID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	resultingRole := new(CustomRepoRoles)
	resp, err := s.client.Do(ctx, req, resultingRole)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// ListTeamsAssignedToOrgRole returns all teams assigned to a specific organization role.
// In order to list teams assigned to an organization role, the authenticated user must be an organization owner.
//
// GitHub API docs: https://docs.github.com/rest/orgs/organization-roles#list-teams-that-are-assigned-to-an-organization-role
//
//meta:operation GET /orgs/{org}/organization-roles/{role_id}/teams
func (s *OrganizationsService) ListTeamsAssignedToOrgRole(ctx context.Context, org string, roleID int64, opts *ListOptions) ([]*Team, *Response, error) {
	u := fmt.Sprintf("orgs/%v/organization-roles/%v/teams", org, roleID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var teams []*Team
	resp, err := s.client.Do(ctx, req, &teams)
	if err != nil {
		return nil, resp, err
	}

	return teams, resp, nil
}

// ListUsersAssignedToOrgRole returns all users assigned to a specific organization role.
// In order to list users assigned to an organization role, the authenticated user must be an organization owner.
//
// GitHub API docs: https://docs.github.com/rest/orgs/organization-roles#list-users-that-are-assigned-to-an-organization-role
//
//meta:operation GET /orgs/{org}/organization-roles/{role_id}/users
func (s *OrganizationsService) ListUsersAssignedToOrgRole(ctx context.Context, org string, roleID int64, opts *ListOptions) ([]*User, *Response, error) {
	u := fmt.Sprintf("orgs/%v/organization-roles/%v/users", org, roleID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var users []*User
	resp, err := s.client.Do(ctx, req, &users)
	if err != nil {
		return nil, resp, err
	}

	return users, resp, nil
}
