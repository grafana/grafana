// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// OIDCSubjectClaimCustomTemplate represents an OIDC subject claim customization template.
type OIDCSubjectClaimCustomTemplate struct {
	UseDefault       *bool    `json:"use_default,omitempty"`
	IncludeClaimKeys []string `json:"include_claim_keys,omitempty"`
}

// GetOrgOIDCSubjectClaimCustomTemplate gets the subject claim customization template for an organization.
//
// GitHub API docs: https://docs.github.com/rest/actions/oidc#get-the-customization-template-for-an-oidc-subject-claim-for-an-organization
//
//meta:operation GET /orgs/{org}/actions/oidc/customization/sub
func (s *ActionsService) GetOrgOIDCSubjectClaimCustomTemplate(ctx context.Context, org string) (*OIDCSubjectClaimCustomTemplate, *Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/oidc/customization/sub", org)
	return s.getOIDCSubjectClaimCustomTemplate(ctx, u)
}

// GetRepoOIDCSubjectClaimCustomTemplate gets the subject claim customization template for a repository.
//
// GitHub API docs: https://docs.github.com/rest/actions/oidc#get-the-customization-template-for-an-oidc-subject-claim-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/actions/oidc/customization/sub
func (s *ActionsService) GetRepoOIDCSubjectClaimCustomTemplate(ctx context.Context, owner, repo string) (*OIDCSubjectClaimCustomTemplate, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/oidc/customization/sub", owner, repo)
	return s.getOIDCSubjectClaimCustomTemplate(ctx, u)
}

func (s *ActionsService) getOIDCSubjectClaimCustomTemplate(ctx context.Context, url string) (*OIDCSubjectClaimCustomTemplate, *Response, error) {
	req, err := s.client.NewRequest("GET", url, nil)
	if err != nil {
		return nil, nil, err
	}

	tmpl := new(OIDCSubjectClaimCustomTemplate)
	resp, err := s.client.Do(ctx, req, tmpl)
	if err != nil {
		return nil, resp, err
	}

	return tmpl, resp, nil
}

// SetOrgOIDCSubjectClaimCustomTemplate sets the subject claim customization for an organization.
//
// GitHub API docs: https://docs.github.com/rest/actions/oidc#set-the-customization-template-for-an-oidc-subject-claim-for-an-organization
//
//meta:operation PUT /orgs/{org}/actions/oidc/customization/sub
func (s *ActionsService) SetOrgOIDCSubjectClaimCustomTemplate(ctx context.Context, org string, template *OIDCSubjectClaimCustomTemplate) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/actions/oidc/customization/sub", org)
	return s.setOIDCSubjectClaimCustomTemplate(ctx, u, template)
}

// SetRepoOIDCSubjectClaimCustomTemplate sets the subject claim customization for a repository.
//
// GitHub API docs: https://docs.github.com/rest/actions/oidc#set-the-customization-template-for-an-oidc-subject-claim-for-a-repository
//
//meta:operation PUT /repos/{owner}/{repo}/actions/oidc/customization/sub
func (s *ActionsService) SetRepoOIDCSubjectClaimCustomTemplate(ctx context.Context, owner, repo string, template *OIDCSubjectClaimCustomTemplate) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/oidc/customization/sub", owner, repo)
	return s.setOIDCSubjectClaimCustomTemplate(ctx, u, template)
}

func (s *ActionsService) setOIDCSubjectClaimCustomTemplate(ctx context.Context, url string, template *OIDCSubjectClaimCustomTemplate) (*Response, error) {
	req, err := s.client.NewRequest("PUT", url, template)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
