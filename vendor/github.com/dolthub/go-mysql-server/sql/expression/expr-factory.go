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

package expression

import "github.com/dolthub/go-mysql-server/sql"

// ExpressionFactory allows integrators to provide custom implementations of
// expressions, such as IS NULL and IS NOT NULL.
type ExpressionFactory interface {
	// NewIsNull returns a sql.Expression implementation that handles
	// the IS NULL expression.
	NewIsNull(e sql.Expression) sql.Expression
	// NewIsNotNull returns a sql.Expression implementation that handles
	// the IS NOT NULL expression.
	NewIsNotNull(e sql.Expression) sql.Expression
}

// DefaultExpressionFactory is the ExpressionFactory used when the analyzer
// needs to create new expressions during analysis, such as IS NULL or
// IS NOT NULL. Integrators can swap in their own implementation if they need
// to customize the existing logic for these expressions.
var DefaultExpressionFactory ExpressionFactory = MySqlExpressionFactory{}

// MySqlExpressionFactory is the ExpressionFactory that creates expressions
// that follow MySQL's logic.
type MySqlExpressionFactory struct{}

var _ ExpressionFactory = (*MySqlExpressionFactory)(nil)

// NewIsNull implements the ExpressionFactory interface.
func (m MySqlExpressionFactory) NewIsNull(e sql.Expression) sql.Expression {
	return NewIsNull(e)
}

// NewIsNotNull implements the ExpressionFactory interface.
func (m MySqlExpressionFactory) NewIsNotNull(e sql.Expression) sql.Expression {
	return NewNot(NewIsNull(e))
}
