// Copyright 2013 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// GitignoresService provides access to the gitignore related functions in the
// GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/gitignore/
type GitignoresService service

// Gitignore represents a .gitignore file as returned by the GitHub API.
type Gitignore struct {
	Name   *string `json:"name,omitempty"`
	Source *string `json:"source,omitempty"`
}

func (g Gitignore) String() string {
	return Stringify(g)
}

// List all available Gitignore templates.
//
// GitHub API docs: https://docs.github.com/rest/gitignore/gitignore#get-all-gitignore-templates
//
//meta:operation GET /gitignore/templates
func (s *GitignoresService) List(ctx context.Context) ([]string, *Response, error) {
	req, err := s.client.NewRequest("GET", "gitignore/templates", nil)
	if err != nil {
		return nil, nil, err
	}

	var availableTemplates []string
	resp, err := s.client.Do(ctx, req, &availableTemplates)
	if err != nil {
		return nil, resp, err
	}

	return availableTemplates, resp, nil
}

// Get a Gitignore by name.
//
// GitHub API docs: https://docs.github.com/rest/gitignore/gitignore#get-a-gitignore-template
//
//meta:operation GET /gitignore/templates/{name}
func (s *GitignoresService) Get(ctx context.Context, name string) (*Gitignore, *Response, error) {
	u := fmt.Sprintf("gitignore/templates/%v", name)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	gitignore := new(Gitignore)
	resp, err := s.client.Do(ctx, req, gitignore)
	if err != nil {
		return nil, resp, err
	}

	return gitignore, resp, nil
}
