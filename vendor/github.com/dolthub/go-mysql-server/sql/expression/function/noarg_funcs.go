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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
)

// NoArgFunc is a helper type to reduce boilerplate in functions that take no arguments. Implements most of
// sql.FunctionExpression.
type NoArgFunc struct {
	SQLType sql.Type
	Name    string
}

// FunctionName implements sql.FunctionExpression
func (fn NoArgFunc) FunctionName() string {
	return strings.ToLower(fn.Name)
}

// Type implements the Expression interface.
func (fn NoArgFunc) Type() sql.Type { return fn.SQLType }

func (fn NoArgFunc) String() string { return fn.FunctionName() + "()" }

// IsNullable implements the Expression interface.
func (fn NoArgFunc) IsNullable() bool { return false }

// Resolved implements the Expression interface.
func (fn NoArgFunc) Resolved() bool { return true }

// Children implements the Expression interface.
func (fn NoArgFunc) Children() []sql.Expression { return nil }

// NoArgFuncWithChildren implements the Expression interface.
func NoArgFuncWithChildren(fn sql.Expression, children []sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(fn, len(children), 0)
	}
	return fn, nil
}
