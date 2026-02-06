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
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

const OnDupValuesPrefix = "__new_ins"

func (b *Builder) buildInsert(inScope *scope, i *ast.Insert) (outScope *scope) {
	// TODO: this shouldn't be called during ComPrepare or `PREPARE ... FROM ...` statements, but currently it is.
	//   The end result is that the ComDelete counter is incremented during prepare statements, which is incorrect.
	sql.IncrementStatusVariable(b.ctx, "Com_insert", 1)
	b.qFlags.Set(sql.QFlagInsert)

	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, i.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	if i.With != nil {
		inScope = b.buildWith(inScope, i.With)
	}

	destScope, ok := b.buildResolvedTableForTablename(inScope, i.Table, nil)
	if !ok {
		b.handleErr(sql.ErrTableNotFound.New(i.Table.Name.String()))
	}
	var db sql.Database
	var rt *plan.ResolvedTable
	switch n := destScope.node.(type) {
	case *plan.ResolvedTable:
		rt = n
		db = rt.SqlDatabase
	case *plan.UnresolvedTable:
		db = n.Database()
	default:
		b.handleErr(fmt.Errorf("expected insert destination to be resolved or unresolved table"))
	}
	if rt == nil {
		if b.TriggerCtx().Active && !b.TriggerCtx().Call {
			b.TriggerCtx().UnresolvedTables = append(b.TriggerCtx().UnresolvedTables, i.Table.Name.String())
		} else {
			err := fmt.Errorf("expected resolved table: %s", i.Table.Name.String())
			b.handleErr(err)
		}
	}
	isReplace := i.Action == ast.ReplaceStr

	var columns []string
	{
		columns = columnsToStrings(i.Columns)
		// If no column names were specified in the query, go ahead and fill
		// them all in now that the destination is resolved.
		// TODO: setting the plan field directly is not great
		if len(columns) == 0 && len(destScope.cols) > 0 && rt != nil {
			schema := rt.Schema()
			columns = make([]string, len(schema))
			for i, col := range schema {
				columns[i] = col.Name
			}
		}
	}
	sch := destScope.node.Schema()
	if rt != nil {
		sch = b.resolveSchemaDefaults(destScope, rt.Schema())
	}

	insertRows := i.Rows

	// We need to give a table name to the scope of the values being inserted. We use the row alias if provided, otherwise go with a default.
	// If the row alias also provided column names, we create a map from the destination names to the aliases. This will allow us to
	// rewrite VALUES() function expressions to use the new column names.
	inScope.insertTableAlias = OnDupValuesPrefix
	if aliasedValues, ok := insertRows.(*ast.AliasedValues); ok {
		valueTableName := aliasedValues.As.String()
		if valueTableName != "" {
			inScope.insertTableAlias = valueTableName
		}
		if len(aliasedValues.Columns) > 0 {
			inScope.insertColumnAliases = make(map[string]string)
			for i, destColumn := range columns {
				sourceColumn := aliasedValues.Columns[i].Lowered()
				inScope.insertColumnAliases[destColumn] = sourceColumn
			}
		}
	}

	srcScope, srcLiteralOnly := b.insertRowsToNode(inScope, insertRows, columns, i.Table.Name.String(), sch)

	var onDupExprs []sql.Expression
	if len(i.OnDup) > 0 {
		// TODO: on duplicate expressions need to reference both VALUES and
		//  derived columns equally in ON DUPLICATE UPDATE expressions.
		combinedScope := inScope.replace()
		combinedScope.insertTableAlias = inScope.insertTableAlias
		combinedScope.insertColumnAliases = inScope.insertColumnAliases
		for i, c := range destScope.cols {
			combinedScope.newColumn(c)
			// if the srcScope is empty, it is a values statement
			if len(srcScope.cols) == 0 {
				// The to-be-inserted values can be referenced via the provided alias.
				c.table = combinedScope.insertTableAlias
				if len(combinedScope.insertColumnAliases) > 0 {
					aliasColumnName := combinedScope.insertColumnAliases[c.col]
					c.col = aliasColumnName
					c.originalCol = aliasColumnName
				}
				combinedScope.newColumn(c)
				continue
			}
			if i < len(srcScope.cols) {
				combinedScope.newColumn(srcScope.cols[i])
			}
		}
		onDupExprs = b.buildOnDupUpdateExprs(combinedScope, destScope, ast.AssignmentExprs(i.OnDup))
	}

	ignore := false
	// TODO: make this a bool in vitess
	if strings.Contains(strings.ToLower(i.Ignore), "ignore") {
		ignore = true
	}

	dest := destScope.node

	ins := plan.NewInsertInto(db, plan.NewInsertDestination(sch, dest), srcScope.node, isReplace, columns, onDupExprs, ignore)
	ins.LiteralValueSource = srcLiteralOnly

	if len(i.Returning) > 0 {
		// TODO: read returning results from outScope instead of ins.Returning so that there is no need to return list
		// of expressions
		ins.Returning = b.analyzeSelectList(destScope, destScope, i.Returning)
	}

	b.validateInsert(ins)

	outScope = destScope
	outScope.node = ins
	if rt != nil {
		checks := b.loadChecksFromTable(destScope, rt.Table)
		outScope.node = ins.WithChecks(checks)
	}

	return
}

