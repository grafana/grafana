// Copyright 2020 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// ArtifactWorkflowRun represents a GitHub artifact's workflow run.
//
// GitHub API docs: https://docs.github.com/rest/actions/artifacts
type ArtifactWorkflowRun struct {
	ID               *int64  `json:"id,omitempty"`
	RepositoryID     *int64  `json:"repository_id,omitempty"`
	HeadRepositoryID *int64  `json:"head_repository_id,omitempty"`
	HeadBranch       *string `json:"head_branch,omitempty"`
	HeadSHA          *string `json:"head_sha,omitempty"`
}

// Artifact represents a GitHub artifact.  Artifacts allow sharing
// data between jobs in a workflow and provide storage for data
// once a workflow is complete.
//
// GitHub API docs: https://docs.github.com/rest/actions/artifacts
type Artifact struct {
	ID                 *int64               `json:"id,omitempty"`
	NodeID             *string              `json:"node_id,omitempty"`
	Name               *string              `json:"name,omitempty"`
	SizeInBytes        *int64               `json:"size_in_bytes,omitempty"`
	URL                *string              `json:"url,omitempty"`
	ArchiveDownloadURL *string              `json:"archive_download_url,omitempty"`
	Expired            *bool                `json:"expired,omitempty"`
	CreatedAt          *Timestamp           `json:"created_at,omitempty"`
	UpdatedAt          *Timestamp           `json:"updated_at,omitempty"`
	ExpiresAt          *Timestamp           `json:"expires_at,omitempty"`
	WorkflowRun        *ArtifactWorkflowRun `json:"workflow_run,omitempty"`
}

// ArtifactList represents a list of GitHub artifacts.
//
// GitHub API docs: https://docs.github.com/rest/actions/artifacts#artifacts
type ArtifactList struct {
	TotalCount *int64      `json:"total_count,omitempty"`
	Artifacts  []*Artifact `json:"artifacts,omitempty"`
}

// ListArtifactsOptions specifies the optional parameters to the
// ActionsService.ListArtifacts method.
type ListArtifactsOptions struct {
	// Name represents the name field of an artifact.
	// When specified, only artifacts with this name will be returned.
	Name *string `url:"name,omitempty"`

	ListOptions
}

// ListArtifacts lists all artifacts that belong to a repository.
//
// GitHub API docs: https://docs.github.com/rest/actions/artifacts#list-artifacts-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/actions/artifacts
func (s *ActionsService) ListArtifacts(ctx context.Context, owner, repo string, opts *ListArtifactsOptions) (*ArtifactList, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/artifacts", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	artifactList := new(ArtifactList)
	resp, err := s.client.Do(ctx, req, artifactList)
	if err != nil {
		return nil, resp, err
	}

	return artifactList, resp, nil
}

// ListWorkflowRunArtifacts lists all artifacts that belong to a workflow run.
//
// GitHub API docs: https://docs.github.com/rest/actions/artifacts#list-workflow-run-artifacts
//
//meta:operation GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts
func (s *ActionsService) ListWorkflowRunArtifacts(ctx context.Context, owner, repo string, runID int64, opts *ListOptions) (*ArtifactList, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/artifacts", owner, repo, runID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	artifactList := new(ArtifactList)
	resp, err := s.client.Do(ctx, req, artifactList)
	if err != nil {
		return nil, resp, err
	}

	return artifactList, resp, nil
}

// GetArtifact gets a specific artifact for a workflow run.
//
// GitHub API docs: https://docs.github.com/rest/actions/artifacts#get-an-artifact
//
//meta:operation GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}
func (s *ActionsService) GetArtifact(ctx context.Context, owner, repo string, artifactID int64) (*Artifact, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/artifacts/%v", owner, repo, artifactID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	artifact := new(Artifact)
	resp, err := s.client.Do(ctx, req, artifact)
	if err != nil {
		return nil, resp, err
	}

	return artifact, resp, nil
}

// DownloadArtifact gets a redirect URL to download an archive for a repository.
//
// GitHub API docs: https://docs.github.com/rest/actions/artifacts#download-an-artifact
//
//meta:operation GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}
func (s *ActionsService) DownloadArtifact(ctx context.Context, owner, repo string, artifactID int64, maxRedirects int) (*url.URL, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/artifacts/%v/zip", owner, repo, artifactID)

	if s.client.RateLimitRedirectionalEndpoints {
		return s.downloadArtifactWithRateLimit(ctx, u, maxRedirects)
	}

	return s.downloadArtifactWithoutRateLimit(ctx, u, maxRedirects)
}

func (s *ActionsService) downloadArtifactWithoutRateLimit(ctx context.Context, u string, maxRedirects int) (*url.URL, *Response, error) {
	resp, err := s.client.roundTripWithOptionalFollowRedirect(ctx, u, maxRedirects)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusFound {
		return nil, newResponse(resp), fmt.Errorf("unexpected status code: %v", resp.Status)
	}

	parsedURL, err := url.Parse(resp.Header.Get("Location"))
	if err != nil {
		return nil, newResponse(resp), err
	}

	return parsedURL, newResponse(resp), nil
}

func (s *ActionsService) downloadArtifactWithRateLimit(ctx context.Context, u string, maxRedirects int) (*url.URL, *Response, error) {
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	url, resp, err := s.client.bareDoUntilFound(ctx, req, maxRedirects)
	if err != nil {
		return nil, resp, err
	}
	defer resp.Body.Close()

	// If we didn't receive a valid Location in a 302 response
	if url == nil {
		return nil, resp, fmt.Errorf("unexpected status code: %v", resp.Status)
	}

	return url, resp, nil
}

// DeleteArtifact deletes a workflow run artifact.
//
// GitHub API docs: https://docs.github.com/rest/actions/artifacts#delete-an-artifact
//
//meta:operation DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}
func (s *ActionsService) DeleteArtifact(ctx context.Context, owner, repo string, artifactID int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/artifacts/%v", owner, repo, artifactID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}
