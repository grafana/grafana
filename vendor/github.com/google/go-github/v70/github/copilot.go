// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// CopilotService provides access to the Copilot-related functions
// in the GitHub API.
//
// GitHub API docs: https://docs.github.com/en/rest/copilot/
type CopilotService service

// CopilotOrganizationDetails represents the details of an organization's Copilot for Business subscription.
type CopilotOrganizationDetails struct {
	SeatBreakdown         *CopilotSeatBreakdown `json:"seat_breakdown"`
	PublicCodeSuggestions string                `json:"public_code_suggestions"`
	CopilotChat           string                `json:"copilot_chat"`
	SeatManagementSetting string                `json:"seat_management_setting"`
}

// CopilotSeatBreakdown represents the breakdown of Copilot for Business seats for the organization.
type CopilotSeatBreakdown struct {
	Total               int `json:"total"`
	AddedThisCycle      int `json:"added_this_cycle"`
	PendingCancellation int `json:"pending_cancellation"`
	PendingInvitation   int `json:"pending_invitation"`
	ActiveThisCycle     int `json:"active_this_cycle"`
	InactiveThisCycle   int `json:"inactive_this_cycle"`
}

// ListCopilotSeatsResponse represents the Copilot for Business seat assignments for an organization.
type ListCopilotSeatsResponse struct {
	TotalSeats int64                 `json:"total_seats"`
	Seats      []*CopilotSeatDetails `json:"seats"`
}

// CopilotSeatDetails represents the details of a Copilot for Business seat.
type CopilotSeatDetails struct {
	// Assignee can either be a User, Team, or Organization.
	Assignee                interface{} `json:"assignee"`
	AssigningTeam           *Team       `json:"assigning_team,omitempty"`
	PendingCancellationDate *string     `json:"pending_cancellation_date,omitempty"`
	LastActivityAt          *Timestamp  `json:"last_activity_at,omitempty"`
	LastActivityEditor      *string     `json:"last_activity_editor,omitempty"`
	CreatedAt               *Timestamp  `json:"created_at"`
	UpdatedAt               *Timestamp  `json:"updated_at,omitempty"`
	PlanType                *string     `json:"plan_type,omitempty"`
}

// SeatAssignments represents the number of seats assigned.
type SeatAssignments struct {
	SeatsCreated int `json:"seats_created"`
}

// SeatCancellations represents the number of seats cancelled.
type SeatCancellations struct {
	SeatsCancelled int `json:"seats_cancelled"`
}

// CopilotMetricsListOptions represents the optional parameters to the CopilotService get metrics methods.
type CopilotMetricsListOptions struct {
	Since *time.Time `url:"since,omitempty"`
	Until *time.Time `url:"until,omitempty"`

	ListOptions
}

// CopilotIDECodeCompletionsLanguage represents Copilot usage metrics for completions in the IDE for a language.
type CopilotIDECodeCompletionsLanguage struct {
	Name              string `json:"name"`
	TotalEngagedUsers int    `json:"total_engaged_users"`
}

// CopilotIDECodeCompletionsModelLanguage represents Copilot usage metrics for completions in the IDE for a model and language.
type CopilotIDECodeCompletionsModelLanguage struct {
	Name                    string `json:"name"`
	TotalEngagedUsers       int    `json:"total_engaged_users"`
	TotalCodeSuggestions    int    `json:"total_code_suggestions"`
	TotalCodeAcceptances    int    `json:"total_code_acceptances"`
	TotalCodeLinesSuggested int    `json:"total_code_lines_suggested"`
	TotalCodeLinesAccepted  int    `json:"total_code_lines_accepted"`
}

// CopilotIDECodeCompletionsModel represents Copilot usage metrics for completions in the IDE for a model.
type CopilotIDECodeCompletionsModel struct {
	Name                    string                                    `json:"name"`
	IsCustomModel           bool                                      `json:"is_custom_model"`
	CustomModelTrainingDate *string                                   `json:"custom_model_training_date,omitempty"`
	TotalEngagedUsers       int                                       `json:"total_engaged_users"`
	Languages               []*CopilotIDECodeCompletionsModelLanguage `json:"languages"`
}

