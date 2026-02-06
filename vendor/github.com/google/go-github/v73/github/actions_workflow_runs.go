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

// WorkflowRun represents a repository action workflow run.
type WorkflowRun struct {
	ID                  *int64                `json:"id,omitempty"`
	Name                *string               `json:"name,omitempty"`
	NodeID              *string               `json:"node_id,omitempty"`
	HeadBranch          *string               `json:"head_branch,omitempty"`
	HeadSHA             *string               `json:"head_sha,omitempty"`
	Path                *string               `json:"path,omitempty"`
	RunNumber           *int                  `json:"run_number,omitempty"`
	RunAttempt          *int                  `json:"run_attempt,omitempty"`
	Event               *string               `json:"event,omitempty"`
	DisplayTitle        *string               `json:"display_title,omitempty"`
	Status              *string               `json:"status,omitempty"`
	Conclusion          *string               `json:"conclusion,omitempty"`
	WorkflowID          *int64                `json:"workflow_id,omitempty"`
	CheckSuiteID        *int64                `json:"check_suite_id,omitempty"`
	CheckSuiteNodeID    *string               `json:"check_suite_node_id,omitempty"`
	URL                 *string               `json:"url,omitempty"`
	HTMLURL             *string               `json:"html_url,omitempty"`
	PullRequests        []*PullRequest        `json:"pull_requests,omitempty"`
	CreatedAt           *Timestamp            `json:"created_at,omitempty"`
	UpdatedAt           *Timestamp            `json:"updated_at,omitempty"`
	RunStartedAt        *Timestamp            `json:"run_started_at,omitempty"`
	JobsURL             *string               `json:"jobs_url,omitempty"`
	LogsURL             *string               `json:"logs_url,omitempty"`
	CheckSuiteURL       *string               `json:"check_suite_url,omitempty"`
	ArtifactsURL        *string               `json:"artifacts_url,omitempty"`
	CancelURL           *string               `json:"cancel_url,omitempty"`
	RerunURL            *string               `json:"rerun_url,omitempty"`
	PreviousAttemptURL  *string               `json:"previous_attempt_url,omitempty"`
	HeadCommit          *HeadCommit           `json:"head_commit,omitempty"`
	WorkflowURL         *string               `json:"workflow_url,omitempty"`
	Repository          *Repository           `json:"repository,omitempty"`
	HeadRepository      *Repository           `json:"head_repository,omitempty"`
	Actor               *User                 `json:"actor,omitempty"`
	TriggeringActor     *User                 `json:"triggering_actor,omitempty"`
	ReferencedWorkflows []*ReferencedWorkflow `json:"referenced_workflows,omitempty"`
}

// WorkflowRuns represents a slice of repository action workflow run.
type WorkflowRuns struct {
	TotalCount   *int           `json:"total_count,omitempty"`
	WorkflowRuns []*WorkflowRun `json:"workflow_runs,omitempty"`
}

// ListWorkflowRunsOptions specifies optional parameters to ListWorkflowRuns.
type ListWorkflowRunsOptions struct {
	Actor               string `url:"actor,omitempty"`
	Branch              string `url:"branch,omitempty"`
	Event               string `url:"event,omitempty"`
	Status              string `url:"status,omitempty"`
	Created             string `url:"created,omitempty"`
	HeadSHA             string `url:"head_sha,omitempty"`
	ExcludePullRequests bool   `url:"exclude_pull_requests,omitempty"`
	CheckSuiteID        int64  `url:"check_suite_id,omitempty"`
	ListOptions
}

// WorkflowRunUsage represents a usage of a specific workflow run.
type WorkflowRunUsage struct {
	Billable      *WorkflowRunBillMap `json:"billable,omitempty"`
	RunDurationMS *int64              `json:"run_duration_ms,omitempty"`
}

// WorkflowRunBillMap represents different runner environments available for a workflow run.
// Its key is the name of its environment, e.g. "UBUNTU", "MACOS", "WINDOWS", etc.
type WorkflowRunBillMap map[string]*WorkflowRunBill

