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
	"github.com/dolthub/go-mysql-server/sql/expression"
	dtablefunctions "github.com/dolthub/go-mysql-server/sql/expression/tablefunction"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// TODO outScope will be populated with a source node and column sets
func (b *Builder) buildFrom(inScope *scope, te ast.TableExprs) (outScope *scope) {
	if len(te) == 0 {
		outScope = inScope.push()
		outScope.ast = te
		outScope.node = plan.NewResolvedDualTable()
		// new unreferenceable column to mirror empty table schema
		outScope.addColumn(scopeColumn{table: "dual"})
		return
	}

	if len(te) > 1 {
		cj := &ast.JoinTableExpr{
			LeftExpr:  te[0],
			RightExpr: te[1],
			Join:      ast.JoinStr,
			Condition: ast.JoinCondition{On: ast.BoolVal(true)},
		}
		for _, t := range te[2:] {
			cj = &ast.JoinTableExpr{
				LeftExpr:  cj,
				RightExpr: t,
				Join:      ast.JoinStr,
				Condition: ast.JoinCondition{On: ast.BoolVal(true)},
			}
		}
		return b.buildJoin(inScope, cj)
	}
	return b.buildDataSource(inScope, te[0])
}

func (b *Builder) isLateral(te ast.TableExpr) bool {
	switch t := te.(type) {
	case *ast.JSONTableExpr:
		return true
	case *ast.AliasedTableExpr:
		return t.Lateral
	default:
		return false
	}
}

func (b *Builder) isUsingJoin(te *ast.JoinTableExpr) bool {
	return te.Condition.Using != nil ||
		strings.EqualFold(te.Join, ast.NaturalJoinStr) ||
		strings.EqualFold(te.Join, ast.NaturalLeftJoinStr) ||
		strings.EqualFold(te.Join, ast.NaturalRightJoinStr)
}

func (b *Builder) canConvertToCrossJoin(te *ast.JoinTableExpr) bool {
	switch te.Join {
	case ast.LeftJoinStr, ast.RightJoinStr, ast.FullOuterJoinStr:
		return false
	default:
		return (te.Condition.On == nil || te.Condition.On == ast.BoolVal(true)) &&
			te.Condition.Using == nil
	}
}

func (b *Builder) buildJoin(inScope *scope, te *ast.JoinTableExpr) (outScope *scope) {
	b.qFlags.Set(sql.QFlagInnerJoin)

	//TODO build individual table expressions
	// collect column  definitions
	leftScope := b.buildDataSource(inScope, te.LeftExpr)

	// TODO lateral join right will see left outputs
	rightInScope := inScope
	if b.isLateral(te.RightExpr) && te.Join != ast.RightJoinStr {
		rightInScope = leftScope
	}
	rightScope := b.buildDataSource(rightInScope, te.RightExpr)

	if b.isUsingJoin(te) {
		return b.buildUsingJoin(inScope, leftScope, rightScope, te)
	}

	outScope = inScope.push()
	outScope.appendColumnsFromScope(leftScope)
	outScope.appendColumnsFromScope(rightScope)

	// cross join
	if b.canConvertToCrossJoin(te) {
		if rast, ok := te.RightExpr.(*ast.AliasedTableExpr); ok && rast.Lateral {
			var err error
			outScope.node, err = b.f.buildJoin(leftScope.node, rightScope.node, plan.JoinTypeLateralCross, expression.NewLiteral(true, types.Boolean))
			if err != nil {
				b.handleErr(err)
			}
		} else if b.isLateral(te.RightExpr) {
			outScope.node = plan.NewJoin(leftScope.node, rightScope.node, plan.JoinTypeLateralCross, nil)
		} else {
			b.qFlags.Set(sql.QFlagCrossJoin)
			outScope.node = plan.NewCrossJoin(leftScope.node, rightScope.node)
		}
		return
	}

	var filter sql.Expression
	if te.Condition.On != nil {
		filter = b.buildScalar(outScope, te.Condition.On)
	}

	var op plan.JoinType
	switch strings.ToLower(te.Join) {
	case ast.JoinStr:
		if b.isLateral(te.RightExpr) {
			op = plan.JoinTypeLateralInner
		} else {
			op = plan.JoinTypeInner
		}
	case ast.LeftJoinStr:
		if b.isLateral(te.RightExpr) {
			op = plan.JoinTypeLateralLeft
		} else {
			op = plan.JoinTypeLeftOuter
		}
	case ast.RightJoinStr:
		if b.isLateral(te.RightExpr) {
			op = plan.JoinTypeLateralRight
		} else {
			op = plan.JoinTypeRightOuter
		}
	case ast.FullOuterJoinStr:
		op = plan.JoinTypeFullOuter
	case ast.StraightJoinStr:
		// TODO: eventually we should support straight joins
		op = plan.JoinTypeInner
	default:
		b.handleErr(fmt.Errorf("unknown join type: %s", te.Join))
	}
	var err error
	outScope.node, err = b.f.buildJoin(leftScope.node, rightScope.node, op, filter)
	if err != nil {
		b.handleErr(err)
	}

	return outScope
}

