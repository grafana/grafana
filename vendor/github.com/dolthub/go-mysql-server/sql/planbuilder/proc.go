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

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/procedures"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type declareState uint8

const (
	dsUnknownDeclareState = iota
	dsVariable
	dsCondition
	dsCursor
	dsHandler
	dsBody // No more declarations should be seen
)

type procCtx struct {
	s          *scope
	conditions map[string]*plan.DeclareCondition
	vars       map[string]scopeColumn
	cursors    map[string]struct{}
	labels     map[string]bool
	handlers   []*plan.DeclareHandler
	lastState  declareState
}

func (p *procCtx) NewState(state declareState) {
	switch state {
	case dsCondition:
		if p.lastState > state {
			err := sql.ErrDeclareConditionOrderInvalid.New()
			p.s.b.handleErr(err)
		}
	case dsVariable:
		if p.lastState > state && p.lastState != dsCondition {
			err := sql.ErrDeclareVariableOrderInvalid.New()
			p.s.b.handleErr(err)
		}
	case dsHandler:
		if p.lastState > state {
			err := sql.ErrDeclareHandlerOrderInvalid.New()
			p.s.b.handleErr(err)
		}
	case dsCursor:
		if p.lastState > state {
			err := sql.ErrDeclareCursorOrderInvalid.New()
			p.s.b.handleErr(err)
		}
	default:
	}
	p.lastState = state
}

func (p *procCtx) AddVar(param *expression.ProcedureParam) {
	p.NewState(dsVariable)
	lowerName := strings.ToLower(param.Name())
	if _, ok := p.vars[lowerName]; ok {
		err := sql.ErrDeclareVariableDuplicate.New(lowerName)
		p.s.b.handleErr(err)
	}
	col := scopeColumn{col: lowerName, typ: param.Type(), scalar: param}
	p.vars[lowerName] = col
}

func (p *procCtx) GetVar(name string) (scopeColumn, bool) {
	param, ok := p.vars[strings.ToLower(name)]
	parent := p.s.parent
	for !ok && parent != nil {
		if parent.procActive() {
			param, ok = parent.proc.GetVar(name)
		}
		parent = parent.parent
	}
	return param, ok
}

func (p *procCtx) AddCursor(name string) {
	p.NewState(dsCursor)
	lowerName := strings.ToLower(name)
	if _, ok := p.cursors[lowerName]; ok {
		err := sql.ErrDeclareCursorDuplicate.New(name)
		p.s.b.handleErr(err)
	}
	p.cursors[lowerName] = struct{}{}
}

func (p *procCtx) HasCursor(name string) bool {
	_, ok := p.cursors[strings.ToLower(name)]
	if !ok {
		if p.s.parent != nil && p.s.parent.procActive() {
			return p.s.parent.proc.HasCursor(name)
		}
	}
	return ok
}

func (p *procCtx) AddHandler(h *plan.DeclareHandler) {
	p.NewState(dsHandler)
	p.handlers = append(p.handlers, h)
}

func (p *procCtx) HasHandler(name string) bool {
	return p.handlers != nil
}

func (p *procCtx) AddLabel(label string, isLoop bool) {
	p.NewState(dsVariable)

	// Empty labels are not added since they cannot be referenced
	if label == "" {
		return
	}
	lowercaseLabel := strings.ToLower(label)
	if _, ok := p.labels[lowercaseLabel]; ok {
		err := sql.ErrLoopRedefinition.New(label)
		p.s.b.handleErr(err)
	}
	p.labels[lowercaseLabel] = isLoop
}

func (p *procCtx) HasLabel(name string) (bool, bool) {
	isLoop, ok := p.labels[strings.ToLower(name)]
	if !ok {
		if p.s.parent != nil && p.s.parent.procActive() {
			return p.s.parent.proc.HasLabel(name)
		}
	}
	return ok, isLoop
}

func (p *procCtx) AddCondition(cond *plan.DeclareCondition) {
	p.NewState(dsCondition)
	name := strings.ToLower(cond.Name)
	if _, ok := p.conditions[name]; ok {
		err := sql.ErrDeclareConditionDuplicate.New(name)
		p.s.handleErr(err)
	}
	p.conditions[name] = cond
}

func (p *procCtx) GetCondition(name string) *plan.DeclareCondition {
	cond, ok := p.conditions[strings.ToLower(name)]
	if !ok {
		if p.s.parent != nil && p.s.parent.procActive() {
			return p.s.parent.proc.GetCondition(name)
		}
	}
	return cond
}

