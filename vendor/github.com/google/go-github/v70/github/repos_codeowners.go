// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// GetCodeownersErrorsOptions specifies the optional parameters to the
// RepositoriesService.GetCodeownersErrors method.
type GetCodeownersErrorsOptions struct {
	// A branch, tag or commit name used to determine which version of the CODEOWNERS file to use.
	// Default: the repository's default branch (e.g. main).
	Ref string `url:"ref,omitempty"`
}

// CodeownersErrors represents a list of syntax errors detected in the CODEOWNERS file.
type CodeownersErrors struct {
	Errors []*CodeownersError `json:"errors"`
}

// CodeownersError represents a syntax error detected in the CODEOWNERS file.
type CodeownersError struct {
	Line       int     `json:"line"`
	Column     int     `json:"column"`
	Kind       string  `json:"kind"`
	Source     string  `json:"source"`
	Suggestion *string `json:"suggestion,omitempty"`
	Message    string  `json:"message"`
	Path       string  `json:"path"`
}

// GetCodeownersErrors lists any syntax errors that are detected in the CODEOWNERS file.
//
// GitHub API docs: https://docs.github.com/rest/repos/repos#list-codeowners-errors
//
//meta:operation GET /repos/{owner}/{repo}/codeowners/errors
func (s *RepositoriesService) GetCodeownersErrors(ctx context.Context, owner, repo string, opts *GetCodeownersErrorsOptions) (*CodeownersErrors, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codeowners/errors", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	codeownersErrors := &CodeownersErrors{}
	resp, err := s.client.Do(ctx, req, codeownersErrors)
	if err != nil {
		return nil, resp, err
	}

	return codeownersErrors, resp, nil
}