func (b *Builder) insertRowsToNode(inScope *scope, ir ast.InsertRows, columnNames []string, tableName string, destSchema sql.Schema) (outScope *scope, literalOnly bool) {
	switch v := ir.(type) {
	case ast.SelectStatement:
		outScope = b.buildSelectStmt(inScope, v)
	case *ast.AliasedValues:
		outScope, literalOnly = b.buildInsertValues(inScope, v, columnNames, tableName, destSchema)
	default:
		err := sql.ErrUnsupportedSyntax.New(ast.String(ir))
		b.handleErr(err)
	}
	return
}

func (b *Builder) buildInsertValues(inScope *scope, v *ast.AliasedValues, columnNames []string, tableName string, destSchema sql.Schema) (outScope *scope, literalOnly bool) {
	columnDefaultValues := make([]*sql.ColumnDefaultValue, len(columnNames))

	for i, columnName := range columnNames {
		index := destSchema.IndexOfColName(columnName)
		if index == -1 {
			if !b.TriggerCtx().Call && len(b.TriggerCtx().UnresolvedTables) > 0 {
				continue
			}
			err := sql.ErrUnknownColumn.New(columnName, tableName)
			b.handleErr(err)
		}

		columnDefaultValues[i] = destSchema[index].Default
		if columnDefaultValues[i] == nil && destSchema[index].Generated != nil {
			columnDefaultValues[i] = destSchema[index].Generated
		}
	}

	if !v.As.IsEmpty() {
		if len(v.Columns) != 0 {
			for _, tuple := range v.Values {
				if len(v.Columns) != len(tuple) {
					err := sql.ErrColumnCountMismatch.New()
					b.handleErr(err)
				}
			}
		}
	}

	literalOnly = true
	exprTuples := make([][]sql.Expression, len(v.Values))
	for i, vt := range v.Values {
		// noExprs is an edge case where we fill VALUES with nil expressions
		noExprs := len(vt) == 0
		// triggerUnknownTable is an edge case where we ignored an unresolved
		// table error and do not have a schema for resolving defaults
		triggerUnknownTable := (len(columnNames) == 0 && len(vt) > 0) && (len(b.TriggerCtx().UnresolvedTables) > 0)

		if len(vt) != len(columnNames) && !noExprs && !triggerUnknownTable {
			err := sql.ErrInsertIntoMismatchValueCount.New()
			b.handleErr(err)
		}
		exprs := make([]sql.Expression, len(columnNames))
		exprTuples[i] = exprs
		for j := range columnNames {
			if noExprs || triggerUnknownTable {
				exprs[j] = expression.WrapExpression(columnDefaultValues[j])
				continue
			}
			e := vt[j]
			switch e := e.(type) {
			case *ast.Default:
				exprs[j] = expression.WrapExpression(columnDefaultValues[j])
				// explicit DEFAULT values need their column indexes assigned early, since we analyze the insert values in
				// isolation (no access to the destination schema)
				exprs[j] = assignColumnIndexes(exprs[j], reorderSchema(columnNames, destSchema))
			case *ast.SQLVal:
				// In the case of an unknown bindvar, give it a target type of the column it's targeting.
				// We only do this for simple bindvars in tuples, not expressions that contain bindvars.
				if b.shouldAssignBindvarType(e) {
					name := strings.TrimPrefix(string(e.Val), ":")
					bindVar := expression.NewBindVar(name)
					bindVar.Typ = reorderSchema(columnNames, destSchema)[j].Type
					exprs[j] = bindVar
				} else {
					exprs[j] = b.buildScalar(inScope, e)
				}
			default:
				literalOnly = false
				exprs[j] = b.buildScalar(inScope, e)
			}
		}
	}

	outScope = inScope.push()
	outScope.node = plan.NewValuesWithAlias(v.As.String(), inScope.insertColumnAliases, exprTuples)
	return
}

