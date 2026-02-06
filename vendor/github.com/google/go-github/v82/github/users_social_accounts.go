// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// SocialAccount represents a social account linked to a user.
type SocialAccount struct {
	Provider *string `json:"provider,omitempty"`
	URL      *string `json:"url,omitempty"`
}

// socialAccountsRequest represents the request body for adding or deleting social accounts.
type socialAccountsRequest struct {
	AccountURLs []string `json:"account_urls"`
}

// ListSocialAccounts lists all social accounts for the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/users/social-accounts#list-social-accounts-for-the-authenticated-user
//
//meta:operation GET /user/social_accounts
func (s *UsersService) ListSocialAccounts(ctx context.Context, opts *ListOptions) ([]*SocialAccount, *Response, error) {
	u := "user/social_accounts"
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var socialAccounts []*SocialAccount
	resp, err := s.client.Do(ctx, req, &socialAccounts)
	if err != nil {
		return nil, resp, err
	}

	return socialAccounts, resp, nil
}

// AddSocialAccounts adds social accounts for the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/users/social-accounts#add-social-accounts-for-the-authenticated-user
//
//meta:operation POST /user/social_accounts
func (s *UsersService) AddSocialAccounts(ctx context.Context, accountURLs []string) ([]*SocialAccount, *Response, error) {
	u := "user/social_accounts"
	req, err := s.client.NewRequest("POST", u, &socialAccountsRequest{AccountURLs: accountURLs})
	if err != nil {
		return nil, nil, err
	}

	var accounts []*SocialAccount
	resp, err := s.client.Do(ctx, req, &accounts)
	if err != nil {
		return nil, resp, err
	}

	return accounts, resp, nil
}

// DeleteSocialAccounts deletes social accounts for the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/users/social-accounts#delete-social-accounts-for-the-authenticated-user
//
//meta:operation DELETE /user/social_accounts
func (s *UsersService) DeleteSocialAccounts(ctx context.Context, accountURLs []string) (*Response, error) {
	u := "user/social_accounts"
	req, err := s.client.NewRequest("DELETE", u, &socialAccountsRequest{AccountURLs: accountURLs})
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// ListUserSocialAccounts lists all social accounts for a user.
//
// GitHub API docs: https://docs.github.com/rest/users/social-accounts#list-social-accounts-for-a-user
//
//meta:operation GET /users/{username}/social_accounts
func (s *UsersService) ListUserSocialAccounts(ctx context.Context, username string, opts *ListOptions) ([]*SocialAccount, *Response, error) {
	u := fmt.Sprintf("users/%v/social_accounts", username)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var addedAccounts []*SocialAccount
	resp, err := s.client.Do(ctx, req, &addedAccounts)
	if err != nil {
		return nil, resp, err
	}

	return addedAccounts, resp, nil
}
