// Copyright 2017 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// ReviewersRequest specifies users and teams for a pull request review request.
type ReviewersRequest struct {
	NodeID        *string  `json:"node_id,omitempty"`
	Reviewers     []string `json:"reviewers,omitempty"`
	TeamReviewers []string `json:"team_reviewers,omitempty"`
}

// Reviewers represents reviewers of a pull request.
type Reviewers struct {
	Users []*User `json:"users,omitempty"`
	Teams []*Team `json:"teams,omitempty"`
}

type removeReviewersRequest struct {
	NodeID *string `json:"node_id,omitempty"`
	// Note the lack of omitempty! See comment in RemoveReviewers.
	Reviewers     []string `json:"reviewers"`
	TeamReviewers []string `json:"team_reviewers,omitempty"`
}

// RequestReviewers creates a review request for the provided reviewers for the specified pull request.
//
// GitHub API docs: https://docs.github.com/rest/pulls/review-requests#request-reviewers-for-a-pull-request
//
//meta:operation POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
func (s *PullRequestsService) RequestReviewers(ctx context.Context, owner, repo string, number int, reviewers ReviewersRequest) (*PullRequest, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/pulls/%d/requested_reviewers", owner, repo, number)
	req, err := s.client.NewRequest("POST", u, &reviewers)
	if err != nil {
		return nil, nil, err
	}

	r := new(PullRequest)
	resp, err := s.client.Do(ctx, req, r)
	if err != nil {
		return nil, resp, err
	}

	return r, resp, nil
}

// ListReviewers lists reviewers whose reviews have been requested on the specified pull request.
//
// GitHub API docs: https://docs.github.com/rest/pulls/review-requests#get-all-requested-reviewers-for-a-pull-request
//
//meta:operation GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
func (s *PullRequestsService) ListReviewers(ctx context.Context, owner, repo string, number int, opts *ListOptions) (*Reviewers, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/pulls/%d/requested_reviewers", owner, repo, number)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	reviewers := new(Reviewers)
	resp, err := s.client.Do(ctx, req, reviewers)
	if err != nil {
		return nil, resp, err
	}

	return reviewers, resp, nil
}

// RemoveReviewers removes the review request for the provided reviewers for the specified pull request.
//
// GitHub API docs: https://docs.github.com/rest/pulls/review-requests#remove-requested-reviewers-from-a-pull-request
//
//meta:operation DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
func (s *PullRequestsService) RemoveReviewers(ctx context.Context, owner, repo string, number int, reviewers ReviewersRequest) (*Response, error) {
	// reviewers.Reviewers may be empty if the caller wants to remove teams, but not users. Unlike AddReviewers,
	// "reviewers" is a required param here. Reference: https://github.com/google/go-github/issues/3336
	// The type `removeReviewersRequest` is required because the struct tags are different from `ReviewersRequest`.
	removeRequest := removeReviewersRequest(reviewers)

	if removeRequest.Reviewers == nil {
		// GitHub accepts the empty list, but rejects null. Removing `omitempty` is not enough - we also have to promote nil to [].
		removeRequest.Reviewers = []string{}
	}

	u := fmt.Sprintf("repos/%s/%s/pulls/%d/requested_reviewers", owner, repo, number)
	req, err := s.client.NewRequest("DELETE", u, &removeRequest)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
