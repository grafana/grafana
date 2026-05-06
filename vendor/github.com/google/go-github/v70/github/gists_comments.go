// Copyright 2013 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// GistComment represents a Gist comment.
type GistComment struct {
	ID        *int64     `json:"id,omitempty"`
	URL       *string    `json:"url,omitempty"`
	Body      *string    `json:"body,omitempty"`
	User      *User      `json:"user,omitempty"`
	CreatedAt *Timestamp `json:"created_at,omitempty"`
}

func (g GistComment) String() string {
	return Stringify(g)
}

// ListComments lists all comments for a gist.
//
// GitHub API docs: https://docs.github.com/rest/gists/comments#list-gist-comments
//
//meta:operation GET /gists/{gist_id}/comments
func (s *GistsService) ListComments(ctx context.Context, gistID string, opts *ListOptions) ([]*GistComment, *Response, error) {
	u := fmt.Sprintf("gists/%v/comments", gistID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var comments []*GistComment
	resp, err := s.client.Do(ctx, req, &comments)
	if err != nil {
		return nil, resp, err
	}

	return comments, resp, nil
}

// GetComment retrieves a single comment from a gist.
//
// GitHub API docs: https://docs.github.com/rest/gists/comments#get-a-gist-comment
//
//meta:operation GET /gists/{gist_id}/comments/{comment_id}
func (s *GistsService) GetComment(ctx context.Context, gistID string, commentID int64) (*GistComment, *Response, error) {
	u := fmt.Sprintf("gists/%v/comments/%v", gistID, commentID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	c := new(GistComment)
	resp, err := s.client.Do(ctx, req, c)
	if err != nil {
		return nil, resp, err
	}

	return c, resp, nil
}

// CreateComment creates a comment for a gist.
//
// GitHub API docs: https://docs.github.com/rest/gists/comments#create-a-gist-comment
//
//meta:operation POST /gists/{gist_id}/comments
func (s *GistsService) CreateComment(ctx context.Context, gistID string, comment *GistComment) (*GistComment, *Response, error) {
	u := fmt.Sprintf("gists/%v/comments", gistID)
	req, err := s.client.NewRequest("POST", u, comment)
	if err != nil {
		return nil, nil, err
	}

	c := new(GistComment)
	resp, err := s.client.Do(ctx, req, c)
	if err != nil {
		return nil, resp, err
	}

	return c, resp, nil
}

// EditComment edits an existing gist comment.
//
// GitHub API docs: https://docs.github.com/rest/gists/comments#update-a-gist-comment
//
//meta:operation PATCH /gists/{gist_id}/comments/{comment_id}
func (s *GistsService) EditComment(ctx context.Context, gistID string, commentID int64, comment *GistComment) (*GistComment, *Response, error) {
	u := fmt.Sprintf("gists/%v/comments/%v", gistID, commentID)
	req, err := s.client.NewRequest("PATCH", u, comment)
	if err != nil {
		return nil, nil, err
	}

	c := new(GistComment)
	resp, err := s.client.Do(ctx, req, c)
	if err != nil {
		return nil, resp, err
	}

	return c, resp, nil
}

// DeleteComment deletes a gist comment.
//
// GitHub API docs: https://docs.github.com/rest/gists/comments#delete-a-gist-comment
//
//meta:operation DELETE /gists/{gist_id}/comments/{comment_id}
func (s *GistsService) DeleteComment(ctx context.Context, gistID string, commentID int64) (*Response, error) {
	u := fmt.Sprintf("gists/%v/comments/%v", gistID, commentID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
