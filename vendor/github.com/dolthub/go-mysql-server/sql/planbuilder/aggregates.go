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
	"sort"
	"strings"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function/aggregation"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ ast.Expr = (*aggregateInfo)(nil)

type groupBy struct {
	outScope *scope
	aggs     map[string]scopeColumn
	grouping map[string]bool
	inCols   []scopeColumn
}

func (g *groupBy) addInCol(c scopeColumn) {
	g.inCols = append(g.inCols, c)
}

func (g *groupBy) addOutCol(c scopeColumn) columnId {
	return g.outScope.newColumn(c)
}

func (g *groupBy) hasAggs() bool {
	return len(g.aggs) > 0
}

func (g *groupBy) aggregations() []scopeColumn {
	aggregations := make([]scopeColumn, 0, len(g.aggs))
	for _, agg := range g.aggs {
		aggregations = append(aggregations, agg)
	}
	sort.Slice(aggregations, func(i, j int) bool {
		return aggregations[i].scalar.String() < aggregations[j].scalar.String()
	})
	return aggregations
}

func (g *groupBy) addAggStr(c scopeColumn) {
	if g.aggs == nil {
		g.aggs = make(map[string]scopeColumn)
	}
	g.aggs[strings.ToLower(c.scalar.String())] = c
}

func (g *groupBy) getAggRef(name string) sql.Expression {
	if g.aggs == nil {
		return nil
	}
	ret, _ := g.aggs[name]
	if ret.empty() {
		return nil
	}
	return ret.scalarGf()
}

type aggregateInfo struct {
	ast.Expr
}

func (b *Builder) needsAggregation(fromScope *scope, sel *ast.Select) bool {
	return len(sel.GroupBy) > 0 ||
		(fromScope.groupBy != nil && fromScope.groupBy.hasAggs())
}

func (b *Builder) buildGroupingCols(fromScope, projScope *scope, groupby ast.GroupBy, selects ast.SelectExprs) []sql.Expression {
	// grouping col will either be:
	// 1) alias into targets
	// 2) a column reference
	// 3) an index into selects
	// 4) a simple non-aggregate expression
	groupings := make([]sql.Expression, 0)
	fromScope.initGroupBy()

	g := fromScope.groupBy
	for _, e := range groupby {
		var col scopeColumn
		switch e := e.(type) {
		case *ast.ColName:
			var ok bool
			// GROUP BY binds to column references before projections.
			dbName := strings.ToLower(e.Qualifier.DbQualifier.String())
			tblName := strings.ToLower(e.Qualifier.Name.String())
			colName := strings.ToLower(e.Name.String())
			col, ok = fromScope.resolveColumn(dbName, tblName, colName, true, false)
			if !ok {
				col, ok = projScope.resolveColumn(dbName, tblName, colName, true, true)
			}

			if !ok {
				b.handleErr(sql.ErrColumnNotFound.New(e.Name.String()))
			}
		case *ast.SQLVal:
			// literal -> index into targets
			v, ok := b.normalizeIntVal(e)
			if !ok {
				b.handleErr(fmt.Errorf("expected integer order by literal"))
			}
			idx, _, err := types.Int64.Convert(b.ctx, v)
			if err != nil {
				b.handleErr(err)
			}
			intIdx, ok := idx.(int64)
			if !ok {
				b.handleErr(fmt.Errorf("expected integer order by literal"))
			}
			if intIdx < 1 {
				// TODO: this actually works in MySQL
				b.handleErr(fmt.Errorf("expected positive integer order by literal"))
			}
			if int(intIdx) > len(selects) {
				b.handleErr(fmt.Errorf("column ordinal out of range: %d", intIdx))
			}
			col = projScope.cols[intIdx-1]
		default:
			expr := b.buildScalar(fromScope, e)
			col = scopeColumn{
				col:      expr.String(),
				typ:      nil,
				scalar:   expr,
				nullable: expr.IsNullable(),
			}
		}
		if col.scalar == nil {
			gf := expression.NewGetFieldWithTable(int(col.id), int(col.tableId), col.typ, col.db, col.table, col.col, col.nullable)
			id, ok := fromScope.getExpr(gf.String(), true)
			if !ok {
				err := sql.ErrColumnNotFound.New(gf.String())
				b.handleErr(err)
			}
			col.scalar = gf.WithIndex(int(id))
		}
		g.addInCol(col)
		groupings = append(groupings, col.scalar)
	}

	return groupings
}

