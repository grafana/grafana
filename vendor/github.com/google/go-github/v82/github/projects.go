// Copyright 2025 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
	"encoding/json"
	"fmt"
)

// ProjectsService handles communication with the project V2
// methods of the GitHub API.
//
// GitHub API docs: https://docs.github.com/rest/projects/projects
type ProjectsService service

// ProjectV2ItemContentType represents the type of content in a ProjectV2Item.
type ProjectV2ItemContentType string

// This is the set of possible content types for a ProjectV2Item.
const (
	ProjectV2ItemContentTypeDraftIssue  ProjectV2ItemContentType = "DraftIssue"
	ProjectV2ItemContentTypeIssue       ProjectV2ItemContentType = "Issue"
	ProjectV2ItemContentTypePullRequest ProjectV2ItemContentType = "PullRequest"
)

// ProjectV2StatusUpdate represents a status update for a project.
type ProjectV2StatusUpdate struct {
	ID            *int64     `json:"id,omitempty"`
	NodeID        *string    `json:"node_id,omitempty"`
	ProjectNodeID *string    `json:"project_node_id,omitempty"`
	Creator       *User      `json:"creator,omitempty"`
	CreatedAt     *Timestamp `json:"created_at,omitempty"`
	UpdatedAt     *Timestamp `json:"updated_at,omitempty"`
	// Status can be one of: "INACTIVE", "ON_TRACK", "AT_RISK", "OFF_TRACK", "COMPLETE".
	Status     *string `json:"status,omitempty"`
	StartDate  *string `json:"start_date,omitempty"`
	TargetDate *string `json:"target_date,omitempty"`
	Body       *string `json:"body,omitempty"`
}

// ProjectV2DraftIssue represents a draft issue in a project.
type ProjectV2DraftIssue struct {
	ID        *int64     `json:"id,omitempty"`
	NodeID    *string    `json:"node_id,omitempty"`
	Title     *string    `json:"title,omitempty"`
	Body      *string    `json:"body,omitempty"`
	User      *User      `json:"user,omitempty"`
	CreatedAt *Timestamp `json:"created_at,omitempty"`
	UpdatedAt *Timestamp `json:"updated_at,omitempty"`
}

// ProjectV2 represents a v2 project.
type ProjectV2 struct {
	ID                 *int64                 `json:"id,omitempty"`
	NodeID             *string                `json:"node_id,omitempty"`
	Owner              *User                  `json:"owner,omitempty"`
	Creator            *User                  `json:"creator,omitempty"`
	Title              *string                `json:"title,omitempty"`
	Description        *string                `json:"description,omitempty"`
	Public             *bool                  `json:"public,omitempty"`
	ClosedAt           *Timestamp             `json:"closed_at,omitempty"`
	CreatedAt          *Timestamp             `json:"created_at,omitempty"`
	UpdatedAt          *Timestamp             `json:"updated_at,omitempty"`
	DeletedAt          *Timestamp             `json:"deleted_at,omitempty"`
	Number             *int                   `json:"number,omitempty"`
	ShortDescription   *string                `json:"short_description,omitempty"`
	DeletedBy          *User                  `json:"deleted_by,omitempty"`
	State              *string                `json:"state,omitempty"`
	LatestStatusUpdate *ProjectV2StatusUpdate `json:"latest_status_update,omitempty"`
	IsTemplate         *bool                  `json:"is_template,omitempty"`

	// Fields migrated from the Project (classic) struct:
	URL                    *string `json:"url,omitempty"`
	HTMLURL                *string `json:"html_url,omitempty"`
	ColumnsURL             *string `json:"columns_url,omitempty"`
	OwnerURL               *string `json:"owner_url,omitempty"`
	Name                   *string `json:"name,omitempty"`
	Body                   *string `json:"body,omitempty"`
	OrganizationPermission *string `json:"organization_permission,omitempty"`
	Private                *bool   `json:"private,omitempty"`
}

