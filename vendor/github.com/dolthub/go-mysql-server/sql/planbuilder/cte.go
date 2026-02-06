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
	"strings"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

func (b *Builder) buildWith(inScope *scope, with *ast.With) (outScope *scope) {
	// resolveCommonTableExpressions operates on With nodes. It replaces any matching UnresolvedTable references in the
	// tree with the subqueries defined in the CTEs.

	// CTE resolution:
	// - pre-process, get the list of CTEs
	// - find uses of those CTEs in the regular query body
	// - replace references to the name with the subquery body
	// - avoid infinite recursion of CTE referencing itself

	// recursive CTE (more complicated)
	// push recursive half right, minimize recursive side
	// create *plan.RecursiveCte node
	// replace recursive references of cte name with *plan.RecursiveTable

	outScope = inScope.push()

	for _, cte := range with.Ctes {
		ate := cte.AliasedTableExpr
		sq, ok := ate.Expr.(*ast.Subquery)
		if !ok {
			b.handleErr(sql.ErrUnsupportedFeature.New(fmt.Sprintf("Unsupported type of common table expression %T", ate.Expr)))
		}

		cteName := strings.ToLower(ate.As.String())
		var cteScope *scope
		if with.Recursive {
			switch n := sq.Select.(type) {
			case *ast.SetOp:
				switch n.Type {
				case ast.UnionStr, ast.UnionAllStr, ast.UnionDistinctStr:
					cteScope = b.buildRecursiveCte(outScope, n, cteName, columnsToStrings(cte.Columns))
				default:
					b.handleErr(sql.ErrRecursiveCTEMissingUnion.New(cteName))
				}
			default:
				if hasRecursiveTable(cteName, n) {
					b.handleErr(sql.ErrRecursiveCTEMissingUnion.New(cteName))
				}
				cteScope = b.buildCte(outScope, ate, cteName, columnsToStrings(cte.Columns))
			}
		} else {
			cteScope = b.buildCte(outScope, ate, cteName, columnsToStrings(cte.Columns))
		}
		inScope.addCte(cteName, cteScope)
	}
	return
}

func (b *Builder) buildCte(inScope *scope, e ast.TableExpr, name string, columns []string) *scope {
	cteScope := b.buildDataSource(inScope, e)
	b.renameSource(cteScope, name, columns)
	switch n := cteScope.node.(type) {
	case *plan.SubqueryAlias:
		cteScope.node = n.WithColumnNames(columns)
	}
	return cteScope
}

