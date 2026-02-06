// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// SecretScanningPatternConfigs represents a collection of GitHub secret scanning patterns
// and their settings related to push protection.
type SecretScanningPatternConfigs struct {
	PatternConfigVersion     *string                          `json:"pattern_config_version,omitempty"`
	ProviderPatternOverrides []*SecretScanningPatternOverride `json:"provider_pattern_overrides,omitempty"`
	CustomPatternOverrides   []*SecretScanningPatternOverride `json:"custom_pattern_overrides,omitempty"`
}

// SecretScanningPatternOverride represents an override for provider partner or custom organization patterns.
type SecretScanningPatternOverride struct {
	TokenType            *string `json:"token_type,omitempty"`
	CustomPatternVersion *string `json:"custom_pattern_version,omitempty"`
	Slug                 *string `json:"slug,omitempty"`
	DisplayName          *string `json:"display_name,omitempty"`
	AlertTotal           *int    `json:"alert_total,omitempty"`
	AlertTotalPercentage *int    `json:"alert_total_percentage,omitempty"`
	FalsePositives       *int    `json:"false_positives,omitempty"`
	FalsePositiveRate    *int    `json:"false_positive_rate,omitempty"`
	Bypassrate           *int    `json:"bypass_rate,omitempty"`
	DefaultSetting       *string `json:"default_setting,omitempty"`
	EnterpriseSetting    *string `json:"enterprise_setting,omitempty"`
	Setting              *string `json:"setting,omitempty"`
}

// SecretScanningPatternConfigsUpdate represents a secret scanning pattern configurations update.
type SecretScanningPatternConfigsUpdate struct {
	PatternConfigVersion *string `json:"pattern_config_version,omitempty"`
}

// SecretScanningPatternConfigsUpdateOptions specifies optional parameters to
// the SecretScanningService.UpdatePatternConfigsForEnterprise method and
// the SecretScanningService.UpdatePatternConfigsForOrg method.
type SecretScanningPatternConfigsUpdateOptions struct {
	// The version of the entity.
	PatternConfigVersion *string `json:"pattern_config_version,omitempty"`

	// Pattern settings for provider patterns.
	ProviderPatternSettings []*SecretScanningProviderPatternSetting `json:"provider_pattern_settings,omitempty"`

	// Pattern settings for custom patterns.
	CustomPatternSettings []*SecretScanningCustomPatternSetting `json:"custom_pattern_settings,omitempty"`
}

// SecretScanningProviderPatternSetting defines an optional pattern setting for provider patterns.
type SecretScanningProviderPatternSetting struct {
	// The ID of the pattern to configure.
	TokenType string `json:"token_type"`

	// Push protection setting to set for the pattern.
	// Can be one of: "not-set", "disabled", "enabled"
	PushProtectionSetting string `json:"push_protection_setting"`
}

// SecretScanningCustomPatternSetting defines an optional pattern setting for custom patterns.
type SecretScanningCustomPatternSetting struct {
	// The ID of the pattern to configure.
	TokenType string `json:"token_type"`

	// The version of the entity
	CustomPatternVersion *string `json:"custom_pattern_version,omitempty"`

	// Push protection setting to set for the pattern.
	// Can be one of: "not-set", "disabled", "enabled"
	PushProtectionSetting string `json:"push_protection_setting"`
}

// ListPatternConfigsForEnterprise lists the secret scanning pattern configurations for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/secret-scanning/push-protection#list-enterprise-pattern-configurations
//
//meta:operation GET /enterprises/{enterprise}/secret-scanning/pattern-configurations
func (s *SecretScanningService) ListPatternConfigsForEnterprise(ctx context.Context, enterprise string) (*SecretScanningPatternConfigs, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/secret-scanning/pattern-configurations", enterprise)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var patternConfigs *SecretScanningPatternConfigs
	resp, err := s.client.Do(ctx, req, &patternConfigs)
	if err != nil {
		return nil, resp, err
	}

	return patternConfigs, resp, nil
}

// ListPatternConfigsForOrg lists the secret scanning pattern configurations for an organization.
//
// GitHub API docs: https://docs.github.com/rest/secret-scanning/push-protection#list-organization-pattern-configurations
//
//meta:operation GET /orgs/{org}/secret-scanning/pattern-configurations
func (s *SecretScanningService) ListPatternConfigsForOrg(ctx context.Context, org string) (*SecretScanningPatternConfigs, *Response, error) {
	u := fmt.Sprintf("orgs/%v/secret-scanning/pattern-configurations", org)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var patternConfigs *SecretScanningPatternConfigs
	resp, err := s.client.Do(ctx, req, &patternConfigs)
	if err != nil {
		return nil, resp, err
	}

	return patternConfigs, resp, nil
}

// UpdatePatternConfigsForEnterprise updates the secret scanning pattern configurations for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/secret-scanning/push-protection#update-enterprise-pattern-configurations
//
//meta:operation PATCH /enterprises/{enterprise}/secret-scanning/pattern-configurations
func (s *SecretScanningService) UpdatePatternConfigsForEnterprise(ctx context.Context, enterprise string, opts *SecretScanningPatternConfigsUpdateOptions) (*SecretScanningPatternConfigsUpdate, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/secret-scanning/pattern-configurations", enterprise)

	req, err := s.client.NewRequest("PATCH", u, opts)
	if err != nil {
		return nil, nil, err
	}

	var patternConfigsUpdate *SecretScanningPatternConfigsUpdate
	resp, err := s.client.Do(ctx, req, &patternConfigsUpdate)
	if err != nil {
		return nil, resp, err
	}

	return patternConfigsUpdate, resp, nil
}

// UpdatePatternConfigsForOrg updates the secret scanning pattern configurations for an organization.
//
// GitHub API docs: https://docs.github.com/rest/secret-scanning/push-protection#update-organization-pattern-configurations
//
//meta:operation PATCH /orgs/{org}/secret-scanning/pattern-configurations
func (s *SecretScanningService) UpdatePatternConfigsForOrg(ctx context.Context, org string, opts *SecretScanningPatternConfigsUpdateOptions) (*SecretScanningPatternConfigsUpdate, *Response, error) {
	u := fmt.Sprintf("orgs/%v/secret-scanning/pattern-configurations", org)

	req, err := s.client.NewRequest("PATCH", u, opts)
	if err != nil {
		return nil, nil, err
	}

	var patternConfigsUpdate *SecretScanningPatternConfigsUpdate
	resp, err := s.client.Do(ctx, req, &patternConfigsUpdate)
	if err != nil {
		return nil, resp, err
	}

	return patternConfigsUpdate, resp, nil
}
