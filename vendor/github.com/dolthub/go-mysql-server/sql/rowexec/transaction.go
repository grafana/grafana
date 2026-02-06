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
	"fmt"

	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

func (b *BaseBuilder) buildRollbackSavepoint(ctx *sql.Context, n *plan.RollbackSavepoint, row sql.Row) (sql.RowIter, error) {
	ts, ok := ctx.Session.(sql.TransactionSession)
	if !ok {
		return sql.RowsToRowIter(), nil
	}

	transaction := ctx.GetTransaction()

	if transaction == nil {
		return sql.RowsToRowIter(), nil
	}

	err := ts.RollbackToSavepoint(ctx, transaction, n.Name)
	if err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildReleaseSavepoint(ctx *sql.Context, n *plan.ReleaseSavepoint, row sql.Row) (sql.RowIter, error) {
	ts, ok := ctx.Session.(sql.TransactionSession)
	if !ok {
		return sql.RowsToRowIter(), nil
	}

	transaction := ctx.GetTransaction()

	if transaction == nil {
		return sql.RowsToRowIter(), nil
	}

	err := ts.ReleaseSavepoint(ctx, transaction, n.Name)
	if err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildCreateSavepoint(ctx *sql.Context, n *plan.CreateSavepoint, row sql.Row) (sql.RowIter, error) {
	ts, ok := ctx.Session.(sql.TransactionSession)
	if !ok {
		return sql.RowsToRowIter(), nil
	}

	transaction := ctx.GetTransaction()

	if transaction == nil {
		return sql.RowsToRowIter(), nil
	}

	err := ts.CreateSavepoint(ctx, transaction, n.Name)
	if err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildStartTransaction(ctx *sql.Context, n *plan.StartTransaction, row sql.Row) (sql.RowIter, error) {
	ts, ok := ctx.Session.(sql.TransactionSession)
	if !ok {
		return sql.RowsToRowIter(), nil
	}

	currentTx := ctx.GetTransaction()
	// A START TRANSACTION statement commits any pending work before beginning a new tx
	// TODO: this work is wasted in the case that START TRANSACTION is the first statement after COMMIT
	//  an isDirty method on the transaction would allow us to avoid this
	if currentTx != nil {
		err := ts.CommitTransaction(ctx, currentTx)
		if err != nil {
			return nil, err
		}
	}

	transaction, err := ts.StartTransaction(ctx, n.TransChar)
	if err != nil {
		return nil, err
	}

	ctx.SetTransaction(transaction)
	// until this transaction is committed or rolled back, don't begin or commit any transactions automatically
	ctx.SetIgnoreAutoCommit(true)

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildStartReplica(ctx *sql.Context, n *plan.StartReplica, row sql.Row) (sql.RowIter, error) {
	if n.ReplicaController == nil {
		return nil, plan.ErrNoReplicationController.New()
	}

	err := n.ReplicaController.StartReplica(ctx)
	return sql.RowsToRowIter(), err
}

func (b *BaseBuilder) buildUnlockTables(ctx *sql.Context, n *plan.UnlockTables, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.UnlockTables")
	defer span.End()

	if err := n.Catalog.UnlockTables(ctx, ctx.ID()); err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildCommit(ctx *sql.Context, n *plan.Commit, row sql.Row) (sql.RowIter, error) {
	ts, ok := ctx.Session.(sql.TransactionSession)
	if !ok {
		return sql.RowsToRowIter(), nil
	}

	transaction := ctx.GetTransaction()

	if transaction == nil {
		return sql.RowsToRowIter(), nil
	}

	err := ts.CommitTransaction(ctx, transaction)
	if err != nil {
		return nil, err
	}

	ctx.SetIgnoreAutoCommit(false)
	ctx.SetTransaction(nil)

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildKill(ctx *sql.Context, n *plan.Kill, row sql.Row) (sql.RowIter, error) {
	return &lazyRowIter{
		func(ctx *sql.Context) (sql.Row, error) {
			ctx.ProcessList.Kill(n.ConnID)
			if n.Kt == plan.KillType_Connection {
				ctx.KillConnection(n.ConnID)
			}
			return sql.NewRow(types.NewOkResult(0)), nil
		},
	}, nil
}

func (b *BaseBuilder) buildResetReplica(ctx *sql.Context, n *plan.ResetReplica, row sql.Row) (sql.RowIter, error) {
	if n.ReplicaController == nil {
		return nil, plan.ErrNoReplicationController.New()
	}

	err := n.ReplicaController.ResetReplica(ctx, n.All)
	return sql.RowsToRowIter(), err
}

func (b *BaseBuilder) buildRollback(ctx *sql.Context, n *plan.Rollback, row sql.Row) (sql.RowIter, error) {
	ts, ok := ctx.Session.(sql.TransactionSession)
	if !ok {
		return sql.RowsToRowIter(), nil
	}

	transaction := ctx.GetTransaction()

	if transaction == nil {
		return sql.RowsToRowIter(), nil
	}

	err := ts.Rollback(ctx, transaction)
	if err != nil {
		return nil, err
	}

	// Like Commit, Rollback ends the current transaction and a new one begins with the next statement
	ctx.SetIgnoreAutoCommit(false)
	ctx.SetTransaction(nil)

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildChangeReplicationSource(ctx *sql.Context, n *plan.ChangeReplicationSource, row sql.Row) (sql.RowIter, error) {
	if n.ReplicaController == nil {
		return nil, plan.ErrNoReplicationController.New()
	}

	err := n.ReplicaController.SetReplicationSourceOptions(ctx, n.Options)
	return sql.RowsToRowIter(), err
}

func (b *BaseBuilder) buildLockTables(ctx *sql.Context, n *plan.LockTables, row sql.Row) (sql.RowIter, error) {
	span, ctx := ctx.Span("plan.LockTables")
	defer span.End()

	for _, l := range n.Locks {
		lockable, err := getLockable(l.Table)
		if err != nil {
			// If a table is not lockable, just skip it
			ctx.Warn(0, "%s", err.Error())
			continue
		}

		if err := lockable.Lock(ctx, l.Write); err != nil {
			ctx.Error(0, "unable to lock table: %s", err)
		} else {
			n.Catalog.LockTable(ctx, lockable.Name())
		}
	}

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildSignal(ctx *sql.Context, n *plan.Signal, row sql.Row) (sql.RowIter, error) {
	//TODO: implement CLASS_ORIGIN
	//TODO: implement SUBCLASS_ORIGIN
	//TODO: implement CONSTRAINT_CATALOG
	//TODO: implement CONSTRAINT_SCHEMA
	//TODO: implement CONSTRAINT_NAME
	//TODO: implement CATALOG_NAME
	//TODO: implement SCHEMA_NAME
	//TODO: implement TABLE_NAME
	//TODO: implement COLUMN_NAME
	//TODO: implement CURSOR_NAME
	if n.SqlStateValue[0:2] == "01" {
		//TODO: implement warnings
		return nil, fmt.Errorf("warnings not yet implemented")
	} else {

		messageItem := n.Info[plan.SignalConditionItemName_MessageText]
		strValue := messageItem.StrValue
		if messageItem.ExprVal != nil {
			exprResult, err := messageItem.ExprVal.Eval(ctx, nil)
			if err != nil {
				return nil, err
			}
			s, ok := exprResult.(string)
			if !ok {
				return nil, fmt.Errorf("message text expression did not evaluate to a string")
			}
			strValue = s
		}

		return nil, mysql.NewSQLError(
			int(n.Info[plan.SignalConditionItemName_MysqlErrno].IntValue),
			n.SqlStateValue,
			"%s",
			strValue,
		)
	}
}

func (b *BaseBuilder) buildStopReplica(ctx *sql.Context, n *plan.StopReplica, row sql.Row) (sql.RowIter, error) {
	if n.ReplicaController == nil {
		return nil, plan.ErrNoReplicationController.New()
	}

	err := n.ReplicaController.StopReplica(ctx)
	return sql.RowsToRowIter(), err
}

func (b *BaseBuilder) buildChangeReplicationFilter(ctx *sql.Context, n *plan.ChangeReplicationFilter, row sql.Row) (sql.RowIter, error) {
	if n.ReplicaController == nil {
		return nil, plan.ErrNoReplicationController.New()
	}

	err := n.ReplicaController.SetReplicationFilterOptions(ctx, n.Options)
	return sql.RowsToRowIter(), err
}

func (b *BaseBuilder) buildExecuteQuery(ctx *sql.Context, n *plan.ExecuteQuery, row sql.Row) (sql.RowIter, error) {
	return nil, fmt.Errorf("%T does not have an execution iterator", n)
}

func (b *BaseBuilder) buildUse(ctx *sql.Context, n *plan.Use, row sql.Row) (sql.RowIter, error) {
	return n.RowIter(ctx, row)
}
