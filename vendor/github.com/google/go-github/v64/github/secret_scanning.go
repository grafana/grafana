// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// SecretScanningService handles communication with the secret scanning related
// methods of the GitHub API.
type SecretScanningService service

// SecretScanningAlert represents a GitHub secret scanning alert.
type SecretScanningAlert struct {
	Number                   *int        `json:"number,omitempty"`
	CreatedAt                *Timestamp  `json:"created_at,omitempty"`
	URL                      *string     `json:"url,omitempty"`
	HTMLURL                  *string     `json:"html_url,omitempty"`
	LocationsURL             *string     `json:"locations_url,omitempty"`
	State                    *string     `json:"state,omitempty"`
	Resolution               *string     `json:"resolution,omitempty"`
	ResolvedAt               *Timestamp  `json:"resolved_at,omitempty"`
	ResolvedBy               *User       `json:"resolved_by,omitempty"`
	SecretType               *string     `json:"secret_type,omitempty"`
	SecretTypeDisplayName    *string     `json:"secret_type_display_name,omitempty"`
	Secret                   *string     `json:"secret,omitempty"`
	Repository               *Repository `json:"repository,omitempty"`
	UpdatedAt                *Timestamp  `json:"updated_at,omitempty"`
	PushProtectionBypassed   *bool       `json:"push_protection_bypassed,omitempty"`
	PushProtectionBypassedBy *User       `json:"push_protection_bypassed_by,omitempty"`
	PushProtectionBypassedAt *Timestamp  `json:"push_protection_bypassed_at,omitempty"`
	ResolutionComment        *string     `json:"resolution_comment,omitempty"`
}

// SecretScanningAlertLocation represents the location for a secret scanning alert.
type SecretScanningAlertLocation struct {
	Type    *string                             `json:"type,omitempty"`
	Details *SecretScanningAlertLocationDetails `json:"details,omitempty"`
}

// SecretScanningAlertLocationDetails represents the location details for a secret scanning alert.
type SecretScanningAlertLocationDetails struct {
	Path        *string `json:"path,omitempty"`
	Startline   *int    `json:"start_line,omitempty"`
	EndLine     *int    `json:"end_line,omitempty"`
	StartColumn *int    `json:"start_column,omitempty"`
	EndColumn   *int    `json:"end_column,omitempty"`
	BlobSHA     *string `json:"blob_sha,omitempty"`
	BlobURL     *string `json:"blob_url,omitempty"`
	CommitSHA   *string `json:"commit_sha,omitempty"`
	CommitURL   *string `json:"commit_url,omitempty"`
}

// SecretScanningAlertListOptions specifies optional parameters to the SecretScanningService.ListAlertsForEnterprise method.
type SecretScanningAlertListOptions struct {
	// State of the secret scanning alerts to list. Set to open or resolved to only list secret scanning alerts in a specific state.
	State string `url:"state,omitempty"`

	// A comma-separated list of secret types to return. By default all secret types are returned.
	SecretType string `url:"secret_type,omitempty"`

	// A comma-separated list of resolutions. Only secret scanning alerts with one of these resolutions are listed.
	// Valid resolutions are false_positive, wont_fix, revoked, pattern_edited, pattern_deleted or used_in_tests.
	Resolution string `url:"resolution,omitempty"`

	ListCursorOptions

	// List options can vary on the Enterprise type.
	// On Enterprise Cloud, Secret Scan alerts support requesting by page number
	// along with providing a cursor for an "after" param.
	// See: https://docs.github.com/enterprise-cloud@latest/rest/secret-scanning#list-secret-scanning-alerts-for-an-organization
	// Whereas on Enterprise Server, pagination is by index.
	// See: https://docs.github.com/enterprise-server@3.6/rest/secret-scanning#list-secret-scanning-alerts-for-an-organization
	ListOptions
}

// SecretScanningAlertUpdateOptions specifies optional parameters to the SecretScanningService.UpdateAlert method.
type SecretScanningAlertUpdateOptions struct {
	// State is required and sets the state of the secret scanning alert.
	// Can be either "open" or "resolved".
	// You must provide resolution when you set the state to "resolved".
	State string `json:"state"`

	// Required when the state is "resolved" and represents the reason for resolving the alert.
	// Can be one of: "false_positive", "wont_fix", "revoked", or "used_in_tests".
	Resolution *string `json:"resolution,omitempty"`
}