func (p ProjectV2) String() string { return Stringify(p) }

// ListProjectsPaginationOptions specifies optional parameters to list projects for user / organization.
//
// Note: Pagination is powered by before/after cursor-style pagination. After the initial call,
// inspect the returned *Response. Use resp.After as the opts.After value to request
// the next page, and resp.Before as the opts.Before value to request the previous
// page. Set either Before or After for a request; if both are
// supplied GitHub API will return an error. PerPage controls the number of items
// per page (max 100 per GitHub API docs).
type ListProjectsPaginationOptions struct {
	// A cursor, as given in the Link header. If specified, the query only searches for events before this cursor.
	Before *string `url:"before,omitempty"`

	// A cursor, as given in the Link header. If specified, the query only searches for events after this cursor.
	After *string `url:"after,omitempty"`

	// For paginated result sets, the number of results to include per page.
	PerPage *int `url:"per_page,omitempty"`
}

// ListProjectsOptions specifies optional parameters to list projects for user / organization.
type ListProjectsOptions struct {
	ListProjectsPaginationOptions

	// Q is an optional query string to limit results to projects of the specified type.
	Query *string `url:"q,omitempty"`
}

// ProjectV2TextContent represents text content in a project field option or iteration.
// It includes both HTML and raw text representations.
//
// GitHub API docs: https://docs.github.com/rest/projects/fields
type ProjectV2TextContent struct {
	HTML *string `json:"html,omitempty"`
	Raw  *string `json:"raw,omitempty"`
}

// ProjectV2FieldOption represents an option for a project field of type single_select or multi_select.
// It defines the available choices that can be selected for dropdown-style fields.
//
// GitHub API docs: https://docs.github.com/rest/projects/fields
type ProjectV2FieldOption struct {
	ID          *string               `json:"id,omitempty"`          // The unique identifier for this option.
	Color       *string               `json:"color,omitempty"`       // The color associated with this option (e.g., "blue", "red").
	Description *ProjectV2TextContent `json:"description,omitempty"` // An optional description for this option.
	Name        *ProjectV2TextContent `json:"name,omitempty"`        // The display name of the option.
}

// ProjectV2FieldIteration represents an iteration within a project field of type iteration.
// It defines a specific time-bound period that can be associated with project items.
//
// GitHub API docs: https://docs.github.com/rest/projects/fields
type ProjectV2FieldIteration struct {
	ID        *string               `json:"id,omitempty"`         // The unique identifier for the iteration.
	Title     *ProjectV2TextContent `json:"title,omitempty"`      // The title of the iteration.
	StartDate *string               `json:"start_date,omitempty"` // The start date of the iteration in ISO 8601 format.
	Duration  *int                  `json:"duration,omitempty"`   // The duration of the iteration in seconds.
}

// ProjectV2FieldConfiguration represents the configuration for a project field of type iteration.
// It defines settings such as duration and start day for iterations within the project.
//
// GitHub API docs: https://docs.github.com/rest/projects/fields
type ProjectV2FieldConfiguration struct {
	Duration   *int                       `json:"duration,omitempty"`   // The duration of the iteration field in seconds.
	StartDay   *int                       `json:"start_day,omitempty"`  // The start day for the iteration.
	Iterations []*ProjectV2FieldIteration `json:"iterations,omitempty"` // The list of iterations associated with the configuration.
}

// ProjectV2ItemContent is a union type that holds the content of a ProjectV2Item.
// The actual type depends on the ContentType field of the parent ProjectV2Item.
// Only one of the fields will be populated after unmarshaling.
type ProjectV2ItemContent struct {
	Issue       *Issue               `json:"-"`
	PullRequest *PullRequest         `json:"-"`
	DraftIssue  *ProjectV2DraftIssue `json:"-"`
}