// CopilotIDECodeCompletionsEditor represents Copilot usage metrics for completions in the IDE for an editor.
type CopilotIDECodeCompletionsEditor struct {
	Name              string                            `json:"name"`
	TotalEngagedUsers int                               `json:"total_engaged_users"`
	Models            []*CopilotIDECodeCompletionsModel `json:"models"`
}

// CopilotIDECodeCompletions represents Copilot usage metrics for Copilot code completions in the IDE, categorized by editor, model and language.
type CopilotIDECodeCompletions struct {
	TotalEngagedUsers int                                  `json:"total_engaged_users"`
	Languages         []*CopilotIDECodeCompletionsLanguage `json:"languages"`
	Editors           []*CopilotIDECodeCompletionsEditor   `json:"editors"`
}

// CopilotIDEChatModel represents Copilot usage metrics for chatting with a model in the IDE.
type CopilotIDEChatModel struct {
	Name                     string  `json:"name"`
	IsCustomModel            bool    `json:"is_custom_model"`
	CustomModelTrainingDate  *string `json:"custom_model_training_date,omitempty"`
	TotalEngagedUsers        int     `json:"total_engaged_users"`
	TotalChats               int     `json:"total_chats"`
	TotalChatInsertionEvents int     `json:"total_chat_insertion_events"`
	TotalChatCopyEvents      int     `json:"total_chat_copy_events"`
}

// CopilotIDEChatEditor represents Copilot usage metrics for chatting with a model in the IDE, categorized by editor and model.
type CopilotIDEChatEditor struct {
	Name              string                 `json:"name"`
	TotalEngagedUsers int                    `json:"total_engaged_users"`
	Models            []*CopilotIDEChatModel `json:"models"`
}

// CopilotIDEChat represents Copilot usage metrics for Copilot Chat in the IDE, categorized by editor and model.
type CopilotIDEChat struct {
	TotalEngagedUsers int                     `json:"total_engaged_users"`
	Editors           []*CopilotIDEChatEditor `json:"editors"`
}

// CopilotDotcomChatModel represents Copilot usage metrics for chatting with a model in the webbrowser.
type CopilotDotcomChatModel struct {
	Name                    string  `json:"name"`
	IsCustomModel           bool    `json:"is_custom_model"`
	CustomModelTrainingDate *string `json:"custom_model_training_date,omitempty"`
	TotalEngagedUsers       int     `json:"total_engaged_users"`
	TotalChats              int     `json:"total_chats"`
}

// CopilotDotcomChat represents Copilot usage metrics for Copilot Chat in the webbrowser, categorized by model.
type CopilotDotcomChat struct {
	TotalEngagedUsers int                       `json:"total_engaged_users"`
	Models            []*CopilotDotcomChatModel `json:"models"`
}

// CopilotDotcomPullRequestsModel represents Copilot usage metrics for pull requests in the webbrowser, categorized by model.
type CopilotDotcomPullRequestsModel struct {
	Name                    string  `json:"name"`
	IsCustomModel           bool    `json:"is_custom_model"`
	CustomModelTrainingDate *string `json:"custom_model_training_date,omitempty"`
	TotalPRSummariesCreated int     `json:"total_pr_summaries_created"`
	TotalEngagedUsers       int     `json:"total_engaged_users"`
}

// CopilotDotcomPullRequestsRepository represents Copilot usage metrics for pull requests in the webbrowser, categorized by repository.
type CopilotDotcomPullRequestsRepository struct {
	Name              string                            `json:"name"`
	TotalEngagedUsers int                               `json:"total_engaged_users"`
	Models            []*CopilotDotcomPullRequestsModel `json:"models"`
}

// CopilotDotcomPullRequests represents Copilot usage metrics for pull requests in the webbrowser, categorized by repository and model.
type CopilotDotcomPullRequests struct {
	TotalEngagedUsers int                                    `json:"total_engaged_users"`
	Repositories      []*CopilotDotcomPullRequestsRepository `json:"repositories"`
}

// CopilotMetrics represents Copilot usage metrics for a given day.
type CopilotMetrics struct {
	Date                      string                     `json:"date"`
	TotalActiveUsers          *int                       `json:"total_active_users,omitempty"`
	TotalEngagedUsers         *int                       `json:"total_engaged_users,omitempty"`
	CopilotIDECodeCompletions *CopilotIDECodeCompletions `json:"copilot_ide_code_completions,omitempty"`
	CopilotIDEChat            *CopilotIDEChat            `json:"copilot_ide_chat,omitempty"`
	CopilotDotcomChat         *CopilotDotcomChat         `json:"copilot_dotcom_chat,omitempty"`
	CopilotDotcomPullRequests *CopilotDotcomPullRequests `json:"copilot_dotcom_pull_requests,omitempty"`
}

