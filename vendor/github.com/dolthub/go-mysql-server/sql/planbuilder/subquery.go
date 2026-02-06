// Copyright 2023 Dolthub, Inc.
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

import "github.com/dolthub/go-mysql-server/sql"

type subquery struct {
	parent     *subquery
	correlated sql.ColSet
	volatile   bool
}

// addOutOfScope is used to tag subqueries that failed to resolve a column.
// The way this works is that we have a scope where we initiate a resolve
// (scope_0), and we will work upwards through the scope chain until we find
// the scope with the column (ex: scope_n). After finding the column, we wind
// back upwards through the callstack to return the column. During the unwind,
// check and tag every scope in between scope_0...scope_n-1 that is a subquery.
// This prevents propagating the correlation tag above the scope where the
// column is defined.
func (s *subquery) addOutOfScope(c columnId) {
	if s == nil {
		return
	}
	s.correlated.Add(sql.ColumnId(c))
}

// markVolatile marks this and every parent subquery as volatile.
func (s *subquery) markVolatile() {
	s.volatile = true
	if s.parent != nil {
		s.parent.markVolatile()
	}
}
