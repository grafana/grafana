package pgxpool

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Tx represents a database transaction acquired from a Pool.
type Tx struct {
	t pgx.Tx
	c *Conn
}

// Begin starts a pseudo nested transaction implemented with a savepoint.
func (tx *Tx) Begin(ctx context.Context) (pgx.Tx, error) {
	return tx.t.Begin(ctx)
}

// Commit commits the transaction and returns the associated connection back to the Pool. Commit will return an error
// where errors.Is(ErrTxClosed) is true if the Tx is already closed, but is otherwise safe to call multiple times. If
// the commit fails with a rollback status (e.g. the transaction was already in a broken state) then ErrTxCommitRollback
// will be returned.
func (tx *Tx) Commit(ctx context.Context) error {
	err := tx.t.Commit(ctx)
	if tx.c != nil {
		tx.c.Release()
		tx.c = nil
	}
	return err
}

// Rollback rolls back the transaction and returns the associated connection back to the Pool. Rollback will return
// where an error where errors.Is(ErrTxClosed) is true if the Tx is already closed, but is otherwise safe to call
// multiple times. Hence, defer tx.Rollback() is safe even if tx.Commit() will be called first in a non-error condition.
func (tx *Tx) Rollback(ctx context.Context) error {
	err := tx.t.Rollback(ctx)
	if tx.c != nil {
		tx.c.Release()
		tx.c = nil
	}
	return err
}

func (tx *Tx) CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
	return tx.t.CopyFrom(ctx, tableName, columnNames, rowSrc)
}

func (tx *Tx) SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults {
	return tx.t.SendBatch(ctx, b)
}

func (tx *Tx) LargeObjects() pgx.LargeObjects {
	return tx.t.LargeObjects()
}

// Prepare creates a prepared statement with name and sql. If the name is empty,
// an anonymous prepared statement will be used. sql can contain placeholders
// for bound parameters. These placeholders are referenced positionally as $1, $2, etc.
//
// Prepare is idempotent; i.e. it is safe to call Prepare multiple times with the same
// name and sql arguments. This allows a code path to Prepare and Query/Exec without
// needing to first check whether the statement has already been prepared.
func (tx *Tx) Prepare(ctx context.Context, name, sql string) (*pgconn.StatementDescription, error) {
	return tx.t.Prepare(ctx, name, sql)
}

func (tx *Tx) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	return tx.t.Exec(ctx, sql, arguments...)
}

func (tx *Tx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return tx.t.Query(ctx, sql, args...)
}

func (tx *Tx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return tx.t.QueryRow(ctx, sql, args...)
}

func (tx *Tx) Conn() *pgx.Conn {
	return tx.t.Conn()
}
