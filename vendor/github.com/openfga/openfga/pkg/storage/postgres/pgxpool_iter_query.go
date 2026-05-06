package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/openfga/openfga/pkg/storage/sqlcommon"
)

// PgxQuery interface allows Query that returns pgx.Rows.
type PgxQuery interface {
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
}

// PgxExec interface allows pgx Exec functionality.
type PgxExec interface {
	Exec(ctx context.Context, sql string, arguments ...any) (commandTag pgconn.CommandTag, err error)
}

// SQLBuilder represents any SQL statement builder that can generate
// SQL strings with parameterized arguments.
type SQLBuilder interface {
	ToSql() (string, []interface{}, error)
}

// PgxTxnIterQuery is a helper to run queries using pgxpool when used in sqlcommon iterator.
type PgxTxnIterQuery struct {
	txn   PgxQuery
	query string
	args  []interface{}
}

var _ sqlcommon.SQLIteratorRowGetter = (*PgxTxnIterQuery)(nil)

// NewPgxTxnGetRows creates a PgxTxnIterQuery which allows the GetRows functionality via the specified PgxQuery txn.
func NewPgxTxnGetRows(txn PgxQuery, sb SQLBuilder) (*PgxTxnIterQuery, error) {
	stmt, args, err := sb.ToSql()
	if err != nil {
		return nil, err
	}
	return &PgxTxnIterQuery{
		txn:   txn,
		query: stmt,
		args:  args,
	}, nil
}

// GetRows executes the txn query and returns the sqlcommon.Rows.
func (p *PgxTxnIterQuery) GetRows(ctx context.Context) (sqlcommon.Rows, error) {
	rows, err := p.txn.Query(ctx, p.query, p.args...)
	if err != nil {
		return nil, HandleSQLError(err)
	}
	return &pgxRowsWrapper{rows: rows}, nil
}

// pgxRowsWrapper wraps pgx.Rows to implement sqlcommon.Rows interface.
type pgxRowsWrapper struct {
	rows pgx.Rows
}

func (r *pgxRowsWrapper) Err() error {
	return r.rows.Err()
}

func (r *pgxRowsWrapper) Next() bool {
	return r.rows.Next()
}

func (r *pgxRowsWrapper) Scan(dest ...any) error {
	return r.rows.Scan(dest...)
}

func (r *pgxRowsWrapper) Close() error {
	r.rows.Close()
	return nil
}

var _ sqlcommon.Rows = (*pgxRowsWrapper)(nil)