// buildUsingJoin converts a JOIN with a USING clause into an INNER JOIN, LEFT JOIN, or RIGHT JOIN; NATURAL JOINs are a
// subset of USING joins.
// The scope of these join must contain all the qualified columns from both left and right tables. The columns listed
// in the USING clause must be in both left and right tables, and will be redirected to
// either the left or right table.
// An equality filter is created with columns in the USING list. Columns in the USING
// list are de-duplicated and listed first (in the order they appear in the left table), followed by the remaining
// columns from the left table, followed by the remaining columns from the right table.
// NATURAL_JOIN(t1, t2)       => PROJ(t1.a1, ...,t1.aN) -> INNER_JOIN(t1, t2, [t1.a1=t2.a1,..., t1.aN=t2.aN])
// NATURAL_LEFT_JOIN(t1, t2)  => PROJ(t1.a1, ...,t1.aN) -> LEFT_JOIN (t1, t2, [t1.a1=t2.a1,..., t1.aN=t2.aN])
// NATURAL_RIGHT_JOIN(t1, t2) => PROJ(t1.a1, ...,t1.aN) -> RIGHT_JOIN(t1, t2, [t1.a1=t2.a1,..., t1.aN=t2.aN])
// USING_JOIN(t1, t2)         => PROJ(t1.a1, ...,t1.aN) -> INNER_JOIN(t1, t2, [t1.a1=t2.a1,..., t1.aN=t2.aN])
// USING_LEFT_JOIN(t1, t2)    => PROJ(t1.a1, ...,t1.aN) -> LEFT_JOIN (t1, t2, [t1.a1=t2.a1,..., t1.aN=t2.aN])
// USING_RIGHT_JOIN(t1, t2)   => PROJ(t1.a1, ...,t1.aN) -> RIGHT_JOIN(t1, t2, [t1.a1=t2.a1,..., t1.aN=t2.aN])
func (b *Builder) buildUsingJoin(inScope, leftScope, rightScope *scope, te *ast.JoinTableExpr) (outScope *scope) {
	outScope = inScope.push()

	// Fill in USING columns for NATURAL JOINs
	if len(te.Condition.Using) == 0 {
		for _, lCol := range leftScope.cols {
			for _, rCol := range rightScope.cols {
				if strings.EqualFold(lCol.col, rCol.col) {
					te.Condition.Using = append(te.Condition.Using, ast.NewColIdent(lCol.col))
					break
				}
			}
		}
	}

	// Right joins swap left and right scopes.
	var left, right *scope
	if te.Join == ast.RightJoinStr || te.Join == ast.NaturalRightJoinStr {
		left, right = rightScope, leftScope
	} else {
		left, right = leftScope, rightScope
	}

	// Add columns in common
	var filter sql.Expression
	usingCols := map[string]struct{}{}
	for _, col := range te.Condition.Using {
		colName := col.String()
		// Every column in the USING clause must be in both tables.
		lCol, ok := left.resolveColumn("", "", colName, false, false)
		if !ok {
			b.handleErr(sql.ErrUnknownColumn.New(colName, "from clause"))
		}
		rCol, ok := right.resolveColumn("", "", colName, false, false)
		if !ok {
			b.handleErr(sql.ErrUnknownColumn.New(colName, "from clause"))
		}
		f := expression.NewEquals(lCol.scalarGf(), rCol.scalarGf())
		if filter == nil {
			filter = f
		} else {
			filter = expression.NewAnd(filter, f)
		}
		usingCols[colName] = struct{}{}
		outScope.redirect(scopeColumn{col: rCol.col}, lCol)
	}

	// Add common columns first, then left, then right.
	// The order of columns for the common section must match left table
	for _, lCol := range left.cols {
		if _, ok := usingCols[lCol.col]; ok {
			outScope.addColumn(lCol)
		}
	}
	for _, rCol := range right.cols {
		if _, ok := usingCols[rCol.col]; ok {
			outScope.addColumn(rCol)
		}
	}
	for _, lCol := range left.cols {
		if _, ok := usingCols[lCol.col]; !ok {
			outScope.addColumn(lCol)
		}
	}
	for _, rCol := range right.cols {
		if _, ok := usingCols[rCol.col]; !ok {
			outScope.addColumn(rCol)
		}
	}

	// joining two tables with no common columns is just cross join
	if len(te.Condition.Using) == 0 {
		if b.isLateral(te.RightExpr) {
			outScope.node = plan.NewJoin(leftScope.node, rightScope.node, plan.JoinTypeLateralCross, nil)
		} else {
			outScope.node = plan.NewCrossJoin(leftScope.node, rightScope.node)
		}
		return outScope
	}

	switch strings.ToLower(te.Join) {
	case ast.JoinStr, ast.NaturalJoinStr:
		outScope.node = plan.NewInnerJoin(leftScope.node, rightScope.node, filter)
	case ast.LeftJoinStr, ast.NaturalLeftJoinStr:
		outScope.node = plan.NewLeftOuterJoin(leftScope.node, rightScope.node, filter)
	case ast.RightJoinStr, ast.NaturalRightJoinStr:
		outScope.node = plan.NewLeftOuterJoin(rightScope.node, leftScope.node, filter)
	default:
		b.handleErr(fmt.Errorf("unknown using join type: %s", te.Join))
	}
	return outScope
}

