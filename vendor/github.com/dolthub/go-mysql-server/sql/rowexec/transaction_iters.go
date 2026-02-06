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
	"io"

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

type rowFunc func(ctx *sql.Context) (sql.Row, error)

type lazyRowIter struct {
	next rowFunc
}

func (i *lazyRowIter) Next(ctx *sql.Context) (sql.Row, error) {
	if i.next != nil {
		res, err := i.next(ctx)
		i.next = nil
		return res, err
	}
	return nil, io.EOF
}

func (i *lazyRowIter) Close(ctx *sql.Context) error {
	return nil
}

// ErrTableNotLockable is returned whenever a lockable table can't be found.
var ErrTableNotLockable = errors.NewKind("table %s is not lockable")

func getLockable(node sql.Node) (sql.Lockable, error) {
	switch node := node.(type) {
	case *plan.ResolvedTable:
		return getLockableTable(node.Table)
	case sql.TableWrapper:
		return getLockableTable(node.Underlying())
	default:
		return nil, ErrTableNotLockable.New("unknown")
	}
}

func getLockableTable(table sql.Table) (sql.Lockable, error) {
	switch t := table.(type) {
	case sql.Lockable:
		return t, nil
	case sql.TableWrapper:
		return getLockableTable(t.Underlying())
	default:
		return nil, ErrTableNotLockable.New(t.Name())
	}
}

// TransactionCommittingIter is a simple RowIter wrapper to allow the engine to conditionally commit a transaction
// during the Close() operation
type TransactionCommittingIter struct {
	childIter           sql.RowIter
	transactionDatabase string
	autoCommit          bool
	implicitCommit      bool
}

func AddTransactionCommittingIter(ctx *sql.Context, qFlags *sql.QueryFlags, iter sql.RowIter) (sql.RowIter, error) {
	// TODO: This is a bit of a hack. Need to figure out better relationship between new transaction node and warnings.
	if (qFlags != nil && qFlags.IsSet(sql.QFlagShowWarnings)) || ctx.IsInterpreted() {
		return iter, nil
	}

	autoCommit, err := plan.IsSessionAutocommit(ctx)
	if err != nil {
		return nil, err
	}

	implicitCommit := qFlags != nil && (qFlags.IsSet(sql.QFlagDDL) || qFlags.IsSet(sql.QFlagAlterTable) || qFlags.IsSet(sql.QFlagDBDDL))
	return &TransactionCommittingIter{
		childIter:      iter,
		autoCommit:     autoCommit,
		implicitCommit: implicitCommit,
	}, nil
}

func (t *TransactionCommittingIter) Next(ctx *sql.Context) (sql.Row, error) {
	return t.childIter.Next(ctx)
}

func (t *TransactionCommittingIter) Close(ctx *sql.Context) error {
	var err error
	if t.childIter != nil {
		err = t.childIter.Close(ctx)
	}
	if err != nil {
		return err
	}

	tx := ctx.GetTransaction()
	if tx == nil {
		return nil
	}

	if !t.implicitCommit && ctx.GetIgnoreAutoCommit() {
		return nil
	}

	if !t.implicitCommit && !t.autoCommit {
		return nil
	}

	ts, ok := ctx.Session.(sql.TransactionSession)
	if !ok {
		return nil
	}

	ctx.GetLogger().Tracef("committing transaction %s", tx)
	if err := ts.CommitTransaction(ctx, tx); err != nil {
		return err
	}

	// Clearing out the current transaction will tell us to start a new one the next time this session queries
	ctx.SetTransaction(nil)

	return nil
}

func (t *TransactionCommittingIter) GetIter() sql.RowIter {
	return t.childIter
}

func (t *TransactionCommittingIter) WithChildIter(childIter sql.RowIter) sql.RowIter {
	nt := *t
	nt.childIter = childIter
	return &nt
}