func (b *Builder) buildNameConst(fromScope *scope, f *ast.FuncExpr) sql.Expression {
	if len(f.Exprs) != 2 {
		b.handleErr(fmt.Errorf("incorrect parameter count in the call to native function NAME_CONST"))
	}
	alias := b.selectExprToExpression(fromScope, f.Exprs[0])
	aLit, ok := alias.(*expression.Literal)
	if !ok {
		b.handleErr(fmt.Errorf("incorrect arguments to: NAME_CONST"))
	}
	value := b.selectExprToExpression(fromScope, f.Exprs[1])
	vLit, ok := value.(*expression.Literal)
	if !ok {
		b.handleErr(fmt.Errorf("incorrect arguments to: NAME_CONST"))
	}
	var aliasStr string
	if types.IsText(aLit.Type()) {
		aliasStr = strings.Trim(aLit.String(), "'")
	} else {
		aliasStr = aLit.String()
	}
	return expression.NewAlias(aliasStr, vLit)
}

func (b *Builder) buildAggregation(fromScope, projScope *scope, groupingCols []sql.Expression) *scope {
	b.qFlags.Set(sql.QFlagAggregation)

	// GROUP_BY consists of:
	// - input arguments projection
	// - grouping cols projection
	// - aggregate expressions
	// - output projection
	fromScope.initGroupBy()

	group := fromScope.groupBy
	outScope := group.outScope
	// Select dependencies include aggregations and table columns needed for projections, having, and sort (order by)
	var selectDeps []sql.Expression
	var selectGfs []sql.Expression
	selectStr := make(map[string]bool)
	aliasDeps := make(map[string]bool)
	for _, e := range group.aggregations() {
		if !selectStr[strings.ToLower(e.String())] {
			selectDeps = append(selectDeps, e.scalar)
			selectGfs = append(selectGfs, e.scalarGf())
			selectStr[strings.ToLower(e.String())] = true
		}
	}
	var aliases []sql.Expression
	for _, col := range projScope.cols {
		inAlias := false
		// eval aliases in project scope
		switch e := col.scalar.(type) {
		case *expression.Alias:
			if !e.Unreferencable() {
				aliases = append(aliases, e.WithId(sql.ColumnId(col.id)).(*expression.Alias))
				inAlias = true
			}
		default:
		}

		var findSelectDeps func(sql.Expression) bool
		findSelectDeps = func(e sql.Expression) bool {
			switch e := e.(type) {
			case *expression.GetField:
				colName := strings.ToLower(e.String())
				if !selectStr[colName] {
					selectDeps = append(selectDeps, e)
					selectGfs = append(selectGfs, e)
					selectStr[colName] = true
				}

				exprStr := strings.ToLower(e.String())
				if isAliasDep, ok := aliasDeps[exprStr]; !ok && inAlias {
					aliasDeps[exprStr] = true
				} else if isAliasDep && !inAlias {
					aliasDeps[exprStr] = false
				}
			case *plan.Subquery:
				e.Correlated().ForEach(func(colId sql.ColumnId) {
					if correlated, found := projScope.parent.getCol(colId); found {
						findSelectDeps(correlated.scalarGf())
					}
				})
			default:
			}
			return false
		}

		transform.InspectExpr(col.scalar, findSelectDeps)
	}
	for _, e := range fromScope.extraCols {
		// accessory cols used by ORDER_BY, HAVING
		if !selectStr[e.String()] {
			selectDeps = append(selectDeps, e.scalarGf())
			selectGfs = append(selectGfs, e.scalarGf())

			selectStr[e.String()] = true
		}
	}
	gb := plan.NewGroupBy(selectDeps, groupingCols, fromScope.node)
	outScope.node = gb

	if len(aliases) > 0 {
		outScope.node = plan.NewProject(append(selectGfs, aliases...), outScope.node).WithAliasDeps(aliasDeps)
	}
	return outScope
}

// IsAggregateFunc is a hacky "extension point" to allow for other dialects to declare additional aggregate functions
var IsAggregateFunc = IsMySQLAggregateFuncName