func (cp *CopilotSeatDetails) UnmarshalJSON(data []byte) error {
	// Using an alias to avoid infinite recursion when calling json.Unmarshal
	type alias CopilotSeatDetails
	var seatDetail alias

	if err := json.Unmarshal(data, &seatDetail); err != nil {
		return err
	}

	cp.AssigningTeam = seatDetail.AssigningTeam
	cp.PendingCancellationDate = seatDetail.PendingCancellationDate
	cp.LastActivityAt = seatDetail.LastActivityAt
	cp.LastActivityEditor = seatDetail.LastActivityEditor
	cp.CreatedAt = seatDetail.CreatedAt
	cp.UpdatedAt = seatDetail.UpdatedAt
	cp.PlanType = seatDetail.PlanType

	switch v := seatDetail.Assignee.(type) {
	case map[string]interface{}:
		jsonData, err := json.Marshal(seatDetail.Assignee)
		if err != nil {
			return err
		}

		if v["type"] == nil {
			return errors.New("assignee type field is not set")
		}

		if t, ok := v["type"].(string); ok && t == "User" {
			user := &User{}
			if err := json.Unmarshal(jsonData, user); err != nil {
				return err
			}
			cp.Assignee = user
		} else if t, ok := v["type"].(string); ok && t == "Team" {
			team := &Team{}
			if err := json.Unmarshal(jsonData, team); err != nil {
				return err
			}
			cp.Assignee = team
		} else if t, ok := v["type"].(string); ok && t == "Organization" {
			organization := &Organization{}
			if err := json.Unmarshal(jsonData, organization); err != nil {
				return err
			}
			cp.Assignee = organization
		} else {
			return fmt.Errorf("unsupported assignee type %v", v["type"])
		}
	default:
		return fmt.Errorf("unsupported assignee type %T", v)
	}

	return nil
}

// GetUser gets the User from the CopilotSeatDetails if the assignee is a user.
func (cp *CopilotSeatDetails) GetUser() (*User, bool) { u, ok := cp.Assignee.(*User); return u, ok }

// GetTeam gets the Team from the CopilotSeatDetails if the assignee is a team.
func (cp *CopilotSeatDetails) GetTeam() (*Team, bool) { t, ok := cp.Assignee.(*Team); return t, ok }

// GetOrganization gets the Organization from the CopilotSeatDetails if the assignee is an organization.
func (cp *CopilotSeatDetails) GetOrganization() (*Organization, bool) {
	o, ok := cp.Assignee.(*Organization)
	return o, ok
}

// GetCopilotBilling gets Copilot for Business billing information and settings for an organization.
//
// GitHub API docs: https://docs.github.com/rest/copilot/copilot-user-management#get-copilot-seat-information-and-settings-for-an-organization
//
//meta:operation GET /orgs/{org}/copilot/billing
func (s *CopilotService) GetCopilotBilling(ctx context.Context, org string) (*CopilotOrganizationDetails, *Response, error) {
	u := fmt.Sprintf("orgs/%v/copilot/billing", org)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var copilotDetails *CopilotOrganizationDetails
	resp, err := s.client.Do(ctx, req, &copilotDetails)
	if err != nil {
		return nil, resp, err
	}

	return copilotDetails, resp, nil
}