func (b *Builder) buildBeginEndBlock(inScope *scope, n *ast.BeginEndBlock, fullQuery string) (outScope *scope) {
	outScope = inScope.push()
	outScope.initProc()
	outScope.proc.AddLabel(n.Label, false)
	block := b.buildBlock(outScope, n.Statements, fullQuery)
	outScope.node = plan.NewBeginEndBlock(n.Label, block)
	return outScope
}

func (b *Builder) buildIfBlock(inScope *scope, n *ast.IfStatement, fullQuery string) (outScope *scope) {
	outScope = inScope.push()
	ifConditionals := make([]*plan.IfConditional, len(n.Conditions))
	for i, ic := range n.Conditions {
		ifConditionalScope := b.buildIfConditional(inScope, ic, fullQuery)
		ifConditionals[i] = ifConditionalScope.node.(*plan.IfConditional)
	}
	elseBlock := b.buildBlock(inScope, n.Else, fullQuery)
	outScope.node = plan.NewIfElse(ifConditionals, elseBlock)
	return outScope
}

func (b *Builder) buildCaseStatement(inScope *scope, n *ast.CaseStatement, fullQuery string) (outScope *scope) {
	outScope = inScope.push()
	ifConditionals := make([]*plan.IfConditional, len(n.Cases))
	for i, c := range n.Cases {
		ifConditionalScope := b.buildIfConditional(inScope, ast.IfStatementCondition{
			Expr:       c.Case,
			Statements: c.Statements,
		}, fullQuery)
		ifConditionals[i] = ifConditionalScope.node.(*plan.IfConditional)
	}
	var elseBlock sql.Node
	if n.Else != nil {
		elseBlock = b.buildBlock(inScope, n.Else, fullQuery)
	}
	if n.Expr == nil {
		outScope.node = plan.NewCaseStatement(nil, ifConditionals, elseBlock)
		return outScope
	} else {
		caseExpr := b.buildScalar(inScope, n.Expr)
		outScope.node = plan.NewCaseStatement(caseExpr, ifConditionals, elseBlock)
		return outScope
	}
}

func (b *Builder) buildIfConditional(inScope *scope, n ast.IfStatementCondition, fullQuery string) (outScope *scope) {
	outScope = inScope.push()
	block := b.buildBlock(inScope, n.Statements, fullQuery)
	condition := b.buildScalar(inScope, n.Expr)
	outScope.node = plan.NewIfConditional(condition, block)
	return outScope
}

func BuildProcedureHelper(ctx *sql.Context, cat sql.Catalog, isCreateProc bool, inScope *scope, db sql.Database, asOf sql.Expression, procDetails sql.StoredProcedureDetails) (proc *plan.Procedure, qFlags *sql.QueryFlags, err error) {
	// TODO: new builder necessary?
	defer func() {
		if r := recover(); r != nil {
			switch r := r.(type) {
			case parseErr:
				err = r.err
			default:
				panic(r)
			}
		}
	}()
	b := New(ctx, cat, nil, nil)
	b.DisableAuth()
	b.SetParserOptions(sql.NewSqlModeFromString(procDetails.SqlMode).ParserOptions())
	if asOf != nil {
		asOf, err := asOf.Eval(b.ctx, nil)
		if err != nil {
			b.handleErr(err)
		}
		b.ProcCtx().AsOf = asOf
	}
	b.ProcCtx().DbName = db.Name()
	if isCreateProc {
		// TODO: we want to skip certain validations for CREATE PROCEDURE
		b.qFlags.Set(sql.QFlagCreateProcedure)
	}
	stmt, _, _, _ := b.parser.ParseWithOptions(b.ctx, procDetails.CreateStatement, ';', false, b.parserOpts)
	procStmt := stmt.(*ast.DDL)

	ops, err := procedures.Parse(procStmt.ProcedureSpec.Body)
	if err != nil {
		b.handleErr(err)
	}

	procParams := b.buildProcedureParams(procStmt.ProcedureSpec.Params)
	characteristics, securityType, comment := b.buildProcedureCharacteristics(procStmt.ProcedureSpec.Characteristics)

	proc = plan.NewProcedure(
		procDetails.Name,
		procStmt.ProcedureSpec.Definer,
		procParams,
		securityType,
		comment,
		characteristics,
		procDetails.CreateStatement,
		procDetails.CreatedAt,
		procDetails.ModifiedAt,
		ops,
	)

	return proc, qFlags, nil
}

