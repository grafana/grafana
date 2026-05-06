// Copyright 2019 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// GetRestrictionsForOrg fetches the interaction restrictions for an organization.
//
// GitHub API docs: https://docs.github.com/rest/interactions/orgs#get-interaction-restrictions-for-an-organization
//
//meta:operation GET /orgs/{org}/interaction-limits
func (s *InteractionsService) GetRestrictionsForOrg(ctx context.Context, organization string) (*InteractionRestriction, *Response, error) {
	u := fmt.Sprintf("orgs/%v/interaction-limits", organization)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeInteractionRestrictionsPreview)

	organizationInteractions := new(InteractionRestriction)

	resp, err := s.client.Do(ctx, req, organizationInteractions)
	if err != nil {
		return nil, resp, err
	}

	return organizationInteractions, resp, nil
}

// UpdateRestrictionsForOrg adds or updates the interaction restrictions for an organization.
//
// limit specifies the group of GitHub users who can comment, open issues, or create pull requests
// in public repositories for the given organization.
// Possible values are: "existing_users", "contributors_only", "collaborators_only".
//
// GitHub API docs: https://docs.github.com/rest/interactions/orgs#set-interaction-restrictions-for-an-organization
//
//meta:operation PUT /orgs/{org}/interaction-limits
func (s *InteractionsService) UpdateRestrictionsForOrg(ctx context.Context, organization, limit string) (*InteractionRestriction, *Response, error) {
	u := fmt.Sprintf("orgs/%v/interaction-limits", organization)

	interaction := &InteractionRestriction{Limit: Ptr(limit)}

	req, err := s.client.NewRequest("PUT", u, interaction)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeInteractionRestrictionsPreview)

	organizationInteractions := new(InteractionRestriction)

	resp, err := s.client.Do(ctx, req, organizationInteractions)
	if err != nil {
		return nil, resp, err
	}

	return organizationInteractions, resp, nil
}

// RemoveRestrictionsFromOrg removes the interaction restrictions for an organization.
//
// GitHub API docs: https://docs.github.com/rest/interactions/orgs#remove-interaction-restrictions-for-an-organization
//
//meta:operation DELETE /orgs/{org}/interaction-limits
func (s *InteractionsService) RemoveRestrictionsFromOrg(ctx context.Context, organization string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/interaction-limits", organization)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeInteractionRestrictionsPreview)

	return s.client.Do(ctx, req, nil)
}
