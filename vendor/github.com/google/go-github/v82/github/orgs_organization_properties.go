// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// OrganizationCustomPropertyValues represents the custom property values for an organization.
type OrganizationCustomPropertyValues struct {
	// List of custom property names and associated values to apply to the organization.
	Properties []*CustomPropertyValue `json:"properties,omitempty"`
}

// GetOrganizationCustomPropertyValues returns all custom property names and their values for an organization.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/orgs/custom-properties-for-orgs#get-all-custom-property-values-for-an-organization
//
//meta:operation GET /organizations/{org}/org-properties/values
func (s *OrganizationsService) GetOrganizationCustomPropertyValues(ctx context.Context, org string) ([]*CustomPropertyValue, *Response, error) {
	u := fmt.Sprintf("organizations/%v/org-properties/values", org)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var values []*CustomPropertyValue
	resp, err := s.client.Do(ctx, req, &values)
	if err != nil {
		return nil, resp, err
	}

	return values, resp, nil
}

// CreateOrUpdateOrganizationCustomPropertyValues creates or updates custom property values for an organization.
// To remove a custom property value from an organization, set the property value to null.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/orgs/custom-properties-for-orgs#create-or-update-custom-property-values-for-an-organization
//
//meta:operation PATCH /organizations/{org}/org-properties/values
func (s *OrganizationsService) CreateOrUpdateOrganizationCustomPropertyValues(ctx context.Context, org string, values OrganizationCustomPropertyValues) (*Response, error) {
	u := fmt.Sprintf("organizations/%v/org-properties/values", org)
	req, err := s.client.NewRequest("PATCH", u, values)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}