func (b *Builder) buildDataSource(inScope *scope, te ast.TableExpr) (outScope *scope) {
	outScope = inScope.push()
	outScope.ast = te

	// build individual table, collect column definitions
	switch t := (te).(type) {
	case *ast.AliasedTableExpr:
		if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, t.Auth); err != nil && b.authEnabled {
			b.handleErr(err)
		}
		switch e := t.Expr.(type) {
		case ast.TableName:
			tableName := strings.ToLower(e.Name.String())
			tAlias := strings.ToLower(t.As.String())
			if cteScope := inScope.getCte(tableName); cteScope != nil {
				outScope = cteScope.aliasCte(tAlias)
				outScope.parent = inScope
			} else {
				var ok bool
				outScope, ok = b.buildTablescan(inScope, e, t.AsOf)
				if !ok {
					b.handleErr(sql.ErrTableNotFound.New(tableName))
				}
			}
			if tAlias != "" {
				outScope.setTableAlias(tAlias)
				var err error
				outScope.node, err = b.f.buildTableAlias(tAlias, outScope.node.(plan.TableIdNode))
				if err != nil {
					b.handleErr(err)
				}
			}
		case *ast.Subquery:
			if t.As.IsEmpty() {
				// This should be caught by the parser, but here just in case
				b.handleErr(sql.ErrUnsupportedFeature.New("subquery without alias"))
			}

			sqScope := inScope.pushSubquery()
			fromScope := b.buildSelectStmt(sqScope, e.Select)
			alias := strings.ToLower(t.As.String())
			sq := plan.NewSubqueryAlias(alias, ast.String(e.Select), fromScope.node)
			b.qFlags.Set(sql.QFlagRelSubquery)
			sq = sq.WithCorrelated(sqScope.correlated())
			sq = sq.WithVolatile(sqScope.volatile())
			sq.IsLateral = t.Lateral

			var renameCols []string
			if len(e.Columns) > 0 {
				renameCols = columnsToStrings(e.Columns)
				sq = sq.WithColumnNames(renameCols)
			}

			if len(renameCols) > 0 && len(fromScope.cols) != len(renameCols) {
				err := sql.ErrColumnCountMismatch.New()
				b.handleErr(err)
			}

			outScope = inScope.push()
			tabId := outScope.addTable(sq.Name())

			scopeMapping := make(map[sql.ColumnId]sql.Expression)
			var colSet sql.ColSet
			for i, c := range fromScope.cols {
				col := c.col
				if len(renameCols) > 0 {
					col = renameCols[i]
				}
				toId := outScope.newColumn(scopeColumn{
					tableId:     tabId,
					db:          c.db,
					table:       alias,
					col:         col,
					originalCol: c.originalCol,
					id:          0,
					typ:         c.typ,
					nullable:    c.nullable,
				})
				colSet.Add(sql.ColumnId(toId))
				scopeMapping[sql.ColumnId(toId)] = c.scalarGf()
			}
			outScope.node = sq.WithScopeMapping(scopeMapping).WithColumns(colSet).WithId(tabId)
			return
		case *ast.ValuesStatement:
			rowLen := len(e.Rows)
			exprTuples := make([][]sql.Expression, rowLen)
			var tupLen int
			if rowLen > 0 {
				tupLen = len(e.Rows[0])
			}
			for i, vt := range e.Rows {
				if len(vt) != tupLen {
					b.handleErr(sql.ErrColValCountMismatch.New(i + 1))
				}
				exprs := make([]sql.Expression, len(vt))
				exprTuples[i] = exprs
				for j, e := range vt {
					exprs[j] = b.buildScalar(inScope, e)
				}
			}

			outScope = inScope.push()
			vdt := plan.NewValueDerivedTable(plan.NewValues(exprTuples), t.As.String())
			tableName := strings.ToLower(t.As.String())
			tabId := outScope.addTable(tableName)
			var cols sql.ColSet
			for _, c := range vdt.Schema() {
				id := outScope.newColumn(scopeColumn{col: c.Name, db: c.DatabaseSource, table: tableName, typ: c.Type, nullable: c.Nullable})
				cols.Add(sql.ColumnId(id))
			}
			var renameCols []string
			if len(e.Columns) > 0 {
				renameCols = columnsToStrings(e.Columns)
				vdt = vdt.WithColumNames(renameCols)
			}
			b.renameSource(outScope, tableName, renameCols)
			outScope.node = vdt.WithId(tabId).WithColumns(cols)
			return
		default:
			b.handleErr(sql.ErrUnsupportedSyntax.New(ast.String(te)))
		}

	case *ast.TableFuncExpr:
		return b.buildTableFunc(inScope, t)

	case *ast.JoinTableExpr:
		return b.buildJoin(inScope, t)

	case *ast.JSONTableExpr:
		return b.buildJSONTable(inScope, t)

	case *ast.ParenTableExpr:
		if len(t.Exprs) != 1 {
			b.handleErr(sql.ErrUnsupportedSyntax.New(ast.String(t)))
		}
		return b.buildDataSource(inScope, t.Exprs[0])
	default:
		b.handleErr(sql.ErrUnsupportedSyntax.New(ast.String(te)))
	}
	return
}

