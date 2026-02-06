// Copyright 2014 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// Pages represents a GitHub Pages site configuration.
type Pages struct {
	URL              *string                `json:"url,omitempty"`
	Status           *string                `json:"status,omitempty"`
	CNAME            *string                `json:"cname,omitempty"`
	Custom404        *bool                  `json:"custom_404,omitempty"`
	HTMLURL          *string                `json:"html_url,omitempty"`
	BuildType        *string                `json:"build_type,omitempty"`
	Source           *PagesSource           `json:"source,omitempty"`
	Public           *bool                  `json:"public,omitempty"`
	HTTPSCertificate *PagesHTTPSCertificate `json:"https_certificate,omitempty"`
	HTTPSEnforced    *bool                  `json:"https_enforced,omitempty"`
}

// PagesSource represents a GitHub page's source.
type PagesSource struct {
	Branch *string `json:"branch,omitempty"`
	Path   *string `json:"path,omitempty"`
}

// PagesError represents a build error for a GitHub Pages site.
type PagesError struct {
	Message *string `json:"message,omitempty"`
}

// PagesBuild represents the build information for a GitHub Pages site.
type PagesBuild struct {
	URL       *string     `json:"url,omitempty"`
	Status    *string     `json:"status,omitempty"`
	Error     *PagesError `json:"error,omitempty"`
	Pusher    *User       `json:"pusher,omitempty"`
	Commit    *string     `json:"commit,omitempty"`
	Duration  *int        `json:"duration,omitempty"`
	CreatedAt *Timestamp  `json:"created_at,omitempty"`
	UpdatedAt *Timestamp  `json:"updated_at,omitempty"`
}

// PagesDomain represents a domain associated with a GitHub Pages site.
type PagesDomain struct {
	Host                          *string `json:"host,omitempty"`
	URI                           *string `json:"uri,omitempty"`
	Nameservers                   *string `json:"nameservers,omitempty"`
	DNSResolves                   *bool   `json:"dns_resolves,omitempty"`
	IsProxied                     *bool   `json:"is_proxied,omitempty"`
	IsCloudflareIP                *bool   `json:"is_cloudflare_ip,omitempty"`
	IsFastlyIP                    *bool   `json:"is_fastly_ip,omitempty"`
	IsOldIPAddress                *bool   `json:"is_old_ip_address,omitempty"`
	IsARecord                     *bool   `json:"is_a_record,omitempty"`
	HasCNAMERecord                *bool   `json:"has_cname_record,omitempty"`
	HasMXRecordsPresent           *bool   `json:"has_mx_records_present,omitempty"`
	IsValidDomain                 *bool   `json:"is_valid_domain,omitempty"`
	IsApexDomain                  *bool   `json:"is_apex_domain,omitempty"`
	ShouldBeARecord               *bool   `json:"should_be_a_record,omitempty"`
	IsCNAMEToGithubUserDomain     *bool   `json:"is_cname_to_github_user_domain,omitempty"`
	IsCNAMEToPagesDotGithubDotCom *bool   `json:"is_cname_to_pages_dot_github_dot_com,omitempty"`
	IsCNAMEToFastly               *bool   `json:"is_cname_to_fastly,omitempty"`
	IsPointedToGithubPagesIP      *bool   `json:"is_pointed_to_github_pages_ip,omitempty"`
	IsNonGithubPagesIPPresent     *bool   `json:"is_non_github_pages_ip_present,omitempty"`
	IsPagesDomain                 *bool   `json:"is_pages_domain,omitempty"`
	IsServedByPages               *bool   `json:"is_served_by_pages,omitempty"`
	IsValid                       *bool   `json:"is_valid,omitempty"`
	Reason                        *string `json:"reason,omitempty"`
	RespondsToHTTPS               *bool   `json:"responds_to_https,omitempty"`
	EnforcesHTTPS                 *bool   `json:"enforces_https,omitempty"`
	HTTPSError                    *string `json:"https_error,omitempty"`
	IsHTTPSEligible               *bool   `json:"is_https_eligible,omitempty"`
	CAAError                      *string `json:"caa_error,omitempty"`
}