// MarshalJSON implements custom marshaling for ProjectV2ItemContent.
func (c *ProjectV2ItemContent) MarshalJSON() ([]byte, error) {
	if c.Issue != nil {
		return json.Marshal(c.Issue)
	}
	if c.PullRequest != nil {
		return json.Marshal(c.PullRequest)
	}
	if c.DraftIssue != nil {
		return json.Marshal(c.DraftIssue)
	}
	return []byte("null"), nil
}

// ProjectV2Item represents a full project item with field values.
// This type is used by Get, List, and Update operations which return field values.
// The Content field is automatically unmarshaled into the appropriate type based on ContentType.
type ProjectV2Item struct {
	ArchivedAt  *Timestamp                 `json:"archived_at,omitempty"`
	Content     *ProjectV2ItemContent      `json:"content,omitempty"`
	ContentType *ProjectV2ItemContentType  `json:"content_type,omitempty"`
	CreatedAt   *Timestamp                 `json:"created_at,omitempty"`
	Creator     *User                      `json:"creator,omitempty"`
	Fields      []*ProjectV2ItemFieldValue `json:"fields,omitempty"`
	ID          *int64                     `json:"id,omitempty"`
	ItemURL     *string                    `json:"item_url,omitempty"`
	NodeID      *string                    `json:"node_id,omitempty"`
	ProjectURL  *string                    `json:"project_url,omitempty"`
	UpdatedAt   *Timestamp                 `json:"updated_at,omitempty"`

	// ProjectNodeID and ContentNodeID are used in ProjectsV2Item Webhook payloads.
	// They may not be populated in all API responses, but are included here for completeness.
	// See: https://docs.github.com/en/webhooks/webhook-events-and-payloads#projects_v2_item
	ProjectNodeID *string `json:"project_node_id,omitempty"`
	ContentNodeID *string `json:"content_node_id,omitempty"`
}

// UnmarshalJSON implements custom unmarshaling for ProjectV2Item.
// It uses the ContentType field to determine how to unmarshal the Content field.
func (p *ProjectV2Item) UnmarshalJSON(data []byte) error {
	type contentAlias ProjectV2Item

	aux := &struct {
		Content json.RawMessage `json:"content,omitempty"`
		*contentAlias
	}{
		contentAlias: (*contentAlias)(p),
	}

	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}

	// Now unmarshal the content based on ContentType
	if len(aux.Content) > 0 && string(aux.Content) != "null" && p.ContentType != nil {
		p.Content = &ProjectV2ItemContent{}
		switch *p.ContentType {
		case ProjectV2ItemContentTypeIssue:
			p.Content.Issue = &Issue{}
			return json.Unmarshal(aux.Content, p.Content.Issue)
		case ProjectV2ItemContentTypePullRequest:
			p.Content.PullRequest = &PullRequest{}
			return json.Unmarshal(aux.Content, p.Content.PullRequest)
		case ProjectV2ItemContentTypeDraftIssue:
			p.Content.DraftIssue = &ProjectV2DraftIssue{}
			return json.Unmarshal(aux.Content, p.Content.DraftIssue)
		}
	}

	return nil
}

// ProjectV2Field represents a field in a GitHub Projects V2 project.
// Fields define the structure and data types for project items.
//
// GitHub API docs: https://docs.github.com/rest/projects/fields
type ProjectV2Field struct {
	ID            *int64                       `json:"id,omitempty"`
	NodeID        *string                      `json:"node_id,omitempty"`
	Name          *string                      `json:"name,omitempty"`
	DataType      *string                      `json:"data_type,omitempty"`
	ProjectURL    *string                      `json:"project_url,omitempty"`
	Options       []*ProjectV2FieldOption      `json:"options,omitempty"`
	Configuration *ProjectV2FieldConfiguration `json:"configuration,omitempty"`
	CreatedAt     *Timestamp                   `json:"created_at,omitempty"`
	UpdatedAt     *Timestamp                   `json:"updated_at,omitempty"`
}