func columnsToStrings(cols ast.Columns) []string {
	if len(cols) == 0 {
		return nil
	}
	res := make([]string, len(cols))
	for i, c := range cols {
		res[i] = c.String()
	}

	return res
}

func (b *Builder) resolveTable(tab, db string, asOf interface{}) *plan.ResolvedTable {
	var table sql.Table
	var database sql.Database
	var err error
	if asOf != nil {
		table, database, err = b.cat.TableAsOf(b.ctx, db, tab, asOf)
	} else {
		table, database, err = b.cat.Table(b.ctx, db, tab)
	}
	if sql.ErrAsOfNotSupported.Is(err) {
		if asOf != nil {
			b.handleErr(err)
		}
		table, database, err = b.cat.Table(b.ctx, db, tab)
	}
	if err != nil {
		b.handleErr(err)
	}

	if privilegedDatabase, ok := database.(mysql_db.PrivilegedDatabase); ok {
		database = privilegedDatabase.Unwrap()
	}
	return plan.NewResolvedTable(table, database, asOf)
}

func (b *Builder) buildTableFunc(inScope *scope, t *ast.TableFuncExpr) (outScope *scope) {
	//TODO what are valid mysql table arguments
	args := make([]sql.Expression, 0, len(t.Exprs))
	for _, expr := range t.Exprs {
		switch e := expr.(type) {
		case *ast.AliasedExpr:
			scalarExpr := b.buildScalar(inScope, e.Expr)
			args = append(args, scalarExpr)
		default:
			b.handleErr(sql.ErrUnsupportedSyntax.New(ast.String(e)))
		}
	}

	utf := expression.NewUnresolvedTableFunction(t.Name, args)

	tableFunction, found := b.cat.TableFunction(b.ctx, utf.Name())
	if !found {
		// try getting regular function
		f, funcFound := b.cat.Function(b.ctx, utf.Name())
		if !funcFound {
			b.handleErr(sql.ErrTableFunctionNotFound.New(utf.Name()))
		}
		tableFunction = dtablefunctions.NewTableFunctionWrapper(f)
	}

	database := b.currentDb()

	var hasBindVarArgs bool
	for _, arg := range utf.Arguments {
		if _, ok := arg.(*expression.BindVar); ok {
			hasBindVarArgs = true
			break
		}
	}

	outScope = inScope.push()
	outScope.ast = t
	if hasBindVarArgs {
		// TODO deferred tableFunction
	}

	newInstance, err := tableFunction.NewInstance(b.ctx, database, utf.Arguments)
	if err != nil {
		b.handleErr(err)
	}

	if ctf, isCTF := newInstance.(sql.CatalogTableFunction); isCTF {
		newInstance, err = ctf.WithCatalog(b.cat)
		if err != nil {
			b.handleErr(err)
		}
	}
	if authCheckerNode, ok := newInstance.(sql.AuthorizationCheckerNode); ok {
		if err = b.cat.AuthorizationHandler().HandleAuthNode(b.ctx, b.authQueryState, authCheckerNode); err != nil {
			b.handleErr(err)
		}
	}

	// Table Function must always have an alias, pick function name as alias if none is provided
	var name string
	var newAlias plan.TableIdNode
	if t.Alias.IsEmpty() {
		name = t.Name
		newAlias = plan.NewTableAlias(name, newInstance)
	} else {
		name = t.Alias.String()
		newAlias, err = b.f.buildTableAlias(name, newInstance)
		if err != nil {
			b.handleErr(err)
		}
	}

	tabId := outScope.addTable(name)
	var colset sql.ColSet
	for _, c := range newAlias.Schema() {
		id := outScope.newColumn(scopeColumn{
			db:    database.Name(),
			table: name,
			col:   c.Name,
			typ:   c.Type,
		})
		colset.Add(sql.ColumnId(id))
	}
	outScope.node = newAlias.WithColumns(colset).WithId(tabId)
	return
}

