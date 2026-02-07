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
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type ConnectionID struct {
	NoArgFunc
}

func (c ConnectionID) IsNonDeterministic() bool {
	return true
}

func connIDFuncLogic(ctx *sql.Context, _ sql.Row) (interface{}, error) {
	return ctx.ID(), nil
}

var _ sql.FunctionExpression = ConnectionID{}
var _ sql.CollationCoercible = ConnectionID{}

func NewConnectionID() sql.Expression {
	return ConnectionID{
		NoArgFunc: NoArgFunc{Name: "connection_id", SQLType: types.Uint32},
	}
}

// FunctionName implements sql.FunctionExpression
func (c ConnectionID) FunctionName() string {
	return "connection_id"
}

// Description implements sql.FunctionExpression
func (c ConnectionID) Description() string {
	return "returns the current connection ID."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (ConnectionID) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_utf8mb3_general_ci, 3
}

// Eval implements sql.Expression
func (c ConnectionID) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return connIDFuncLogic(ctx, row)
}

// WithChildren implements sql.Expression
func (c ConnectionID) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NoArgFuncWithChildren(c, children)
}

type User struct {
	NoArgFunc
}

func (c User) IsNonDeterministic() bool {
	return true
}

func userFuncLogic(ctx *sql.Context, _ sql.Row) (interface{}, error) {
	if ctx.Client().User == "" && ctx.Client().Address == "" {
		return "", nil
	}

	return ctx.Client().User + "@" + ctx.Client().Address, nil
}

var _ sql.FunctionExpression = User{}
var _ sql.CollationCoercible = User{}

// Description implements sql.FunctionExpression
func (c User) Description() string {
	return "returns the authenticated user name and host name."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (User) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_utf8mb3_general_ci, 3
}

func NewUser() sql.Expression {
	return User{
		NoArgFunc: NoArgFunc{Name: "user", SQLType: types.LongText},
	}
}

func NewCurrentUser() sql.Expression {
	return User{
		NoArgFunc: NoArgFunc{Name: "current_user", SQLType: types.LongText},
	}
}

// Eval implements sql.Expression
func (c User) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return userFuncLogic(ctx, row)
}

// WithChildren implements sql.Expression
func (c User) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NoArgFuncWithChildren(c, children)
}