func (b *Builder) shouldAssignBindvarType(e *ast.SQLVal) bool {
	return e.Type == ast.ValArg && (b.bindCtx == nil || b.bindCtx.resolveOnly)
}

// reorderSchema returns the schemas columns in the order specified by names
func reorderSchema(names []string, schema sql.Schema) sql.Schema {
	newSch := make(sql.Schema, len(names))
	for i, name := range names {
		newSch[i] = schema[schema.IndexOfColName(name)]
	}
	return newSch
}

func (b *Builder) assignmentExprsToExpressions(inScope *scope, e ast.AssignmentExprs) []sql.Expression {
	updateExprs := make([]sql.Expression, len(e))
	var startAggCnt int
	if inScope.groupBy != nil {
		startAggCnt = len(inScope.groupBy.aggs)
	}
	var startWinCnt int
	if inScope.windowFuncs != nil {
		startWinCnt = len(inScope.windowFuncs)
	}

	tableSch := b.resolveSchemaDefaults(inScope, inScope.node.Schema())

	for i, updateExpr := range e {
		colName := b.buildScalar(inScope, updateExpr.Name)

		innerExpr := b.buildScalar(inScope, updateExpr.Expr)
		if gf, ok := colName.(*expression.GetField); ok {
			colIdx := tableSch.IndexOfColName(gf.Name())
			// TODO: during trigger parsing the table in the node is unresolved, so we need this additional bounds check
			//  This means that trigger execution will be able to update generated columns

			// Check if this is a DEFAULT expression for a generated column
			_, isDefaultExpr := updateExpr.Expr.(*ast.Default)

			// Prevent update of generated columns, but allow DEFAULT
			if colIdx >= 0 && tableSch[colIdx].Generated != nil && !isDefaultExpr {
				err := sql.ErrGeneratedColumnValue.New(tableSch[colIdx].Name, inScope.node.(sql.NameableNode).Name())
				b.handleErr(err)
			}

			// Replace default with column default from resolved schema
			if isDefaultExpr {
				if colIdx >= 0 {
					// For generated columns, use the generated expression as the default
					if tableSch[colIdx].Generated != nil {
						innerExpr = expression.WrapExpression(tableSch[colIdx].Generated)
					} else {
						innerExpr = expression.WrapExpression(tableSch[colIdx].Default)
					}
				}
			}
		}

		// In the case of an unknown bindvar, give it a target type of the column it's targeting.
		// We only do this for simple bindvars in tuples, not expressions that contain bindvars.
		if innerSqlVal, ok := updateExpr.Expr.(*ast.SQLVal); ok && b.shouldAssignBindvarType(innerSqlVal) {
			if typ, ok := hasColumnType(colName); ok {
				rightBindVar := innerExpr.(*expression.BindVar)
				rightBindVar.Typ = typ
				innerExpr = rightBindVar
			}
		}

		updateExprs[i] = expression.NewSetField(colName, innerExpr)
		if inScope.groupBy != nil {
			if len(inScope.groupBy.aggs) > startAggCnt {
				err := sql.ErrAggregationUnsupported.New(updateExprs[i])
				b.handleErr(err)
			}
		}
		if inScope.windowFuncs != nil {
			if len(inScope.windowFuncs) > startWinCnt {
				err := sql.ErrWindowUnsupported.New(updateExprs[i])
				b.handleErr(err)
			}
		}
	}

	// We need additional update expressions for any generated columns and on update expressions, since they won't be part of the update
	// expressions, but their value in the row must be updated before being passed to the integrator for storage.
	if len(tableSch) > 0 {
		tabId := inScope.tables[strings.ToLower(tableSch[0].Source)]
		for i, col := range tableSch {
			if col.Generated != nil {
				colGf := expression.NewGetFieldWithTable(i+1, int(tabId), col.Type, col.DatabaseSource, col.Source, col.Name, col.Nullable)
				generated := b.resolveColumnDefaultExpression(inScope, col, col.Generated)
				updateExprs = append(updateExprs, expression.NewSetField(colGf, assignColumnIndexes(generated, tableSch)))
			}
			if col.OnUpdate != nil {
				// don't add if column is already being updated
				if !isColumnUpdated(col, updateExprs) {
					colGf := expression.NewGetFieldWithTable(i+1, int(tabId), col.Type, col.DatabaseSource, col.Source, col.Name, col.Nullable)
					onUpdate := b.resolveColumnDefaultExpression(inScope, col, col.OnUpdate)
					updateExprs = append(updateExprs, expression.NewSetField(colGf, assignColumnIndexes(onUpdate, tableSch)))
				}
			}
		}
	}

	return updateExprs
}