func IsMySQLAggregateFuncName(name string) bool {
	switch name {
	case "avg", "bit_and", "bit_or", "bit_xor", "count",
		"group_concat", "json_arrayagg", "json_objectagg",
		"max", "min", "std", "stddev_pop", "stddev_samp",
		"stddev", "sum", "var_pop", "var_samp", "variance",
		"first", "last", "any_value":
		return true
	default:
		return false
	}
}

// buildAggregateFunc tags aggregate functions in the correct scope
// and makes the aggregate available for reference by other clauses.
func (b *Builder) buildAggregateFunc(inScope *scope, name string, e *ast.FuncExpr) sql.Expression {
	if len(inScope.windowFuncs) > 0 {
		err := sql.ErrNonAggregatedColumnWithoutGroupBy.New()
		b.handleErr(err)
	}

	inScope.initGroupBy()
	gb := inScope.groupBy

	if strings.EqualFold(name, "count") {
		if _, ok := e.Exprs[0].(*ast.StarExpr); ok {
			return b.buildCountStarAggregate(e, gb)
		}
	}

	if strings.EqualFold(name, "jsonarray") {
		// TODO we don't have any tests for this
		if _, ok := e.Exprs[0].(*ast.StarExpr); ok {
			return b.buildJsonArrayStarAggregate(gb)
		}
	}

	if strings.EqualFold(name, "any_value") {
		b.qFlags.Set(sql.QFlagAnyAgg)
	}

	args := b.buildAggFunctionArgs(inScope, e, gb)
	agg := b.newAggregation(e, name, args)

	if name == "count" {
		b.qFlags.Set(sql.QFlagCount)
	}

	aggType := agg.Type()
	if name == "avg" || name == "sum" {
		aggType = types.Float64
	}

	aggName := strings.ToLower(plan.AliasSubqueryString(agg))
	if id, ok := gb.outScope.getExpr(aggName, true); ok {
		// if we've already computed use reference here
		gf := expression.NewGetFieldWithTable(int(id), 0, aggType, "", "", aggName, agg.IsNullable())
		return gf
	}

	col := scopeColumn{col: aggName, scalar: agg, typ: aggType, nullable: agg.IsNullable()}
	id := gb.outScope.newColumn(col)

	agg = agg.WithId(sql.ColumnId(id)).(sql.Aggregation)
	gb.outScope.cols[len(gb.outScope.cols)-1].scalar = agg
	col.scalar = agg

	col.id = id
	gb.addAggStr(col)
	return col.scalarGf()
}

// newAggregation creates a new aggregation function instanc from the arguments given
func (b *Builder) newAggregation(e *ast.FuncExpr, name string, args []sql.Expression) sql.Aggregation {
	var agg sql.Aggregation
	if e.Distinct && name == "count" {
		agg = aggregation.NewCountDistinct(args...)
	} else {
		// NOTE: Not all aggregate functions support DISTINCT. Fortunately, the vitess parser will throw
		// errors for when DISTINCT is used on aggregate functions that don't support DISTINCT.
		if e.Distinct {
			if len(e.Exprs) != 1 {
				err := sql.ErrUnsupportedSyntax.New("more than one expression with distinct")
				b.handleErr(err)
			}

			args[0] = expression.NewDistinctExpression(args[0])
		}

		f, ok := b.cat.Function(b.ctx, name)
		if !ok {
			// todo(max): similar names in registry?
			err := sql.ErrFunctionNotFound.New(name)
			b.handleErr(err)
		}

		newInst, err := f.NewInstance(args)
		if err != nil {
			b.handleErr(err)
		}

		agg, ok = newInst.(sql.Aggregation)
		if !ok {
			err := fmt.Errorf("expected function to be aggregation: %s", f.FunctionName())
			b.handleErr(err)
		}
	}
	return agg
}