// PagesHealthCheckResponse represents the response given for the health check of a GitHub Pages site.
type PagesHealthCheckResponse struct {
	Domain    *PagesDomain `json:"domain,omitempty"`
	AltDomain *PagesDomain `json:"alt_domain,omitempty"`
}

// PagesHTTPSCertificate represents the HTTPS Certificate information for a GitHub Pages site.
type PagesHTTPSCertificate struct {
	State       *string  `json:"state,omitempty"`
	Description *string  `json:"description,omitempty"`
	Domains     []string `json:"domains,omitempty"`
	// GitHub's API doesn't return a standard Timestamp, rather it returns a YYYY-MM-DD string.
	ExpiresAt *string `json:"expires_at,omitempty"`
}

// createPagesRequest is a subset of Pages and is used internally
// by EnablePages to pass only the known fields for the endpoint.
type createPagesRequest struct {
	BuildType *string      `json:"build_type,omitempty"`
	Source    *PagesSource `json:"source,omitempty"`
}

// EnablePages enables GitHub Pages for the named repo.
//
// GitHub API docs: https://docs.github.com/rest/pages/pages#create-a-github-pages-site
//
//meta:operation POST /repos/{owner}/{repo}/pages
func (s *RepositoriesService) EnablePages(ctx context.Context, owner, repo string, pages *Pages) (*Pages, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pages", owner, repo)

	pagesReq := &createPagesRequest{
		BuildType: pages.BuildType,
		Source:    pages.Source,
	}

	req, err := s.client.NewRequest("POST", u, pagesReq)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Accept", mediaTypeEnablePagesAPIPreview)

	enable := new(Pages)
	resp, err := s.client.Do(ctx, req, enable)
	if err != nil {
		return nil, resp, err
	}

	return enable, resp, nil
}

// PagesUpdate sets up parameters needed to update a GitHub Pages site.
type PagesUpdate struct {
	// CNAME represents a custom domain for the repository.
	// Leaving CNAME empty will remove the custom domain.
	CNAME *string `json:"cname"`
	// BuildType is optional and can either be "legacy" or "workflow".
	// "workflow" - You are using a github workflow to build your pages.
	// "legacy"   - You are deploying from a branch.
	BuildType *string `json:"build_type,omitempty"`
	// Source must include the branch name, and may optionally specify the subdirectory "/docs".
	// Possible values for Source.Branch are usually "gh-pages", "main", and "master",
	// or any other existing branch name.
	// Possible values for Source.Path are: "/", and "/docs".
	Source *PagesSource `json:"source,omitempty"`
	// Public configures access controls for the site.
	// If "true", the site will be accessible to anyone on the internet. If "false",
	// the site will be accessible to anyone with read access to the repository that
	// published the site.
	Public *bool `json:"public,omitempty"`
	// HTTPSEnforced specifies whether HTTPS should be enforced for the repository.
	HTTPSEnforced *bool `json:"https_enforced,omitempty"`
}

// UpdatePages updates GitHub Pages for the named repo.
//
// GitHub API docs: https://docs.github.com/rest/pages/pages#update-information-about-a-github-pages-site
//
//meta:operation PUT /repos/{owner}/{repo}/pages
func (s *RepositoriesService) UpdatePages(ctx context.Context, owner, repo string, opts *PagesUpdate) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pages", owner, repo)

	req, err := s.client.NewRequest("PUT", u, opts)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}
	return resp, nil
}

// PagesUpdateWithoutCNAME defines parameters for updating a GitHub Pages site on GitHub Enterprise Servers.
// Sending a request with a CNAME (any value, empty string, or null) results in a 400 error: "Custom domains are not available for GitHub Pages".
type PagesUpdateWithoutCNAME struct {
	BuildType     *string      `json:"build_type,omitempty"`
	Source        *PagesSource `json:"source,omitempty"`
	Public        *bool        `json:"public,omitempty"`
	HTTPSEnforced *bool        `json:"https_enforced,omitempty"`
}

// UpdatePagesGHES updates GitHub Pages for the named repo in GitHub Enterprise Servers.
//
// GitHub API docs: https://docs.github.com/rest/pages/pages#update-information-about-a-github-pages-site
//
//meta:operation PUT /repos/{owner}/{repo}/pages
func (s *RepositoriesService) UpdatePagesGHES(ctx context.Context, owner, repo string, opts *PagesUpdateWithoutCNAME) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pages", owner, repo)

	req, err := s.client.NewRequest("PUT", u, opts)

	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}
	return resp, nil
}

