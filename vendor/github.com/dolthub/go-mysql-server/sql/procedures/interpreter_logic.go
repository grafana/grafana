// Copyright 2025 Dolthub, Inc.
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

package procedures

import (
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/vitess/go/mysql"
	ast "github.com/dolthub/vitess/go/vt/sqlparser"
)

// InterpreterExpr is an interface that implements an interpreter. These are typically used for functions (which may be
// implemented as a set of operations that are interpreted during runtime).
type InterpreterExpr interface {
	SetStatementRunner(ctx *sql.Context, runner sql.StatementRunner) sql.Expression
}

// InterpreterNode is an interface that implements an interpreter. These are typically used for functions (which may be
// implemented as a set of operations that are interpreted during runtime).
type InterpreterNode interface {
	GetAsOf() sql.Expression
	GetRunner() sql.StatementRunner
	GetStatements() []*InterpreterOperation
	SetStatementRunner(ctx *sql.Context, runner sql.StatementRunner) sql.Node
	SetSchema(sch sql.Schema)
}

// replaceVariablesInExpr will search for every ast.Node and handle each one on a case by case basis.
// If a new ast.Node is added to the vitess parser we may need to add a case for it here.
func replaceVariablesInExpr(ctx *sql.Context, stack *InterpreterStack, expr ast.SQLNode, asOf *ast.AsOf) (ast.SQLNode, error) {
	switch e := expr.(type) {
	case *ast.ColName:
		varName := strings.ToLower(e.Name.String())
		iv := stack.GetVariable(varName)
		if iv == nil {
			spp := ctx.Session.GetStoredProcParam(varName)
			if spp == nil {
				return expr, nil
			}
			iv = &InterpreterVariable{
				Value:      spp.Value,
				Type:       spp.Type,
				HasBeenSet: spp.HasBeenSet,
			}
		}
		newExpr := iv.ToAST()
		return &ast.ColName{
			Name:          e.Name,
			Qualifier:     e.Qualifier,
			StoredProcVal: newExpr,
		}, nil
	case *ast.ParenExpr:
		newExpr, err := replaceVariablesInExpr(ctx, stack, e.Expr, asOf)
		if err != nil {
			return nil, err
		}
		e.Expr = newExpr.(ast.Expr)
	case *ast.AliasedTableExpr:
		newExpr, err := replaceVariablesInExpr(ctx, stack, e.Expr, asOf)
		if err != nil {
			return nil, err
		}
		e.Expr = newExpr.(ast.SimpleTableExpr)
		if e.AsOf == nil && asOf != nil {
			e.AsOf = asOf
		}
	case *ast.AliasedExpr:
		newExpr, err := replaceVariablesInExpr(ctx, stack, e.Expr, asOf)
		if err != nil {
			return nil, err
		}
		e.Expr = newExpr.(ast.Expr)
	case *ast.BinaryExpr:
		newLeftExpr, err := replaceVariablesInExpr(ctx, stack, e.Left, asOf)
		if err != nil {
			return nil, err
		}
		newRightExpr, err := replaceVariablesInExpr(ctx, stack, e.Right, asOf)
		if err != nil {
			return nil, err
		}
		e.Left = newLeftExpr.(ast.Expr)
		e.Right = newRightExpr.(ast.Expr)
	case *ast.ComparisonExpr:
		newLeftExpr, err := replaceVariablesInExpr(ctx, stack, e.Left, asOf)
		if err != nil {
			return nil, err
		}
		newRightExpr, err := replaceVariablesInExpr(ctx, stack, e.Right, asOf)
		if err != nil {
			return nil, err
		}
		e.Left = newLeftExpr.(ast.Expr)
		e.Right = newRightExpr.(ast.Expr)
	case *ast.AndExpr:
		newLeftExpr, err := replaceVariablesInExpr(ctx, stack, e.Left, asOf)
		if err != nil {
			return nil, err
		}
		newRightExpr, err := replaceVariablesInExpr(ctx, stack, e.Right, asOf)
		if err != nil {
			return nil, err
		}
		e.Left = newLeftExpr.(ast.Expr)
		e.Right = newRightExpr.(ast.Expr)
	case *ast.OrExpr:
		newLeftExpr, err := replaceVariablesInExpr(ctx, stack, e.Left, asOf)
		if err != nil {
			return nil, err
		}
		newRightExpr, err := replaceVariablesInExpr(ctx, stack, e.Right, asOf)
		if err != nil {
			return nil, err
		}
		e.Left = newLeftExpr.(ast.Expr)
		e.Right = newRightExpr.(ast.Expr)
	case *ast.NotExpr:
		newExpr, err := replaceVariablesInExpr(ctx, stack, e.Expr, asOf)
		if err != nil {
			return nil, err
		}
		e.Expr = newExpr.(ast.Expr)
	case *ast.ExistsExpr:
		newSubquery, err := replaceVariablesInExpr(ctx, stack, e.Subquery, asOf)
		if err != nil {
			return nil, err
		}
		e.Subquery = newSubquery.(*ast.Subquery)
	case *ast.FuncExpr:
		for i := range e.Exprs {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.Exprs[i], asOf)
			if err != nil {
				return nil, err
			}
			e.Exprs[i] = newExpr.(ast.SelectExpr)
		}
	case *ast.TableFuncExpr:
		for i := range e.Exprs {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.Exprs[i], asOf)
			if err != nil {
				return nil, err
			}
			e.Exprs[i] = newExpr.(ast.SelectExpr)
		}
	case *ast.Set:
		for _, setExpr := range e.Exprs {
			newExpr, err := replaceVariablesInExpr(ctx, stack, setExpr.Expr, asOf)
			if err != nil {
				return nil, err
			}
			setExpr.Expr = newExpr.(ast.Expr)
			if setExpr.Scope == ast.SetScope_User {
				continue
			}
			err = stack.SetVariable(setExpr.Name.String(), newExpr)
			if err != nil {
				return nil, err
			}
		}
	case *ast.Call:
		for i := range e.Params {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.Params[i], asOf)
			if err != nil {
				return nil, err
			}
			e.Params[i] = newExpr.(ast.Expr)
		}
		if e.AsOf == nil && asOf != nil {
			e.AsOf = asOf.Time
		}
		if len(e.ProcName.Qualifier.String()) == 0 {
			e.ProcName.Qualifier = ast.NewTableIdent(stack.GetDatabase())
		}
	case *ast.Limit:
		newOffset, err := replaceVariablesInExpr(ctx, stack, e.Offset, asOf)
		if err != nil {
			return nil, err
		}
		newRowCount, err := replaceVariablesInExpr(ctx, stack, e.Rowcount, asOf)
		if err != nil {
			return nil, err
		}
		if newOffset != nil {
			e.Offset = newOffset.(ast.Expr)
		}
		if newRowCount != nil {
			e.Rowcount = newRowCount.(ast.Expr)
		}
	case *ast.Into:
		for i := range e.Variables {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.Variables[i], asOf)
			if err != nil {
				return nil, err
			}
			e.Variables[i] = newExpr.(ast.ColIdent)
		}
	case *ast.Select:
		for i := range e.SelectExprs {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.SelectExprs[i], asOf)
			if err != nil {
				return nil, err
			}
			e.SelectExprs[i] = newExpr.(ast.SelectExpr)
		}
		if e.With != nil {
			for i := range e.With.Ctes {
				newExpr, err := replaceVariablesInExpr(ctx, stack, e.With.Ctes[i].AliasedTableExpr, asOf)
				if err != nil {
					return nil, err
				}
				e.With.Ctes[i].AliasedTableExpr = newExpr.(*ast.AliasedTableExpr)
			}
		}
		if e.Into != nil {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.Into, asOf)
			if err != nil {
				return nil, err
			}
			e.Into = newExpr.(*ast.Into)
		}
		if e.Where != nil {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.Where.Expr, asOf)
			if err != nil {
				return nil, err
			}
			e.Where.Expr = newExpr.(ast.Expr)
		}
		if e.Limit != nil {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.Limit, asOf)
			if err != nil {
				return nil, err
			}
			e.Limit = newExpr.(*ast.Limit)
		}
		if e.From != nil {
			for i := range e.From {
				newExpr, err := replaceVariablesInExpr(ctx, stack, e.From[i], asOf)
				if err != nil {
					return nil, err
				}
				e.From[i] = newExpr.(ast.TableExpr)
			}
		}
	case *ast.Subquery:
		newExpr, err := replaceVariablesInExpr(ctx, stack, e.Select, asOf)
		if err != nil {
			return nil, err
		}
		e.Select = newExpr.(*ast.Select)
	case *ast.SetOp:
		newLeftExpr, err := replaceVariablesInExpr(ctx, stack, e.Left, asOf)
		if err != nil {
			return nil, err
		}
		newRightExpr, err := replaceVariablesInExpr(ctx, stack, e.Right, asOf)
		if err != nil {
			return nil, err
		}
		e.Left = newLeftExpr.(ast.SelectStatement)
		e.Right = newRightExpr.(ast.SelectStatement)
	case ast.ValTuple:
		for i := range e {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e[i], asOf)
			if err != nil {
				return nil, err
			}
			e[i] = newExpr.(ast.Expr)
		}
	case *ast.AliasedValues:
		for i := range e.Values {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.Values[i], asOf)
			if err != nil {
				return nil, err
			}
			e.Values[i] = newExpr.(ast.ValTuple)
		}
	case *ast.Insert:
		if asOf != nil {
			return nil, sql.ErrProcedureCallAsOfReadOnly.New()
		}
		newExpr, err := replaceVariablesInExpr(ctx, stack, e.Rows, asOf)
		if err != nil {
			return nil, err
		}
		e.Rows = newExpr.(ast.InsertRows)
	case *ast.Delete:
		if asOf != nil {
			return nil, sql.ErrProcedureCallAsOfReadOnly.New()
		}
		if e.Where != nil {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.Where.Expr, asOf)
			if err != nil {
				return nil, err
			}
			e.Where.Expr = newExpr.(ast.Expr)
		}
	case *ast.Update:
		if asOf != nil {
			return nil, sql.ErrProcedureCallAsOfReadOnly.New()
		}
		if e.Where != nil {
			newExpr, err := replaceVariablesInExpr(ctx, stack, e.Where.Expr, asOf)
			if err != nil {
				return nil, err
			}
			e.Where.Expr = newExpr.(ast.Expr)
		}
	case *ast.ConvertExpr:
		newExpr, err := replaceVariablesInExpr(ctx, stack, e.Expr, asOf)
		if err != nil {
			return nil, err
		}
		e.Expr = newExpr.(ast.Expr)
	}

	return expr, nil
}

