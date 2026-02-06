package pgxpool

import (
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type errBatchResults struct {
	err error
}

func (br errBatchResults) Exec() (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, br.err
}

func (br errBatchResults) Query() (pgx.Rows, error) {
	return errRows{err: br.err}, br.err
}

func (br errBatchResults) QueryRow() pgx.Row {
	return errRow{err: br.err}
}

func (br errBatchResults) Close() error {
	return br.err
}

type poolBatchResults struct {
	br pgx.BatchResults
	c  *Conn
}

func (br *poolBatchResults) Exec() (pgconn.CommandTag, error) {
	return br.br.Exec()
}

func (br *poolBatchResults) Query() (pgx.Rows, error) {
	return br.br.Query()
}

func (br *poolBatchResults) QueryRow() pgx.Row {
	return br.br.QueryRow()
}

func (br *poolBatchResults) Close() error {
	err := br.br.Close()
	if br.c != nil {
		br.c.Release()
		br.c = nil
	}
	return err
}