// ProjectV2ItemFieldValue represents a field value of a project item.
type ProjectV2ItemFieldValue struct {
	ID       *int64  `json:"id,omitempty"`
	Name     *string `json:"name,omitempty"`
	DataType *string `json:"data_type,omitempty"`
	// Value set for the field. The type depends on the field type:
	//   - text: string
	//   - number: float64
	//   - date: string (ISO 8601 date format, e.g. "2023-06-23") or null
	//   - single_select: object with "id", "name", "color", "description" fields or null
	//   - iteration: object with "id", "title", "start_date", "duration" fields or null
	//   - title: object with "text" field (read-only, reflects the item's title) or null
	//   - assignees: array of user objects with "login", "id", etc. or null
	//   - labels: array of label objects with "id", "name", "color", etc. or null
	//   - linked_pull_requests: array of pull request objects or null
	//   - milestone: milestone object with "id", "title", "description", etc. or null
	//   - repository: repository object with "id", "name", "full_name", etc. or null
	//   - reviewers: array of user objects or null
	//   - status: object with "id", "name", "color", "description" fields (same structure as single_select) or null
	Value any `json:"value,omitempty"`
}

// ListOrganizationProjects lists Projects V2 for an organization.
//
// GitHub API docs: https://docs.github.com/rest/projects/projects#list-projects-for-organization
//
//meta:operation GET /orgs/{org}/projectsV2
func (s *ProjectsService) ListOrganizationProjects(ctx context.Context, org string, opts *ListProjectsOptions) ([]*ProjectV2, *Response, error) {
	u := fmt.Sprintf("orgs/%v/projectsV2", org)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var projects []*ProjectV2
	resp, err := s.client.Do(ctx, req, &projects)
	if err != nil {
		return nil, resp, err
	}
	return projects, resp, nil
}

// GetOrganizationProject gets a Projects V2 project for an organization by ID.
//
// GitHub API docs: https://docs.github.com/rest/projects/projects#get-project-for-organization
//
//meta:operation GET /orgs/{org}/projectsV2/{project_number}
func (s *ProjectsService) GetOrganizationProject(ctx context.Context, org string, projectNumber int) (*ProjectV2, *Response, error) {
	u := fmt.Sprintf("orgs/%v/projectsV2/%v", org, projectNumber)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	project := new(ProjectV2)
	resp, err := s.client.Do(ctx, req, project)
	if err != nil {
		return nil, resp, err
	}
	return project, resp, nil
}

// ListUserProjects lists Projects V2 for a user.
//
// GitHub API docs: https://docs.github.com/rest/projects/projects#list-projects-for-user
//
//meta:operation GET /users/{username}/projectsV2
func (s *ProjectsService) ListUserProjects(ctx context.Context, username string, opts *ListProjectsOptions) ([]*ProjectV2, *Response, error) {
	u := fmt.Sprintf("users/%v/projectsV2", username)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var projects []*ProjectV2
	resp, err := s.client.Do(ctx, req, &projects)
	if err != nil {
		return nil, resp, err
	}
	return projects, resp, nil
}

// GetUserProject gets a Projects V2 project for a user by ID.
//
// GitHub API docs: https://docs.github.com/rest/projects/projects#get-project-for-user
//
//meta:operation GET /users/{username}/projectsV2/{project_number}
func (s *ProjectsService) GetUserProject(ctx context.Context, username string, projectNumber int) (*ProjectV2, *Response, error) {
	u := fmt.Sprintf("users/%v/projectsV2/%v", username, projectNumber)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	project := new(ProjectV2)
	resp, err := s.client.Do(ctx, req, project)
	if err != nil {
		return nil, resp, err
	}
	return project, resp, nil
}

