package gapi

import (
	"encoding/json"
	"fmt"
	"net/url"
)

type Role struct {
	Version     int64        `json:"version"`
	UID         string       `json:"uid,omitempty"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Global      bool         `json:"global"`
	Group       string       `json:"group"`
	DisplayName string       `json:"displayName"`
	Hidden      bool         `json:"hidden"`
	Permissions []Permission `json:"permissions,omitempty"`
}

type Permission struct {
	Action string `json:"action"`
	Scope  string `json:"scope"`
}

// GetRole fetches and returns Grafana roles. Available only in Grafana Enterprise 8.+.
func (c *Client) GetRoles() ([]Role, error) {
	const limit = 1000
	var (
		page     = 0
		newRoles []Role
		roles    []Role
		query    = make(url.Values)
	)
	query.Set("limit", fmt.Sprint(limit))
	for {
		page++
		query.Set("page", fmt.Sprint(page))

		if err := c.request("GET", "/api/access-control/roles", query, nil, &newRoles); err != nil {
			return nil, err
		}

		roles = append(roles, newRoles...)

		if len(newRoles) < limit {
			return roles, nil
		}
	}
}

// GetRole gets a role with permissions for the given UID. Available only in Grafana Enterprise 8.+.
func (c *Client) GetRole(uid string) (*Role, error) {
	r := &Role{}
	err := c.request("GET", buildURL(uid), nil, nil, r)
	if err != nil {
		return nil, err
	}
	return r, nil
}

// NewRole creates a new role with permissions. Available only in Grafana Enterprise 8.+.
func (c *Client) NewRole(role Role) (*Role, error) {
	data, err := json.Marshal(role)
	if err != nil {
		return nil, err
	}

	r := &Role{}

	err = c.request("POST", "/api/access-control/roles", nil, data, &r)
	if err != nil {
		return nil, err
	}

	return r, err
}

// UpdateRole updates the role and permissions. Available only in Grafana Enterprise 8.+.
func (c *Client) UpdateRole(role Role) error {
	data, err := json.Marshal(role)
	if err != nil {
		return err
	}

	err = c.request("PUT", buildURL(role.UID), nil, data, nil)

	return err
}

// DeleteRole deletes the role with it's permissions. Available only in Grafana Enterprise 8.+.
func (c *Client) DeleteRole(uid string, global bool) error {
	qp := map[string][]string{
		"global": {fmt.Sprint(global)},
	}
	return c.request("DELETE", buildURL(uid), qp, nil, nil)
}

func buildURL(uid string) string {
	const rootURL = "/api/access-control/roles"
	return fmt.Sprintf("%s/%s", rootURL, uid)
}
