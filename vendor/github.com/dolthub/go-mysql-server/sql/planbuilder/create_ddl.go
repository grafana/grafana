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
	"strconv"
	"strings"
	"time"
	"unicode"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

func (b *Builder) buildCreateTrigger(inScope *scope, subQuery string, fullQuery string, c *ast.DDL) (outScope *scope) {
	b.qFlags.Set(sql.QFlagCreateTrigger)
	defer func() {
		b.qFlags.Unset(sql.QFlagCreateTrigger)
	}()
	if b.qFlags.IsSet(sql.QFlagCreateEvent) || b.qFlags.IsSet(sql.QFlagCreateProcedure) {
		b.handleErr(fmt.Errorf("can't create a TRIGGER from within another stored routine"))
	}

	outScope = inScope.push()
	var triggerOrder *plan.TriggerOrder
	if c.TriggerSpec.Order != nil {
		triggerOrder = &plan.TriggerOrder{
			PrecedesOrFollows: c.TriggerSpec.Order.PrecedesOrFollows,
			OtherTriggerName:  c.TriggerSpec.Order.OtherTriggerName,
		}
	} else {
		//TODO: fix vitess->sql.y, in CREATE TRIGGER, if trigger_order_opt evaluates to empty then SubStatementPositionStart swallows the first token of the body
		beforeSwallowedToken := strings.LastIndexFunc(strings.TrimRightFunc(fullQuery[:c.SubStatementPositionStart], unicode.IsSpace), unicode.IsSpace)
		if beforeSwallowedToken != -1 {
			c.SubStatementPositionStart = beforeSwallowedToken
		}
	}

	// resolve table -> create initial scope
	prevTriggerCtxActive := b.TriggerCtx().Active
	b.TriggerCtx().Active = true
	defer func() {
		b.TriggerCtx().Active = prevTriggerCtxActive
	}()

	tableName := strings.ToLower(c.Table.Name.String())
	tableScope, ok := b.buildResolvedTableForTablename(inScope, c.Table, nil)
	if !ok {
		b.handleErr(sql.ErrTableNotFound.New(tableName))
	}
	if _, ok := tableScope.node.(*plan.UnresolvedTable); ok {
		// unknown table in trigger body is OK, but the target table must exist
		b.handleErr(sql.ErrTableNotFound.New(tableName))
	}

	// todo scope with new and old columns provided
	// insert/update have "new"
	// update/delete have "old"
	newScope := tableScope.replace()
	oldScope := tableScope.replace()
	for _, col := range tableScope.cols {
		switch c.TriggerSpec.Event {
		case ast.InsertStr:
			newScope.newColumn(col)
		case ast.UpdateStr:
			newScope.newColumn(col)
			oldScope.newColumn(col)
		case ast.DeleteStr:
			oldScope.newColumn(col)
		}
	}
	newScope.setTableAlias("new")
	oldScope.setTableAlias("old")
	triggerScope := tableScope.replace()

	triggerScope.addColumns(newScope.cols)
	triggerScope.addColumns(oldScope.cols)

	triggerScope.addExpressions(newScope.exprs)
	triggerScope.addExpressions(oldScope.exprs)

	bodyStr := strings.TrimSpace(fullQuery[c.SubStatementPositionStart:c.SubStatementPositionEnd])
	bodyScope := b.buildSubquery(triggerScope, c.TriggerSpec.Body, bodyStr, fullQuery)
	definer := getCurrentUserForDefiner(b.ctx, c.TriggerSpec.Definer)

	db, ok := b.resolveDbForTable(c.Table)
	if !ok {
		b.handleErr(sql.ErrDatabaseSchemaNotFound.New(c.Table.SchemaQualifier.String()))
	}

	if _, ok := tableScope.node.(*plan.ResolvedTable); !ok {
		if prevTriggerCtxActive {
			// previous ctx set means this is an INSERT or SHOW
			// old version of Dolt permitted a bad trigger on VIEW
			// warn and noop
			b.ctx.Warn(0, "trigger on view is not supported; 'DROP TRIGGER  %s' to fix", c.TriggerSpec.TrigName.Name.String())
			bodyScope.node = plan.NewResolvedDualTable()
		} else {
			// top-level call is DDL
			err := sql.ErrExpectedTableFoundView.New(tableName)
			b.handleErr(err)
		}
	}

	outScope.node = plan.NewCreateTrigger(
		db,
		c.TriggerSpec.TrigName.Name.String(),
		c.TriggerSpec.Time,
		c.TriggerSpec.Event,
		triggerOrder,
		tableScope.node,
		bodyScope.node,
		subQuery,
		bodyStr,
		b.ctx.QueryTime(),
		definer,
	)
	return outScope
}

