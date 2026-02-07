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
	"strings"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

func (b *Builder) buildUse(inScope *scope, n *ast.Use) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	name := n.DBName.String()
	ret := plan.NewUse(b.resolveDb(name))
	ret.Catalog = b.cat
	outScope = inScope.push()
	outScope.node = ret
	return
}

func (b *Builder) buildPrepare(inScope *scope, n *ast.Prepare) (outScope *scope) {
	outScope = inScope.push()
	expr := n.Expr
	if strings.HasPrefix(n.Expr, "@") {
		// TODO resolve user variable
		varName := strings.ToLower(strings.Trim(n.Expr, "@"))
		_, val, err := b.ctx.GetUserVariable(b.ctx, varName)
		if err != nil {
			b.handleErr(err)
		}
		strVal, _, err := types.LongText.Convert(b.ctx, val)
		if err != nil {
			b.handleErr(err)
		}
		if strVal == nil {
			expr = "NULL"
		} else {
			expr = strVal.(string)
		}
	}

	childStmt, _, _, err := b.parser.ParseWithOptions(b.ctx, expr, ';', false, sql.LoadSqlMode(b.ctx).ParserOptions())
	if err != nil {
		b.handleErr(err)
	}

	oldCtx := b.BindCtx()
	defer func() {
		b.bindCtx = oldCtx
	}()
	// test for query structure; bind variables will be discarded
	b.bindCtx = &BindvarContext{resolveOnly: true}
	childScope := b.build(inScope, childStmt, expr)
	outScope.node = plan.NewPrepareQuery(n.Name, childScope.node, n)
	return outScope
}

func (b *Builder) buildExecute(inScope *scope, n *ast.Execute) (outScope *scope) {
	outScope = inScope.push()
	exprs := make([]sql.Expression, len(n.VarList))
	for i, e := range n.VarList {
		if strings.HasPrefix(e, "@") {
			exprs[i] = expression.NewUserVar(strings.TrimPrefix(e, "@"))
		} else {
			exprs[i] = expression.NewUnresolvedProcedureParam(e)
		}
	}
	outScope.node = plan.NewExecuteQuery(n.Name, exprs...)
	return outScope
}

func (b *Builder) buildDeallocate(inScope *scope, n *ast.Deallocate) (outScope *scope) {
	outScope = inScope.push()
	outScope.node = plan.NewDeallocateQuery(n.Name)
	return outScope
}

func (b *Builder) buildLockTables(inScope *scope, s *ast.LockTables) (outScope *scope) {
	outScope = inScope.push()
	tables := make([]*plan.TableLock, len(s.Tables))

	for i, tbl := range s.Tables {
		tableScope := b.buildDataSource(inScope, tbl.Table)
		write := tbl.Lock == ast.LockWrite || tbl.Lock == ast.LockLowPriorityWrite

		// TODO: Allow for other types of locks (LOW PRIORITY WRITE & LOCAL READ)
		tables[i] = &plan.TableLock{Table: tableScope.node, Write: write}
	}

	lockTables := plan.NewLockTables(tables)
	lockTables.Catalog = b.cat
	outScope.node = lockTables
	return outScope
}

func (b *Builder) buildUnlockTables(inScope *scope, s *ast.UnlockTables) (outScope *scope) {
	outScope = inScope.push()
	unlockTables := plan.NewUnlockTables()
	unlockTables.Catalog = b.cat
	outScope.node = unlockTables
	return outScope
}
