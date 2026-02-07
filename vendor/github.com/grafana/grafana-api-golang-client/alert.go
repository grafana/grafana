package gapi

import (
	"encoding/json"
	"fmt"
	"net/url"
)

// Alert represents a Grafana API Alert
type Alert struct {
	ID             int64  `json:"id,omitempty"`
	DashboardID    int64  `json:"dashboardId,omitempty"`
	DashboardUID   string `json:"dashboardUid,omitempty"`
	DashboardSlug  string `json:"dashboardSlug,omitempty"`
	PanelID        int64  `json:"panelId,omitempty"`
	Name           string `json:"name,omitempty"`
	State          string `json:"state,omitempty"`
	NewStateDate   string `json:"newStateDate,omitempty"`
	EvalDate       string `json:"evalDate,omitempty"`
	ExecutionError string `json:"executionError,omitempty"`
	URL            string `json:"url,omitempty"`
}

// PauseAlertRequest represents the request payload for a PauseAlert request.
type PauseAlertRequest struct {
	Paused bool `json:"paused"`
}

// PauseAlertResponse represents the response body for a PauseAlert request.
type PauseAlertResponse struct {
	AlertID int64  `json:"alertId,omitempty"`
	State   string `json:"state,omitempty"`
	Message string `json:"message,omitempty"`
}

// Alerts fetches the annotations queried with the params it's passed.
func (c *Client) Alerts(params url.Values) ([]Alert, error) {
	result := []Alert{}
	err := c.request("GET", "/api/alerts", params, nil, &result)
	if err != nil {
		return nil, err
	}

	return result, err
}

// Alert fetches and returns an individual Grafana alert.
func (c *Client) Alert(id int64) (Alert, error) {
	path := fmt.Sprintf("/api/alerts/%d", id)
	result := Alert{}
	err := c.request("GET", path, nil, nil, &result)
	if err != nil {
		return result, err
	}

	return result, err
}

// PauseAlert pauses the Grafana alert whose ID it's passed.
func (c *Client) PauseAlert(id int64) (PauseAlertResponse, error) {
	path := fmt.Sprintf("/api/alerts/%d", id)
	result := PauseAlertResponse{}
	data, err := json.Marshal(PauseAlertRequest{
		Paused: true,
	})
	if err != nil {
		return result, err
	}

	err = c.request("POST", path, nil, data, &result)
	if err != nil {
		return result, err
	}

	return result, err
}