func getCurrentUserForDefiner(ctx *sql.Context, definer string) string {
	if definer == "" {
		client := ctx.Session.Client()
		definer = fmt.Sprintf("`%s`@`%s`", client.User, client.Address)
	}
	return definer
}

func (b *Builder) buildProcedureParams(procParams []ast.ProcedureParam) []plan.ProcedureParam {
	var params []plan.ProcedureParam
	for _, param := range procParams {
		var direction plan.ProcedureParamDirection
		switch param.Direction {
		case ast.ProcedureParamDirection_In:
			direction = plan.ProcedureParamDirection_In
		case ast.ProcedureParamDirection_Inout:
			direction = plan.ProcedureParamDirection_Inout
		case ast.ProcedureParamDirection_Out:
			direction = plan.ProcedureParamDirection_Out
		default:
			err := fmt.Errorf("unknown procedure parameter direction: `%s`", string(param.Direction))
			b.handleErr(err)
		}
		internalTyp, err := types.ColumnTypeToType(&param.Type)
		if err != nil {
			b.handleErr(err)
		}
		params = append(params, plan.ProcedureParam{
			Direction: direction,
			Name:      param.Name,
			Type:      internalTyp,
			Variadic:  false,
		})
	}
	return params
}

func (b *Builder) buildProcedureCharacteristics(procCharacteristics []ast.Characteristic) ([]plan.Characteristic, plan.ProcedureSecurityContext, string) {
	var characteristics []plan.Characteristic
	securityType := plan.ProcedureSecurityContext_Definer // Default Security Context
	comment := ""
	for _, characteristic := range procCharacteristics {
		switch characteristic.Type {
		case ast.CharacteristicValue_Comment:
			comment = characteristic.Comment
		case ast.CharacteristicValue_LanguageSql:
			characteristics = append(characteristics, plan.Characteristic_LanguageSql)
		case ast.CharacteristicValue_Deterministic:
			characteristics = append(characteristics, plan.Characteristic_Deterministic)
		case ast.CharacteristicValue_NotDeterministic:
			characteristics = append(characteristics, plan.Characteristic_NotDeterministic)
		case ast.CharacteristicValue_ContainsSql:
			characteristics = append(characteristics, plan.Characteristic_ContainsSql)
		case ast.CharacteristicValue_NoSql:
			characteristics = append(characteristics, plan.Characteristic_NoSql)
		case ast.CharacteristicValue_ReadsSqlData:
			characteristics = append(characteristics, plan.Characteristic_ReadsSqlData)
		case ast.CharacteristicValue_ModifiesSqlData:
			characteristics = append(characteristics, plan.Characteristic_ModifiesSqlData)
		case ast.CharacteristicValue_SqlSecurityDefiner:
			// This is already the default value, so this prevents the default switch case
		case ast.CharacteristicValue_SqlSecurityInvoker:
			securityType = plan.ProcedureSecurityContext_Invoker
		default:
			err := fmt.Errorf("unknown procedure characteristic: `%s`", string(characteristic.Type))
			b.handleErr(err)
		}
	}
	return characteristics, securityType, comment
}