// buildAggFunctionArgs builds the arguments for an aggregate function
func (b *Builder) buildAggFunctionArgs(inScope *scope, e *ast.FuncExpr, gb *groupBy) []sql.Expression {
	var args []sql.Expression
	for _, arg := range e.Exprs {
		e := b.selectExprToExpression(inScope, arg)
		// if GetField is an alias, alias must be masking a column
		if gf, ok := e.(*expression.GetField); ok && gf.TableId() == 0 {
			e = b.selectExprToExpression(inScope.parent, arg)
		}
		switch e := e.(type) {
		case *expression.GetField:
			if e.TableId() == 0 {
				b.handleErr(fmt.Errorf("failed to resolve aggregate column argument: %s", e))
			}
			args = append(args, e)
			col := scopeColumn{tableId: e.TableID(), db: e.Database(), table: e.Table(), col: e.Name(), scalar: e, typ: e.Type(), nullable: e.IsNullable()}
			gb.addInCol(col)
		case *expression.Star:
			err := sql.ErrStarUnsupported.New()
			b.handleErr(err)
		case *plan.Subquery:
			args = append(args, e)
			col := scopeColumn{col: e.QueryString, scalar: e, typ: e.Type()}
			gb.addInCol(col)
		default:
			args = append(args, e)
			col := scopeColumn{col: e.String(), scalar: e, typ: e.Type()}
			gb.addInCol(col)
		}
	}
	return args
}

// buildJsonArrayStarAggregate builds a JSON_ARRAY(*) aggregate function
func (b *Builder) buildJsonArrayStarAggregate(gb *groupBy) sql.Expression {
	var agg sql.Aggregation
	agg = aggregation.NewJsonArray(expression.NewLiteral(expression.NewStar(), types.Int64))
	b.qFlags.Set(sql.QFlagStar)

	// if e.Distinct {
	//	agg = plan.NewDistinct(expression.NewLiteral(1, types.Int64))
	// }
	aggName := strings.ToLower(agg.String())
	gf := gb.getAggRef(aggName)
	if gf != nil {
		// if we've already computed use reference here
		return gf
	}

	col := scopeColumn{col: strings.ToLower(agg.String()), scalar: agg, typ: agg.Type(), nullable: agg.IsNullable()}
	id := gb.outScope.newColumn(col)

	agg = agg.WithId(sql.ColumnId(id)).(*aggregation.JsonArray)
	gb.outScope.cols[len(gb.outScope.cols)-1].scalar = agg
	col.scalar = agg

	col.id = id
	gb.addAggStr(col)
	return col.scalarGf()
}

// buildCountStarAggregate builds a COUNT(*) aggregate function
func (b *Builder) buildCountStarAggregate(e *ast.FuncExpr, gb *groupBy) sql.Expression {
	var agg sql.Aggregation
	if e.Distinct {
		agg = aggregation.NewCountDistinct(expression.NewLiteral(1, types.Int64))
	} else {
		agg = aggregation.NewCount(expression.NewLiteral(1, types.Int64))
	}
	b.qFlags.Set(sql.QFlagCountStar)
	aggName := strings.ToLower(agg.String())
	gf := gb.getAggRef(aggName)
	if gf != nil {
		// if we've already computed use reference here
		return gf
	}

	col := scopeColumn{col: strings.ToLower(agg.String()), scalar: agg, typ: agg.Type(), nullable: agg.IsNullable()}
	id := gb.outScope.newColumn(col)
	col.id = id

	agg = agg.WithId(sql.ColumnId(id)).(sql.Aggregation)
	gb.outScope.cols[len(gb.outScope.cols)-1].scalar = agg
	col.scalar = agg

	gb.addAggStr(col)
	return col.scalarGf()
}

// buildGroupConcat builds a GROUP_CONCAT aggregate function
func (b *Builder) buildGroupConcat(inScope *scope, e *ast.GroupConcatExpr) sql.Expression {
	inScope.initGroupBy()
	gb := inScope.groupBy

	args := make([]sql.Expression, len(e.Exprs))
	for i, a := range e.Exprs {
		args[i] = b.selectExprToExpression(inScope, a)
	}

	separatorS := ","
	if !e.Separator.DefaultSeparator {
		separatorS = e.Separator.SeparatorString
	}

	orderByScope := b.analyzeOrderBy(inScope, inScope, e.OrderBy)
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

	// TODO: this should be acquired at runtime, not at parse time, so fix this
	gcml, err := b.ctx.GetSessionVariable(b.ctx, "group_concat_max_len")
	if err != nil {
		b.handleErr(err)
	}
	groupConcatMaxLen := gcml.(uint64)

	// todo store ref to aggregate
	agg := aggregation.NewGroupConcat(e.Distinct, sortFields, separatorS, args, int(groupConcatMaxLen))
	aggName := strings.ToLower(plan.AliasSubqueryString(agg))
	col := scopeColumn{col: aggName, scalar: agg, typ: agg.Type(), nullable: agg.IsNullable()}

	id := gb.outScope.newColumn(col)

	agg = agg.WithId(sql.ColumnId(id)).(*aggregation.GroupConcat)
	gb.outScope.cols[len(gb.outScope.cols)-1].scalar = agg
	col.scalar = agg

	gb.addAggStr(col)
	col.id = id
	return col.scalarGf()
}

