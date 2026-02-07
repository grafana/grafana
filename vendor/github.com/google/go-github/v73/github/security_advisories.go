// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"fmt"
)

type SecurityAdvisoriesService service

// SecurityAdvisorySubmission represents the Security Advisory Submission.
type SecurityAdvisorySubmission struct {
	// Accepted represents whether a private vulnerability report was accepted by the repository's administrators.
	Accepted *bool `json:"accepted,omitempty"`
}

// RepoAdvisoryCredit represents the credit object for a repository Security Advisory.
type RepoAdvisoryCredit struct {
	Login *string `json:"login,omitempty"`
	Type  *string `json:"type,omitempty"`
}

// RepoAdvisoryCreditDetailed represents a credit given to a user for a repository Security Advisory.
type RepoAdvisoryCreditDetailed struct {
	User  *User   `json:"user,omitempty"`
	Type  *string `json:"type,omitempty"`
	State *string `json:"state,omitempty"`
}

// ListRepositorySecurityAdvisoriesOptions specifies the optional parameters to list the repository security advisories.
type ListRepositorySecurityAdvisoriesOptions struct {
	ListCursorOptions

	// Direction in which to sort advisories. Possible values are: asc, desc.
	// Default is "asc".
	Direction string `url:"direction,omitempty"`

	// Sort specifies how to sort advisories. Possible values are: created, updated,
	// and published. Default value is "created".
	Sort string `url:"sort,omitempty"`

	// State filters advisories based on their state. Possible values are: triage, draft, published, closed.
	State string `url:"state,omitempty"`
}

// ListGlobalSecurityAdvisoriesOptions specifies the optional parameters to list the global security advisories.
type ListGlobalSecurityAdvisoriesOptions struct {
	ListCursorOptions

	// If specified, only advisories with this GHSA (GitHub Security Advisory) identifier will be returned.
	GHSAID *string `url:"ghsa_id,omitempty"`

	// If specified, only advisories of this type will be returned.
	// By default, a request with no other parameters defined will only return reviewed advisories that are not malware.
	// Default: reviewed
	// Can be one of: reviewed, malware, unreviewed
	Type *string `url:"type,omitempty"`

	// If specified, only advisories with this CVE (Common Vulnerabilities and Exposures) identifier will be returned.
	CVEID *string `url:"cve_id,omitempty"`

	// If specified, only advisories for these ecosystems will be returned.
	// Can be one of: actions, composer, erlang, go, maven, npm, nuget, other, pip, pub, rubygems, rust
	Ecosystem *string `url:"ecosystem,omitempty"`

	// If specified, only advisories with these severities will be returned.
	// Can be one of: unknown, low, medium, high, critical
	Severity *string `url:"severity,omitempty"`

	// If specified, only advisories with these Common Weakness Enumerations (CWEs) will be returned.
	// Example: cwes=79,284,22 or cwes[]=79&cwes[]=284&cwes[]=22
	CWEs []string `url:"cwes,omitempty"`

	// Whether to only return advisories that have been withdrawn.
	IsWithdrawn *bool `url:"is_withdrawn,omitempty"`

	// If specified, only return advisories that affect any of package or package@version.
	// A maximum of 1000 packages can be specified. If the query parameter causes
	// the URL to exceed the maximum URL length supported by your client, you must specify fewer packages.
	// Example: affects=package1,package2@1.0.0,package3@^2.0.0 or affects[]=package1&affects[]=package2@1.0.0
	Affects *string `url:"affects,omitempty"`

	// If specified, only return advisories that were published on a date or date range.
	Published *string `url:"published,omitempty"`

	// If specified, only return advisories that were updated on a date or date range.
	Updated *string `url:"updated,omitempty"`

	// If specified, only show advisories that were updated or published on a date or date range.
	Modified *string `url:"modified,omitempty"`
}

// GlobalSecurityAdvisory represents the global security advisory object response.
type GlobalSecurityAdvisory struct {
	SecurityAdvisory
	ID                    *int64                         `json:"id,omitempty"`
	RepositoryAdvisoryURL *string                        `json:"repository_advisory_url,omitempty"`
	Type                  *string                        `json:"type,omitempty"`
	SourceCodeLocation    *string                        `json:"source_code_location,omitempty"`
	References            []string                       `json:"references,omitempty"`
	Vulnerabilities       []*GlobalSecurityVulnerability `json:"vulnerabilities,omitempty"`
	GithubReviewedAt      *Timestamp                     `json:"github_reviewed_at,omitempty"`
	NVDPublishedAt        *Timestamp                     `json:"nvd_published_at,omitempty"`
	Credits               []*Credit                      `json:"credits,omitempty"`
}

// GlobalSecurityVulnerability represents a vulnerability for a global security advisory.
type GlobalSecurityVulnerability struct {
	Package                *VulnerabilityPackage `json:"package,omitempty"`
	FirstPatchedVersion    *string               `json:"first_patched_version,omitempty"`
	VulnerableVersionRange *string               `json:"vulnerable_version_range,omitempty"`
	VulnerableFunctions    []string              `json:"vulnerable_functions,omitempty"`
}