func (b *Builder) buildCreateProcedure(inScope *scope, subQuery string, fullQuery string, c *ast.DDL) (outScope *scope) {
	b.qFlags.Set(sql.QFlagCreateProcedure)
	defer func() {
		b.qFlags.Unset(sql.QFlagCreateProcedure)
	}()
	if b.qFlags.IsSet(sql.QFlagCreateEvent) || b.qFlags.IsSet(sql.QFlagCreateTrigger) {
		b.handleErr(fmt.Errorf("can't create a PROCEDURE from within another stored routine"))
	}

	b.validateCreateProcedure(inScope, subQuery)

	var db sql.Database = nil
	if dbName := c.ProcedureSpec.ProcName.Qualifier.String(); dbName != "" {
		db = b.resolveDb(dbName)
	} else {
		db = b.currentDb()
	}

	now := time.Now()
	spd := sql.StoredProcedureDetails{
		Name:            strings.ToLower(c.ProcedureSpec.ProcName.Name.String()),
		CreateStatement: subQuery,
		CreatedAt:       now,
		ModifiedAt:      now,
		SqlMode:         sql.LoadSqlMode(b.ctx).String(),
	}

	bodyStr := strings.TrimSpace(fullQuery[c.SubStatementPositionStart:c.SubStatementPositionEnd])

	outScope = inScope.push()
	outScope.node = plan.NewCreateProcedure(db, spd, bodyStr)
	return outScope
}

func (b *Builder) validateBlock(inScope *scope, stmts ast.Statements) {
	for _, s := range stmts {
		switch s.(type) {
		case *ast.Declare:
		default:
			if inScope.procActive() {
				inScope.proc.NewState(dsBody)
			}
		}
		b.validateStatement(inScope, s)
	}
}

