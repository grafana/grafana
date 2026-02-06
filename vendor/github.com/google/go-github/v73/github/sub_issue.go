// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// SubIssueService handles communication with the sub-issue related
// methods of the GitHub API.
//
// Sub-issues help you group and manage your issues with a parent/child relationship.
//
// GitHub API docs: https://docs.github.com/rest/issues/sub-issues
type SubIssueService service

// SubIssue represents a GitHub sub-issue on a repository.
// Note: As far as the GitHub API is concerned, every pull request is an issue,
// but not every issue is a pull request. Some endpoints, events, and webhooks
// may also return pull requests via this struct. If PullRequestLinks is nil,
// this is an issue, and if PullRequestLinks is not nil, this is a pull request.
// The IsPullRequest helper method can be used to check that.
type SubIssue Issue

func (i SubIssue) String() string {
	return Stringify(i)
}

// SubIssueListByIssueOptions specifies the optional parameters to the
// SubIssueService.ListByIssue method.
type SubIssueListByIssueOptions struct {
	IssueListByRepoOptions
}

// SubIssueRequest represents a request to add, remove, or reprioritize sub-issues.
type SubIssueRequest struct {
	SubIssueID    int64  `json:"sub_issue_id"`             // Required: The ID of the sub-issue
	AfterID       *int64 `json:"after_id,omitempty"`       // Optional: Position after this sub-issue ID
	BeforeID      *int64 `json:"before_id,omitempty"`      // Optional: Position before this sub-issue ID
	ReplaceParent *bool  `json:"replace_parent,omitempty"` // Optional: Whether to replace the existing parent
}

// Remove a sub-issue from the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/issues/sub-issues#remove-sub-issue
//
//meta:operation DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue
func (s *SubIssueService) Remove(ctx context.Context, owner, repo string, subIssueNumber int64, subIssue SubIssueRequest) (*SubIssue, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/issues/%v/sub_issues", owner, repo, subIssueNumber)

	req, err := s.client.NewRequest("DELETE", u, subIssue)
	if err != nil {
		return nil, nil, err
	}

	si := new(SubIssue)
	resp, err := s.client.Do(ctx, req, si)
	if err != nil {
		return nil, resp, err
	}

	return si, resp, nil
}

// ListByIssue lists all sub-issues for the specified issue.
//
// GitHub API docs: https://docs.github.com/rest/issues/sub-issues#list-sub-issues
//
//meta:operation GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
func (s *SubIssueService) ListByIssue(ctx context.Context, owner, repo string, issueNumber int64, opts *IssueListOptions) ([]*SubIssue, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/issues/%v/sub_issues", owner, repo, issueNumber)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var subIssues []*SubIssue
	resp, err := s.client.Do(ctx, req, &subIssues)
	if err != nil {
		return nil, resp, err
	}

	return subIssues, resp, nil
}

// Add adds a sub-issue to the specified issue.
//
// The sub-issue to be added must belong to the same repository owner as the parent issue.
// To replace the existing parent of a sub-issue, set replaceParent to true.
//
// GitHub API docs: https://docs.github.com/rest/issues/sub-issues#add-sub-issue
//
//meta:operation POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
func (s *SubIssueService) Add(ctx context.Context, owner, repo string, issueNumber int64, subIssue SubIssueRequest) (*SubIssue, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/issues/%v/sub_issues", owner, repo, issueNumber)
	req, err := s.client.NewRequest("POST", u, subIssue)
	if err != nil {
		return nil, nil, err
	}

	si := new(SubIssue)
	resp, err := s.client.Do(ctx, req, si)
	if err != nil {
		return nil, resp, err
	}

	return si, resp, nil
}

// Reprioritize changes a sub-issue's priority to a different position in the parent list.
//
// Either afterId or beforeId must be specified to determine the new position of the sub-issue.
//
// GitHub API docs: https://docs.github.com/rest/issues/sub-issues#reprioritize-sub-issue
//
//meta:operation PATCH /repos/{owner}/{repo}/issues/{issue_number}/sub_issues/priority
func (s *SubIssueService) Reprioritize(ctx context.Context, owner, repo string, issueNumber int64, subIssue SubIssueRequest) (*SubIssue, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/issues/%v/sub_issues/priority", owner, repo, issueNumber)
	req, err := s.client.NewRequest("PATCH", u, subIssue)
	if err != nil {
		return nil, nil, err
	}

	si := new(SubIssue)
	resp, err := s.client.Do(ctx, req, si)
	if err != nil {
		return nil, resp, err
	}

	return si, resp, nil
}
