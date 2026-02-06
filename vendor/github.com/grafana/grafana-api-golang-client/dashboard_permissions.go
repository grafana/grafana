package gapi

import (
	"encoding/json"
	"fmt"
)

// DashboardPermission has information such as a dashboard, user, team, role and permission.
type DashboardPermission struct {
	DashboardID  int64  `json:"dashboardId"`
	DashboardUID string `json:"uid"`
	UserID       int64  `json:"userId"`
	TeamID       int64  `json:"teamId"`
	Role         string `json:"role"`
	IsFolder     bool   `json:"isFolder"`
	Inherited    bool   `json:"inherited"`

	// Permission levels are
	// 1 = View
	// 2 = Edit
	// 4 = Admin
	Permission     int64  `json:"permission"`
	PermissionName string `json:"permissionName"`
}

// DashboardPermissions fetches and returns the permissions for the dashboard whose ID it's passed.
func (c *Client) DashboardPermissions(id int64) ([]*DashboardPermission, error) {
	permissions := make([]*DashboardPermission, 0)
	err := c.request("GET", fmt.Sprintf("/api/dashboards/id/%d/permissions", id), nil, nil, &permissions)
	return permissions, err
}

// UpdateDashboardPermissions remove existing permissions if items are not included in the request.
func (c *Client) UpdateDashboardPermissions(id int64, items *PermissionItems) error {
	path := fmt.Sprintf("/api/dashboards/id/%d/permissions", id)
	data, err := json.Marshal(items)
	if err != nil {
		return err
	}

	return c.request("POST", path, nil, data, nil)
}

// DashboardPermissionsByUID fetches and returns the permissions for the dashboard whose UID it's passed.
func (c *Client) DashboardPermissionsByUID(uid string) ([]*DashboardPermission, error) {
	permissions := make([]*DashboardPermission, 0)
	err := c.request("GET", fmt.Sprintf("/api/dashboards/uid/%s/permissions", uid), nil, nil, &permissions)
	return permissions, err
}

// UpdateDashboardPermissionsByUID remove existing permissions if items are not included in the request.
func (c *Client) UpdateDashboardPermissionsByUID(uid string, items *PermissionItems) error {
	path := fmt.Sprintf("/api/dashboards/uid/%s/permissions", uid)
	data, err := json.Marshal(items)
	if err != nil {
		return err
	}

	return c.request("POST", path, nil, data, nil)
}

func (c *Client) ListDashboardResourcePermissions(uid string) ([]*ResourcePermission, error) {
	return c.listResourcePermissions(DashboardsResource, ResourceUID(uid))
}

func (c *Client) SetDashboardResourcePermissions(uid string, body SetResourcePermissionsBody) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissions(DashboardsResource, ResourceUID(uid), body)
}

func (c *Client) SetUserDashboardResourcePermissions(dashboardUID string, userID int64, permission string) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissionByAssignment(
		DashboardsResource,
		ResourceUID(dashboardUID),
		UsersResource,
		ResourceID(userID),
		SetResourcePermissionBody{
			Permission: SetResourcePermissionItem{
				UserID:     userID,
				Permission: permission,
			},
		},
	)
}

func (c *Client) SetTeamDashboardResourcePermissions(dashboardUID string, teamID int64, permission string) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissionByAssignment(
		DashboardsResource,
		ResourceUID(dashboardUID),
		TeamsResource,
		ResourceID(teamID),
		SetResourcePermissionBody{
			Permission: SetResourcePermissionItem{
				TeamID:     teamID,
				Permission: permission,
			},
		},
	)
}

func (c *Client) SetBuiltInRoleDashboardResourcePermissions(dashboardUID string, builtInRole string, permission string) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissionByAssignment(
		DashboardsResource,
		ResourceUID(dashboardUID),
		BuiltInRolesResource,
		ResourceUID(builtInRole),
		SetResourcePermissionBody{
			Permission: SetResourcePermissionItem{
				BuiltinRole: builtInRole,
				Permission:  permission,
			},
		},
	)
}