func (b *Builder) validateStatement(inScope *scope, stmt ast.Statement) {
	// TODO: a ton of this code is repeated from their build counterparts, consider refactoring into helper methods
	switch s := stmt.(type) {
	case *ast.DDL:
		switch s.Action {
		case ast.TruncateStr:
		case ast.CreateStr:
			if s.ProcedureSpec != nil {
				b.handleErr(fmt.Errorf("can't create a PROCEDURE from within another stored routine"))
			}
			if s.TriggerSpec != nil {
				b.handleErr(fmt.Errorf("can't create a TRIGGER from within another stored routine"))
			}
		}
	case *ast.DBDDL:
		b.handleErr(fmt.Errorf("DBDDL in CREATE PROCEDURE not yet supported"))
	case *ast.Declare:
		if s.Condition != nil {
			dc := s.Condition
			if dc.SqlStateValue != "" {
				if len(dc.SqlStateValue) != 5 {
					err := fmt.Errorf("SQLSTATE VALUE must be a string with length 5 consisting of only integers")
					b.handleErr(err)
				}
				if dc.SqlStateValue[0:2] == "00" {
					err := fmt.Errorf("invalid SQLSTATE VALUE: '%s'", dc.SqlStateValue)
					b.handleErr(err)
				}
			} else {
				number, err := strconv.ParseUint(string(dc.MysqlErrorCode.Val), 10, 64)
				if err != nil || number == 0 {
					// We use our own error instead
					err := fmt.Errorf("invalid value '%s' for MySQL error code", string(dc.MysqlErrorCode.Val))
					b.handleErr(err)
				}
				//TODO: implement MySQL error code support
				err = sql.ErrUnsupportedSyntax.New(ast.String(s))
				b.handleErr(err)
			}
			inScope.proc.AddCondition(plan.NewDeclareCondition(dc.Name, 0, ""))
		} else if s.Variables != nil {
			typ, err := types.ColumnTypeToType(&s.Variables.VarType)
			if err != nil {
				b.handleErr(err)
			}
			for _, v := range s.Variables.Names {
				varName := strings.ToLower(v.String())
				param := expression.NewProcedureParam(varName, typ)
				inScope.proc.AddVar(param)
				inScope.newColumn(scopeColumn{col: varName, typ: typ, scalar: param})
			}
		} else if s.Cursor != nil {
			inScope.proc.AddCursor(s.Cursor.Name)
		} else if s.Handler != nil {
			switch s.Handler.ConditionValues[0].ValueType {
			case ast.DeclareHandlerCondition_NotFound:
			case ast.DeclareHandlerCondition_SqlException:
			default:
				err := sql.ErrUnsupportedSyntax.New(ast.String(s))
				b.handleErr(err)
			}
			inScope.proc.AddHandler(nil)
		}
	case *ast.BeginEndBlock:
		blockScope := inScope.push()
		blockScope.initProc()
		blockScope.proc.AddLabel(s.Label, false)
		b.validateBlock(blockScope, s.Statements)
	case *ast.Loop:
		blockScope := inScope.push()
		blockScope.initProc()
		blockScope.proc.AddLabel(s.Label, true)
		b.validateBlock(blockScope, s.Statements)
	case *ast.Repeat:
		blockScope := inScope.push()
		blockScope.initProc()
		blockScope.proc.AddLabel(s.Label, true)
		b.validateBlock(blockScope, s.Statements)
	case *ast.While:
		blockScope := inScope.push()
		blockScope.initProc()
		blockScope.proc.AddLabel(s.Label, true)
		b.validateBlock(blockScope, s.Statements)
	case *ast.IfStatement:
		for _, cond := range s.Conditions {
			b.validateBlock(inScope, cond.Statements)
		}
		if s.Else != nil {
			b.validateBlock(inScope, s.Else)
		}
	case *ast.Iterate:
		if exists, isLoop := inScope.proc.HasLabel(s.Label); !exists || !isLoop {
			err := sql.ErrLoopLabelNotFound.New("ITERATE", s.Label)
			b.handleErr(err)
		}
	case *ast.Signal:
		if s.ConditionName != "" {
			signalName := strings.ToLower(s.ConditionName)
			condition := inScope.proc.GetCondition(signalName)
			if condition == nil {
				err := sql.ErrDeclareConditionNotFound.New(signalName)
				b.handleErr(err)
			}
		}
	case *ast.FetchCursor:
		if !inScope.proc.HasCursor(s.Name) {
			b.handleErr(sql.ErrCursorNotFound.New(s.Name))
		}
	case *ast.OpenCursor:
		if !inScope.proc.HasCursor(s.Name) {
			b.handleErr(sql.ErrCursorNotFound.New(s.Name))
		}
	case *ast.CloseCursor:
		if !inScope.proc.HasCursor(s.Name) {
			b.handleErr(sql.ErrCursorNotFound.New(s.Name))
		}

	// limit validation
	case *ast.Select:
		if s.Limit != nil {
			if expr, ok := s.Limit.Rowcount.(*ast.ColName); ok && inScope.procActive() {
				if col, ok := inScope.proc.GetVar(expr.String()); ok {
					// proc param is OK
					if pp, ok := col.scalarGf().(*expression.ProcedureParam); ok {
						if !pp.Type().Promote().Equals(types.Int64) && !pp.Type().Promote().Equals(types.Uint64) {
							err := fmt.Errorf("the variable '%s' has a non-integer based type: %s", pp.Name(), pp.Type().String())
							b.handleErr(err)
						}
					}
				}
			}
		}
	}
}

func (b *Builder) validateCreateProcedure(inScope *scope, createStmt string) {
	stmt, _, _, _ := b.parser.ParseWithOptions(b.ctx, createStmt, ';', false, b.parserOpts)
	procStmt := stmt.(*ast.DDL)

	// validate parameters
	procParams := b.buildProcedureParams(procStmt.ProcedureSpec.Params)
	paramNames := make(map[string]struct{})
	for _, param := range procParams {
		paramName := strings.ToLower(param.Name)
		if _, ok := paramNames[paramName]; ok {
			b.handleErr(sql.ErrDeclareVariableDuplicate.New(paramName))
		}
		paramNames[param.Name] = struct{}{}
	}

	inScope.initProc()
	for _, p := range procParams {
		inScope.proc.AddVar(expression.NewProcedureParam(strings.ToLower(p.Name), p.Type))
	}

	bodyStmt := procStmt.ProcedureSpec.Body
	b.validateStatement(inScope, bodyStmt)

	// TODO: check for limit clauses that are not integers
}

