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
	"fmt"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

func (b *Builder) buildSelectStmt(inScope *scope, s ast.SelectStatement) (outScope *scope) {
	switch s := s.(type) {
	case *ast.Select:
		if s.With != nil {
			cteScope := b.buildWith(inScope, s.With)
			return b.buildSelect(cteScope, s)
		}
		return b.buildSelect(inScope, s)
	case *ast.SetOp:
		if s.With != nil {
			cteScope := b.buildWith(inScope, s.With)
			return b.buildSetOp(cteScope, s)
		}
		return b.buildSetOp(inScope, s)
	case *ast.ParenSelect:
		return b.buildSelectStmt(inScope, s.Select)
	default:
		b.handleErr(fmt.Errorf("unknown select statement %T", s))
	}
	return
}

func (b *Builder) buildSelect(inScope *scope, s *ast.Select) (outScope *scope) {
	// General order of binding:
	// 1) Get definitions in FROM.
	// 2) Build WHERE, which can only reference FROM columns.
	// 3) Bookkeep aggregation/window function usage in higher-scopes
	//    (GROUP BY, WINDOW, HAVING, SELECT, ORDER BY).
	// 4) Construct either i) aggregation, ii) window, or iii) projection over
	//    FROM clause providing expressions used in (2) (including aliases).
	// 5) Build top-level scopes, replacing aggregation and aliases with
	//    projections from (4).
	// 6) Finish with final target projections.
	fromScope := b.buildFrom(inScope, s.From)
	if cn, ok := fromScope.node.(sql.CommentedNode); ok && len(s.Comments) > 0 {
		fromScope.node = cn.WithComment(string(s.Comments[0]))
	}

	// Resolve and fold named window definitions
	b.buildNamedWindows(fromScope, s.Window)

	b.buildWhere(fromScope, s.Where)
	// select *, (SELECT t2.i) from t1 left join using t2 on i;
	// select t1.*, t2.*, t2.* from ...
	//
	projScope := fromScope.push()

	// Aggregates in select list added to fromScope.groupBy.outCols.
	// Args to aggregates added to fromScope.groupBy.inCols.
	b.analyzeProjectionList(fromScope, projScope, s.SelectExprs)

	// Find aggregations in order by
	orderByScope := b.analyzeOrderBy(fromScope, projScope, s.OrderBy)

	// Find aggregations in having
	b.analyzeHaving(fromScope, projScope, s.Having)

	// At this point we've recorded dependencies for higher-level scopes,
	// so we can build the FROM clause
	if b.needsAggregation(fromScope, s) {
		groupingCols := b.buildGroupingCols(fromScope, projScope, s.GroupBy, s.SelectExprs)
		outScope = b.buildAggregation(fromScope, projScope, groupingCols)
	} else if fromScope.windowFuncs != nil {
		outScope = b.buildWindow(fromScope, projScope)
	} else {
		outScope = b.buildInnerProj(fromScope, projScope)
	}

	// At this point, we've combined table relations, performed aggregations,
	// and projected aliases used in higher-level clauses. Aliases and agg
	// expressions in higher level scopes will be replaced with GetField
	// references.

	b.buildHaving(fromScope, projScope, outScope, s.Having)

	b.buildOrderBy(outScope, orderByScope)

	// Last level projection restricts outputs to target projections.
	b.buildProjection(outScope, projScope)
	outScope = projScope

	if err := b.buildDistinct(outScope, s.QueryOpts.Distinct); err != nil {
		b.handleErr(err)
	}

	// OFFSET and LIMIT are last
	offset := b.buildOffset(outScope, s.Limit)
	if offset != nil {
		outScope.node = plan.NewOffset(offset, outScope.node)
	}
	limit := b.buildLimit(outScope, s.Limit)
	if limit != nil {
		l := plan.NewLimit(limit, outScope.node)
		l.CalcFoundRows = s.QueryOpts.SQLCalcFoundRows
		outScope.node = l
	}

	b.buildForUpdateOf(s.Lock, fromScope)

	return
}

func (b *Builder) buildLimit(inScope *scope, limit *ast.Limit) sql.Expression {
	if limit != nil && limit.Rowcount != nil {
		return b.buildLimitVal(inScope, limit.Rowcount)
	}
	return nil
}