func isColumnUpdated(col *sql.Column, updateExprs []sql.Expression) bool {
	for _, expr := range updateExprs {
		sf, ok := expr.(*expression.SetField)
		if !ok {
			continue
		}
		gf, ok := sf.LeftChild.(*expression.GetField)
		if !ok {
			continue
		}
		if strings.EqualFold(gf.Name(), col.Name) {
			return true
		}
	}
	return false
}

func (b *Builder) buildOnDupUpdateExprs(combinedScope, destScope *scope, e ast.AssignmentExprs) []sql.Expression {
	b.insertActive = true
	defer func() {
		b.insertActive = false
	}()
	res := make([]sql.Expression, len(e))
	// todo(max): prevent aggregations in separate semantic walk step
	var startAggCnt int
	if combinedScope.groupBy != nil {
		startAggCnt = len(combinedScope.groupBy.aggs)
	}
	var startWinCnt int
	if combinedScope.windowFuncs != nil {
		startWinCnt = len(combinedScope.windowFuncs)
	}
	for i, updateExpr := range e {
		colName := b.buildOnDupLeft(destScope, updateExpr.Name)
		innerExpr := b.buildScalar(combinedScope, updateExpr.Expr)

		res[i] = expression.NewSetField(colName, innerExpr)
		if combinedScope.groupBy != nil {
			if len(combinedScope.groupBy.aggs) > startAggCnt {
				err := sql.ErrAggregationUnsupported.New(res[i])
				b.handleErr(err)
			}
		}
		if combinedScope.windowFuncs != nil {
			if len(combinedScope.windowFuncs) > startWinCnt {
				err := sql.ErrWindowUnsupported.New(res[i])
				b.handleErr(err)
			}
		}
	}
	return res
}

func (b *Builder) buildOnDupLeft(inScope *scope, e ast.Expr) sql.Expression {
	// expect col reference only
	switch e := e.(type) {
	case *ast.ColName:
		dbName := strings.ToLower(e.Qualifier.DbQualifier.String())
		tblName := strings.ToLower(e.Qualifier.Name.String())
		colName := strings.ToLower(e.Name.String())
		c, ok := inScope.resolveColumn(dbName, tblName, colName, true, false)
		if !ok {
			if tblName != "" && !inScope.hasTable(tblName) {
				b.handleErr(sql.ErrTableNotFound.New(tblName))
			} else if tblName != "" {
				b.handleErr(sql.ErrTableColumnNotFound.New(tblName, colName))
			}
			b.handleErr(sql.ErrColumnNotFound.New(e))
		}
		return c.scalarGf()
	default:
		err := fmt.Errorf("invalid update target; expected column reference, found: %T", e)
		b.handleErr(err)
	}
	return nil
}