func (b *Builder) buildCreateEvent(inScope *scope, subQuery string, fullQuery string, c *ast.DDL) (outScope *scope) {
	b.qFlags.Set(sql.QFlagCreateEvent)
	defer func() {
		b.qFlags.Unset(sql.QFlagCreateEvent)
	}()
	if b.qFlags.IsSet(sql.QFlagCreateTrigger) || b.qFlags.IsSet(sql.QFlagCreateProcedure) {
		b.handleErr(fmt.Errorf("can't create an EVENT from within another stored routine"))
	}

	outScope = inScope.push()
	eventSpec := c.EventSpec
	dbName := strings.ToLower(eventSpec.EventName.Qualifier.String())
	if dbName == "" {
		dbName = b.ctx.GetCurrentDatabase()
	}
	database := b.resolveDb(dbName)
	definer := getCurrentUserForDefiner(b.ctx, c.EventSpec.Definer)

	// both 'undefined' and 'not preserve' are considered 'not preserve'
	onCompletionPreserve := false
	if eventSpec.OnCompletionPreserve == ast.EventOnCompletion_Preserve {
		onCompletionPreserve = true
	}

	var status sql.EventStatus
	switch eventSpec.Status {
	case ast.EventStatus_Undefined:
		status = sql.EventStatus_Enable
	case ast.EventStatus_Enable:
		status = sql.EventStatus_Enable
	case ast.EventStatus_Disable:
		status = sql.EventStatus_Disable
	case ast.EventStatus_DisableOnSlave:
		status = sql.EventStatus_DisableOnSlave
	}

	bodyStr := strings.TrimSpace(fullQuery[c.SubStatementPositionStart:c.SubStatementPositionEnd])
	bodyScope := b.buildSubquery(inScope, c.EventSpec.Body, bodyStr, fullQuery)

	var at, starts, ends *plan.OnScheduleTimestamp
	var everyInterval *expression.Interval
	if eventSpec.OnSchedule.At != nil {
		ts, intervals := b.buildEventScheduleTimeSpec(inScope, eventSpec.OnSchedule.At)
		at = plan.NewOnScheduleTimestamp("AT", ts, intervals)
	} else {
		everyInterval = b.intervalExprToExpression(inScope, &eventSpec.OnSchedule.EveryInterval)
		if eventSpec.OnSchedule.Starts != nil {
			startsTs, startsIntervals := b.buildEventScheduleTimeSpec(inScope, eventSpec.OnSchedule.Starts)
			starts = plan.NewOnScheduleTimestamp("STARTS", startsTs, startsIntervals)
		}
		if eventSpec.OnSchedule.Ends != nil {
			endsTs, endsIntervals := b.buildEventScheduleTimeSpec(inScope, eventSpec.OnSchedule.Ends)
			ends = plan.NewOnScheduleTimestamp("ENDS", endsTs, endsIntervals)
		}
	}

	comment := ""
	if eventSpec.Comment != nil {
		comment = string(eventSpec.Comment.Val)
	}

	outScope.node = plan.NewCreateEvent(
		database,
		b.scheduler,
		eventSpec.EventName.Name.String(), definer,
		at, starts, ends, everyInterval,
		onCompletionPreserve,
		status, comment, bodyStr, bodyScope.node, eventSpec.IfNotExists,
	)
	return outScope
}

