// Copyright 2017 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"fmt"
)

// Metric represents the different fields for one file in community health files.
type Metric struct {
	Name    *string `json:"name"`
	Key     *string `json:"key"`
	SPDXID  *string `json:"spdx_id"`
	URL     *string `json:"url"`
	HTMLURL *string `json:"html_url"`
	NodeID  *string `json:"node_id"`
}

// CommunityHealthFiles represents the different files in the community health metrics response.
type CommunityHealthFiles struct {
	CodeOfConduct       *Metric `json:"code_of_conduct"`
	CodeOfConductFile   *Metric `json:"code_of_conduct_file"`
	Contributing        *Metric `json:"contributing"`
	IssueTemplate       *Metric `json:"issue_template"`
	PullRequestTemplate *Metric `json:"pull_request_template"`
	License             *Metric `json:"license"`
	Readme              *Metric `json:"readme"`
}

// CommunityHealthMetrics represents a response containing the community metrics of a repository.
type CommunityHealthMetrics struct {
	HealthPercentage      *int                  `json:"health_percentage"`
	Description           *string               `json:"description"`
	Documentation         *string               `json:"documentation"`
	Files                 *CommunityHealthFiles `json:"files"`
	UpdatedAt             *Timestamp            `json:"updated_at"`
	ContentReportsEnabled *bool                 `json:"content_reports_enabled"`
}

// GetCommunityHealthMetrics retrieves all the community health  metrics for a  repository.
//
// GitHub API docs: https://docs.github.com/rest/metrics/community#get-community-profile-metrics
//
//meta:operation GET /repos/{owner}/{repo}/community/profile
func (s *RepositoriesService) GetCommunityHealthMetrics(ctx context.Context, owner, repo string) (*CommunityHealthMetrics, *Response, error) {
	u := fmt.Sprintf("repos/%v/%v/community/profile", owner, repo)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	metrics := &CommunityHealthMetrics{}
	resp, err := s.client.Do(ctx, req, metrics)
	if err != nil {
		return nil, resp, err
	}

	return metrics, resp, nil
}
