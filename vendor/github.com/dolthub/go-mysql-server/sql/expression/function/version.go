// Copyright 2020-2021 Dolthub, Inc.
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

package function

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Version is a function that returns server version.
type Version string

func (f Version) IsNonDeterministic() bool {
	// Just means that the value can change over time, i.e. on an upgrade
	return true
}

var _ sql.FunctionExpression = (Version)("")
var _ sql.CollationCoercible = (Version)("")

// NewVersion creates a new Version UDF.
func NewVersion(versionPostfix string) func(...sql.Expression) (sql.Expression, error) {
	return func(...sql.Expression) (sql.Expression, error) {
		return Version(versionPostfix), nil
	}
}

// FunctionName implements sql.FunctionExpression
func (f Version) FunctionName() string {
	return "version"
}

// Description implements sql.FunctionExpression
func (f Version) Description() string {
	return "returns a string that indicates the SQL server version."
}

// Type implements the Expression interface.
func (f Version) Type() sql.Type { return types.LongText }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (Version) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_utf8mb3_general_ci, 3
}

// IsNullable implements the Expression interface.
func (f Version) IsNullable() bool {
	return false
}

func (f Version) String() string {
	return fmt.Sprintf("%s()", f.FunctionName())
}

// WithChildren implements the Expression interface.
func (f Version) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 0)
	}
	return f, nil
}

// Resolved implements the Expression interface.
func (f Version) Resolved() bool {
	return true
}

// Children implements the Expression interface.
func (f Version) Children() []sql.Expression { return nil }

// Eval implements the Expression interface.
func (f Version) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	v, err := ctx.Session.GetSessionVariable(ctx, "version")
	if err != nil {
		return nil, err
	}
	if f == "" {
		return v, nil
	}
	return fmt.Sprintf("%s-%s", v, string(f)), nil
}
