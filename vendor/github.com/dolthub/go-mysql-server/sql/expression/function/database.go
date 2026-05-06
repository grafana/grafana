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

// Database implements the DATABASE() function
type Database struct{}

func (db *Database) IsNonDeterministic() bool {
	return true
}

var _ sql.FunctionExpression = (*Database)(nil)
var _ sql.CollationCoercible = (*Database)(nil)

// NewDatabase returns a new Database function
func NewDatabase() sql.Expression {
	return &Database{}
}

// FunctionName implements sql.FunctionExpression
func (db *Database) FunctionName() string {
	return "database"
}

// Description implements sql.FunctionExpression
func (db *Database) Description() string {
	return "returns the default (current) database name."
}

// Type implements the sql.Expression (sql.LongText)
func (db *Database) Type() sql.Type { return types.LongText }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Database) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_utf8mb3_general_ci, 3
}

// IsNullable implements the sql.Expression interface.
// The function returns always true
func (db *Database) IsNullable() bool {
	return true
}

func (db *Database) String() string {
	return fmt.Sprintf("%s()", db.FunctionName())
}

// WithChildren implements the Expression interface.
func (db *Database) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(db, len(children), 0)
	}
	return NewDatabase(), nil
}

// Resolved implements the sql.Expression interface.
func (db *Database) Resolved() bool {
	return true
}

// Children implements the sql.Expression interface.
func (db *Database) Children() []sql.Expression { return nil }

// Eval implements the sql.Expression interface.
func (db *Database) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if ctx.GetCurrentDatabase() == "" {
		return nil, nil
	}
	return ctx.GetCurrentDatabase(), nil
}
