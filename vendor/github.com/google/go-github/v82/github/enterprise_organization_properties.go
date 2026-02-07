// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// EnterpriseCustomPropertySchema represents the schema response for GetEnterpriseCustomPropertiesSchema.
type EnterpriseCustomPropertySchema struct {
	// An ordered list of the custom property defined in the enterprise.
	Properties []*CustomProperty `json:"properties,omitempty"`
}

// EnterpriseCustomPropertiesValues represents the custom properties values for an organization within an enterprise.
type EnterpriseCustomPropertiesValues struct {
	// The Organization ID that the custom property values will be applied to.
	OrganizationID *int64 `json:"organization_id,omitempty"`
	// The names of organizations that the custom property values will be applied to.
	OrganizationLogin *string `json:"organization_login,omitempty"`
	// List of custom property names and associated values to apply to the organizations.
	Properties []*CustomPropertyValue `json:"properties,omitempty"`
}

// EnterpriseCustomPropertyValuesRequest represents the request to update custom property values for organizations within an enterprise.
type EnterpriseCustomPropertyValuesRequest struct {
	// The names of organizations that the custom property values will be applied to.
	// OrganizationLogin specifies the organization name when updating multiple organizations.
	OrganizationLogin []string `json:"organization_login"`
	// List of custom property names and associated values to apply to the organizations.
	Properties []*CustomPropertyValue `json:"properties"`
}

// GetOrganizationCustomPropertySchema gets all organization custom property definitions that are defined on an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/custom-properties-for-orgs#get-organization-custom-properties-schema-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/org-properties/schema
func (s *EnterpriseService) GetOrganizationCustomPropertySchema(ctx context.Context, enterprise string) (*EnterpriseCustomPropertySchema, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/org-properties/schema", enterprise)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var schema *EnterpriseCustomPropertySchema
	resp, err := s.client.Do(ctx, req, &schema)
	if err != nil {
		return nil, resp, err
	}

	return schema, resp, nil
}

// CreateOrUpdateOrganizationCustomPropertySchema creates new or updates existing organization custom properties defined on an enterprise in a batch.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/custom-properties-for-orgs#create-or-update-organization-custom-property-definitions-on-an-enterprise
//
//meta:operation PATCH /enterprises/{enterprise}/org-properties/schema
func (s *EnterpriseService) CreateOrUpdateOrganizationCustomPropertySchema(ctx context.Context, enterprise string, schema EnterpriseCustomPropertySchema) (*Response, error) {
	u := fmt.Sprintf("enterprises/%v/org-properties/schema", enterprise)
	req, err := s.client.NewRequest("PATCH", u, schema)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// GetOrganizationCustomProperty retrieves a specific organization custom property definition from an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/custom-properties-for-orgs#get-an-organization-custom-property-definition-from-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/org-properties/schema/{custom_property_name}
func (s *EnterpriseService) GetOrganizationCustomProperty(ctx context.Context, enterprise, customPropertyName string) (*CustomProperty, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/org-properties/schema/%v", enterprise, customPropertyName)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var property *CustomProperty
	resp, err := s.client.Do(ctx, req, &property)
	if err != nil {
		return nil, resp, err
	}

	return property, resp, nil
}

// CreateOrUpdateOrganizationCustomProperty creates a new or updates an existing organization custom property definition that is defined on an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/custom-properties-for-orgs#create-or-update-an-organization-custom-property-definition-on-an-enterprise
//
//meta:operation PUT /enterprises/{enterprise}/org-properties/schema/{custom_property_name}
func (s *EnterpriseService) CreateOrUpdateOrganizationCustomProperty(ctx context.Context, enterprise, customPropertyName string, property CustomProperty) (*Response, error) {
	u := fmt.Sprintf("enterprises/%v/org-properties/schema/%v", enterprise, customPropertyName)
	req, err := s.client.NewRequest("PUT", u, property)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// DeleteOrganizationCustomProperty removes an organization custom property definition that is defined on an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/custom-properties-for-orgs#remove-an-organization-custom-property-definition-from-an-enterprise
//
//meta:operation DELETE /enterprises/{enterprise}/org-properties/schema/{custom_property_name}
func (s *EnterpriseService) DeleteOrganizationCustomProperty(ctx context.Context, enterprise, customPropertyName string) (*Response, error) {
	u := fmt.Sprintf("enterprises/%v/org-properties/schema/%v", enterprise, customPropertyName)
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

// ListOrganizationCustomPropertyValues lists enterprise organizations with all of their custom property values.
// Returns a list of organizations and their custom property values defined in the enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/custom-properties-for-orgs#list-custom-property-values-for-organizations-in-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/org-properties/values
func (s *EnterpriseService) ListOrganizationCustomPropertyValues(ctx context.Context, enterprise string, opts *ListOptions) ([]*EnterpriseCustomPropertiesValues, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/org-properties/values", enterprise)

	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var values []*EnterpriseCustomPropertiesValues
	resp, err := s.client.Do(ctx, req, &values)
	if err != nil {
		return nil, resp, err
	}

	return values, resp, nil
}

// CreateOrUpdateOrganizationCustomPropertyValues creates or updates custom property values for organizations in an enterprise.
// To remove a custom property value from an organization, set the property value to null.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/enterprise-admin/custom-properties-for-orgs#create-or-update-custom-property-values-for-organizations-in-an-enterprise
//
//meta:operation PATCH /enterprises/{enterprise}/org-properties/values
func (s *EnterpriseService) CreateOrUpdateOrganizationCustomPropertyValues(ctx context.Context, enterprise string, values EnterpriseCustomPropertyValuesRequest) (*Response, error) {
	u := fmt.Sprintf("enterprises/%v/org-properties/values", enterprise)
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
