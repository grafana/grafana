// Copyright 2020 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// CodeScanningService handles communication with the code scanning related
// methods of the GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning
type CodeScanningService service

// Rule represents the complete details of GitHub Code Scanning alert type.
type Rule struct {
	ID                    *string  `json:"id,omitempty"`
	Severity              *string  `json:"severity,omitempty"`
	Description           *string  `json:"description,omitempty"`
	Name                  *string  `json:"name,omitempty"`
	SecuritySeverityLevel *string  `json:"security_severity_level,omitempty"`
	FullDescription       *string  `json:"full_description,omitempty"`
	Tags                  []string `json:"tags,omitempty"`
	Help                  *string  `json:"help,omitempty"`
}

// Location represents the exact location of the GitHub Code Scanning Alert in the scanned project.
type Location struct {
	Path        *string `json:"path,omitempty"`
	StartLine   *int    `json:"start_line,omitempty"`
	EndLine     *int    `json:"end_line,omitempty"`
	StartColumn *int    `json:"start_column,omitempty"`
	EndColumn   *int    `json:"end_column,omitempty"`
}

// Message is a part of MostRecentInstance struct which provides the appropriate message when any action is performed on the analysis object.
type Message struct {
	Text *string `json:"text,omitempty"`
}

// MostRecentInstance provides details of the most recent instance of this alert for the default branch or for the specified Git reference.
type MostRecentInstance struct {
	Ref             *string   `json:"ref,omitempty"`
	AnalysisKey     *string   `json:"analysis_key,omitempty"`
	Category        *string   `json:"category,omitempty"`
	Environment     *string   `json:"environment,omitempty"`
	State           *string   `json:"state,omitempty"`
	CommitSHA       *string   `json:"commit_sha,omitempty"`
	Message         *Message  `json:"message,omitempty"`
	Location        *Location `json:"location,omitempty"`
	HTMLURL         *string   `json:"html_url,omitempty"`
	Classifications []string  `json:"classifications,omitempty"`
}

// Tool represents the tool used to generate a GitHub Code Scanning Alert.
type Tool struct {
	Name    *string `json:"name,omitempty"`
	GUID    *string `json:"guid,omitempty"`
	Version *string `json:"version,omitempty"`
}

// Alert represents an individual GitHub Code Scanning Alert on a single repository.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning
type Alert struct {
	Number             *int                  `json:"number,omitempty"`
	Repository         *Repository           `json:"repository,omitempty"`
	RuleID             *string               `json:"rule_id,omitempty"`
	RuleSeverity       *string               `json:"rule_severity,omitempty"`
	RuleDescription    *string               `json:"rule_description,omitempty"`
	Rule               *Rule                 `json:"rule,omitempty"`
	Tool               *Tool                 `json:"tool,omitempty"`
	CreatedAt          *Timestamp            `json:"created_at,omitempty"`
	UpdatedAt          *Timestamp            `json:"updated_at,omitempty"`
	FixedAt            *Timestamp            `json:"fixed_at,omitempty"`
	State              *string               `json:"state,omitempty"`
	ClosedBy           *User                 `json:"closed_by,omitempty"`
	ClosedAt           *Timestamp            `json:"closed_at,omitempty"`
	URL                *string               `json:"url,omitempty"`
	HTMLURL            *string               `json:"html_url,omitempty"`
	MostRecentInstance *MostRecentInstance   `json:"most_recent_instance,omitempty"`
	Instances          []*MostRecentInstance `json:"instances,omitempty"`
	DismissedBy        *User                 `json:"dismissed_by,omitempty"`
	DismissedAt        *Timestamp            `json:"dismissed_at,omitempty"`
	DismissedReason    *string               `json:"dismissed_reason,omitempty"`
	DismissedComment   *string               `json:"dismissed_comment,omitempty"`
	InstancesURL       *string               `json:"instances_url,omitempty"`
}

// ID returns the ID associated with an alert. It is the number at the end of the security alert's URL.
func (a *Alert) ID() int64 {
	if a == nil {
		return 0
	}

	s := a.GetHTMLURL()

	// Check for an ID to parse at the end of the url
	if i := strings.LastIndex(s, "/"); i >= 0 {
		s = s[i+1:]
	}

	// Return the alert ID as a 64-bit integer. Unable to convert or out of range returns 0.
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}

	return id
}

