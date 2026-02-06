// Copyright 2024 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// ListAttestations returns a collection of artifact attestations
// with a given subject digest that are associated with repositories
// owned by a user.
//
// GitHub API docs: https://docs.github.com/rest/users/attestations#list-attestations
//
//meta:operation GET /users/{username}/attestations/{subject_digest}
func (s *UsersService) ListAttestations(ctx context.Context, user, subjectDigest string, opts *ListOptions) (*AttestationsResponse, *Response, error) {
	var u = fmt.Sprintf("users/%v/attestations/%v", user, subjectDigest)

	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var attestations *AttestationsResponse
	res, err := s.client.Do(ctx, req, &attestations)
	if err != nil {
		return nil, res, err
	}

	return attestations, res, nil
}
