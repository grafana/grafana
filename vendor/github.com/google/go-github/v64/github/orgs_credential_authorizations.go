// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
	"net/http"
)

// CredentialAuthorization represents a credential authorized through SAML SSO.
type CredentialAuthorization struct {
	// User login that owns the underlying credential.
	Login *string `json:"login,omitempty"`

	// Unique identifier for the credential.
	CredentialID *int64 `json:"credential_id,omitempty"`

	// Human-readable description of the credential type.
	CredentialType *string `json:"credential_type,omitempty"`

	// Last eight characters of the credential.
	// Only included in responses with credential_type of personal access token.
	TokenLastEight *string `json:"token_last_eight,omitempty"`

	// Date when the credential was authorized for use.
	CredentialAuthorizedAt *Timestamp `json:"credential_authorized_at,omitempty"`

	// Date when the credential was last accessed.
	// May be null if it was never accessed.
	CredentialAccessedAt *Timestamp `json:"credential_accessed_at,omitempty"`

	// List of oauth scopes the token has been granted.
	Scopes []string `json:"scopes,omitempty"`

	// Unique string to distinguish the credential.
	// Only included in responses with credential_type of SSH Key.
	Fingerprint *string `json:"fingerprint,omitempty"`

	AuthorizedCredentialID *int64 `json:"authorized_credential_id,omitempty"`

	// The title given to the ssh key.
	// This will only be present when the credential is an ssh key.
	AuthorizedCredentialTitle *string `json:"authorized_credential_title,omitempty"`

	// The note given to the token.
	// This will only be present when the credential is a token.
	AuthorizedCredentialNote *string `json:"authorized_credential_note,omitempty"`

	// The expiry for the token.
	// This will only be present when the credential is a token.
	AuthorizedCredentialExpiresAt *Timestamp `json:"authorized_credential_expires_at,omitempty"`
}

// ListCredentialAuthorizations lists credentials authorized through SAML SSO
// for a given organization. Only available with GitHub Enterprise Cloud.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/orgs/orgs#list-saml-sso-authorizations-for-an-organization
//
//meta:operation GET /orgs/{org}/credential-authorizations
func (s *OrganizationsService) ListCredentialAuthorizations(ctx context.Context, org string, opts *ListOptions) ([]*CredentialAuthorization, *Response, error) {
	u := fmt.Sprintf("orgs/%v/credential-authorizations", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, nil, err
	}

	var creds []*CredentialAuthorization
	resp, err := s.client.Do(ctx, req, &creds)
	if err != nil {
		return nil, resp, err
	}

	return creds, resp, nil
}

// RemoveCredentialAuthorization revokes the SAML SSO authorization for a given
// credential within an organization. Only available with GitHub Enterprise Cloud.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/orgs/orgs#remove-a-saml-sso-authorization-for-an-organization
//
//meta:operation DELETE /orgs/{org}/credential-authorizations/{credential_id}
func (s *OrganizationsService) RemoveCredentialAuthorization(ctx context.Context, org string, credentialID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/credential-authorizations/%v", org, credentialID)
	req, err := s.client.NewRequest(http.MethodDelete, u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