// AlertInstancesListOptions specifies optional parameters to the CodeScanningService.ListAlertInstances method.
type AlertInstancesListOptions struct {
	// Return code scanning alert instances for a specific branch reference.
	// The ref can be formatted as refs/heads/<branch name> or simply <branch name>. To reference a pull request use refs/pull/<number>/merge
	Ref string `url:"ref,omitempty"`

	ListOptions
}

// AlertListOptions specifies optional parameters to the CodeScanningService.ListAlerts method.
type AlertListOptions struct {
	// State of the code scanning alerts to list. Set to closed to list only closed code scanning alerts. Default: open
	State string `url:"state,omitempty"`

	// Return code scanning alerts for a specific branch reference.
	// The ref can be formatted as refs/heads/<branch name> or simply <branch name>. To reference a pull request use refs/pull/<number>/merge
	Ref string `url:"ref,omitempty"`

	// If specified, only code scanning alerts with this severity will be returned. Possible values are: critical, high, medium, low, warning, note, error.
	Severity string `url:"severity,omitempty"`

	// The name of a code scanning tool. Only results by this tool will be listed.
	ToolName string `url:"tool_name,omitempty"`

	// The GUID of a code scanning tool. Only results by this tool will be listed.
	ToolGUID string `url:"tool_guid,omitempty"`

	// The direction to sort the results by. Possible values are: asc, desc. Default: desc.
	Direction string `url:"direction,omitempty"`

	// The property by which to sort the results. Possible values are: created, updated. Default: created.
	Sort string `url:"sort,omitempty"`

	ListCursorOptions

	// Add ListOptions so offset pagination with integer type "page" query parameter is accepted
	// since ListCursorOptions accepts "page" as string only.
	ListOptions
}

// AnalysesListOptions specifies optional parameters to the CodeScanningService.ListAnalysesForRepo method.
type AnalysesListOptions struct {
	// Return code scanning analyses belonging to the same SARIF upload.
	SarifID *string `url:"sarif_id,omitempty"`

	// Return code scanning analyses for a specific branch reference.
	// The ref can be formatted as refs/heads/<branch name> or simply <branch name>. To reference a pull request use refs/pull/<number>/merge
	Ref *string `url:"ref,omitempty"`

	ListOptions
}

// CodeQLDatabase represents a metadata about the CodeQL database.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning
type CodeQLDatabase struct {
	ID          *int64     `json:"id,omitempty"`
	Name        *string    `json:"name,omitempty"`
	Language    *string    `json:"language,omitempty"`
	Uploader    *User      `json:"uploader,omitempty"`
	ContentType *string    `json:"content_type,omitempty"`
	Size        *int64     `json:"size,omitempty"`
	CreatedAt   *Timestamp `json:"created_at,omitempty"`
	UpdatedAt   *Timestamp `json:"updated_at,omitempty"`
	URL         *string    `json:"url,omitempty"`
}

// ScanningAnalysis represents an individual GitHub Code Scanning ScanningAnalysis on a single repository.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning
type ScanningAnalysis struct {
	ID           *int64     `json:"id,omitempty"`
	Ref          *string    `json:"ref,omitempty"`
	CommitSHA    *string    `json:"commit_sha,omitempty"`
	AnalysisKey  *string    `json:"analysis_key,omitempty"`
	Environment  *string    `json:"environment,omitempty"`
	Error        *string    `json:"error,omitempty"`
	Category     *string    `json:"category,omitempty"`
	CreatedAt    *Timestamp `json:"created_at,omitempty"`
	ResultsCount *int       `json:"results_count,omitempty"`
	RulesCount   *int       `json:"rules_count,omitempty"`
	URL          *string    `json:"url,omitempty"`
	SarifID      *string    `json:"sarif_id,omitempty"`
	Tool         *Tool      `json:"tool,omitempty"`
	Deletable    *bool      `json:"deletable,omitempty"`
	Warning      *string    `json:"warning,omitempty"`
}

// SarifAnalysis specifies the results of a code scanning job.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning
type SarifAnalysis struct {
	CommitSHA   *string    `json:"commit_sha,omitempty"`
	Ref         *string    `json:"ref,omitempty"`
	Sarif       *string    `json:"sarif,omitempty"`
	CheckoutURI *string    `json:"checkout_uri,omitempty"`
	StartedAt   *Timestamp `json:"started_at,omitempty"`
	ToolName    *string    `json:"tool_name,omitempty"`
}