func (b *Builder) buildOffset(inScope *scope, limit *ast.Limit) sql.Expression {
	if limit != nil && limit.Offset != nil {
		e := b.buildLimitVal(inScope, limit.Offset)
		if lit, ok := e.(*expression.Literal); ok {
			// Check if offset starts at 0, if so, we can just remove the offset node.
			// Only cast to int8, as a larger int type just means a non-zero offset.
			if val, err := lit.Eval(b.ctx, nil); err == nil {
				if v, ok := val.(int64); ok && v == 0 {
					return nil
				}
			}
		}
		return e
	}
	return nil
}

// buildLimitVal resolves a literal numeric type or a numeric
// procedure parameter
func (b *Builder) buildLimitVal(inScope *scope, e ast.Expr) sql.Expression {
	switch e := e.(type) {
	case *ast.ColName:
		if e.StoredProcVal != nil {
			return b.buildLimitVal(inScope, e.StoredProcVal)
		}
		if inScope.procActive() {
			if col, ok := inScope.proc.GetVar(e.String()); ok {
				// proc param is OK
				if pp, ok := col.scalarGf().(*expression.ProcedureParam); ok {
					if !pp.Type().Promote().Equals(types.Int64) && !pp.Type().Promote().Equals(types.Uint64) {
						err := fmt.Errorf("the variable '%s' has a non-integer based type: %s", pp.Name(), pp.Type().String())
						b.handleErr(err)
					}
					return pp
				}
			}
		}
		err := fmt.Errorf("limit expression expected to be numeric or procedure parameter, found invalid column: %s", e.String())
		b.handleErr(err)
	default:
		l := b.buildScalar(inScope, e)
		return b.typeCoerceLiteral(l)
	}
	return nil
}

func (b *Builder) typeCoerceLiteral(e sql.Expression) sql.Expression {
	// todo this should be in a module that can generically coerce to a type or type class
	switch e := e.(type) {
	case *expression.Literal:
		val, _, err := types.Int64.Convert(b.ctx, e.Value())
		if err != nil {
			err = fmt.Errorf("%s: %w", err.Error(), sql.ErrInvalidTypeForLimit.New(types.Int64, e.Type()))
		}
		return expression.NewLiteral(val, types.Int64)
	case *expression.BindVar:
		return e
	default:
		err := sql.ErrInvalidTypeForLimit.New(expression.Literal{}, e)
		b.handleErr(err)
	}
	return nil
}

// buildDistinct creates a new plan.Distinct node if the query has a DISTINCT option.
// If the query has both DISTINCT and ALL, an error is returned.
func (b *Builder) buildDistinct(inScope *scope, distinct bool) error {
	if !distinct {
		return nil
	}
	var err error
	inScope.node, err = b.f.buildDistinct(inScope.node, inScope.refsSubquery)
	return err
}

func (b *Builder) currentDb() sql.Database {
	if b.currentDatabase == nil {
		if b.ctx.GetCurrentDatabase() == "" {
			err := sql.ErrNoDatabaseSelected.New()
			b.handleErr(err)
		}
		database, err := b.cat.Database(b.ctx, b.ctx.GetCurrentDatabase())
		if err != nil {
			b.handleErr(err)
		}
		b.currentDatabase = database
	}
	if privilegedDatabase, ok := b.currentDatabase.(mysql_db.PrivilegedDatabase); ok {
		b.currentDatabase = privilegedDatabase.Unwrap()
	}
	return b.currentDatabase
}

func (b *Builder) renameSource(scope *scope, table string, cols []string) {
	if table != "" {
		scope.setTableAlias(table)
	}
	if len(cols) > 0 {
		scope.setColAlias(cols)
	}
	for i, c := range scope.cols {
		c.scalar = nil
		scope.cols[i] = c
	}
}

// buildForUpdateOf builds the `FOR UPDATE OF` clause, ensuring that all tables listed are
// present in the clause. `FOR UPDATE` in general is a no-op, so `FOR UPDATE OF` is
// also a no-op: https://www.dolthub.com/blog/2023-10-23-hold-my-beer/
// TODO: implement actual row-level locking for `FOR UPDATE` clauses in general.
func (b *Builder) buildForUpdateOf(lock *ast.Lock, fromScope *scope) {
	if lock == nil {
		return
	}

	for _, tableName := range lock.Tables {
		tableNameStr := tableName.Name.String()

		if !fromScope.hasTable(tableNameStr) {
			b.handleErr(sql.ErrUnresolvedTableLock.New(tableNameStr))
			return
		}
	}
}