func (b *Builder) buildCall(inScope *scope, c *ast.Call) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, c.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}

	var asOf sql.Expression = nil
	if c.AsOf != nil {
		asOf = b.buildAsOfExpr(inScope, c.AsOf)
	} else if b.ProcCtx().AsOf != nil {
		asOf = expression.NewLiteral(b.ProcCtx().AsOf, types.Text)
	} else if b.ViewCtx().AsOf != nil {
		asOf = expression.NewLiteral(b.ViewCtx().AsOf, types.Text)
	}

	var db sql.Database = nil
	if b.ProcCtx().DbName != "" {
		db = b.resolveDb(b.ProcCtx().DbName)
	} else if b.ViewCtx().DbName != "" {
		db = b.resolveDb(b.ViewCtx().DbName)
	} else if dbName := c.ProcName.Qualifier.String(); dbName != "" {
		db = b.resolveDb(dbName)
	} else if b.ctx.GetCurrentDatabase() != "" {
		db = b.currentDb()
	}

	var proc *plan.Procedure
	var innerQFlags *sql.QueryFlags
	procName := c.ProcName.Name.String()
	esp, err := b.cat.ExternalStoredProcedure(b.ctx, procName, len(c.Params))
	if err != nil {
		b.handleErr(err)
	}
	if esp != nil {
		proc, err = resolveExternalStoredProcedure(*esp)
	} else if spdb, ok := db.(sql.StoredProcedureDatabase); ok {
		var procDetails sql.StoredProcedureDetails
		procDetails, ok, err = spdb.GetStoredProcedure(b.ctx, procName)
		if err == nil {
			if ok {
				proc, innerQFlags, err = BuildProcedureHelper(b.ctx, b.cat, false, inScope, db, asOf, procDetails)
				// This is necessary so that the resolveSubqueries analyzer rule
				// will apply NodeExecBuilder to Subqueries in procedure body
				if innerQFlags.IsSet(sql.QFlagScalarSubquery) {
					b.qFlags.Set(sql.QFlagScalarSubquery)
				}
			} else {
				err = sql.ErrStoredProcedureDoesNotExist.New(procName)
				if b.qFlags.IsSet(sql.QFlagCreateTrigger) {
					proc = &plan.Procedure{
						Name:            procName,
						ValidationError: err,
					}
					err = nil
				}
			}
		}
	} else {
		err = sql.ErrStoredProceduresNotSupported.New(db.Name())
	}
	if err != nil {
		b.handleErr(err)
	}

	params := make([]sql.Expression, len(c.Params))
	for i, param := range c.Params {
		// While it is possible to detect a parameter count mismatch here and throw an error,
		// there's some weirdness involving external procedures. The analyzer rule applyProceduresCall will
		// catch this discrepancy.
		if len(proc.Params) == len(c.Params) {
			procParam := proc.Params[i]
			rSpp := &sql.StoredProcParam{Type: procParam.Type}
			rSpp = b.ctx.Session.NewStoredProcParam(procParam.Name, rSpp)
			if col, isCol := param.(*ast.ColName); isCol {
				colName := col.Name.String()
				if spp := b.ctx.Session.GetStoredProcParam(colName); spp != nil {
					iv := &procedures.InterpreterVariable{
						Type:  spp.Type,
						Value: spp.Value,
					}
					param = iv.ToAST()
					rSpp.Reference = spp
				}
			}
		}
		expr := b.buildScalar(inScope, param)
		params[i] = expr
	}

	outScope = inScope.push()
	outScope.node = plan.NewCall(db, procName, params, proc, asOf, b.cat, nil)
	return outScope
}

func (b *Builder) buildDeclare(inScope *scope, d *ast.Declare, query string) (outScope *scope) {
	outScope = inScope.push()
	// TODO check and record most recent declare
	if d.Condition != nil {
		return b.buildDeclareCondition(inScope, d)
	} else if d.Variables != nil {
		return b.buildDeclareVariables(inScope, d)
	} else if d.Cursor != nil {
		return b.buildDeclareCursor(inScope, d)
	} else if d.Handler != nil {
		return b.buildDeclareHandler(inScope, d, query)
	}
	err := sql.ErrUnsupportedSyntax.New(ast.String(d))
	b.handleErr(err)
	return
}

