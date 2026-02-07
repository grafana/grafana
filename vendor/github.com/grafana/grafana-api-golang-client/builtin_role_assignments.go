package gapi

import (
	"encoding/json"
	"fmt"
)

const baseURL = "/api/access-control/builtin-roles"

type BuiltInRoleAssignment struct {
	BuiltinRole string `json:"builtInRole"`
	RoleUID     string `json:"roleUid"`
	Global      bool   `json:"global"`
}

// GetBuiltInRoleAssignments gets all built-in role assignments. Available only in Grafana Enterprise 8.+.
func (c *Client) GetBuiltInRoleAssignments() (map[string][]*Role, error) {
	br := make(map[string][]*Role)
	err := c.request("GET", baseURL, nil, nil, &br)
	if err != nil {
		return nil, err
	}
	return br, nil
}

// NewBuiltInRoleAssignment creates a new built-in role assignment. Available only in Grafana Enterprise 8.+.
func (c *Client) NewBuiltInRoleAssignment(builtInRoleAssignment BuiltInRoleAssignment) (*BuiltInRoleAssignment, error) {
	body, err := json.Marshal(builtInRoleAssignment)
	if err != nil {
		return nil, err
	}

	br := &BuiltInRoleAssignment{}

	err = c.request("POST", baseURL, nil, body, &br)
	if err != nil {
		return nil, err
	}

	return br, err
}

// DeleteBuiltInRoleAssignment remove the built-in role assignments. Available only in Grafana Enterprise 8.+.
func (c *Client) DeleteBuiltInRoleAssignment(builtInRole BuiltInRoleAssignment) error {
	data, err := json.Marshal(builtInRole)
	if err != nil {
		return err
	}

	qp := map[string][]string{
		"global": {fmt.Sprint(builtInRole.Global)},
	}
	url := fmt.Sprintf("%s/%s/roles/%s", baseURL, builtInRole.BuiltinRole, builtInRole.RoleUID)
	err = c.request("DELETE", url, qp, data, nil)

	return err
}
