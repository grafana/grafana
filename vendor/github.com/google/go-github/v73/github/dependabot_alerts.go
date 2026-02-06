// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// Dependency represents the vulnerable dependency.
type Dependency struct {
	Package      *VulnerabilityPackage `json:"package,omitempty"`
	ManifestPath *string               `json:"manifest_path,omitempty"`
	Scope        *string               `json:"scope,omitempty"`
}

// AdvisoryCVSS represents the advisory pertaining to the Common Vulnerability Scoring System.
type AdvisoryCVSS struct {
	Score        *float64 `json:"score,omitempty"`
	VectorString *string  `json:"vector_string,omitempty"`
}

// AdvisoryCWEs represent the advisory pertaining to Common Weakness Enumeration.
type AdvisoryCWEs struct {
	CWEID *string `json:"cwe_id,omitempty"`
	Name  *string `json:"name,omitempty"`
}

// AdvisoryEPSS represents the advisory pertaining to the Exploit Prediction Scoring System.
//
// For more information, see:
// https://github.blog/changelog/2024-10-10-epss-scores-in-the-github-advisory-database/
type AdvisoryEPSS struct {
	Percentage float64 `json:"percentage"`
	Percentile float64 `json:"percentile"`
}

// DependabotSecurityAdvisory represents the GitHub Security Advisory.
type DependabotSecurityAdvisory struct {
	GHSAID          *string                  `json:"ghsa_id,omitempty"`
	CVEID           *string                  `json:"cve_id,omitempty"`
	Summary         *string                  `json:"summary,omitempty"`
	Description     *string                  `json:"description,omitempty"`
	Vulnerabilities []*AdvisoryVulnerability `json:"vulnerabilities,omitempty"`
	Severity        *string                  `json:"severity,omitempty"`
	CVSS            *AdvisoryCVSS            `json:"cvss,omitempty"`
	CWEs            []*AdvisoryCWEs          `json:"cwes,omitempty"`
	EPSS            *AdvisoryEPSS            `json:"epss,omitempty"`
	Identifiers     []*AdvisoryIdentifier    `json:"identifiers,omitempty"`
	References      []*AdvisoryReference     `json:"references,omitempty"`
	PublishedAt     *Timestamp               `json:"published_at,omitempty"`
	UpdatedAt       *Timestamp               `json:"updated_at,omitempty"`
	WithdrawnAt     *Timestamp               `json:"withdrawn_at,omitempty"`
}

// DependabotAlert represents a Dependabot alert.
type DependabotAlert struct {
	Number                *int                        `json:"number,omitempty"`
	State                 *string                     `json:"state,omitempty"`
	Dependency            *Dependency                 `json:"dependency,omitempty"`
	SecurityAdvisory      *DependabotSecurityAdvisory `json:"security_advisory,omitempty"`
	SecurityVulnerability *AdvisoryVulnerability      `json:"security_vulnerability,omitempty"`
	URL                   *string                     `json:"url,omitempty"`
	HTMLURL               *string                     `json:"html_url,omitempty"`
	CreatedAt             *Timestamp                  `json:"created_at,omitempty"`
	UpdatedAt             *Timestamp                  `json:"updated_at,omitempty"`
	DismissedAt           *Timestamp                  `json:"dismissed_at,omitempty"`
	DismissedBy           *User                       `json:"dismissed_by,omitempty"`
	DismissedReason       *string                     `json:"dismissed_reason,omitempty"`
	DismissedComment      *string                     `json:"dismissed_comment,omitempty"`
	FixedAt               *Timestamp                  `json:"fixed_at,omitempty"`
	AutoDismissedAt       *Timestamp                  `json:"auto_dismissed_at,omitempty"`
	// The repository is always empty for events
	Repository *Repository `json:"repository,omitempty"`
}

// DependabotAlertState represents the state of a Dependabot alert to update.
type DependabotAlertState struct {
	// The state of the Dependabot alert. A dismissed_reason must be provided when setting the state to dismissed.
	State string `json:"state"`
	// Required when state is dismissed. A reason for dismissing the alert.
	// Can be one of: fix_started, inaccurate, no_bandwidth, not_used, tolerable_risk
	DismissedReason *string `json:"dismissed_reason,omitempty"`
	// An optional comment associated with dismissing the alert.
	DismissedComment *string `json:"dismissed_comment,omitempty"`
}

// ListAlertsOptions specifies the optional parameters to the DependabotService.ListRepoAlerts
// and DependabotService.ListOrgAlerts methods.
type ListAlertsOptions struct {
	State     *string `url:"state,omitempty"`
	Severity  *string `url:"severity,omitempty"`
	Ecosystem *string `url:"ecosystem,omitempty"`
	Package   *string `url:"package,omitempty"`
	Scope     *string `url:"scope,omitempty"`
	Sort      *string `url:"sort,omitempty"`
	Direction *string `url:"direction,omitempty"`

	ListOptions
	ListCursorOptions
}

func (s *DependabotService) listAlerts(ctx context.Context, url string, opts *ListAlertsOptions) ([]*DependabotAlert, *Response, error) {
	u, err := addOptions(url, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var alerts []*DependabotAlert
	resp, err := s.client.Do(ctx, req, &alerts)
	if err != nil {
		return nil, resp, err
	}

	return alerts, resp, nil
}

// ListRepoAlerts lists all Dependabot alerts of a repository.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/alerts#list-dependabot-alerts-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/dependabot/alerts
func (s *DependabotService) ListRepoAlerts(ctx context.Context, owner, repo string, opts *ListAlertsOptions) ([]*DependabotAlert, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/dependabot/alerts", owner, repo)
	return s.listAlerts(ctx, url, opts)
}

// ListOrgAlerts lists all Dependabot alerts of an organization.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/alerts#list-dependabot-alerts-for-an-organization
//
//meta:operation GET /orgs/{org}/dependabot/alerts
func (s *DependabotService) ListOrgAlerts(ctx context.Context, org string, opts *ListAlertsOptions) ([]*DependabotAlert, *Response, error) {
	url := fmt.Sprintf("orgs/%v/dependabot/alerts", org)
	return s.listAlerts(ctx, url, opts)
}

// GetRepoAlert gets a single repository Dependabot alert.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/alerts#get-a-dependabot-alert
//
//meta:operation GET /repos/{owner}/{repo}/dependabot/alerts/{alert_number}
func (s *DependabotService) GetRepoAlert(ctx context.Context, owner, repo string, number int) (*DependabotAlert, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/dependabot/alerts/%v", owner, repo, number)
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	alert := new(DependabotAlert)
	resp, err := s.client.Do(ctx, req, alert)
	if err != nil {
		return nil, resp, err
	}

	return alert, resp, nil
}

// UpdateAlert updates a Dependabot alert.
//
// GitHub API docs: https://docs.github.com/rest/dependabot/alerts#update-a-dependabot-alert
//
//meta:operation PATCH /repos/{owner}/{repo}/dependabot/alerts/{alert_number}
func (s *DependabotService) UpdateAlert(ctx context.Context, owner, repo string, number int, stateInfo *DependabotAlertState) (*DependabotAlert, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/dependabot/alerts/%v", owner, repo, number)
	req, err := s.client.NewRequest("PATCH", url, stateInfo)
	if err != nil {
		return nil, nil, err
	}

	alert := new(DependabotAlert)
	resp, err := s.client.Do(ctx, req, alert)
	if err != nil {
		return nil, resp, err
	}

	return alert, resp, nil
}