// Credit represents the credit object for a global security advisory.
type Credit struct {
	User *User   `json:"user,omitempty"`
	Type *string `json:"type,omitempty"`
}

// RequestCVE requests a Common Vulnerabilities and Exposures (CVE) for a repository security advisory.
// The ghsaID is the GitHub Security Advisory identifier of the advisory.
//
// GitHub API docs: https://docs.github.com/rest/security-advisories/repository-advisories#request-a-cve-for-a-repository-security-advisory
//
//meta:operation POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/cve
func (s *SecurityAdvisoriesService) RequestCVE(ctx context.Context, owner, repo, ghsaID string) (*Response, error) {
	url := fmt.Sprintf("repos/%v/%v/security-advisories/%v/cve", owner, repo, ghsaID)

	req, err := s.client.NewRequest("POST", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		if _, ok := err.(*AcceptedError); ok {
			return resp, nil
		}

		return resp, err
	}

	return resp, nil
}

// CreateTemporaryPrivateFork creates a temporary private fork to collaborate on fixing a security vulnerability in your repository.
// The ghsaID is the GitHub Security Advisory identifier of the advisory.
//
// GitHub API docs: https://docs.github.com/rest/security-advisories/repository-advisories#create-a-temporary-private-fork
//
//meta:operation POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks
func (s *SecurityAdvisoriesService) CreateTemporaryPrivateFork(ctx context.Context, owner, repo, ghsaID string) (*Repository, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/security-advisories/%v/forks", owner, repo, ghsaID)

	req, err := s.client.NewRequest("POST", url, nil)
	if err != nil {
		return nil, nil, err
	}

	fork := new(Repository)
	resp, err := s.client.Do(ctx, req, fork)
	if err != nil {
		if aerr, ok := err.(*AcceptedError); ok {
			if err := json.Unmarshal(aerr.Raw, fork); err != nil {
				return fork, resp, err
			}

			return fork, resp, err
		}
		return nil, resp, err
	}

	return fork, resp, nil
}

// ListRepositorySecurityAdvisoriesForOrg lists the repository security advisories for an organization.
//
// GitHub API docs: https://docs.github.com/rest/security-advisories/repository-advisories#list-repository-security-advisories-for-an-organization
//
//meta:operation GET /orgs/{org}/security-advisories
func (s *SecurityAdvisoriesService) ListRepositorySecurityAdvisoriesForOrg(ctx context.Context, org string, opt *ListRepositorySecurityAdvisoriesOptions) ([]*SecurityAdvisory, *Response, error) {
	url := fmt.Sprintf("orgs/%v/security-advisories", org)
	url, err := addOptions(url, opt)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	var advisories []*SecurityAdvisory
	resp, err := s.client.Do(ctx, req, &advisories)
	if err != nil {
		return nil, resp, err
	}

	return advisories, resp, nil
}

// ListRepositorySecurityAdvisories lists the security advisories in a repository.
//
// GitHub API docs: https://docs.github.com/rest/security-advisories/repository-advisories#list-repository-security-advisories
//
//meta:operation GET /repos/{owner}/{repo}/security-advisories
func (s *SecurityAdvisoriesService) ListRepositorySecurityAdvisories(ctx context.Context, owner, repo string, opt *ListRepositorySecurityAdvisoriesOptions) ([]*SecurityAdvisory, *Response, error) {
	url := fmt.Sprintf("repos/%v/%v/security-advisories", owner, repo)
	url, err := addOptions(url, opt)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	var advisories []*SecurityAdvisory
	resp, err := s.client.Do(ctx, req, &advisories)
	if err != nil {
		return nil, resp, err
	}

	return advisories, resp, nil
}

// ListGlobalSecurityAdvisories lists all global security advisories.
//
// GitHub API docs: https://docs.github.com/rest/security-advisories/global-advisories#list-global-security-advisories
//
//meta:operation GET /advisories
func (s *SecurityAdvisoriesService) ListGlobalSecurityAdvisories(ctx context.Context, opts *ListGlobalSecurityAdvisoriesOptions) ([]*GlobalSecurityAdvisory, *Response, error) {
	url := "advisories"
	url, err := addOptions(url, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	var advisories []*GlobalSecurityAdvisory
	resp, err := s.client.Do(ctx, req, &advisories)
	if err != nil {
		return nil, resp, err
	}

	return advisories, resp, nil
}

// GetGlobalSecurityAdvisories gets a global security advisory using its GitHub Security Advisory (GHSA) identifier.
//
// GitHub API docs: https://docs.github.com/rest/security-advisories/global-advisories#get-a-global-security-advisory
//
//meta:operation GET /advisories/{ghsa_id}
func (s *SecurityAdvisoriesService) GetGlobalSecurityAdvisories(ctx context.Context, ghsaID string) (*GlobalSecurityAdvisory, *Response, error) {
	url := fmt.Sprintf("advisories/%s", ghsaID)
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	var advisory *GlobalSecurityAdvisory
	resp, err := s.client.Do(ctx, req, &advisory)
	if err != nil {
		return nil, resp, err
	}

	return advisory, resp, nil
}