func (b *Builder) buildDeclareCondition(inScope *scope, d *ast.Declare) (outScope *scope) {
	outScope = inScope.push()
	dc := d.Condition
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
		err = sql.ErrUnsupportedSyntax.New(ast.String(d))
		b.handleErr(err)
	}

	cond := plan.NewDeclareCondition(strings.ToLower(dc.Name), 0, dc.SqlStateValue)
	inScope.proc.AddCondition(cond)
	outScope.node = cond
	return outScope
}

func (b *Builder) buildDeclareVariables(inScope *scope, d *ast.Declare) (outScope *scope) {
	outScope = inScope.push()
	dVars := d.Variables
	names := make([]string, len(dVars.Names))
	typ, err := types.ColumnTypeToType(&dVars.VarType)
	if err != nil {
		err := err
		b.handleErr(err)
	}
	for i, variable := range dVars.Names {
		varName := strings.ToLower(variable.String())
		names[i] = varName
		param := expression.NewProcedureParam(varName, typ)
		inScope.proc.AddVar(param)
		inScope.newColumn(scopeColumn{col: varName, typ: typ, scalar: param})
	}
	defaultVal := b.buildDefaultExpression(inScope, dVars.VarType.Default)

	outScope.node = plan.NewDeclareVariables(names, typ, defaultVal)
	return outScope
}

func (b *Builder) buildDeclareCursor(inScope *scope, d *ast.Declare) (outScope *scope) {
	outScope = inScope.push()
	dCursor := d.Cursor
	selectScope := b.buildSelectStmt(inScope, dCursor.SelectStmt)
	cur := plan.NewDeclareCursor(dCursor.Name, selectScope.node)
	inScope.proc.AddCursor(cur.Name)
	outScope.node = cur
	return outScope
}

func (b *Builder) buildDeclareHandler(inScope *scope, d *ast.Declare, query string) (outScope *scope) {
	outScope = inScope.push()
	dHandler := d.Handler
	if len(dHandler.ConditionValues) != 1 {
		err := sql.ErrUnsupportedSyntax.New(ast.String(d))
		b.handleErr(err)
	}

	var cond expression.HandlerCondition

	switch dHandler.ConditionValues[0].ValueType {
	case ast.DeclareHandlerCondition_NotFound:
		cond = expression.HandlerCondition{Type: expression.HandlerConditionNotFound}
	case ast.DeclareHandlerCondition_SqlException:
		cond = expression.HandlerCondition{Type: expression.HandlerConditionSqlException}
	default:
		err := sql.ErrUnsupportedSyntax.New(ast.String(d))
		b.handleErr(err)
	}

	stmtScope := b.build(inScope, dHandler.Statement, query)

	var action expression.DeclareHandlerAction
	switch dHandler.Action {
	case ast.DeclareHandlerAction_Continue:
		action = expression.DeclareHandlerAction_Continue
	case ast.DeclareHandlerAction_Exit:
		action = expression.DeclareHandlerAction_Exit
	case ast.DeclareHandlerAction_Undo:
		action = expression.DeclareHandlerAction_Undo
		b.handleErr(sql.ErrDeclareHandlerUndo.New())
	default:
		err := fmt.Errorf("unknown DECLARE ... HANDLER action: %v", dHandler.Action)
		b.handleErr(err)
	}

	handler := &plan.DeclareHandler{
		Action:    action,
		Statement: stmtScope.node,
		Condition: cond,
	}

	inScope.proc.AddHandler(handler)
	outScope.node = handler
	return outScope
}

func (b *Builder) buildBlock(inScope *scope, parserStatements ast.Statements, fullQuery string) *plan.Block {
	var statements []sql.Node
	for _, s := range parserStatements {
		switch s.(type) {
		case *ast.Declare:
		default:
			if inScope.procActive() {
				inScope.proc.NewState(dsBody)
			}
		}
		stmtScope := b.buildSubquery(inScope, s, ast.String(s), fullQuery)
		statements = append(statements, stmtScope.node)
	}

	return plan.NewBlock(statements)
}

func (b *Builder) buildFetchCursor(inScope *scope, fetchCursor *ast.FetchCursor) (outScope *scope) {
	if !inScope.proc.HasCursor(fetchCursor.Name) {
		err := sql.ErrCursorNotFound.New(fetchCursor.Name)
		b.handleErr(err)
	}

	outScope = inScope.push()
	exprs := make([]sql.Expression, len(fetchCursor.Variables))
	for i, v := range fetchCursor.Variables {
		col, ok := inScope.resolveColumn("", "", strings.ToLower(v), true, false)
		if !ok {
			err := sql.ErrColumnNotFound.New(v)
			b.handleErr(err)
		}
		exprs[i] = col.scalarGf()
	}
	fetch := plan.NewFetch(fetchCursor.Name, exprs)
	outScope.node = fetch
	return outScope
}

