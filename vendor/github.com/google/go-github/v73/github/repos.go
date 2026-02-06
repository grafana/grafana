// Copyright 2013 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const githubBranchNotProtected string = "Branch not protected"

var ErrBranchNotProtected = errors.New("branch is not protected")

// RepositoriesService handles communication with the repository related
// methods of the GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/repos/
type RepositoriesService service

// Repository represents a GitHub repository.
type Repository struct {
	ID                        *int64          `json:"id,omitempty"`
	NodeID                    *string         `json:"node_id,omitempty"`
	Owner                     *User           `json:"owner,omitempty"`
	Name                      *string         `json:"name,omitempty"`
	FullName                  *string         `json:"full_name,omitempty"`
	Description               *string         `json:"description,omitempty"`
	Homepage                  *string         `json:"homepage,omitempty"`
	CodeOfConduct             *CodeOfConduct  `json:"code_of_conduct,omitempty"`
	DefaultBranch             *string         `json:"default_branch,omitempty"`
	MasterBranch              *string         `json:"master_branch,omitempty"`
	CreatedAt                 *Timestamp      `json:"created_at,omitempty"`
	PushedAt                  *Timestamp      `json:"pushed_at,omitempty"`
	UpdatedAt                 *Timestamp      `json:"updated_at,omitempty"`
	HTMLURL                   *string         `json:"html_url,omitempty"`
	CloneURL                  *string         `json:"clone_url,omitempty"`
	GitURL                    *string         `json:"git_url,omitempty"`
	MirrorURL                 *string         `json:"mirror_url,omitempty"`
	SSHURL                    *string         `json:"ssh_url,omitempty"`
	SVNURL                    *string         `json:"svn_url,omitempty"`
	Language                  *string         `json:"language,omitempty"`
	Fork                      *bool           `json:"fork,omitempty"`
	ForksCount                *int            `json:"forks_count,omitempty"`
	NetworkCount              *int            `json:"network_count,omitempty"`
	OpenIssuesCount           *int            `json:"open_issues_count,omitempty"`
	OpenIssues                *int            `json:"open_issues,omitempty"` // Deprecated: Replaced by OpenIssuesCount. For backward compatibility OpenIssues is still populated.
	StargazersCount           *int            `json:"stargazers_count,omitempty"`
	SubscribersCount          *int            `json:"subscribers_count,omitempty"`
	WatchersCount             *int            `json:"watchers_count,omitempty"` // Deprecated: Replaced by StargazersCount. For backward compatibility WatchersCount is still populated.
	Watchers                  *int            `json:"watchers,omitempty"`       // Deprecated: Replaced by StargazersCount. For backward compatibility Watchers is still populated.
	Size                      *int            `json:"size,omitempty"`
	AutoInit                  *bool           `json:"auto_init,omitempty"`
	Parent                    *Repository     `json:"parent,omitempty"`
	Source                    *Repository     `json:"source,omitempty"`
	TemplateRepository        *Repository     `json:"template_repository,omitempty"`
	Organization              *Organization   `json:"organization,omitempty"`
	Permissions               map[string]bool `json:"permissions,omitempty"`
	AllowRebaseMerge          *bool           `json:"allow_rebase_merge,omitempty"`
	AllowUpdateBranch         *bool           `json:"allow_update_branch,omitempty"`
	AllowSquashMerge          *bool           `json:"allow_squash_merge,omitempty"`
	AllowMergeCommit          *bool           `json:"allow_merge_commit,omitempty"`
	AllowAutoMerge            *bool           `json:"allow_auto_merge,omitempty"`
	AllowForking              *bool           `json:"allow_forking,omitempty"`
	WebCommitSignoffRequired  *bool           `json:"web_commit_signoff_required,omitempty"`
	DeleteBranchOnMerge       *bool           `json:"delete_branch_on_merge,omitempty"`
	UseSquashPRTitleAsDefault *bool           `json:"use_squash_pr_title_as_default,omitempty"`
	SquashMergeCommitTitle    *string         `json:"squash_merge_commit_title,omitempty"`   // Can be one of: "PR_TITLE", "COMMIT_OR_PR_TITLE"
	SquashMergeCommitMessage  *string         `json:"squash_merge_commit_message,omitempty"` // Can be one of: "PR_BODY", "COMMIT_MESSAGES", "BLANK"
	MergeCommitTitle          *string         `json:"merge_commit_title,omitempty"`          // Can be one of: "PR_TITLE", "MERGE_MESSAGE"
	MergeCommitMessage        *string         `json:"merge_commit_message,omitempty"`        // Can be one of: "PR_BODY", "PR_TITLE", "BLANK"
	Topics                    []string        `json:"topics,omitempty"`
	CustomProperties          map[string]any  `json:"custom_properties,omitempty"`
	Archived                  *bool           `json:"archived,omitempty"`
	Disabled                  *bool           `json:"disabled,omitempty"`

	// Only provided when using RepositoriesService.Get while in preview
	License *License `json:"license,omitempty"`

	// Additional mutable fields when creating and editing a repository
	Private           *bool   `json:"private,omitempty"`
	HasIssues         *bool   `json:"has_issues,omitempty"`
	HasWiki           *bool   `json:"has_wiki,omitempty"`
	HasPages          *bool   `json:"has_pages,omitempty"`
	HasProjects       *bool   `json:"has_projects,omitempty"`
	HasDownloads      *bool   `json:"has_downloads,omitempty"`
	HasDiscussions    *bool   `json:"has_discussions,omitempty"`
	IsTemplate        *bool   `json:"is_template,omitempty"`
	LicenseTemplate   *string `json:"license_template,omitempty"`
	GitignoreTemplate *string `json:"gitignore_template,omitempty"`

	// Options for configuring Advanced Security and Secret Scanning
	SecurityAndAnalysis *SecurityAndAnalysis `json:"security_and_analysis,omitempty"`

	// Creating an organization repository. Required for non-owners.
	TeamID *int64 `json:"team_id,omitempty"`

	// API URLs
	URL              *string `json:"url,omitempty"`
	ArchiveURL       *string `json:"archive_url,omitempty"`
	AssigneesURL     *string `json:"assignees_url,omitempty"`
	BlobsURL         *string `json:"blobs_url,omitempty"`
	BranchesURL      *string `json:"branches_url,omitempty"`
	CollaboratorsURL *string `json:"collaborators_url,omitempty"`
	CommentsURL      *string `json:"comments_url,omitempty"`
	CommitsURL       *string `json:"commits_url,omitempty"`
	CompareURL       *string `json:"compare_url,omitempty"`
	ContentsURL      *string `json:"contents_url,omitempty"`
	ContributorsURL  *string `json:"contributors_url,omitempty"`
	DeploymentsURL   *string `json:"deployments_url,omitempty"`
	DownloadsURL     *string `json:"downloads_url,omitempty"`
	EventsURL        *string `json:"events_url,omitempty"`
	ForksURL         *string `json:"forks_url,omitempty"`
	GitCommitsURL    *string `json:"git_commits_url,omitempty"`
	GitRefsURL       *string `json:"git_refs_url,omitempty"`
	GitTagsURL       *string `json:"git_tags_url,omitempty"`
	HooksURL         *string `json:"hooks_url,omitempty"`
	IssueCommentURL  *string `json:"issue_comment_url,omitempty"`
	IssueEventsURL   *string `json:"issue_events_url,omitempty"`
	IssuesURL        *string `json:"issues_url,omitempty"`
	KeysURL          *string `json:"keys_url,omitempty"`
	LabelsURL        *string `json:"labels_url,omitempty"`
	LanguagesURL     *string `json:"languages_url,omitempty"`
	MergesURL        *string `json:"merges_url,omitempty"`
	MilestonesURL    *string `json:"milestones_url,omitempty"`
	NotificationsURL *string `json:"notifications_url,omitempty"`
	PullsURL         *string `json:"pulls_url,omitempty"`
	ReleasesURL      *string `json:"releases_url,omitempty"`
	StargazersURL    *string `json:"stargazers_url,omitempty"`
	StatusesURL      *string `json:"statuses_url,omitempty"`
	SubscribersURL   *string `json:"subscribers_url,omitempty"`
	SubscriptionURL  *string `json:"subscription_url,omitempty"`
	TagsURL          *string `json:"tags_url,omitempty"`
	TreesURL         *string `json:"trees_url,omitempty"`
	TeamsURL         *string `json:"teams_url,omitempty"`

	// TextMatches is only populated from search results that request text matches
	// See: search.go and https://docs.github.com/rest/search/#text-match-metadata
	TextMatches []*TextMatch `json:"text_matches,omitempty"`

	// Visibility is only used for Create and Edit endpoints. The visibility field
	// overrides the field parameter when both are used.
	// Can be one of public, private or internal.
	Visibility *string `json:"visibility,omitempty"`

	// RoleName is only returned by the API 'check team permissions for a repository'.
	// See: teams.go (IsTeamRepoByID) https://docs.github.com/rest/teams/teams#check-team-permissions-for-a-repository
	RoleName *string `json:"role_name,omitempty"`
}

func (r Repository) String() string {
	return Stringify(r)
}

// BranchListOptions specifies the optional parameters to the
// RepositoriesService.ListBranches method.
type BranchListOptions struct {
	// Setting to true returns only protected branches.
	// When set to false, only unprotected branches are returned.
	// Omitting this parameter returns all branches.
	// Default: nil
	Protected *bool `url:"protected,omitempty"`

	ListOptions
}

// RepositoryListOptions specifies the optional parameters to the
// RepositoriesService.List method.
type RepositoryListOptions struct {
	// See RepositoryListByAuthenticatedUserOptions.Visibility
	Visibility string `url:"visibility,omitempty"`

	// See RepositoryListByAuthenticatedUserOptions.Affiliation
	Affiliation string `url:"affiliation,omitempty"`

	// See RepositoryListByUserOptions.Type or RepositoryListByAuthenticatedUserOptions.Type
	Type string `url:"type,omitempty"`

	// See RepositoryListByUserOptions.Sort or RepositoryListByAuthenticatedUserOptions.Sort
	Sort string `url:"sort,omitempty"`

	// See RepositoryListByUserOptions.Direction or RepositoryListByAuthenticatedUserOptions.Direction
	Direction string `url:"direction,omitempty"`

	ListOptions
}