// DisablePages disables GitHub Pages for the named repo.
//
// GitHub API docs: https://docs.github.com/rest/pages/pages#delete-a-github-pages-site
//
//meta:operation DELETE /repos/{owner}/{repo}/pages
func (s *RepositoriesService) DisablePages(ctx context.Context, owner, repo string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pages", owner, repo)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeEnablePagesAPIPreview)

	return s.client.Do(ctx, req, nil)
}

// GetPagesInfo fetches information about a GitHub Pages site.
//
// GitHub API docs: https://docs.github.com/rest/pages/pages#get-a-github-pages-site
//
//meta:operation GET /repos/{owner}/{repo}/pages
func (s *RepositoriesService) GetPagesInfo(ctx context.Context, owner, repo string) (*Pages, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pages", owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	site := new(Pages)
	resp, err := s.client.Do(ctx, req, site)
	if err != nil {
		return nil, resp, err
	}

	return site, resp, nil
}

// ListPagesBuilds lists the builds for a GitHub Pages site.
//
// GitHub API docs: https://docs.github.com/rest/pages/pages#list-github-pages-builds
//
//meta:operation GET /repos/{owner}/{repo}/pages/builds
func (s *RepositoriesService) ListPagesBuilds(ctx context.Context, owner, repo string, opts *ListOptions) ([]*PagesBuild, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pages/builds", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var pages []*PagesBuild
	resp, err := s.client.Do(ctx, req, &pages)
	if err != nil {
		return nil, resp, err
	}

	return pages, resp, nil
}

// GetLatestPagesBuild fetches the latest build information for a GitHub pages site.
//
// GitHub API docs: https://docs.github.com/rest/pages/pages#get-latest-pages-build
//
//meta:operation GET /repos/{owner}/{repo}/pages/builds/latest
func (s *RepositoriesService) GetLatestPagesBuild(ctx context.Context, owner, repo string) (*PagesBuild, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pages/builds/latest", owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	build := new(PagesBuild)
	resp, err := s.client.Do(ctx, req, build)
	if err != nil {
		return nil, resp, err
	}

	return build, resp, nil
}

// GetPageBuild fetches the specific build information for a GitHub pages site.
//
// GitHub API docs: https://docs.github.com/rest/pages/pages#get-github-pages-build
//
//meta:operation GET /repos/{owner}/{repo}/pages/builds/{build_id}
func (s *RepositoriesService) GetPageBuild(ctx context.Context, owner, repo string, id int64) (*PagesBuild, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pages/builds/%v", owner, repo, id)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	build := new(PagesBuild)
	resp, err := s.client.Do(ctx, req, build)
	if err != nil {
		return nil, resp, err
	}

	return build, resp, nil
}

// RequestPageBuild requests a build of a GitHub Pages site without needing to push new commit.
//
// GitHub API docs: https://docs.github.com/rest/pages/pages#request-a-github-pages-build
//
//meta:operation POST /repos/{owner}/{repo}/pages/builds
func (s *RepositoriesService) RequestPageBuild(ctx context.Context, owner, repo string) (*PagesBuild, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pages/builds", owner, repo)
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, nil, err
	}

	build := new(PagesBuild)
	resp, err := s.client.Do(ctx, req, build)
	if err != nil {
		return nil, resp, err
	}

	return build, resp, nil
}

// GetPageHealthCheck gets a DNS health check for the CNAME record configured for a repository's GitHub Pages.
//
// GitHub API docs: https://docs.github.com/rest/pages/pages#get-a-dns-health-check-for-github-pages
//
//meta:operation GET /repos/{owner}/{repo}/pages/health
func (s *RepositoriesService) GetPageHealthCheck(ctx context.Context, owner, repo string) (*PagesHealthCheckResponse, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pages/health", owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	healthCheckResponse := new(PagesHealthCheckResponse)
	resp, err := s.client.Do(ctx, req, healthCheckResponse)
	if err != nil {
		return nil, resp, err
	}

	return healthCheckResponse, resp, nil
}
