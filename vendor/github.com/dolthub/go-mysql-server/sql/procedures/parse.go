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
	"github.com/dolthub/vitess/go/mysql"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"
)

// resolveGoToIndexes will iterate over operations from start to end, and resolve the indexes of any OpCode_Goto
// operations, assigning either loopStart or loopEnd.
func resolveGoToIndexes(ops *[]*InterpreterOperation, label string, start, end, loopStart, loopEnd int) {
	if label == "" {
		return
	}
	for idx := start; idx < end; idx++ {
		op := (*ops)[idx]
		switch op.OpCode {
		case OpCode_Goto:
			if op.Target != label {
				continue
			}
			switch op.Index {
			case -1: // iterate
				(*ops)[idx].Index = loopStart
			case -2: // leave
				(*ops)[idx].Index = loopEnd
			default:
				continue
			}
		default:
			continue
		}
	}
}

func ConvertStmt(ops *[]*InterpreterOperation, stack *InterpreterStack, stmt ast.Statement) error {
	switch s := stmt.(type) {
	case *ast.BeginEndBlock:
		stack.PushScope()
		startOp := &InterpreterOperation{
			OpCode: OpCode_ScopeBegin,
			Target: s.Label,
		}
		*ops = append(*ops, startOp)
		startOp.Index = len(*ops)

		for _, ss := range s.Statements {
			if err := ConvertStmt(ops, stack, ss); err != nil {
				return err
			}
		}

		endOp := &InterpreterOperation{
			OpCode: OpCode_ScopeEnd,
			Target: s.Label,
		}
		*ops = append(*ops, endOp)
		endOp.Index = len(*ops)
		resolveGoToIndexes(ops, s.Label, startOp.Index, endOp.Index, startOp.Index, endOp.Index)

	case *ast.Select:
		selectOp := &InterpreterOperation{
			OpCode:      OpCode_Select,
			PrimaryData: s,
		}
		*ops = append(*ops, selectOp)

	case *ast.Declare:
		declareOp := &InterpreterOperation{
			OpCode:      OpCode_Declare,
			PrimaryData: s,
		}
		*ops = append(*ops, declareOp)

	case *ast.OpenCursor:
		openOp := &InterpreterOperation{
			OpCode:      OpCode_Open,
			PrimaryData: s,
		}
		*ops = append(*ops, openOp)

	case *ast.FetchCursor:
		fetchOp := &InterpreterOperation{
			OpCode:      OpCode_Fetch,
			PrimaryData: s,
		}
		*ops = append(*ops, fetchOp)

	case *ast.CloseCursor:
		closeOp := &InterpreterOperation{
			OpCode:      OpCode_Close,
			PrimaryData: s,
		}
		*ops = append(*ops, closeOp)

	case *ast.Signal:
		signalOp := &InterpreterOperation{
			OpCode:      OpCode_Signal,
			PrimaryData: s,
		}
		*ops = append(*ops, signalOp)

	case *ast.Set:
		if len(s.Exprs) != 1 {
			panic("unexpected number of set expressions")
		}
		setExpr := s.Exprs[0]
		var setOp *InterpreterOperation
		if len(setExpr.Scope) != 0 {
			setOp = &InterpreterOperation{
				OpCode:      OpCode_Execute,
				PrimaryData: s,
			}
		} else {
			selectStmt := &ast.Select{
				SelectExprs: ast.SelectExprs{
					&ast.AliasedExpr{
						Expr: setExpr.Expr,
					},
				},
			}
			setOp = &InterpreterOperation{
				OpCode:      OpCode_Set,
				PrimaryData: selectStmt,
				Target:      setExpr.Name.String(),
			}
		}
		*ops = append(*ops, setOp)

	case *ast.Call:
		callOp := &InterpreterOperation{
			OpCode:      OpCode_Call,
			PrimaryData: s,
		}
		*ops = append(*ops, callOp)

	case *ast.IfStatement:
		var ifElseGotoOps []*InterpreterOperation
		for _, ifCond := range s.Conditions {
			selectCond := &ast.Select{
				SelectExprs: ast.SelectExprs{
					&ast.AliasedExpr{
						Expr: ifCond.Expr,
					},
				},
			}
			ifOp := &InterpreterOperation{
				OpCode:      OpCode_If,
				PrimaryData: selectCond,
			}
			*ops = append(*ops, ifOp)

			for _, ifStmt := range ifCond.Statements {
				if err := ConvertStmt(ops, stack, ifStmt); err != nil {
					return err
				}
			}
			gotoOp := &InterpreterOperation{
				OpCode: OpCode_Goto,
			}
			ifElseGotoOps = append(ifElseGotoOps, gotoOp)
			*ops = append(*ops, gotoOp)

			ifOp.Index = len(*ops) // start of next if statement
		}
		for _, elseStmt := range s.Else {
			if err := ConvertStmt(ops, stack, elseStmt); err != nil {
				return err
			}
		}

		for _, gotoOp := range ifElseGotoOps {
			gotoOp.Index = len(*ops) // end of if statement
		}

	case *ast.CaseStatement:
		var caseGotoOps []*InterpreterOperation
		for _, caseStmt := range s.Cases {
			caseExpr := caseStmt.Case
			if s.Expr != nil {
				caseExpr = &ast.ComparisonExpr{
					Operator: ast.EqualStr,
					Left:     s.Expr,
					Right:    caseExpr,
				}
			}
			caseCond := &ast.Select{
				SelectExprs: ast.SelectExprs{
					&ast.AliasedExpr{
						Expr: caseExpr,
					},
				},
			}
			caseOp := &InterpreterOperation{
				OpCode:      OpCode_If,
				PrimaryData: caseCond,
			}
			*ops = append(*ops, caseOp)

			for _, ifStmt := range caseStmt.Statements {
				if err := ConvertStmt(ops, stack, ifStmt); err != nil {
					return err
				}
			}
			gotoOp := &InterpreterOperation{
				OpCode: OpCode_Goto,
			}
			caseGotoOps = append(caseGotoOps, gotoOp)
			*ops = append(*ops, gotoOp)

			caseOp.Index = len(*ops) // start of next case
		}
		if s.Else == nil {
			// throw an error if when there is no else block
			// this is just an empty case statement that will always hit the else
			errOp := &InterpreterOperation{
				OpCode: OpCode_Exception,
				Error:  mysql.NewSQLError(1339, "20000", "Case not found for CASE statement"),
			}
			*ops = append(*ops, errOp)
		} else {
			for _, elseStmt := range s.Else {
				if err := ConvertStmt(ops, stack, elseStmt); err != nil {
					return err
				}
			}
		}

		for _, gotoOp := range caseGotoOps {
			gotoOp.Index = len(*ops) // end of case block
		}

	case *ast.While:
		loopStart := len(*ops)

		whileCond := s.Condition
		selectCond := &ast.Select{
			SelectExprs: ast.SelectExprs{
				&ast.AliasedExpr{
					Expr: whileCond,
				},
			},
		}
		whileOp := &InterpreterOperation{
			OpCode:      OpCode_If,
			PrimaryData: selectCond,
		}
		*ops = append(*ops, whileOp)

		for _, whileStmt := range s.Statements {
			if err := ConvertStmt(ops, stack, whileStmt); err != nil {
				return err
			}
		}
		gotoOp := &InterpreterOperation{
			OpCode: OpCode_Goto,
			Index:  loopStart,
		}
		*ops = append(*ops, gotoOp)
		whileOp.Index = len(*ops) // end of while block
		resolveGoToIndexes(ops, s.Label, loopStart, whileOp.Index, loopStart, whileOp.Index)

	case *ast.Repeat:
		// repeat statements always run at least once
		onceStart := len(*ops)
		for _, repeatStmt := range s.Statements {
			if err := ConvertStmt(ops, stack, repeatStmt); err != nil {
				return err
			}
		}

		loopStart := len(*ops)
		if s.Label != "" {
			stack.NewLabel(s.Label, loopStart)
		}
		repeatCond := &ast.NotExpr{Expr: s.Condition}
		selectCond := &ast.Select{
			SelectExprs: ast.SelectExprs{
				&ast.AliasedExpr{
					Expr: repeatCond,
				},
			},
		}
		repeatOp := &InterpreterOperation{
			OpCode:      OpCode_If,
			PrimaryData: selectCond,
		}
		*ops = append(*ops, repeatOp)

		for _, repeatStmt := range s.Statements {
			if err := ConvertStmt(ops, stack, repeatStmt); err != nil {
				return err
			}
		}

		gotoOp := &InterpreterOperation{
			OpCode: OpCode_Goto,
			Index:  loopStart,
		}
		*ops = append(*ops, gotoOp)
		repeatOp.Index = len(*ops) // end of repeat block
		resolveGoToIndexes(ops, s.Label, onceStart, repeatOp.Index, loopStart, repeatOp.Index)

	case *ast.Loop:
		loopStart := len(*ops)
		if s.Label != "" {
			stack.NewLabel(s.Label, loopStart)
		}
		for _, loopStmt := range s.Statements {
			if err := ConvertStmt(ops, stack, loopStmt); err != nil {
				return err
			}
		}
		gotoOp := &InterpreterOperation{
			OpCode: OpCode_Goto,
			Target: s.Label,
			Index:  loopStart,
		}
		*ops = append(*ops, gotoOp)
		loopEnd := len(*ops)
		resolveGoToIndexes(ops, s.Label, loopStart, loopEnd, loopStart, loopEnd)

	case *ast.Iterate:
		iterateOp := &InterpreterOperation{
			OpCode: OpCode_Goto,
			Target: s.Label,
			Index:  stack.GetLabel(s.Label), // possible this is -1, which will get resolved later
		}
		*ops = append(*ops, iterateOp)

	case *ast.Leave:
		leaveOp := &InterpreterOperation{
			OpCode: OpCode_Goto,
			Target: s.Label,
			Index:  -2, // -2 indicates that this is a leave statement with unknown target index
		}
		*ops = append(*ops, leaveOp)

	default:
		executeOp := &InterpreterOperation{
			OpCode:      OpCode_Execute,
			PrimaryData: s,
		}
		*ops = append(*ops, executeOp)
	}

	return nil
}

// Parse takes the ast.Statement and converts it series of OpCodes.
func Parse(stmt ast.Statement) ([]*InterpreterOperation, error) {
	ops := make([]*InterpreterOperation, 0, 64)
	stack := NewInterpreterStack()
	err := ConvertStmt(&ops, stack, stmt)
	if err != nil {
		return nil, err
	}
	return ops, nil
}