// SecurityAndAnalysis specifies the optional advanced security features
// that are enabled on a given repository.
type SecurityAndAnalysis struct {
	AdvancedSecurity             *AdvancedSecurity             `json:"advanced_security,omitempty"`
	SecretScanning               *SecretScanning               `json:"secret_scanning,omitempty"`
	SecretScanningPushProtection *SecretScanningPushProtection `json:"secret_scanning_push_protection,omitempty"`
	DependabotSecurityUpdates    *DependabotSecurityUpdates    `json:"dependabot_security_updates,omitempty"`
	SecretScanningValidityChecks *SecretScanningValidityChecks `json:"secret_scanning_validity_checks,omitempty"`
}

func (s SecurityAndAnalysis) String() string {
	return Stringify(s)
}

// AdvancedSecurity specifies the state of advanced security on a repository.
//
// GitHub API docs: https://docs.github.com/github/getting-started-with-github/learning-about-github/about-github-advanced-security
type AdvancedSecurity struct {
	Status *string `json:"status,omitempty"`
}

func (a AdvancedSecurity) String() string {
	return Stringify(a)
}

// SecretScanning specifies the state of secret scanning on a repository.
//
// GitHub API docs: https://docs.github.com/code-security/secret-security/about-secret-scanning
type SecretScanning struct {
	Status *string `json:"status,omitempty"`
}

func (s SecretScanning) String() string {
	return Stringify(s)
}

// SecretScanningPushProtection specifies the state of secret scanning push protection on a repository.
//
// GitHub API docs: https://docs.github.com/code-security/secret-scanning/about-secret-scanning#about-secret-scanning-for-partner-patterns
type SecretScanningPushProtection struct {
	Status *string `json:"status,omitempty"`
}

func (s SecretScanningPushProtection) String() string {
	return Stringify(s)
}

// DependabotSecurityUpdates specifies the state of Dependabot security updates on a repository.
//
// GitHub API docs: https://docs.github.com/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates
type DependabotSecurityUpdates struct {
	Status *string `json:"status,omitempty"`
}

func (d DependabotSecurityUpdates) String() string {
	return Stringify(d)
}

// SecretScanningValidityChecks represents the state of secret scanning validity checks on a repository.
//
// GitHub API docs: https://docs.github.com/en/enterprise-cloud@latest/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository#allowing-validity-checks-for-partner-patterns-in-a-repository
type SecretScanningValidityChecks struct {
	Status *string `json:"status,omitempty"`
}

// List calls either RepositoriesService.ListByUser or RepositoriesService.ListByAuthenticatedUser
// depending on whether user is empty.
//
// Deprecated: Use RepositoriesService.ListByUser or RepositoriesService.ListByAuthenticatedUser instead.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-repositories-for-a-user
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-repositories-for-the-authenticated-user
//
//meta:operation GET /user/repos
//meta:operation GET /users/{username}/repos
func (s *RepositoriesService) List(ctx context.Context, user string, opts *RepositoryListOptions) ([]*Repository, *Response, error) {
	if opts == nil {
		opts = &RepositoryListOptions{}
	}
	if user != "" {
		return s.ListByUser(ctx, user, &RepositoryListByUserOptions{
			Type:        opts.Type,
			Sort:        opts.Sort,
			Direction:   opts.Direction,
			ListOptions: opts.ListOptions,
		})
	}
	return s.ListByAuthenticatedUser(ctx, &RepositoryListByAuthenticatedUserOptions{
		Visibility:  opts.Visibility,
		Affiliation: opts.Affiliation,
		Type:        opts.Type,
		Sort:        opts.Sort,
		Direction:   opts.Direction,
		ListOptions: opts.ListOptions,
	})
}

// RepositoryListByUserOptions specifies the optional parameters to the
// RepositoriesService.ListByUser method.
type RepositoryListByUserOptions struct {
	// Limit results to repositories of the specified type.
	// Default: owner
	// Can be one of: all, owner, member
	Type string `url:"type,omitempty"`

	// The property to sort the results by.
	// Default: full_name
	// Can be one of: created, updated, pushed, full_name
	Sort string `url:"sort,omitempty"`

	// The order to sort by.
	// Default: asc when using full_name, otherwise desc.
	// Can be one of: asc, desc
	Direction string `url:"direction,omitempty"`

	ListOptions
}

// ListByUser lists public repositories for the specified user.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-repositories-for-a-user
//
//meta:operation GET /users/{username}/repos
func (s *RepositoriesService) ListByUser(ctx context.Context, user string, opts *RepositoryListByUserOptions) ([]*Repository, *Response, error) {
	u := fmt.Sprintf("users/%v/repos", user)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var repos []*Repository
	resp, err := s.client.Do(ctx, req, &repos)
	if err != nil {
		return nil, resp, err
	}

	return repos, resp, nil
}

// RepositoryListByAuthenticatedUserOptions specifies the optional parameters to the
// RepositoriesService.ListByAuthenticatedUser method.
type RepositoryListByAuthenticatedUserOptions struct {
	// Limit results to repositories with the specified visibility.
	// Default: all
	// Can be one of: all, public, private
	Visibility string `url:"visibility,omitempty"`

	// List repos of given affiliation[s].
	// Comma-separated list of values. Can include:
	// * owner: Repositories that are owned by the authenticated user.
	// * collaborator: Repositories that the user has been added to as a
	//   collaborator.
	// * organization_member: Repositories that the user has access to through
	//   being a member of an organization. This includes every repository on
	//   every team that the user is on.
	// Default: owner,collaborator,organization_member
	Affiliation string `url:"affiliation,omitempty"`

	// Limit results to repositories of the specified type. Will cause a 422 error if
	// used in the same request as visibility or affiliation.
	// Default: all
	// Can be one of: all, owner, public, private, member
	Type string `url:"type,omitempty"`

	// The property to sort the results by.
	// Default: full_name
	// Can be one of: created, updated, pushed, full_name
	Sort string `url:"sort,omitempty"`

	// Direction in which to sort repositories. Can be one of asc or desc.
	// Default: when using full_name: asc; otherwise desc
	Direction string `url:"direction,omitempty"`

	ListOptions
}

// ListByAuthenticatedUser lists repositories for the authenticated user.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-repositories-for-the-authenticated-user
//
//meta:operation GET /user/repos
func (s *RepositoriesService) ListByAuthenticatedUser(ctx context.Context, opts *RepositoryListByAuthenticatedUserOptions) ([]*Repository, *Response, error) {
	u := "user/repos"
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var repos []*Repository
	resp, err := s.client.Do(ctx, req, &repos)
	if err != nil {
		return nil, resp, err
	}

	return repos, resp, nil
}

// RepositoryListByOrgOptions specifies the optional parameters to the
// RepositoriesService.ListByOrg method.
type RepositoryListByOrgOptions struct {
	// Type of repositories to list. Possible values are: all, public, private,
	// forks, sources, member. Default is "all".
	Type string `url:"type,omitempty"`

	// How to sort the repository list. Can be one of created, updated, pushed,
	// full_name. Default is "created".
	Sort string `url:"sort,omitempty"`

	// Direction in which to sort repositories. Can be one of asc or desc.
	// Default when using full_name: asc; otherwise desc.
	Direction string `url:"direction,omitempty"`

	ListOptions
}

