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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/procedures"
)

func (b *BaseBuilder) buildCaseStatement(ctx *sql.Context, n *plan.CaseStatement, row sql.Row) (sql.RowIter, error) {
	caseValue, err := n.Expr.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	for _, ifConditional := range n.IfElse.IfConditionals {
		whenValue, err := ifConditional.Condition.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		comparison, err := n.Expr.Type().Compare(ctx, caseValue, whenValue)
		if err != nil {
			return nil, err
		}
		if comparison != 0 {
			continue
		}

		return b.buildCaseIter(ctx, row, ifConditional, ifConditional.Body)
	}

	// All conditions failed so we run the else
	return b.buildCaseIter(ctx, row, n.IfElse.Else, n.IfElse.Else)
}

func (b *BaseBuilder) buildCaseIter(ctx *sql.Context, row sql.Row, iterNode sql.Node, bodyNode sql.Node) (sql.RowIter, error) {
	// All conditions failed so we run the else
	branchIter, err := b.buildNodeExec(ctx, iterNode, row)
	if err != nil {
		return nil, err
	}
	// If the branchIter is already a block iter, then we don't need to construct our own, as its contained
	// node and schema will be a better representation of the iterated rows.
	if blockRowIter, ok := branchIter.(plan.BlockRowIter); ok {
		return blockRowIter, nil
	}
	return &ifElseIter{
		branchIter: branchIter,
		sch:        bodyNode.Schema(),
		branchNode: bodyNode,
	}, nil
}

func (b *BaseBuilder) buildIfElseBlock(ctx *sql.Context, n *plan.IfElseBlock, row sql.Row) (sql.RowIter, error) {
	var branchIter sql.RowIter

	var err error
	for _, ifConditional := range n.IfConditionals {
		condition, err := ifConditional.Condition.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		var passedCondition bool
		if condition != nil {
			passedCondition, err = sql.ConvertToBool(ctx, condition)
			if err != nil {
				return nil, err
			}
		}
		if !passedCondition {
			continue
		}

		// TODO: this should happen at iteration time, but this call is where the actual iteration happens
		err = startTransaction(ctx)
		if err != nil {
			return nil, err
		}

		branchIter, err = b.buildNodeExec(ctx, ifConditional, row)
		if err != nil {
			return nil, err
		}
		// If the branchIter is already a block iter, then we don't need to construct our own, as its contained
		// node and schema will be a better representation of the iterated rows.
		if blockRowIter, ok := branchIter.(plan.BlockRowIter); ok {
			return blockRowIter, nil
		}
		return &ifElseIter{
			branchIter: branchIter,
			sch:        ifConditional.Body.Schema(),
			branchNode: ifConditional.Body,
		}, nil
	}

	// TODO: this should happen at iteration time, but this call is where the actual iteration happens
	err = startTransaction(ctx)
	if err != nil {
		return nil, err
	}

	// All conditions failed so we run the else
	branchIter, err = b.buildNodeExec(ctx, n.Else, row)
	if err != nil {
		return nil, err
	}
	// If the branchIter is already a block iter, then we don't need to construct our own, as its contained
	// node and schema will be a better representation of the iterated rows.
	if blockRowIter, ok := branchIter.(plan.BlockRowIter); ok {
		return blockRowIter, nil
	}
	return &ifElseIter{
		branchIter: branchIter,
		sch:        n.Else.Schema(),
		branchNode: n.Else,
	}, nil
}

var exitBlockError = fmt.Errorf("exit block")

func (b *BaseBuilder) buildBeginEndBlock(ctx *sql.Context, n *plan.BeginEndBlock, row sql.Row) (sql.RowIter, error) {
	n.Pref.PushScope()
	rowIter, err := b.buildNodeExec(ctx, n.Block, row)
	if err != nil {
		if controlFlow, ok := err.(loopError); ok && strings.ToLower(controlFlow.Label) == strings.ToLower(n.Label) {
			if controlFlow.IsExit {
				err = nil
			} else {
				err = fmt.Errorf("encountered ITERATE on BEGIN...END, which should should have been caught by the analyzer")
			}
		} else if err == exitBlockError {
			return sql.RowsToRowIter(), nil
		}
		if errors.Is(err, io.EOF) {
			return sql.RowsToRowIter(), nil
		}
		if nErr := n.Pref.PopScope(ctx); err == nil && nErr != nil {
			err = nErr
		}
		if errors.Is(err, expression.FetchEOF) && n.Pref.CurrentHeight() == 1 {
			// Don't return the fetch error in the first BEGIN block, though MySQL returns:
			// ERROR 1329 (02000): No data - zero rows fetched, selected, or processed
			return sql.RowsToRowIter(), nil
		}
		return sql.RowsToRowIter(), err
	}
	return &beginEndIter{
		BeginEndBlock: n,
		rowIter:       rowIter,
	}, nil
}

