// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// ListSecurityManagerTeams lists all security manager teams for an organization.
//
// Deprecated: Please use `client.Organizations.ListTeamsAssignedToOrgRole` instead.
//
// GitHub API docs: https://docs.github.com/rest/orgs/security-managers#list-security-manager-teams
//
//meta:operation GET /orgs/{org}/security-managers
func (s *OrganizationsService) ListSecurityManagerTeams(ctx context.Context, org string) ([]*Team, *Response, error) {
	u := fmt.Sprintf("orgs/%v/security-managers", org)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var teams []*Team
	resp, err := s.client.Do(ctx, req, &teams)
	if err != nil {
		return nil, resp, err
	}

	return teams, resp, nil
}

// AddSecurityManagerTeam adds a team to the list of security managers for an organization.
//
// Deprecated: Please use `client.Organizations.AssignOrgRoleToTeam` instead.
//
// GitHub API docs: https://docs.github.com/rest/orgs/security-managers#add-a-security-manager-team
//
//meta:operation PUT /orgs/{org}/security-managers/teams/{team_slug}
func (s *OrganizationsService) AddSecurityManagerTeam(ctx context.Context, org, team string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/security-managers/teams/%v", org, team)
	req, err := s.client.NewRequest("PUT", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RemoveSecurityManagerTeam removes a team from the list of security managers for an organization.
//
// Deprecated: Please use `client.Organizations.RemoveOrgRoleFromTeam` instead.
//
// GitHub API docs: https://docs.github.com/rest/orgs/security-managers#remove-a-security-manager-team
//
//meta:operation DELETE /orgs/{org}/security-managers/teams/{team_slug}
func (s *OrganizationsService) RemoveSecurityManagerTeam(ctx context.Context, org, team string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/security-managers/teams/%v", org, team)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