// buildOrderedInjectedExpr builds an InjectedExpr with an ORDER BY dependency
func (b *Builder) buildOrderedInjectedExpr(inScope *scope, e *ast.OrderedInjectedExpr) sql.Expression {
	inScope.initGroupBy()
	gb := inScope.groupBy

	var resolvedChildren []any
	if len(e.Children) > 0 {
		resolvedChildren = make([]any, len(e.Children))
		for i, child := range e.Children {
			resolvedChildren[i] = b.buildScalar(inScope, child)
		}
	} else {
		resolvedChildren = make([]any, len(e.SelectExprChildren))
		for i, child := range e.SelectExprChildren {
			resolvedChildren[i] = b.selectExprToExpression(inScope, child)
		}
	}

	orderByScope := b.analyzeOrderBy(inScope, inScope, e.OrderBy)
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

	resolvedChildren = append(resolvedChildren, sortFields)

	expr := b.buildInjectedExpressionFromResolvedChildren(e.InjectedExpr, resolvedChildren)
	agg, ok := expr.(sql.Aggregation)
	if !ok {
		b.handleErr(fmt.Errorf("expected sql.Aggregation, got %T", expr))
	}

	aggName := strings.ToLower(plan.AliasSubqueryString(agg))
	col := scopeColumn{col: aggName, scalar: agg, typ: agg.Type(), nullable: agg.IsNullable()}
	id := gb.outScope.newColumn(col)

	agg = agg.WithId(sql.ColumnId(id)).(sql.Aggregation)
	gb.outScope.cols[len(gb.outScope.cols)-1].scalar = agg
	col.scalar = agg

	gb.addAggStr(col)
	col.id = id
	return col.scalarGf()
}

func isWindowFunc(name string) bool {
	switch name {
	case "first", "last", "count", "sum", "any_value",
		"avg", "max", "min", "count_distinct", "json_arrayagg",
		"row_number", "percent_rank", "lead", "lag",
		"first_value", "last_value",
		"rank", "dense_rank",
		"ntile",
		"std", "stddev", "stddev_pop", "stddev_samp",
		"variance", "var_pop", "var_samp":
		return true
	default:
		return false
	}
}

func (b *Builder) buildWindowFunc(inScope *scope, name string, e *ast.FuncExpr, over *ast.WindowDef) sql.Expression {
	if inScope.groupBy != nil {
		err := sql.ErrNonAggregatedColumnWithoutGroupBy.New()
		b.handleErr(err)
	}

	// internal expressions can be complex, but window can't be more than alias
	var args []sql.Expression
	for _, arg := range e.Exprs {
		e := b.selectExprToExpression(inScope, arg)
		args = append(args, e)
	}

	var win sql.WindowAdaptableExpression
	if name == "count" {
		if _, ok := e.Exprs[0].(*ast.StarExpr); ok {
			win = aggregation.NewCount(expression.NewLiteral(1, types.Int64))
			b.qFlags.Set(sql.QFlagCountStar)
		}
	}
	if win == nil {
		f, ok := b.cat.Function(b.ctx, name)
		if !ok {
			// todo(max): similar names in registry?
			err := sql.ErrFunctionNotFound.New(name)
			b.handleErr(err)
		}

		newInst, err := f.NewInstance(args)

		win, ok = newInst.(sql.WindowAdaptableExpression)
		if !ok {
			err := fmt.Errorf("function is not a window adaptable exprssion: %s", f.FunctionName())
			b.handleErr(err)
		}
		if err != nil {
			b.handleErr(err)
		}
	}

	def := b.buildWindowDef(inScope, over)
	switch w := win.(type) {
	case sql.WindowAdaptableExpression:
		win = w.WithWindow(def)
	}

	col := scopeColumn{col: strings.ToLower(win.String()), scalar: win, typ: win.Type(), nullable: win.IsNullable()}
	id := inScope.newColumn(col)
	col.id = id
	win = win.WithId(sql.ColumnId(id)).(sql.WindowAdaptableExpression)
	inScope.cols[len(inScope.cols)-1].scalar = win
	col.scalar = win
	inScope.windowFuncs = append(inScope.windowFuncs, col)
	return col.scalarGf()
}

