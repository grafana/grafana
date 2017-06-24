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

package rbac

import (
	"github.com/casbin/casbin/util"
)

// RoleManager represents the interface to manage the roles in RBAC.
type RoleManager struct {
	allRoles map[string]*Role
	level    int
}

// NewRoleManager is the constructor for RoleManager.
func NewRoleManager(level int) *RoleManager {
	rm := RoleManager{}
	rm.allRoles = make(map[string]*Role)
	rm.level = level
	return &rm
}

func (rm *RoleManager) hasRole(name string) bool {
	_, ok := rm.allRoles[name]
	return ok
}

func (rm *RoleManager) createRole(name string) *Role {
	if !rm.hasRole(name) {
		rm.allRoles[name] = newRole(name)
	}

	return rm.allRoles[name]
}

// AddLink adds the inheritance link between role: name1 and role: name2.
// aka role: name1 inherits role: name2.
// domain is a prefix to the roles.
func (rm *RoleManager) AddLink(name1 string, name2 string, domain ...string) {
	if len(domain) == 1 {
		name1 = domain[0] + "::" + name1
		name2 = domain[0] + "::" + name2
	}

	role1 := rm.createRole(name1)
	role2 := rm.createRole(name2)
	role1.addRole(role2)
}

// DeleteLink deletes the inheritance link between role: name1 and role: name2.
// aka role: name1 does not inherit role: name2 any more.
// domain is a prefix to the roles.
func (rm *RoleManager) DeleteLink(name1 string, name2 string, domain ...string) {
	if len(domain) == 1 {
		name1 = domain[0] + "::" + name1
		name2 = domain[0] + "::" + name2
	}

	if !rm.hasRole(name1) || !rm.hasRole(name2) {
		return
	}

	role1 := rm.createRole(name1)
	role2 := rm.createRole(name2)
	role1.deleteRole(role2)
}

// HasLink determines whether role: name1 inherits role: name2.
// domain is a prefix to the roles.
func (rm *RoleManager) HasLink(name1 string, name2 string, domain ...string) bool {
	if len(domain) == 1 {
		name1 = domain[0] + "::" + name1
		name2 = domain[0] + "::" + name2
	}

	if name1 == name2 {
		return true
	}

	if !rm.hasRole(name1) || !rm.hasRole(name2) {
		return false
	}

	role1 := rm.createRole(name1)
	return role1.hasRole(name2, rm.level)
}

// GetRoles gets the roles that a subject inherits.
func (rm *RoleManager) GetRoles(name string) []string {
	if !rm.hasRole(name) {
		return nil
	}

	return rm.createRole(name).getRoles()
}

// GetRoles gets the users that inherits a subject.
func (rm *RoleManager) GetUsers(name string) []string {
	if !rm.hasRole(name) {
		return nil
	}

	names := []string{}
	for _, role := range rm.allRoles {
		if role.hasDirectRole(name) {
			names = append(names, role.name)
		}
	}
	return names
}

// PrintRoles prints all the roles to log.
func (rm *RoleManager) PrintRoles() {
	for _, role := range rm.allRoles {
		util.LogPrint(role.toString())
	}
}

// Role represents the data structure for a role in RBAC.
type Role struct {
	name  string
	roles []*Role
}

func newRole(name string) *Role {
	r := Role{}
	r.name = name
	return &r
}

func (r *Role) addRole(role *Role) {
	for _, rr := range r.roles {
		if rr.name == role.name {
			return
		}
	}

	r.roles = append(r.roles, role)
}

func (r *Role) deleteRole(role *Role) {
	for i, rr := range r.roles {
		if rr.name == role.name {
			r.roles = append(r.roles[:i], r.roles[i+1:]...)
			return
		}
	}
}

func (r *Role) hasRole(name string, level int) bool {
	if r.name == name {
		return true
	}

	if level <= 0 {
		return false
	}

	for _, role := range r.roles {
		if role.hasRole(name, level-1) {
			return true
		}
	}
	return false
}

func (r *Role) hasDirectRole(name string) bool {
	for _, role := range r.roles {
		if role.name == name {
			return true
		}
	}

	return false
}

func (r *Role) toString() string {
	names := ""
	for i, role := range r.roles {
		if i == 0 {
			names += role.name
		} else {
			names += ", " + role.name
		}
	}
	return r.name + " < " + names
}

func (r *Role) getRoles() []string {
	names := []string{}
	for _, role := range r.roles {
		names = append(names, role.name)
	}
	return names
}
