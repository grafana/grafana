// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
)

// CredentialsService handles credentials related methods of the GitHub API.
type CredentialsService service

// revokeCredentialsRequest represents the request body for revoking credentials.
type revokeCredentialsRequest struct {
	// The list of credential strings (tokens) to revoke.
	Credentials []string `json:"credentials"`
}

// Revoke revokes a list of credentials.
//
// GitHub API docs: https://docs.github.com/rest/credentials/revoke#revoke-a-list-of-credentials
//
//meta:operation POST /credentials/revoke
func (s *CredentialsService) Revoke(ctx context.Context, credentials []string) (*Response, error) {
	u := "credentials/revoke"

	reqBody := &revokeCredentialsRequest{Credentials: credentials}

	req, err := s.client.NewRequest("POST", u, reqBody)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