// WorkflowRunBill specifies billable time for a specific environment in a workflow run.
type WorkflowRunBill struct {
	TotalMS *int64               `json:"total_ms,omitempty"`
	Jobs    *int                 `json:"jobs,omitempty"`
	JobRuns []*WorkflowRunJobRun `json:"job_runs,omitempty"`
}

// WorkflowRunJobRun represents a usage of individual jobs of a specific workflow run.
type WorkflowRunJobRun struct {
	JobID      *int   `json:"job_id,omitempty"`
	DurationMS *int64 `json:"duration_ms,omitempty"`
}

// WorkflowRunAttemptOptions specifies optional parameters to GetWorkflowRunAttempt.
type WorkflowRunAttemptOptions struct {
	ExcludePullRequests *bool `url:"exclude_pull_requests,omitempty"`
}

// PendingDeploymentsRequest specifies body parameters to PendingDeployments.
type PendingDeploymentsRequest struct {
	EnvironmentIDs []int64 `json:"environment_ids"`
	// State can be one of: "approved", "rejected".
	State   string `json:"state"`
	Comment string `json:"comment"`
}

type ReferencedWorkflow struct {
	Path *string `json:"path,omitempty"`
	SHA  *string `json:"sha,omitempty"`
	Ref  *string `json:"ref,omitempty"`
}

// PendingDeployment represents the pending_deployments response.
type PendingDeployment struct {
	Environment           *PendingDeploymentEnvironment `json:"environment,omitempty"`
	WaitTimer             *int64                        `json:"wait_timer,omitempty"`
	WaitTimerStartedAt    *Timestamp                    `json:"wait_timer_started_at,omitempty"`
	CurrentUserCanApprove *bool                         `json:"current_user_can_approve,omitempty"`
	Reviewers             []*RequiredReviewer           `json:"reviewers,omitempty"`
}

// PendingDeploymentEnvironment represents pending deployment environment properties.
type PendingDeploymentEnvironment struct {
	ID      *int64  `json:"id,omitempty"`
	NodeID  *string `json:"node_id,omitempty"`
	Name    *string `json:"name,omitempty"`
	URL     *string `json:"url,omitempty"`
	HTMLURL *string `json:"html_url,omitempty"`
}

// ReviewCustomDeploymentProtectionRuleRequest specifies the parameters to ReviewCustomDeploymentProtectionRule.
type ReviewCustomDeploymentProtectionRuleRequest struct {
	EnvironmentName string `json:"environment_name"`
	State           string `json:"state"`
	Comment         string `json:"comment"`
}

