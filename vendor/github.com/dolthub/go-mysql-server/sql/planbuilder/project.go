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
	"github.com/dolthub/go-mysql-server/sql/transform"
)

func (b *Builder) analyzeProjectionList(inScope, outScope *scope, selectExprs ast.SelectExprs) {
	b.analyzeSelectList(inScope, outScope, selectExprs)
}

func (b *Builder) analyzeSelectList(inScope, outScope *scope, selectExprs ast.SelectExprs) (expressions []sql.Expression) {
	// TODO: ideally we would not create new expressions here.
	// we want to in-place identify aggregations, expand stars.
	// use inScope to construct projections for projScope

	// interleave tempScope between inScope and parent, namespace for
	// alias accumulation within SELECT
	tempScope := inScope.replace()
	inScope.parent = tempScope

	// need to transfer aggregation state from out -> in
	var exprs []sql.Expression
	var hasColumnBeforeStar bool
	for _, se := range selectExprs {
		// Check for named expressions before unqualified *
		if star, ok := se.(*ast.StarExpr); ok {
			if star.TableName.IsEmpty() && hasColumnBeforeStar {
				b.handleErr(sql.ErrInvalidSyntax.New("cannot mix named columns with '*' in SELECT clause"))
			}
		} else if _, ok := se.(*ast.AliasedExpr); ok {
			hasColumnBeforeStar = true
		}
		pe := b.selectExprToExpression(inScope, se)

		// TODO two passes for symbol res and semantic validation
		var aRef string
		var subqueryFound bool
		inScopeAliasRef := transform.InspectExpr(pe, func(e sql.Expression) bool {
			var id columnId
			switch e := e.(type) {
			case *expression.GetField:
				if e.Table() == "" {
					id = columnId(e.Id())
					aRef = e.Name()
				}
			case *expression.Alias:
				id = columnId(e.Id())
				aRef = e.Name()
			case *plan.Subquery:
				subqueryFound = true
			}
			if aRef != "" {
				collisionId, ok := tempScope.exprs[strings.ToLower(aRef)]
				return ok && id == collisionId
			}
			return false
		})
		if inScopeAliasRef {
			err := sql.ErrMisusedAlias.New(aRef)
			b.handleErr(err)
		}
		if subqueryFound {
			outScope.refsSubquery = true
		}

		switch e := pe.(type) {
		case *expression.GetField:
			exprs = append(exprs, e)
			id, ok := inScope.getExpr(e.String(), true)
			if !ok {
				err := sql.ErrColumnNotFound.New(e.String())
				b.handleErr(err)
			}
			e = e.WithIndex(int(id)).(*expression.GetField)
			outScope.addColumn(scopeColumn{tableId: inScope.tables[e.Table()], table: e.Table(), db: e.Database(), col: e.Name(), scalar: e, typ: e.Type(), nullable: e.IsNullable(), id: id})
		case *expression.Star:
			tableName := strings.ToLower(e.Table)
			if tableName == "" && len(inScope.cols) == 1 && inScope.cols[0].col == "" && inScope.cols[0].table == "dual" {
				err := sql.ErrNoTablesUsed.New()
				b.handleErr(err)
			}
			startLen := len(outScope.cols)
			for _, c := range inScope.cols {
				// unqualified columns that are redirected should not be replaced
				if col, ok := inScope.redirectCol[c.col]; tableName == "" && ok && !col.equals(c) {
					continue
				}
				if strings.EqualFold(c.table, tableName) || tableName == "" {
					gf := c.scalarGf()
					exprs = append(exprs, gf)
					id, ok := inScope.getExpr(gf.String(), true)
					if !ok {
						err := sql.ErrColumnNotFound.New(gf.String())
						b.handleErr(err)
					}
					c.id = id
					c.scalar = gf
					outScope.addColumn(c)
				}
			}
			if tableName != "" && len(outScope.cols) == startLen {
				err := sql.ErrTableNotFound.New(tableName)
				b.handleErr(err)
			}
		case *expression.Alias:
			var col scopeColumn
			if a, ok := e.Child.(*expression.Alias); ok {
				if _, ok := tempScope.exprs[a.Name()]; ok {
					// can't ref alias within the same scope
					err := sql.ErrMisusedAlias.New(e.Name())
					b.handleErr(err)
				}
				col = scopeColumn{col: e.Name(), scalar: e, typ: e.Type(), nullable: e.IsNullable()}
			} else if gf, ok := e.Child.(*expression.GetField); ok && gf.Table() == "" {
				// potential alias only if table is empty
				if _, ok := tempScope.exprs[gf.Name()]; ok {
					// can't ref alias within the same scope
					err := sql.ErrMisusedAlias.New(e.Name())
					b.handleErr(err)
				}
				id, ok := inScope.getExpr(gf.String(), true)
				if !ok {
					err := sql.ErrColumnNotFound.New(gf.String())
					b.handleErr(err)
				}
				col = scopeColumn{id: id, tableId: gf.TableId(), col: e.Name(), db: gf.Database(), table: gf.Table(), scalar: e, typ: gf.Type(), nullable: gf.IsNullable()}
			} else if sq, ok := e.Child.(*plan.Subquery); ok {
				col = scopeColumn{col: e.Name(), scalar: e, typ: sq.Type(), nullable: sq.IsNullable()}
			} else {
				col = scopeColumn{col: e.Name(), scalar: e, typ: e.Type(), nullable: e.IsNullable()}
			}
			if e.Unreferencable() {
				outScope.addColumn(col)
			} else {
				id := outScope.newColumn(col)
				col.id = id
				e = e.WithId(sql.ColumnId(id)).(*expression.Alias)
				outScope.cols[len(outScope.cols)-1].scalar = e
				col.scalar = e
				tempScope.addColumn(col)
			}
			if inScope.selectAliases == nil {
				inScope.selectAliases = make(map[string]sql.Expression)
			}
			inScope.selectAliases[e.Name()] = e
			exprs = append(exprs, e)
		default:
			exprs = append(exprs, pe)
			col := scopeColumn{col: pe.String(), scalar: pe, typ: pe.Type()}
			outScope.newColumn(col)
		}
	}

	inScope.parent = tempScope.parent
	return exprs
}