func (b *Builder) buildDelete(inScope *scope, d *ast.Delete) (outScope *scope) {
	// TODO: this shouldn't be called during ComPrepare or `PREPARE ... FROM ...` statements, but currently it is.
	//   The end result is that the ComDelete counter is incremented during prepare statements, which is incorrect.
	sql.IncrementStatusVariable(b.ctx, "Com_delete", 1)
	b.qFlags.Set(sql.QFlagDelete)

	outScope = b.buildFrom(inScope, d.TableExprs)
	b.buildWhere(outScope, d.Where)
	orderByScope := b.analyzeOrderBy(outScope, outScope, d.OrderBy)
	b.buildOrderBy(outScope, orderByScope)
	offset := b.buildOffset(outScope, d.Limit)
	if offset != nil {
		outScope.node = plan.NewOffset(offset, outScope.node)
	}
	limit := b.buildLimit(outScope, d.Limit)
	if limit != nil {
		outScope.node = plan.NewLimit(limit, outScope.node)
	}

	var targets []sql.Node
	if len(d.Targets) > 0 {
		targets = make([]sql.Node, len(d.Targets))
		for i, tableName := range d.Targets {
			tabName := tableName.Name.String()
			var target sql.Node
			if _, ok := outScope.tables[tabName]; ok {
				transform.InspectUp(outScope.node, func(n sql.Node) bool {
					switch n := n.(type) {
					case sql.NameableNode:
						if strings.EqualFold(n.Name(), tabName) {
							target = n
							return true
						}
					default:
					}
					return false
				})
			} else {
				tableScope, ok := b.buildResolvedTableForTablename(inScope, tableName, nil)
				if !ok {
					b.handleErr(sql.ErrTableNotFound.New(tabName))
				}
				target = tableScope.node
			}
			targets[i] = target
		}
	}

	del := plan.NewDeleteFrom(outScope.node, targets)
	del.RefsSingleRel = !outScope.refsSubquery
	del.IsProcNested = b.ProcCtx().DbName != ""
	outScope.node = del

	if len(d.Returning) > 0 {
		del.Returning = b.analyzeSelectList(outScope, outScope, d.Returning)
	}

	return
}

// buildUpdate builds a Update node from |u|. If the update joins tables, the returned Update node's
// children will have a JoinNode, which will later be replaced by an UpdateJoin node during analysis. We
// don't create the UpdateJoin node here, because some query plans, such as IN SUBQUERY nodes, require
// analyzer processing that converts the subquery into a join, and then requires the same logic to
// create an UpdateJoin node under the original Update node.
func (b *Builder) buildUpdate(inScope *scope, u *ast.Update) (outScope *scope) {
	// TODO: this shouldn't be called during ComPrepare or `PREPARE ... FROM ...` statements, but currently it is.
	//   The end result is that the ComDelete counter is incremented during prepare statements, which is incorrect.
	sql.IncrementStatusVariable(b.ctx, "Com_update", 1)
	b.qFlags.Set(sql.QFlagUpdate)

	outScope = b.buildFrom(inScope, u.TableExprs)

	_, foundJoin := outScope.node.(*plan.JoinNode)

	// default expressions only resolve to target table
	updateExprs := b.assignmentExprsToExpressions(outScope, u.Exprs)

	b.buildWhere(outScope, u.Where)

	orderByScope := b.analyzeOrderBy(outScope, b.newScope(), u.OrderBy)

	b.buildOrderBy(outScope, orderByScope)
	offset := b.buildOffset(outScope, u.Limit)
	if offset != nil {
		outScope.node = plan.NewOffset(offset, outScope.node)
	}

	limit := b.buildLimit(outScope, u.Limit)
	if limit != nil {
		outScope.node = plan.NewLimit(limit, outScope.node)
	}

	// TODO comments
	// If the top level node can store comments and one was provided, store it.
	//if cn, ok := node.(sql.CommentedNode); ok && len(u.Comments) > 0 {
	//	node = cn.WithComment(string(u.Comments[0]))
	//}

	ignore := u.Ignore != ""
	update := plan.NewUpdate(outScope.node, ignore, updateExprs)

	update.IsJoin = foundJoin
	update.HasSingleRel = !outScope.refsSubquery
	update.IsProcNested = b.ProcCtx().DbName != ""

	var checks []*sql.CheckConstraint
	if hasJoinNode(outScope.node) {
		tablesToUpdate, err := getResolvedTablesToUpdate(b.ctx, update.Child, outScope.node)
		if err != nil {
			b.handleErr(err)
		}

		for _, rt := range tablesToUpdate {
			tableScope := inScope.push()
			for _, c := range rt.Schema() {
				tableScope.addColumn(scopeColumn{
					db:       rt.SqlDatabase.Name(),
					table:    strings.ToLower(rt.Name()),
					tableId:  tableScope.tables[strings.ToLower(rt.Name())],
					col:      strings.ToLower(c.Name),
					typ:      c.Type,
					nullable: c.Nullable,
				})
			}
			checks = append(checks, b.loadChecksFromTable(tableScope, rt.Table)...)
		}
	} else {
		transform.Inspect(update, func(n sql.Node) bool {
			// todo maybe this should be later stage
			if rt, ok := n.(*plan.ResolvedTable); ok {
				checks = append(checks, b.loadChecksFromTable(outScope, rt.Table)...)
			}
			return true
		})
	}

	if len(u.Returning) > 0 {
		update.Returning = b.analyzeSelectList(outScope, outScope, u.Returning)
	}

	outScope.node = update.WithChecks(checks)
	return
}

