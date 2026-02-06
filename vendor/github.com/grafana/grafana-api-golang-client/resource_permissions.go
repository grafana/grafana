package gapi

import (
	"encoding/json"
	"fmt"
)

type ResourcePermission struct {
	ID               int64    `json:"id"`
	RoleName         string   `json:"roleName"`
	IsManaged        bool     `json:"isManaged"`
	IsInherited      bool     `json:"isInherited"`
	IsServiceAccount bool     `json:"isServiceAccount"`
	UserID           int64    `json:"userId,omitempty"`
	UserLogin        string   `json:"userLogin,omitempty"`
	Team             string   `json:"team,omitempty"`
	TeamID           int64    `json:"teamId,omitempty"`
	BuiltInRole      string   `json:"builtInRole,omitempty"`
	Actions          []string `json:"actions"`
	Permission       string   `json:"permission"`
}

type SetResourcePermissionsBody struct {
	Permissions []SetResourcePermissionItem `json:"permissions"`
}

type SetResourcePermissionBody struct {
	Permission SetResourcePermissionItem `json:"permission"`
}

type SetResourcePermissionItem struct {
	UserID      int64  `json:"userId,omitempty"`
	TeamID      int64  `json:"teamId,omitempty"`
	BuiltinRole string `json:"builtInRole,omitempty"`
	Permission  string `json:"permission"`
}

type SetResourcePermissionsResponse struct {
	Message string `json:"message"`
}

func (c *Client) listResourcePermissions(resource string, ident ResourceIdent) ([]*ResourcePermission, error) {
	path := fmt.Sprintf("/api/access-control/%s/%s", resource, ident.String())
	result := make([]*ResourcePermission, 0)
	if err := c.request("GET", path, nil, nil, &result); err != nil {
		return nil, fmt.Errorf("error getting %s resource permissions at %s: %w", resource, path, err)
	}
	return result, nil
}

func (c *Client) setResourcePermissions(resource string, ident ResourceIdent, body SetResourcePermissionsBody) (*SetResourcePermissionsResponse, error) {
	path := fmt.Sprintf("/api/access-control/%s/%s", resource, ident.String())
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal err: %w", err)
	}

	result := SetResourcePermissionsResponse{}
	if err := c.request("POST", path, nil, data, &result); err != nil {
		return nil, fmt.Errorf("error setting %s resource permissions at %s: %w", resource, path, err)
	}
	return &result, nil
}

func (c *Client) setResourcePermissionByAssignment(
	resource string,
	ident ResourceIdent,
	assignmentKind string,
	assignmentIdent ResourceIdent,
	body SetResourcePermissionBody,
) (*SetResourcePermissionsResponse, error) {
	path := fmt.Sprintf("/api/access-control/%s/%s/%s/%s", resource, ident.String(), assignmentKind, assignmentIdent.String())
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal err: %w", err)
	}

	result := SetResourcePermissionsResponse{}
	if err := c.request("POST", path, nil, data, &result); err != nil {
		return nil, fmt.Errorf("error setting %s resource permissions for %s at %s: %w", resource, assignmentKind, path, err)
	}
	return &result, nil
}
