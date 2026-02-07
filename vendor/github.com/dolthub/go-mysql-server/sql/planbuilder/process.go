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

import (
	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

func (b *Builder) buildKill(inScope *scope, kill *ast.Kill) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, kill.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	outScope = inScope.push()
	connID64 := b.getInt64Value(inScope, kill.ConnID, "Error parsing KILL, expected int literal")
	connID32 := uint32(connID64)
	if int64(connID32) != connID64 {
		err := sql.ErrUnsupportedFeature.New("int literal is not unsigned 32-bit.")
		b.handleErr(err)
	}
	if kill.Connection {
		outScope.node = plan.NewKill(plan.KillType_Connection, connID32)
	} else {
		outScope.node = plan.NewKill(plan.KillType_Query, connID32)
	}
	return outScope
}

// getInt64Value returns the int64 literal value in the expression given, or an error with the errStr given if it
// cannot.
func (b *Builder) getInt64Value(inScope *scope, expr ast.Expr, errStr string) int64 {
	ie := b.getInt64Literal(inScope, expr, errStr)

	i, err := ie.Eval(b.ctx, nil)
	if err != nil {
		b.handleErr(err)
	}

	return i.(int64)
}

// getInt64Literal returns an int64 *expression.Literal for the value given, or an unsupported error with the string
// given if the expression doesn't represent an integer literal.
func (b *Builder) getInt64Literal(inScope *scope, expr ast.Expr, errStr string) *expression.Literal {
	e := b.buildScalar(inScope, expr)

	switch e := e.(type) {
	case *expression.Literal:
		if !types.IsInteger(e.Type()) {
			err := sql.ErrUnsupportedFeature.New(errStr)
			b.handleErr(err)
		}
	}
	nl, ok := e.(*expression.Literal)
	if !ok || !types.IsInteger(nl.Type()) {
		err := sql.ErrUnsupportedFeature.New(errStr)
		b.handleErr(err)
	} else {
		i64, _, err := types.Int64.Convert(b.ctx, nl.Value())
		if err != nil {
			err := sql.ErrUnsupportedFeature.New(errStr)
			b.handleErr(err)
		}
		return expression.NewLiteral(i64, types.Int64)
	}

	return nl
}
