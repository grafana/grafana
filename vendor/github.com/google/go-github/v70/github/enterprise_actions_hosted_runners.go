// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// ListHostedRunners lists all the GitHub-hosted runners for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/actions/hosted-runners#list-github-hosted-runners-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/actions/hosted-runners
func (s *EnterpriseService) ListHostedRunners(ctx context.Context, enterprise string, opts *ListOptions) (*HostedRunners, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/actions/hosted-runners", enterprise)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	runners := &HostedRunners{}
	resp, err := s.client.Do(ctx, req, &runners)
	if err != nil {
		return nil, resp, err
	}

	return runners, resp, nil
}

// CreateHostedRunner creates a GitHub-hosted runner for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/actions/hosted-runners#create-a-github-hosted-runner-for-an-enterprise
//
//meta:operation POST /enterprises/{enterprise}/actions/hosted-runners
func (s *EnterpriseService) CreateHostedRunner(ctx context.Context, enterprise string, request *HostedRunnerRequest) (*HostedRunner, *Response, error) {
	if err := validateCreateHostedRunnerRequest(request); err != nil {
		return nil, nil, fmt.Errorf("validation failed: %w", err)
	}

	u := fmt.Sprintf("enterprises/%v/actions/hosted-runners", enterprise)
	req, err := s.client.NewRequest("POST", u, request)
	if err != nil {
		return nil, nil, err
	}

	hostedRunner := new(HostedRunner)
	resp, err := s.client.Do(ctx, req, hostedRunner)
	if err != nil {
		return nil, resp, err
	}

	return hostedRunner, resp, nil
}

// GetHostedRunnerGitHubOwnedImages gets the list of GitHub-owned images available for GitHub-hosted runners for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/actions/hosted-runners#get-github-owned-images-for-github-hosted-runners-in-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/actions/hosted-runners/images/github-owned
func (s *EnterpriseService) GetHostedRunnerGitHubOwnedImages(ctx context.Context, enterprise string) (*HostedRunnerImages, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/actions/hosted-runners/images/github-owned", enterprise)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	hostedRunnerImages := new(HostedRunnerImages)
	resp, err := s.client.Do(ctx, req, hostedRunnerImages)
	if err != nil {
		return nil, resp, err
	}

	return hostedRunnerImages, resp, nil
}

// GetHostedRunnerPartnerImages gets the list of partner images available for GitHub-hosted runners for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/actions/hosted-runners#get-partner-images-for-github-hosted-runners-in-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/actions/hosted-runners/images/partner
func (s *EnterpriseService) GetHostedRunnerPartnerImages(ctx context.Context, enterprise string) (*HostedRunnerImages, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/actions/hosted-runners/images/partner", enterprise)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	hostedRunnerImages := new(HostedRunnerImages)
	resp, err := s.client.Do(ctx, req, hostedRunnerImages)
	if err != nil {
		return nil, resp, err
	}

	return hostedRunnerImages, resp, nil
}

// GetHostedRunnerLimits gets the GitHub-hosted runners Static public IP Limits for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/actions/hosted-runners#get-limits-on-github-hosted-runners-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/actions/hosted-runners/limits
func (s *EnterpriseService) GetHostedRunnerLimits(ctx context.Context, enterprise string) (*HostedRunnerPublicIPLimits, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/actions/hosted-runners/limits", enterprise)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	publicIPLimits := new(HostedRunnerPublicIPLimits)
	resp, err := s.client.Do(ctx, req, publicIPLimits)
	if err != nil {
		return nil, resp, err
	}

	return publicIPLimits, resp, nil
}

// GetHostedRunnerMachineSpecs gets the list of machine specs available for GitHub-hosted runners for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/actions/hosted-runners#get-github-hosted-runners-machine-specs-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/actions/hosted-runners/machine-sizes
func (s *EnterpriseService) GetHostedRunnerMachineSpecs(ctx context.Context, enterprise string) (*HostedRunnerMachineSpecs, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/actions/hosted-runners/machine-sizes", enterprise)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	machineSpecs := new(HostedRunnerMachineSpecs)
	resp, err := s.client.Do(ctx, req, machineSpecs)
	if err != nil {
		return nil, resp, err
	}

	return machineSpecs, resp, nil
}

// GetHostedRunnerPlatforms gets list of platforms available for GitHub-hosted runners for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/actions/hosted-runners#get-platforms-for-github-hosted-runners-in-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/actions/hosted-runners/platforms
func (s *EnterpriseService) GetHostedRunnerPlatforms(ctx context.Context, enterprise string) (*HostedRunnerPlatforms, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/actions/hosted-runners/platforms", enterprise)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	platforms := new(HostedRunnerPlatforms)
	resp, err := s.client.Do(ctx, req, platforms)
	if err != nil {
		return nil, resp, err
	}

	return platforms, resp, nil
}

// GetHostedRunner gets a GitHub-hosted runner in an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/actions/hosted-runners#get-a-github-hosted-runner-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/actions/hosted-runners/{hosted_runner_id}
func (s *EnterpriseService) GetHostedRunner(ctx context.Context, enterprise string, runnerID int64) (*HostedRunner, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/actions/hosted-runners/%v", enterprise, runnerID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	hostedRunner := new(HostedRunner)
	resp, err := s.client.Do(ctx, req, hostedRunner)
	if err != nil {
		return nil, resp, err
	}

	return hostedRunner, resp, nil
}

// UpdateHostedRunner updates a GitHub-hosted runner for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/actions/hosted-runners#update-a-github-hosted-runner-for-an-enterprise
//
//meta:operation PATCH /enterprises/{enterprise}/actions/hosted-runners/{hosted_runner_id}
func (s *EnterpriseService) UpdateHostedRunner(ctx context.Context, enterprise string, runnerID int64, updateReq HostedRunnerRequest) (*HostedRunner, *Response, error) {
	if err := validateUpdateHostedRunnerRequest(&updateReq); err != nil {
		return nil, nil, fmt.Errorf("validation failed: %w", err)
	}

	u := fmt.Sprintf("enterprises/%v/actions/hosted-runners/%v", enterprise, runnerID)
	req, err := s.client.NewRequest("PATCH", u, updateReq)
	if err != nil {
		return nil, nil, err
	}

	hostedRunner := new(HostedRunner)
	resp, err := s.client.Do(ctx, req, hostedRunner)
	if err != nil {
		return nil, resp, err
	}

	return hostedRunner, resp, nil
}

// DeleteHostedRunner deletes GitHub-hosted runner from an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/actions/hosted-runners#delete-a-github-hosted-runner-for-an-enterprise
//
//meta:operation DELETE /enterprises/{enterprise}/actions/hosted-runners/{hosted_runner_id}
func (s *EnterpriseService) DeleteHostedRunner(ctx context.Context, enterprise string, runnerID int64) (*HostedRunner, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/actions/hosted-runners/%v", enterprise, runnerID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, nil, err
	}

	hostedRunner := new(HostedRunner)
	resp, err := s.client.Do(ctx, req, hostedRunner)
	if err != nil {
		return nil, resp, err
	}

	return hostedRunner, resp, nil
}
