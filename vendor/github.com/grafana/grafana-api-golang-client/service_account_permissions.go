package gapi

func (c *Client) ListServiceAccountResourcePermissions(id int64) ([]*ResourcePermission, error) {
	return c.listResourcePermissions(ServiceAccountsResource, ResourceID(id))
}

func (c *Client) SetServiceAccountResourcePermissions(id int64, body SetResourcePermissionsBody) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissions(ServiceAccountsResource, ResourceID(id), body)
}

func (c *Client) SetUserServiceAccountResourcePermissions(id int64, userID int64, permission string) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissionByAssignment(
		ServiceAccountsResource,
		ResourceID(id),
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

func (c *Client) SetTeamServiceAccountResourcePermissions(id int64, teamID int64, permission string) (*SetResourcePermissionsResponse, error) {
	return c.setResourcePermissionByAssignment(
		ServiceAccountsResource,
		ResourceID(id),
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