// hasJoinNode returns true if |node| or any child is a JoinNode.
func hasJoinNode(node sql.Node) bool {
	updateJoinFound := false
	transform.Inspect(node, func(n sql.Node) bool {
		if _, ok := n.(*plan.JoinNode); ok {
			updateJoinFound = true
		}
		return !updateJoinFound
	})
	return updateJoinFound
}

func getResolvedTablesToUpdate(_ *sql.Context, node sql.Node, ij sql.Node) (resolvedTables []*plan.ResolvedTable, err error) {
	namesOfTablesToBeUpdated := plan.GetTablesToBeUpdated(node)
	resolvedTablesMap := getTablesByName(ij)

	for tableToBeUpdated, _ := range namesOfTablesToBeUpdated {
		resolvedTable, ok := resolvedTablesMap[strings.ToLower(tableToBeUpdated)]
		if !ok {
			return nil, plan.ErrUpdateForTableNotSupported.New(tableToBeUpdated)
		}

		resolvedTables = append(resolvedTables, resolvedTable)
	}

	return resolvedTables, nil
}

// getTablesByName takes a node and returns all found resolved tables in a map.
func getTablesByName(node sql.Node) map[string]*plan.ResolvedTable {
	ret := make(map[string]*plan.ResolvedTable)

	transform.Inspect(node, func(node sql.Node) bool {
		switch n := node.(type) {
		case *plan.ResolvedTable:
			ret[strings.ToLower(n.Table.Name())] = n
		case *plan.IndexedTableAccess:
			rt, ok := n.TableNode.(*plan.ResolvedTable)
			if ok {
				ret[strings.ToLower(rt.Name())] = rt
			}
		case *plan.TableAlias:
			rt := getResolvedTable(n)
			if rt != nil {
				ret[strings.ToLower(n.Name())] = rt
			}
		default:
		}
		return true
	})

	return ret
}

// Finds first TableNode node that is a descendant of the node given
func getResolvedTable(node sql.Node) *plan.ResolvedTable {
	var table *plan.ResolvedTable
	transform.Inspect(node, func(node sql.Node) bool {
		// plan.Inspect will get called on all children of a node even if one of the children's calls returns false. We
		// only want the first TableNode match.
		if table != nil {
			return false
		}

		switch n := node.(type) {
		case *plan.ResolvedTable:
			if !plan.IsDualTable(n) {
				table = n
				return false
			}
		case *plan.IndexedTableAccess:
			rt, ok := n.TableNode.(*plan.ResolvedTable)
			if ok {
				table = rt
				return false
			}
		}
		return true
	})
	return table
}

