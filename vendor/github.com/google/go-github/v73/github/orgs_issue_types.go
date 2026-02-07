// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// CreateOrUpdateIssueTypesOptions represents the parameters for creating or updating an issue type.
type CreateOrUpdateIssueTypesOptions struct {
	Name        string  `json:"name"`                  // Name of the issue type. (Required.)
	IsEnabled   bool    `json:"is_enabled"`            // Whether or not the issue type is enabled at the organization level. (Required.)
	IsPrivate   *bool   `json:"is_private,omitempty"`  // Whether or not the issue type is restricted to issues in private repositories. (Optional.)
	Description *string `json:"description,omitempty"` // Description of the issue type. (Optional.)
	Color       *string `json:"color,omitempty"`       // Color for the issue type. Can be one of "gray", "blue", green "orange", "red", "pink", "purple", "null". (Optional.)
}

// ListIssueTypes lists all issue types for an organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/issue-types#list-issue-types-for-an-organization
//
//meta:operation GET /orgs/{org}/issue-types
func (s *OrganizationsService) ListIssueTypes(ctx context.Context, org string) ([]*IssueType, *Response, error) {
	u := fmt.Sprintf("orgs/%v/issue-types", org)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var issueTypes []*IssueType
	resp, err := s.client.Do(ctx, req, &issueTypes)
	if err != nil {
		return nil, resp, err
	}

	return issueTypes, resp, nil
}

// CreateIssueType creates a new issue type for an organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/issue-types#create-issue-type-for-an-organization
//
//meta:operation POST /orgs/{org}/issue-types
func (s *OrganizationsService) CreateIssueType(ctx context.Context, org string, opt *CreateOrUpdateIssueTypesOptions) (*IssueType, *Response, error) {
	u := fmt.Sprintf("orgs/%v/issue-types", org)
	req, err := s.client.NewRequest("POST", u, opt)
	if err != nil {
		return nil, nil, err
	}

	issueType := new(IssueType)
	resp, err := s.client.Do(ctx, req, issueType)
	if err != nil {
		return nil, resp, err
	}

	return issueType, resp, nil
}

// UpdateIssueType updates GitHub Pages for the named repo.
//
// GitHub API docs: https://docs.github.com/rest/orgs/issue-types#update-issue-type-for-an-organization
//
//meta:operation PUT /orgs/{org}/issue-types/{issue_type_id}
func (s *OrganizationsService) UpdateIssueType(ctx context.Context, org string, issueTypeID int64, opt *CreateOrUpdateIssueTypesOptions) (*IssueType, *Response, error) {
	u := fmt.Sprintf("orgs/%v/issue-types/%v", org, issueTypeID)
	req, err := s.client.NewRequest("PUT", u, opt)
	if err != nil {
		return nil, nil, err
	}

	issueType := new(IssueType)
	resp, err := s.client.Do(ctx, req, issueType)
	if err != nil {
		return nil, resp, err
	}

	return issueType, resp, nil
}

// DeleteIssueType deletes an issue type for an organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/issue-types#delete-issue-type-for-an-organization
//
//meta:operation DELETE /orgs/{org}/issue-types/{issue_type_id}
func (s *OrganizationsService) DeleteIssueType(ctx context.Context, org string, issueTypeID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/issue-types/%d", org, issueTypeID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
