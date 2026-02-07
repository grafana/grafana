// Copyright 2018 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
	"net/http"
)

// TeamsService provides access to the team-related functions
// in the GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/teams/
type TeamsService service

// Team represents a team within a GitHub organization. Teams are used to
// manage access to an organization's repositories.
type Team struct {
	ID          *int64  `json:"id,omitempty"`
	NodeID      *string `json:"node_id,omitempty"`
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	URL         *string `json:"url,omitempty"`
	Slug        *string `json:"slug,omitempty"`

	// Permission specifies the default permission for repositories owned by the team.
	Permission *string `json:"permission,omitempty"`

	// Privacy identifies the level of privacy this team should have.
	// Possible values are:
	//     secret - only visible to organization owners and members of this team
	//     closed - visible to all members of this organization
	// Default is "secret".
	Privacy *string `json:"privacy,omitempty"`

	// NotificationSetting can be one of: "notifications_enabled", "notifications_disabled".
	NotificationSetting *string `json:"notification_setting,omitempty"`

	MembersCount    *int          `json:"members_count,omitempty"`
	ReposCount      *int          `json:"repos_count,omitempty"`
	Organization    *Organization `json:"organization,omitempty"`
	HTMLURL         *string       `json:"html_url,omitempty"`
	MembersURL      *string       `json:"members_url,omitempty"`
	RepositoriesURL *string       `json:"repositories_url,omitempty"`
	Parent          *Team         `json:"parent,omitempty"`

	// LDAPDN is only available in GitHub Enterprise and when the team
	// membership is synchronized with LDAP.
	LDAPDN *string `json:"ldap_dn,omitempty"`

	// Permissions identifies the permissions that a team has on a given
	// repository. This is only populated when calling Repositories.ListTeams.
	Permissions map[string]bool `json:"permissions,omitempty"`

	// Assignment identifies how a team was assigned to an organization role. Its
	// possible values are: "direct", "indirect", "mixed". This is only populated when
	// calling the ListTeamsAssignedToOrgRole method.
	Assignment *string `json:"assignment,omitempty"`
}

func (t Team) String() string {
	return Stringify(t)
}

// Invitation represents a team member's invitation status.
type Invitation struct {
	ID     *int64  `json:"id,omitempty"`
	NodeID *string `json:"node_id,omitempty"`
	Login  *string `json:"login,omitempty"`
	Email  *string `json:"email,omitempty"`
	// Role can be one of the values - 'direct_member', 'admin', 'billing_manager', 'hiring_manager', or 'reinstate'.
	Role              *string    `json:"role,omitempty"`
	CreatedAt         *Timestamp `json:"created_at,omitempty"`
	Inviter           *User      `json:"inviter,omitempty"`
	TeamCount         *int       `json:"team_count,omitempty"`
	InvitationTeamURL *string    `json:"invitation_team_url,omitempty"`
	FailedAt          *Timestamp `json:"failed_at,omitempty"`
	FailedReason      *string    `json:"failed_reason,omitempty"`
}

func (i Invitation) String() string {
	return Stringify(i)
}

