// Copyright 2017 The casbin Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package casbin

// GetRolesForUser gets the roles that a user has.
func (e *Enforcer) GetRolesForUser(name string) []string {
	return e.model["g"]["g"].RM.GetRoles(name)
}

// GetUsersForRole gets the users that has a role.
func (e *Enforcer) GetUsersForRole(name string) []string {
	return e.model["g"]["g"].RM.GetUsers(name)
}

// HasRoleForUser determines whether a user has a role.
func (e *Enforcer) HasRoleForUser(name string, role string) bool {
	roles := e.GetRolesForUser(name)

	has_role := false
	for _, r := range roles {
		if r == role {
			has_role = true
			break
		}
	}

	return has_role
}

// AddRoleForUser adds a role for a user.
func (e *Enforcer) AddRoleForUser(user string, role string) {
	e.AddGroupingPolicy(user, role)
}

// DeleteRoleForUser deletes a role for a user.
func (e *Enforcer) DeleteRoleForUser(user string, role string) {
	e.RemoveGroupingPolicy(user, role)
}

// DeleteRolesForUser deletes all roles for a user.
func (e *Enforcer) DeleteRolesForUser(user string) {
	e.RemoveFilteredGroupingPolicy(0, user)
}

// DeleteUser deletes a user.
func (e *Enforcer) DeleteUser(user string) {
	e.RemoveFilteredGroupingPolicy(0, user)
}

// DeleteRole deletes a role.
func (e *Enforcer) DeleteRole(role string) {
	e.RemoveFilteredGroupingPolicy(1, role)
	e.RemoveFilteredPolicy(0, role)
}

// DeletePermission deletes a permission.
func (e *Enforcer) DeletePermission(permission ...string) {
	e.RemoveFilteredPolicy(1, permission...)
}

// AddPermissionForUser adds a permission for a user or role.
func (e *Enforcer) AddPermissionForUser(user string, permission ...string) {
	params := make([]interface{}, 0, len(permission) + 1)

	params= append(params, user)
	for _, perm := range permission {
		params = append(params, perm)
	}

	e.AddPolicy(params...)
}

// DeletePermissionForUser deletes a permission for a user or role.
func (e *Enforcer) DeletePermissionForUser(user string, permission ...string) {
	params := make([]interface{}, 0, len(permission) + 1)

	params= append(params, user)
	for _, perm := range permission {
		params = append(params, perm)
	}

	e.RemovePolicy(params...)
}

// DeletePermissionsForUser deletes permissions for a user or role.
func (e *Enforcer) DeletePermissionsForUser(user string) {
	e.RemoveFilteredPolicy(0, user)
}

// GetPermissionsForUser gets permissions for a user or role.
func (e *Enforcer) GetPermissionsForUser(user string) [][]string {
	return e.GetFilteredPolicy(0, user)
}

// HasPermissionForUser determines whether a user has a permission.
func (e *Enforcer) HasPermissionForUser(user string, permission ...string) bool {
	params := make([]interface{}, 0, len(permission) + 1)

	params= append(params, user)
	for _, perm := range permission {
		params = append(params, perm)
	}

	return e.HasPolicy(params...)
}