func (b *Builder) buildJSONTableCols(inScope *scope, jtSpec *ast.JSONTableSpec) []plan.JSONTableCol {
	var cols []plan.JSONTableCol
	for _, jtColDef := range jtSpec.Columns {
		// nested col defs need to be flattened into multiple colOpts with all paths appended
		if jtColDef.Spec != nil {
			nestedCols := b.buildJSONTableCols(inScope, jtColDef.Spec)
			col := plan.JSONTableCol{
				Path:       jtColDef.Spec.Path,
				NestedCols: nestedCols,
			}
			cols = append(cols, col)
			continue
		}

		typ, err := types.ColumnTypeToType(&jtColDef.Type)
		if err != nil {
			b.handleErr(err)
		}

		var defEmptyVal, defErrorVal sql.Expression
		if jtColDef.Opts.ValOnEmpty == nil {
			defEmptyVal = expression.NewLiteral(nil, types.Null)
		} else {
			defEmptyVal = b.buildScalar(inScope, jtColDef.Opts.ValOnEmpty)
		}

		if jtColDef.Opts.ValOnError == nil {
			defErrorVal = expression.NewLiteral(nil, types.Null)
		} else {
			defErrorVal = b.buildScalar(inScope, jtColDef.Opts.ValOnError)
		}

		col := plan.JSONTableCol{
			Path: jtColDef.Opts.Path,
			Opts: &plan.JSONTableColOpts{
				Name:         jtColDef.Name.String(),
				Type:         typ,
				ForOrd:       bool(jtColDef.Type.Autoincrement),
				Exists:       jtColDef.Opts.Exists,
				DefEmptyVal:  defEmptyVal,
				DefErrorVal:  defErrorVal,
				ErrorOnEmpty: jtColDef.Opts.ErrorOnEmpty,
				ErrorOnError: jtColDef.Opts.ErrorOnError,
			},
		}
		cols = append(cols, col)
	}
	return cols
}