// ListCopilotSeats lists Copilot for Business seat assignments for an organization.
//
// To paginate through all seats, populate 'Page' with the number of the last page.
//
// GitHub API docs: https://docs.github.com/rest/copilot/copilot-user-management#list-all-copilot-seat-assignments-for-an-organization
//
//meta:operation GET /orgs/{org}/copilot/billing/seats
func (s *CopilotService) ListCopilotSeats(ctx context.Context, org string, opts *ListOptions) (*ListCopilotSeatsResponse, *Response, error) {
	u := fmt.Sprintf("orgs/%v/copilot/billing/seats", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var copilotSeats *ListCopilotSeatsResponse
	resp, err := s.client.Do(ctx, req, &copilotSeats)
	if err != nil {
		return nil, resp, err
	}

	return copilotSeats, resp, nil
}

// ListCopilotEnterpriseSeats lists Copilot for Business seat assignments for an enterprise.
//
// To paginate through all seats, populate 'Page' with the number of the last page.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/copilot/copilot-user-management#list-all-copilot-seat-assignments-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/copilot/billing/seats
func (s *CopilotService) ListCopilotEnterpriseSeats(ctx context.Context, enterprise string, opts *ListOptions) (*ListCopilotSeatsResponse, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/copilot/billing/seats", enterprise)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var copilotSeats *ListCopilotSeatsResponse
	resp, err := s.client.Do(ctx, req, &copilotSeats)
	if err != nil {
		return nil, resp, err
	}

	return copilotSeats, resp, nil
}

// AddCopilotTeams adds teams to the Copilot for Business subscription for an organization.
//
// GitHub API docs: https://docs.github.com/rest/copilot/copilot-user-management#add-teams-to-the-copilot-subscription-for-an-organization
//
//meta:operation POST /orgs/{org}/copilot/billing/selected_teams
func (s *CopilotService) AddCopilotTeams(ctx context.Context, org string, teamNames []string) (*SeatAssignments, *Response, error) {
	u := fmt.Sprintf("orgs/%v/copilot/billing/selected_teams", org)

	body := struct {
		SelectedTeams []string `json:"selected_teams"`
	}{
		SelectedTeams: teamNames,
	}

	req, err := s.client.NewRequest("POST", u, body)
	if err != nil {
		return nil, nil, err
	}

	var seatAssignments *SeatAssignments
	resp, err := s.client.Do(ctx, req, &seatAssignments)
	if err != nil {
		return nil, resp, err
	}

	return seatAssignments, resp, nil
}

// RemoveCopilotTeams removes teams from the Copilot for Business subscription for an organization.
//
// GitHub API docs: https://docs.github.com/rest/copilot/copilot-user-management#remove-teams-from-the-copilot-subscription-for-an-organization
//
//meta:operation DELETE /orgs/{org}/copilot/billing/selected_teams
func (s *CopilotService) RemoveCopilotTeams(ctx context.Context, org string, teamNames []string) (*SeatCancellations, *Response, error) {
	u := fmt.Sprintf("orgs/%v/copilot/billing/selected_teams", org)

	body := struct {
		SelectedTeams []string `json:"selected_teams"`
	}{
		SelectedTeams: teamNames,
	}

	req, err := s.client.NewRequest("DELETE", u, body)
	if err != nil {
		return nil, nil, err
	}

	var seatCancellations *SeatCancellations
	resp, err := s.client.Do(ctx, req, &seatCancellations)
	if err != nil {
		return nil, resp, err
	}

	return seatCancellations, resp, nil
}

// AddCopilotUsers adds users to the Copilot for Business subscription for an organization
//
// GitHub API docs: https://docs.github.com/rest/copilot/copilot-user-management#add-users-to-the-copilot-subscription-for-an-organization
//
//meta:operation POST /orgs/{org}/copilot/billing/selected_users
func (s *CopilotService) AddCopilotUsers(ctx context.Context, org string, users []string) (*SeatAssignments, *Response, error) {
	u := fmt.Sprintf("orgs/%v/copilot/billing/selected_users", org)

	body := struct {
		SelectedUsernames []string `json:"selected_usernames"`
	}{
		SelectedUsernames: users,
	}

	req, err := s.client.NewRequest("POST", u, body)
	if err != nil {
		return nil, nil, err
	}

	var seatAssignments *SeatAssignments
	resp, err := s.client.Do(ctx, req, &seatAssignments)
	if err != nil {
		return nil, resp, err
	}

	return seatAssignments, resp, nil
}

// RemoveCopilotUsers removes users from the Copilot for Business subscription for an organization.
//
// GitHub API docs: https://docs.github.com/rest/copilot/copilot-user-management#remove-users-from-the-copilot-subscription-for-an-organization
//
//meta:operation DELETE /orgs/{org}/copilot/billing/selected_users
func (s *CopilotService) RemoveCopilotUsers(ctx context.Context, org string, users []string) (*SeatCancellations, *Response, error) {
	u := fmt.Sprintf("orgs/%v/copilot/billing/selected_users", org)

	body := struct {
		SelectedUsernames []string `json:"selected_usernames"`
	}{
		SelectedUsernames: users,
	}

	req, err := s.client.NewRequest("DELETE", u, body)
	if err != nil {
		return nil, nil, err
	}

	var seatCancellations *SeatCancellations
	resp, err := s.client.Do(ctx, req, &seatCancellations)
	if err != nil {
		return nil, resp, err
	}

	return seatCancellations, resp, nil
}

// GetSeatDetails gets Copilot for Business seat assignment details for a user.
//
// GitHub API docs: https://docs.github.com/rest/copilot/copilot-user-management#get-copilot-seat-assignment-details-for-a-user
//
//meta:operation GET /orgs/{org}/members/{username}/copilot
func (s *CopilotService) GetSeatDetails(ctx context.Context, org, user string) (*CopilotSeatDetails, *Response, error) {
	u := fmt.Sprintf("orgs/%v/members/%v/copilot", org, user)

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var seatDetails *CopilotSeatDetails
	resp, err := s.client.Do(ctx, req, &seatDetails)
	if err != nil {
		return nil, resp, err
	}

	return seatDetails, resp, nil
}

// GetEnterpriseMetrics gets Copilot usage metrics for an enterprise.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/copilot/copilot-metrics#get-copilot-metrics-for-an-enterprise
//
//meta:operation GET /enterprises/{enterprise}/copilot/metrics
func (s *CopilotService) GetEnterpriseMetrics(ctx context.Context, enterprise string, opts *CopilotMetricsListOptions) ([]*CopilotMetrics, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/copilot/metrics", enterprise)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var metrics []*CopilotMetrics
	resp, err := s.client.Do(ctx, req, &metrics)
	if err != nil {
		return nil, resp, err
	}

	return metrics, resp, nil
}

// GetEnterpriseTeamMetrics gets Copilot usage metrics for an enterprise team.
//
// GitHub API docs: https://docs.github.com/enterprise-cloud@latest/rest/copilot/copilot-metrics#get-copilot-metrics-for-an-enterprise-team
//
//meta:operation GET /enterprises/{enterprise}/team/{team_slug}/copilot/metrics
func (s *CopilotService) GetEnterpriseTeamMetrics(ctx context.Context, enterprise, team string, opts *CopilotMetricsListOptions) ([]*CopilotMetrics, *Response, error) {
	u := fmt.Sprintf("enterprises/%v/team/%v/copilot/metrics", enterprise, team)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var metrics []*CopilotMetrics
	resp, err := s.client.Do(ctx, req, &metrics)
	if err != nil {
		return nil, resp, err
	}

	return metrics, resp, nil
}

// GetOrganizationMetrics gets Copilot usage metrics for an organization.
//
// GitHub API docs: https://docs.github.com/rest/copilot/copilot-metrics#get-copilot-metrics-for-an-organization
//
//meta:operation GET /orgs/{org}/copilot/metrics
func (s *CopilotService) GetOrganizationMetrics(ctx context.Context, org string, opts *CopilotMetricsListOptions) ([]*CopilotMetrics, *Response, error) {
	u := fmt.Sprintf("orgs/%v/copilot/metrics", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var metrics []*CopilotMetrics
	resp, err := s.client.Do(ctx, req, &metrics)
	if err != nil {
		return nil, resp, err
	}

	return metrics, resp, nil
}

// GetOrganizationTeamMetrics gets Copilot usage metrics for an organization team.
//
// GitHub API docs: https://docs.github.com/rest/copilot/copilot-metrics#get-copilot-metrics-for-a-team
//
//meta:operation GET /orgs/{org}/team/{team_slug}/copilot/metrics
func (s *CopilotService) GetOrganizationTeamMetrics(ctx context.Context, org, team string, opts *CopilotMetricsListOptions) ([]*CopilotMetrics, *Response, error) {
	u := fmt.Sprintf("orgs/%v/team/%v/copilot/metrics", org, team)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var metrics []*CopilotMetrics
	resp, err := s.client.Do(ctx, req, &metrics)
	if err != nil {
		return nil, resp, err
	}

	return metrics, resp, nil
}