// ListOrganizationProjectFields lists Projects V2 for an organization.
//
// GitHub API docs: https://docs.github.com/rest/projects/fields#list-project-fields-for-organization
//
//meta:operation GET /orgs/{org}/projectsV2/{project_number}/fields
func (s *ProjectsService) ListOrganizationProjectFields(ctx context.Context, org string, projectNumber int, opts *ListProjectsOptions) ([]*ProjectV2Field, *Response, error) {
	u := fmt.Sprintf("orgs/%v/projectsV2/%v/fields", org, projectNumber)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var fields []*ProjectV2Field
	resp, err := s.client.Do(ctx, req, &fields)
	if err != nil {
		return nil, resp, err
	}
	return fields, resp, nil
}

// ListUserProjectFields lists Projects V2 for a user.
//
// GitHub API docs: https://docs.github.com/rest/projects/fields#list-project-fields-for-user
//
//meta:operation GET /users/{username}/projectsV2/{project_number}/fields
func (s *ProjectsService) ListUserProjectFields(ctx context.Context, user string, projectNumber int, opts *ListProjectsOptions) ([]*ProjectV2Field, *Response, error) {
	u := fmt.Sprintf("users/%v/projectsV2/%v/fields", user, projectNumber)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var fields []*ProjectV2Field
	resp, err := s.client.Do(ctx, req, &fields)
	if err != nil {
		return nil, resp, err
	}
	return fields, resp, nil
}

// GetOrganizationProjectField gets a single project field from an organization owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/fields#get-project-field-for-organization
//
//meta:operation GET /orgs/{org}/projectsV2/{project_number}/fields/{field_id}
func (s *ProjectsService) GetOrganizationProjectField(ctx context.Context, org string, projectNumber int, fieldID int64) (*ProjectV2Field, *Response, error) {
	u := fmt.Sprintf("orgs/%v/projectsV2/%v/fields/%v", org, projectNumber, fieldID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	field := new(ProjectV2Field)
	resp, err := s.client.Do(ctx, req, field)
	if err != nil {
		return nil, resp, err
	}
	return field, resp, nil
}

// GetUserProjectField gets a single project field from a user owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/fields#get-project-field-for-user
//
//meta:operation GET /users/{username}/projectsV2/{project_number}/fields/{field_id}
func (s *ProjectsService) GetUserProjectField(ctx context.Context, user string, projectNumber int, fieldID int64) (*ProjectV2Field, *Response, error) {
	u := fmt.Sprintf("users/%v/projectsV2/%v/fields/%v", user, projectNumber, fieldID)
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	field := new(ProjectV2Field)
	resp, err := s.client.Do(ctx, req, field)
	if err != nil {
		return nil, resp, err
	}
	return field, resp, nil
}

// ListProjectItemsOptions specifies optional parameters when listing project items.
// Note: Pagination uses before/after cursor-style pagination similar to ListProjectsOptions.
// "Fields" can be used to restrict which field values are returned (by their numeric IDs).
type ListProjectItemsOptions struct {
	// Embed ListProjectsOptions to reuse pagination and query parameters.
	ListProjectsOptions
	// Fields restricts which field values are returned by numeric field IDs.
	Fields []int64 `url:"fields,omitempty,comma"`
}

// GetProjectItemOptions specifies optional parameters when getting a project item.
type GetProjectItemOptions struct {
	// Fields restricts which field values are returned by numeric field IDs.
	Fields []int64 `url:"fields,omitempty,comma"`
}

// AddProjectItemOptions represents the payload to add an item (issue or pull request)
// to a project. The Type must be either "Issue" or "PullRequest" (as per API docs) and
// ID is the numerical ID of that issue or pull request.
type AddProjectItemOptions struct {
	Type *ProjectV2ItemContentType `json:"type,omitempty"`
	ID   *int64                    `json:"id,omitempty"`
}

// UpdateProjectV2Field represents a field update for a project item.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#update-project-item-for-organization
type UpdateProjectV2Field struct {
	// ID is the field ID to update.
	ID int64 `json:"id"`
	// Value is the new value to set for the field. The type depends on the field type.
	// For text fields: string
	// For number fields: float64 or int
	// For single_select fields: string (option ID)
	// For date fields: string (ISO 8601 date)
	// For iteration fields: string (iteration ID)
	// Note: Some field types (title, assignees, labels, etc.) are read-only or managed through other API endpoints.
	Value any `json:"value"`
}

// UpdateProjectItemOptions represents fields that can be modified for a project item.
// The GitHub API expects either archived status updates or field value updates.
type UpdateProjectItemOptions struct {
	// Archived indicates whether the item should be archived (true) or unarchived (false).
	// This is used for archive/unarchive operations.
	Archived *bool `json:"archived,omitempty"`
	// Fields contains field updates to apply to the project item.
	// Each entry specifies a field ID and its new value.
	Fields []*UpdateProjectV2Field `json:"fields,omitempty"`
}

// ListOrganizationProjectItems lists items for an organization owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#list-items-for-an-organization-owned-project
//
//meta:operation GET /orgs/{org}/projectsV2/{project_number}/items
func (s *ProjectsService) ListOrganizationProjectItems(ctx context.Context, org string, projectNumber int, opts *ListProjectItemsOptions) ([]*ProjectV2Item, *Response, error) {
	u := fmt.Sprintf("orgs/%v/projectsV2/%v/items", org, projectNumber)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}

	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}

	var items []*ProjectV2Item
	resp, err := s.client.Do(ctx, req, &items)
	if err != nil {
		return nil, resp, err
	}
	return items, resp, nil
}