// CodeScanningAlertState specifies the state of a code scanning alert.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning
type CodeScanningAlertState struct {
	// State sets the state of the code scanning alert and is a required field.
	// You must also provide DismissedReason when you set the state to "dismissed".
	// State can be one of: "open", "dismissed".
	State string `json:"state"`
	// DismissedReason represents the reason for dismissing or closing the alert.
	// It is required when the state is "dismissed".
	// It can be one of: "false positive", "won't fix", "used in tests".
	DismissedReason *string `json:"dismissed_reason,omitempty"`
	// DismissedComment is associated with the dismissal of the alert.
	DismissedComment *string `json:"dismissed_comment,omitempty"`
}

// SarifID identifies a sarif analysis upload.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning
type SarifID struct {
	ID  *string `json:"id,omitempty"`
	URL *string `json:"url,omitempty"`
}

// ListAlertsForOrg lists code scanning alerts for an org.
//
// You must use an access token with the security_events scope to use this endpoint. GitHub Apps must have the security_events
// read permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#list-code-scanning-alerts-for-an-organization
//
//meta:operation GET /orgs/{org}/code-scanning/alerts
func (s *CodeScanningService) ListAlertsForOrg(ctx context.Context, org string, opts *AlertListOptions) ([]*Alert, *Response, error) {
	u := fmt.Sprintf("orgs/%v/code-scanning/alerts", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var alerts []*Alert
	resp, err := s.client.Do(ctx, req, &alerts)
	if err != nil {
		return nil, resp, err
	}

	return alerts, resp, nil
}

// ListAlertsForRepo lists code scanning alerts for a repository.
//
// Lists all open code scanning alerts for the default branch (usually master) and protected branches in a repository.
// You must use an access token with the security_events scope to use this endpoint. GitHub Apps must have the security_events
// read permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#list-code-scanning-alerts-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/code-scanning/alerts
func (s *CodeScanningService) ListAlertsForRepo(ctx context.Context, owner, repo string, opts *AlertListOptions) ([]*Alert, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/alerts", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var alerts []*Alert
	resp, err := s.client.Do(ctx, req, &alerts)
	if err != nil {
		return nil, resp, err
	}

	return alerts, resp, nil
}

// GetAlert gets a single code scanning alert for a repository.
//
// You must use an access token with the security_events scope to use this endpoint.
// GitHub Apps must have the security_events read permission to use this endpoint.
//
// The security alert_id is the number at the end of the security alert's URL.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#get-a-code-scanning-alert
//
//meta:operation GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}
func (s *CodeScanningService) GetAlert(ctx context.Context, owner, repo string, id int64) (*Alert, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/alerts/%v", owner, repo, id)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	a := new(Alert)
	resp, err := s.client.Do(ctx, req, a)
	if err != nil {
		return nil, resp, err
	}

	return a, resp, nil
}

// UpdateAlert updates the state of a single code scanning alert for a repository.
//
// You must use an access token with the security_events scope to use this endpoint.
// GitHub Apps must have the security_events read permission to use this endpoint.
//
// The security alert_id is the number at the end of the security alert's URL.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#update-a-code-scanning-alert
//
//meta:operation PATCH /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}
func (s *CodeScanningService) UpdateAlert(ctx context.Context, owner, repo string, id int64, stateInfo *CodeScanningAlertState) (*Alert, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/alerts/%v", owner, repo, id)

	req, err := s.client.NewRequest("PATCH", u, stateInfo)
	if err != nil {
		return nil, nil, err
	}

	a := new(Alert)
	resp, err := s.client.Do(ctx, req, a)
	if err != nil {
		return nil, resp, err
	}

	return a, resp, nil
}

// ListAlertInstances lists instances of a code scanning alert.
//
// You must use an access token with the security_events scope to use this endpoint.
// GitHub Apps must have the security_events read permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#list-instances-of-a-code-scanning-alert
//
//meta:operation GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances
func (s *CodeScanningService) ListAlertInstances(ctx context.Context, owner, repo string, id int64, opts *AlertInstancesListOptions) ([]*MostRecentInstance, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/alerts/%v/instances", owner, repo, id)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var alertInstances []*MostRecentInstance
	resp, err := s.client.Do(ctx, req, &alertInstances)
	if err != nil {
		return nil, resp, err
	}

	return alertInstances, resp, nil
}

// UploadSarif uploads the result of code scanning job to GitHub.
//
// For the parameter sarif, you must first compress your SARIF file using gzip and then translate the contents of the file into a Base64 encoding string.
// You must use an access token with the security_events scope to use this endpoint. GitHub Apps must have the security_events
// write permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#upload-an-analysis-as-sarif-data
//
//meta:operation POST /repos/{owner}/{repo}/code-scanning/sarifs
func (s *CodeScanningService) UploadSarif(ctx context.Context, owner, repo string, sarif *SarifAnalysis) (*SarifID, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/sarifs", owner, repo)

	req, err := s.client.NewRequest("POST", u, sarif)
	if err != nil {
		return nil, nil, err
	}

	// This will always return an error without unmarshaling the data
	resp, err := s.client.Do(ctx, req, nil)
	// Even though there was an error, we still return the response
	// in case the caller wants to inspect it further.
	// However, if the error is AcceptedError, decode it below before
	// returning from this function and closing the response body.
	var acceptedError *AcceptedError
	if !errors.As(err, &acceptedError) {
		return nil, resp, err
	}
	sarifID := new(SarifID)
	decErr := json.Unmarshal(acceptedError.Raw, sarifID)
	if decErr != nil {
		return nil, resp, decErr
	}

	return sarifID, resp, nil
}

// SARIFUpload represents information about a SARIF upload.
type SARIFUpload struct {
	// `pending` files have not yet been processed, while `complete` means results from the SARIF have been stored.
	// `failed` files have either not been processed at all, or could only be partially processed.
	ProcessingStatus *string `json:"processing_status,omitempty"`
	// The REST API URL for getting the analyses associated with the upload.
	AnalysesURL *string `json:"analyses_url,omitempty"`
}

// GetSARIF gets information about a SARIF upload.
//
// You must use an access token with the security_events scope to use this endpoint.
// GitHub Apps must have the security_events read permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#get-information-about-a-sarif-upload
//
//meta:operation GET /repos/{owner}/{repo}/code-scanning/sarifs/{sarif_id}
func (s *CodeScanningService) GetSARIF(ctx context.Context, owner, repo, sarifID string) (*SARIFUpload, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/sarifs/%v", owner, repo, sarifID)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	sarifUpload := new(SARIFUpload)
	resp, err := s.client.Do(ctx, req, sarifUpload)
	if err != nil {
		return nil, resp, err
	}

	return sarifUpload, resp, nil
}

// ListAnalysesForRepo lists code scanning analyses for a repository.
//
// Lists the details of all code scanning analyses for a repository, starting with the most recent.
// You must use an access token with the security_events scope to use this endpoint.
// GitHub Apps must have the security_events read permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#list-code-scanning-analyses-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/code-scanning/analyses
func (s *CodeScanningService) ListAnalysesForRepo(ctx context.Context, owner, repo string, opts *AnalysesListOptions) ([]*ScanningAnalysis, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/analyses", owner, repo)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var analyses []*ScanningAnalysis
	resp, err := s.client.Do(ctx, req, &analyses)
	if err != nil {
		return nil, resp, err
	}

	return analyses, resp, nil
}

// GetAnalysis gets a single code scanning analysis for a repository.
//
// You must use an access token with the security_events scope to use this endpoint.
// GitHub Apps must have the security_events read permission to use this endpoint.
//
// The security analysis_id is the ID of the analysis, as returned from the ListAnalysesForRepo operation.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#get-a-code-scanning-analysis-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}
func (s *CodeScanningService) GetAnalysis(ctx context.Context, owner, repo string, id int64) (*ScanningAnalysis, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/analyses/%v", owner, repo, id)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	analysis := new(ScanningAnalysis)
	resp, err := s.client.Do(ctx, req, analysis)
	if err != nil {
		return nil, resp, err
	}

	return analysis, resp, nil
}

// DeleteAnalysis represents a successful deletion of a code scanning analysis.
type DeleteAnalysis struct {
	// Next deletable analysis in chain, without last analysis deletion confirmation
	NextAnalysisURL *string `json:"next_analysis_url,omitempty"`
	// Next deletable analysis in chain, with last analysis deletion confirmation
	ConfirmDeleteURL *string `json:"confirm_delete_url,omitempty"`
}

// DeleteAnalysis deletes a single code scanning analysis from a repository.
//
// You must use an access token with the repo scope to use this endpoint.
// GitHub Apps must have the security_events read permission to use this endpoint.
//
// The security analysis_id is the ID of the analysis, as returned from the ListAnalysesForRepo operation.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#delete-a-code-scanning-analysis-from-a-repository
//
//meta:operation DELETE /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}
func (s *CodeScanningService) DeleteAnalysis(ctx context.Context, owner, repo string, id int64) (*DeleteAnalysis, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/analyses/%v", owner, repo, id)

	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, nil, err
	}

	deleteAnalysis := new(DeleteAnalysis)
	resp, err := s.client.Do(ctx, req, deleteAnalysis)
	if err != nil {
		return nil, resp, err
	}

	return deleteAnalysis, resp, nil
}