// ListByOrg lists the repositories for an organization.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-organization-repositories
//
//meta:operation GET /orgs/{org}/repos
func (s *RepositoriesService) ListByOrg(ctx context.Context, org string, opts *RepositoryListByOrgOptions) ([]*Repository, *Response, error) {
	u := fmt.Sprintf("orgs/%v/repos", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept headers when APIs fully launch.
	acceptHeaders := []string{mediaTypeTopicsPreview, mediaTypeRepositoryVisibilityPreview}
	req.Header.Set("Accept", strings.Join(acceptHeaders, ", "))

	var repos []*Repository
	resp, err := s.client.Do(ctx, req, &repos)
	if err != nil {
		return nil, resp, err
	}

	return repos, resp, nil
}

// RepositoryListAllOptions specifies the optional parameters to the
// RepositoriesService.ListAll method.
type RepositoryListAllOptions struct {
	// ID of the last repository seen
	Since int64 `url:"since,omitempty"`
}

// ListAll lists all GitHub repositories in the order that they were created.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-public-repositories
//
//meta:operation GET /repositories
func (s *RepositoriesService) ListAll(ctx context.Context, opts *RepositoryListAllOptions) ([]*Repository, *Response, error) {
	u, err := addOptions("repositories", opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var repos []*Repository
	resp, err := s.client.Do(ctx, req, &repos)
	if err != nil {
		return nil, resp, err
	}

	return repos, resp, nil
}

// createRepoRequest is a subset of Repository and is used internally
// by Create to pass only the known fields for the endpoint.
//
// See https://github.com/google/go-github/issues/1014 for more
// information.
type createRepoRequest struct {
	// Name is required when creating a repo.
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Homepage    *string `json:"homepage,omitempty"`

	Private        *bool   `json:"private,omitempty"`
	Visibility     *string `json:"visibility,omitempty"`
	HasIssues      *bool   `json:"has_issues,omitempty"`
	HasProjects    *bool   `json:"has_projects,omitempty"`
	HasWiki        *bool   `json:"has_wiki,omitempty"`
	HasDiscussions *bool   `json:"has_discussions,omitempty"`
	IsTemplate     *bool   `json:"is_template,omitempty"`

	// Creating an organization repository. Required for non-owners.
	TeamID *int64 `json:"team_id,omitempty"`

	AutoInit                  *bool   `json:"auto_init,omitempty"`
	GitignoreTemplate         *string `json:"gitignore_template,omitempty"`
	LicenseTemplate           *string `json:"license_template,omitempty"`
	AllowSquashMerge          *bool   `json:"allow_squash_merge,omitempty"`
	AllowMergeCommit          *bool   `json:"allow_merge_commit,omitempty"`
	AllowRebaseMerge          *bool   `json:"allow_rebase_merge,omitempty"`
	AllowUpdateBranch         *bool   `json:"allow_update_branch,omitempty"`
	AllowAutoMerge            *bool   `json:"allow_auto_merge,omitempty"`
	AllowForking              *bool   `json:"allow_forking,omitempty"`
	DeleteBranchOnMerge       *bool   `json:"delete_branch_on_merge,omitempty"`
	UseSquashPRTitleAsDefault *bool   `json:"use_squash_pr_title_as_default,omitempty"`
	SquashMergeCommitTitle    *string `json:"squash_merge_commit_title,omitempty"`
	SquashMergeCommitMessage  *string `json:"squash_merge_commit_message,omitempty"`
	MergeCommitTitle          *string `json:"merge_commit_title,omitempty"`
	MergeCommitMessage        *string `json:"merge_commit_message,omitempty"`
}

// Create a new repository. If an organization is specified, the new
// repository will be created under that org. If the empty string is
// specified, it will be created for the authenticated user.
//
// Note that only a subset of the repo fields are used and repo must
// not be nil.
//
// Also note that this method will return the response without actually
// waiting for GitHub to finish creating the repository and letting the
// changes propagate throughout its servers. You may set up a loop with
// exponential back-off to verify repository's creation.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#create-a-repository-for-the-authenticated-user
// GitHub API docs: https://docs.github.com/rest/repos/repos#create-an-organization-repository
//
//meta:operation POST /orgs/{org}/repos
//meta:operation POST /user/repos
func (s *RepositoriesService) Create(ctx context.Context, org string, repo *Repository) (*Repository, *Response, error) {
	var u string
	if org != "" {
		u = fmt.Sprintf("orgs/%v/repos", org)
	} else {
		u = "user/repos"
	}

	repoReq := &createRepoRequest{
		Name:                      repo.Name,
		Description:               repo.Description,
		Homepage:                  repo.Homepage,
		Private:                   repo.Private,
		Visibility:                repo.Visibility,
		HasIssues:                 repo.HasIssues,
		HasProjects:               repo.HasProjects,
		HasWiki:                   repo.HasWiki,
		HasDiscussions:            repo.HasDiscussions,
		IsTemplate:                repo.IsTemplate,
		TeamID:                    repo.TeamID,
		AutoInit:                  repo.AutoInit,
		GitignoreTemplate:         repo.GitignoreTemplate,
		LicenseTemplate:           repo.LicenseTemplate,
		AllowSquashMerge:          repo.AllowSquashMerge,
		AllowMergeCommit:          repo.AllowMergeCommit,
		AllowRebaseMerge:          repo.AllowRebaseMerge,
		AllowUpdateBranch:         repo.AllowUpdateBranch,
		AllowAutoMerge:            repo.AllowAutoMerge,
		AllowForking:              repo.AllowForking,
		DeleteBranchOnMerge:       repo.DeleteBranchOnMerge,
		UseSquashPRTitleAsDefault: repo.UseSquashPRTitleAsDefault,
		SquashMergeCommitTitle:    repo.SquashMergeCommitTitle,
		SquashMergeCommitMessage:  repo.SquashMergeCommitMessage,
		MergeCommitTitle:          repo.MergeCommitTitle,
		MergeCommitMessage:        repo.MergeCommitMessage,
	}

	req, err := s.client.NewRequest("POST", u, repoReq)
	if err != nil {
		return nil, nil, err
	}

	acceptHeaders := []string{mediaTypeRepositoryTemplatePreview, mediaTypeRepositoryVisibilityPreview}
	req.Header.Set("Accept", strings.Join(acceptHeaders, ", "))
	r := new(Repository)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// TemplateRepoRequest represents a request to create a repository from a template.
type TemplateRepoRequest struct {
	// Name is required when creating a repo.
	Name        *string `json:"name,omitempty"`
	Owner       *string `json:"owner,omitempty"`
	Description *string `json:"description,omitempty"`

	IncludeAllBranches *bool `json:"include_all_branches,omitempty"`
	Private            *bool `json:"private,omitempty"`
}

// CreateFromTemplate generates a repository from a template.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#create-a-repository-using-a-template
//
//meta:operation POST /repos/{template_owner}/{template_repo}/generate
func (s *RepositoriesService) CreateFromTemplate(ctx context.Context, templateOwner, templateRepo string, templateRepoReq *TemplateRepoRequest) (*Repository, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/generate", templateOwner, templateRepo)

	req, err := s.client.NewRequest("POST", u, templateRepoReq)
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Accept", mediaTypeRepositoryTemplatePreview)
	r := new(Repository)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// Get fetches a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#get-a-repository
//
//meta:operation GET /repos/{owner}/{repo}
func (s *RepositoriesService) Get(ctx context.Context, owner, repo string) (*Repository, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v", owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when the license support fully launches
	// https://docs.github.com/rest/licenses/#get-a-repositorys-license
	acceptHeaders := []string{
		mediaTypeCodesOfConductPreview,
		mediaTypeTopicsPreview,
		mediaTypeRepositoryTemplatePreview,
		mediaTypeRepositoryVisibilityPreview,
	}
	req.Header.Set("Accept", strings.Join(acceptHeaders, ", "))

	repository := new(Repository)
	resp, err := s.client.Do(ctx, req, repository)
	if err != nil {
		return nil, resp, err
	}

	return repository, resp, nil
}

// GetCodeOfConduct gets the contents of a repository's code of conduct.
// Note that https://docs.github.com/rest/codes-of-conduct#about-the-codes-of-conduct-api
// says to use the GET /repos/{owner}/{repo} endpoint.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#get-a-repository
//
//meta:operation GET /repos/{owner}/{repo}
func (s *RepositoriesService) GetCodeOfConduct(ctx context.Context, owner, repo string) (*CodeOfConduct, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v", owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeCodesOfConductPreview)

	r := new(Repository)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r.GetCodeOfConduct(), resp, nil
}

// GetByID fetches a repository.
//
// Note: GetByID uses the undocumented GitHub API endpoint "GET /repositories/{repository_id}".
//
//meta:operation GET /repositories/{repository_id}
func (s *RepositoriesService) GetByID(ctx context.Context, id int64) (*Repository, *Response, error) {
	u := fmt.Sprintf("repositories/%d", id)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	repository := new(Repository)
	resp, err := s.client.Do(ctx, req, repository)
	if err != nil {
		return nil, resp, err
	}

	return repository, resp, nil
}

// Edit updates a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#update-a-repository
//
//meta:operation PATCH /repos/{owner}/{repo}
func (s *RepositoriesService) Edit(ctx context.Context, owner, repo string, repository *Repository) (*Repository, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v", owner, repo)
	req, err := s.client.NewRequest("PATCH", u, repository)
	if err != nil {
		return nil, nil, err
	}

	acceptHeaders := []string{mediaTypeRepositoryTemplatePreview, mediaTypeRepositoryVisibilityPreview}
	req.Header.Set("Accept", strings.Join(acceptHeaders, ", "))
	r := new(Repository)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// Delete a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#delete-a-repository
//
//meta:operation DELETE /repos/{owner}/{repo}
func (s *RepositoriesService) Delete(ctx context.Context, owner, repo string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v", owner, repo)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// Contributor represents a repository contributor.
type Contributor struct {
	Login             *string `json:"login,omitempty"`
	ID                *int64  `json:"id,omitempty"`
	NodeID            *string `json:"node_id,omitempty"`
	AvatarURL         *string `json:"avatar_url,omitempty"`
	GravatarID        *string `json:"gravatar_id,omitempty"`
	URL               *string `json:"url,omitempty"`
	HTMLURL           *string `json:"html_url,omitempty"`
	FollowersURL      *string `json:"followers_url,omitempty"`
	FollowingURL      *string `json:"following_url,omitempty"`
	GistsURL          *string `json:"gists_url,omitempty"`
	StarredURL        *string `json:"starred_url,omitempty"`
	SubscriptionsURL  *string `json:"subscriptions_url,omitempty"`
	OrganizationsURL  *string `json:"organizations_url,omitempty"`
	ReposURL          *string `json:"repos_url,omitempty"`
	EventsURL         *string `json:"events_url,omitempty"`
	ReceivedEventsURL *string `json:"received_events_url,omitempty"`
	Type              *string `json:"type,omitempty"`
	SiteAdmin         *bool   `json:"site_admin,omitempty"`
	Contributions     *int    `json:"contributions,omitempty"`
	Name              *string `json:"name,omitempty"`
	Email             *string `json:"email,omitempty"`
}

// ListContributorsOptions specifies the optional parameters to the
// RepositoriesService.ListContributors method.
type ListContributorsOptions struct {
	// Include anonymous contributors in results or not
	Anon string `url:"anon,omitempty"`

	ListOptions
}

// GetVulnerabilityAlerts checks if vulnerability alerts are enabled for a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#check-if-vulnerability-alerts-are-enabled-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/vulnerability-alerts
func (s *RepositoriesService) GetVulnerabilityAlerts(ctx context.Context, owner, repository string) (bool, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/vulnerability-alerts", owner, repository)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return false, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeRequiredVulnerabilityAlertsPreview)

	resp, err := s.client.Do(ctx, req, nil)
	vulnerabilityAlertsEnabled, err := parseBoolResponse(err)
	return vulnerabilityAlertsEnabled, resp, err
}

// EnableVulnerabilityAlerts enables vulnerability alerts and the dependency graph for a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#enable-vulnerability-alerts
//
//meta:operation PUT /repos/{owner}/{repo}/vulnerability-alerts
func (s *RepositoriesService) EnableVulnerabilityAlerts(ctx context.Context, owner, repository string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/vulnerability-alerts", owner, repository)

	req, err := s.client.NewRequest("PUT", u, nil)
	if err != nil {
		return nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeRequiredVulnerabilityAlertsPreview)

	return s.client.Do(ctx, req, nil)
}

// DisableVulnerabilityAlerts disables vulnerability alerts and the dependency graph for a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#disable-vulnerability-alerts
//
//meta:operation DELETE /repos/{owner}/{repo}/vulnerability-alerts
func (s *RepositoriesService) DisableVulnerabilityAlerts(ctx context.Context, owner, repository string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/vulnerability-alerts", owner, repository)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeRequiredVulnerabilityAlertsPreview)

	return s.client.Do(ctx, req, nil)
}

// GetAutomatedSecurityFixes checks if the automated security fixes for a repository are enabled.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#check-if-dependabot-security-updates-are-enabled-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/automated-security-fixes
func (s *RepositoriesService) GetAutomatedSecurityFixes(ctx context.Context, owner, repository string) (*AutomatedSecurityFixes, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/automated-security-fixes", owner, repository)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	p := new(AutomatedSecurityFixes)
	resp, err := s.client.Do(ctx, req, p)
	if err != nil {
		return nil, resp, err
	}
	return p, resp, nil
}

// EnableAutomatedSecurityFixes enables the automated security fixes for a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#enable-dependabot-security-updates
//
//meta:operation PUT /repos/{owner}/{repo}/automated-security-fixes
func (s *RepositoriesService) EnableAutomatedSecurityFixes(ctx context.Context, owner, repository string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/automated-security-fixes", owner, repository)

	req, err := s.client.NewRequest("PUT", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// DisableAutomatedSecurityFixes disables vulnerability alerts and the dependency graph for a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#disable-dependabot-security-updates
//
//meta:operation DELETE /repos/{owner}/{repo}/automated-security-fixes
func (s *RepositoriesService) DisableAutomatedSecurityFixes(ctx context.Context, owner, repository string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/automated-security-fixes", owner, repository)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// ListContributors lists contributors for a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-repository-contributors
//
//meta:operation GET /repos/{owner}/{repo}/contributors
func (s *RepositoriesService) ListContributors(ctx context.Context, owner string, repository string, opts *ListContributorsOptions) ([]*Contributor, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/contributors", owner, repository)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var contributor []*Contributor
	resp, err := s.client.Do(ctx, req, &contributor)
	if err != nil {
		return nil, resp, err
	}

	return contributor, resp, nil
}

// ListLanguages lists languages for the specified repository. The returned map
// specifies the languages and the number of bytes of code written in that
// language. For example:
//
//	{
//	  "C": 78769,
//	  "Python": 7769
//	}
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-repository-languages
//
//meta:operation GET /repos/{owner}/{repo}/languages
func (s *RepositoriesService) ListLanguages(ctx context.Context, owner string, repo string) (map[string]int, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/languages", owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	languages := make(map[string]int)
	resp, err := s.client.Do(ctx, req, &languages)
	if err != nil {
		return nil, resp, err
	}

	return languages, resp, nil
}

// ListTeams lists the teams for the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-repository-teams
//
//meta:operation GET /repos/{owner}/{repo}/teams
func (s *RepositoriesService) ListTeams(ctx context.Context, owner string, repo string, opts *ListOptions) ([]*Team, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/teams", owner, repo)
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

// RepositoryTag represents a repository tag.
type RepositoryTag struct {
	Name       *string `json:"name,omitempty"`
	Commit     *Commit `json:"commit,omitempty"`
	ZipballURL *string `json:"zipball_url,omitempty"`
	TarballURL *string `json:"tarball_url,omitempty"`
}

// ListTags lists tags for the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-repository-tags
//
//meta:operation GET /repos/{owner}/{repo}/tags
func (s *RepositoriesService) ListTags(ctx context.Context, owner string, repo string, opts *ListOptions) ([]*RepositoryTag, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/tags", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var tags []*RepositoryTag
	resp, err := s.client.Do(ctx, req, &tags)
	if err != nil {
		return nil, resp, err
	}

	return tags, resp, nil
}

// Branch represents a repository branch.
type Branch struct {
	Name      *string           `json:"name,omitempty"`
	Commit    *RepositoryCommit `json:"commit,omitempty"`
	Protected *bool             `json:"protected,omitempty"`

	// Protection will always be included in APIs which return the
	// 'Branch With Protection' schema such as 'Get a branch', but may
	// not be included in APIs that return the `Short Branch` schema
	// such as 'List branches'. In such cases, if branch protection is
	// enabled, Protected will be `true` but this will be nil, and
	// additional protection details can be obtained by calling GetBranch().
	Protection *Protection `json:"protection,omitempty"`
}

// Protection represents a repository branch's protection.
type Protection struct {
	RequiredStatusChecks           *RequiredStatusChecks           `json:"required_status_checks"`
	RequiredPullRequestReviews     *PullRequestReviewsEnforcement  `json:"required_pull_request_reviews"`
	EnforceAdmins                  *AdminEnforcement               `json:"enforce_admins"`
	Restrictions                   *BranchRestrictions             `json:"restrictions"`
	RequireLinearHistory           *RequireLinearHistory           `json:"required_linear_history"`
	AllowForcePushes               *AllowForcePushes               `json:"allow_force_pushes"`
	AllowDeletions                 *AllowDeletions                 `json:"allow_deletions"`
	RequiredConversationResolution *RequiredConversationResolution `json:"required_conversation_resolution"`
	BlockCreations                 *BlockCreations                 `json:"block_creations,omitempty"`
	LockBranch                     *LockBranch                     `json:"lock_branch,omitempty"`
	AllowForkSyncing               *AllowForkSyncing               `json:"allow_fork_syncing,omitempty"`
	RequiredSignatures             *SignaturesProtectedBranch      `json:"required_signatures,omitempty"`
	URL                            *string                         `json:"url,omitempty"`
}

// BlockCreations represents whether users can push changes that create branches. If this is true, this
// setting blocks pushes that create new branches, unless the push is initiated by a user, team, or app
// which has the ability to push.
type BlockCreations struct {
	Enabled *bool `json:"enabled,omitempty"`
}

// LockBranch represents if the branch is marked as read-only. If this is true, users will not be able to push to the branch.
type LockBranch struct {
	Enabled *bool `json:"enabled,omitempty"`
}

// AllowForkSyncing represents whether users can pull changes from upstream when the branch is locked.
type AllowForkSyncing struct {
	Enabled *bool `json:"enabled,omitempty"`
}

// BranchProtectionRule represents the rule applied to a repositories branch.
type BranchProtectionRule struct {
	ID                                       *int64     `json:"id,omitempty"`
	RepositoryID                             *int64     `json:"repository_id,omitempty"`
	Name                                     *string    `json:"name,omitempty"`
	CreatedAt                                *Timestamp `json:"created_at,omitempty"`
	UpdatedAt                                *Timestamp `json:"updated_at,omitempty"`
	PullRequestReviewsEnforcementLevel       *string    `json:"pull_request_reviews_enforcement_level,omitempty"`
	RequiredApprovingReviewCount             *int       `json:"required_approving_review_count,omitempty"`
	DismissStaleReviewsOnPush                *bool      `json:"dismiss_stale_reviews_on_push,omitempty"`
	AuthorizedDismissalActorsOnly            *bool      `json:"authorized_dismissal_actors_only,omitempty"`
	IgnoreApprovalsFromContributors          *bool      `json:"ignore_approvals_from_contributors,omitempty"`
	RequireCodeOwnerReview                   *bool      `json:"require_code_owner_review,omitempty"`
	RequiredStatusChecks                     []string   `json:"required_status_checks,omitempty"`
	RequiredStatusChecksEnforcementLevel     *string    `json:"required_status_checks_enforcement_level,omitempty"`
	StrictRequiredStatusChecksPolicy         *bool      `json:"strict_required_status_checks_policy,omitempty"`
	SignatureRequirementEnforcementLevel     *string    `json:"signature_requirement_enforcement_level,omitempty"`
	LinearHistoryRequirementEnforcementLevel *string    `json:"linear_history_requirement_enforcement_level,omitempty"`
	AdminEnforced                            *bool      `json:"admin_enforced,omitempty"`
	AllowForcePushesEnforcementLevel         *string    `json:"allow_force_pushes_enforcement_level,omitempty"`
	AllowDeletionsEnforcementLevel           *string    `json:"allow_deletions_enforcement_level,omitempty"`
	MergeQueueEnforcementLevel               *string    `json:"merge_queue_enforcement_level,omitempty"`
	RequiredDeploymentsEnforcementLevel      *string    `json:"required_deployments_enforcement_level,omitempty"`
	RequiredConversationResolutionLevel      *string    `json:"required_conversation_resolution_level,omitempty"`
	AuthorizedActorsOnly                     *bool      `json:"authorized_actors_only,omitempty"`
	AuthorizedActorNames                     []string   `json:"authorized_actor_names,omitempty"`
}

// ProtectionChanges represents the changes to the rule if the BranchProtection was edited.
type ProtectionChanges struct {
	AdminEnforced                            *AdminEnforcedChanges                            `json:"admin_enforced,omitempty"`
	AllowDeletionsEnforcementLevel           *AllowDeletionsEnforcementLevelChanges           `json:"allow_deletions_enforcement_level,omitempty"`
	AuthorizedActorNames                     *AuthorizedActorNames                            `json:"authorized_actor_names,omitempty"`
	AuthorizedActorsOnly                     *AuthorizedActorsOnly                            `json:"authorized_actors_only,omitempty"`
	AuthorizedDismissalActorsOnly            *AuthorizedDismissalActorsOnlyChanges            `json:"authorized_dismissal_actors_only,omitempty"`
	CreateProtected                          *CreateProtectedChanges                          `json:"create_protected,omitempty"`
	DismissStaleReviewsOnPush                *DismissStaleReviewsOnPushChanges                `json:"dismiss_stale_reviews_on_push,omitempty"`
	LinearHistoryRequirementEnforcementLevel *LinearHistoryRequirementEnforcementLevelChanges `json:"linear_history_requirement_enforcement_level,omitempty"`
	PullRequestReviewsEnforcementLevel       *PullRequestReviewsEnforcementLevelChanges       `json:"pull_request_reviews_enforcement_level,omitempty"`
	RequireCodeOwnerReview                   *RequireCodeOwnerReviewChanges                   `json:"require_code_owner_review,omitempty"`
	RequiredConversationResolutionLevel      *RequiredConversationResolutionLevelChanges      `json:"required_conversation_resolution_level,omitempty"`
	RequiredDeploymentsEnforcementLevel      *RequiredDeploymentsEnforcementLevelChanges      `json:"required_deployments_enforcement_level,omitempty"`
	RequiredStatusChecks                     *RequiredStatusChecksChanges                     `json:"required_status_checks,omitempty"`
	RequiredStatusChecksEnforcementLevel     *RequiredStatusChecksEnforcementLevelChanges     `json:"required_status_checks_enforcement_level,omitempty"`
	SignatureRequirementEnforcementLevel     *SignatureRequirementEnforcementLevelChanges     `json:"signature_requirement_enforcement_level,omitempty"`
}

// AdminEnforcedChanges represents the changes made to the AdminEnforced policy.
type AdminEnforcedChanges struct {
	From *bool `json:"from,omitempty"`
}

// AllowDeletionsEnforcementLevelChanges represents the changes made to the AllowDeletionsEnforcementLevel policy.
type AllowDeletionsEnforcementLevelChanges struct {
	From *string `json:"from,omitempty"`
}

// AuthorizedActorNames represents who are authorized to edit the branch protection rules.
type AuthorizedActorNames struct {
	From []string `json:"from,omitempty"`
}

// AuthorizedActorsOnly represents if the branch rule can be edited by authorized actors only.
type AuthorizedActorsOnly struct {
	From *bool `json:"from,omitempty"`
}

// AuthorizedDismissalActorsOnlyChanges represents the changes made to the AuthorizedDismissalActorsOnly policy.
type AuthorizedDismissalActorsOnlyChanges struct {
	From *bool `json:"from,omitempty"`
}

// CreateProtectedChanges represents the changes made to the CreateProtected policy.
type CreateProtectedChanges struct {
	From *bool `json:"from,omitempty"`
}

// DismissStaleReviewsOnPushChanges represents the changes made to the DismissStaleReviewsOnPushChanges policy.
type DismissStaleReviewsOnPushChanges struct {
	From *bool `json:"from,omitempty"`
}

// LinearHistoryRequirementEnforcementLevelChanges represents the changes made to the LinearHistoryRequirementEnforcementLevel policy.
type LinearHistoryRequirementEnforcementLevelChanges struct {
	From *string `json:"from,omitempty"`
}

// PullRequestReviewsEnforcementLevelChanges represents the changes made to the PullRequestReviewsEnforcementLevel policy.
type PullRequestReviewsEnforcementLevelChanges struct {
	From *string `json:"from,omitempty"`
}

// RequireCodeOwnerReviewChanges represents the changes made to the RequireCodeOwnerReview policy.
type RequireCodeOwnerReviewChanges struct {
	From *bool `json:"from,omitempty"`
}

// RequiredConversationResolutionLevelChanges represents the changes made to the RequiredConversationResolutionLevel policy.
type RequiredConversationResolutionLevelChanges struct {
	From *string `json:"from,omitempty"`
}

// RequiredDeploymentsEnforcementLevelChanges represents the changes made to the RequiredDeploymentsEnforcementLevel policy.
type RequiredDeploymentsEnforcementLevelChanges struct {
	From *string `json:"from,omitempty"`
}

// RequiredStatusChecksChanges represents the changes made to the RequiredStatusChecks policy.
type RequiredStatusChecksChanges struct {
	From []string `json:"from,omitempty"`
}

// RequiredStatusChecksEnforcementLevelChanges represents the changes made to the RequiredStatusChecksEnforcementLevel policy.
type RequiredStatusChecksEnforcementLevelChanges struct {
	From *string `json:"from,omitempty"`
}

// SignatureRequirementEnforcementLevelChanges represents the changes made to the SignatureRequirementEnforcementLevel policy.
type SignatureRequirementEnforcementLevelChanges struct {
	From *string `json:"from,omitempty"`
}

// ProtectionRequest represents a request to create/edit a branch's protection.
type ProtectionRequest struct {
	RequiredStatusChecks       *RequiredStatusChecks                 `json:"required_status_checks"`
	RequiredPullRequestReviews *PullRequestReviewsEnforcementRequest `json:"required_pull_request_reviews"`
	EnforceAdmins              bool                                  `json:"enforce_admins"`
	Restrictions               *BranchRestrictionsRequest            `json:"restrictions"`
	// Enforces a linear commit Git history, which prevents anyone from pushing merge commits to a branch.
	RequireLinearHistory *bool `json:"required_linear_history,omitempty"`
	// Permits force pushes to the protected branch by anyone with write access to the repository.
	AllowForcePushes *bool `json:"allow_force_pushes,omitempty"`
	// Allows deletion of the protected branch by anyone with write access to the repository.
	AllowDeletions *bool `json:"allow_deletions,omitempty"`
	// RequiredConversationResolution, if set to true, requires all comments
	// on the pull request to be resolved before it can be merged to a protected branch.
	RequiredConversationResolution *bool `json:"required_conversation_resolution,omitempty"`
	// BlockCreations, if set to true, will cause the restrictions setting to also block pushes
	// which create new branches, unless initiated by a user, team, app with the ability to push.
	BlockCreations *bool `json:"block_creations,omitempty"`
	// LockBranch, if set to true, will prevent users from pushing to the branch.
	LockBranch *bool `json:"lock_branch,omitempty"`
	// AllowForkSyncing, if set to true, will allow users to pull changes from upstream
	// when the branch is locked.
	AllowForkSyncing *bool `json:"allow_fork_syncing,omitempty"`
}

// RequiredStatusChecks represents the protection status of a individual branch.
type RequiredStatusChecks struct {
	// Require branches to be up to date before merging. (Required.)
	Strict bool `json:"strict"`
	// The list of status checks to require in order to merge into this
	// branch. An empty slice is valid. (Deprecated. Note: only one of
	// Contexts/Checks can be populated, but at least one must be populated).
	Contexts *[]string `json:"contexts,omitempty"`
	// The list of status checks to require in order to merge into this
	// branch. An empty slice is valid.
	Checks      *[]*RequiredStatusCheck `json:"checks,omitempty"`
	ContextsURL *string                 `json:"contexts_url,omitempty"`
	URL         *string                 `json:"url,omitempty"`
}

// RequiredStatusChecksRequest represents a request to edit a protected branch's status checks.
type RequiredStatusChecksRequest struct {
	Strict *bool `json:"strict,omitempty"`
	// Deprecated. Note: if both Contexts and Checks are populated,
	// the GitHub API will only use Checks.
	Contexts []string               `json:"contexts,omitempty"`
	Checks   []*RequiredStatusCheck `json:"checks,omitempty"`
}

// RequiredStatusCheck represents a status check of a protected branch.
type RequiredStatusCheck struct {
	// The name of the required check.
	Context string `json:"context"`
	// The ID of the GitHub App that must provide this check.
	// Omit this field to automatically select the GitHub App
	// that has recently provided this check,
	// or any app if it was not set by a GitHub App.
	// Pass -1 to explicitly allow any app to set the status.
	AppID *int64 `json:"app_id,omitempty"`
}

// PullRequestReviewsEnforcement represents the pull request reviews enforcement of a protected branch.
type PullRequestReviewsEnforcement struct {
	// Allow specific users, teams, or apps to bypass pull request requirements.
	BypassPullRequestAllowances *BypassPullRequestAllowances `json:"bypass_pull_request_allowances,omitempty"`
	// Specifies which users, teams and apps can dismiss pull request reviews.
	DismissalRestrictions *DismissalRestrictions `json:"dismissal_restrictions,omitempty"`
	// Specifies if approved reviews are dismissed automatically, when a new commit is pushed.
	DismissStaleReviews bool `json:"dismiss_stale_reviews"`
	// RequireCodeOwnerReviews specifies if an approved review is required in pull requests including files with a designated code owner.
	RequireCodeOwnerReviews bool `json:"require_code_owner_reviews"`
	// RequiredApprovingReviewCount specifies the number of approvals required before the pull request can be merged.
	// Valid values are 1-6.
	RequiredApprovingReviewCount int `json:"required_approving_review_count"`
	// RequireLastPushApproval specifies whether the last pusher to a pull request branch can approve it.
	RequireLastPushApproval bool `json:"require_last_push_approval"`
}

// PullRequestReviewsEnforcementRequest represents request to set the pull request review
// enforcement of a protected branch. It is separate from PullRequestReviewsEnforcement above
// because the request structure is different from the response structure.
type PullRequestReviewsEnforcementRequest struct {
	// Allow specific users, teams, or apps to bypass pull request requirements.
	BypassPullRequestAllowancesRequest *BypassPullRequestAllowancesRequest `json:"bypass_pull_request_allowances,omitempty"`
	// Specifies which users, teams and apps should be allowed to dismiss pull request reviews.
	// User, team and app dismissal restrictions are only available for
	// organization-owned repositories. Must be nil for personal repositories.
	DismissalRestrictionsRequest *DismissalRestrictionsRequest `json:"dismissal_restrictions,omitempty"`
	// Specifies if approved reviews can be dismissed automatically, when a new commit is pushed. (Required)
	DismissStaleReviews bool `json:"dismiss_stale_reviews"`
	// RequireCodeOwnerReviews specifies if an approved review is required in pull requests including files with a designated code owner.
	RequireCodeOwnerReviews bool `json:"require_code_owner_reviews"`
	// RequiredApprovingReviewCount specifies the number of approvals required before the pull request can be merged.
	// Valid values are 1-6.
	RequiredApprovingReviewCount int `json:"required_approving_review_count"`
	// RequireLastPushApproval specifies whether the last pusher to a pull request branch can approve it.
	RequireLastPushApproval *bool `json:"require_last_push_approval,omitempty"`
}

// PullRequestReviewsEnforcementUpdate represents request to patch the pull request review
// enforcement of a protected branch. It is separate from PullRequestReviewsEnforcementRequest above
// because the patch request does not require all fields to be initialized.
type PullRequestReviewsEnforcementUpdate struct {
	// Allow specific users, teams, or apps to bypass pull request requirements.
	BypassPullRequestAllowancesRequest *BypassPullRequestAllowancesRequest `json:"bypass_pull_request_allowances,omitempty"`
	// Specifies which users, teams and apps can dismiss pull request reviews. Can be omitted.
	DismissalRestrictionsRequest *DismissalRestrictionsRequest `json:"dismissal_restrictions,omitempty"`
	// Specifies if approved reviews can be dismissed automatically, when a new commit is pushed. Can be omitted.
	DismissStaleReviews *bool `json:"dismiss_stale_reviews,omitempty"`
	// RequireCodeOwnerReviews specifies if merging pull requests is blocked until code owners have reviewed.
	RequireCodeOwnerReviews *bool `json:"require_code_owner_reviews,omitempty"`
	// RequiredApprovingReviewCount specifies the number of approvals required before the pull request can be merged.
	// Valid values are 1 - 6 or 0 to not require reviewers.
	RequiredApprovingReviewCount int `json:"required_approving_review_count"`
	// RequireLastPushApproval specifies whether the last pusher to a pull request branch can approve it.
	RequireLastPushApproval *bool `json:"require_last_push_approval,omitempty"`
}

// RequireLinearHistory represents the configuration to enforce branches with no merge commit.
type RequireLinearHistory struct {
	Enabled bool `json:"enabled"`
}

// AllowDeletions represents the configuration to accept deletion of protected branches.
type AllowDeletions struct {
	Enabled bool `json:"enabled"`
}

// AllowForcePushes represents the configuration to accept forced pushes on protected branches.
type AllowForcePushes struct {
	Enabled bool `json:"enabled"`
}

// RequiredConversationResolution requires all comments on the pull request to be resolved before it can be
// merged to a protected branch when enabled.
type RequiredConversationResolution struct {
	Enabled bool `json:"enabled"`
}

// AdminEnforcement represents the configuration to enforce required status checks for repository administrators.
type AdminEnforcement struct {
	URL     *string `json:"url,omitempty"`
	Enabled bool    `json:"enabled"`
}

// BranchRestrictions represents the restriction that only certain users or
// teams may push to a branch.
type BranchRestrictions struct {
	// The list of user logins with push access.
	Users []*User `json:"users"`
	// The list of team slugs with push access.
	Teams []*Team `json:"teams"`
	// The list of app slugs with push access.
	Apps []*App `json:"apps"`
}

// BranchRestrictionsRequest represents the request to create/edit the
// restriction that only certain users or teams may push to a branch. It is
// separate from BranchRestrictions above because the request structure is
// different from the response structure.
type BranchRestrictionsRequest struct {
	// The list of user logins with push access. (Required; use []string{} instead of nil for empty list.)
	Users []string `json:"users"`
	// The list of team slugs with push access. (Required; use []string{} instead of nil for empty list.)
	Teams []string `json:"teams"`
	// The list of app slugs with push access.
	Apps []string `json:"apps"`
}

// BypassPullRequestAllowances represents the people, teams, or apps who are allowed to bypass required pull requests.
type BypassPullRequestAllowances struct {
	// The list of users allowed to bypass pull request requirements.
	Users []*User `json:"users"`
	// The list of teams allowed to bypass pull request requirements.
	Teams []*Team `json:"teams"`
	// The list of apps allowed to bypass pull request requirements.
	Apps []*App `json:"apps"`
}

// BypassPullRequestAllowancesRequest represents the people, teams, or apps who are
// allowed to bypass required pull requests.
// It is separate from BypassPullRequestAllowances above because the request structure is
// different from the response structure.
type BypassPullRequestAllowancesRequest struct {
	// The list of user logins allowed to bypass pull request requirements.
	Users []string `json:"users"`
	// The list of team slugs allowed to bypass pull request requirements.
	Teams []string `json:"teams"`
	// The list of app slugs allowed to bypass pull request requirements.
	Apps []string `json:"apps"`
}

// DismissalRestrictions specifies which users and teams can dismiss pull request reviews.
type DismissalRestrictions struct {
	// The list of users who can dismiss pull request reviews.
	Users []*User `json:"users"`
	// The list of teams which can dismiss pull request reviews.
	Teams []*Team `json:"teams"`
	// The list of apps which can dismiss pull request reviews.
	Apps []*App `json:"apps"`
}

// DismissalRestrictionsRequest represents the request to create/edit the
// restriction to allows only specific users, teams or apps to dismiss pull request reviews. It is
// separate from DismissalRestrictions above because the request structure is
// different from the response structure.
// Note: Both Users and Teams must be nil, or both must be non-nil.
type DismissalRestrictionsRequest struct {
	// The list of user logins who can dismiss pull request reviews. (Required; use nil to disable dismissal_restrictions or &[]string{} otherwise.)
	Users *[]string `json:"users,omitempty"`
	// The list of team slugs which can dismiss pull request reviews. (Required; use nil to disable dismissal_restrictions or &[]string{} otherwise.)
	Teams *[]string `json:"teams,omitempty"`
	// The list of app slugs which can dismiss pull request reviews. (Required; use nil to disable dismissal_restrictions or &[]string{} otherwise.)
	Apps *[]string `json:"apps,omitempty"`
}

// SignaturesProtectedBranch represents the protection status of an individual branch.
type SignaturesProtectedBranch struct {
	URL *string `json:"url,omitempty"`
	// Commits pushed to matching branches must have verified signatures.
	Enabled *bool `json:"enabled,omitempty"`
}

// AutomatedSecurityFixes represents their status.
type AutomatedSecurityFixes struct {
	Enabled *bool `json:"enabled"`
	Paused  *bool `json:"paused"`
}

// ListBranches lists branches for the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/branches/branches#list-branches
//
//meta:operation GET /repos/{owner}/{repo}/branches
func (s *RepositoriesService) ListBranches(ctx context.Context, owner string, repo string, opts *BranchListOptions) ([]*Branch, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var branches []*Branch
	resp, err := s.client.Do(ctx, req, &branches)
	if err != nil {
		return nil, resp, err
	}

	return branches, resp, nil
}

// GetBranch gets the specified branch for a repository.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branches#get-a-branch
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}
func (s *RepositoriesService) GetBranch(ctx context.Context, owner, repo, branch string, maxRedirects int) (*Branch, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v", owner, repo, url.PathEscape(branch))

	resp, err := s.client.roundTripWithOptionalFollowRedirect(ctx, u, maxRedirects)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, newResponse(resp), fmt.Errorf("unexpected status code: %s", resp.Status)
	}

	b := new(Branch)
	err = json.NewDecoder(resp.Body).Decode(b)
	return b, newResponse(resp), err
}

// renameBranchRequest represents a request to rename a branch.
type renameBranchRequest struct {
	NewName string `json:"new_name"`
}

// RenameBranch renames a branch in a repository.
//
// To rename a non-default branch: Users must have push access. GitHub Apps must have the `contents:write` repository permission.
// To rename the default branch: Users must have admin or owner permissions. GitHub Apps must have the `administration:write` repository permission.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branches#rename-a-branch
//
//meta:operation POST /repos/{owner}/{repo}/branches/{branch}/rename
func (s *RepositoriesService) RenameBranch(ctx context.Context, owner, repo, branch, newName string) (*Branch, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/rename", owner, repo, url.PathEscape(branch))
	r := &renameBranchRequest{NewName: newName}
	req, err := s.client.NewRequest("POST", u, r)
	if err != nil {
		return nil, nil, err
	}

	b := new(Branch)
	resp, err := s.client.Do(ctx, req, b)
	if err != nil {
		return nil, resp, err
	}

	return b, resp, nil
}

// GetBranchProtection gets the protection of a given branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#get-branch-protection
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}/protection
func (s *RepositoriesService) GetBranchProtection(ctx context.Context, owner, repo, branch string) (*Protection, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeRequiredApprovingReviewsPreview)

	p := new(Protection)
	resp, err := s.client.Do(ctx, req, p)
	if err != nil {
		if isBranchNotProtected(err) {
			err = ErrBranchNotProtected
		}
		return nil, resp, err
	}

	return p, resp, nil
}

// GetRequiredStatusChecks gets the required status checks for a given protected branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#get-status-checks-protection
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks
func (s *RepositoriesService) GetRequiredStatusChecks(ctx context.Context, owner, repo, branch string) (*RequiredStatusChecks, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_status_checks", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	p := new(RequiredStatusChecks)
	resp, err := s.client.Do(ctx, req, p)
	if err != nil {
		if isBranchNotProtected(err) {
			err = ErrBranchNotProtected
		}
		return nil, resp, err
	}

	return p, resp, nil
}

// ListRequiredStatusChecksContexts lists the required status checks contexts for a given protected branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#get-all-status-check-contexts
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts
func (s *RepositoriesService) ListRequiredStatusChecksContexts(ctx context.Context, owner, repo, branch string) (contexts []string, resp *Response, err error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_status_checks/contexts", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	resp, err = s.client.Do(ctx, req, &contexts)
	if err != nil {
		if isBranchNotProtected(err) {
			err = ErrBranchNotProtected
		}
		return nil, resp, err
	}

	return contexts, resp, nil
}

// UpdateBranchProtection updates the protection of a given branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#update-branch-protection
//
//meta:operation PUT /repos/{owner}/{repo}/branches/{branch}/protection
func (s *RepositoriesService) UpdateBranchProtection(ctx context.Context, owner, repo, branch string, preq *ProtectionRequest) (*Protection, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("PUT", u, preq)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeRequiredApprovingReviewsPreview)

	p := new(Protection)
	resp, err := s.client.Do(ctx, req, p)
	if err != nil {
		return nil, resp, err
	}

	return p, resp, nil
}

// RemoveBranchProtection removes the protection of a given branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#delete-branch-protection
//
//meta:operation DELETE /repos/{owner}/{repo}/branches/{branch}/protection
func (s *RepositoriesService) RemoveBranchProtection(ctx context.Context, owner, repo, branch string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// GetSignaturesProtectedBranch gets required signatures of protected branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#get-commit-signature-protection
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures
func (s *RepositoriesService) GetSignaturesProtectedBranch(ctx context.Context, owner, repo, branch string) (*SignaturesProtectedBranch, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_signatures", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeSignaturePreview)

	p := new(SignaturesProtectedBranch)
	resp, err := s.client.Do(ctx, req, p)
	if err != nil {
		return nil, resp, err
	}

	return p, resp, nil
}

// RequireSignaturesOnProtectedBranch makes signed commits required on a protected branch.
// It requires admin access and branch protection to be enabled.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#create-commit-signature-protection
//
//meta:operation POST /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures
func (s *RepositoriesService) RequireSignaturesOnProtectedBranch(ctx context.Context, owner, repo, branch string) (*SignaturesProtectedBranch, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_signatures", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeSignaturePreview)

	r := new(SignaturesProtectedBranch)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// OptionalSignaturesOnProtectedBranch removes required signed commits on a given branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#delete-commit-signature-protection
//
//meta:operation DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures
func (s *RepositoriesService) OptionalSignaturesOnProtectedBranch(ctx context.Context, owner, repo, branch string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_signatures", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeSignaturePreview)

	return s.client.Do(ctx, req, nil)
}

// UpdateRequiredStatusChecks updates the required status checks for a given protected branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#update-status-check-protection
//
//meta:operation PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks
func (s *RepositoriesService) UpdateRequiredStatusChecks(ctx context.Context, owner, repo, branch string, sreq *RequiredStatusChecksRequest) (*RequiredStatusChecks, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_status_checks", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("PATCH", u, sreq)
	if err != nil {
		return nil, nil, err
	}

	sc := new(RequiredStatusChecks)
	resp, err := s.client.Do(ctx, req, sc)
	if err != nil {
		return nil, resp, err
	}

	return sc, resp, nil
}

// RemoveRequiredStatusChecks removes the required status checks for a given protected branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#remove-status-check-protection
//
//meta:operation DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks
func (s *RepositoriesService) RemoveRequiredStatusChecks(ctx context.Context, owner, repo, branch string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_status_checks", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// License gets the contents of a repository's license if one is detected.
//
// GitHub API docs: https://docs.github.com/rest/licenses/licenses#get-the-license-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/license
func (s *RepositoriesService) License(ctx context.Context, owner, repo string) (*RepositoryLicense, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/license", owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	r := &RepositoryLicense{}
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// GetPullRequestReviewEnforcement gets pull request review enforcement of a protected branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#get-pull-request-review-protection
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews
func (s *RepositoriesService) GetPullRequestReviewEnforcement(ctx context.Context, owner, repo, branch string) (*PullRequestReviewsEnforcement, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_pull_request_reviews", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeRequiredApprovingReviewsPreview)

	r := new(PullRequestReviewsEnforcement)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// UpdatePullRequestReviewEnforcement patches pull request review enforcement of a protected branch.
// It requires admin access and branch protection to be enabled.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#update-pull-request-review-protection
//
//meta:operation PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews
func (s *RepositoriesService) UpdatePullRequestReviewEnforcement(ctx context.Context, owner, repo, branch string, patch *PullRequestReviewsEnforcementUpdate) (*PullRequestReviewsEnforcement, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_pull_request_reviews", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("PATCH", u, patch)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeRequiredApprovingReviewsPreview)

	r := new(PullRequestReviewsEnforcement)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// DisableDismissalRestrictions disables dismissal restrictions of a protected branch.
// It requires admin access and branch protection to be enabled.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#update-pull-request-review-protection
//
//meta:operation PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews
func (s *RepositoriesService) DisableDismissalRestrictions(ctx context.Context, owner, repo, branch string) (*PullRequestReviewsEnforcement, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_pull_request_reviews", owner, repo, url.PathEscape(branch))

	data := new(struct {
		DismissalRestrictionsRequest `json:"dismissal_restrictions"`
	})

	req, err := s.client.NewRequest("PATCH", u, data)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches
	req.Header.Set("Accept", mediaTypeRequiredApprovingReviewsPreview)

	r := new(PullRequestReviewsEnforcement)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// RemovePullRequestReviewEnforcement removes pull request enforcement of a protected branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#delete-pull-request-review-protection
//
//meta:operation DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews
func (s *RepositoriesService) RemovePullRequestReviewEnforcement(ctx context.Context, owner, repo, branch string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/required_pull_request_reviews", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// GetAdminEnforcement gets admin enforcement information of a protected branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#get-admin-branch-protection
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins
func (s *RepositoriesService) GetAdminEnforcement(ctx context.Context, owner, repo, branch string) (*AdminEnforcement, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/enforce_admins", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	r := new(AdminEnforcement)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// AddAdminEnforcement adds admin enforcement to a protected branch.
// It requires admin access and branch protection to be enabled.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#set-admin-branch-protection
//
//meta:operation POST /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins
func (s *RepositoriesService) AddAdminEnforcement(ctx context.Context, owner, repo, branch string) (*AdminEnforcement, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/enforce_admins", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, nil, err
	}

	r := new(AdminEnforcement)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// RemoveAdminEnforcement removes admin enforcement from a protected branch.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#delete-admin-branch-protection
//
//meta:operation DELETE /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins
func (s *RepositoriesService) RemoveAdminEnforcement(ctx context.Context, owner, repo, branch string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/enforce_admins", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// repositoryTopics represents a collection of repository topics.
type repositoryTopics struct {
	Names []string `json:"names"`
}

// ListAllTopics lists topics for a repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#get-all-repository-topics
//
//meta:operation GET /repos/{owner}/{repo}/topics
func (s *RepositoriesService) ListAllTopics(ctx context.Context, owner, repo string) ([]string, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/topics", owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeTopicsPreview)

	topics := new(repositoryTopics)
	resp, err := s.client.Do(ctx, req, topics)
	if err != nil {
		return nil, resp, err
	}

	return topics.Names, resp, nil
}

// ReplaceAllTopics replaces all repository topics.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#replace-all-repository-topics
//
//meta:operation PUT /repos/{owner}/{repo}/topics
func (s *RepositoriesService) ReplaceAllTopics(ctx context.Context, owner, repo string, topics []string) ([]string, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/topics", owner, repo)
	t := &repositoryTopics{
		Names: topics,
	}
	if t.Names == nil {
		t.Names = []string{}
	}
	req, err := s.client.NewRequest("PUT", u, t)
	if err != nil {
		return nil, nil, err
	}

	// TODO: remove custom Accept header when this API fully launches.
	req.Header.Set("Accept", mediaTypeTopicsPreview)

	t = new(repositoryTopics)
	resp, err := s.client.Do(ctx, req, t)
	if err != nil {
		return nil, resp, err
	}

	return t.Names, resp, nil
}

// ListApps lists the GitHub apps that have push access to a given protected branch.
// It requires the GitHub apps to have `write` access to the `content` permission.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// Deprecated: Please use ListAppRestrictions instead.
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#get-apps-with-access-to-the-protected-branch
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
func (s *RepositoriesService) ListApps(ctx context.Context, owner, repo, branch string) ([]*App, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/apps", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var apps []*App
	resp, err := s.client.Do(ctx, req, &apps)
	if err != nil {
		return nil, resp, err
	}

	return apps, resp, nil
}

// ListAppRestrictions lists the GitHub apps that have push access to a given protected branch.
// It requires the GitHub apps to have `write` access to the `content` permission.
//
// Note: This is a wrapper around ListApps so a naming convention with ListUserRestrictions and ListTeamRestrictions is preserved.
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#get-apps-with-access-to-the-protected-branch
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
func (s *RepositoriesService) ListAppRestrictions(ctx context.Context, owner, repo, branch string) ([]*App, *Response, error) {
	return s.ListApps(ctx, owner, repo, branch)
}

// ReplaceAppRestrictions replaces the apps that have push access to a given protected branch.
// It removes all apps that previously had push access and grants push access to the new list of apps.
// It requires the GitHub apps to have `write` access to the `content` permission.
//
// Note: The list of users, apps, and teams in total is limited to 100 items.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#set-app-access-restrictions
//
//meta:operation PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
func (s *RepositoriesService) ReplaceAppRestrictions(ctx context.Context, owner, repo, branch string, apps []string) ([]*App, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/apps", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("PUT", u, apps)
	if err != nil {
		return nil, nil, err
	}

	var newApps []*App
	resp, err := s.client.Do(ctx, req, &newApps)
	if err != nil {
		return nil, resp, err
	}

	return newApps, resp, nil
}

// AddAppRestrictions grants the specified apps push access to a given protected branch.
// It requires the GitHub apps to have `write` access to the `content` permission.
//
// Note: The list of users, apps, and teams in total is limited to 100 items.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#add-app-access-restrictions
//
//meta:operation POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
func (s *RepositoriesService) AddAppRestrictions(ctx context.Context, owner, repo, branch string, apps []string) ([]*App, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/apps", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("POST", u, apps)
	if err != nil {
		return nil, nil, err
	}

	var newApps []*App
	resp, err := s.client.Do(ctx, req, &newApps)
	if err != nil {
		return nil, resp, err
	}

	return newApps, resp, nil
}

// RemoveAppRestrictions removes the restrictions of an app from pushing to this branch.
// It requires the GitHub apps to have `write` access to the `content` permission.
//
// Note: The list of users, apps, and teams in total is limited to 100 items.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#remove-app-access-restrictions
//
//meta:operation DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
func (s *RepositoriesService) RemoveAppRestrictions(ctx context.Context, owner, repo, branch string, apps []string) ([]*App, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/apps", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("DELETE", u, apps)
	if err != nil {
		return nil, nil, err
	}

	var newApps []*App
	resp, err := s.client.Do(ctx, req, &newApps)
	if err != nil {
		return nil, resp, err
	}

	return newApps, resp, nil
}

// ListTeamRestrictions lists the GitHub teams that have push access to a given protected branch.
// It requires the GitHub teams to have `write` access to the `content` permission.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#get-teams-with-access-to-the-protected-branch
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
func (s *RepositoriesService) ListTeamRestrictions(ctx context.Context, owner, repo, branch string) ([]*Team, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/teams", owner, repo, url.PathEscape(branch))
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

// ReplaceTeamRestrictions replaces the team that have push access to a given protected branch.
// This removes all teams that previously had push access and grants push access to the new list of teams.
// It requires the GitHub teams to have `write` access to the `content` permission.
//
// Note: The list of users, apps, and teams in total is limited to 100 items.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#set-team-access-restrictions
//
//meta:operation PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
func (s *RepositoriesService) ReplaceTeamRestrictions(ctx context.Context, owner, repo, branch string, teams []string) ([]*Team, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/teams", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("PUT", u, teams)
	if err != nil {
		return nil, nil, err
	}

	var newTeams []*Team
	resp, err := s.client.Do(ctx, req, &newTeams)
	if err != nil {
		return nil, resp, err
	}

	return newTeams, resp, nil
}

// AddTeamRestrictions grants the specified teams push access to a given protected branch.
// It requires the GitHub teams to have `write` access to the `content` permission.
//
// Note: The list of users, apps, and teams in total is limited to 100 items.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#add-team-access-restrictions
//
//meta:operation POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
func (s *RepositoriesService) AddTeamRestrictions(ctx context.Context, owner, repo, branch string, teams []string) ([]*Team, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/teams", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("POST", u, teams)
	if err != nil {
		return nil, nil, err
	}

	var newTeams []*Team
	resp, err := s.client.Do(ctx, req, &newTeams)
	if err != nil {
		return nil, resp, err
	}

	return newTeams, resp, nil
}

// RemoveTeamRestrictions removes the restrictions of a team from pushing to this branch.
// It requires the GitHub teams to have `write` access to the `content` permission.
//
// Note: The list of users, apps, and teams in total is limited to 100 items.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#remove-team-access-restrictions
//
//meta:operation DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
func (s *RepositoriesService) RemoveTeamRestrictions(ctx context.Context, owner, repo, branch string, teams []string) ([]*Team, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/teams", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("DELETE", u, teams)
	if err != nil {
		return nil, nil, err
	}

	var newTeams []*Team
	resp, err := s.client.Do(ctx, req, &newTeams)
	if err != nil {
		return nil, resp, err
	}

	return newTeams, resp, nil
}

// ListUserRestrictions lists the GitHub users that have push access to a given protected branch.
// It requires the GitHub users to have `write` access to the `content` permission.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#get-users-with-access-to-the-protected-branch
//
//meta:operation GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
func (s *RepositoriesService) ListUserRestrictions(ctx context.Context, owner, repo, branch string) ([]*User, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/users", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var users []*User
	resp, err := s.client.Do(ctx, req, &users)
	if err != nil {
		return nil, resp, err
	}

	return users, resp, nil
}

// ReplaceUserRestrictions replaces the user that have push access to a given protected branch.
// It removes all users that previously had push access and grants push access to the new list of users.
// It requires the GitHub users to have `write` access to the `content` permission.
//
// Note: The list of users, apps, and teams in total is limited to 100 items.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#set-user-access-restrictions
//
//meta:operation PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
func (s *RepositoriesService) ReplaceUserRestrictions(ctx context.Context, owner, repo, branch string, users []string) ([]*User, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/users", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("PUT", u, users)
	if err != nil {
		return nil, nil, err
	}

	var newUsers []*User
	resp, err := s.client.Do(ctx, req, &newUsers)
	if err != nil {
		return nil, resp, err
	}

	return newUsers, resp, nil
}

// AddUserRestrictions grants the specified users push access to a given protected branch.
// It requires the GitHub users to have `write` access to the `content` permission.
//
// Note: The list of users, apps, and teams in total is limited to 100 items.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#add-user-access-restrictions
//
//meta:operation POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
func (s *RepositoriesService) AddUserRestrictions(ctx context.Context, owner, repo, branch string, users []string) ([]*User, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/users", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("POST", u, users)
	if err != nil {
		return nil, nil, err
	}

	var newUsers []*User
	resp, err := s.client.Do(ctx, req, &newUsers)
	if err != nil {
		return nil, resp, err
	}

	return newUsers, resp, nil
}

// RemoveUserRestrictions removes the restrictions of a user from pushing to this branch.
// It requires the GitHub users to have `write` access to the `content` permission.
//
// Note: The list of users, apps, and teams in total is limited to 100 items.
//
// Note: the branch name is URL path escaped for you. See: https://pkg.go.dev/net/url#PathEscape .
//
// GitHub API docs: https://docs.github.com/rest/branches/branch-protection#remove-user-access-restrictions
//
//meta:operation DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
func (s *RepositoriesService) RemoveUserRestrictions(ctx context.Context, owner, repo, branch string, users []string) ([]*User, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/branches/%v/protection/restrictions/users", owner, repo, url.PathEscape(branch))
	req, err := s.client.NewRequest("DELETE", u, users)
	if err != nil {
		return nil, nil, err
	}

	var newUsers []*User
	resp, err := s.client.Do(ctx, req, &newUsers)
	if err != nil {
		return nil, resp, err
	}

	return newUsers, resp, nil
}

// TransferRequest represents a request to transfer a repository.
type TransferRequest struct {
	NewOwner string  `json:"new_owner"`
	NewName  *string `json:"new_name,omitempty"`
	TeamID   []int64 `json:"team_ids,omitempty"`
}

// Transfer transfers a repository from one account or organization to another.
//
// This method might return an *AcceptedError and a status code of
// 202. This is because this is the status that GitHub returns to signify that
// it has now scheduled the transfer of the repository in a background task.
// A follow up request, after a delay of a second or so, should result
// in a successful request.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#transfer-a-repository
//
//meta:operation POST /repos/{owner}/{repo}/transfer
func (s *RepositoriesService) Transfer(ctx context.Context, owner, repo string, transfer TransferRequest) (*Repository, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/transfer", owner, repo)

	req, err := s.client.NewRequest("POST", u, &transfer)
	if err != nil {
		return nil, nil, err
	}

	r := new(Repository)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// DispatchRequestOptions represents a request to trigger a repository_dispatch event.
type DispatchRequestOptions struct {
	// EventType is a custom webhook event name. (Required.)
	EventType string `json:"event_type"`
	// ClientPayload is a custom JSON payload with extra information about the webhook event.
	// Defaults to an empty JSON object.
	ClientPayload *json.RawMessage `json:"client_payload,omitempty"`
}

// Dispatch triggers a repository_dispatch event in a GitHub Actions workflow.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#create-a-repository-dispatch-event
//
//meta:operation POST /repos/{owner}/{repo}/dispatches
func (s *RepositoriesService) Dispatch(ctx context.Context, owner, repo string, opts DispatchRequestOptions) (*Repository, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/dispatches", owner, repo)

	req, err := s.client.NewRequest("POST", u, &opts)
	if err != nil {
		return nil, nil, err
	}

	r := new(Repository)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// isBranchNotProtected determines whether a branch is not protected
// based on the error message returned by GitHub API.
func isBranchNotProtected(err error) bool {
	errorResponse, ok := err.(*ErrorResponse)
	return ok && errorResponse.Message == githubBranchNotProtected
}

// EnablePrivateReporting enables private reporting of vulnerabilities for a
// repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#enable-private-vulnerability-reporting-for-a-repository
//
//meta:operation PUT /repos/{owner}/{repo}/private-vulnerability-reporting
func (s *RepositoriesService) EnablePrivateReporting(ctx context.Context, owner, repo string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/private-vulnerability-reporting", owner, repo)

	req, err := s.client.NewRequest("PUT", u, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	if err != nil {
		return resp, err
	}

	return resp, nil
}

// DisablePrivateReporting disables private reporting of vulnerabilities for a
// repository.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#disable-private-vulnerability-reporting-for-a-repository
//
//meta:operation DELETE /repos/{owner}/{repo}/private-vulnerability-reporting
func (s *RepositoriesService) DisablePrivateReporting(ctx context.Context, owner, repo string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/private-vulnerability-reporting", owner, repo)

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

// checkPrivateReporting represents whether private vulnerability reporting is enabled.
type checkPrivateReporting struct {
	Enabled bool `json:"enabled,omitempty"`
}

// IsPrivateReportingEnabled checks if private vulnerability reporting is enabled
// for the repository and returns a boolean indicating the status.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#check-if-private-vulnerability-reporting-is-enabled-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/private-vulnerability-reporting
func (s *RepositoriesService) IsPrivateReportingEnabled(ctx context.Context, owner, repo string) (bool, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/private-vulnerability-reporting", owner, repo)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return false, nil, err
	}

	privateReporting := new(checkPrivateReporting)
	resp, err := s.client.Do(ctx, req, privateReporting)
	return privateReporting.Enabled, resp, err
}