func query(ctx *sql.Context, runner sql.StatementRunner, stmt ast.Statement) (sql.Schema, sql.RowIter, error) {
	sch, rowIter, _, err := runner.QueryWithBindings(ctx, "", stmt, nil, nil)
	if err != nil {
		return nil, nil, err
	}
	var rows []sql.Row
	for {
		row, rErr := rowIter.Next(ctx)
		if rErr != nil {
			if rErr == io.EOF {
				break
			}
			if cErr := rowIter.Close(ctx); cErr != nil {
				return nil, nil, cErr
			}
			return nil, nil, rErr
		}
		rows = append(rows, row)
	}
	if err = rowIter.Close(ctx); err != nil {
		return nil, nil, err
	}
	return sch, sql.RowsToRowIter(rows...), nil
}

// handleError handles errors that occur during the execution of a procedure according to the defined handlers.
func handleError(ctx *sql.Context, runner sql.StatementRunner, stack *InterpreterStack, statements []*InterpreterOperation, counter int, err error) (int, error) {
	if err == nil {
		return counter, nil
	}

	var matchingHandler *InterpreterHandler
	for _, handler := range stack.ListHandlers() {
		if errors.Is(err, expression.FetchEOF) {
			if handler.Condition == ast.DeclareHandlerCondition_NotFound {
				matchingHandler = handler
			}
			break
		}
		switch handler.Condition {
		case ast.DeclareHandlerCondition_MysqlErrorCode:
		case ast.DeclareHandlerCondition_SqlState:
		case ast.DeclareHandlerCondition_ConditionName:
		case ast.DeclareHandlerCondition_SqlWarning:
		case ast.DeclareHandlerCondition_NotFound:
		case ast.DeclareHandlerCondition_SqlException:
			matchingHandler = handler
			break
		}
	}

	if matchingHandler == nil {
		return -1, err
	}

	handlerOps := make([]*InterpreterOperation, 0, 1)
	err = ConvertStmt(&handlerOps, stack, matchingHandler.Statement)
	if err != nil {
		return -1, err
	}

	_, _, _, rowIter, err := execOp(ctx, runner, stack, handlerOps[0], handlerOps, nil, -1)
	if err != nil {
		return -1, err
	}
	if rowIter != nil {
		for {
			_, err = rowIter.Next(ctx)
			if err != nil {
				return -1, err
			}
		}
	}

	switch matchingHandler.Action {
	case ast.DeclareHandlerAction_Continue:
		return counter, nil
	case ast.DeclareHandlerAction_Exit:
		remainingEndScopes := 1
		var newCounter int
		for newCounter = matchingHandler.Counter; newCounter < len(statements); newCounter++ {
			if remainingEndScopes == 0 {
				break
			}
			switch statements[newCounter].OpCode {
			case OpCode_ScopeBegin:
				remainingEndScopes++
			case OpCode_ScopeEnd:
				remainingEndScopes--
			default:
			}
		}
		return newCounter - 1, io.EOF
	case ast.DeclareHandlerAction_Undo:
		return -1, fmt.Errorf("DECLARE UNDO HANDLER is not supported")
	}
	return counter, nil
}