// ListAlertsForEnterprise lists secret scanning alerts for eligible repositories in an enterprise, from newest to oldest.
//
// To use this endpoint, you must be a member of the enterprise, and you must use an access token with the repo scope or
// security_events scope. Alerts are only returned for organizations in the enterprise for which you are an organization owner or a security manager.
//
// GitHub API docs: https://docs.github.com/rest/secret-scanning/secret-scanning#list-secret-scanning-alerts-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/secret-scanning/alerts
func (s *SecretScanningService) ListAlertsForEnterprise(ctx context.Context, enterprise string, opts *SecretScanningAlertListOptions) ([]*SecretScanningAlert, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/secret-scanning/alerts", enterprise)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var alerts []*SecretScanningAlert
	resp, err := s.client.Do(ctx, req, &alerts)
	if err != nil {
		return nil, resp, err
	}

	return alerts, resp, nil
}

// ListAlertsForOrg lists secret scanning alerts for eligible repositories in an organization, from newest to oldest.
//
// To use this endpoint, you must be an administrator for the repository or organization, and you must use an access token with
// the repo scope or security_events scope.
//
// GitHub API docs: https://docs.github.com/rest/secret-scanning/secret-scanning#list-secret-scanning-alerts-for-an-organization
//
//meta:operation GET /orgs/{org}/secret-scanning/alerts
func (s *SecretScanningService) ListAlertsForOrg(ctx context.Context, org string, opts *SecretScanningAlertListOptions) ([]*SecretScanningAlert, *Response, error) {
	u := fmt.Sprintf("orgs/%v/secret-scanning/alerts", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var alerts []*SecretScanningAlert
	resp, err := s.client.Do(ctx, req, &alerts)
	if err != nil {
		return nil, resp, err
	}

	return alerts, resp, nil
}

// ListAlertsForRepo lists secret scanning alerts for a private repository, from newest to oldest.
//
// To use this endpoint, you must be an administrator for the repository or organization, and you must use an access token with
// the repo scope or security_events scope.
//
// GitHub API docs: https://docs.github.com/rest/secret-scanning/secret-scanning#list-secret-scanning-alerts-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/secret-scanning/alerts
func (s *SecretScanningService) ListAlertsForRepo(ctx context.Context, owner, repo string, opts *SecretScanningAlertListOptions) ([]*SecretScanningAlert, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/secret-scanning/alerts", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var alerts []*SecretScanningAlert
	resp, err := s.client.Do(ctx, req, &alerts)
	if err != nil {
		return nil, resp, err
	}

	return alerts, resp, nil
}

// GetAlert gets a single secret scanning alert detected in a private repository.
//
// To use this endpoint, you must be an administrator for the repository or organization, and you must use an access token with
// the repo scope or security_events scope.
//
// GitHub API docs: https://docs.github.com/rest/secret-scanning/secret-scanning#get-a-secret-scanning-alert
//
//meta:operation GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}
func (s *SecretScanningService) GetAlert(ctx context.Context, owner, repo string, number int64) (*SecretScanningAlert, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/secret-scanning/alerts/%v", owner, repo, number)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var alert *SecretScanningAlert
	resp, err := s.client.Do(ctx, req, &alert)
	if err != nil {
		return nil, resp, err
	}

	return alert, resp, nil
}

// UpdateAlert updates the status of a secret scanning alert in a private repository.
//
// To use this endpoint, you must be an administrator for the repository or organization, and you must use an access token with
// the repo scope or security_events scope.
//
// GitHub API docs: https://docs.github.com/rest/secret-scanning/secret-scanning#update-a-secret-scanning-alert
//
//meta:operation PATCH /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}
func (s *SecretScanningService) UpdateAlert(ctx context.Context, owner, repo string, number int64, opts *SecretScanningAlertUpdateOptions) (*SecretScanningAlert, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/secret-scanning/alerts/%v", owner, repo, number)

	req, err := s.client.NewRequest("PATCH", u, opts)
	if err != nil {
		return nil, nil, err
	}

	var alert *SecretScanningAlert
	resp, err := s.client.Do(ctx, req, &alert)
	if err != nil {
		return nil, resp, err
	}

	return alert, resp, nil
}

// ListLocationsForAlert lists all locations for a given secret scanning alert for a private repository.
//
// To use this endpoint, you must be an administrator for the repository or organization, and you must use an access token with
// the repo scope or security_events scope.
//
// GitHub API docs: https://docs.github.com/rest/secret-scanning/secret-scanning#list-locations-for-a-secret-scanning-alert
//
//meta:operation GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}/locations
func (s *SecretScanningService) ListLocationsForAlert(ctx context.Context, owner, repo string, number int64, opts *ListOptions) ([]*SecretScanningAlertLocation, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/secret-scanning/alerts/%v/locations", owner, repo, number)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var locations []*SecretScanningAlertLocation
	resp, err := s.client.Do(ctx, req, &locations)
	if err != nil {
		return nil, resp, err
	}

	return locations, resp, nil
}
