// Copyright 2019 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// CreateUserRequest represents the fields sent to the `CreateUser` endpoint.
// Note that `Login` is a required field.
type CreateUserRequest struct {
	Login     string  `json:"login"`
	Email     *string `json:"email,omitempty"`
	Suspended *bool   `json:"suspended,omitempty"`
}

// CreateUser creates a new user in GitHub Enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/users#create-a-user
//
//meta:operation POST /admin/users
func (s *AdminService) CreateUser(ctx context.Context, userReq CreateUserRequest) (*User, *Response, error) {
	u := "admin/users"

	req, err := s.client.NewRequest("POST", u, userReq)
	if err != nil {
		return nil, nil, err
	}

	var user User
	resp, err := s.client.Do(ctx, req, &user)
	if err != nil {
		return nil, resp, err
	}

	return &user, resp, nil
}

// DeleteUser deletes a user in GitHub Enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/users#delete-a-user
//
//meta:operation DELETE /admin/users/{username}
func (s *AdminService) DeleteUser(ctx context.Context, username string) (*Response, error) {
	u := "admin/users/" + username

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

// ImpersonateUserOptions represents the scoping for the OAuth token.
type ImpersonateUserOptions struct {
	Scopes []string `json:"scopes,omitempty"`
}

// OAuthAPP represents the GitHub Site Administrator OAuth app.
type OAuthAPP struct {
	URL      *string `json:"url,omitempty"`
	Name     *string `json:"name,omitempty"`
	ClientID *string `json:"client_id,omitempty"`
}

func (s OAuthAPP) String() string {
	return Stringify(s)
}

// UserAuthorization represents the impersonation response.
type UserAuthorization struct {
	ID             *int64     `json:"id,omitempty"`
	URL            *string    `json:"url,omitempty"`
	Scopes         []string   `json:"scopes,omitempty"`
	Token          *string    `json:"token,omitempty"`
	TokenLastEight *string    `json:"token_last_eight,omitempty"`
	HashedToken    *string    `json:"hashed_token,omitempty"`
	App            *OAuthAPP  `json:"app,omitempty"`
	Note           *string    `json:"note,omitempty"`
	NoteURL        *string    `json:"note_url,omitempty"`
	UpdatedAt      *Timestamp `json:"updated_at,omitempty"`
	CreatedAt      *Timestamp `json:"created_at,omitempty"`
	Fingerprint    *string    `json:"fingerprint,omitempty"`
}

// CreateUserImpersonation creates an impersonation OAuth token.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/users#create-an-impersonation-oauth-token
//
//meta:operation POST /admin/users/{username}/authorizations
func (s *AdminService) CreateUserImpersonation(ctx context.Context, username string, opts *ImpersonateUserOptions) (*UserAuthorization, *Response, error) {
	u := fmt.Sprintf("admin/users/%s/authorizations", username)

	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	a := new(UserAuthorization)
	resp, err := s.client.Do(ctx, req, a)
	if err != nil {
		return nil, resp, err
	}

	return a, resp, nil
}

// DeleteUserImpersonation deletes an impersonation OAuth token.
//
// GitHub API docs: https://docs.github.com/enterprise-server@3.17/rest/enterprise-admin/users#delete-an-impersonation-oauth-token
//
//meta:operation DELETE /admin/users/{username}/authorizations
func (s *AdminService) DeleteUserImpersonation(ctx context.Context, username string) (*Response, error) {
	u := fmt.Sprintf("admin/users/%s/authorizations", username)

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
