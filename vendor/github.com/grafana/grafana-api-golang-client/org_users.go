package gapi

import (
	"encoding/json"
	"fmt"
)

// OrgUser represents a Grafana org user.
type OrgUser struct {
	OrgID  int64  `json:"orgId"`
	UserID int64  `json:"userId"`
	Email  string `json:"email"`
	Login  string `json:"login"`
	Role   string `json:"role"`
}

// OrgUsersCurrent returns all org users within the current organization.
// This endpoint is accessible to users with org admin role.
func (c *Client) OrgUsersCurrent() ([]OrgUser, error) {
	users := make([]OrgUser, 0)
	err := c.request("GET", "/api/org/users", nil, nil, &users)
	if err != nil {
		return nil, err
	}
	return users, err
}

// OrgUsers fetches and returns the users for the org whose ID it's passed.
func (c *Client) OrgUsers(orgID int64) ([]OrgUser, error) {
	users := make([]OrgUser, 0)
	err := c.request("GET", fmt.Sprintf("/api/orgs/%d/users", orgID), nil, nil, &users)
	if err != nil {
		return users, err
	}

	return users, err
}

// AddOrgUser adds a user to an org with the specified role.
func (c *Client) AddOrgUser(orgID int64, user, role string) error {
	dataMap := map[string]string{
		"loginOrEmail": user,
		"role":         role,
	}
	data, err := json.Marshal(dataMap)
	if err != nil {
		return err
	}

	return c.request("POST", fmt.Sprintf("/api/orgs/%d/users", orgID), nil, data, nil)
}

// UpdateOrgUser updates and org user.
func (c *Client) UpdateOrgUser(orgID, userID int64, role string) error {
	dataMap := map[string]string{
		"role": role,
	}
	data, err := json.Marshal(dataMap)
	if err != nil {
		return err
	}

	return c.request("PATCH", fmt.Sprintf("/api/orgs/%d/users/%d", orgID, userID), nil, data, nil)
}

// RemoveOrgUser removes a user from an org.
func (c *Client) RemoveOrgUser(orgID, userID int64) error {
	return c.request("DELETE", fmt.Sprintf("/api/orgs/%d/users/%d", orgID, userID), nil, nil, nil)
}
