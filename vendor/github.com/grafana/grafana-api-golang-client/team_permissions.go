package gapi

func (c *Client) ListTeamResourcePermissions(uid string) ([]*ResourcePermission, error) {
	return c.listResourcePermissions(TeamsResource, ResourceUID(uid))
}

func (c *Client) SetTeamResourcePermissions(uid string, body SetResourcePermissionsBody) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissions(TeamsResource, ResourceUID(uid), body)
}

func (c *Client) SetUserTeamResourcePermissions(teamUID string, userID int64, permission string) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissionByAssignment(
		TeamsResource,
		ResourceUID(teamUID),
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
