package gapi

import (
	"encoding/json"
	"fmt"
	"time"
)

// PublicDashboardPayload represents a public dashboard payload.
type PublicDashboardPayload struct {
	UID                  string `json:"uid"`
	AccessToken          string `json:"accessToken"`
	TimeSelectionEnabled bool   `json:"timeSelectionEnabled"`
	IsEnabled            bool   `json:"isEnabled"`
	AnnotationsEnabled   bool   `json:"annotationsEnabled"`
	Share                string `json:"share"`
}

// PublicDashboard represents a public dashboard.
type PublicDashboard struct {
	UID                  string    `json:"uid"`
	DashboardUID         string    `json:"dashboardUid"`
	AccessToken          string    `json:"accessToken"`
	TimeSelectionEnabled bool      `json:"timeSelectionEnabled"`
	IsEnabled            bool      `json:"isEnabled"`
	AnnotationsEnabled   bool      `json:"annotationsEnabled"`
	Share                string    `json:"share"`
	CreatedBy            int64     `json:"createdBy"`
	UpdatedBy            int64     `json:"updatedBy"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

type PublicDashboardListResponseWithPagination struct {
	PublicDashboards []*PublicDashboardListResponse `json:"publicDashboards"`
	TotalCount       int64                          `json:"totalCount"`
	Page             int                            `json:"page"`
	PerPage          int                            `json:"perPage"`
}

type PublicDashboardListResponse struct {
	UID          string `json:"uid"`
	AccessToken  string `json:"accessToken"`
	Title        string `json:"title"`
	DashboardUID string `json:"dashboardUid"`
	IsEnabled    bool   `json:"isEnabled"`
}

// NewPublicDashboard creates a new Grafana public dashboard.
func (c *Client) NewPublicDashboard(dashboardUID string, publicDashboard PublicDashboardPayload) (*PublicDashboard, error) {
	data, err := json.Marshal(publicDashboard)
	if err != nil {
		return nil, err
	}

	result := &PublicDashboard{}
	err = c.request("POST", fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards", dashboardUID), nil, data, &result)
	if err != nil {
		return nil, err
	}

	return result, err
}

// DeletePublicDashboard deletes a Grafana public dashboard.
func (c *Client) DeletePublicDashboard(dashboardUID string, publicDashboardUID string) error {
	return c.request("DELETE", fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards/%s", dashboardUID, publicDashboardUID), nil, nil, nil)
}

// PublicDashboards fetches and returns the Grafana public dashboards.
func (c *Client) PublicDashboards() (*PublicDashboardListResponseWithPagination, error) {
	publicdashboards := &PublicDashboardListResponseWithPagination{}
	err := c.request("GET", "/api/dashboards/public-dashboards", nil, nil, &publicdashboards)
	if err != nil {
		return publicdashboards, err
	}

	return publicdashboards, err
}

// PublicDashboardbyUID fetches and returns a Grafana public dashboard by uid.
func (c *Client) PublicDashboardbyUID(dashboardUID string) (*PublicDashboard, error) {
	publicDashboard := &PublicDashboard{}
	err := c.request("GET", fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards", dashboardUID), nil, nil, &publicDashboard)
	if err != nil {
		return publicDashboard, err
	}

	return publicDashboard, err
}

// UpdatePublicDashboard updates a Grafana public dashboard.
func (c *Client) UpdatePublicDashboard(dashboardUID string, publicDashboardUID string, publicDashboard PublicDashboardPayload) (*PublicDashboard, error) {
	data, err := json.Marshal(publicDashboard)
	if err != nil {
		return nil, err
	}

	result := &PublicDashboard{}
	err = c.request("PATCH", fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards/%s", dashboardUID, publicDashboardUID), nil, data, &result)
	if err != nil {
		return nil, err
	}

	return result, err
}