func (b *Builder) buildWindow(fromScope, projScope *scope) *scope {
	if len(fromScope.windowFuncs) == 0 {
		return fromScope
	}
	// passthrough dependency cols plus window funcs
	var selectExprs []sql.Expression
	var selectGfs []sql.Expression
	selectStr := make(map[string]bool)
	for _, col := range fromScope.windowFuncs {
		e := col.scalar
		if !selectStr[strings.ToLower(e.String())] {
			switch e.(type) {
			case sql.WindowAdaptableExpression:
				selectStr[strings.ToLower(e.String())] = true
				selectExprs = append(selectExprs, e)
				selectGfs = append(selectGfs, col.scalarGf())
			default:
				err := fmt.Errorf("expected window function to be sql.WindowAggregation")
				b.handleErr(err)
			}
		}
	}
	var aliases []sql.Expression
	for _, col := range projScope.cols {
		// eval aliases in project scope
		switch e := col.scalar.(type) {
		case *expression.Alias:
			if !e.Unreferencable() {
				aliases = append(aliases, e.WithId(sql.ColumnId(col.id)).(*expression.Alias))
			}
		default:
		}

		// projection dependencies -> table cols needed above
		transform.InspectExpr(col.scalar, func(e sql.Expression) bool {
			switch e := e.(type) {
			case *expression.GetField:
				colName := strings.ToLower(e.String())
				if !selectStr[colName] {
					selectExprs = append(selectExprs, e)
					selectGfs = append(selectGfs, e)
					selectStr[colName] = true
				}
			default:
			}
			return false
		})
	}
	for _, e := range fromScope.extraCols {
		// accessory cols used by ORDER_BY, HAVING
		if !selectStr[e.String()] {
			selectExprs = append(selectExprs, e.scalarGf())
			selectGfs = append(selectGfs, e.scalarGf())
			selectStr[e.String()] = true
		}
	}

	outScope := fromScope
	window := plan.NewWindow(selectExprs, fromScope.node)
	fromScope.node = window

	if len(aliases) > 0 {
		outScope.node = plan.NewProject(append(selectGfs, aliases...), outScope.node)
	}

	return outScope
}

func (b *Builder) buildNamedWindows(fromScope *scope, window ast.Window) {
	// topo sort first
	adj := make(map[string]*ast.WindowDef)
	for _, w := range window {
		adj[w.Name.Lowered()] = w
	}

	var topo []*ast.WindowDef
	var seen map[string]bool
	var dfs func(string)
	dfs = func(name string) {
		if ok, _ := seen[name]; ok {
			b.handleErr(sql.ErrCircularWindowInheritance.New())
		}
		seen[name] = true
		cur := adj[name]
		if ref := cur.NameRef.Lowered(); ref != "" {
			dfs(ref)
		}
		topo = append(topo, cur)
	}
	for _, w := range adj {
		seen = make(map[string]bool)
		dfs(w.Name.Lowered())
	}

	fromScope.windowDefs = make(map[string]*sql.WindowDefinition)
	for _, w := range topo {
		fromScope.windowDefs[w.Name.Lowered()] = b.buildWindowDef(fromScope, w)
	}
	return
}

