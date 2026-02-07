// Copyright 2022 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// EnableLFS turns the LFS (Large File Storage) feature ON for the selected repo.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/repos/lfs#enable-git-lfs-for-a-repository
//
//meta:operation PUT /repos/{owner}/{repo}/lfs
func (s *RepositoriesService) EnableLFS(ctx context.Context, owner, repo string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/lfs", owner, repo)

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

// DisableLFS turns the LFS (Large File Storage) feature OFF for the selected repo.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/repos/lfs#disable-git-lfs-for-a-repository
//
//meta:operation DELETE /repos/{owner}/{repo}/lfs
func (s *RepositoriesService) DisableLFS(ctx context.Context, owner, repo string) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/lfs", owner, repo)

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