func (s *ActionsService) listWorkflowRuns(ctx context.Context, endpoint string, opts *ListWorkflowRunsOptions) (*WorkflowRuns, *Response, error) {
	u, err := addOptions(endpoint, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	runs := new(WorkflowRuns)
	resp, err := s.client.Do(ctx, req, &runs)
	if err != nil {
		return nil, resp, err
	}

	return runs, resp, nil
}

// ListWorkflowRunsByID lists all workflow runs by workflow ID.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow
//
//meta:operation GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs
func (s *ActionsService) ListWorkflowRunsByID(ctx context.Context, owner, repo string, workflowID int64, opts *ListWorkflowRunsOptions) (*WorkflowRuns, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/actions/workflows/%v/runs", owner, repo, workflowID)
	return s.listWorkflowRuns(ctx, u, opts)
}

// ListWorkflowRunsByFileName lists all workflow runs by workflow file name.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow
//
//meta:operation GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs
func (s *ActionsService) ListWorkflowRunsByFileName(ctx context.Context, owner, repo, workflowFileName string, opts *ListWorkflowRunsOptions) (*WorkflowRuns, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/actions/workflows/%v/runs", owner, repo, workflowFileName)
	return s.listWorkflowRuns(ctx, u, opts)
}

// ListRepositoryWorkflowRuns lists all workflow runs for a repository.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#list-workflow-runs-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/actions/runs
func (s *ActionsService) ListRepositoryWorkflowRuns(ctx context.Context, owner, repo string, opts *ListWorkflowRunsOptions) (*WorkflowRuns, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/actions/runs", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	runs := new(WorkflowRuns)
	resp, err := s.client.Do(ctx, req, &runs)
	if err != nil {
		return nil, resp, err
	}

	return runs, resp, nil
}

// GetWorkflowRunByID gets a specific workflow run by ID.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#get-a-workflow-run
//
//meta:operation GET /repos/{owner}/{repo}/actions/runs/{run_id}
func (s *ActionsService) GetWorkflowRunByID(ctx context.Context, owner, repo string, runID int64) (*WorkflowRun, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v", owner, repo, runID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	run := new(WorkflowRun)
	resp, err := s.client.Do(ctx, req, run)
	if err != nil {
		return nil, resp, err
	}

	return run, resp, nil
}

// GetWorkflowRunAttempt gets a specific workflow run attempt.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#get-a-workflow-run-attempt
//
//meta:operation GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}
func (s *ActionsService) GetWorkflowRunAttempt(ctx context.Context, owner, repo string, runID int64, attemptNumber int, opts *WorkflowRunAttemptOptions) (*WorkflowRun, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/attempts/%v", owner, repo, runID, attemptNumber)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	run := new(WorkflowRun)
	resp, err := s.client.Do(ctx, req, run)
	if err != nil {
		return nil, resp, err
	}

	return run, resp, nil
}

// GetWorkflowRunAttemptLogs gets a redirect URL to download a plain text file of logs for a workflow run for attempt number.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve a workflow run ID from the DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#download-workflow-run-attempt-logs
//
//meta:operation GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/logs
func (s *ActionsService) GetWorkflowRunAttemptLogs(ctx context.Context, owner, repo string, runID int64, attemptNumber int, maxRedirects int) (*url.URL, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/attempts/%v/logs", owner, repo, runID, attemptNumber)

	if s.client.RateLimitRedirectionalEndpoints {
		return s.getWorkflowRunAttemptLogsWithRateLimit(ctx, u, maxRedirects)
	}

	return s.getWorkflowRunAttemptLogsWithoutRateLimit(ctx, u, maxRedirects)
}

func (s *ActionsService) getWorkflowRunAttemptLogsWithoutRateLimit(ctx context.Context, u string, maxRedirects int) (*url.URL, *Response, error) {
	resp, err := s.client.roundTripWithOptionalFollowRedirect(ctx, u, maxRedirects)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusFound {
		return nil, newResponse(resp), fmt.Errorf("unexpected status code: %v", resp.Status)
	}

	parsedURL, err := url.Parse(resp.Header.Get("Location"))
	return parsedURL, newResponse(resp), err
}

func (s *ActionsService) getWorkflowRunAttemptLogsWithRateLimit(ctx context.Context, u string, maxRedirects int) (*url.URL, *Response, error) {
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

// RerunWorkflowByID re-runs a workflow by ID.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID a the DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#re-run-a-workflow
//
//meta:operation POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun
func (s *ActionsService) RerunWorkflowByID(ctx context.Context, owner, repo string, runID int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/rerun", owner, repo, runID)

	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RerunFailedJobsByID re-runs all of the failed jobs and their dependent jobs in a workflow run by ID.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#re-run-failed-jobs-from-a-workflow-run
//
//meta:operation POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs
func (s *ActionsService) RerunFailedJobsByID(ctx context.Context, owner, repo string, runID int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/rerun-failed-jobs", owner, repo, runID)

	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// RerunJobByID re-runs a job and its dependent jobs in a workflow run by ID.
//
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#re-run-a-job-from-a-workflow-run
//
//meta:operation POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun
func (s *ActionsService) RerunJobByID(ctx context.Context, owner, repo string, jobID int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/jobs/%v/rerun", owner, repo, jobID)

	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// CancelWorkflowRunByID cancels a workflow run by ID.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#cancel-a-workflow-run
//
//meta:operation POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel
func (s *ActionsService) CancelWorkflowRunByID(ctx context.Context, owner, repo string, runID int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/cancel", owner, repo, runID)

	req, err := s.client.NewRequest("POST", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// GetWorkflowRunLogs gets a redirect URL to download a plain text file of logs for a workflow run.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#download-workflow-run-logs
//
//meta:operation GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs
func (s *ActionsService) GetWorkflowRunLogs(ctx context.Context, owner, repo string, runID int64, maxRedirects int) (*url.URL, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/logs", owner, repo, runID)

	if s.client.RateLimitRedirectionalEndpoints {
		return s.getWorkflowRunLogsWithRateLimit(ctx, u, maxRedirects)
	}

	return s.getWorkflowRunLogsWithoutRateLimit(ctx, u, maxRedirects)
}

func (s *ActionsService) getWorkflowRunLogsWithoutRateLimit(ctx context.Context, u string, maxRedirects int) (*url.URL, *Response, error) {
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

func (s *ActionsService) getWorkflowRunLogsWithRateLimit(ctx context.Context, u string, maxRedirects int) (*url.URL, *Response, error) {
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

// DeleteWorkflowRun deletes a workflow run by ID.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#delete-a-workflow-run
//
//meta:operation DELETE /repos/{owner}/{repo}/actions/runs/{run_id}
func (s *ActionsService) DeleteWorkflowRun(ctx context.Context, owner, repo string, runID int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v", owner, repo, runID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// DeleteWorkflowRunLogs deletes all logs for a workflow run.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#delete-workflow-run-logs
//
//meta:operation DELETE /repos/{owner}/{repo}/actions/runs/{run_id}/logs
func (s *ActionsService) DeleteWorkflowRunLogs(ctx context.Context, owner, repo string, runID int64) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/logs", owner, repo, runID)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}

	return s.client.Do(ctx, req, nil)
}

// GetWorkflowRunUsageByID gets a specific workflow usage run by run ID in the unit of billable milliseconds.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#get-workflow-run-usage
//
//meta:operation GET /repos/{owner}/{repo}/actions/runs/{run_id}/timing
func (s *ActionsService) GetWorkflowRunUsageByID(ctx context.Context, owner, repo string, runID int64) (*WorkflowRunUsage, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/timing", owner, repo, runID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	workflowRunUsage := new(WorkflowRunUsage)
	resp, err := s.client.Do(ctx, req, workflowRunUsage)
	if err != nil {
		return nil, resp, err
	}

	return workflowRunUsage, resp, nil
}

// GetPendingDeployments get all deployment environments for a workflow run that are waiting for protection rules to pass.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#get-pending-deployments-for-a-workflow-run
//
//meta:operation GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments
func (s *ActionsService) GetPendingDeployments(ctx context.Context, owner, repo string, runID int64) ([]*PendingDeployment, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/pending_deployments", owner, repo, runID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var deployments []*PendingDeployment
	resp, err := s.client.Do(ctx, req, &deployments)
	if err != nil {
		return nil, resp, err
	}

	return deployments, resp, nil
}

// PendingDeployments approve or reject pending deployments that are waiting on approval by a required reviewer.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#review-pending-deployments-for-a-workflow-run
//
//meta:operation POST /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments
func (s *ActionsService) PendingDeployments(ctx context.Context, owner, repo string, runID int64, request *PendingDeploymentsRequest) ([]*Deployment, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/pending_deployments", owner, repo, runID)

	req, err := s.client.NewRequest("POST", u, request)
	if err != nil {
		return nil, nil, err
	}

	var deployments []*Deployment
	resp, err := s.client.Do(ctx, req, &deployments)
	if err != nil {
		return nil, resp, err
	}

	return deployments, resp, nil
}

// ReviewCustomDeploymentProtectionRule approves or rejects custom deployment protection rules provided by a GitHub App for a workflow run.
// You can use the helper function *DeploymentProtectionRuleEvent.GetRunID() to easily retrieve the workflow run ID from a DeploymentProtectionRuleEvent.
//
// GitHub API docs: https://docs.github.com/rest/actions/workflow-runs#review-custom-deployment-protection-rules-for-a-workflow-run
//
//meta:operation POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule
func (s *ActionsService) ReviewCustomDeploymentProtectionRule(ctx context.Context, owner, repo string, runID int64, request *ReviewCustomDeploymentProtectionRuleRequest) (*Response, error) {
	u := fmt.Sprintf("repos/%v/%v/actions/runs/%v/deployment_protection_rule", owner, repo, runID)

	req, err := s.client.NewRequest("POST", u, request)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(ctx, req, nil)
	return resp, err
}