func (b *Builder) buildWindowDef(fromScope *scope, def *ast.WindowDef) *sql.WindowDefinition {
	if def == nil {
		return nil
	}

	var sortFields sql.SortFields
	for _, c := range def.OrderBy {
		// resolve col in fromScope
		e := b.buildScalar(fromScope, c.Expr)
		so := sql.Ascending
		if c.Direction == ast.DescScr {
			so = sql.Descending
		}
		sf := sql.SortField{
			Column: e,
			Order:  so,
		}
		sortFields = append(sortFields, sf)
	}

	partitions := make([]sql.Expression, len(def.PartitionBy))
	for i, expr := range def.PartitionBy {
		partitions[i] = b.buildScalar(fromScope, expr)
	}

	frame := b.NewFrame(fromScope, def.Frame)

	// According to MySQL documentation at https://dev.mysql.com/doc/refman/8.0/en/window-functions-usage.html
	// "If OVER() is empty, the window consists of all query rows and the window function computes a result using all rows."
	if def.OrderBy == nil && frame == nil {
		frame = plan.NewRowsUnboundedPrecedingToUnboundedFollowingFrame()
	}

	windowDef := sql.NewWindowDefinition(partitions, sortFields, frame, def.NameRef.Lowered(), def.Name.Lowered())
	if ref, ok := fromScope.windowDefs[def.NameRef.Lowered()]; ok {
		// this is only safe if windows are built in topo order
		windowDef = b.mergeWindowDefs(windowDef, ref)
		// collapse dependencies if any reference this window
		fromScope.windowDefs[windowDef.Name] = windowDef
	}
	return windowDef
}

// mergeWindowDefs combines the attributes of two window definitions or returns
// an error if the two are incompatible. [def] should have a reference to
// [ref] through [def.Ref], and the return value drops the reference to indicate
// the two were properly combined.
func (b *Builder) mergeWindowDefs(def, ref *sql.WindowDefinition) *sql.WindowDefinition {
	if ref.Ref != "" {
		panic("unreachable; cannot merge unresolved window definition")
	}

	var orderBy sql.SortFields
	switch {
	case len(def.OrderBy) > 0 && len(ref.OrderBy) > 0:
		err := sql.ErrInvalidWindowInheritance.New("", "", "both contain order by clause")
		b.handleErr(err)
	case len(def.OrderBy) > 0:
		orderBy = def.OrderBy
	case len(ref.OrderBy) > 0:
		orderBy = ref.OrderBy
	default:
	}

	var partitionBy []sql.Expression
	switch {
	case len(def.PartitionBy) > 0 && len(ref.PartitionBy) > 0:
		err := sql.ErrInvalidWindowInheritance.New("", "", "both contain partition by clause")
		b.handleErr(err)
	case len(def.PartitionBy) > 0:
		partitionBy = def.PartitionBy
	case len(ref.PartitionBy) > 0:
		partitionBy = ref.PartitionBy
	default:
		partitionBy = []sql.Expression{}
	}

	var frame sql.WindowFrame
	switch {
	case def.Frame != nil && ref.Frame != nil:
		_, isDefDefaultFrame := def.Frame.(*plan.RowsUnboundedPrecedingToUnboundedFollowingFrame)
		_, isRefDefaultFrame := ref.Frame.(*plan.RowsUnboundedPrecedingToUnboundedFollowingFrame)

		// if both frames are set and one is RowsUnboundedPrecedingToUnboundedFollowingFrame (default),
		// we should use the other frame
		if isDefDefaultFrame {
			frame = ref.Frame
		} else if isRefDefaultFrame {
			frame = def.Frame
		} else {
			// if both frames have identical string representations, use either one
			df := def.Frame.String()
			rf := ref.Frame.String()
			if df != rf {
				err := sql.ErrInvalidWindowInheritance.New("", "", "both contain different frame clauses")
				b.handleErr(err)
			}
			frame = def.Frame
		}
	case def.Frame != nil:
		frame = def.Frame
	case ref.Frame != nil:
		frame = ref.Frame
	default:
	}

	return sql.NewWindowDefinition(partitionBy, orderBy, frame, "", def.Name)
}

func (b *Builder) analyzeHaving(fromScope, projScope *scope, having *ast.Where) {
	// build having filter expr
	// aggregates added to fromScope.groupBy
	// can see projScope outputs
	if having == nil {
		return
	}

	ast.Walk(func(node ast.SQLNode) (bool, error) {
		switch n := node.(type) {
		case *ast.Subquery:
			return false, nil
		case *ast.FuncExpr:
			name := n.Name.Lowered()
			if IsAggregateFunc(name) {
				// record aggregate
				// TODO: this should get projScope as well
				_ = b.buildAggregateFunc(fromScope, name, n)
			} else if isWindowFunc(name) {
				_ = b.buildWindowFunc(fromScope, name, n, (*ast.WindowDef)(n.Over))
			}
		case *ast.ColName:
			// add to extra cols
			dbName := strings.ToLower(n.Qualifier.DbQualifier.String())
			tblName := strings.ToLower(n.Qualifier.Name.String())
			colName := strings.ToLower(n.Name.String())
			c, ok := fromScope.resolveColumn(dbName, tblName, colName, true, false)
			if ok {
				c.scalar = expression.NewGetFieldWithTable(int(c.id), 0, c.typ, c.db, c.table, c.col, c.nullable)
				fromScope.addExtraColumn(c)
				break
			}
			c, ok = projScope.resolveColumn(dbName, tblName, colName, false, true)
			if ok {
				// references projection alias
				break
			}
			err := sql.ErrColumnNotFound.New(n.Name)
			b.handleErr(err)
		}
		return true, nil
	}, having.Expr)
}