func (b *Builder) buildRecursiveCte(inScope *scope, union *ast.SetOp, name string, columns []string) *scope {
	l, r := splitRecursiveCteUnion(name, union)
	scopeMapping := make(map[sql.ColumnId]sql.Expression)
	if r == nil {
		// not recursive
		sqScope := inScope.pushSubquery()
		cteScope := b.buildSelectStmt(sqScope, union)

		switch n := cteScope.node.(type) {
		case *plan.SetOp:
			sq := plan.NewSubqueryAlias(name, "", n)
			b.qFlags.Set(sql.QFlagRelSubquery)
			sq = sq.WithColumnNames(columns)
			sq = sq.WithCorrelated(sqScope.correlated())
			sq = sq.WithVolatile(sqScope.volatile())

			tabId := cteScope.addTable(name)
			var colset sql.ColSet
			for i, c := range cteScope.cols {
				c.tableId = tabId
				cteScope.cols[i] = c
				colset.Add(sql.ColumnId(c.id))
				scopeMapping[sql.ColumnId(c.id)] = c.scalarGf()
			}
			cteScope.node = sq.WithScopeMapping(scopeMapping).WithId(tabId).WithColumns(colset)
		}
		b.renameSource(cteScope, name, columns)
		return cteScope
	}

	switch union.Type {
	case ast.UnionStr, ast.UnionAllStr, ast.UnionDistinctStr:
	default:
		b.handleErr(sql.ErrRecursiveCTENotUnion.New(union.Type))
	}

	// resolve non-recursive portion
	leftSqScope := inScope.pushSubquery()
	leftScope := b.buildSelectStmt(leftSqScope, l)

	// schema for non-recursive portion => recursive table
	var rTable *plan.RecursiveTable
	var rInit sql.Node
	var recSch sql.Schema
	cteScope := leftScope.replace()
	tableId := cteScope.addTable(name)
	var cols sql.ColSet
	{
		rInit = leftScope.node
		recSch = make(sql.Schema, len(rInit.Schema()))
		for i, c := range rInit.Schema() {
			newC := c.Copy()
			if len(columns) > 0 {
				newC.Name = columns[i]
			}
			newC.Source = name
			// the recursive part of the CTE may produce wider types than the left/non-recursive part
			// we need to promote the type of the left part, so the final schema is the widest possible type
			newC.Type = newC.Type.Promote()
			recSch[i] = newC
		}

		for i, c := range leftScope.cols {
			c.typ = recSch[i].Type
			c.scalar = nil
			c.table = name
			toId := cteScope.newColumn(c)
			cols.Add(sql.ColumnId(toId))
		}
		b.renameSource(cteScope, name, columns)

		for _, c := range cteScope.cols {
			scopeMapping[sql.ColumnId(c.id)] = c.scalarGf()
		}
		rTable = plan.NewRecursiveTable(name, recSch)
		cteScope.node = rTable.WithId(tableId).WithColumns(cols)
	}

	rightInScope := inScope.replaceSubquery()
	rightInScope.addCte(name, cteScope)
	rightScope := b.buildSelectStmt(rightInScope, r)

	// all is not distinct
	distinct := true
	switch union.Type {
	case ast.UnionAllStr, ast.IntersectAllStr, ast.ExceptAllStr:
		distinct = false
	}
	limit := b.buildLimit(inScope, union.Limit)

	orderByScope := b.analyzeOrderBy(cteScope, leftScope, union.OrderBy)
	var sortFields sql.SortFields
	for _, c := range orderByScope.cols {
		so := sql.Ascending
		if c.descending {
			so = sql.Descending
		}
		scalar := c.scalar
		if scalar == nil {
			scalar = c.scalarGf()
		}
		sf := sql.SortField{
			Column: scalar,
			Order:  so,
		}
		sortFields = append(sortFields, sf)
	}

	rcte := plan.NewRecursiveCte(rInit, rightScope.node, name, columns, distinct, limit, sortFields)
	rcte = rcte.WithSchema(recSch).WithWorking(rTable)
	corr := leftSqScope.correlated().Union(rightInScope.correlated())
	vol := leftSqScope.activeSubquery.volatile || rightInScope.activeSubquery.volatile

	rcteId := rcte.WithId(tableId).WithColumns(cols)

	sq := plan.NewSubqueryAlias(name, "", rcteId)
	b.qFlags.Set(sql.QFlagRelSubquery)
	sq = sq.WithColumnNames(columns)
	sq = sq.WithCorrelated(corr)
	sq = sq.WithVolatile(vol)
	sq = sq.WithScopeMapping(scopeMapping)
	cteScope.node = sq.WithId(tableId).WithColumns(cols)
	b.renameSource(cteScope, name, columns)
	return cteScope
}

// splitRecursiveCteUnion distinguishes between recursive and non-recursive
// portions of a recursive CTE. We walk a left deep tree of unions downwards
// as far as the right scope references the recursive binding. A subquery
// alias or a non-recursive right scope terminates the walk. We transpose all
// recursive right scopes into a new union tree, returning separate initial
// and recursive trees. If the node is not a recursive union, the returned
// right node will be nil.
//
// todo(max): better error messages to differentiate between syntax errors
// "should have one or more non-recursive query blocks followed by one or more recursive ones"
// "the recursive table must be referenced only once, and not in any subquery"
func splitRecursiveCteUnion(name string, n ast.SelectStatement) (ast.SelectStatement, ast.SelectStatement) {
	union, ok := n.(*ast.SetOp)
	if !ok {
		return n, nil
	}

	if !hasRecursiveTable(name, union.Right) {
		return n, nil
	}

	l, r := splitRecursiveCteUnion(name, union.Left)
	if r == nil {
		return union.Left, union.Right
	}

	return l, &ast.SetOp{
		Type:    union.Type,
		Left:    r,
		Right:   union.Right,
		OrderBy: union.OrderBy,
		With:    union.With,
		Limit:   union.Limit,
		Lock:    union.Lock,
	}
}

// hasRecursiveTable returns true if the given scope references the
// table name.
func hasRecursiveTable(name string, s ast.SelectStatement) bool {
	var found bool
	ast.Walk(func(node ast.SQLNode) (bool, error) {
		switch t := (node).(type) {
		case *ast.AliasedTableExpr:
			switch e := t.Expr.(type) {
			case ast.TableName:
				if strings.ToLower(e.Name.String()) == name {
					found = true
				}
			}
		}
		return true, nil
	}, s)
	return found
}
