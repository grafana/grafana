// Copyright 2025 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package planbuilder

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
)

// mockDefiner temporarily impersonates the definer during binding. It clones the current authorization state
// (when available), adds the requested global privileges (e.g. CREATE VIEW), and updates both the session privilege
// cache and the cached AuthorizationQueryState. Callers must defer the returned restore function.
func (b *Builder) mockDefiner(privileges ...sql.PrivilegeType) func() {
	if b == nil || b.ctx == nil || b.ctx.Session == nil {
		return func() {}
	}

	var privilegeSet mysql_db.PrivilegeSet
	if state, ok := b.authQueryState.(defaultAuthorizationQueryState); ok && state.enabled {
		privilegeSet = state.privSet.Copy()
	} else {
		privilegeSet = mysql_db.NewPrivilegeSet()
	}
	privilegeSet.AddGlobalStatic(privileges...)

	initialAuthQueryState := b.authQueryState
	if state, ok := b.authQueryState.(defaultAuthorizationQueryState); ok {
		state.privSet = privilegeSet
		b.authQueryState = state
	}

	initialPrivilegeSet, initialCounter := b.ctx.Session.GetPrivilegeSet()
	b.ctx.SetPrivilegeSet(privilegeSet, initialCounter)

	return func() {
		b.authQueryState = initialAuthQueryState
		b.ctx.SetPrivilegeSet(initialPrivilegeSet, initialCounter)
	}
}