func (b *Builder) buildJSONTable(inScope *scope, t *ast.JSONTableExpr) (outScope *scope) {
	data := b.buildScalar(inScope, t.Data)
	if _, ok := data.(*plan.Subquery); ok {
		b.handleErr(sql.ErrInvalidArgument.New("JSON_TABLE"))
	}

	outScope = inScope.push()
	outScope.ast = t

	alias := strings.ToLower(t.Alias.String())
	tabId := outScope.addTable(alias)
	cols := b.buildJSONTableCols(inScope, t.Spec)
	var colset sql.ColSet
	var recFlatten func(col plan.JSONTableCol)
	recFlatten = func(col plan.JSONTableCol) {
		for _, col := range col.NestedCols {
			recFlatten(col)
		}
		if col.Opts != nil {
			id := outScope.newColumn(scopeColumn{
				table: alias,
				col:   col.Opts.Name,
				typ:   col.Opts.Type,
			})
			colset.Add(sql.ColumnId(id))
		}
	}
	for _, col := range cols {
		recFlatten(col)
	}

	var err error
	jt, err := plan.NewJSONTable(data, t.Spec.Path, alias, cols)
	if err != nil {
		b.handleErr(err)
	}

	outScope.node = jt.WithColumns(colset).WithId(tabId)
	return outScope
}

func (b *Builder) buildTablescan(inScope *scope, tableName ast.TableName, asof *ast.AsOf) (outScope *scope, ok bool) {
	return b.buildResolvedTableForTablename(inScope, tableName, asof)
}

func (b *Builder) buildResolvedTableForTablename(inScope *scope, tableName ast.TableName, asof *ast.AsOf) (outScope *scope, ok bool) {
	return b.buildResolvedTable(inScope, tableName.DbQualifier.String(), tableName.SchemaQualifier.String(), tableName.Name.String(), asof)
}