// selectExprToExpression binds dependencies in a scalar expression in a SELECT clause.
// We differentiate inScope from localScope in cases where we want to differentiate
// leading aliases in the same SELECT clause from inner-scope columns of the same name.
func (b *Builder) selectExprToExpression(inScope *scope, se ast.SelectExpr) sql.Expression {
	switch e := se.(type) {
	case *ast.StarExpr:
		b.qFlags.Set(sql.QFlagStar)
		if e.TableName.IsEmpty() {
			return expression.NewStar()
		}
		return expression.NewQualifiedStar(strings.ToLower(e.TableName.Name.String()))
	case *ast.AliasedExpr:
		expr := b.buildScalar(inScope, e.Expr)
		if !e.As.IsEmpty() {
			return expression.NewAlias(e.As.String(), expr)
		}
		if selectExprNeedsAlias(e, expr) {
			// if the input expression is the same as expression string, then it's referencable.
			// E.g. "SLEEP(1)" is the same as "sleep(1)"
			if strings.EqualFold(e.InputExpression, expr.String()) {
				return expression.NewAlias(e.InputExpression, expr)
			}
			return expression.NewAlias(e.InputExpression, expr).AsUnreferencable()
		}
		return expr
	default:
		b.handleErr(sql.ErrUnsupportedSyntax.New(ast.String(e)))
	}
	return nil
}

func (b *Builder) markDeferProjection(proj sql.Node, inScope, outScope *scope) {
	if !b.qFlags.IsSet(sql.QFlagDeferProjections) || b.qFlags.IsSet(sql.QFlagUndeferrableExprs) {
		return
	}
	if inScope.parent != nil && inScope.parent.activeSubquery != nil {
		return
	}
	if _, isProj := proj.(*plan.Project); !isProj {
		return
	}
	proj.(*plan.Project).CanDefer = true
}

func (b *Builder) buildProjection(inScope, outScope *scope) {
	projections := make([]sql.Expression, len(outScope.cols))
	for i, sc := range outScope.cols {
		projections[i] = sc.scalar
	}
	proj, err := b.f.buildProject(plan.NewProject(projections, inScope.node), outScope.refsSubquery)
	if err != nil {
		b.handleErr(err)
	}
	b.markDeferProjection(proj, inScope, outScope)
	outScope.node = proj
}

func selectExprNeedsAlias(e *ast.AliasedExpr, expr sql.Expression) bool {
	if len(e.InputExpression) == 0 {
		return false
	}

	if ee, isExpr := e.Expr.(*ast.FuncExpr); isExpr && strings.EqualFold(ee.Name.String(), "name_const") {
		return false
	}

	// We want to avoid unnecessary wrapping of aliases, but not at the cost of blowing up parse time. So we examine
	// the expression tree to see if is likely to need an alias without first serializing the expression being
	// examined, which can be very expensive in memory.
	complex := false
	sql.Inspect(expr, func(expr sql.Expression) bool {
		switch expr.(type) {
		case *plan.Subquery, *expression.UnresolvedFunction, *expression.Case, *expression.InTuple, *plan.InSubquery, *expression.HashInTuple:
			complex = true
			return false
		default:
			return true
		}
	})
	if complex {
		return true
	}

	// If the expression's string representation is quoted, trim the quotes before comparing it to the input expression.
	// InputExpression is assigned in the Vitess layer, and it always trims quotes at that time, too.
	exprString := expr.String()
	if strings.HasPrefix(exprString, "'") && strings.HasSuffix(exprString, "'") {
		exprString = exprString[1 : len(exprString)-1]
	}

	// If the expression's input value does not match expr.String(), then we know that it is not
	// referenceable and will need an alias.
	return e.InputExpression != exprString
}
