// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// CodespacesMachines represent a list of machines.
type CodespacesMachines struct {
	TotalCount int64                `json:"total_count"`
	Machines   []*CodespacesMachine `json:"machines"`
}

// ListRepoMachineTypesOptions represent options for ListMachineTypesForRepository.
type ListRepoMachineTypesOptions struct {
	// Ref represent the branch or commit to check for prebuild availability and devcontainer restrictions.
	Ref *string `url:"ref,omitempty"`
	// Location represent the location to check for available machines. Assigned by IP if not provided.
	Location *string `url:"location,omitempty"`
	// ClientIP represent the IP for location auto-detection when proxying a request
	ClientIP *string `url:"client_ip,omitempty"`
}

// ListRepositoryMachineTypes lists the machine types available for a given repository based on its configuration.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/machines#list-available-machine-types-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/codespaces/machines
func (s *CodespacesService) ListRepositoryMachineTypes(ctx context.Context, owner, repo string, opts *ListRepoMachineTypesOptions) (*CodespacesMachines, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/codespaces/machines", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var machines *CodespacesMachines
	resp, err := s.client.Do(ctx, req, &machines)
	if err != nil {
		return nil, resp, err
	}

	return machines, resp, nil
}

// ListCodespaceMachineTypes lists the machine types a codespace can transition to use.
//
// GitHub API docs: https://docs.github.com/rest/codespaces/machines#list-machine-types-for-a-codespace
//
//meta:operation GET /user/codespaces/{codespace_name}/machines
func (s *CodespacesService) ListCodespaceMachineTypes(ctx context.Context, codespaceName string) (*CodespacesMachines, *Response, error) {
	u := fmt.Sprintf("user/codespaces/%v/machines", codespaceName)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var machines *CodespacesMachines
	resp, err := s.client.Do(ctx, req, &machines)
	if err != nil {
		return nil, resp, err
	}

	return machines, resp, nil
}