func (b *Builder) buildResolvedTable(inScope *scope, db, schema, name string, asof *ast.AsOf) (outScope *scope, ok bool) {
	outScope = inScope.push()

	if db == "" {
		db = b.ctx.GetCurrentDatabase()
		if b.ViewCtx().DbName != "" {
			db = b.ViewCtx().DbName
		}

		if db == "" {
			b.handleErr(sql.ErrNoDatabaseSelected.New())
		}
	}

	database, err := b.cat.Database(b.ctx, db)
	if err != nil {
		b.handleErr(err)
	}

	scd, isScd := database.(sql.SchemaDatabase)
	if schema != "" {
		if !isScd {
			b.handleErr(sql.ErrDatabaseSchemasNotSupported.New(database.Name()))
		}
		var schemaFound bool
		database, schemaFound, err = scd.GetSchema(b.ctx, schema)
		if err != nil {
			b.handleErr(err)
		}
		if !schemaFound {
			b.handleErr(sql.ErrDatabaseSchemaNotFound.New(schema))
		}
	} else if isScd && schema == "" {
		// try using builder's current database, if it's SchemaDatabase
		if _, curDbIsScd := b.currentDatabase.(sql.SchemaDatabase); curDbIsScd {
			database = b.currentDatabase
		}
	}

	var asOfLit interface{}
	if asof != nil {
		asOfLit = b.buildAsOfLit(inScope, asof.Time)
	} else if asof := b.ViewCtx().AsOf; asof != nil {
		asOfLit = asof
	} else if asof := b.ProcCtx().AsOf; asof != nil {
		asOfLit = asof
	}

	if view := b.resolveView(name, database, asOfLit); view != nil {
		// TODO: Schema name
		return resolvedViewScope(outScope, view, db, name)
	}

	var tab sql.Table
	var tableResolveErr error
	if asOfLit != nil {
		tab, database, tableResolveErr = b.cat.DatabaseTableAsOf(b.ctx, database, name, asOfLit)
	} else {
		tab, _, tableResolveErr = b.cat.DatabaseTable(b.ctx, database, name)
	}

	if tableResolveErr != nil {
		if sql.ErrDatabaseNotFound.Is(tableResolveErr) {
			if db == "" {
				b.handleErr(sql.ErrNoDatabaseSelected.New())
			}
			b.handleErr(tableResolveErr)
		} else if sql.ErrTableNotFound.Is(tableResolveErr) {
			// If we're in a trigger context, it's ok for a table to be unresolved
			if b.TriggerCtx().Active && !b.TriggerCtx().Call {
				outScope.node = plan.NewUnresolvedTable(name, db)
				b.TriggerCtx().UnresolvedTables = append(b.TriggerCtx().UnresolvedTables, name)
				return outScope, true
			}
			return outScope, false
		} else {
			b.handleErr(tableResolveErr)
		}
	}

	// If we haven't resolved the table at this point, report that and give up
	if tab == nil {
		return outScope, false
	}

	// TODO: this is maybe too broad for this method, we don't need this for some statements
	if tab.Schema().HasVirtualColumns() {
		tab = b.buildVirtualTableScan(db, tab)
	}

	rt := plan.NewResolvedTable(tab, database, asOfLit)
	ct, ok := rt.Table.(sql.CatalogTable)
	if ok {
		rt.Table = ct.AssignCatalog(b.cat)
	}

	tabId := outScope.addTable(strings.ToLower(tab.Name()))
	var cols sql.ColSet

	for _, c := range tab.Schema() {
		id := outScope.newColumn(scopeColumn{
			db:          db,
			table:       strings.ToLower(tab.Name()),
			col:         strings.ToLower(c.Name),
			originalCol: c.Name,
			typ:         c.Type,
			nullable:    c.Nullable,
		})
		cols.Add(sql.ColumnId(id))
	}

	rt = rt.WithId(tabId).WithColumns(cols).(*plan.ResolvedTable)
	outScope.node = rt

	if dt, _ := rt.Table.(sql.DynamicColumnsTable); dt != nil {
		// the columns table has to resolve all columns in every table
		sch, err := dt.AllColumns(b.ctx)
		if err != nil {
			b.handleErr(err)
		}

		var newSch sql.Schema
		startSource := sch[0].Source
		tmpScope := inScope.push()
		for i, c := range sch {
			// bucket schema fragments into colsets for resolving defaults
			newCol := scopeColumn{
				db:          c.DatabaseSource,
				table:       c.Source,
				col:         strings.ToLower(c.Name),
				originalCol: c.Name,
				typ:         c.Type,
				nullable:    c.Nullable,
			}
			if !strings.EqualFold(c.Source, startSource) {
				startSource = c.Source
				tmpSch := b.resolveSchemaDefaults(tmpScope, sch[i-len(tmpScope.cols):i])
				newSch = append(newSch, tmpSch...)
				tmpScope = inScope.push()
			}
			tmpScope.newColumn(newCol)
		}
		if len(tmpScope.cols) > 0 {
			tmpSch := b.resolveSchemaDefaults(tmpScope, sch[len(sch)-len(tmpScope.cols):len(sch)])
			newSch = append(newSch, tmpSch...)
		}
		rt.Table, err = dt.WithDefaultsSchema(newSch)
		if err != nil {
			b.handleErr(err)
		}
	}

	return outScope, true
}

