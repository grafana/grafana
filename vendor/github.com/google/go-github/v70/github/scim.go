// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"fmt"
)

// SCIMService provides access to SCIM related functions in the
// GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/scim
type SCIMService service

// SCIMGroupAttributes represents supported SCIM Group attributes.
//
// GitHub API docs: https://docs.github.com/en/enterprise-cloud@latest/rest/enterprise-admin/scim#list-provisioned-scim-groups-for-an-enterprise
type SCIMGroupAttributes struct {
	DisplayName *string                 `json:"displayName,omitempty"` // The name of the group, suitable for display to end-users. (Optional.)
	Members     []*SCIMDisplayReference `json:"members,omitempty"`     // (Optional.)
	Schemas     []string                `json:"schemas,omitempty"`     // (Optional.)
	ExternalID  *string                 `json:"externalId,omitempty"`  // (Optional.)
	// Only populated as a result of calling ListSCIMProvisionedIdentitiesOptions:
	ID   *string   `json:"id,omitempty"`
	Meta *SCIMMeta `json:"meta,omitempty"`
}

// SCIMDisplayReference represents a JSON SCIM (System for Cross-domain Identity Management) resource.
type SCIMDisplayReference struct {
	Value   string  `json:"value"`             // (Required.)
	Ref     string  `json:"$ref"`              // (Required.)
	Display *string `json:"display,omitempty"` // (Optional.)
}

// SCIMUserAttributes represents supported SCIM User attributes.
//
// GitHub API docs: https://docs.github.com/rest/scim#supported-scim-user-attributes
type SCIMUserAttributes struct {
	UserName    string           `json:"userName"`              // Configured by the admin. Could be an email, login, or username. (Required.)
	Name        SCIMUserName     `json:"name"`                  // (Required.)
	DisplayName *string          `json:"displayName,omitempty"` // The name of the user, suitable for display to end-users. (Optional.)
	Emails      []*SCIMUserEmail `json:"emails"`                // User emails. (Required.)
	Schemas     []string         `json:"schemas,omitempty"`     // (Optional.)
	ExternalID  *string          `json:"externalId,omitempty"`  // (Optional.)
	Groups      []string         `json:"groups,omitempty"`      // (Optional.)
	Active      *bool            `json:"active,omitempty"`      // (Optional.)
	// Only populated as a result of calling ListSCIMProvisionedIdentitiesOptions or GetSCIMProvisioningInfoForUser:
	ID   *string   `json:"id,omitempty"`
	Meta *SCIMMeta `json:"meta,omitempty"`
}

// SCIMUserName represents SCIM user information.
type SCIMUserName struct {
	GivenName  string  `json:"givenName"`           // The first name of the user. (Required.)
	FamilyName string  `json:"familyName"`          // The family name of the user. (Required.)
	Formatted  *string `json:"formatted,omitempty"` // (Optional.)
}

// SCIMUserEmail represents SCIM user email.
type SCIMUserEmail struct {
	Value   string  `json:"value"`             // (Required.)
	Primary *bool   `json:"primary,omitempty"` // (Optional.)
	Type    *string `json:"type,omitempty"`    // (Optional.)
}

// SCIMMeta represents metadata about the SCIM resource.
type SCIMMeta struct {
	ResourceType *string    `json:"resourceType,omitempty"`
	Created      *Timestamp `json:"created,omitempty"`
	LastModified *Timestamp `json:"lastModified,omitempty"`
	Location     *string    `json:"location,omitempty"`
}

// SCIMProvisionedGroups represents the result of calling ListSCIMProvisionedGroupsForEnterprise.
type SCIMProvisionedGroups struct {
	Schemas      []string               `json:"schemas,omitempty"`
	TotalResults *int                   `json:"totalResults,omitempty"`
	ItemsPerPage *int                   `json:"itemsPerPage,omitempty"`
	StartIndex   *int                   `json:"startIndex,omitempty"`
	Resources    []*SCIMGroupAttributes `json:"Resources,omitempty"`
}

// SCIMProvisionedIdentities represents the result of calling ListSCIMProvisionedIdentities.
type SCIMProvisionedIdentities struct {
	Schemas      []string              `json:"schemas,omitempty"`
	TotalResults *int                  `json:"totalResults,omitempty"`
	ItemsPerPage *int                  `json:"itemsPerPage,omitempty"`
	StartIndex   *int                  `json:"startIndex,omitempty"`
	Resources    []*SCIMUserAttributes `json:"Resources,omitempty"`
}

// ListSCIMProvisionedIdentitiesOptions represents options for ListSCIMProvisionedIdentities.
//
// GitHub API docs: https://docs.github.com/rest/scim#list-scim-provisioned-identities--parameters
type ListSCIMProvisionedIdentitiesOptions struct {
	StartIndex *int `url:"startIndex,omitempty"` // Used for pagination: the index of the first result to return. (Optional.)
	Count      *int `url:"count,omitempty"`      // Used for pagination: the number of results to return. (Optional.)
	// Filter results using the equals query parameter operator (eq).
	// You can filter results that are equal to id, userName, emails, and external_id.
	// For example, to search for an identity with the userName Octocat, you would use this query: ?filter=userName%20eq%20\"Octocat\".
	// To filter results for the identity with the email octocat@github.com, you would use this query: ?filter=emails%20eq%20\"octocat@github.com\".
	// (Optional.)
	Filter *string `url:"filter,omitempty"`
}

