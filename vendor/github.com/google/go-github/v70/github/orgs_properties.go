// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

// CustomProperty represents an organization custom property object.
type CustomProperty struct {
	// PropertyName is required for most endpoints except when calling CreateOrUpdateCustomProperty;
	// where this is sent in the path and thus can be omitted.
	PropertyName *string `json:"property_name,omitempty"`
	// SourceType is the source type of the property where it has been created. Can be one of: organization, enterprise.
	SourceType *string `json:"source_type,omitempty"`
	// The type of the value for the property. Can be one of: string, single_select, multi_select, true_false.
	ValueType string `json:"value_type"`
	// Whether the property is required.
	Required *bool `json:"required,omitempty"`
	// Default value of the property.
	DefaultValue *string `json:"default_value,omitempty"`
	// Short description of the property.
	Description *string `json:"description,omitempty"`
	// An ordered list of the allowed values of the property. The property can have up to 200
	// allowed values.
	AllowedValues []string `json:"allowed_values,omitempty"`
	// Who can edit the values of the property. Can be one of: org_actors, org_and_repo_actors, nil (null).
	ValuesEditableBy *string `json:"values_editable_by,omitempty"`
}

// RepoCustomPropertyValue represents a repository custom property value.
type RepoCustomPropertyValue struct {
	RepositoryID       int64                  `json:"repository_id"`
	RepositoryName     string                 `json:"repository_name"`
	RepositoryFullName string                 `json:"repository_full_name"`
	Properties         []*CustomPropertyValue `json:"properties"`
}

// CustomPropertyValue represents a custom property value.
type CustomPropertyValue struct {
	PropertyName string      `json:"property_name"`
	Value        interface{} `json:"value"`
}

// UnmarshalJSON implements the json.Unmarshaler interface.
// This helps us handle the fact that Value can be either a string, []string, or nil.
func (cpv *CustomPropertyValue) UnmarshalJSON(data []byte) error {
	type aliasCustomPropertyValue CustomPropertyValue
	aux := &struct {
		*aliasCustomPropertyValue
	}{
		aliasCustomPropertyValue: (*aliasCustomPropertyValue)(cpv),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	switch v := aux.Value.(type) {
	case nil:
		cpv.Value = nil
	case string:
		cpv.Value = v
	case []interface{}:
		strSlice := make([]string, len(v))
		for i, item := range v {
			str, ok := item.(string)
			if !ok {
				return errors.New("non-string value in string array")
			}
			strSlice[i] = str
		}
		cpv.Value = strSlice
	default:
		return fmt.Errorf("unexpected value type: %T", v)
	}
	return nil
}

// GetAllCustomProperties gets all custom properties that are defined for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/custom-properties#get-all-custom-properties-for-an-organization
//
//meta:operation GET /orgs/{org}/properties/schema
func (s *OrganizationsService) GetAllCustomProperties(ctx context.Context, org string) ([]*CustomProperty, *Response, error) {
	u := fmt.Sprintf("orgs/%v/properties/schema", org)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var customProperties []*CustomProperty
	resp, err := s.client.Do(ctx, req, &customProperties)
	if err != nil {
		return nil, resp, err
	}

	return customProperties, resp, nil
}

// CreateOrUpdateCustomProperties creates new or updates existing custom properties that are defined for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/custom-properties#create-or-update-custom-properties-for-an-organization
//
//meta:operation PATCH /orgs/{org}/properties/schema
func (s *OrganizationsService) CreateOrUpdateCustomProperties(ctx context.Context, org string, properties []*CustomProperty) ([]*CustomProperty, *Response, error) {
	u := fmt.Sprintf("orgs/%v/properties/schema", org)

	params := struct {
		Properties []*CustomProperty `json:"properties"`
	}{
		Properties: properties,
	}

	req, err := s.client.NewRequest("PATCH", u, params)
	if err != nil {
		return nil, nil, err
	}

	var customProperties []*CustomProperty
	resp, err := s.client.Do(ctx, req, &customProperties)
	if err != nil {
		return nil, resp, err
	}

	return customProperties, resp, nil
}

// GetCustomProperty gets a custom property that is defined for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/custom-properties#get-a-custom-property-for-an-organization
//
//meta:operation GET /orgs/{org}/properties/schema/{custom_property_name}
func (s *OrganizationsService) GetCustomProperty(ctx context.Context, org, name string) (*CustomProperty, *Response, error) {
	u := fmt.Sprintf("orgs/%v/properties/schema/%v", org, name)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var customProperty *CustomProperty
	resp, err := s.client.Do(ctx, req, &customProperty)
	if err != nil {
		return nil, resp, err
	}

	return customProperty, resp, nil
}

// CreateOrUpdateCustomProperty creates a new or updates an existing custom property that is defined for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/custom-properties#create-or-update-a-custom-property-for-an-organization
//
//meta:operation PUT /orgs/{org}/properties/schema/{custom_property_name}
func (s *OrganizationsService) CreateOrUpdateCustomProperty(ctx context.Context, org, customPropertyName string, property *CustomProperty) (*CustomProperty, *Response, error) {
	u := fmt.Sprintf("orgs/%v/properties/schema/%v", org, customPropertyName)

	req, err := s.client.NewRequest("PUT", u, property)
	if err != nil {
		return nil, nil, err
	}

	var customProperty *CustomProperty
	resp, err := s.client.Do(ctx, req, &customProperty)
	if err != nil {
		return nil, resp, err
	}

	return customProperty, resp, nil
}

// RemoveCustomProperty removes a custom property that is defined for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/custom-properties#remove-a-custom-property-for-an-organization
//
//meta:operation DELETE /orgs/{org}/properties/schema/{custom_property_name}
func (s *OrganizationsService) RemoveCustomProperty(ctx context.Context, org, customPropertyName string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/properties/schema/%v", org, customPropertyName)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// ListCustomPropertyValues lists all custom property values for repositories in the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/custom-properties#list-custom-property-values-for-organization-repositories
//
//meta:operation GET /orgs/{org}/properties/values
func (s *OrganizationsService) ListCustomPropertyValues(ctx context.Context, org string, opts *ListOptions) ([]*RepoCustomPropertyValue, *Response, error) {
	u := fmt.Sprintf("orgs/%v/properties/values", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var repoCustomPropertyValues []*RepoCustomPropertyValue
	resp, err := s.client.Do(ctx, req, &repoCustomPropertyValues)
	if err != nil {
		return nil, resp, err
	}

	return repoCustomPropertyValues, resp, nil
}

// CreateOrUpdateRepoCustomPropertyValues creates new or updates existing custom property values across multiple repositories for the specified organization.
//
// GitHub API docs: https://docs.github.com/rest/orgs/custom-properties#create-or-update-custom-property-values-for-organization-repositories
//
//meta:operation PATCH /orgs/{org}/properties/values
func (s *OrganizationsService) CreateOrUpdateRepoCustomPropertyValues(ctx context.Context, org string, repoNames []string, properties []*CustomPropertyValue) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/properties/values", org)

	params := struct {
		RepositoryNames []string               `json:"repository_names"`
		Properties      []*CustomPropertyValue `json:"properties"`
	}{
		RepositoryNames: repoNames,
		Properties:      properties,
	}

	req, err := s.client.NewRequest("PATCH", u, params)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
