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

// TaskStep represents a single task step from a sequence of tasks of a job.
type TaskStep struct {
	Name        *string    `json:"name,omitempty"`
	Status      *string    `json:"status,omitempty"`
	Conclusion  *string    `json:"conclusion,omitempty"`
	Number      *int64     `json:"number,omitempty"`
	StartedAt   *Timestamp `json:"started_at,omitempty"`
	CompletedAt *Timestamp `json:"completed_at,omitempty"`
}

// WorkflowJob represents a repository action workflow job.
type WorkflowJob struct {
	ID          *int64      `json:"id,omitempty"`
	RunID       *int64      `json:"run_id,omitempty"`
	RunURL      *string     `json:"run_url,omitempty"`
	NodeID      *string     `json:"node_id,omitempty"`
	HeadBranch  *string     `json:"head_branch,omitempty"`
	HeadSHA     *string     `json:"head_sha,omitempty"`
	URL         *string     `json:"url,omitempty"`
	HTMLURL     *string     `json:"html_url,omitempty"`
	Status      *string     `json:"status,omitempty"`
	Conclusion  *string     `json:"conclusion,omitempty"`
	CreatedAt   *Timestamp  `json:"created_at,omitempty"`
	StartedAt   *Timestamp  `json:"started_at,omitempty"`
	CompletedAt *Timestamp  `json:"completed_at,omitempty"`
	Name        *string     `json:"name,omitempty"`
	Steps       []*TaskStep `json:"steps,omitempty"`
	CheckRunURL *string     `json:"check_run_url,omitempty"`
	// Labels represents runner labels from the `runs-on:` key from a GitHub Actions workflow.
	Labels          []string `json:"labels,omitempty"`
	RunnerID        *int64   `json:"runner_id,omitempty"`
	RunnerName      *string  `json:"runner_name,omitempty"`
	RunnerGroupID   *int64   `json:"runner_group_id,omitempty"`
	RunnerGroupName *string  `json:"runner_group_name,omitempty"`
	RunAttempt      *int64   `json:"run_attempt,omitempty"`
	WorkflowName    *string  `json:"workflow_name,omitempty"`
}

// Jobs represents a slice of repository action workflow job.
type Jobs struct {
	TotalCount *int           `json:"total_count,omitempty"`
	Jobs       []*WorkflowJob `json:"jobs,omitempty"`
}

// ListWorkflowJobsOptions specifies optional parameters to ListWorkflowJobs.
type ListWorkflowJobsOptions struct {
	// Filter specifies how jobs should be filtered by their completed_at timestamp.
	// Possible values are:
	//     latest - Returns jobs from the most recent execution of the workflow run
	//     all - Returns all jobs for a workflow run, including from old executions of the workflow run
	//
	// Default value is "latest".
	Filter string `url:"filter,omitempty"`
	ListOptions
}

// ListWorkflowJobs lists all jobs for a workflow run.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run
//
//meta:operation GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs
func (s *ActionsService) ListWorkflowJobs(ctx context.Context, owner, repo string, runID int64, opts *ListWorkflowJobsOptions) (*Jobs, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/actions/runs/%v/jobs", owner, repo, runID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	jobs := new(Jobs)
	resp, err := s.client.Do(ctx, req, &jobs)
	if err != nil {
		return nil, resp, err
	}

	return jobs, resp, nil
}

// ListWorkflowJobsAttempt lists jobs for a workflow run Attempt.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt
//
//meta:operation GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs
func (s *ActionsService) ListWorkflowJobsAttempt(ctx context.Context, owner, repo string, runID, attemptNumber int64, opts *ListOptions) (*Jobs, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/actions/runs/%v/attempts/%v/jobs", owner, repo, runID, attemptNumber)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	jobs := new(Jobs)
	resp, err := s.client.Do(ctx, req, &jobs)
	if err != nil {
		return nil, resp, err
	}

	return jobs, resp, nil
}

// GetWorkflowJobByID gets a specific job in a workflow run by ID.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-jobs#get-a-job-for-a-workflow-run
//
//meta:operation GET /repos/{owner}/{repo}/actions/jobs/{job_id}
func (s *ActionsService) GetWorkflowJobByID(ctx context.Context, owner, repo string, jobID int64) (*WorkflowJob, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/jobs/%v", owner, repo, jobID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	job := new(WorkflowJob)
	resp, err := s.client.Do(ctx, req, job)
	if err != nil {
		return nil, resp, err
	}

	return job, resp, nil
}

// GetWorkflowJobLogs gets a redirect URL to download a plain text file of logs for a workflow job.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run
//
//meta:operation GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs
func (s *ActionsService) GetWorkflowJobLogs(ctx context.Context, owner, repo string, jobID int64, maxRedirects int) (*url.URL, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/jobs/%v/logs", owner, repo, jobID)

	resp, err := s.client.roundTripWithOptionalFollowRedirect(ctx, u, maxRedirects)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusFound {
		return nil, newResponse(resp), fmt.Errorf("unexpected status code: %s", resp.Status)
	}

	parsedURL, err := url.Parse(resp.Header.Get("Location"))
	return parsedURL, newResponse(resp), err
}