// ListSCIMProvisionedIdentities lists SCIM provisioned identities.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/scim/scim#list-scim-provisioned-identities
//
//meta:operation GET /scim/v2/organizations/{org}/Users
func (s *SCIMService) ListSCIMProvisionedIdentities(ctx context.Context, org string, opts *ListSCIMProvisionedIdentitiesOptions) (*SCIMProvisionedIdentities, *Response, error) {
	u := fmt.Sprintf("scim/v2/organizations/%v/Users", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	identities := new(SCIMProvisionedIdentities)
	resp, err := s.client.Do(ctx, req, identities)
	if err != nil {
		return nil, resp, err
	}

	return identities, resp, nil
}

// ProvisionAndInviteSCIMUser provisions organization membership for a user, and sends an activation email to the email address.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/scim/scim#provision-and-invite-a-scim-user
//
//meta:operation POST /scim/v2/organizations/{org}/Users
func (s *SCIMService) ProvisionAndInviteSCIMUser(ctx context.Context, org string, opts *SCIMUserAttributes) (*SCIMUserAttributes, *Response, error) {
	u := fmt.Sprintf("scim/v2/organizations/%v/Users", org)

	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	user := new(SCIMUserAttributes)
	resp, err := s.client.Do(ctx, req, user)
	if err != nil {
		return nil, resp, err
	}

	return user, resp, nil
}

// GetSCIMProvisioningInfoForUser returns SCIM provisioning information for a user.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/scim/scim#get-scim-provisioning-information-for-a-user
//
//meta:operation GET /scim/v2/organizations/{org}/Users/{scim_user_id}
func (s *SCIMService) GetSCIMProvisioningInfoForUser(ctx context.Context, org, scimUserID string) (*SCIMUserAttributes, *Response, error) {
	u := fmt.Sprintf("scim/v2/organizations/%v/Users/%v", org, scimUserID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	user := new(SCIMUserAttributes)
	resp, err := s.client.Do(ctx, req, &user)
	if err != nil {
		return nil, resp, err
	}

	return user, resp, nil
}

// UpdateProvisionedOrgMembership updates a provisioned organization membership.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/scim/scim#update-a-provisioned-organization-membership
//
//meta:operation PUT /scim/v2/organizations/{org}/Users/{scim_user_id}
func (s *SCIMService) UpdateProvisionedOrgMembership(ctx context.Context, org, scimUserID string, opts *SCIMUserAttributes) (*Response, error) {
	u := fmt.Sprintf("scim/v2/organizations/%v/Users/%v", org, scimUserID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, err
	}

	req, err := s.client.NewRequest("PUT", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// UpdateAttributeForSCIMUserOptions represents options for UpdateAttributeForSCIMUser.
//
// GitHub API docs: https://docs.github.com/rest/scim#update-an-attribute-for-a-scim-user--parameters
type UpdateAttributeForSCIMUserOptions struct {
	Schemas    []string                             `json:"schemas,omitempty"` // (Optional.)
	Operations UpdateAttributeForSCIMUserOperations `json:"operations"`        // Set of operations to be performed. (Required.)
}

// UpdateAttributeForSCIMUserOperations represents operations for UpdateAttributeForSCIMUser.
type UpdateAttributeForSCIMUserOperations struct {
	Op    string          `json:"op"`              // (Required.)
	Path  *string         `json:"path,omitempty"`  // (Optional.)
	Value json.RawMessage `json:"value,omitempty"` // (Optional.)
}

// UpdateAttributeForSCIMUser updates an attribute for an SCIM user.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/scim/scim#update-an-attribute-for-a-scim-user
//
//meta:operation PATCH /scim/v2/organizations/{org}/Users/{scim_user_id}
func (s *SCIMService) UpdateAttributeForSCIMUser(ctx context.Context, org, scimUserID string, opts *UpdateAttributeForSCIMUserOptions) (*Response, error) {
	u := fmt.Sprintf("scim/v2/organizations/%v/Users/%v", org, scimUserID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, err
	}

	req, err := s.client.NewRequest("PATCH", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// DeleteSCIMUserFromOrg deletes SCIM user from an organization.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/scim/scim#delete-a-scim-user-from-an-organization
//
//meta:operation DELETE /scim/v2/organizations/{org}/Users/{scim_user_id}
func (s *SCIMService) DeleteSCIMUserFromOrg(ctx context.Context, org, scimUserID string) (*Response, error) {
	u := fmt.Sprintf("scim/v2/organizations/%v/Users/%v", org, scimUserID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// ListSCIMProvisionedGroupsForEnterprise lists SCIM provisioned groups for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/scim#list-provisioned-scim-groups-for-an-enterprise
//
//meta:operation GET /scim/v2/enterprises/{enterprise}/Groups
func (s *SCIMService) ListSCIMProvisionedGroupsForEnterprise(ctx context.Context, enterprise string, opts *ListSCIMProvisionedIdentitiesOptions) (*SCIMProvisionedGroups, *Response, error) {
	u := fmt.Sprintf("scim/v2/enterprises/%v/Groups", enterprise)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	groups := new(SCIMProvisionedGroups)
	resp, err := s.client.Do(ctx, req, groups)
	if err != nil {
		return nil, resp, err
	}

	return groups, resp, nil
}