func resolvedViewScope(outScope *scope, view sql.Node, db string, name string) (*scope, bool) {
	outScope.node = view
	tabId := outScope.addTable(strings.ToLower(view.Schema()[0].Name))
	var cols sql.ColSet
	for _, c := range view.Schema() {
		id := outScope.newColumn(scopeColumn{
			db:          db,
			table:       name,
			col:         strings.ToLower(c.Name),
			originalCol: c.Name,
			typ:         c.Type,
			nullable:    c.Nullable,
		})
		cols.Add(sql.ColumnId(id))
	}
	if tin, ok := view.(plan.TableIdNode); ok {
		// TODO should *sql.View implement TableIdNode?
		outScope.node = tin.WithId(tabId).WithColumns(cols)
	}

	return outScope, true
}

func (b *Builder) resolveView(name string, database sql.Database, asOf interface{}) sql.Node {
	var view *sql.View

	if vdb, vok := database.(sql.ViewDatabase); vok {
		viewDef, vdok, err := vdb.GetViewDefinition(b.ctx, name)
		if err != nil {
			b.handleErr(err)
		}
		oldOpts := b.parserOpts
		defer func() {
			b.parserOpts = oldOpts
		}()
		if vdok {
			outerAsOf := b.ViewCtx().AsOf
			outerDb := b.ViewCtx().DbName
			b.ViewCtx().AsOf = asOf
			b.ViewCtx().DbName = database.Name()
			defer func() {
				b.ViewCtx().AsOf = outerAsOf
				b.ViewCtx().DbName = outerDb
			}()
			b.parserOpts = sql.NewSqlModeFromString(viewDef.SqlMode).ParserOptions()
			stmt, _, _, err := b.parser.ParseWithOptions(b.ctx, viewDef.CreateViewStatement, ';', false, b.parserOpts)
			if err != nil {
				b.handleErr(err)
			}
			node, _, err := b.bindOnlyWithDatabase(database, stmt, viewDef.CreateViewStatement)
			if err != nil {
				// TODO: Need to account for non-existing functions or
				//  users without appropriate privilege to the referenced table/column/function.
				if sql.ErrTableNotFound.Is(err) || sql.ErrColumnNotFound.Is(err) {
					// TODO: ALTER VIEW should not return this error
					err = sql.ErrInvalidRefInView.New(database.Name(), name)
				}
				b.handleErr(err)
			}
			create, ok := node.(*plan.CreateView)
			if !ok {
				err = fmt.Errorf("expected create view statement, found: %T", node)
				b.handleErr(err)
			}
			switch n := create.Child.(type) {
			case *plan.SubqueryAlias:
				view = n.AsView(viewDef.CreateViewStatement)
			default:
				view = plan.NewSubqueryAlias(name, create.Definition.TextDefinition, n).AsView(viewDef.CreateViewStatement)
				b.qFlags.Set(sql.QFlagRelSubquery)
			}
		}
	}
	// If we didn't find the view from the database directly, use the in-session registry
	if view == nil {
		view, _ = b.ctx.GetViewRegistry().View(database.Name(), name)
		if view != nil {
			def, _, _ := transform.NodeWithOpaque(view.Definition(), func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
				// TODO this is a hack because the test registry setup is busted, these should always be resolved
				if urt, ok := n.(*plan.UnresolvedTable); ok {
					return b.resolveTable(urt.Name(), urt.Database().Name(), urt.AsOf()), transform.NewTree, nil
				}
				return n, transform.SameTree, nil
			})
			view = view.WithDefinition(def)
		}
	}

	if view == nil {
		return nil
	}

	query := view.Definition().Children()[0]
	n, err := view.Definition().WithChildren(query)
	if err != nil {
		b.handleErr(err)
	}
	return n
}

// bindOnlyWithDatabase sets the current database to given database before binding and sets it back to the original
// database after binding. This function is used for binding a subquery using the same database as the original query.
func (b *Builder) bindOnlyWithDatabase(db sql.Database, stmt ast.Statement, s string) (sql.Node, *sql.QueryFlags, error) {
	curDb := b.currentDb()
	defer func() {
		b.currentDatabase = curDb
	}()
	b.currentDatabase = db
	return b.BindOnly(stmt, s, nil)
}
