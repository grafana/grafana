package database

import (
	"context"
	"database/sql"
)

// DBTxConn is a thin interface for common methods that is satisfied by *sql.DB, *sql.Tx and
// *sql.Conn.
//
// There is a long outstanding issue to formalize a std lib interface, but alas. See:
// https://github.com/golang/go/issues/14468
type DBTxConn interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

var (
	_ DBTxConn = (*sql.DB)(nil)
	_ DBTxConn = (*sql.Tx)(nil)
	_ DBTxConn = (*sql.Conn)(nil)
)