// ListCodeQLDatabases lists the CodeQL databases that are available in a repository.
//
// You must use an access token with the security_events scope to use this endpoint.
// GitHub Apps must have the contents read permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#list-codeql-databases-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/code-scanning/codeql/databases
func (s *CodeScanningService) ListCodeQLDatabases(ctx context.Context, owner, repo string) ([]*CodeQLDatabase, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/codeql/databases", owner, repo)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var codeqlDatabases []*CodeQLDatabase
	resp, err := s.client.Do(ctx, req, &codeqlDatabases)
	if err != nil {
		return nil, resp, err
	}

	return codeqlDatabases, resp, nil
}

// GetCodeQLDatabase gets a CodeQL database for a language in a repository.
//
// You must use an access token with the security_events scope to use this endpoint.
// GitHub Apps must have the contents read permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#get-a-codeql-database-for-a-repository
//
//meta:operation GET /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}
func (s *CodeScanningService) GetCodeQLDatabase(ctx context.Context, owner, repo, language string) (*CodeQLDatabase, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/code-scanning/codeql/databases/%v", owner, repo, language)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	codeqlDatabase := new(CodeQLDatabase)
	resp, err := s.client.Do(ctx, req, codeqlDatabase)
	if err != nil {
		return nil, resp, err
	}

	return codeqlDatabase, resp, nil
}