func (b *Builder) buildInto(inScope *scope, into *ast.Into) {
	if into.Dumpfile != "" {
		inScope.node = plan.NewInto(inScope.node, nil, "", into.Dumpfile)
		return
	}

	if into.Outfile != "" {
		intoNode := plan.NewInto(inScope.node, nil, into.Outfile, "")

		if into.Charset != "" {
			// TODO: deal with charset; error for now
			intoNode.Charset = into.Charset
			b.handleErr(sql.ErrUnsupportedFeature.New("CHARSET in INTO OUTFILE"))
		}

		if into.Fields != nil {
			if into.Fields.TerminatedBy != nil && len(into.Fields.TerminatedBy.Val) != 0 {
				intoNode.FieldsTerminatedBy = string(into.Fields.TerminatedBy.Val)
			}
			if into.Fields.EnclosedBy != nil {
				intoNode.FieldsEnclosedBy = string(into.Fields.EnclosedBy.Delim.Val)
				if len(intoNode.FieldsEnclosedBy) > 1 {
					b.handleErr(sql.ErrUnexpectedSeparator.New())
				}
				if into.Fields.EnclosedBy.Optionally {
					intoNode.FieldsEnclosedByOpt = true
				}
			}
			if into.Fields.EscapedBy != nil {
				intoNode.FieldsEscapedBy = string(into.Fields.EscapedBy.Val)
				if len(intoNode.FieldsEscapedBy) > 1 {
					b.handleErr(sql.ErrUnexpectedSeparator.New())
				}
			}
		}

		if into.Lines != nil {
			if into.Lines.StartingBy != nil {
				intoNode.LinesStartingBy = string(into.Lines.StartingBy.Val)
			}
			if into.Lines.TerminatedBy != nil {
				intoNode.LinesTerminatedBy = string(into.Lines.TerminatedBy.Val)
			}
		}

		inScope.node = intoNode
		return
	}

	vars := make([]sql.Expression, len(into.Variables))
	for i, val := range into.Variables {
		if strings.HasPrefix(val.String(), "@") {
			vars[i] = expression.NewUserVar(strings.TrimPrefix(val.String(), "@"))
		} else {
			if inScope.proc == nil {
				err := sql.ErrUndeclaredVariable.New(val.String())
				b.handleErr(err)
			}
			col, ok := inScope.proc.GetVar(val.String())
			if !ok {
				err := sql.ErrExternalProcedureMissingContextParam.New(val.String())
				b.handleErr(err)
			}
			vars[i] = col.scalarGf()
		}
	}
	inScope.node = plan.NewInto(inScope.node, vars, "", "")
}

func (b *Builder) loadChecksFromTable(inScope *scope, table sql.Table) []*sql.CheckConstraint {
	var loadedChecks []*sql.CheckConstraint
	if checkTable, ok := table.(sql.CheckTable); ok {
		checks, err := checkTable.GetChecks(b.ctx)
		if err != nil {
			b.handleErr(err)
		}
		for _, ch := range checks {
			constraint := b.buildCheckConstraint(inScope, &ch)
			loadedChecks = append(loadedChecks, constraint)
		}
	}
	return loadedChecks
}

func (b *Builder) buildCheckConstraint(inScope *scope, check *sql.CheckDefinition) *sql.CheckConstraint {
	parsed, err := b.parser.ParseSimple(fmt.Sprintf("select %s", check.CheckExpression))
	if err != nil {
		b.handleErr(err)
	}

	selectStmt, ok := parsed.(*ast.Select)
	if !ok || len(selectStmt.SelectExprs) != 1 {
		err := sql.ErrInvalidCheckConstraint.New(check.CheckExpression)
		b.handleErr(err)
	}

	expr := selectStmt.SelectExprs[0]
	ae, ok := expr.(*ast.AliasedExpr)
	if !ok {
		err := sql.ErrInvalidCheckConstraint.New(check.CheckExpression)
		b.handleErr(err)
	}

	c := b.buildScalar(inScope, ae.Expr)

	return &sql.CheckConstraint{
		Name:     check.Name,
		Expr:     c,
		Enforced: check.Enforced,
	}
}