// ListTeams lists all of the teams for an organization.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#list-teams
//
//meta:operation GET /orgs/{org}/teams
func (s *TeamsService) ListTeams(ctx context.Context, org string, opts *ListOptions) ([]*Team, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

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

// GetTeamByID fetches a team, given a specified organization ID, by ID.
//
// Deprecated: Use GetTeamBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#get-a-team-by-name
//
//meta:operation GET /orgs/{org}/teams/{team_slug}
func (s *TeamsService) GetTeamByID(ctx context.Context, orgID, teamID int64) (*Team, *Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v", orgID, teamID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	t := new(Team)
	resp, err := s.client.Do(ctx, req, t)
	if err != nil {
		return nil, resp, err
	}

	return t, resp, nil
}

// GetTeamBySlug fetches a team, given a specified organization name, by slug.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#get-a-team-by-name
//
//meta:operation GET /orgs/{org}/teams/{team_slug}
func (s *TeamsService) GetTeamBySlug(ctx context.Context, org, slug string) (*Team, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v", org, slug)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	t := new(Team)
	resp, err := s.client.Do(ctx, req, t)
	if err != nil {
		return nil, resp, err
	}

	return t, resp, nil
}

// NewTeam represents a team to be created or modified.
type NewTeam struct {
	Name         string   `json:"name"` // Name of the team. (Required.)
	Description  *string  `json:"description,omitempty"`
	Maintainers  []string `json:"maintainers,omitempty"`
	RepoNames    []string `json:"repo_names,omitempty"`
	ParentTeamID *int64   `json:"parent_team_id,omitempty"`

	// NotificationSetting can be one of: "notifications_enabled", "notifications_disabled".
	NotificationSetting *string `json:"notification_setting,omitempty"`

	// Deprecated: Permission is deprecated when creating or editing a team in an org
	// using the new GitHub permission model. It no longer identifies the
	// permission a team has on its repos, but only specifies the default
	// permission a repo is initially added with. Avoid confusion by
	// specifying a permission value when calling AddTeamRepo.
	Permission *string `json:"permission,omitempty"`

	// Privacy identifies the level of privacy this team should have.
	// Possible values are:
	//     secret - only visible to organization owners and members of this team
	//     closed - visible to all members of this organization
	// Default is "secret".
	Privacy *string `json:"privacy,omitempty"`

	// LDAPDN may be used in GitHub Enterprise when the team membership
	// is synchronized with LDAP.
	LDAPDN *string `json:"ldap_dn,omitempty"`
}

func (s NewTeam) String() string {
	return Stringify(s)
}

// CreateTeam creates a new team within an organization.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#create-a-team
//
//meta:operation POST /orgs/{org}/teams
func (s *TeamsService) CreateTeam(ctx context.Context, org string, team NewTeam) (*Team, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams", org)
	req, err := s.client.NewRequest("POST", u, team)
	if err != nil {
		return nil, nil, err
	}

	t := new(Team)
	resp, err := s.client.Do(ctx, req, t)
	if err != nil {
		return nil, resp, err
	}

	return t, resp, nil
}

// newTeamNoParent is the same as NewTeam but ensures that the
// "parent_team_id" field will be null. It is for internal use
// only and should not be exported.
type newTeamNoParent struct {
	Name                string   `json:"name"`
	Description         *string  `json:"description,omitempty"`
	Maintainers         []string `json:"maintainers,omitempty"`
	RepoNames           []string `json:"repo_names,omitempty"`
	ParentTeamID        *int64   `json:"parent_team_id"` // This will be "null"
	NotificationSetting *string  `json:"notification_setting,omitempty"`
	Privacy             *string  `json:"privacy,omitempty"`
	LDAPDN              *string  `json:"ldap_dn,omitempty"`
}

// copyNewTeamWithoutParent is used to set the "parent_team_id"
// field to "null" after copying the other fields from a NewTeam.
// It is for internal use only and should not be exported.
func copyNewTeamWithoutParent(team *NewTeam) *newTeamNoParent {
	return &newTeamNoParent{
		Name:                team.Name,
		Description:         team.Description,
		Maintainers:         team.Maintainers,
		RepoNames:           team.RepoNames,
		NotificationSetting: team.NotificationSetting,
		Privacy:             team.Privacy,
		LDAPDN:              team.LDAPDN,
	}
}

// EditTeamByID edits a team, given an organization ID, selected by ID.
//
// Deprecated: Use EditTeamBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#update-a-team
//
//meta:operation PATCH /orgs/{org}/teams/{team_slug}
func (s *TeamsService) EditTeamByID(ctx context.Context, orgID, teamID int64, team NewTeam, removeParent bool) (*Team, *Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v", orgID, teamID)

	var req *http.Request
	var err error
	if removeParent {
		teamRemoveParent := copyNewTeamWithoutParent(&team)
		req, err = s.client.NewRequest("PATCH", u, teamRemoveParent)
	} else {
		req, err = s.client.NewRequest("PATCH", u, team)
	}
	if err != nil {
		return nil, nil, err
	}

	t := new(Team)
	resp, err := s.client.Do(ctx, req, t)
	if err != nil {
		return nil, resp, err
	}

	return t, resp, nil
}

// EditTeamBySlug edits a team, given an organization name, by slug.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#update-a-team
//
//meta:operation PATCH /orgs/{org}/teams/{team_slug}
func (s *TeamsService) EditTeamBySlug(ctx context.Context, org, slug string, team NewTeam, removeParent bool) (*Team, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v", org, slug)

	var req *http.Request
	var err error
	if removeParent {
		teamRemoveParent := copyNewTeamWithoutParent(&team)
		req, err = s.client.NewRequest("PATCH", u, teamRemoveParent)
	} else {
		req, err = s.client.NewRequest("PATCH", u, team)
	}
	if err != nil {
		return nil, nil, err
	}

	t := new(Team)
	resp, err := s.client.Do(ctx, req, t)
	if err != nil {
		return nil, resp, err
	}

	return t, resp, nil
}

// DeleteTeamByID deletes a team referenced by ID.
//
// Deprecated: Use DeleteTeamBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#delete-a-team
//
//meta:operation DELETE /orgs/{org}/teams/{team_slug}
func (s *TeamsService) DeleteTeamByID(ctx context.Context, orgID, teamID int64) (*Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v", orgID, teamID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// DeleteTeamBySlug deletes a team reference by slug.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#delete-a-team
//
//meta:operation DELETE /orgs/{org}/teams/{team_slug}
func (s *TeamsService) DeleteTeamBySlug(ctx context.Context, org, slug string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v", org, slug)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// ListChildTeamsByParentID lists child teams for a parent team given parent ID.
//
// Deprecated: Use ListChildTeamsByParentSlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#list-child-teams
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/teams
func (s *TeamsService) ListChildTeamsByParentID(ctx context.Context, orgID, teamID int64, opts *ListOptions) ([]*Team, *Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/teams", orgID, teamID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

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

// ListChildTeamsByParentSlug lists child teams for a parent team given parent slug.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#list-child-teams
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/teams
func (s *TeamsService) ListChildTeamsByParentSlug(ctx context.Context, org, slug string, opts *ListOptions) ([]*Team, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/teams", org, slug)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

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

// ListTeamReposByID lists the repositories given a team ID that the specified team has access to.
//
// Deprecated: Use ListTeamReposBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#list-team-repositories
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/repos
func (s *TeamsService) ListTeamReposByID(ctx context.Context, orgID, teamID int64, opts *ListOptions) ([]*Repository, *Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/repos", orgID, teamID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when topics API fully launches.
	req.Header.Set("Accept", mediaTypeTopicsPreview)

	var repos []*Repository
	resp, err := s.client.Do(ctx, req, &repos)
	if err != nil {
		return nil, resp, err
	}

	return repos, resp, nil
}

// ListTeamReposBySlug lists the repositories given a team slug that the specified team has access to.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#list-team-repositories
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/repos
func (s *TeamsService) ListTeamReposBySlug(ctx context.Context, org, slug string, opts *ListOptions) ([]*Repository, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/repos", org, slug)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when topics API fully launches.
	req.Header.Set("Accept", mediaTypeTopicsPreview)

	var repos []*Repository
	resp, err := s.client.Do(ctx, req, &repos)
	if err != nil {
		return nil, resp, err
	}

	return repos, resp, nil
}

// IsTeamRepoByID checks if a team, given its ID, manages the specified repository. If the
// repository is managed by team, a Repository is returned which includes the
// permissions team has for that repo.
//
// Deprecated: Use IsTeamRepoBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#check-team-permissions-for-a-repository
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
func (s *TeamsService) IsTeamRepoByID(ctx context.Context, orgID, teamID int64, owner, repo string) (*Repository, *Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/repos/%v/%v", orgID, teamID, owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Accept", mediaTypeOrgPermissionRepo)

	repository := new(Repository)
	resp, err := s.client.Do(ctx, req, repository)
	if err != nil {
		return nil, resp, err
	}

	return repository, resp, nil
}

// IsTeamRepoBySlug checks if a team, given its slug, manages the specified repository. If the
// repository is managed by team, a Repository is returned which includes the
// permissions team has for that repo.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#check-team-permissions-for-a-repository
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
func (s *TeamsService) IsTeamRepoBySlug(ctx context.Context, org, slug, owner, repo string) (*Repository, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/repos/%v/%v", org, slug, owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Accept", mediaTypeOrgPermissionRepo)

	repository := new(Repository)
	resp, err := s.client.Do(ctx, req, repository)
	if err != nil {
		return nil, resp, err
	}

	return repository, resp, nil
}

// TeamAddTeamRepoOptions specifies the optional parameters to the
// TeamsService.AddTeamRepoByID and TeamsService.AddTeamRepoBySlug methods.
type TeamAddTeamRepoOptions struct {
	// Permission specifies the permission to grant the team on this repository.
	// Possible values are:
	//     pull - team members can pull, but not push to or administer this repository
	//     push - team members can pull and push, but not administer this repository
	//     admin - team members can pull, push and administer this repository
	//     maintain - team members can manage the repository without access to sensitive or destructive actions.
	//     triage - team members can proactively manage issues and pull requests without write access.
	//
	// If not specified, the team's permission attribute will be used.
	Permission string `json:"permission,omitempty"`
}

// AddTeamRepoByID adds a repository to be managed by the specified team given the team ID.
// The specified repository must be owned by the organization to which the team
// belongs, or a direct fork of a repository owned by the organization.
//
// Deprecated: Use AddTeamRepoBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#add-or-update-team-repository-permissions
//
//meta:operation PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
func (s *TeamsService) AddTeamRepoByID(ctx context.Context, orgID, teamID int64, owner, repo string, opts *TeamAddTeamRepoOptions) (*Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/repos/%v/%v", orgID, teamID, owner, repo)
	req, err := s.client.NewRequest("PUT", u, opts)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// AddTeamRepoBySlug adds a repository to be managed by the specified team given the team slug.
// The specified repository must be owned by the organization to which the team
// belongs, or a direct fork of a repository owned by the organization.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#add-or-update-team-repository-permissions
//
//meta:operation PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
func (s *TeamsService) AddTeamRepoBySlug(ctx context.Context, org, slug, owner, repo string, opts *TeamAddTeamRepoOptions) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/repos/%v/%v", org, slug, owner, repo)
	req, err := s.client.NewRequest("PUT", u, opts)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RemoveTeamRepoByID removes a repository from being managed by the specified
// team given the team ID. Note that this does not delete the repository, it
// just removes it from the team.
//
// Deprecated: Use RemoveTeamRepoBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#remove-a-repository-from-a-team
//
//meta:operation DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
func (s *TeamsService) RemoveTeamRepoByID(ctx context.Context, orgID, teamID int64, owner, repo string) (*Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/repos/%v/%v", orgID, teamID, owner, repo)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RemoveTeamRepoBySlug removes a repository from being managed by the specified
// team given the team slug. Note that this does not delete the repository, it
// just removes it from the team.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#remove-a-repository-from-a-team
//
//meta:operation DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
func (s *TeamsService) RemoveTeamRepoBySlug(ctx context.Context, org, slug, owner, repo string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/repos/%v/%v", org, slug, owner, repo)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// ListUserTeams lists a user's teams
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#list-teams-for-the-authenticated-user
//
//meta:operation GET /user/teams
func (s *TeamsService) ListUserTeams(ctx context.Context, opts *ListOptions) ([]*Team, *Response, error) {
	u := "user/teams"
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

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

// ListTeamProjectsByID lists the organization projects for a team given the team ID.
//
// Deprecated: Use ListTeamProjectsBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#list-team-projects
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/projects
func (s *TeamsService) ListTeamProjectsByID(ctx context.Context, orgID, teamID int64) ([]*ProjectV2, *Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/projects", orgID, teamID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeProjectsPreview)

	var projects []*ProjectV2
	resp, err := s.client.Do(ctx, req, &projects)
	if err != nil {
		return nil, resp, err
	}

	return projects, resp, nil
}

// ListTeamProjectsBySlug lists the organization projects for a team given the team slug.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#list-team-projects
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/projects
func (s *TeamsService) ListTeamProjectsBySlug(ctx context.Context, org, slug string) ([]*ProjectV2, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/projects", org, slug)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeProjectsPreview)

	var projects []*ProjectV2
	resp, err := s.client.Do(ctx, req, &projects)
	if err != nil {
		return nil, resp, err
	}

	return projects, resp, nil
}

// ReviewTeamProjectsByID checks whether a team, given its ID, has read, write, or admin
// permissions for an organization project.
//
// Deprecated: Use ReviewTeamProjectsBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#check-team-permissions-for-a-project
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/projects/{project_id}
func (s *TeamsService) ReviewTeamProjectsByID(ctx context.Context, orgID, teamID, projectID int64) (*ProjectV2, *Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/projects/%v", orgID, teamID, projectID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeProjectsPreview)

	projects := &ProjectV2{}
	resp, err := s.client.Do(ctx, req, &projects)
	if err != nil {
		return nil, resp, err
	}

	return projects, resp, nil
}

// ReviewTeamProjectsBySlug checks whether a team, given its slug, has read, write, or admin
// permissions for an organization project.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#check-team-permissions-for-a-project
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/projects/{project_id}
func (s *TeamsService) ReviewTeamProjectsBySlug(ctx context.Context, org, slug string, projectID int64) (*ProjectV2, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/projects/%v", org, slug, projectID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeProjectsPreview)

	projects := &ProjectV2{}
	resp, err := s.client.Do(ctx, req, &projects)
	if err != nil {
		return nil, resp, err
	}

	return projects, resp, nil
}

// TeamProjectOptions specifies the optional parameters to the
// TeamsService.AddTeamProject method.
type TeamProjectOptions struct {
	// Permission specifies the permission to grant to the team for this project.
	// Possible values are:
	//     "read" - team members can read, but not write to or administer this project.
	//     "write" - team members can read and write, but not administer this project.
	//     "admin" - team members can read, write and administer this project.
	//
	Permission *string `json:"permission,omitempty"`
}

// AddTeamProjectByID adds an organization project to a team given the team ID.
// To add a project to a team or update the team's permission on a project, the
// authenticated user must have admin permissions for the project.
//
// Deprecated: Use AddTeamProjectBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#add-or-update-team-project-permissions
//
//meta:operation PUT /orgs/{org}/teams/{team_slug}/projects/{project_id}
func (s *TeamsService) AddTeamProjectByID(ctx context.Context, orgID, teamID, projectID int64, opts *TeamProjectOptions) (*Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/projects/%v", orgID, teamID, projectID)
	req, err := s.client.NewRequest("PUT", u, opts)
	if err != nil {
		return nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeProjectsPreview)

	return s.client.Do(ctx, req, nil)
}

// AddTeamProjectBySlug adds an organization project to a team given the team slug.
// To add a project to a team or update the team's permission on a project, the
// authenticated user must have admin permissions for the project.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#add-or-update-team-project-permissions
//
//meta:operation PUT /orgs/{org}/teams/{team_slug}/projects/{project_id}
func (s *TeamsService) AddTeamProjectBySlug(ctx context.Context, org, slug string, projectID int64, opts *TeamProjectOptions) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/projects/%v", org, slug, projectID)
	req, err := s.client.NewRequest("PUT", u, opts)
	if err != nil {
		return nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeProjectsPreview)

	return s.client.Do(ctx, req, nil)
}

// RemoveTeamProjectByID removes an organization project from a team given team ID.
// An organization owner or a team maintainer can remove any project from the team.
// To remove a project from a team as an organization member, the authenticated user
// must have "read" access to both the team and project, or "admin" access to the team
// or project.
// Note: This endpoint removes the project from the team, but does not delete it.
//
// Deprecated: Use RemoveTeamProjectBySlug instead.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#remove-a-project-from-a-team
//
//meta:operation DELETE /orgs/{org}/teams/{team_slug}/projects/{project_id}
func (s *TeamsService) RemoveTeamProjectByID(ctx context.Context, orgID, teamID, projectID int64) (*Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/projects/%v", orgID, teamID, projectID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeProjectsPreview)

	return s.client.Do(ctx, req, nil)
}

// RemoveTeamProjectBySlug removes an organization project from a team given team slug.
// An organization owner or a team maintainer can remove any project from the team.
// To remove a project from a team as an organization member, the authenticated user
// must have "read" access to both the team and project, or "admin" access to the team
// or project.
// Note: This endpoint removes the project from the team, but does not delete it.
//
// GitHub API docs: https://docs.github.com/rest/teams/teams#remove-a-project-from-a-team
//
//meta:operation DELETE /orgs/{org}/teams/{team_slug}/projects/{project_id}
func (s *TeamsService) RemoveTeamProjectBySlug(ctx context.Context, org, slug string, projectID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/projects/%v", org, slug, projectID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeProjectsPreview)

	return s.client.Do(ctx, req, nil)
}

// ListIDPGroupsOptions specifies the optional parameters to the ListIDPGroupsInOrganization method.
type ListIDPGroupsOptions struct {
	// Filters the results to return only those that begin with the value specified by this parameter.
	Query string `url:"q,omitempty"`

	ListCursorOptions
}

// IDPGroupList represents a list of external identity provider (IDP) groups.
type IDPGroupList struct {
	Groups []*IDPGroup `json:"groups"`
}

// IDPGroup represents an external identity provider (IDP) group.
type IDPGroup struct {
	GroupID          *string `json:"group_id,omitempty"`
	GroupName        *string `json:"group_name,omitempty"`
	GroupDescription *string `json:"group_description,omitempty"`
}

// ListIDPGroupsInOrganization lists IDP groups available in an organization.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/teams/team-sync#list-idp-groups-for-an-organization
//
//meta:operation GET /orgs/{org}/team-sync/groups
func (s *TeamsService) ListIDPGroupsInOrganization(ctx context.Context, org string, opts *ListIDPGroupsOptions) (*IDPGroupList, *Response, error) {
	u := fmt.Sprintf("orgs/%v/team-sync/groups", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	groups := new(IDPGroupList)
	resp, err := s.client.Do(ctx, req, groups)
	if err != nil {
		return nil, resp, err
	}

	return groups, resp, nil
}

// ListIDPGroupsForTeamByID lists IDP groups connected to a team on GitHub
// given organization and team IDs.
//
// Deprecated: Use ListIDPGroupsForTeamBySlug instead.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/teams/team-sync#list-idp-groups-for-a-team
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/team-sync/group-mappings
func (s *TeamsService) ListIDPGroupsForTeamByID(ctx context.Context, orgID, teamID int64) (*IDPGroupList, *Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/team-sync/group-mappings", orgID, teamID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	groups := new(IDPGroupList)
	resp, err := s.client.Do(ctx, req, groups)
	if err != nil {
		return nil, resp, err
	}

	return groups, resp, nil
}

// ListIDPGroupsForTeamBySlug lists IDP groups connected to a team on GitHub
// given organization name and team slug.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/teams/team-sync#list-idp-groups-for-a-team
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/team-sync/group-mappings
func (s *TeamsService) ListIDPGroupsForTeamBySlug(ctx context.Context, org, slug string) (*IDPGroupList, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/team-sync/group-mappings", org, slug)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	groups := new(IDPGroupList)
	resp, err := s.client.Do(ctx, req, groups)
	if err != nil {
		return nil, resp, err
	}

	return groups, resp, nil
}

// CreateOrUpdateIDPGroupConnectionsByID creates, updates, or removes a connection
// between a team and an IDP group given organization and team IDs.
//
// Deprecated: Use CreateOrUpdateIDPGroupConnectionsBySlug instead.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/teams/team-sync#create-or-update-idp-group-connections
//
//meta:operation PATCH /orgs/{org}/teams/{team_slug}/team-sync/group-mappings
func (s *TeamsService) CreateOrUpdateIDPGroupConnectionsByID(ctx context.Context, orgID, teamID int64, opts IDPGroupList) (*IDPGroupList, *Response, error) {
	u := fmt.Sprintf("organizations/%v/team/%v/team-sync/group-mappings", orgID, teamID)

	req, err := s.client.NewRequest("PATCH", u, opts)
	if err != nil {
		return nil, nil, err
	}

	groups := new(IDPGroupList)
	resp, err := s.client.Do(ctx, req, groups)
	if err != nil {
		return nil, resp, err
	}

	return groups, resp, nil
}

// CreateOrUpdateIDPGroupConnectionsBySlug creates, updates, or removes a connection
// between a team and an IDP group given organization name and team slug.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/teams/team-sync#create-or-update-idp-group-connections
//
//meta:operation PATCH /orgs/{org}/teams/{team_slug}/team-sync/group-mappings
func (s *TeamsService) CreateOrUpdateIDPGroupConnectionsBySlug(ctx context.Context, org, slug string, opts IDPGroupList) (*IDPGroupList, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/team-sync/group-mappings", org, slug)

	req, err := s.client.NewRequest("PATCH", u, opts)
	if err != nil {
		return nil, nil, err
	}

	groups := new(IDPGroupList)
	resp, err := s.client.Do(ctx, req, groups)
	if err != nil {
		return nil, resp, err
	}

	return groups, resp, nil
}

// ExternalGroupMember represents a member of an external group.
type ExternalGroupMember struct {
	MemberID    *int64  `json:"member_id,omitempty"`
	MemberLogin *string `json:"member_login,omitempty"`
	MemberName  *string `json:"member_name,omitempty"`
	MemberEmail *string `json:"member_email,omitempty"`
}

// ExternalGroupTeam represents a team connected to an external group.
type ExternalGroupTeam struct {
	TeamID   *int64  `json:"team_id,omitempty"`
	TeamName *string `json:"team_name,omitempty"`
}

// ExternalGroup represents an external group.
type ExternalGroup struct {
	GroupID   *int64                 `json:"group_id,omitempty"`
	GroupName *string                `json:"group_name,omitempty"`
	UpdatedAt *Timestamp             `json:"updated_at,omitempty"`
	Teams     []*ExternalGroupTeam   `json:"teams,omitempty"`
	Members   []*ExternalGroupMember `json:"members,omitempty"`
}

// ExternalGroupList represents a list of external groups.
type ExternalGroupList struct {
	Groups []*ExternalGroup `json:"groups"`
}

// GetExternalGroup fetches an external group.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/teams/external-groups#get-an-external-group
//
//meta:operation GET /orgs/{org}/external-group/{group_id}
func (s *TeamsService) GetExternalGroup(ctx context.Context, org string, groupID int64) (*ExternalGroup, *Response, error) {
	u := fmt.Sprintf("orgs/%v/external-group/%v", org, groupID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	externalGroup := new(ExternalGroup)
	resp, err := s.client.Do(ctx, req, externalGroup)
	if err != nil {
		return nil, resp, err
	}

	return externalGroup, resp, nil
}

// ListExternalGroupsOptions specifies the optional parameters to the
// TeamsService.ListExternalGroups method.
type ListExternalGroupsOptions struct {
	DisplayName *string `url:"display_name,omitempty"`

	ListOptions
}

// ListExternalGroups lists external groups in an organization on GitHub.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/teams/external-groups#list-external-groups-in-an-organization
//
//meta:operation GET /orgs/{org}/external-groups
func (s *TeamsService) ListExternalGroups(ctx context.Context, org string, opts *ListExternalGroupsOptions) (*ExternalGroupList, *Response, error) {
	u := fmt.Sprintf("orgs/%v/external-groups", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	externalGroups := new(ExternalGroupList)
	resp, err := s.client.Do(ctx, req, externalGroups)
	if err != nil {
		return nil, resp, err
	}

	return externalGroups, resp, nil
}

// ListExternalGroupsForTeamBySlug lists external groups connected to a team on GitHub.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/teams/external-groups#list-a-connection-between-an-external-group-and-a-team
//
//meta:operation GET /orgs/{org}/teams/{team_slug}/external-groups
func (s *TeamsService) ListExternalGroupsForTeamBySlug(ctx context.Context, org, slug string) (*ExternalGroupList, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/external-groups", org, slug)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	externalGroups := new(ExternalGroupList)
	resp, err := s.client.Do(ctx, req, externalGroups)
	if err != nil {
		return nil, resp, err
	}

	return externalGroups, resp, nil
}

// UpdateConnectedExternalGroup updates the connection between an external group and a team.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/teams/external-groups#update-the-connection-between-an-external-group-and-a-team
//
//meta:operation PATCH /orgs/{org}/teams/{team_slug}/external-groups
func (s *TeamsService) UpdateConnectedExternalGroup(ctx context.Context, org, slug string, eg *ExternalGroup) (*ExternalGroup, *Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/external-groups", org, slug)

	req, err := s.client.NewRequest("PATCH", u, eg)
	if err != nil {
		return nil, nil, err
	}

	externalGroup := new(ExternalGroup)
	resp, err := s.client.Do(ctx, req, externalGroup)
	if err != nil {
		return nil, resp, err
	}

	return externalGroup, resp, nil
}

// RemoveConnectedExternalGroup removes the connection between an external group and a team.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/teams/external-groups#remove-the-connection-between-an-external-group-and-a-team
//
//meta:operation DELETE /orgs/{org}/teams/{team_slug}/external-groups
func (s *TeamsService) RemoveConnectedExternalGroup(ctx context.Context, org, slug string) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/teams/%v/external-groups", org, slug)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