func (b *Builder) buildOpenCursor(inScope *scope, openCursor *ast.OpenCursor) (outScope *scope) {
	if !inScope.proc.HasCursor(openCursor.Name) {
		err := sql.ErrCursorNotFound.New(openCursor.Name)
		b.handleErr(err)
	}
	outScope = inScope.push()
	outScope.node = plan.NewOpen(openCursor.Name)
	return outScope
}

func (b *Builder) buildCloseCursor(inScope *scope, closeCursor *ast.CloseCursor) (outScope *scope) {
	if !inScope.proc.HasCursor(closeCursor.Name) {
		err := sql.ErrCursorNotFound.New(closeCursor.Name)
		b.handleErr(err)
	}

	outScope = inScope.push()
	outScope.node = plan.NewClose(closeCursor.Name)
	return outScope
}

func (b *Builder) buildLoop(inScope *scope, loop *ast.Loop, fullQuery string) (outScope *scope) {
	outScope = inScope.push()
	outScope.initProc()
	outScope.proc.AddLabel(loop.Label, true)
	block := b.buildBlock(outScope, loop.Statements, fullQuery)
	outScope.node = plan.NewLoop(loop.Label, block)
	return outScope
}

func (b *Builder) buildRepeat(inScope *scope, repeat *ast.Repeat, fullQuery string) (outScope *scope) {
	outScope = inScope.push()
	outScope.initProc()
	outScope.proc.AddLabel(repeat.Label, true)
	block := b.buildBlock(outScope, repeat.Statements, fullQuery)
	expr := b.buildScalar(inScope, repeat.Condition)
	outScope.node = plan.NewRepeat(repeat.Label, expr, block)
	return outScope
}

func (b *Builder) buildWhile(inScope *scope, while *ast.While, fullQuery string) (outScope *scope) {
	outScope = inScope.push()
	outScope.initProc()
	outScope.proc.AddLabel(while.Label, true)
	block := b.buildBlock(outScope, while.Statements, fullQuery)
	expr := b.buildScalar(inScope, while.Condition)
	outScope.node = plan.NewWhile(while.Label, expr, block)
	return outScope
}

func (b *Builder) buildLeave(inScope *scope, leave *ast.Leave) (outScope *scope) {
	if exists, _ := inScope.proc.HasLabel(leave.Label); !exists {
		err := sql.ErrLoopLabelNotFound.New("LEAVE", leave.Label)
		b.handleErr(err)
	}

	outScope = inScope.push()
	outScope.node = plan.NewLeave(leave.Label)
	return outScope
}

func (b *Builder) buildIterate(inScope *scope, iterate *ast.Iterate) (outScope *scope) {
	if exists, isLoop := inScope.proc.HasLabel(iterate.Label); !exists || !isLoop {
		err := sql.ErrLoopLabelNotFound.New("ITERATE", iterate.Label)
		b.handleErr(err)
	}

	outScope = inScope.push()
	outScope.node = plan.NewIterate(iterate.Label)
	return outScope
}