// AddOrganizationProjectItem adds an issue or pull request item to an organization owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#add-item-to-organization-owned-project
//
//meta:operation POST /orgs/{org}/projectsV2/{project_number}/items
func (s *ProjectsService) AddOrganizationProjectItem(ctx context.Context, org string, projectNumber int, opts *AddProjectItemOptions) (*ProjectV2Item, *Response, error) {
	u := fmt.Sprintf("orgs/%v/projectsV2/%v/items", org, projectNumber)
	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}

	item := new(ProjectV2Item)
	resp, err := s.client.Do(ctx, req, item)
	if err != nil {
		return nil, resp, err
	}
	return item, resp, nil
}

// GetOrganizationProjectItem gets a single item from an organization owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#get-an-item-for-an-organization-owned-project
//
//meta:operation GET /orgs/{org}/projectsV2/{project_number}/items/{item_id}
func (s *ProjectsService) GetOrganizationProjectItem(ctx context.Context, org string, projectNumber int, itemID int64, opts *GetProjectItemOptions) (*ProjectV2Item, *Response, error) {
	u := fmt.Sprintf("orgs/%v/projectsV2/%v/items/%v", org, projectNumber, itemID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}
	item := new(ProjectV2Item)
	resp, err := s.client.Do(ctx, req, item)
	if err != nil {
		return nil, resp, err
	}
	return item, resp, nil
}

// UpdateOrganizationProjectItem updates an item in an organization owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#update-project-item-for-organization
//
//meta:operation PATCH /orgs/{org}/projectsV2/{project_number}/items/{item_id}
func (s *ProjectsService) UpdateOrganizationProjectItem(ctx context.Context, org string, projectNumber int, itemID int64, opts *UpdateProjectItemOptions) (*ProjectV2Item, *Response, error) {
	u := fmt.Sprintf("orgs/%v/projectsV2/%v/items/%v", org, projectNumber, itemID)
	req, err := s.client.NewRequest("PATCH", u, opts)
	if err != nil {
		return nil, nil, err
	}
	item := new(ProjectV2Item)
	resp, err := s.client.Do(ctx, req, item)
	if err != nil {
		return nil, resp, err
	}
	return item, resp, nil
}

// DeleteOrganizationProjectItem deletes an item from an organization owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#delete-project-item-for-organization
//
//meta:operation DELETE /orgs/{org}/projectsV2/{project_number}/items/{item_id}
func (s *ProjectsService) DeleteOrganizationProjectItem(ctx context.Context, org string, projectNumber int, itemID int64) (*Response, error) {
	u := fmt.Sprintf("orgs/%v/projectsV2/%v/items/%v", org, projectNumber, itemID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}
	return s.client.Do(ctx, req, nil)
}

