// Copyright 2014 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"bytes"
	"context"
	"fmt"
	"net/url"
)

// MetaService provides access to functions in the GitHub API that GitHub categorizes as "meta".
type MetaService service

// APIMeta represents metadata about the GitHub API.
type APIMeta struct {
	// An array of IP addresses in CIDR format specifying the addresses
	// that incoming service hooks will originate from on GitHub.com.
	Hooks []string `json:"hooks,omitempty"`

	// An array of IP addresses in CIDR format specifying the Git servers
	// for GitHub.com.
	Git []string `json:"git,omitempty"`

	// Whether authentication with username and password is supported.
	// (GitHub Enterprise instances using CAS or OAuth for authentication
	// will return false. Features like Basic Authentication with a
	// username and password, sudo mode, and two-factor authentication are
	// not supported on these servers.)
	VerifiablePasswordAuthentication *bool `json:"verifiable_password_authentication,omitempty"`

	// An array of IP addresses in CIDR format specifying the addresses
	// which serve GitHub Packages.
	Packages []string `json:"packages,omitempty"`

	// An array of IP addresses in CIDR format specifying the addresses
	// which serve GitHub Pages websites.
	Pages []string `json:"pages,omitempty"`

	// An array of IP addresses specifying the addresses that source imports
	// will originate from on GitHub.com.
	Importer []string `json:"importer,omitempty"`

	// An array of IP addresses specifying the addresses that source imports
	// will originate from on GitHub Enterprise Cloud.
	GithubEnterpriseImporter []string `json:"github_enterprise_importer,omitempty"`

	// An array of IP addresses in CIDR format specifying the IP addresses
	// GitHub Actions will originate from.
	Actions []string `json:"actions,omitempty"`

	// An array of IP addresses in CIDR format specifying the IP addresses
	// Dependabot will originate from.
	Dependabot []string `json:"dependabot,omitempty"`

	// A map of algorithms to SSH key fingerprints.
	SSHKeyFingerprints map[string]string `json:"ssh_key_fingerprints,omitempty"`

	// An array of SSH keys.
	SSHKeys []string `json:"ssh_keys,omitempty"`

	// An array of IP addresses in CIDR format specifying the addresses
	// which serve GitHub websites.
	Web []string `json:"web,omitempty"`

	// An array of IP addresses in CIDR format specifying the addresses
	// which serve GitHub APIs.
	API []string `json:"api,omitempty"`

	// A map of GitHub services and their associated domains. Note that many
	// of these domains are represented as wildcards (e.g. "*.github.com").
	Domains map[string][]string `json:"domains,omitempty"`
}

// Get returns information about GitHub.com, the service. Or, if you access
// this endpoint on your organization’s GitHub Enterprise installation, this
// endpoint provides information about that installation.
//
// GitHub API docs: https://docs.github.com/rest/meta/meta#get-github-meta-information
//
//meta:operation GET /meta
func (s *MetaService) Get(ctx context.Context) (*APIMeta, *Response, error) {
	req, err := s.client.NewRequest("GET", "meta", nil)
	if err != nil {
		return nil, nil, err
	}

	meta := new(APIMeta)
	resp, err := s.client.Do(ctx, req, meta)
	if err != nil {
		return nil, resp, err
	}

	return meta, resp, nil
}

// APIMeta returns information about GitHub.com.
//
// Deprecated: Use MetaService.Get instead.
func (c *Client) APIMeta(ctx context.Context) (*APIMeta, *Response, error) {
	return c.Meta.Get(ctx)
}

// Octocat returns an ASCII art octocat with the specified message in a speech
// bubble. If message is empty, a random zen phrase is used.
//
// GitHub API docs: https://docs.github.com/rest/meta/meta#get-octocat
//
//meta:operation GET /octocat
func (s *MetaService) Octocat(ctx context.Context, message string) (string, *Response, error) {
	u := "octocat"
	if message != "" {
		u = fmt.Sprintf("%s?s=%s", u, url.QueryEscape(message))
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return "", nil, err
	}

	buf := new(bytes.Buffer)
	resp, err := s.client.Do(ctx, req, buf)
	if err != nil {
		return "", resp, err
	}

	return buf.String(), resp, nil
}

// Octocat returns an ASCII art octocat with the specified message in a speech
// bubble. If message is empty, a random zen phrase is used.
//
// Deprecated: Use MetaService.Octocat instead.
func (c *Client) Octocat(ctx context.Context, message string) (string, *Response, error) {
	return c.Meta.Octocat(ctx, message)
}

// Zen returns a random line from The Zen of GitHub.
//
// See also: http://warpspire.com/posts/taste/
//
// GitHub API docs: https://docs.github.com/rest/meta/meta#get-the-zen-of-github
//
//meta:operation GET /zen
func (s *MetaService) Zen(ctx context.Context) (string, *Response, error) {
	req, err := s.client.NewRequest("GET", "zen", nil)
	if err != nil {
		return "", nil, err
	}

	buf := new(bytes.Buffer)
	resp, err := s.client.Do(ctx, req, buf)
	if err != nil {
		return "", resp, err
	}

	return buf.String(), resp, nil
}

// Zen returns a random line from The Zen of GitHub.
//
// Deprecated: Use MetaService.Zen instead.
func (c *Client) Zen(ctx context.Context) (string, *Response, error) {
	return c.Meta.Zen(ctx)
}
