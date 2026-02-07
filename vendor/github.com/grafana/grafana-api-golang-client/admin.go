package gapi

import (
	"encoding/json"
	"fmt"
)

// PauseAllAlertsResponse represents the response body for a PauseAllAlerts request.
type PauseAllAlertsResponse struct {
	AlertsAffected int64  `json:"alertsAffected,omitempty"`
	State          string `json:"state,omitempty"`
	Message        string `json:"message,omitempty"`
}

// CreateUser creates a Grafana user.
func (c *Client) CreateUser(user User) (int64, error) {
	id := int64(0)
	data, err := json.Marshal(user)
	if err != nil {
		return id, err
	}

	created := struct {
		ID int64 `json:"id"`
	}{}

	err = c.request("POST", "/api/admin/users", nil, data, &created)
	if err != nil {
		return id, err
	}

	return created.ID, err
}

// DeleteUser deletes a Grafana user.
func (c *Client) DeleteUser(id int64) error {
	return c.request("DELETE", fmt.Sprintf("/api/admin/users/%d", id), nil, nil, nil)
}

// UpdateUserPassword updates a user password.
func (c *Client) UpdateUserPassword(id int64, password string) error {
	body := map[string]string{"password": password}
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}
	return c.request("PUT", fmt.Sprintf("/api/admin/users/%d/password", id), nil, data, nil)
}

// UpdateUserPermissions sets a user's admin status.
func (c *Client) UpdateUserPermissions(id int64, isAdmin bool) error {
	body := map[string]bool{"isGrafanaAdmin": isAdmin}
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}
	return c.request("PUT", fmt.Sprintf("/api/admin/users/%d/permissions", id), nil, data, nil)
}

// PauseAllAlerts pauses all Grafana alerts.
func (c *Client) PauseAllAlerts() (PauseAllAlertsResponse, error) {
	result := PauseAllAlertsResponse{}
	data, err := json.Marshal(PauseAlertRequest{
		Paused: true,
	})
	if err != nil {
		return result, err
	}

	err = c.request("POST", "/api/admin/pause-all-alerts", nil, data, &result)

	return result, err
}