func (b *Builder) buildEventScheduleTimeSpec(inScope *scope, spec *ast.EventScheduleTimeSpec) (sql.Expression, []sql.Expression) {
	ts := b.buildScalar(inScope, spec.EventTimestamp)
	if len(spec.EventIntervals) == 0 {
		return ts, nil
	}
	var intervals = make([]sql.Expression, len(spec.EventIntervals))
	for i, interval := range spec.EventIntervals {
		e := b.intervalExprToExpression(inScope, &interval)
		intervals[i] = e
	}
	return ts, intervals
}

func (b *Builder) buildAlterUser(inScope *scope, _ string, c *ast.DDL) (outScope *scope) {
	database := b.resolveDb("mysql")
	accountWithAuth := ast.AccountWithAuth{AccountName: c.User, Auth1: c.Authentication}
	user := b.buildAuthenticatedUser(accountWithAuth)

	if c.Authentication.RandomPassword {
		b.handleErr(fmt.Errorf("random password generation is not currently supported; " +
			"you can request support at https://github.com/dolthub/dolt/issues/new"))
	}

	outScope = inScope.push()
	outScope.node = &plan.AlterUser{
		IfExists: c.IfExists,
		User:     user,
		MySQLDb:  database,
	}
	return outScope
}

func (b *Builder) buildAlterEvent(inScope *scope, subQuery string, fullQuery string, c *ast.DDL) (outScope *scope) {
	eventSpec := c.EventSpec

	var database sql.Database
	if dbName := eventSpec.EventName.Qualifier.String(); dbName != "" {
		database = b.resolveDb(dbName)
	} else {
		database = b.currentDb()
	}

	definer := getCurrentUserForDefiner(b.ctx, c.EventSpec.Definer)

	var (
		alterSchedule    = eventSpec.OnSchedule != nil
		at, starts, ends *plan.OnScheduleTimestamp
		everyInterval    *expression.Interval

		alterOnComp       = eventSpec.OnCompletionPreserve != ast.EventOnCompletion_Undefined
		newOnCompPreserve = eventSpec.OnCompletionPreserve == ast.EventOnCompletion_Preserve

		alterEventName = !eventSpec.RenameName.IsEmpty()
		newName        string

		alterStatus = eventSpec.Status != ast.EventStatus_Undefined
		newStatus   sql.EventStatus

		alterComment = eventSpec.Comment != nil
		newComment   string

		alterDefinition  = eventSpec.Body != nil
		newDefinitionStr string
		newDefinition    sql.Node
	)

	if alterSchedule {
		if eventSpec.OnSchedule.At != nil {
			ts, intervals := b.buildEventScheduleTimeSpec(inScope, eventSpec.OnSchedule.At)
			at = plan.NewOnScheduleTimestamp("AT", ts, intervals)
		} else {
			everyInterval = b.intervalExprToExpression(inScope, &eventSpec.OnSchedule.EveryInterval)
			if eventSpec.OnSchedule.Starts != nil {
				startsTs, startsIntervals := b.buildEventScheduleTimeSpec(inScope, eventSpec.OnSchedule.Starts)
				starts = plan.NewOnScheduleTimestamp("STARTS", startsTs, startsIntervals)
			}
			if eventSpec.OnSchedule.Ends != nil {
				endsTs, endsIntervals := b.buildEventScheduleTimeSpec(inScope, eventSpec.OnSchedule.Ends)
				ends = plan.NewOnScheduleTimestamp("ENDS", endsTs, endsIntervals)
			}
		}
	}
	if alterEventName {
		// events can be moved to different database using RENAME TO clause option
		// TODO: we do not support moving events to different database yet
		renameEventDb := eventSpec.RenameName.Qualifier.String()
		if renameEventDb != "" && database.Name() != renameEventDb {
			err := fmt.Errorf("moving events to different database using ALTER EVENT is not supported yet")
			b.handleErr(err)
		}
		newName = eventSpec.RenameName.Name.String()
	}
	if alterStatus {
		switch eventSpec.Status {
		case ast.EventStatus_Undefined:
			// this should not happen but sanity check
			newStatus = sql.EventStatus_Enable
		case ast.EventStatus_Enable:
			newStatus = sql.EventStatus_Enable
		case ast.EventStatus_Disable:
			newStatus = sql.EventStatus_Disable
		case ast.EventStatus_DisableOnSlave:
			newStatus = sql.EventStatus_DisableOnSlave
		}
	}
	if alterComment {
		newComment = string(eventSpec.Comment.Val)
	}
	if alterDefinition {
		newDefinitionStr = strings.TrimSpace(fullQuery[c.SubStatementPositionStart:c.SubStatementPositionEnd])
		defScope := b.buildSubquery(inScope, c.EventSpec.Body, newDefinitionStr, fullQuery)
		newDefinition = defScope.node
	}

	eventName := strings.ToLower(eventSpec.EventName.Name.String())
	eventDb, ok := database.(sql.EventDatabase)
	if !ok {
		err := sql.ErrEventsNotSupported.New(database.Name())
		b.handleErr(err)
	}

	event, exists, err := eventDb.GetEvent(b.ctx, eventName)
	if err != nil {
		b.handleErr(err)
	}
	if !exists {
		err := sql.ErrEventDoesNotExist.New(eventName)
		b.handleErr(err)
	}

	outScope = inScope.push()
	alterEvent := plan.NewAlterEvent(
		database,
		b.scheduler,
		eventName, definer,
		alterSchedule, at, starts, ends, everyInterval,
		alterOnComp, newOnCompPreserve,
		alterEventName, newName,
		alterStatus, newStatus,
		alterComment, newComment,
		alterDefinition, newDefinitionStr, newDefinition,
	)
	alterEvent.Event = event
	outScope.node = alterEvent
	return
}

