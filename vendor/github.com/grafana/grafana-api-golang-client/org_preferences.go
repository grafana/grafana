package gapi

import (
	"encoding/json"
)

// UpdateOrgPreferencesResponse represents the response to a request
// updating Grafana org preferences.
type UpdateOrgPreferencesResponse struct {
	Message string `json:"message"`
}

// OrgPreferences fetches org preferences.
func (c *Client) OrgPreferences() (Preferences, error) {
	var prefs Preferences
	err := c.request("GET", "/api/org/preferences", nil, nil, &prefs)
	return prefs, err
}

// UpdateOrgPreferences updates only those org preferences specified in the passed Preferences, without impacting others.
func (c *Client) UpdateOrgPreferences(p Preferences) (UpdateOrgPreferencesResponse, error) {
	var resp UpdateOrgPreferencesResponse
	data, err := json.Marshal(p)
	if err != nil {
		return resp, err
	}

	err = c.request("PATCH", "/api/org/preferences", nil, data, &resp)
	if err != nil {
		return resp, err
	}

	return resp, err
}

// UpdateAllOrgPreferences overrwrites all org preferences with the passed Preferences.
func (c *Client) UpdateAllOrgPreferences(p Preferences) (UpdateOrgPreferencesResponse, error) {
	var resp UpdateOrgPreferencesResponse
	data, err := json.Marshal(p)
	if err != nil {
		return resp, err
	}

	err = c.request("PUT", "/api/org/preferences", nil, data, &resp)
	if err != nil {
		return resp, err
	}

	return resp, err
}