func (b *Builder) buildInnerProj(fromScope, projScope *scope) *scope {
	outScope := fromScope
	var proj []sql.Expression

	// eval aliases in project scope
	for _, col := range projScope.cols {
		switch e := col.scalar.(type) {
		case *expression.Alias:
			if !e.Unreferencable() {
				proj = append(proj, e.WithId(sql.ColumnId(col.id)).(*expression.Alias))
			}
		}
	}

	aliasCnt := len(proj)

	if len(proj) == 0 && !(len(fromScope.cols) == 1 && fromScope.cols[0].id == 0) {
		// remove redundant projection unless it is the single dual table column
		return outScope
	}

	for _, c := range fromScope.cols {
		proj = append(proj, c.scalarGf())
	}

	// todo: fulltext indexes depend on match alias first
	proj = append(proj[aliasCnt:], proj[:aliasCnt]...)

	if len(proj) > 0 {
		outScope.node = plan.NewProject(proj, outScope.node)
	}

	return outScope
}

// getMatchingCol returns the column in cols that matches the name, if it exists
func getMatchingCol(cols []scopeColumn, name string) (scopeColumn, bool) {
	for _, c := range cols {
		if strings.EqualFold(c.col, name) {
			return c, true
		}
	}
	return scopeColumn{}, false
}

func (b *Builder) buildHaving(fromScope, projScope, outScope *scope, having *ast.Where) {
	// expressions in having can be from aggOut or projScop
	if having == nil {
		return
	}
	fromScope.initGroupBy()

	havingScope := b.newScope()
	if fromScope.parent != nil {
		havingScope.parent = fromScope.parent
		havingScope.parent.selectAliases = fromScope.selectAliases
	}

	// add columns from fromScope referenced in the groupBy
	for _, c := range fromScope.groupBy.inCols {
		if !havingScope.colset.Contains(sql.ColumnId(c.id)) {
			havingScope.addColumn(c)
		}
	}

	// add columns from fromScope referenced in any aggregate expressions
	for _, c := range fromScope.groupBy.aggregations() {
		transform.InspectExpr(c.scalar, func(e sql.Expression) bool {
			switch e := e.(type) {
			case *expression.GetField:
				col, found := getMatchingCol(fromScope.cols, e.Name())
				if found && !havingScope.colset.Contains(sql.ColumnId(col.id)) {
					havingScope.addColumn(col)
				}
			}
			return false
		})
	}

	// Add columns from projScope referenced in any aggregate expressions, that are not already in the havingScope
	// This prevents aliases with the same name from overriding columns in the fromScope
	// Additionally, the original name from plain aliases (not expressions) are added to havingScope
	for _, c := range projScope.cols {
		if !havingScope.colset.Contains(sql.ColumnId(c.id)) {
			havingScope.addColumn(c)
		}
		// The unaliased column is allowed in having clauses regardless if it is just an aliased getfield and not an expression
		alias, isAlias := c.scalar.(*expression.Alias)
		if !isAlias {
			continue
		}
		gf, isGetField := alias.Child.(*expression.GetField)
		if !isGetField {
			continue
		}
		col, found := getMatchingCol(fromScope.cols, gf.Name())
		if found && !havingScope.colset.Contains(sql.ColumnId(col.id)) {
			havingScope.addColumn(col)
		}
	}

	havingScope.groupBy = fromScope.groupBy
	h := b.buildScalar(havingScope, having.Expr)
	outScope.node = plan.NewHaving(h, outScope.node)
	return
}