// DefaultSetupConfiguration represents a code scanning default setup configuration.
type DefaultSetupConfiguration struct {
	State      *string    `json:"state,omitempty"`
	Languages  []string   `json:"languages,omitempty"`
	QuerySuite *string    `json:"query_suite,omitempty"`
	UpdatedAt  *Timestamp `json:"updated_at,omitempty"`
}

// GetDefaultSetupConfiguration gets a code scanning default setup configuration.
//
// You must use an access token with the repo scope to use this
// endpoint with private repos or the public_repo scope for public repos. GitHub Apps must have the repo write
// permission to use this endpoint.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#get-a-code-scanning-default-setup-configuration
//
//meta:operation GET /repos/{owner}/{repo}/code-scanning/default-setup
func (s *CodeScanningService) GetDefaultSetupConfiguration(ctx context.Context, owner, repo string) (*DefaultSetupConfiguration, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/code-scanning/default-setup", owner, repo)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	cfg := new(DefaultSetupConfiguration)
	resp, err := s.client.Do(ctx, req, cfg)
	if err != nil {
		return nil, resp, err
	}

	return cfg, resp, nil
}

// UpdateDefaultSetupConfigurationOptions specifies parameters to the CodeScanningService.UpdateDefaultSetupConfiguration
// method.
type UpdateDefaultSetupConfigurationOptions struct {
	State      string   `json:"state"`
	QuerySuite *string  `json:"query_suite,omitempty"`
	Languages  []string `json:"languages,omitempty"`
}

// UpdateDefaultSetupConfigurationResponse represents a response from updating a code scanning default setup configuration.
type UpdateDefaultSetupConfigurationResponse struct {
	RunID  *int64  `json:"run_id,omitempty"`
	RunURL *string `json:"run_url,omitempty"`
}

// UpdateDefaultSetupConfiguration updates a code scanning default setup configuration.
//
// You must use an access token with the repo scope to use this
// endpoint with private repos or the public_repo scope for public repos. GitHub Apps must have the repo write
// permission to use this endpoint.
//
// This method might return an AcceptedError and a status code of 202. This is because this is the status that GitHub
// returns to signify that it has now scheduled the update of the pull request branch in a background task.
//
// GitHub API docs: https://docs.github.com/rest/code-scanning/code-scanning#update-a-code-scanning-default-setup-configuration
//
//meta:operation PATCH /repos/{owner}/{repo}/code-scanning/default-setup
func (s *CodeScanningService) UpdateDefaultSetupConfiguration(ctx context.Context, owner, repo string, options *UpdateDefaultSetupConfigurationOptions) (*UpdateDefaultSetupConfigurationResponse, *Response, error) {
	u := fmt.Sprintf("repos/%s/%s/code-scanning/default-setup", owner, repo)

	req, err := s.client.NewRequest("PATCH", u, options)
	if err != nil {
		return nil, nil, err
	}

	a := new(UpdateDefaultSetupConfigurationResponse)
	resp, err := s.client.Do(ctx, req, a)
	if err != nil {
		return nil, resp, err
	}

	return a, resp, nil
}
