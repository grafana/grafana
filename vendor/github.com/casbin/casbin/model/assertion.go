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

package model

import (
	"github.com/casbin/casbin/rbac"
	"github.com/casbin/casbin/util"
)

// Assertion represents an expression in a section of the model.
// For example: r = sub, obj, act
type Assertion struct {
	Key    string
	Value  string
	Tokens []string
	Policy [][]string
	RM     *rbac.RoleManager
}

func (ast *Assertion) buildRoleLinks() {
	ast.RM = rbac.NewRoleManager(10)
	for _, rule := range ast.Policy {
		if len(rule) == 2 {
			ast.RM.AddLink(rule[0], rule[1])
		} else if len(rule) == 3 {
			ast.RM.AddLink(rule[0], rule[1], rule[2])
		}
	}

	util.LogPrint("Role links for: " + ast.Key)
	ast.RM.PrintRoles()
}
