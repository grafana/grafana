// Copyright 2013 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// RepoStatus represents the status of a repository at a particular reference.
type RepoStatus struct {
	ID     *int64  `json:"id,omitempty"`
	NodeID *string `json:"node_id,omitempty"`
	URL    *string `json:"url,omitempty"`

	// State is the current state of the repository. Possible values are:
	// pending, success, error, or failure.
	State *string `json:"state,omitempty"`

	// TargetURL is the URL of the page representing this status. It will be
	// linked from the GitHub UI to allow users to see the source of the status.
	TargetURL *string `json:"target_url,omitempty"`

	// Description is a short high level summary of the status.
	Description *string `json:"description,omitempty"`

	// A string label to differentiate this status from the statuses of other systems.
	Context *string `json:"context,omitempty"`

	// AvatarURL is the URL of the avatar of this status.
	AvatarURL *string `json:"avatar_url,omitempty"`

	Creator   *User      `json:"creator,omitempty"`
	CreatedAt *Timestamp `json:"created_at,omitempty"`
	UpdatedAt *Timestamp `json:"updated_at,omitempty"`
}

func (r RepoStatus) String() string {
	return Stringify(r)
}

// ListStatuses lists the statuses of a repository at the specified
// reference. ref can be a SHA, a branch name, or a tag name.
//
// GitHub API docs: https://docs.github.com/rest/commits/statuses#list-commit-statuses-for-a-reference
//
//meta:operation GET /repos/{owner}/{repo}/commits/{ref}/statuses
func (s *RepositoriesService) ListStatuses(ctx context.Context, owner, repo, ref string, opts *ListOptions) ([]*RepoStatus, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/commits/%v/statuses", owner, repo, refURLEscape(ref))
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var statuses []*RepoStatus
	resp, err := s.client.Do(ctx, req, &statuses)
	if err != nil {
		return nil, resp, err
	}

	return statuses, resp, nil
}

// CreateStatus creates a new status for a repository at the specified
// reference. Ref can be a SHA, a branch name, or a tag name.
//
// GitHub API docs: https://docs.github.com/rest/commits/statuses#create-a-commit-status
//
//meta:operation POST /repos/{owner}/{repo}/statuses/{sha}
func (s *RepositoriesService) CreateStatus(ctx context.Context, owner, repo, ref string, status *RepoStatus) (*RepoStatus, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/statuses/%v", owner, repo, refURLEscape(ref))
	req, err := s.client.NewRequest("POST", u, status)
	if err != nil {
		return nil, nil, err
	}

	repoStatus := new(RepoStatus)
	resp, err := s.client.Do(ctx, req, repoStatus)
	if err != nil {
		return nil, resp, err
	}

	return repoStatus, resp, nil
}

// CombinedStatus represents the combined status of a repository at a particular reference.
type CombinedStatus struct {
	// State is the combined state of the repository. Possible values are:
	// failure, pending, or success.
	State *string `json:"state,omitempty"`

	Name       *string       `json:"name,omitempty"`
	SHA        *string       `json:"sha,omitempty"`
	TotalCount *int          `json:"total_count,omitempty"`
	Statuses   []*RepoStatus `json:"statuses,omitempty"`

	CommitURL     *string `json:"commit_url,omitempty"`
	RepositoryURL *string `json:"repository_url,omitempty"`
}

func (s CombinedStatus) String() string {
	return Stringify(s)
}

// GetCombinedStatus returns the combined status of a repository at the specified
// reference. ref can be a SHA, a branch name, or a tag name.
//
// GitHub API docs: https://docs.github.com/rest/commits/statuses#get-the-combined-status-for-a-specific-reference
//
//meta:operation GET /repos/{owner}/{repo}/commits/{ref}/status
func (s *RepositoriesService) GetCombinedStatus(ctx context.Context, owner, repo, ref string, opts *ListOptions) (*CombinedStatus, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/commits/%v/status", owner, repo, refURLEscape(ref))
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	status := new(CombinedStatus)
	resp, err := s.client.Do(ctx, req, status)
	if err != nil {
		return nil, resp, err
	}

	return status, resp, nil
}