func (b *BaseBuilder) buildIfConditional(ctx *sql.Context, n *plan.IfConditional, row sql.Row) (sql.RowIter, error) {
	return b.buildNodeExec(ctx, n.Body, row)
}

func (b *BaseBuilder) buildProcedureResolvedTable(ctx *sql.Context, n *plan.ProcedureResolvedTable, row sql.Row) (sql.RowIter, error) {
	rt, err := n.NewestTable(ctx)
	if err != nil {
		return nil, err
	}
	return b.buildResolvedTable(ctx, rt, row)
}

func (b *BaseBuilder) buildCall(ctx *sql.Context, n *plan.Call, row sql.Row) (sql.RowIter, error) {
	if n.Procedure.ExternalProc != nil {
		for i, paramExpr := range n.Params {
			val, err := paramExpr.Eval(ctx, row)
			if err != nil {
				return nil, err
			}
			paramName := n.Procedure.Params[i].Name
			paramType := n.Procedure.Params[i].Type
			err = n.Pref.InitializeVariable(ctx, paramName, paramType, val)
			if err != nil {
				return nil, err
			}
		}

		n.Pref.PushScope()
		defer n.Pref.PopScope(ctx)

		innerIter, err := b.buildNodeExec(ctx, n.Procedure, row)
		if err != nil {
			return nil, err
		}
		return &callIter{
			call:      n,
			innerIter: innerIter,
		}, nil
	}

	// Initialize parameters
	for i, paramExpr := range n.Params {
		param := n.Procedure.Params[i]
		paramVal, err := paramExpr.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		paramVal, _, err = param.Type.Convert(ctx, paramVal)
		if err != nil {
			return nil, err
		}
		paramName := strings.ToLower(param.Name)
		for spp := ctx.Session.GetStoredProcParam(paramName); spp != nil; {
			spp.Value = paramVal
			if spp.Reference == spp {
				break
			}
			spp = spp.Reference
		}
	}

	// Preserve existing transaction
	oldTx := ctx.GetTransaction()
	defer ctx.SetTransaction(oldTx)
	ctx.SetTransaction(nil)

	rowIter, _, err := procedures.Call(ctx, n)
	if err != nil {
		return nil, err
	}

	for i, param := range n.Params {
		procParam := n.Procedure.Params[i]
		if procParam.Direction == plan.ProcedureParamDirection_In {
			continue
		}
		// Set all user and system variables from INOUT and OUT params
		paramName := strings.ToLower(procParam.Name)
		spp := ctx.Session.GetStoredProcParam(paramName)
		if spp == nil {
			return nil, fmt.Errorf("parameter `%s` not found", paramName)
		}
		switch p := param.(type) {
		case *expression.ProcedureParam:
			err = p.Set(ctx, spp.Value, spp.Type)
		case *expression.UserVar:
			val := spp.Value
			if procParam.Direction == plan.ProcedureParamDirection_Out && !spp.HasBeenSet {
				val = nil
			}
			err = ctx.SetUserVariable(ctx, p.Name, val, spp.Type)
		case *expression.SystemVar:
			err = fmt.Errorf("unable to set `%s` as it is a system variable", p.Name)
		}
		if err != nil {
			return nil, err
		}
	}

	return &callIter{
		call:      n,
		innerIter: rowIter,
	}, nil
}

