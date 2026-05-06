package gapi

import (
	"encoding/json"
	"fmt"
)

// FolderPermission has information such as a folder, user, team, role and permission.
type FolderPermission struct {
	ID        int64  `json:"id"`
	FolderUID string `json:"uid"`
	UserID    int64  `json:"userId"`
	TeamID    int64  `json:"teamId"`
	Role      string `json:"role"`
	IsFolder  bool   `json:"isFolder"`

	// Permission levels are
	// 1 = View
	// 2 = Edit
	// 4 = Admin
	Permission     int64  `json:"permission"`
	PermissionName string `json:"permissionName"`

	// optional fields
	FolderID    int64 `json:"folderId,omitempty"`
	DashboardID int64 `json:"dashboardId,omitempty"`
}

// PermissionItems represents Grafana folder permission items.
type PermissionItems struct {
	Items []*PermissionItem `json:"items"`
}

// PermissionItem represents a Grafana folder permission item.
type PermissionItem struct {
	// As you can see the docs, each item has a pair of [Role|TeamID|UserID] and Permission.
	// unnecessary fields are omitted.
	Role       string `json:"role,omitempty"`
	TeamID     int64  `json:"teamId,omitempty"`
	UserID     int64  `json:"userId,omitempty"`
	Permission int64  `json:"permission"`
}

// FolderPermissions fetches and returns the permissions for the folder whose ID it's passed.
func (c *Client) FolderPermissions(fid string) ([]*FolderPermission, error) {
	permissions := make([]*FolderPermission, 0)
	err := c.request("GET", fmt.Sprintf("/api/folders/%s/permissions", fid), nil, nil, &permissions)
	if err != nil {
		return permissions, err
	}

	return permissions, nil
}

// UpdateFolderPermissions remove existing permissions if items are not included in the request.
func (c *Client) UpdateFolderPermissions(fid string, items *PermissionItems) error {
	path := fmt.Sprintf("/api/folders/%s/permissions", fid)
	data, err := json.Marshal(items)
	if err != nil {
		return err
	}

	return c.request("POST", path, nil, data, nil)
}

func (c *Client) ListFolderResourcePermissions(uid string) ([]*ResourcePermission, error) {
	return c.listResourcePermissions(FoldersResource, ResourceUID(uid))
}

func (c *Client) SetFolderResourcePermissions(uid string, body SetResourcePermissionsBody) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissions(FoldersResource, ResourceUID(uid), body)
}

func (c *Client) SetUserFolderResourcePermissions(folderUID string, userID int64, permission string) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissionByAssignment(
		FoldersResource,
		ResourceUID(folderUID),
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

func (c *Client) SetTeamFolderResourcePermissions(folderUID string, teamID int64, permission string) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissionByAssignment(
		FoldersResource,
		ResourceUID(folderUID),
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

func (c *Client) SetBuiltInRoleFolderResourcePermissions(folderUID string, builtInRole string, permission string) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissionByAssignment(
		FoldersResource,
		ResourceUID(folderUID),
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
