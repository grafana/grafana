// Copyright 2013 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// ListAssignees fetches all available assignees (owners and collaborators) to
// which issues may be assigned.
//
// GitHub API docs: https://docs.github.com/rest/issues/assignees#list-assignees
//
//meta:operation GET /repos/{owner}/{repo}/assignees
func (s *IssuesService) ListAssignees(ctx context.Context, owner, repo string, opts *ListOptions) ([]*User, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/assignees", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var assignees []*User
	resp, err := s.client.Do(ctx, req, &assignees)
	if err != nil {
		return nil, resp, err
	}

	return assignees, resp, nil
}

// IsAssignee checks if a user is an assignee for the specified repository.
//
// GitHub API docs: https://docs.github.com/rest/issues/assignees#check-if-a-user-can-be-assigned
//
//meta:operation GET /repos/{owner}/{repo}/assignees/{assignee}
func (s *IssuesService) IsAssignee(ctx context.Context, owner, repo, user string) (bool, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/assignees/%v", owner, repo, user)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return false, nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	assignee, err := parseBoolResponse(err)
	return assignee, resp, err
}

// AddAssignees adds the provided GitHub users as assignees to the issue.
//
// GitHub API docs: https://docs.github.com/rest/issues/assignees#add-assignees-to-an-issue
//
//meta:operation POST /repos/{owner}/{repo}/issues/{issue_number}/assignees
func (s *IssuesService) AddAssignees(ctx context.Context, owner, repo string, number int, assignees []string) (*Issue, *Response, error) {
	users := &struct {
		Assignees []string `json:"assignees,omitempty"`
	}{Assignees: assignees}
	u := fmt.Sprintf("repos/%v/%v/issues/%v/assignees", owner, repo, number)
	req, err := s.client.NewRequest("POST", u, users)
	if err != nil {
		return nil, nil, err
	}

	issue := &Issue{}
	resp, err := s.client.Do(ctx, req, issue)
	if err != nil {
		return nil, resp, err
	}

	return issue, resp, nil
}

// RemoveAssignees removes the provided GitHub users as assignees from the issue.
//
// GitHub API docs: https://docs.github.com/rest/issues/assignees#remove-assignees-from-an-issue
//
//meta:operation DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees
func (s *IssuesService) RemoveAssignees(ctx context.Context, owner, repo string, number int, assignees []string) (*Issue, *Response, error) {
	users := &struct {
		Assignees []string `json:"assignees,omitempty"`
	}{Assignees: assignees}
	u := fmt.Sprintf("repos/%v/%v/issues/%v/assignees", owner, repo, number)
	req, err := s.client.NewRequest("DELETE", u, users)
	if err != nil {
		return nil, nil, err
	}

	issue := &Issue{}
	resp, err := s.client.Do(ctx, req, issue)
	if err != nil {
		return nil, resp, err
	}

	return issue, resp, nil
}