// buildLoop builds and returns an iterator that can be used to iterate over the result set returned from the
// specified loop, |n|, for the specified row, |row|. Note that because of how we execute stored procedures and cache
// the results in order to only send back the LAST result set (instead of supporting multiple results sets from
// stored procedures, like MySQL does), building the iterator here also implicitly means that we're executing the
// loop logic and caching the result set in memory. This will obviously be an issue for very large result sets.
// Unfortunately, we can't know at analysis time what the last result set returned will be, since conditional logic
// in stored procedures can't be known until execution time, hence why we end up caching result sets when we
// see them and just playing back the last one. Adding support for MySQL's multiple result set behavior and better
// matching MySQL on which statements are allowed to return result sets from a stored procedure seems like it could
// potentially allow us to get rid of that caching.
func (b *BaseBuilder) buildLoop(ctx *sql.Context, n *plan.Loop, row sql.Row) (sql.RowIter, error) {
	// Acquiring the RowIter will actually execute the loop body once (because of how we cache/scan for the right
	// SELECT result set to return), so we grab the iter ONLY if we're supposed to run through the loop body once
	// before evaluating the condition
	var loopBodyIter sql.RowIter
	if n.OnceBeforeEval {
		var err error
		loopBodyIter, err = b.loopAcquireRowIter(ctx, row, n.Label, n.Block, true)
		if err != nil {
			return nil, err
		}
	}

	var returnRows []sql.Row
	var returnNode sql.Node
	var returnIter sql.RowIter
	var returnSch sql.Schema
	selectSeen := false

	// It's technically valid to make an infinite loop, but we don't want to actually allow that
	const maxIterationCount = 10_000_000_000

	for loopIteration := 0; loopIteration <= maxIterationCount; loopIteration++ {
		if loopIteration >= maxIterationCount {
			return nil, fmt.Errorf("infinite LOOP detected")
		}

		// If the condition is false, then we stop evaluation
		condition, err := n.Condition.Eval(ctx, nil)
		if err != nil {
			return nil, err
		}
		conditionBool, err := sql.ConvertToBool(ctx, condition)
		if err != nil {
			return nil, err
		}
		if !conditionBool {
			// loopBodyIter should only be set if this is the first time through the loop and the loop has a
			// OnceBeforeEval condition. This ensures we return a result set, without us having to drain the iterator,
			// recache rows, and return a new iterator.
			if loopBodyIter != nil {
				return loopBodyIter, nil
			} else {
				break
			}
		}

		if loopBodyIter == nil {
			var err error
			loopBodyIter, err = b.loopAcquireRowIter(ctx, nil, strings.ToLower(n.Label), n.Block, false)
			if err == io.EOF {
				break
			} else if err != nil {
				return nil, err
			}
		}
		loopBodyIter = withSafepointPeriodicallyIter(loopBodyIter)

		includeResultSet := false

		var subIterNode sql.Node = n.Block
		subIterSch := n.Block.Schema()
		if blockRowIter, ok := loopBodyIter.(plan.BlockRowIter); ok {
			subIterNode = blockRowIter.RepresentingNode()
			subIterSch = blockRowIter.Schema()

			if plan.NodeRepresentsSelect(subIterNode) {
				selectSeen = true
				includeResultSet = true
				returnNode = subIterNode
				returnIter = loopBodyIter
				returnSch = subIterSch
			} else if !selectSeen {
				includeResultSet = true
				returnNode = subIterNode
				returnIter = loopBodyIter
				returnSch = subIterSch
			}
		}

		// Wrap the caching code in an inline function so that we can use defer to safely dispose of the cache
		err = func() error {
			rowCache, disposeFunc := ctx.Memory.NewRowsCache()
			defer disposeFunc()

			nextRow, err := loopBodyIter.Next(ctx)
			for ; err == nil; nextRow, err = loopBodyIter.Next(ctx) {
				rowCache.Add(nextRow)
			}
			if err != io.EOF {
				return err
			}

			err = loopBodyIter.Close(ctx)
			if err != nil {
				return err
			}
			loopBodyIter = nil

			if includeResultSet {
				returnRows = rowCache.Get()
			}
			return nil
		}()

		if err != nil {
			if err == io.EOF {
				// no-op for an EOF, just execute the next loop iteration
			} else if controlFlow, ok := err.(loopError); ok && strings.ToLower(controlFlow.Label) == n.Label {
				if controlFlow.IsExit {
					break
				}
			} else {
				// If the error wasn't a control flow error signaling to start the next loop iteration or to
				// exit the loop, then it must be a real error, so just return it.
				return nil, err
			}
		}
	}

	return &blockIter{
		internalIter: sql.RowsToRowIter(returnRows...),
		repNode:      returnNode,
		repSch:       returnSch,
		repIter:      returnIter,
	}, nil
}

func (b *BaseBuilder) buildElseCaseError(ctx *sql.Context, n plan.ElseCaseError, row sql.Row) (sql.RowIter, error) {
	return elseCaseErrorIter{}, nil
}

func (b *BaseBuilder) buildOpen(ctx *sql.Context, n *plan.Open, row sql.Row) (sql.RowIter, error) {
	return &openIter{pRef: n.Pref, name: n.Name, row: row, b: b}, nil
}

func (b *BaseBuilder) buildClose(ctx *sql.Context, n *plan.Close, row sql.Row) (sql.RowIter, error) {
	return &closeIter{pRef: n.Pref, name: n.Name}, nil
}

func (b *BaseBuilder) buildLeave(ctx *sql.Context, n *plan.Leave, row sql.Row) (sql.RowIter, error) {
	return &leaveIter{n.Label}, nil
}

func (b *BaseBuilder) buildIterate(ctx *sql.Context, n *plan.Iterate, row sql.Row) (sql.RowIter, error) {
	return &iterateIter{n.Label}, nil
}

func (b *BaseBuilder) buildWhile(ctx *sql.Context, n *plan.While, row sql.Row) (sql.RowIter, error) {
	return b.buildLoop(ctx, n.Loop, row)
}