func (b *Builder) buildSignal(inScope *scope, s *ast.Signal) (outScope *scope) {
	outScope = inScope.push()
	// https://dev.mysql.com/doc/refman/8.0/en/signal.html#signal-condition-information-items
	signalInfo := make(map[plan.SignalConditionItemName]plan.SignalInfo)
	for _, info := range s.Info {
		si := plan.SignalInfo{}
		si.ConditionItemName = b.buildSignalConditionItemName(info.ConditionItemName)
		if _, ok := signalInfo[si.ConditionItemName]; ok {
			err := fmt.Errorf("duplicate signal condition item")
			b.handleErr(err)
		}

		if si.ConditionItemName == plan.SignalConditionItemName_MysqlErrno {
			switch v := info.Value.(type) {
			case *ast.SQLVal:
				number, err := strconv.ParseUint(string(v.Val), 10, 16)
				if err != nil || number == 0 {
					// We use our own error instead
					err := fmt.Errorf("invalid value '%s' for signal condition information item MYSQL_ERRNO", string(v.Val))
					b.handleErr(err)
				}
				si.IntValue = int64(number)
			default:
				err := fmt.Errorf("invalid value '%v' for signal condition information item MYSQL_ERRNO", info.Value)
				b.handleErr(err)
			}
		} else if si.ConditionItemName == plan.SignalConditionItemName_MessageText {
			switch v := info.Value.(type) {
			case *ast.SQLVal:
				val := string(v.Val)
				if len(val) > 128 {
					err := fmt.Errorf("signal condition information item MESSAGE_TEXT has max length of 128")
					b.handleErr(err)
				}
				si.StrValue = val
			case *ast.ColName:
				var ref sql.Expression
				c, ok := inScope.resolveColumn("", "", v.Name.Lowered(), true, false)
				if ok {
					ref = c.scalarGf()
				} else {
					ref, _, ok = b.buildSysVar(&ast.ColName{Name: v.Name}, ast.SetScope_None)
					if !ok {
						b.handleErr(fmt.Errorf("signal column not found: %s", v.Name.String()))
					}
				}
				si.ExprVal = ref
			default:
				err := fmt.Errorf("invalid value '%v' for signal condition information item MESSAGE_TEXT", info.Value)
				b.handleErr(err)
			}
		} else {
			switch v := info.Value.(type) {
			case *ast.SQLVal:
				val := string(v.Val)
				if len(val) > 64 {
					err := fmt.Errorf("signal condition information item %s has max length of 64", strings.ToUpper(string(si.ConditionItemName)))
					b.handleErr(err)
				}
				si.StrValue = val
			default:
				err := fmt.Errorf("invalid value '%v' for signal condition information item '%s''", info.Value, strings.ToUpper(string(si.ConditionItemName)))
				b.handleErr(err)
			}
		}
		signalInfo[si.ConditionItemName] = si
	}

	sqlStateValue := s.SqlStateValue
	if s.ConditionName != "" {
		signalName := strings.ToLower(s.ConditionName)
		if inScope.proc == nil {
			err := sql.ErrDeclareConditionNotFound.New(signalName)
			b.handleErr(err)
		}
		condition := inScope.proc.GetCondition(signalName)
		if condition == nil {
			err := sql.ErrDeclareConditionNotFound.New(signalName)
			b.handleErr(err)
		}
		if condition.SqlStateValue == "" {
			err := sql.ErrSignalOnlySqlState.New()
			b.handleErr(err)
		}
		sqlStateValue = condition.SqlStateValue
	} else {
		if len(sqlStateValue) != 5 {
			err := fmt.Errorf("SQLSTATE VALUE must be a string with length 5 consisting of only integers")
			b.handleErr(err)
		}
		if sqlStateValue[0:2] == "00" {
			err := fmt.Errorf("invalid SQLSTATE VALUE: '%s'", s.SqlStateValue)
			b.handleErr(err)
		}
	}

	signal := plan.NewSignal(sqlStateValue, signalInfo)
	outScope.node = signal
	return outScope
}

func (b *Builder) buildSignalConditionItemName(name ast.SignalConditionItemName) plan.SignalConditionItemName {
	// We convert to our own plan equivalents to keep a separation between the parser and implementation
	switch name {
	case ast.SignalConditionItemName_ClassOrigin:
		return plan.SignalConditionItemName_ClassOrigin
	case ast.SignalConditionItemName_SubclassOrigin:
		return plan.SignalConditionItemName_SubclassOrigin
	case ast.SignalConditionItemName_MessageText:
		return plan.SignalConditionItemName_MessageText
	case ast.SignalConditionItemName_MysqlErrno:
		return plan.SignalConditionItemName_MysqlErrno
	case ast.SignalConditionItemName_ConstraintCatalog:
		return plan.SignalConditionItemName_ConstraintCatalog
	case ast.SignalConditionItemName_ConstraintSchema:
		return plan.SignalConditionItemName_ConstraintSchema
	case ast.SignalConditionItemName_ConstraintName:
		return plan.SignalConditionItemName_ConstraintName
	case ast.SignalConditionItemName_CatalogName:
		return plan.SignalConditionItemName_CatalogName
	case ast.SignalConditionItemName_SchemaName:
		return plan.SignalConditionItemName_SchemaName
	case ast.SignalConditionItemName_TableName:
		return plan.SignalConditionItemName_TableName
	case ast.SignalConditionItemName_ColumnName:
		return plan.SignalConditionItemName_ColumnName
	case ast.SignalConditionItemName_CursorName:
		return plan.SignalConditionItemName_CursorName
	default:
		err := fmt.Errorf("unknown signal condition item name: %s", string(name))
		b.handleErr(err)
	}
	return plan.SignalConditionItemName_Unknown
}
