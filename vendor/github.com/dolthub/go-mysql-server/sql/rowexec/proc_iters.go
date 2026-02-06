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

package rowexec

import (
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// ifElseIter is the row iterator for *IfElseBlock.
type ifElseIter struct {
	branchIter sql.RowIter
	branchNode sql.Node
	sch        sql.Schema
}

var _ plan.BlockRowIter = (*ifElseIter)(nil)

// Next implements the sql.RowIter interface.
func (i *ifElseIter) Next(ctx *sql.Context) (sql.Row, error) {
	if err := startTransaction(ctx); err != nil {
		return nil, err
	}

	return i.branchIter.Next(ctx)
}

// Close implements the sql.RowIter interface.
func (i *ifElseIter) Close(ctx *sql.Context) error {
	return i.branchIter.Close(ctx)
}

// RepresentingNode implements the sql.BlockRowIter interface.
func (i *ifElseIter) RepresentingNode() sql.Node {
	return i.branchNode
}

// Schema implements the sql.BlockRowIter interface.
func (i *ifElseIter) Schema() sql.Schema {
	return i.sch
}

// beginEndIter is the sql.RowIter of *BeginEndBlock.
type beginEndIter struct {
	*plan.BeginEndBlock
	rowIter sql.RowIter
}

var _ sql.MutableRowIter = (*beginEndIter)(nil)

// Next implements the interface sql.RowIter.
func (b *beginEndIter) Next(ctx *sql.Context) (sql.Row, error) {
	if err := startTransaction(ctx); err != nil {
		return nil, err
	}

	row, err := b.rowIter.Next(ctx)
	if err != nil {
		if controlFlow, ok := err.(loopError); ok && strings.ToLower(controlFlow.Label) == strings.ToLower(b.Label) {
			if controlFlow.IsExit {
				err = nil
			} else {
				err = fmt.Errorf("encountered ITERATE on BEGIN...END, which should should have been caught by the analyzer")
			}
		}
		if nErr := b.Pref.PopScope(ctx); nErr != nil && err == io.EOF {
			err = nErr
		}
		if errors.Is(err, expression.FetchEOF) {
			err = io.EOF
		}
		return nil, err
	}
	return row, nil
}

// Close implements the interface sql.RowIter.
func (b *beginEndIter) Close(ctx *sql.Context) error {
	return b.rowIter.Close(ctx)
}

// GetChildIter implements the sql.MutableRowIter interface.
func (b *beginEndIter) GetChildIter() sql.RowIter {
	return b.rowIter
}

// WithChildIter implements the sql.MutableRowIter interface.
func (b *beginEndIter) WithChildIter(child sql.RowIter) sql.RowIter {
	nb := *b
	nb.rowIter = child
	return &nb
}

// callIter is the row iterator for *Call.
type callIter struct {
	call      *plan.Call
	innerIter sql.RowIter
}

var _ sql.MutableRowIter = (*callIter)(nil)

// Next implements the sql.RowIter interface.
func (ci *callIter) Next(ctx *sql.Context) (sql.Row, error) {
	if ci.innerIter == nil {
		return nil, io.EOF
	}
	return ci.innerIter.Next(ctx)
}

// Close implements the sql.RowIter interface.
func (ci *callIter) Close(ctx *sql.Context) error {
	var err error
	if ci.innerIter != nil {
		err = ci.innerIter.Close(ctx)
		if err != nil {
			return err
		}
	}
	err = ci.call.Pref.CloseAllCursors(ctx)
	if err != nil {
		return err
	}
	if ci.call.Procedure.ExternalProc == nil {
		return nil
	}
	// Set all user and system variables from INOUT and OUT params
	for i, param := range ci.call.Procedure.Params {
		if param.Direction == plan.ProcedureParamDirection_Inout ||
			(param.Direction == plan.ProcedureParamDirection_Out && ci.call.Pref.VariableHasBeenSet(param.Name)) {
			val, err := ci.call.Pref.GetVariableValue(param.Name)
			if err != nil {
				return err
			}

			typ := ci.call.Pref.GetVariableType(param.Name)

			switch callParam := ci.call.Params[i].(type) {
			case *expression.UserVar:
				err = ctx.SetUserVariable(ctx, callParam.Name, val, typ)
				if err != nil {
					return err
				}
			case *expression.SystemVar:
				// This should have been caught by the analyzer, so a major bug exists somewhere
				return fmt.Errorf("unable to set `%s` as it is a system variable", callParam.Name)
			case *expression.ProcedureParam:
				err = callParam.Set(ctx, val, param.Type)
				if err != nil {
					return err
				}
			}
		} else if param.Direction == plan.ProcedureParamDirection_Out { // VariableHasBeenSet was false
			// For OUT only, if a var was not set within the procedure body, then we set the vars to nil.
			// If the var had a value before the call then it is basically removed.
			switch callParam := ci.call.Params[i].(type) {
			case *expression.UserVar:
				err = ctx.SetUserVariable(ctx, callParam.Name, nil, ci.call.Pref.GetVariableType(param.Name))
				if err != nil {
					return err
				}
			case *expression.SystemVar:
				// This should have been caught by the analyzer, so a major bug exists somewhere
				return fmt.Errorf("unable to set `%s` as it is a system variable", callParam.Name)
			case *expression.ProcedureParam:
				err := callParam.Set(ctx, nil, param.Type)
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// GetChildIter implements the sql.MutableRowIter interface.
func (ci *callIter) GetChildIter() sql.RowIter {
	return ci.innerIter
}

// WithChildIter implements the sql.MutableRowIter interface.
func (ci *callIter) WithChildIter(child sql.RowIter) sql.RowIter {
	nci := *ci
	nci.innerIter = child
	return &nci
}

type elseCaseErrorIter struct{}

var _ sql.RowIter = elseCaseErrorIter{}

// Next implements the interface sql.RowIter.
func (e elseCaseErrorIter) Next(ctx *sql.Context) (sql.Row, error) {
	return nil, mysql.NewSQLError(1339, "20000", "Case not found for CASE statement")
}

// Close implements the interface sql.RowIter.
func (e elseCaseErrorIter) Close(context *sql.Context) error {
	return nil
}

// openIter is the sql.RowIter of *Open.
type openIter struct {
	b    *BaseBuilder
	pRef *expression.ProcedureReference
	name string
	row  sql.Row
}

var _ sql.RowIter = (*openIter)(nil)

// Next implements the interface sql.RowIter.
func (o *openIter) Next(ctx *sql.Context) (sql.Row, error) {
	if err := o.openCursor(ctx, o.pRef, o.name, o.row); err != nil {
		return nil, err
	}
	return nil, io.EOF
}

func (o *openIter) openCursor(ctx *sql.Context, ref *expression.ProcedureReference, name string, row sql.Row) error {
	lowerName := strings.ToLower(name)
	scope := ref.InnermostScope
	for scope != nil {
		if cursorRefVal, ok := scope.Cursors[lowerName]; ok {
			if cursorRefVal.RowIter != nil {
				return sql.ErrCursorAlreadyOpen.New(name)
			}
			var err error
			cursorRefVal.RowIter, err = o.b.buildNodeExec(ctx, cursorRefVal.SelectStmt, row)
			return err
		}
		scope = scope.Parent
	}
	return fmt.Errorf("cannot find cursor `%s`", name)
}

// Close implements the interface sql.RowIter.
func (o *openIter) Close(ctx *sql.Context) error {
	return nil
}

// closeIter is the sql.RowIter of *Close.
type closeIter struct {
	pRef *expression.ProcedureReference
	name string
}

var _ sql.RowIter = (*closeIter)(nil)

// Next implements the interface sql.RowIter.
func (c *closeIter) Next(ctx *sql.Context) (sql.Row, error) {
	if err := c.pRef.CloseCursor(ctx, c.name); err != nil {
		return nil, err
	}
	return nil, io.EOF
}

// Close implements the interface sql.RowIter.
func (c *closeIter) Close(ctx *sql.Context) error {
	return nil
}

// loopError is an error used to control a loop's flow.
type loopError struct {
	Label  string
	IsExit bool
}

var _ error = loopError{}

// Error implements the interface error. As long as the analysis step is implemented correctly, this should never be seen.
func (l loopError) Error() string {
	option := "exited"
	if !l.IsExit {
		option = "continued"
	}
	return fmt.Sprintf("should have %s the loop `%s` but it was somehow not found in the call stack", option, l.Label)
}

// loopAcquireRowIter is a helper function for LOOP that conditionally acquires a new sql.RowIter. If a loop exit is
// encountered, `exitIter` determines whether to return an empty iterator or an io.EOF error.
func (b *BaseBuilder) loopAcquireRowIter(ctx *sql.Context, row sql.Row, label string, block *plan.Block, exitIter bool) (sql.RowIter, error) {
	blockIter, err := b.buildBlock(ctx, block, row)
	if controlFlow, ok := err.(loopError); ok && strings.ToLower(controlFlow.Label) == strings.ToLower(label) {
		if controlFlow.IsExit {
			if exitIter {
				return sql.RowsToRowIter(), nil
			} else {
				return nil, io.EOF
			}
		} else {
			err = io.EOF
		}
	}
	if err == io.EOF {
		blockIter = sql.RowsToRowIter()
		err = nil
	}
	return blockIter, err
}

// leaveIter is the sql.RowIter of *Leave.
type leaveIter struct {
	Label string
}

var _ sql.RowIter = (*leaveIter)(nil)

// Next implements the interface sql.RowIter.
func (l *leaveIter) Next(ctx *sql.Context) (sql.Row, error) {
	return nil, loopError{
		Label:  l.Label,
		IsExit: true,
	}
}

// Close implements the interface sql.RowIter.
func (l *leaveIter) Close(ctx *sql.Context) error {
	return nil
}

// iterateIter is the sql.RowIter of *Iterate.
type iterateIter struct {
	Label string
}

var _ sql.RowIter = (*iterateIter)(nil)

// Next implements the interface sql.RowIter.
func (i *iterateIter) Next(ctx *sql.Context) (sql.Row, error) {
	return nil, loopError{
		Label:  i.Label,
		IsExit: false,
	}
}

// Close implements the interface sql.RowIter.
func (i *iterateIter) Close(ctx *sql.Context) error {
	return nil
}

// startTransaction begins a new transaction if necessary, e.g. if a statement in a stored procedure committed the
// current one
func startTransaction(ctx *sql.Context) error {
	if ctx.GetTransaction() == nil {
		ts, ok := ctx.Session.(sql.TransactionSession)
		if ok {
			tx, err := ts.StartTransaction(ctx, sql.ReadWrite)
			if err != nil {
				return err
			}

			ctx.SetTransaction(tx)
		}
	}

	return nil
}