func execOp(ctx *sql.Context, runner sql.StatementRunner, stack *InterpreterStack, operation *InterpreterOperation, statements []*InterpreterOperation, asOf *ast.AsOf, counter int) (int, sql.Schema, sql.RowIter, sql.RowIter, error) {
	switch operation.OpCode {
	case OpCode_Select:
		if counter == 2 {
			print()
		}
		selectStmt := operation.PrimaryData.(*ast.Select)
		if newSelectStmt, err := replaceVariablesInExpr(ctx, stack, selectStmt, asOf); err == nil {
			selectStmt = newSelectStmt.(*ast.Select)
		} else {
			return 0, nil, nil, nil, err
		}

		if selectStmt.Into == nil {
			sch, rowIter, err := query(ctx, runner, selectStmt)
			if err != nil {
				return 0, nil, nil, nil, err
			}
			return counter, sch, rowIter, rowIter, nil
		}

		selectInto := selectStmt.Into
		selectStmt.Into = nil
		schema, rowIter, _, err := runner.QueryWithBindings(ctx, "", selectStmt, nil, nil)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		row, err := rowIter.Next(ctx)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		if _, err = rowIter.Next(ctx); err != io.EOF {
			if rErr := rowIter.Close(ctx); rErr != nil {
				return 0, nil, nil, nil, rErr
			}
			return 0, nil, nil, nil, err
		}
		if err = rowIter.Close(ctx); err != nil {
			return 0, nil, nil, nil, err
		}
		if len(row) != len(selectInto.Variables) {
			return 0, nil, nil, nil, sql.ErrColumnNumberDoesNotMatch.New()
		}
		for i := range selectInto.Variables {
			intoVar := strings.ToLower(selectInto.Variables[i].String())
			if strings.HasPrefix(intoVar, "@") {
				err = ctx.SetUserVariable(ctx, intoVar, row[i], schema[i].Type)
				if err != nil {
					return 0, nil, nil, nil, err
				}
			}
			err = stack.SetVariable(intoVar, row[i])
			if err != nil {
				err = ctx.Session.SetStoredProcParam(intoVar, row[i])
				if err != nil {
					return 0, nil, nil, nil, err
				}
			}
		}

	case OpCode_Declare:
		declareStmt := operation.PrimaryData.(*ast.Declare)

		if cond := declareStmt.Condition; cond != nil {
			condName := strings.ToLower(cond.Name)
			stateVal := cond.SqlStateValue
			var num int64
			var err error
			if stateVal != "" {
				if len(stateVal) != 5 {
					return 0, nil, nil, nil, fmt.Errorf("SQLSTATE VALUE must be a string with length 5 consisting of only integers")
				}
				if stateVal[0:2] == "00" {
					return 0, nil, nil, nil, fmt.Errorf("invalid SQLSTATE VALUE: '%s'", stateVal)
				}
			} else {
				// use our own error
				num, err = strconv.ParseInt(string(cond.MysqlErrorCode.Val), 10, 64)
				if err != nil || num == 0 {
					err = fmt.Errorf("invalid value '%s' for MySQL error code", string(cond.MysqlErrorCode.Val))
					return 0, nil, nil, nil, err
				}
			}
			stack.NewCondition(condName, stateVal, num)
		}

		if cursor := declareStmt.Cursor; cursor != nil {
			cursorName := strings.ToLower(cursor.Name)
			stack.NewCursor(cursorName, cursor.SelectStmt)
		}

		if handler := declareStmt.Handler; handler != nil {
			if len(handler.ConditionValues) != 1 {
				return 0, nil, nil, nil, sql.ErrUnsupportedSyntax.New(ast.String(declareStmt))
			}

			hCond := handler.ConditionValues[0]
			switch hCond.ValueType {
			case ast.DeclareHandlerCondition_NotFound:
			case ast.DeclareHandlerCondition_SqlException:
			default:
				return 0, nil, nil, nil, sql.ErrUnsupportedSyntax.New(ast.String(declareStmt))
			}

			switch handler.Action {
			case ast.DeclareHandlerAction_Continue:
			case ast.DeclareHandlerAction_Exit:
			case ast.DeclareHandlerAction_Undo:
				return 0, nil, nil, nil, fmt.Errorf("unsupported handler action: %s", handler.Action)
			}

			stack.NewHandler(hCond.ValueType, handler.Action, handler.Statement, counter)
		}

		if vars := declareStmt.Variables; vars != nil {
			for _, decl := range vars.Names {
				varType, err := types.ColumnTypeToType(&vars.VarType)
				if err != nil {
					return 0, nil, nil, nil, err
				}
				varName := strings.ToLower(decl.String())
				if vars.VarType.Default == nil {
					stack.NewVariable(varName, varType)
					continue
				}
				stack.NewVariableWithValue(varName, varType, vars.VarType.Default)
			}
		}

	case OpCode_Signal:
		signalStmt := operation.PrimaryData.(*ast.Signal)
		var msgTxt string
		var sqlState string
		var mysqlErrNo int
		if signalStmt.ConditionName == "" {
			sqlState = signalStmt.SqlStateValue
			if sqlState[0:2] == "01" {
				return 0, nil, nil, nil, fmt.Errorf("warnings not yet implemented")
			}
		} else {
			cond := stack.GetCondition(signalStmt.ConditionName)
			if cond == nil {
				return 0, nil, nil, nil, sql.ErrDeclareConditionNotFound.New(signalStmt.ConditionName)
			}
			sqlState = cond.SQLState
			mysqlErrNo = int(cond.MySQLErrCode)
		}

		if len(sqlState) != 5 {
			return 0, nil, nil, nil, fmt.Errorf("SQLSTATE VALUE must be a string with length 5 consisting of only integers")
		}

		for _, item := range signalStmt.Info {
			switch item.ConditionItemName {
			case ast.SignalConditionItemName_MysqlErrno:
				switch val := item.Value.(type) {
				case *ast.SQLVal:
					num, err := strconv.ParseInt(string(val.Val), 10, 64)
					if err != nil || num == 0 {
						return 0, nil, nil, nil, fmt.Errorf("invalid value '%s' for MySQL error code", string(val.Val))
					}
					mysqlErrNo = int(num)
				case *ast.ColName:
					return 0, nil, nil, nil, fmt.Errorf("unsupported signal message text type: %T", val)
				default:
					return 0, nil, nil, nil, fmt.Errorf("invalid value '%v' for signal condition information item MESSAGE_TEXT", val)
				}
			case ast.SignalConditionItemName_MessageText:
				switch val := item.Value.(type) {
				case *ast.SQLVal:
					msgTxt = string(val.Val)
					if len(msgTxt) > 128 {
						return 0, nil, nil, nil, fmt.Errorf("signal condition information item MESSAGE_TEXT has max length of 128")
					}
				case *ast.ColName:
					return 0, nil, nil, nil, fmt.Errorf("unsupported signal message text type: %T", val)
				default:
					return 0, nil, nil, nil, fmt.Errorf("invalid value '%v' for signal condition information item MESSAGE_TEXT", val)
				}
			default:
				switch val := item.Value.(type) {
				case *ast.SQLVal:
					msgTxt = string(val.Val)
					if len(msgTxt) > 64 {
						return 0, nil, nil, nil, fmt.Errorf("signal condition information item %s has max length of 64", strings.ToUpper(string(item.ConditionItemName)))
					}
				default:
					return 0, nil, nil, nil, fmt.Errorf("invalid value '%v' for signal condition information item '%s''", item.Value, strings.ToUpper(string(item.ConditionItemName)))
				}
			}
		}

		if mysqlErrNo == 0 {
			switch sqlState[0:2] {
			case "01":
				mysqlErrNo = 1642
			case "02":
				mysqlErrNo = 1643
			default:
				mysqlErrNo = 1644
			}
		}

		if msgTxt == "" {
			switch sqlState[0:2] {
			case "00":
				return 0, nil, nil, nil, fmt.Errorf("invalid SQLSTATE VALUE: '%s'", sqlState)
			case "01":
				msgTxt = "Unhandled user-defined warning condition"
			case "02":
				msgTxt = "Unhandled user-defined not found condition"
			default:
				msgTxt = "Unhandled user-defined exception condition"
			}
		}

		return 0, nil, nil, nil, mysql.NewSQLError(mysqlErrNo, sqlState, "%s", msgTxt)

	case OpCode_Open:
		openCur := operation.PrimaryData.(*ast.OpenCursor)
		cursor := stack.GetCursor(openCur.Name)
		if cursor == nil {
			return 0, nil, nil, nil, sql.ErrCursorNotFound.New(openCur.Name)
		}
		if cursor.RowIter != nil {
			return 0, nil, nil, nil, sql.ErrCursorAlreadyOpen.New(openCur.Name)
		}
		stmt, err := replaceVariablesInExpr(ctx, stack, cursor.SelectStmt, asOf)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		schema, rowIter, _, err := runner.QueryWithBindings(ctx, "", stmt.(ast.Statement), nil, nil)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		cursor.Schema = schema
		cursor.RowIter = rowIter

	case OpCode_Fetch:
		fetchCur := operation.PrimaryData.(*ast.FetchCursor)
		cursor := stack.GetCursor(fetchCur.Name)
		if cursor == nil {
			return 0, nil, nil, nil, sql.ErrCursorNotFound.New(fetchCur.Name)
		}
		if cursor.RowIter == nil {
			return 0, nil, nil, nil, sql.ErrCursorNotOpen.New(fetchCur.Name)
		}
		row, err := cursor.RowIter.Next(ctx)
		if err != nil {
			if err == io.EOF {
				return 0, nil, nil, nil, expression.FetchEOF
			}
			return 0, nil, nil, nil, err
		}
		if len(row) != len(fetchCur.Variables) {
			return 0, nil, nil, nil, sql.ErrFetchIncorrectCount.New()
		}
		for i := range fetchCur.Variables {
			varName := strings.ToLower(fetchCur.Variables[i])
			if strings.HasPrefix(varName, "@") {
				err = ctx.SetUserVariable(ctx, varName, row[i], cursor.Schema[i].Type)
				if err != nil {
					return 0, nil, nil, nil, err
				}
				continue
			}
			err = stack.SetVariable(varName, row[i])
			if err != nil {
				return 0, nil, nil, nil, err
			}
		}

	case OpCode_Close:
		closeCur := operation.PrimaryData.(*ast.CloseCursor)
		cursor := stack.GetCursor(closeCur.Name)
		if cursor == nil {
			return 0, nil, nil, nil, sql.ErrCursorNotFound.New(closeCur.Name)
		}
		if cursor.RowIter == nil {
			return 0, nil, nil, nil, sql.ErrCursorNotOpen.New(closeCur.Name)
		}
		if err := cursor.RowIter.Close(ctx); err != nil {
			return 0, nil, nil, nil, err
		}
		cursor.RowIter = nil

	case OpCode_Set:
		selectStmt := operation.PrimaryData.(*ast.Select)
		if selectStmt.SelectExprs == nil {
			panic("select stmt with no select exprs")
		}
		for i := range selectStmt.SelectExprs {
			newNode, err := replaceVariablesInExpr(ctx, stack, selectStmt.SelectExprs[i], asOf)
			if err != nil {
				return 0, nil, nil, nil, err
			}
			selectStmt.SelectExprs[i] = newNode.(ast.SelectExpr)
		}
		_, rowIter, _, err := runner.QueryWithBindings(ctx, "", selectStmt, nil, nil)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		row, err := rowIter.Next(ctx)
		if err != nil {
			if cErr := rowIter.Close(ctx); cErr != nil {
				return 0, nil, nil, nil, cErr
			}
			return 0, nil, nil, nil, err
		}
		if _, err = rowIter.Next(ctx); err != io.EOF {
			return 0, nil, nil, nil, err
		}
		if err = rowIter.Close(ctx); err != nil {
			return 0, nil, nil, nil, err
		}

		err = stack.SetVariable(operation.Target, row[0])
		if err != nil {
			err = ctx.Session.SetStoredProcParam(operation.Target, row[0])
			if err != nil {
				return 0, nil, nil, nil, err
			}
		}

	case OpCode_Call:
		stmt, err := replaceVariablesInExpr(ctx, stack, operation.PrimaryData, asOf)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		// put stack variables into session variables
		callStmt := stmt.(*ast.Call)
		stackToParam := make(map[*InterpreterVariable]*sql.StoredProcParam)
		for _, param := range callStmt.Params {
			colName, isColName := param.(*ast.ColName)
			if !isColName {
				continue
			}
			paramName := colName.Name.String()
			iv := stack.GetVariable(paramName)
			if iv == nil {
				continue
			}
			spp := &sql.StoredProcParam{
				Type:  iv.Type,
				Value: iv.Value,
			}
			spp = ctx.Session.NewStoredProcParam(paramName, spp)
			stackToParam[iv] = spp
		}
		sch, rowIter, err := query(ctx, runner, callStmt)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		// assign stored proc params to stack variables
		for iv, spp := range stackToParam {
			iv.Value = spp.Value
		}

		return counter, sch, nil, rowIter, err

	case OpCode_If:
		selectStmt := operation.PrimaryData.(*ast.Select)
		if selectStmt.SelectExprs == nil {
			panic("select stmt with no select exprs")
		}
		for i := range selectStmt.SelectExprs {
			newNode, err := replaceVariablesInExpr(ctx, stack, selectStmt.SelectExprs[i], asOf)
			if err != nil {
				return 0, nil, nil, nil, err
			}
			selectStmt.SelectExprs[i] = newNode.(ast.SelectExpr)
		}
		_, rowIter, _, err := runner.QueryWithBindings(ctx, "", selectStmt, nil, nil)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		row, err := rowIter.Next(ctx)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		if _, err = rowIter.Next(ctx); err != io.EOF {
			return 0, nil, nil, nil, err
		}
		if err = rowIter.Close(ctx); err != nil {
			return 0, nil, nil, nil, err
		}

		// go to the appropriate block
		cond, _, err := types.Boolean.Convert(ctx, row[0])
		if err != nil {
			return 0, nil, nil, nil, err
		}
		if cond == nil || cond.(int8) == 0 {
			counter = operation.Index - 1 // index of the else block, offset by 1
		}

	case OpCode_Goto:
		// We must compare to the index - 1, so that the increment hits our target
		if counter <= operation.Index {
			for ; counter < operation.Index-1; counter++ {
				switch statements[counter].OpCode {
				case OpCode_ScopeBegin:
					stack.PushScope()
				case OpCode_ScopeEnd:
					stack.PopScope(ctx)
				default:
					// No-op
				}
			}
		} else {
			for ; counter > operation.Index-1; counter-- {
				if counter == -1 {
					print()
				}
				switch statements[counter].OpCode {
				case OpCode_ScopeBegin:
					stack.PopScope(ctx)
				case OpCode_ScopeEnd:
					stack.PushScope()
				default:
					// No-op
				}
			}
		}

	case OpCode_Execute:
		stmt, err := replaceVariablesInExpr(ctx, stack, operation.PrimaryData, asOf)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		sch, rowIter, err := query(ctx, runner, stmt.(ast.Statement))
		if err != nil {
			return 0, nil, nil, nil, err
		}
		return counter, sch, nil, rowIter, err

	case OpCode_Exception:
		return 0, nil, nil, nil, operation.Error

	case OpCode_ScopeBegin:
		stack.PushScope()

	case OpCode_ScopeEnd:
		stack.PopScope(ctx)

	default:
		panic("unimplemented opcode")
	}

	return counter, nil, nil, nil, nil
}

