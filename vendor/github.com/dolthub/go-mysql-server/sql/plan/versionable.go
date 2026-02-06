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

package plan

import "github.com/dolthub/go-mysql-server/sql"

// Versionable represents a plan that contains an AsOf expression.
type Versionable interface {
	sql.Node
	// AsOf returns this table's asof expression.
	AsOf() sql.Expression
	// WithAsOf returns a copy of this versioned table with its AsOf
	// field set to the given value. Analogous to WithChildren.
	WithAsOf(asOf sql.Expression) (sql.Node, error)
}