func (b *Builder) buildCreateView(inScope *scope, subQuery string, fullQuery string, c *ast.DDL) (outScope *scope) {
	outScope = inScope.push()
	selectStr := c.SubStatementStr
	if selectStr == "" {
		if c.SubStatementPositionEnd > len(fullQuery) {
			b.handleErr(fmt.Errorf("unable to get sub statement"))
		}
		selectStr = fullQuery[c.SubStatementPositionStart:c.SubStatementPositionEnd]
	}

	selectStatement, ok := c.ViewSpec.ViewExpr.(ast.SelectStatement)
	if !ok {
		err := sql.ErrUnsupportedSyntax.New(ast.String(c.ViewSpec.ViewExpr))
		b.handleErr(err)
	}
	queryScope := b.buildSelectStmt(inScope, selectStatement)

	queryAlias := plan.NewSubqueryAlias(c.ViewSpec.ViewName.Name.String(), selectStr, queryScope.node)
	b.qFlags.Set(sql.QFlagRelSubquery)

	definer := getCurrentUserForDefiner(b.ctx, c.ViewSpec.Definer)

	if c.ViewSpec.CheckOption == ast.ViewCheckOptionLocal {
		err := sql.ErrUnsupportedSyntax.New("WITH LOCAL CHECK OPTION")
		b.handleErr(err)
	}

	if len(c.ViewSpec.Columns) > 0 {
		if len(c.ViewSpec.Columns) != len(queryScope.cols) {
			err := sql.ErrInvalidColumnNumber.New(len(queryScope.cols), len(c.ViewSpec.Columns))
			b.handleErr(err)
		}
		queryAlias = queryAlias.WithColumnNames(columnsToStrings(c.ViewSpec.Columns))
	}

	db, ok := b.resolveDbForTable(c.ViewSpec.ViewName)
	if !ok {
		b.handleErr(sql.ErrDatabaseSchemaNotFound.New(c.Table.SchemaQualifier.String()))
	}
	createView := plan.NewCreateView(db, c.ViewSpec.ViewName.Name.String(), queryAlias, c.IfNotExists, c.OrReplace, subQuery, c.ViewSpec.Algorithm, definer, c.ViewSpec.Security)
	outScope.node = b.modifySchemaTarget(queryScope, createView, createView.Definition.Schema())

	return outScope
}