// Call runs the contained operations on the given runner.
func Call(ctx *sql.Context, iNode InterpreterNode) (sql.RowIter, *InterpreterStack, error) {
	// Set up the initial state of the function
	counter := -1 // We increment before accessing, so start at -1
	stack := NewInterpreterStack()

	var asOf *ast.AsOf
	if asOfExpr := iNode.GetAsOf(); asOfExpr != nil {
		switch a := asOfExpr.(type) {
		case *expression.Literal:
			v, err := a.Eval(ctx, nil)
			if err != nil {
				return nil, nil, err
			}
			asOfStr := v.(string)
			asOf = &ast.AsOf{
				Time: ast.NewStrVal([]byte(asOfStr)),
			}
		default:
		}
	}

	var selIter sql.RowIter
	var selSch sql.Schema

	// Run the statements
	var rowIters []sql.RowIter
	var retSch sql.Schema
	runner := iNode.GetRunner()
	statements := iNode.GetStatements()
	if dbNode, isDbNode := iNode.(sql.Databaser); isDbNode {
		stack.SetDatabase(dbNode.Database().Name())
	}
	for {
		counter++
		if counter < 0 {
			panic("negative function counter")
		}
		if counter >= len(statements) {
			break
		}

		subCtx := sql.NewContext(ctx.Context)
		subCtx.Session = ctx.Session

		operation := statements[counter]
		newCounter, sch, newSelIter, rowIter, err := execOp(subCtx, runner, stack, operation, statements, asOf, counter)
		if err != nil {
			hCounter, hErr := handleError(subCtx, runner, stack, statements, counter, err)
			if hErr != nil && hErr != io.EOF {
				return nil, nil, hErr
			}
			if hErr == io.EOF {
				newCounter = hCounter
			} else {
				newCounter = counter
			}
		}
		if rowIter != nil {
			rowIters = append(rowIters, rowIter)
			retSch = sch
		}
		if newSelIter != nil {
			selIter = newSelIter
			selSch = sch
		}
		counter = newCounter
	}

	if selIter != nil {
		iNode.SetSchema(selSch)
		return selIter, stack, nil
	}
	if len(rowIters) == 0 {
		iNode.SetSchema(types.OkResultSchema)
		rowIters = append(rowIters, sql.RowsToRowIter(sql.Row{types.NewOkResult(0)}))
	} else if retSch != nil {
		iNode.SetSchema(retSch)
	} else {
		// If we have rowIters but no meaningful schema, return OkResult
		// This ensures CALL statements always return proper result sets for MySQL protocol
		iNode.SetSchema(types.OkResultSchema)
		rowIters = []sql.RowIter{sql.RowsToRowIter(sql.Row{types.NewOkResult(0)})}
	}

	return rowIters[len(rowIters)-1], stack, nil
}