// ListUserProjectItems lists items for a user owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#list-items-for-a-user-owned-project
//
//meta:operation GET /users/{username}/projectsV2/{project_number}/items
func (s *ProjectsService) ListUserProjectItems(ctx context.Context, username string, projectNumber int, opts *ListProjectItemsOptions) ([]*ProjectV2Item, *Response, error) {
	u := fmt.Sprintf("users/%v/projectsV2/%v/items", username, projectNumber)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}
	var items []*ProjectV2Item
	resp, err := s.client.Do(ctx, req, &items)
	if err != nil {
		return nil, resp, err
	}
	return items, resp, nil
}

// AddUserProjectItem adds an issue or pull request item to a user owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#add-item-to-user-owned-project
//
//meta:operation POST /users/{username}/projectsV2/{project_number}/items
func (s *ProjectsService) AddUserProjectItem(ctx context.Context, username string, projectNumber int, opts *AddProjectItemOptions) (*ProjectV2Item, *Response, error) {
	u := fmt.Sprintf("users/%v/projectsV2/%v/items", username, projectNumber)
	req, err := s.client.NewRequest("POST", u, opts)
	if err != nil {
		return nil, nil, err
	}
	item := new(ProjectV2Item)
	resp, err := s.client.Do(ctx, req, item)
	if err != nil {
		return nil, resp, err
	}
	return item, resp, nil
}

// GetUserProjectItem gets a single item from a user owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#get-an-item-for-a-user-owned-project
//
//meta:operation GET /users/{username}/projectsV2/{project_number}/items/{item_id}
func (s *ProjectsService) GetUserProjectItem(ctx context.Context, username string, projectNumber int, itemID int64, opts *GetProjectItemOptions) (*ProjectV2Item, *Response, error) {
	u := fmt.Sprintf("users/%v/projectsV2/%v/items/%v", username, projectNumber, itemID)
	u, err := addOptions(u, opts)
	if err != nil {
		return nil, nil, err
	}
	req, err := s.client.NewRequest("GET", u, nil)
	if err != nil {
		return nil, nil, err
	}
	item := new(ProjectV2Item)
	resp, err := s.client.Do(ctx, req, item)
	if err != nil {
		return nil, resp, err
	}
	return item, resp, nil
}

// UpdateUserProjectItem updates an item in a user owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#update-project-item-for-user
//
//meta:operation PATCH /users/{username}/projectsV2/{project_number}/items/{item_id}
func (s *ProjectsService) UpdateUserProjectItem(ctx context.Context, username string, projectNumber int, itemID int64, opts *UpdateProjectItemOptions) (*ProjectV2Item, *Response, error) {
	u := fmt.Sprintf("users/%v/projectsV2/%v/items/%v", username, projectNumber, itemID)
	req, err := s.client.NewRequest("PATCH", u, opts)
	if err != nil {
		return nil, nil, err
	}
	item := new(ProjectV2Item)
	resp, err := s.client.Do(ctx, req, item)
	if err != nil {
		return nil, resp, err
	}
	return item, resp, nil
}

// DeleteUserProjectItem deletes an item from a user owned project.
//
// GitHub API docs: https://docs.github.com/rest/projects/items#delete-project-item-for-user
//
//meta:operation DELETE /users/{username}/projectsV2/{project_number}/items/{item_id}
func (s *ProjectsService) DeleteUserProjectItem(ctx context.Context, username string, projectNumber int, itemID int64) (*Response, error) {
	u := fmt.Sprintf("users/%v/projectsV2/%v/items/%v", username, projectNumber, itemID)
	req, err := s.client.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}
	return s.client.Do(ctx, req, nil)
}
